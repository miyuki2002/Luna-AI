const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const NeuralNetworks = require('../services/NeuralNetworks');
const experience = require('../utils/xp');
const logger = require('../utils/logger.js');

/**
 * Xử lý tin nhắn Discord đề cập đến bot
 * @param {Object} message - Đối tượng tin nhắn Discord
 */
async function handleMessage(message) {
  try {
    // Biến để kiểm tra xem lệnh có được thực thi hay không
    let commandExecuted = false;

    const content = message.content
      .replace(/<@!?\d+>/g, '')
      .trim();

    if (!content) {
      await message.reply('Tôi có thể giúp gì cho bạn hôm nay?');
      return;
    }

    // Kiểm tra cấu trúc lệnh trong nội dung
    if (content.startsWith('/image')) {
      await handleImageGeneration(message, content.replace('/image', '').trim());
      commandExecuted = true;
      return;
    }

    if (content.toLowerCase().includes('code') ||
      content.toLowerCase().includes('function') ||
      content.toLowerCase().includes('write a')) {
      await handleCodeRequest(message, content);
      commandExecuted = true;
      return;
    }

    await handleChatRequest(message, content);

    processXp(message, commandExecuted, true);
  } catch (error) {
    logger.error('MESSAGE', `Lỗi khi xử lý tin nhắn từ ${message.author.tag}:`, error);
    await message.reply('Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn.');

    processXp(message, false, false);
  }
}

/**
 * Xử lý hệ thống XP cho người dùng
 * @param {Object} message - Đối tượng tin nhắn từ Discord.js
 * @param {Boolean} commandExecuted - Có lệnh nào được thực thi không
 * @param {Boolean} execute - Có nên tiếp tục thực thi không
 */
async function processXp(message, commandExecuted, execute) {
  try {
    const response = await experience(message, commandExecuted, execute);

    // Ghi log lỗi không gây ra bởi lý do đã biết
    if (!response.xpAdded && ![
      'DISABLED',             // XP bị tắt, cần EXPERIENCE_POINTS trong client#features
      'COMMAND_EXECUTED',     // Lệnh đã được thực thi thành công
      'COMMAND_TERMINATED',   // Lệnh đã được tìm nhưng đã bị chấm dứt
      'DM_CHANNEL',           // Tin nhắn được gửi trong DM
      'GUILD_SETTINGS_NOT_FOUND', // Không tìm thấy cài đặt của guild
      'DISABLED_ON_GUILD',    // XP bị tắt trên server này
      'DISABLED_ON_CHANNEL',  // Tin nhắn được gửi trong kênh bị chặn XP
      'RECENTLY_TALKED'       // Người gửi vừa nói gần đây
    ].includes(response.reason)) {
      // Ghi log lỗi nếu có
      if (message.client.logs) {
        message.client.logs.push(`Lỗi XP: ${response.reason} tại ${message.guild.id}<${message.guild.name}> bởi ${message.author.tag}<${message.author.id}> lúc ${new Date()}`);
      } else {
        logger.error('XP', `Lỗi XP: ${response.reason} tại ${message.guild.id}<${message.guild.name}> bởi ${message.author.tag}<${message.author.id}> lúc ${new Date()}`);
      }
    }

    // Nếu người dùng lên cấp, có thể hiển thị thông báo
    if (response.xpAdded && response.level && response.previousLevel && response.level > response.previousLevel) {
      // Tùy chọn: Thông báo người dùng đã lên cấp
      logger.info('XP', `${message.author.tag} đã lên cấp ${response.level} trong server ${message.guild.name}`);

      // Tùy chọn: Gửi thông báo lên cấp trong kênh
      // await message.channel.send(`🎉 Chúc mừng ${message.author}! Bạn đã đạt cấp độ ${response.level}!`);
    }
  } catch (error) {
    logger.error('XP', 'Lỗi khi xử lý XP:', error);
  }
}

/**
 * Xử lý yêu cầu trò chuyện thông thường
 * @param {Object} message - Đối tượng tin nhắn Discord
 * @param {string} content - Nội dung tin nhắn đã xử lý
 */
async function handleChatRequest(message, content) {
  await message.channel.sendTyping();

  try {
    const response = await NeuralNetworks.getCompletion(content, message);

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
    logger.error('MESSAGE', `Lỗi khi nhận phản hồi trò chuyện cho ${message.author.tag}:`, error);

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
    const imageResult = await NeuralNetworks.generateImage(prompt);

    if (typeof imageResult === 'string') {
      await message.reply(imageResult);
      return;
    }

    const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'generated-image.png' });

    const embed = new EmbedBuilder()
      .setTitle('Hình Ảnh Được Tạo')
      .setDescription(`Mô tả: ${prompt}`)
      .setColor('#0099ff')
      .setTimestamp();

    await message.reply({ 
      embeds: [embed],
      files: [attachment]
    });
  } catch (error) {
    logger.error('IMAGE', 'Lỗi khi tạo hình ảnh:', error);
    await message.reply('Xin lỗi, tôi gặp khó khăn khi tạo hình ảnh đó.');
  }
}

/**
 * Xử lý yêu cầu về mã
 * @param {Object} message - Đối tượng tin nhắn Discord
 * @param {string} prompt - Nội dung tin nhắn đã xử lý
 */
async function handleCodeRequest(message, prompt) {
  await message.channel.sendTyping();

  try {
    const codeResponse = await NeuralNetworks.getCodeCompletion(prompt, message);

    let formattedResponse = codeResponse;

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
    logger.error('CODE', `Lỗi khi nhận mã cho ${message.author.tag}:`, error);
    await message.reply('Xin lỗi, tôi gặp khó khăn khi tạo mã đó.');
  }
}

/**
 * Định dạng phản hồi dưới dạng khối mã nếu nó chưa được định dạng
 */
function formatCodeResponse(text) {
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

  if (text.includes('```')) {
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

  if (text.includes('```')) {
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
    let startPos = 0;

    while (startPos < text.length) {
      if (startPos + maxLength >= text.length) {
        chunks.push(text.substring(startPos));
        break;
      }

      let endPos = startPos + maxLength;
      while (endPos > startPos && text[endPos] !== ' ' && text[endPos] !== '\n') {
        endPos--;
      }

      if (endPos === startPos) {
        endPos = startPos + maxLength;
      } else {
        endPos++;
      }

      chunks.push(text.substring(startPos, endPos));
      startPos = endPos;
    }
  }

  return chunks;
}

/**
 * Hàm chính xử lý sự kiện MessageCreate khi bot được đề cập
 * @param {import('discord.js').Message} message - Đối tượng tin nhắn Discord
 * @param {import('discord.js').Client} client - Client Discord.js
 */
async function handleMentionMessage(message, client) {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    const hasEveryoneOrRoleMention = message.mentions.everyone || message.mentions.roles.size > 0;

    const isMonitorWarning = message.content.includes('**CẢNH BÁO') ||
                            message.content.includes('**Lưu ý') ||
                            message.content.includes('**CẢNH BÁO NGHÊM TRỌNG');

    if (!isMonitorWarning && !hasEveryoneOrRoleMention) {
      logger.info('CHAT', `Xử lý tin nhắn trò chuyện từ ${message.author.tag} (ID: ${message.author.id})`);
      logger.info('CHAT', `Kênh: ${message.channel.type === 'DM' ? 'DM' : message.channel.name} trong ${message.guild ? message.guild.name : 'DM'}`);
      logger.info('CHAT', `Nội dung: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
      
      try {
        await handleMessage(message); 
        logger.info('CHAT', `Đã xử lý tin nhắn trò chuyện thành công cho ${message.author.tag}`);
      } catch (error) {
        logger.error('CHAT', `Lỗi khi xử lý tin nhắn trò chuyện từ ${message.author.tag}:`, error);
        await message.reply('Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.');
      }
    } else if (hasEveryoneOrRoleMention) {
      logger.debug('CHAT', `Bỏ qua tin nhắn có mention @everyone hoặc @role từ ${message.author.tag}`);
    } else if (isMonitorWarning) {
      logger.debug('CHAT', `Bỏ qua tin nhắn cảnh báo từ monitor từ ${message.author.tag}`);
    }
  }
}

module.exports = {
  handleMessage,
  handleMentionMessage,
  processXp,
  splitMessage,
  splitMessageRespectWords
};
