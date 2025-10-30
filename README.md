# Luna - Bot Trợ Lý AI Cho Discord

<div align="center">
  <img src="./assets/luna-avatar.png" alt="Ảnh đại diện bot Luna" width="200" height="200" style="border-radius: 50%;">
  <br>
  <em>Trợ lý AI thông minh cho Discord của bạn</em>
</div>

## Tổng Quan

Luna là bot Discord được hỗ trợ bởi nhiều nhà cung cấp AI bao gồm Perplexity, Alibaba Qwen, OpenRouter và OpenAI. Bot có tính cách thân thiện và hỗ trợ nhiều tác vụ như trò chuyện, tạo mã nguồn và tạo hình ảnh. Tích hợp hệ thống cấp độ và thành tựu để khuyến khích tương tác người dùng.
> Luna Bot hỗ trợ cả **local offline models** và **cloud providers** để đảm bảo độ tin cậy tối đa. Ngoài ra model LLM Luna được build dựa trên Qwen3 235B (sẽ được cập nhật sau tại Hugging Face).

**Phien ban 1.1.1**: Horizon UI dashboard tu dong khoi dong cung bot, chia se log va su dung chung cau hinh MongoDB.
**Phiên bản 1.1.0**: Kiến trúc hoàn toàn mới với hệ thống đa nhà cung cấp AI, tự động chuyển đổi khi lỗi và thiết kế modular để tăng độ tin cậy và dễ bảo trì.

## Tính Năng Chính

- **Trò chuyện thông minh**: Tương tác tự nhiên với khả năng ghi nhớ ngữ cảnh  
- **Tạo hình ảnh**: Tạo hình ảnh từ mô tả văn bản đơn giản  
- **Trợ lý lập trình**: Hỗ trợ lập trình và tạo mã nguồn  
- **Hệ thống bộ nhớ**: Ghi nhớ ngữ cảnh cuộc trò chuyện cho tương tác tự nhiên  
- **Quản lý máy chủ**: Tự động triển khai lệnh cho máy chủ mới  
- **Hệ thống tiến độ**: Hệ thống cấp độ với thành tựu và phần thưởng  
- **Thẻ hồ sơ**: Hiển thị thông tin người dùng hiện đại  
- **Đồng bộ dữ liệu**: Lưu trữ dữ liệu người dùng và máy chủ với MongoDB  
- **Kiến trúc đa nhà cung cấp**: Tự động chuyển đổi API để đảm bảo hoạt động liên tục

## Kiến Trúc Hệ Thống

Luna đã được tái cấu trúc hoàn toàn với hệ thống đa nhà cung cấp mạnh mẽ:

### **AICore.js** - Trung tâm xử lý AI
- Xử lý tất cả API calls và logic AI
- Hỗ trợ đa nhà cung cấp với tự động chuyển đổi
- Cấu hình API client bảo mật
- Quản lý quota thông minh và chuyển đổi nhà cung cấp

### **providers.js** - Quản lý nhà cung cấp
- Quản lý nhiều nhà cung cấp AI (Perplexity, Qwen, OpenRouter, OpenAI)
- Tự động chuyển đổi khi hết quota
- Giám sát sức khỏe và theo dõi trạng thái nhà cung cấp
- Xác thực phản hồi và lọc chất lượng

### **ImageService.js** - Xử lý hình ảnh
- Tích hợp Gradio để tạo hình ảnh
- Theo dõi tiến trình tạo hình ảnh
- Chức năng hình ảnh độc lập

### **ConversationService.js** - Quản lý cuộc trò chuyện
- Quản lý ngữ cảnh và bộ nhớ
- Xử lý tương tác người dùng
- Khả năng ghi nhớ cao

### **SystemService.js** - Tiện ích hệ thống
- Xác thực môi trường và kiểm tra hệ thống
- Khởi tạo logging và quản lý
- Bảo trì định kỳ tự động

## Cài Đặt

1. Clone repository này
2. Cài đặt dependencies: `npm install`
3. Tạo file `.env` từ `example.env`
4. Cấu hình API keys cho các nhà cung cấp mong muốn
5. Chạy bot: `npm start` 
> Lan dau chay, vao thu muc `dashboard` va cai dat phu thuoc: `cd dashboard && npm install`.

## Các Lệnh Có Sẵn

| Lệnh | Mô Tả |
|---------|-------------|
| `/help` | Hiển thị các lệnh có sẵn |
| `/ping` | Kiểm tra thời gian phản hồi bot |
| `/about` | Thông tin về Luna |
| `/think` | Hiển thị quá trình suy nghĩ của AI |
| `/image` | Tạo hình ảnh từ văn bản |
| `/reset` | Đặt lại cuộc trò chuyện với bot |
| `/profile` | Xem thẻ hồ sơ người dùng |

## Lợi Ích Kiến Trúc

### **Độ tin cậy cao**
- Nhiều nhà cung cấp AI với tự động chuyển đổi
- Hạn chế gặp vấn đề do lỗi từ một vài nhà cung cấp
- Quản lý quota thông minh
- Xác thực chất lượng phản hồi

### **Dễ bảo trì**
- Kiến trúc dịch vụ modular
- Sửa lỗi và cập nhật được tách biệt
- Tổ chức code được cải thiện

### **Khả năng mở rộng**
- Các dịch vụ có thể mở rộng dễ dàng
- Dễ dàng thêm nhà cung cấp AI mới
- Thêm tính năng đơn giản
- Hệ thống logger thay thế console.log

## Đóng Góp

Tôi chào đón mọi đóng góp, báo cáo lỗi và yêu cầu tính năng! Bot được thiết kế với kiến trúc modular mới giúp việc mở rộng và tùy chỉnh trở nên cực kỳ dễ dàng.

### Hướng Dẫn Phát Triển
- Sử dụng dịch vụ phù hợp cho từng loại chức năng
- Tất cả logic AI: `AICore.js`
- Quản lý nhà cung cấp: `providers.js`
- Xử lý hình ảnh: `ImageService.js`
- Xử lý logic cuộc trò chuyện: `ConversationService.js`
- Tiện ích hệ thống: `SystemService.js`

## Giấy Phép

[MIT](LICENSE) | [Điều Khoản Dịch Vụ](./docs/legal/terms-of-service.md) | [Chính Sách Bảo Mật](./docs/legal/privacy-policy.md)
