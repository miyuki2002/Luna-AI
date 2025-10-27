const logger = require('../utils/logger.js');

class GuildAgentInitializer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all Guild Agent services
   * @param {Object} client - Discord client
   */
  async initialize(client) {
    if (this.initialized) {
      logger.warn('GUILD_AGENT_INIT', 'Services already initialized');
      return;
    }

    try {
      logger.info('GUILD_AGENT_INIT', 'Starting Guild Agent initialization...');

      // Initialize core services
      await this.initializeCoreServices();
      
      // Initialize message handlers
      await this.initializeMessageHandlers(client);
      
      // Initialize slash command handlers
      await this.initializeSlashCommandHandlers();
      
      // Initialize auto-moderation
      await this.initializeAutoModeration();
      
      // Initialize configuration management
      await this.initializeConfigurationManagement();
      
      // Start cleanup schedulers
      this.startCleanupSchedulers();
      
      this.initialized = true;
      logger.info('GUILD_AGENT_INIT', 'Guild Agent initialization completed successfully');

    } catch (error) {
      logger.error('GUILD_AGENT_INIT', 'Error during initialization:', error);
      throw error;
    }
  }

  /**
   * Initialize core services
   */
  async initializeCoreServices() {
    logger.info('GUILD_AGENT_INIT', 'Initializing core services...');

    // Guild Agent Service
    const guildAgentService = require('./GuildAgentService');
    this.services.set('guildAgent', guildAgentService);

    // Natural Language Processor
    const naturalLanguageProcessor = require('./NaturalLanguageProcessor');
    this.services.set('naturalLanguage', naturalLanguageProcessor);

    // Enhanced Mention Handler
    const enhancedMentionHandler = require('./EnhancedMentionHandler');
    this.services.set('mentionHandler', enhancedMentionHandler);

    // Context Aware Response System
    const contextAwareResponseSystem = require('./ContextAwareResponseSystem');
    this.services.set('contextResponse', contextAwareResponseSystem);

    // Moderation Utils Service
    const moderationUtils = require('./ModerationUtilsService');
    this.services.set('moderationUtils', moderationUtils);

    // Batch Operation Service
    const batchOperationService = require('./BatchOperationService');
    this.services.set('batchOperations', batchOperationService);

    // Permission Safety Service
    const permissionSafetyService = require('./PermissionSafetyService');
    this.services.set('permissionSafety', permissionSafetyService);

    // Slash Command Integration Service
    const slashCommandIntegration = require('./SlashCommandIntegrationService');
    this.services.set('slashIntegration', slashCommandIntegration);

    logger.info('GUILD_AGENT_INIT', 'Core services initialized');
  }

  /**
   * Initialize message handlers
   * @param {Object} client - Discord client
   */
  async initializeMessageHandlers(client) {
    logger.info('GUILD_AGENT_INIT', 'Initializing message handlers...');

    // The message handler is already integrated in messageHandler.js
    // We just need to ensure the services are loaded
    logger.info('GUILD_AGENT_INIT', 'Message handlers initialized');
  }

  /**
   * Initialize slash command handlers
   */
  async initializeSlashCommandHandlers() {
    logger.info('GUILD_AGENT_INIT', 'Initializing slash command handlers...');

    // Slash command handlers are in the commands directory
    // They will be loaded by the command handler
    logger.info('GUILD_AGENT_INIT', 'Slash command handlers initialized');
  }

  /**
   * Initialize auto-moderation
   */
  async initializeAutoModeration() {
    logger.info('GUILD_AGENT_INIT', 'Initializing auto-moderation...');

    const autoModerationService = require('./AutoModerationService');
    this.services.set('autoModeration', autoModerationService);

    logger.info('GUILD_AGENT_INIT', 'Auto-moderation initialized');
  }

  /**
   * Initialize configuration management
   */
  async initializeConfigurationManagement() {
    logger.info('GUILD_AGENT_INIT', 'Initializing configuration management...');

    const configurationManagement = require('./ConfigurationManagementService');
    this.services.set('configuration', configurationManagement);

    // Start backup scheduler
    configurationManagement.startBackupScheduler();

    logger.info('GUILD_AGENT_INIT', 'Configuration management initialized');
  }

  /**
   * Start cleanup schedulers
   */
  startCleanupSchedulers() {
    logger.info('GUILD_AGENT_INIT', 'Starting cleanup schedulers...');

    // Cleanup every 5 minutes
    setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);

    logger.info('GUILD_AGENT_INIT', 'Cleanup schedulers started');
  }

  /**
   * Perform cleanup on all services
   */
  performCleanup() {
    try {
      // Cleanup Guild Agent Service
      const guildAgent = this.services.get('guildAgent');
      if (guildAgent && guildAgent.cleanup) {
        guildAgent.cleanup();
      }

      // Cleanup Batch Operation Service
      const batchOperations = this.services.get('batchOperations');
      if (batchOperations && batchOperations.cleanupOldOperations) {
        batchOperations.cleanupOldOperations();
      }

      // Cleanup Permission Safety Service
      const permissionSafety = this.services.get('permissionSafety');
      if (permissionSafety && permissionSafety.cleanupCache) {
        permissionSafety.cleanupCache();
      }

      // Cleanup Slash Command Integration Service
      const slashIntegration = this.services.get('slashIntegration');
      if (slashIntegration && slashIntegration.cleanup) {
        slashIntegration.cleanup();
      }

      // Cleanup Auto-Moderation Service
      const autoModeration = this.services.get('autoModeration');
      if (autoModeration && autoModeration.cleanup) {
        autoModeration.cleanup();
      }

      // Cleanup Configuration Management Service
      const configuration = this.services.get('configuration');
      if (configuration && configuration.cleanup) {
        configuration.cleanup();
      }

    } catch (error) {
      logger.error('GUILD_AGENT_INIT', 'Error during cleanup:', error);
    }
  }

  /**
   * Get service by name
   * @param {string} serviceName - Service name
   * @returns {Object} - Service instance
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get all services
   * @returns {Map} - All services
   */
  getAllServices() {
    return this.services;
  }

  /**
   * Get initialization status
   * @returns {boolean} - Initialization status
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getServiceStats() {
    const stats = {
      initialized: this.initialized,
      serviceCount: this.services.size,
      services: {}
    };

    for (const [name, service] of this.services.entries()) {
      stats.services[name] = {
        loaded: !!service,
        hasCleanup: typeof service.cleanup === 'function',
        hasStats: typeof service.getStats === 'function'
      };

      // Get specific stats if available
      if (service.getStats) {
        try {
          stats.services[name].stats = service.getStats();
        } catch (error) {
          stats.services[name].statsError = error.message;
        }
      }
    }

    return stats;
  }

  /**
   * Shutdown all services
   */
  async shutdown() {
    logger.info('GUILD_AGENT_INIT', 'Shutting down Guild Agent services...');

    // Perform final cleanup
    this.performCleanup();

    // Clear services
    this.services.clear();
    this.initialized = false;

    logger.info('GUILD_AGENT_INIT', 'Guild Agent services shutdown completed');
  }
}

module.exports = new GuildAgentInitializer();
