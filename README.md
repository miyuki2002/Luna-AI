# Luna - Bot Trợ Lý AI Cho Discord

<div align="center">
  <img src="./assets/luna-avatar.png" alt="Ảnh Đại Diện Bot Luna" width="200" height="200" style="border-radius: 50%;">
  <br>
  <em>Người bạn đồng hành AI thân thiện của bạn</em>
</div>

## Tổng Quan

Luna là một bot Discord được hỗ trợ bởi API Grok của X.AI. Cô ấy có tính cách thân thiện, gần gũi và có thể hỗ trợ nhiều nhiệm vụ bao gồm trò chuyện, tạo mã nguồn và tạo hình ảnh.

> Sau khoản thời gian đắn đo suy nghĩ, tôi quyết định thay đổi API sang X.AI thay vì Anthropic AI (Claude) như trước. Nếu các bạn vẫn muốn dùng API của Anthropic thì thay  baseURL `https://api.x.ai/v1` sang `https://api.anthropic.com/v1`.

## Tính Năng

- 💬 **Trò Chuyện Tự Nhiên**: Chat với Luna một cách thân thiện và tự nhiên
- 🖼️ **Tạo Hình Ảnh**: Tạo hình ảnh bằng các lệnh đơn giản như "vẽ [mô tả]"
- 💻 **Hỗ Trợ Lập Trình**: Nhận trợ giúp cho các nhiệm vụ lập trình
- 🔄 **Lữu trữ**: Luna ghi nhớ ngữ cảnh cuộc trò chuyện để tương tác tự nhiên hơn
- ⚙️ **Quản Lý Máy Chủ**: Tự động triển khai lệnh khi tham gia máy chủ mới

## Cài Đặt

1. Clone repository này
2. Cài đặt dependencies với lệnh `npm install`
3. Tạo file `.env` với các biến sau:
   ```
   DISCORD_TOKEN=discord_bot_token_của_bạn
   CLIENT_ID=discord_client_id_của_bạn
   XAI_API_KEY=xai_api_key_của_bạn
   MONGODB_URI=chuỗi_kết_nối_mongodb_của_bạn
   ```
4. Chạy bot với lệnh `node index.js`

## Cách Sử Dụng

- Nhắc đến Luna (`@Luna`) trong bất kỳ kênh nào để bắt đầu trò chuyện
- Sử dụng lệnh `/` cho các chức năng cụ thể
- Gõ `reset conversation` hoặc `xóa lịch sử` để bắt đầu cuộc trò chuyện mới

## Các Lệnh

| Lệnh | Mô Tả |
|---------|-------------|
| `/help` | Hiển thị các lệnh có sẵn |
| `/ping` | Kiểm tra thời gian phản hồi của bot |
| `/about` | Thông tin về Luna |

## Đóng Góp

Chào đón mọi đóng góp, báo lỗi và yêu cầu tính năng mới!

## Giấy Phép

MIT
