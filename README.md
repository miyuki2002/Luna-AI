# Bot AI Luna cho Discord (X.AI)

Bot Discord sử dụng X.AI (Grok) API thông qua Anthropic SDK để cung cấp trò chuyện AI, tạo hình ảnh và phản hồi mã. Bot này tự xưng là "Luna".

## Tính năng

- Phản hồi trò chuyện AI với X.AI (đề cập đến bot với câu hỏi của bạn)
- Tạo hình ảnh với X.AI (đề cập đến bot với `/image [mô tả]`)
- Tạo mã với X.AI (đề cập đến bot với các truy vấn liên quan đến lập trình)

## Thiết lập

1. Clone repository này
2. Cài đặt:
   ```
   npm install
   ```
3. Tạo tệp `.env` với khóa API X.AI của bạn:
   ```
   DISCORD_TOKEN=token_discord_bot_của_bạn
   XAI_API_KEY=khóa_api_xai_của_bạn
   ```
4. Khởi động bot:
   ```
   npm start
   ```

## Cách sử dụng

- **Trò chuyện thông thường**: `@mentionbot` Thời tiết hôm nay thế nào?
- **Tạo hình ảnh**: `@mentionbot` /image hoàng hôn đẹp trên núi
- **Nhận trợ giúp về mã**: `@mentionbot` Viết một hàm đảo ngược chuỗi trong JavaScript

## Yêu cầu

- Node.js 16.x trở lên
- Discord.js v14
- Quyền truy cập API X.AI
