const { EmbedBuilder } = require('discord.js');
const NeuralNetworks = require('../services/NeuralNetworks');

/**
 * Xử lý tin nhắn Discord đề cập đến bot
 */
async function handleMessage(message) {
  try {
    // Lấy nội dung mà không có phần đề cập
    const content = message.content
      .replace(/<@!?\d+>/g, '')
      .trim();

    // Nếu không có nội dung, không tiếp tục
    if (!content) {
      await message.reply('Tôi có thể giúp gì cho bạn hôm nay?');
      return;
    }

    // Kiểm tra cấu trúc lệnh trong nội dung
    if (content.startsWith('/image')) {
      await handleImageGeneration(message, content.replace('/image', '').trim());
      return;
    }

    // Tìm kiếm yêu cầu cụ thể về mã
    if (content.toLowerCase().includes('code') ||
      content.toLowerCase().includes('function') ||
      content.toLowerCase().includes('write a')) {
      await handleCodeRequest(message, content);
      return;
    }

    // Mặc định là phản hồi trò chuyện
    await handleChatRequest(message, content);
  } catch (error) {
    console.error('Lỗi khi xử lý tin nhắn:', error);
    await message.reply('Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn.');
  }
}

/**
 * Xử lý yêu cầu trò chuyện thông thường
 */
async function handleChatRequest(message, content) {

  // Hiển thị chỉ báo đang nhập
  await message.channel.sendTyping();

  try {
    const response = await NeuralNetworks.getCompletion(content);

    // Chia phản hồi nếu nó quá dài cho Discord
    if (response.length > 2000) {
      const chunks = splitMessageRespectWords(response, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  } catch (error) {
    console.error('Lỗi khi nhận phản hồi trò chuyện:', error);

    // Thông báo chi tiết hơn về lỗi
    if (error.code === 'EPROTO' || error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      await message.reply('Xin lỗi, tôi đang gặp vấn đề kết nối với dịch vụ AI. Vui lòng thử lại sau hoặc liên hệ quản trị viên để được hỗ trợ.');
    } else {
      await message.reply('Xin lỗi, tôi gặp khó khăn khi tạo phản hồi. Vui lòng thử lại sau.');
    }
  }
}

/**
 * Xử lý yêu cầu tạo hình ảnh
 */
async function handleImageGeneration(message, prompt) {
  if (!prompt) {
    await message.reply('Vui lòng cung cấp mô tả cho hình ảnh bạn muốn tôi tạo.');
    return;
  }

  await message.channel.sendTyping();

  try {
    // Lấy URL hình ảnh từ generateImage của NeuralNetworks
    const imageUrl = await NeuralNetworks.generateImage(prompt);

    // Nếu nhận được thông báo lỗi thay vì URL, trả về thông báo đó
    if (imageUrl.startsWith('Xin lỗi')) {
      await message.reply(imageUrl);
      return;
    }

    // Tạo embed và gửi trả lời
    const embed = new EmbedBuilder()
      .setTitle('Hình Ảnh Được Tạo')
      .setDescription(`Mô tả: ${prompt}`)
      .setImage(imageUrl)
      .setColor('#0099ff')
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Lỗi khi tạo hình ảnh:', error);
    await message.reply('Xin lỗi, tôi gặp khó khăn khi tạo hình ảnh đó.');
  }
}

/**
 * Xử lý yêu cầu về mã
 */
async function handleCodeRequest(message, prompt) {
  await message.channel.sendTyping();

  try {
    const codeResponse = await NeuralNetworks.getCodeCompletion(prompt);

    // Trích xuất khối mã hoặc định dạng dưới dạng mã
    let formattedResponse = codeResponse;

    // Nếu phản hồi không chứa khối mã, bọc nó trong một khối
    if (!formattedResponse.includes('```')) {
      formattedResponse = formatCodeResponse(formattedResponse);
    }

    // Chia phản hồi nếu nó quá dài cho Discord
    if (formattedResponse.length > 2000) {
      const chunks = splitMessage(formattedResponse, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(formattedResponse);
    }
  } catch (error) {
    console.error('Lỗi khi nhận mã:', error);
    await message.reply('Xin lỗi, tôi gặp khó khăn khi tạo mã đó.');
  }
}

/**
 * Định dạng phản hồi dưới dạng khối mã nếu nó chưa được định dạng
 */
function formatCodeResponse(text) {
  // Cố gắng phát hiện ngôn ngữ hoặc mặc định là javascript
  let language = 'javascript';

  // Các mẫu ngôn ngữ phổ biến
  const langPatterns = {
    python: /import\s+[\w.]+|def\s+\w+\s*\(|print\s*\(/i,
    javascript: /const|let|var|function|=>|\bif\s*\(|console\.log/i,
    java: /public\s+class|void\s+main|System\.out|import\s+java/i,
    html: /<html|<div|<body|<head|<!DOCTYPE/i,
    css: /body\s*{|margin:|padding:|color:|@media/i,
    php: /<\?php|\$\w+\s*=/i
  };

  // Phát hiện ngôn ngữ
  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text)) {
      language = lang;
      break;
    }
  }

  return `\`\`\`${language}\n${text}\n\`\`\``;
}

/**
 * Chia tin nhắn thành các phần nhỏ hơn
 */
function splitMessage(text, maxLength = 2000) {
  const chunks = [];

  // Xử lý đặc biệt cho khối mã
  if (text.includes('```')) {
    // Chia theo khối mã và kết hợp lại để tránh làm gián đoạn chúng
    const parts = text.split(/(```(?:\w+)?\n[\s\S]*?```)/g);

    let currentChunk = '';

    for (const part of parts) {
      if (currentChunk.length + part.length > maxLength) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  } else {
    // Chia đơn giản cho tin nhắn không phải mã
    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.substring(i, i + maxLength));
    }
  }

  return chunks;
}

/**
 * Chia tin nhắn thành các phần nhỏ hơn, tôn trọng ranh giới từ
 * để không cắt từ giữa chừng
 */
function splitMessageRespectWords(text, maxLength = 2000) {
  const chunks = [];

  // Xử lý đặc biệt cho khối mã
  if (text.includes('```')) {
    // Chia theo khối mã và kết hợp lại để tránh làm gián đoạn chúng
    const parts = text.split(/(```(?:\w+)?\n[\s\S]*?```)/g);

    let currentChunk = '';

    for (const part of parts) {
      if (currentChunk.length + part.length > maxLength) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  } else {
    // Chia thông minh theo ranh giới từ cho tin nhắn không phải mã
    let startPos = 0;
    
    while (startPos < text.length) {
      // Nếu đoạn còn lại ngắn hơn maxLength, lấy hết
      if (startPos + maxLength >= text.length) {
        chunks.push(text.substring(startPos));
        break;
      }
      
      // Tìm vị trí khoảng trắng gần nhất gần maxLength
      let endPos = startPos + maxLength;
      while (endPos > startPos && text[endPos] !== ' ' && text[endPos] !== '\n') {
        endPos--;
      }
      
      // Nếu không tìm thấy khoảng trắng, buộc phải cắt ở maxLength
      if (endPos === startPos) {
        endPos = startPos + maxLength;
      } else {
        // Nếu tìm thấy khoảng trắng, lấy hết khoảng trắng đó
        endPos++;
      }
      
      chunks.push(text.substring(startPos, endPos));
      startPos = endPos;
    }
  }

  return chunks;
}

module.exports = { handleMessage };
