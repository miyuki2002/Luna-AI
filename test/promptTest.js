const prompts = require('../config/prompts.js');
const NeuralNetworks = require('../services/NeuralNetworks.js');

/**
 * Script kiểm tra đơn giản để minh họa cách sử dụng cấu hình prompt
 */
async function testPrompts() {
  console.log('=== KIỂM TRA CẤU HÌNH PROMPT LUNA AI ===');

  // Display the main system prompt
  console.log('\n== Main System Prompt ==');
  console.log(prompts.system.main);

  // Test prompt template substitution for search enhanced prompts
  console.log('\n== Search Enhanced Prompt Template ==');
  const originalPrompt = 'Tell me about Vietnamese food';
  const searchResults = [
    {
      title: 'Vietnamese Cuisine - An Overview',
      snippet: 'Vietnamese cuisine is known for its fresh ingredients, minimal use of oil, and reliance on herbs and vegetables.',
      url: 'https://example.com/vietnamese-cuisine'
    },
    {
      title: 'Popular Vietnamese Dishes',
      snippet: 'Pho, Banh Mi, and Bun Cha are among the most popular Vietnamese dishes worldwide.',
      url: 'https://example.com/vietnamese-dishes'
    }
  ];

  // Tạo văn bản kết quả tìm kiếm thủ công để minh họa
  let searchResultsText = '';
  searchResults.forEach((result, index) => {
    searchResultsText += `[Source ${index + 1}]: ${result.title}\n`;
    searchResultsText += `${result.snippet}\n`;
    searchResultsText += `URL: ${result.url}\n\n`;
  });

  // Test template replacement
  const enhancedPrompt = prompts.web.searchEnhancedPrompt
    .replace('${originalPromptText}', originalPrompt)
    .replace('${searchResultsText}', searchResultsText);

  console.log(enhancedPrompt);

  // Test memory context
  console.log('\n== Memory Context Template ==');
  const relevantMessages = [
    'User previously asked about Vietnamese culture',
    'You mentioned Hanoi as the capital of Vietnam'
  ];
  const memoryContext = prompts.memory.memoryContext
    .replace('${relevantMessagesText}', relevantMessages.join('. '));
  console.log(memoryContext);

  // Test coding prompt
  console.log('\n== Coding Prompt ==');
  const modelName = 'luna-v1-preview';
  const codingPrompt = prompts.system.coding.replace('${modelName}', modelName);
  console.log(codingPrompt);

  console.log('\n=== KIỂM TRA HOÀN THÀNH ===');
}

// Chạy kiểm tra
testPrompts().catch(console.error); 