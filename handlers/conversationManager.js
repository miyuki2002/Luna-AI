// Create a dedicated module for conversation management
const storageDB = require('../services/storagedb.js');

// Use closure to prevent access before initialization issues
const conversationManager = (() => {
  // Private conversationHistory variable
  const conversationHistory = [];
  
  return {
    /**
     * Loads conversation history from storage
     * @param {string} userId - User identifier
     * @param {string} systemPrompt - System prompt to use
     * @param {string} modelName - Name of the model being used
     * @returns {Promise<Array>} - Conversation history
     */
    async loadConversationHistory(userId, systemPrompt, modelName) {
      const history = await storageDB.getConversationHistory(userId, systemPrompt, modelName);
      
      // Clear and update the local cache
      conversationHistory.length = 0;
      history.forEach(msg => conversationHistory.push(msg));
      
      return [...conversationHistory];
    },
    
    /**
     * Adds a message to conversation history
     * @param {string} userId - User identifier
     * @param {string} role - Message role (user/assistant/system)
     * @param {string} content - Message content
     * @returns {Promise} - Result of database operation
     */
    addMessage(userId, role, content) {
      // Add to local cache
      conversationHistory.push({ role, content });
      
      // Add to database
      return storageDB.addMessageToConversation(userId, role, content);
    },
    
    /**
     * Gets the current conversation history
     * @returns {Array} - Copy of the conversation history
     */
    getHistory() {
      return [...conversationHistory];
    },
    
    /**
     * Clears the local conversation history
     */
    clearLocalHistory() {
      conversationHistory.length = 0;
    }
  };
})();

module.exports = conversationManager;
