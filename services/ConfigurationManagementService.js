const logger = require('../utils/logger.js');

class ConfigurationManagementService {
  constructor() {
    this.guildConfigs = new Map();
    this.defaultConfig = this.initializeDefaultConfig();
    this.featureToggles = new Map();
    this.configHistory = new Map();
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Initialize default configuration
   */
  initializeDefaultConfig() {
    return {
      // Guild Agent Settings
      guildAgent: {
        enabled: true,
        confidenceThreshold: 0.8,
        maxBatchSize: 10,
        requireConfirmation: true,
        confirmationTimeout: 30000
      },
      
      // Auto-Moderation Settings
      autoModeration: {
        enabled: false,
        rules: {
          spam: { enabled: true, maxMessages: 5, timeWindow: 10000 },
          raid: { enabled: true, maxMentions: 5, timeWindow: 5000 },
          scam: { enabled: true, confidence: 0.8 },
          toxicity: { enabled: true, confidence: 0.7 }
        },
        whitelist: [],
        blacklist: [],
        logChannel: null
      },
      
      // Permission & Safety Settings
      permissionSafety: {
        protectedUsers: [],
        blacklistedUsers: [],
        maxCommandsPerMinute: 5,
        maxCommandsPerHour: 20,
        cooldownPeriods: {
          ban: 10000,
          kick: 5000,
          mute: 3000,
          warn: 1000
        }
      },
      
      // Feature Toggles
      features: {
        naturalLanguage: true,
        batchOperations: true,
        confirmationSystem: true,
        auditLogging: true,
        autoModeration: false,
        mlPipeline: false
      },
      
      // UI Settings
      ui: {
        language: 'vi',
        timezone: 'Asia/Ho_Chi_Minh',
        dateFormat: 'DD/MM/YYYY HH:mm:ss',
        embedColor: 0x5865F2
      },
      
      // Logging Settings
      logging: {
        level: 'info',
        channels: {
          moderation: null,
          errors: null,
          general: null
        },
        retention: 30 // days
      }
    };
  }

  /**
   * Initialize configuration for a guild
   * @param {string} guildId - Guild ID
   * @param {Object} customConfig - Custom configuration
   */
  initializeGuild(guildId, customConfig = {}) {
    const config = this.deepMerge(this.defaultConfig, customConfig);
    this.guildConfigs.set(guildId, config);
    
    // Initialize feature toggles
    this.featureToggles.set(guildId, new Map());
    
    // Initialize config history
    this.configHistory.set(guildId, []);
    
    logger.info('CONFIG_MGMT', `Initialized configuration for guild ${guildId}`);
    return config;
  }

  /**
   * Get guild configuration
   * @param {string} guildId - Guild ID
   * @param {string} path - Configuration path (e.g., 'guildAgent.enabled')
   * @returns {any} - Configuration value
   */
  getGuildConfig(guildId, path = null) {
    const config = this.guildConfigs.get(guildId);
    if (!config) {
      return this.initializeGuild(guildId);
    }

    if (!path) {
      return config;
    }

    return this.getNestedValue(config, path);
  }

  /**
   * Set guild configuration
   * @param {string} guildId - Guild ID
   * @param {string} path - Configuration path
   * @param {any} value - New value
   * @param {string} reason - Reason for change
   */
  setGuildConfig(guildId, path, value, reason = 'Manual update') {
    const config = this.guildConfigs.get(guildId);
    if (!config) {
      this.initializeGuild(guildId);
      return this.setGuildConfig(guildId, path, value, reason);
    }

    // Create backup before change
    this.createConfigBackup(guildId, reason);

    // Update configuration
    this.setNestedValue(config, path, value);
    this.guildConfigs.set(guildId, config);

    // Log change
    this.logConfigChange(guildId, path, value, reason);

    logger.info('CONFIG_MGMT', `Updated config for guild ${guildId}: ${path} = ${value}`);
  }

  /**
   * Toggle feature for guild
   * @param {string} guildId - Guild ID
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable/disable
   */
  toggleFeature(guildId, feature, enabled) {
    const toggles = this.featureToggles.get(guildId) || new Map();
    toggles.set(feature, enabled);
    this.featureToggles.set(guildId, toggles);

    // Update main config
    this.setGuildConfig(guildId, `features.${feature}`, enabled, `Feature toggle: ${feature}`);

    logger.info('CONFIG_MGMT', `Toggled feature ${feature} for guild ${guildId}: ${enabled}`);
  }

  /**
   * Check if feature is enabled
   * @param {string} guildId - Guild ID
   * @param {string} feature - Feature name
   * @returns {boolean} - Feature enabled status
   */
  isFeatureEnabled(guildId, feature) {
    const toggles = this.featureToggles.get(guildId);
    if (toggles && toggles.has(feature)) {
      return toggles.get(feature);
    }

    const config = this.getGuildConfig(guildId);
    return this.getNestedValue(config, `features.${feature}`) || false;
  }

  /**
   * Reset guild configuration to default
   * @param {string} guildId - Guild ID
   * @param {string} reason - Reason for reset
   */
  resetGuildConfig(guildId, reason = 'Reset to default') {
    this.createConfigBackup(guildId, reason);
    this.initializeGuild(guildId);
    logger.info('CONFIG_MGMT', `Reset configuration for guild ${guildId}`);
  }

  /**
   * Export guild configuration
   * @param {string} guildId - Guild ID
   * @returns {Object} - Exported configuration
   */
  exportGuildConfig(guildId) {
    const config = this.getGuildConfig(guildId);
    const toggles = this.featureToggles.get(guildId);
    
    return {
      guildId: guildId,
      config: config,
      featureToggles: toggles ? Object.fromEntries(toggles) : {},
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import guild configuration
   * @param {string} guildId - Guild ID
   * @param {Object} exportedConfig - Exported configuration
   * @param {string} reason - Reason for import
   */
  importGuildConfig(guildId, exportedConfig, reason = 'Configuration import') {
    this.createConfigBackup(guildId, reason);

    // Import main config
    if (exportedConfig.config) {
      this.guildConfigs.set(guildId, exportedConfig.config);
    }

    // Import feature toggles
    if (exportedConfig.featureToggles) {
      this.featureToggles.set(guildId, new Map(Object.entries(exportedConfig.featureToggles)));
    }

    logger.info('CONFIG_MGMT', `Imported configuration for guild ${guildId}`);
  }

  /**
   * Create configuration backup
   * @param {string} guildId - Guild ID
   * @param {string} reason - Reason for backup
   */
  createConfigBackup(guildId, reason) {
    const config = this.guildConfigs.get(guildId);
    const toggles = this.featureToggles.get(guildId);
    
    if (!config) return;

    const backup = {
      timestamp: Date.now(),
      reason: reason,
      config: JSON.parse(JSON.stringify(config)),
      featureToggles: toggles ? Object.fromEntries(toggles) : {}
    };

    const history = this.configHistory.get(guildId) || [];
    history.push(backup);
    
    // Keep only last 10 backups
    if (history.length > 10) {
      history.shift();
    }
    
    this.configHistory.set(guildId, history);
  }

  /**
   * Restore configuration from backup
   * @param {string} guildId - Guild ID
   * @param {number} backupIndex - Backup index (0 = most recent)
   * @returns {boolean} - Success status
   */
  restoreFromBackup(guildId, backupIndex = 0) {
    const history = this.configHistory.get(guildId);
    if (!history || history.length === 0) {
      return false;
    }

    const backup = history[backupIndex];
    if (!backup) {
      return false;
    }

    this.guildConfigs.set(guildId, backup.config);
    this.featureToggles.set(guildId, new Map(Object.entries(backup.featureToggles)));

    logger.info('CONFIG_MGMT', `Restored configuration for guild ${guildId} from backup ${backupIndex}`);
    return true;
  }

  /**
   * Get configuration history
   * @param {string} guildId - Guild ID
   * @returns {Array} - Configuration history
   */
  getConfigHistory(guildId) {
    return this.configHistory.get(guildId) || [];
  }

  /**
   * Log configuration change
   * @param {string} guildId - Guild ID
   * @param {string} path - Configuration path
   * @param {any} value - New value
   * @param {string} reason - Reason for change
   */
  logConfigChange(guildId, path, value, reason) {
    const change = {
      timestamp: Date.now(),
      path: path,
      value: value,
      reason: reason
    };

    // This would typically be stored in a database
    logger.info('CONFIG_MGMT', `Config change for guild ${guildId}:`, change);
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object
   * @param {string} path - Path (e.g., 'a.b.c')
   * @returns {any} - Value
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object
   * @param {Object} obj - Object
   * @param {string} path - Path (e.g., 'a.b.c')
   * @param {any} value - Value
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} - Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get all guild configurations
   * @returns {Object} - All configurations
   */
  getAllConfigs() {
    const configs = {};
    for (const [guildId, config] of this.guildConfigs.entries()) {
      configs[guildId] = {
        config: config,
        featureToggles: Object.fromEntries(this.featureToggles.get(guildId) || new Map())
      };
    }
    return configs;
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old config history
    for (const [guildId, history] of this.configHistory.entries()) {
      const recentHistory = history.filter(backup => 
        now - backup.timestamp < 30 * 24 * 60 * 60 * 1000 // 30 days
      );
      
      if (recentHistory.length !== history.length) {
        this.configHistory.set(guildId, recentHistory);
        cleanedCount += history.length - recentHistory.length;
      }
    }

    if (cleanedCount > 0) {
      logger.info('CONFIG_MGMT', `Cleaned up ${cleanedCount} old configuration backups`);
    }
  }

  /**
   * Start backup scheduler
   */
  startBackupScheduler() {
    setInterval(() => {
      this.cleanup();
      logger.info('CONFIG_MGMT', 'Performed scheduled cleanup');
    }, this.backupInterval);
  }
}

module.exports = new ConfigurationManagementService();
