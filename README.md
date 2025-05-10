# Luna - Bot Trợ Lý AI Cho Discord

<div align="center">
  <img src="./assets/luna-avatar.png" alt="Ảnh Đại Diện Bot Luna" width="200" height="200" style="border-radius: 50%;">
  <br>
  <em>Người bạn đồng hành AI thân thiện của bạn</em>
</div>

## Tổng Quan

Luna là một bot Discord được hỗ trợ bởi API Anthropic/xAI. Cô ấy có tính cách thân thiện, gần gũi và có thể hỗ trợ nhiều nhiệm vụ bao gồm trò chuyện, tạo mã nguồn và tạo hình ảnh. Bot tích hợp hệ thống cấp độ và thành tựu để tạo động lực tương tác với người dùng.

## Tính Năng

- 💬 **Trò Chuyện Tự Nhiên**: Chat với Luna một cách thân thiện và tự nhiên.
- 🖼️ **Tạo Hình Ảnh**: Tạo hình ảnh bằng các lệnh đơn giản như "vẽ, tạo hình [mô tả]".
- 💻 **Hỗ Trợ Lập Trình**: Nhận trợ giúp cho các nhiệm vụ lập trình.
- 🔄 **Lưu trữ**: Luna ghi nhớ ngữ cảnh cuộc trò chuyện để tương tác tự nhiên hơn.
- ⚙️ **Quản Lý Máy Chủ**: Tự động triển khai lệnh khi tham gia máy chủ mới.
- ⭐ **Hệ Thống Cấp Độ**: Tăng cấp và nhận thành tựu khi tương tác.
- 🎨 **Profile Card**: Thẻ thông tin người dùng với thiết kế hiện đại.
- 💾 **Đồng Bộ Dữ Liệu**: Lưu trữ thông tin người dùng và máy chủ với MongoDB.

## Cài Đặt

1. Clone repository này
2. Cài đặt dependencies với lệnh `npm install`
3. Tạo file `.env` với các biến sau:
    ```
    DISCORD_TOKEN=discord_bot_token_here
    CLIENT_ID=discord_client_id_here
    XAI_API_KEY=xai_api_key_here
    MONGODB_URI=chuỗi_kết_nối_mongodb_here
    GOOGLE_API_KEY=google_api_key_here
    GOOGLE_CSE_ID=google_cse_id_here
    HF_TOKEN=huggingface_token_here  
    GRADIO_IMAGE_SPACE=space_id_here # Mặc định: s4ory/luna 
    ```
4. Chạy bot với lệnh `npm run start` hoặc `npm run dev`

## Cấu Trúc Thư Mục

```
Luna/
├── assets/         # Tài nguyên (hình ảnh, font)
├── commands/       # Các lệnh slash
├── events/         # Event handlers
├── handlers/       # Logic xử lý
├── services/       # Các dịch vụ (DB, AI, Canvas)
└── utils/          # Tiện ích
```

## Cách Sử Dụng

- Nhắc đến Luna (`@Luna`) trong bất kỳ kênh nào để bắt đầu trò chuyện.
- Sử dụng lệnh `/` cho các chức năng cụ thể.
- Gõ `reset conversation` hoặc `xóa lịch sử` để bắt đầu cuộc trò chuyện mới.
- Tương tác với bot thường xuyên để tăng cấp độ và nhận thành tựu.
- Sử dụng `/profile` để xem thẻ thông tin của bạn.

## Các Lệnh

| Lệnh | Mô Tả |
|---------|-------------|
| `/help` | Hiển thị các lệnh có sẵn |
| `/ping` | Kiểm tra thời gian phản hồi của bot |
| `/about` | Thông tin về Luna |
| `/image` | Tạo hình ảnh bằng các lệnh đơn giản |
| `/reset` | Đặt lại cuộc trò chuyện với bot |
| `/profile` | Xem thẻ thông tin người dùng |

## Đóng Góp

Chào đón mọi đóng góp, báo lỗi và yêu cầu tính năng mới! Bot được thiết kế với kiến trúc module hóa, dễ dàng mở rộng và tùy chỉnh.

## Giấy Phép

[MIT](LICENSE) [Terms of service](./docs/legal/terms-of-service.md) [Privacy](./docs/legal/privacy-policy.md)
