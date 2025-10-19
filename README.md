# Luna - Bot Trợ Lý AI Cho Discord

<div align="center">
  <img src="./assets/luna-avatar.png" alt="Ảnh Đại Diện Bot Luna" width="200" height="200" style="border-radius: 50%;">
  <br>
  <em>Người bạn đồng hành AI thân thiện của bạn</em>
</div>

## Tổng Quan

Luna là một bot Discord được hỗ trợ bởi API Anthropic/xAI. Cô ấy có tính cách thân thiện, gần gũi và có thể hỗ trợ nhiều nhiệm vụ bao gồm trò chuyện, tạo mã nguồn và tạo hình ảnh. Bot tích hợp hệ thống cấp độ và thành tựu để tạo động lực tương tác với người dùng.

**🚀 Phiên bản 1.1.0**: Hệ thống quản lý token và vai trò người dùng với giới hạn theo cấp bậc.

## Tính Năng

- 💬 **Trò Chuyện Tự Nhiên**: Chat với Luna một cách thân thiện và tự nhiên.
- 🖼️ **Tạo Hình Ảnh**: Tạo hình ảnh bằng các lệnh đơn giản như "vẽ, tạo hình [mô tả]".
- 💻 **Hỗ Trợ Lập Trình**: Nhận trợ giúp cho các nhiệm vụ lập trình.
- 🔄 **Lưu trữ**: Luna ghi nhớ ngữ cảnh cuộc trò chuyện để tương tác tự nhiên hơn.
- ⚙️ **Quản Lý Máy Chủ**: Tự động triển khai lệnh khi tham gia máy chủ mới.
- ⭐ **Hệ Thống Cấp Độ**: Tăng cấp và nhận thành tựu khi tương tác.
- 🎨 **Profile Card**: Thẻ thông tin người dùng với thiết kế hiện đại.
- 💾 **Đồng Bộ Dữ Liệu**: Lưu trữ thông tin người dùng và máy chủ với MongoDB.
- 🔧 **Kiến Trúc Module**: Dễ dàng bảo trì, nâng cấp và thay đổi nhà cung cấp AI.
- 🎯 **Quản Lý Token**: Hệ thống giới hạn token theo vai trò người dùng.
- 👥 **Hệ Thống Vai Trò**: Phân quyền 4 cấp (Owner, Admin, Helper, User).

## Kiến Trúc Mới (v1.0.4)

Luna đã được tái cấu trúc hoàn toàn với kiến trúc module hóa:

### 🧠 **AICore.js** - Trung tâm AI
- Xử lý tất cả API calls và logic AI
- Dễ dàng chuyển đổi nhà cung cấp AI (X.AI, Anthropic, OpenAI, v.v.)
- Cấu hình API client bảo mật

### 🖼️ **ImageService.js** - Dịch vụ hình ảnh
- Tích hợp Gradio và xử lý hình ảnh
- Theo dõi tiến trình tạo hình ảnh
- Chức năng hình ảnh độc lập

### 💬 **ConversationService.js** - Quản lý hội thoại
- Quản lý memory và context
- Xử lý tương tác người dùng
- Làm giàu hội thoại với memories liên quan

### ⚙️ **SystemService.js** - Tiện ích hệ thống
- Kiểm tra môi trường và hệ thống
- Khởi tạo logging và quản lý
- Tắt máy graceful và bảo trì định kỳ

### 🎯 **NeuralNetworks.js** - Orchestrator
- Điều phối lightweight giữa các service
- Duy trì backward compatibility hoàn toàn
- Wrapper methods cho existing code

### 🔐 **TokenService.js** - Quản lý Token
- Theo dõi và giới hạn token theo vai trò
- Quản lý vai trò người dùng (Owner, Admin, Helper, User)
- Tự động reset giới hạn hàng ngày
- Thống kê chi tiết theo ngày/tuần/tháng

## Cài Đặt

1. Clone repository này
2. Cài đặt dependencies với lệnh `npm install`
3. Tạo file `.env` từ `example.env`
4. Chạy bot với lệnh `npm run start` hoặc `npm run dev`

## Cấu Trúc Thư Mục

```
Luna/
├── assets/         # Tài nguyên (hình ảnh, font)
├── commands/       # Các lệnh slash
│   ├── admin/      # Lệnh quản trị
│   │   ├── setrole.js      # Đặt vai trò người dùng
│   │   ├── tokenstats.js   # Thống kê token
│   │   └── resettoken.js   # Reset token
│   ├── AI/         # Lệnh AI
│   ├── info/       # Lệnh thông tin
│   └── social/     # Lệnh xã hội
├── events/         # Event handlers
├── handlers/       # Logic xử lý
├── services/       # Các dịch vụ (DB, AI, Canvas)
│   ├── AICore.js               # Trung tâm AI và API
│   ├── ImageService.js         # Dịch vụ tạo hình ảnh
│   ├── ConversationService.js  # Quản lý hội thoại
│   ├── SystemService.js        # Tiện ích hệ thống
│   ├── TokenService.js         # Quản lý token và vai trò
│   └── NeuralNetworks.js       # Orchestrator chính
└── utils/          # Tiện ích
```

## Cách Sử Dụng

- Nhắc đến Luna (`@Luna`) trong bất kỳ kênh nào để bắt đầu trò chuyện.
- Sử dụng lệnh `/` cho các chức năng cụ thể.
- Gõ `/help` để xem các chức năng của bot.
- Tương tác với bot thường xuyên để tăng cấp độ và nhận thành tựu.
- Sử dụng `/profile` để xem thẻ thông tin của bạn.
- Sử dụng `/tokenstats user` để xem mức sử dụng token của bạn.

## Hệ Thống Token và Vai Trò

Luna sử dụng hệ thống token để quản lý việc sử dụng API, với giới hạn theo vai trò:

### Vai Trò
- **Owner**: Không giới hạn token, toàn quyền quản lý
- **Admin**: 100,000 tokens/ngày, quản lý người dùng
- **Helper**: 50,000 tokens/ngày, hỗ trợ nâng cao
- **User**: 10,000 tokens/ngày (mặc định)

### Tính Năng
- Tự động reset giới hạn mỗi 24 giờ
- Theo dõi sử dụng theo ngày, tuần, tháng
- Lịch sử 100 giao dịch gần nhất
- Thông báo khi đạt giới hạn
- Thống kê chi tiết cho admin

### Cấu Hình Owner
Thêm Discord User ID của bạn vào file `.env`:
```env
OWNER_ID=your_discord_user_id
```

## Các Lệnh

### Lệnh Cơ Bản
| Lệnh | Mô Tả |
|---------|-------------|
| `/help` | Hiển thị các lệnh có sẵn |
| `/ping` | Kiểm tra thời gian phản hồi của bot |
| `/about` | Thông tin về Luna |
| `/image` | Tạo hình ảnh bằng các lệnh đơn giản |
| `/reset` | Đặt lại cuộc trò chuyện với bot |
| `/profile` | Xem thẻ thông tin người dùng |

### Lệnh Quản Trị (Admin/Owner)
| Lệnh | Mô Tả | Quyền |
|---------|-------------|---------|
| `/setrole` | Đặt vai trò cho người dùng | Owner, Admin |
| `/tokenstats user` | Xem thống kê token của người dùng | Tất cả (chỉ xem của mình), Owner/Admin (xem của người khác) |
| `/tokenstats system` | Xem thống kê token toàn hệ thống | Owner, Admin |
| `/resettoken` | Reset giới hạn token cho người dùng | Owner, Admin |

## Lợi Ích Kiến Trúc Mới

### 🔄 **Dễ Nâng Cấp**
- Chỉ cần sửa `AICore.js` để thay đổi nhà cung cấp AI 
- Các service độc lập, dễ test và debug
- Backward compatibility hoàn toàn

### 🛠️ **Bảo Trì Tốt Hơn**
- Separation of concerns rõ ràng
- Bug fixes được cô lập trong service liên quan
- Code organization được cải thiện

### 📈 **Khả Năng Mở Rộng**
- Các service có thể scale độc lập
- Dễ dàng thêm tính năng mới
- Logging với prefix riêng cho từng service

## Đóng Góp

Chào đón mọi đóng góp, báo lỗi và yêu cầu tính năng mới! Bot được thiết kế với kiến trúc module hóa mới, cực kỳ dễ dàng mở rộng và tùy chỉnh.

### Hướng Dẫn Phát Triển
- Sử dụng service tương ứng cho từng loại chức năng
- Tất cả AI logic → `AICore.js`
- Tất cả image processing → `ImageService.js`
- Tất cả conversation logic → `ConversationService.js`
- Tất cả system utilities → `SystemService.js`

## Giấy Phép

[MIT](LICENSE) [Terms of service](./docs/legal/terms-of-service.md) [Privacy](./docs/legal/privacy-policy.md)
