  /**
   * Xử lý vi phạm
   * @param {Discord.Message} message - Tin nhắn vi phạm
   * @param {Object} results - Kết quả phân tích
   */
  async handleViolation(message, results) {
    try {
      // Lấy cài đặt giám sát cho guild
      const settings = this.monitorSettings.get(message.guild.id);
      if (!settings || !settings.enabled) return;
      
      // Xác định hành động cần thực hiện dựa trên quy tắc vi phạm
      let actionToTake = 'warn'; // Mặc định là cảnh báo
      
      // Tìm quy tắc vi phạm trong danh sách ruleActions
      if (settings.ruleActions && results.violatedRule) {
        // Nếu violatedRule là số thứ tự quy tắc
        if (!isNaN(results.violatedRule)) {
          const ruleIndex = parseInt(results.violatedRule) - 1;
          if (ruleIndex >= 0 && ruleIndex < settings.ruleActions.length) {
            actionToTake = settings.ruleActions[ruleIndex].action;
          }
        } else {
          // Tìm quy tắc dựa trên nội dung
          const matchingRule = settings.ruleActions.find(item => 
            item.rule.toLowerCase() === results.violatedRule.toLowerCase() ||
            results.violatedRule.toLowerCase().includes(item.rule.toLowerCase())
          );
          
          if (matchingRule) {
            actionToTake = matchingRule.action;
          }
        }
      }
      
      // Tạo embed thông báo vi phạm cho kênh log
      const violationEmbed = new EmbedBuilder()
        .setColor(
          results.severity === 'Cao' ? 0xFF0000 :
          results.severity === 'Trung bình' ? 0xFFA500 : 0xFFFF00
        )
        .setTitle(`🚨 Phát hiện vi phạm ${results.isFakeAccount ? '(Có dấu hiệu tài khoản giả mạo)' : ''}`)
        .setDescription(`Bot đã phát hiện một tin nhắn vi phạm quy tắc server.`)
        .addFields(
          { name: 'Người dùng', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
          { name: 'Kênh', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Thời gian', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Quy tắc vi phạm', value: results.violatedRule, inline: true },
          { name: 'Mức độ', value: results.severity, inline: true },
          { name: 'Hành động', value: actionToTake, inline: true },
          { name: 'Lý do', value: results.reason },
          { name: 'Nội dung tin nhắn', value: message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content }
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

      // Kiểm tra cài đặt kênh log từ cơ sở dữ liệu
      const db = mongoClient.getDb();
      const logSettings = await db.collection('mod_settings').findOne({
        guildId: message.guild.id
      });

      let logChannel = null;

      // Nếu có cài đặt kênh log và monitorLogs được bật
      if (logSettings && logSettings.logChannelId && logSettings.monitorLogs !== false) {
        try {
          logChannel = await message.guild.channels.fetch(logSettings.logChannelId);
        } catch (error) {
          console.error(`Không thể tìm thấy kênh log ${logSettings.logChannelId}:`, error);
        }
      }

      // Nếu không có kênh log được cài đặt, tìm kênh mặc định
      if (!logChannel) {
        logChannel = message.guild.channels.cache.find(
          channel => channel.name.includes('mod-logs') ||
                    channel.name.includes('mod-chat') ||
                    channel.name.includes('admin') ||
                    channel.name.includes('bot-logs')
        );
      }

      // Gửi thông báo đến kênh log
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [violationEmbed] });
      }

      // Tạo tin nhắn cảnh báo trực tiếp cho người vi phạm
      let warningMessage = `<@${message.author.id}> `;

      // Tạo nội dung cảnh báo dựa trên hành động và mức độ nghiêm trọng
      const actionEmoji = {
        'warn': '⚠️',
        'mute': '🔇',
        'kick': '👢',
        'ban': '🚫'
      };
      
      if (actionToTake === 'ban') {
        warningMessage += `${actionEmoji.ban} **CẢNH BÁO NGHIÊM TRỌNG**: ${results.reason}. `;
        warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
        warningMessage += `Hành vi này có thể dẫn đến việc bị ban khỏi server.`;
      } else if (actionToTake === 'kick') {
        warningMessage += `${actionEmoji.kick} **CẢNH BÁO NGHIÊM TRỌNG**: ${results.reason}. `;
        warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
        warningMessage += `Hành vi này có thể dẫn đến việc bị kick khỏi server.`;
      } else if (actionToTake === 'mute') {
        warningMessage += `${actionEmoji.mute} **CẢNH BÁO**: ${results.reason}. `;
        warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
        warningMessage += `Hành vi này có thể dẫn đến việc bị mute.`;
      } else {
        warningMessage += `${actionEmoji.warn} **CẢNH BÁO**: ${results.reason}. `;
        warningMessage += `Vi phạm quy tắc: ${results.violatedRule}. `;
        warningMessage += `Vui lòng tuân thủ quy tắc của server.`;
      }

      // Gửi cảnh báo trực tiếp vào kênh
      try {
        await message.channel.send(warningMessage);
      } catch (error) {
        console.error('Không thể gửi cảnh báo trực tiếp:', error);
      }

      // Thực hiện hành động tự động dựa trên actionToTake
      try {
        // Luôn xóa tin nhắn vi phạm nếu hành động là mute, kick hoặc ban
        if (actionToTake !== 'warn') {
          try {
            await message.delete();
            console.log(`Đã xóa tin nhắn vi phạm từ ${message.author.tag}`);
          } catch (error) {
            console.error('Không thể xóa tin nhắn:', error);
          }
        }
        
        // Thực hiện hành động tương ứng
        if (actionToTake === 'mute') {
          // Mute người dùng (timeout)
          const muteDuration = 10 * 60 * 1000; // 10 phút
          await message.member.timeout(muteDuration, `Vi phạm quy tắc: ${results.violatedRule}`);
          console.log(`Đã mute ${message.author.tag} trong 10 phút vì vi phạm quy tắc`);
        } else if (actionToTake === 'kick') {
          // Kick người dùng
          await message.member.kick(`Vi phạm quy tắc: ${results.violatedRule}`);
          console.log(`Đã kick ${message.author.tag} vì vi phạm quy tắc`);
        } else if (actionToTake === 'ban') {
          // Ban người dùng
          await message.member.ban({
            reason: `Vi phạm quy tắc: ${results.violatedRule}`,
            deleteMessageSeconds: 86400 // Xóa tin nhắn trong 24 giờ
          });
          console.log(`Đã ban ${message.author.tag} vì vi phạm quy tắc`);
        }
      } catch (error) {
        console.error(`Không thể thực hiện hành động ${actionToTake}:`, error);
        
        // Gửi thông báo lỗi đến kênh log
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send(`❌ Không thể thực hiện hành động ${actionToTake} đối với <@${message.author.id}>: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('Lỗi khi xử lý vi phạm:', error);
    }
  }
