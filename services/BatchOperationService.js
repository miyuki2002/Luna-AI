const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger.js');

class BatchOperationService {
  constructor() {
    this.maxBatchSize = 10;
    this.operationQueue = new Map();
    this.activeOperations = new Map();
    this.operationHistory = new Map();
  }

  /**
   * Queue batch operation
   * @param {string} operationId - Unique operation ID
   * @param {Object} operation - Operation data
   * @returns {Promise<Object>} - Queue result
   */
  async queueOperation(operationId, operation) {
    try {
      const queueData = {
        id: operationId,
        operation: operation,
        status: 'queued',
        createdAt: Date.now(),
        progress: 0,
        total: operation.targets.length,
        results: [],
        errors: []
      };

      this.operationQueue.set(operationId, queueData);
      
      logger.info('BATCH_OPERATION', `Queued operation ${operationId} with ${operation.targets.length} targets`);
      
      return {
        success: true,
        operationId: operationId,
        status: 'queued',
        estimatedTime: this.estimateOperationTime(operation.targets.length)
      };

    } catch (error) {
      logger.error('BATCH_OPERATION', 'Error queuing operation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute batch operation
   * @param {string} operationId - Operation ID
   * @param {Object} guildAgentService - Guild agent service instance
   * @returns {Promise<Object>} - Execution result
   */
  async executeOperation(operationId, guildAgentService) {
    const queueData = this.operationQueue.get(operationId);
    if (!queueData) {
      throw new Error(`Operation ${operationId} not found in queue`);
    }

    // Move to active operations
    queueData.status = 'executing';
    this.activeOperations.set(operationId, queueData);
    this.operationQueue.delete(operationId);

    try {
      const { operation } = queueData;
      const results = [];
      const errors = [];

      // Process each target
      for (let i = 0; i < operation.targets.length; i++) {
        const target = operation.targets[i];
        
        try {
          // Execute action for this target
          const result = await guildAgentService.executeAction(
            operation.action,
            [target],
            operation.params,
            operation.message
          );

          results.push({
            target: target,
            success: result.success,
            result: result.results[0] || null,
            timestamp: Date.now()
          });

          // Update progress
          queueData.progress = i + 1;
          queueData.results = results;

          // Send progress update
          await this.sendProgressUpdate(operationId, queueData);

        } catch (error) {
          errors.push({
            target: target,
            error: error.message,
            timestamp: Date.now()
          });

          queueData.errors = errors;
          logger.error('BATCH_OPERATION', `Error processing target ${target.displayName}:`, error);
        }

        // Small delay to prevent rate limiting
        await this.delay(100);
      }

      // Mark as completed
      queueData.status = 'completed';
      queueData.completedAt = Date.now();
      
      // Move to history
      this.operationHistory.set(operationId, queueData);
      this.activeOperations.delete(operationId);

      // Send completion notification
      await this.sendCompletionNotification(operationId, queueData);

      return {
        success: true,
        operationId: operationId,
        status: 'completed',
        results: results,
        errors: errors,
        duration: Date.now() - queueData.createdAt
      };

    } catch (error) {
      // Mark as failed
      queueData.status = 'failed';
      queueData.failedAt = Date.now();
      queueData.error = error.message;
      
      this.operationHistory.set(operationId, queueData);
      this.activeOperations.delete(operationId);

      logger.error('BATCH_OPERATION', `Operation ${operationId} failed:`, error);
      
      return {
        success: false,
        operationId: operationId,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Send progress update
   * @param {string} operationId - Operation ID
   * @param {Object} queueData - Queue data
   */
  async sendProgressUpdate(operationId, queueData) {
    try {
      const { operation } = queueData;
      const progress = Math.round((queueData.progress / queueData.total) * 100);
      
      const embed = new EmbedBuilder()
        .setTitle(`🔄 Đang xử lý... (${queueData.progress}/${queueData.total})`)
        .setDescription(`**Hành động:** ${operation.action}\n**Tiến độ:** ${progress}%`)
        .addFields(
          { name: 'Thành công', value: queueData.results.filter(r => r.success).length.toString(), inline: true },
          { name: 'Lỗi', value: queueData.errors.length.toString(), inline: true },
          { name: 'Còn lại', value: (queueData.total - queueData.progress).toString(), inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp();

      // Send to original channel
      await operation.message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('BATCH_OPERATION', 'Error sending progress update:', error);
    }
  }

  /**
   * Send completion notification
   * @param {string} operationId - Operation ID
   * @param {Object} queueData - Queue data
   */
  async sendCompletionNotification(operationId, queueData) {
    try {
      const { operation } = queueData;
      const successCount = queueData.results.filter(r => r.success).length;
      const errorCount = queueData.errors.length;
      const duration = Math.round((queueData.completedAt - queueData.createdAt) / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Hoàn thành batch operation`)
        .setDescription(`**Hành động:** ${operation.action}\n**Thời gian:** ${duration}s`)
        .addFields(
          { name: 'Tổng số', value: queueData.total.toString(), inline: true },
          { name: 'Thành công', value: successCount.toString(), inline: true },
          { name: 'Lỗi', value: errorCount.toString(), inline: true }
        )
        .setColor(successCount === queueData.total ? 0x00FF00 : 0xFFA500)
        .setTimestamp();

      // Add detailed results if there are errors
      if (errorCount > 0) {
        const errorDetails = queueData.errors.map(e => 
          `❌ ${e.target.displayName}: ${e.error}`
        ).join('\n');
        
        embed.addFields({ 
          name: 'Chi tiết lỗi', 
          value: errorDetails.length > 1000 ? 
            errorDetails.substring(0, 1000) + '...' : 
            errorDetails, 
          inline: false 
        });
      }

      await operation.message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('BATCH_OPERATION', 'Error sending completion notification:', error);
    }
  }

  /**
   * Estimate operation time
   * @param {number} targetCount - Number of targets
   * @returns {number} - Estimated time in seconds
   */
  estimateOperationTime(targetCount) {
    // Base time + 0.5 seconds per target
    return Math.max(5, Math.round(targetCount * 0.5 + 2));
  }

  /**
   * Get operation status
   * @param {string} operationId - Operation ID
   * @returns {Object} - Operation status
   */
  getOperationStatus(operationId) {
    // Check active operations
    if (this.activeOperations.has(operationId)) {
      const operation = this.activeOperations.get(operationId);
      return {
        status: operation.status,
        progress: operation.progress,
        total: operation.total,
        results: operation.results,
        errors: operation.errors
      };
    }

    // Check history
    if (this.operationHistory.has(operationId)) {
      const operation = this.operationHistory.get(operationId);
      return {
        status: operation.status,
        progress: operation.progress,
        total: operation.total,
        results: operation.results,
        errors: operation.errors,
        completedAt: operation.completedAt,
        failedAt: operation.failedAt
      };
    }

    return null;
  }

  /**
   * Cancel operation
   * @param {string} operationId - Operation ID
   * @returns {boolean} - Success status
   */
  cancelOperation(operationId) {
    if (this.operationQueue.has(operationId)) {
      this.operationQueue.delete(operationId);
      return true;
    }

    if (this.activeOperations.has(operationId)) {
      const operation = this.activeOperations.get(operationId);
      operation.status = 'cancelled';
      operation.cancelledAt = Date.now();
      
      this.operationHistory.set(operationId, operation);
      this.activeOperations.delete(operationId);
      return true;
    }

    return false;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getQueueStats() {
    return {
      queued: this.operationQueue.size,
      active: this.activeOperations.size,
      completed: this.operationHistory.size,
      totalProcessed: Array.from(this.operationHistory.values())
        .filter(op => op.status === 'completed').length,
      totalFailed: Array.from(this.operationHistory.values())
        .filter(op => op.status === 'failed').length
    };
  }

  /**
   * Clean up old operations
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupOldOperations(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old history
    for (const [operationId, operation] of this.operationHistory.entries()) {
      const operationAge = now - (operation.completedAt || operation.failedAt || operation.createdAt);
      if (operationAge > maxAge) {
        this.operationHistory.delete(operationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('BATCH_OPERATION', `Cleaned up ${cleanedCount} old operations`);
    }
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process all queued operations
   * @param {Object} guildAgentService - Guild agent service instance
   */
  async processQueue(guildAgentService) {
    const queuedOperations = Array.from(this.operationQueue.entries());
    
    for (const [operationId, operation] of queuedOperations) {
      try {
        await this.executeOperation(operationId, guildAgentService);
      } catch (error) {
        logger.error('BATCH_OPERATION', `Error processing operation ${operationId}:`, error);
      }
    }
  }

  /**
   * Start queue processor
   * @param {Object} guildAgentService - Guild agent service instance
   */
  startQueueProcessor(guildAgentService) {
    // Process queue every 5 seconds
    setInterval(async () => {
      try {
        await this.processQueue(guildAgentService);
        await this.cleanupOldOperations();
      } catch (error) {
        logger.error('BATCH_OPERATION', 'Error in queue processor:', error);
      }
    }, 5000);

    logger.info('BATCH_OPERATION', 'Queue processor started');
  }
}

module.exports = new BatchOperationService();
