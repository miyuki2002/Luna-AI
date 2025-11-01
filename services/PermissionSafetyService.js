const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger.js');

class PermissionSafetyService {
  constructor() {
    this.protectedUsers = new Set(); // Whitelist of protected users
    this.blacklistedUsers = new Set(); // Blacklist of users who can't use moderation
    this.roleHierarchy = new Map(); // Role hierarchy cache
    this.safetyRules = this.initializeSafetyRules();
    this.permissionCache = new Map(); // Permission cache
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize safety rules
   */
  initializeSafetyRules() {
    return {
      maxTargetsPerCommand: 10,
      maxCommandsPerMinute: 5,
      maxCommandsPerHour: 20,
      requireConfirmationFor: ['ban', 'unban'],
      requireConfirmationThreshold: 3, // targets
      preventSelfTargeting: true,
      preventBotTargeting: true,
      preventOwnerTargeting: true,
      preventHigherRoleTargeting: true,
      cooldownPeriods: {
        ban: 10000, // 10 seconds
        kick: 5000,  // 5 seconds
        mute: 3000,  // 3 seconds
        warn: 1000,  // 1 second
        deleteMessages: 5000
      }
    };
  }

  /**
   * Validate user permissions
   * @param {Object} user - User object
   * @param {string} action - Action type
   * @param {Object} message - Message object
   * @returns {Object} - Validation result
   */
  async validateUserPermissions(user, action, message) {
    try {
      const member = message.guild.members.cache.get(user.id);
      if (!member) {
        return { allowed: false, reason: 'User not found in guild' };
      }

      // Check if user is blacklisted
      if (this.blacklistedUsers.has(user.id)) {
        return { allowed: false, reason: 'User is blacklisted from using moderation commands' };
      }

      // Check basic permissions
      const permissionCheck = this.checkBasicPermissions(member, action);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Check role hierarchy
      const hierarchyCheck = await this.checkRoleHierarchy(member, message);
      if (!hierarchyCheck.allowed) {
        return hierarchyCheck;
      }

      // Check rate limiting
      const rateLimitCheck = this.checkRateLimit(user.id, action);
      if (!rateLimitCheck.allowed) {
        return rateLimitCheck;
      }

      return { allowed: true, reason: 'All permission checks passed' };

    } catch (error) {
      logger.error('PERMISSION_SAFETY', 'Error validating user permissions:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Check basic Discord permissions
   * @param {Object} member - Guild member
   * @param {string} action - Action type
   * @returns {Object} - Permission check result
   */
  checkBasicPermissions(member, action) {
    const requiredPermissions = {
      ban: [PermissionFlagsBits.BanMembers],
      kick: [PermissionFlagsBits.KickMembers],
      mute: [PermissionFlagsBits.ModerateMembers],
      warn: [PermissionFlagsBits.ModerateMembers],
      deleteMessages: [PermissionFlagsBits.ManageMessages],
      unban: [PermissionFlagsBits.BanMembers],
      unmute: [PermissionFlagsBits.ModerateMembers]
    };

    const permissions = requiredPermissions[action] || [];
    
    for (const permission of permissions) {
      if (!member.permissions.has(permission)) {
        return { 
          allowed: false, 
          reason: `Missing permission: ${permission}`,
          requiredPermission: permission
        };
      }
    }

    return { allowed: true, reason: 'Basic permissions valid' };
  }

  /**
   * Check role hierarchy
   * @param {Object} member - Guild member
   * @param {Object} message - Message object
   * @returns {Object} - Hierarchy check result
   */
  async checkRoleHierarchy(member, message) {
    try {
      const botMember = message.guild.members.me;
      if (!botMember) {
        return { allowed: false, reason: 'Bot not found in guild' };
      }

      // Check if user can moderate bot
      if (member.roles.highest.position >= botMember.roles.highest.position) {
        return { 
          allowed: false, 
          reason: 'User has equal or higher role than bot' 
        };
      }

      // Check if user is trying to moderate someone with higher role
      const targetMentions = message.mentions.users;
      for (const [userId, targetUser] of targetMentions) {
        const targetMember = message.guild.members.cache.get(userId);
        if (targetMember) {
          if (targetMember.roles.highest.position >= member.roles.highest.position) {
            return { 
              allowed: false, 
              reason: `Cannot moderate ${targetUser.username} - they have equal or higher role` 
            };
          }
        }
      }

      return { allowed: true, reason: 'Role hierarchy valid' };

    } catch (error) {
      logger.error('PERMISSION_SAFETY', 'Error checking role hierarchy:', error);
      return { allowed: false, reason: 'Error checking role hierarchy' };
    }
  }

  /**
   * Check rate limiting
   * @param {string} userId - User ID
   * @param {string} action - Action type
   * @returns {Object} - Rate limit check result
   */
  checkRateLimit(userId, action) {
    const now = Date.now();
    const userKey = `${userId}_${action}`;
    
    // Get or create user rate limit data
    if (!this.permissionCache.has(userKey)) {
      this.permissionCache.set(userKey, {
        commands: [],
        lastReset: now
      });
    }

    const userData = this.permissionCache.get(userKey);
    
    // Clean old commands (older than 1 hour)
    userData.commands = userData.commands.filter(
      timestamp => now - timestamp < 60 * 60 * 1000
    );

    // Check cooldown
    const cooldown = this.safetyRules.cooldownPeriods[action] || 1000;
    const lastCommand = userData.commands[userData.commands.length - 1];
    if (lastCommand && now - lastCommand < cooldown) {
      const remainingTime = Math.ceil((cooldown - (now - lastCommand)) / 1000);
      return { 
        allowed: false, 
        reason: `Cooldown active. Wait ${remainingTime} seconds.` 
      };
    }

    // Check commands per minute
    const commandsLastMinute = userData.commands.filter(
      timestamp => now - timestamp < 60 * 1000
    ).length;
    
    if (commandsLastMinute >= this.safetyRules.maxCommandsPerMinute) {
      return { 
        allowed: false, 
        reason: `Too many commands. Max ${this.safetyRules.maxCommandsPerMinute} per minute.` 
      };
    }

    // Check commands per hour
    if (userData.commands.length >= this.safetyRules.maxCommandsPerHour) {
      return { 
        allowed: false, 
        reason: `Too many commands. Max ${this.safetyRules.maxCommandsPerHour} per hour.` 
      };
    }

    // Record this command
    userData.commands.push(now);
    this.permissionCache.set(userKey, userData);

    return { allowed: true, reason: 'Rate limit check passed' };
  }

  /**
   * Validate target safety
   * @param {Object} target - Target user
   * @param {Object} message - Message object
   * @param {string} action - Action type
   * @returns {Object} - Safety validation result
   */
  validateTargetSafety(target, message, action) {
    try {
      // Check if target is protected
      if (this.protectedUsers.has(target.id)) {
        return { 
          allowed: false, 
          reason: `${target.displayName} is protected from moderation` 
        };
      }

      // Check if trying to target self
      if (this.safetyRules.preventSelfTargeting && target.id === message.author.id) {
        return { 
          allowed: false, 
          reason: 'Cannot target yourself' 
        };
      }

      // Check if trying to target bot
      if (this.safetyRules.preventBotTargeting && target.user.bot) {
        return { 
          allowed: false, 
          reason: 'Cannot target bots' 
        };
      }

      // Check if trying to target guild owner
      if (this.safetyRules.preventOwnerTargeting && target.id === message.guild.ownerId) {
        return { 
          allowed: false, 
          reason: 'Cannot target guild owner' 
        };
      }

      // Check if trying to target someone with higher role
      if (this.safetyRules.preventHigherRoleTargeting) {
        const member = message.guild.members.cache.get(message.author.id);
        const targetMember = message.guild.members.cache.get(target.id);
        
        if (member && targetMember) {
          if (targetMember.roles.highest.position >= member.roles.highest.position) {
            return { 
              allowed: false, 
              reason: `Cannot target ${target.displayName} - they have equal or higher role` 
            };
          }
        }
      }

      return { allowed: true, reason: 'Target safety check passed' };

    } catch (error) {
      logger.error('PERMISSION_SAFETY', 'Error validating target safety:', error);
      return { allowed: false, reason: 'Error checking target safety' };
    }
  }

  /**
   * Check if action requires confirmation
   * @param {string} action - Action type
   * @param {number} targetCount - Number of targets
   * @returns {boolean} - Whether confirmation is required
   */
  requiresConfirmation(action, targetCount) {
    // Check if action is in require confirmation list
    if (this.safetyRules.requireConfirmationFor.includes(action)) {
      return true;
    }

    // Check if target count exceeds threshold
    if (targetCount >= this.safetyRules.requireConfirmationThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Add protected user
   * @param {string} userId - User ID
   */
  addProtectedUser(userId) {
    this.protectedUsers.add(userId);
    logger.info('PERMISSION_SAFETY', `Added protected user: ${userId}`);
  }

  /**
   * Remove protected user
   * @param {string} userId - User ID
   */
  removeProtectedUser(userId) {
    this.protectedUsers.delete(userId);
    logger.info('PERMISSION_SAFETY', `Removed protected user: ${userId}`);
  }

  /**
   * Add blacklisted user
   * @param {string} userId - User ID
   */
  addBlacklistedUser(userId) {
    this.blacklistedUsers.add(userId);
    logger.info('PERMISSION_SAFETY', `Added blacklisted user: ${userId}`);
  }

  /**
   * Remove blacklisted user
   * @param {string} userId - User ID
   */
  removeBlacklistedUser(userId) {
    this.blacklistedUsers.delete(userId);
    logger.info('PERMISSION_SAFETY', `Removed blacklisted user: ${userId}`);
  }

  /**
   * Get safety statistics
   * @returns {Object} - Safety statistics
   */
  getSafetyStats() {
    return {
      protectedUsers: this.protectedUsers.size,
      blacklistedUsers: this.blacklistedUsers.size,
      cachedPermissions: this.permissionCache.size,
      safetyRules: this.safetyRules
    };
  }

  /**
   * Clean up expired cache
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, data] of this.permissionCache.entries()) {
      if (now - data.lastReset > this.cacheExpiry) {
        this.permissionCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('PERMISSION_SAFETY', `Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Reset user rate limits
   * @param {string} userId - User ID
   */
  resetUserRateLimits(userId) {
    const keysToDelete = [];
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.permissionCache.delete(key));
    logger.info('PERMISSION_SAFETY', `Reset rate limits for user: ${userId}`);
  }

  /**
   * Update safety rules
   * @param {Object} newRules - New safety rules
   */
  updateSafetyRules(newRules) {
    this.safetyRules = { ...this.safetyRules, ...newRules };
    logger.info('PERMISSION_SAFETY', 'Updated safety rules:', newRules);
  }

  /**
   * Get user permission summary
   * @param {string} userId - User ID
   * @param {Object} message - Message object
   * @returns {Object} - Permission summary
   */
  async getUserPermissionSummary(userId, message) {
    const member = message.guild.members.cache.get(userId);
    if (!member) {
      return { error: 'User not found in guild' };
    }

    const permissions = {
      ban: member.permissions.has(PermissionFlagsBits.BanMembers),
      kick: member.permissions.has(PermissionFlagsBits.KickMembers),
      mute: member.permissions.has(PermissionFlagsBits.ModerateMembers),
      warn: member.permissions.has(PermissionFlagsBits.ModerateMembers),
      deleteMessages: member.permissions.has(PermissionFlagsBits.ManageMessages),
      manageRoles: member.permissions.has(PermissionFlagsBits.ManageRoles),
      manageChannels: member.permissions.has(PermissionFlagsBits.ManageChannels)
    };

    const rateLimitData = this.permissionCache.get(`${userId}_ban`) || { commands: [] };
    const commandsLastHour = rateLimitData.commands.length;

    return {
      permissions,
      isProtected: this.protectedUsers.has(userId),
      isBlacklisted: this.blacklistedUsers.has(userId),
      commandsLastHour,
      rolePosition: member.roles.highest.position,
      canModerateBot: member.roles.highest.position < message.guild.members.me.roles.highest.position
    };
  }
}

module.exports = new PermissionSafetyService();
