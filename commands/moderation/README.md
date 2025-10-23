# Lệnh Moderation

Thư mục này chứa các lệnh moderation để quản lý thành viên trong server Discord.

## Danh sách lệnh

### Kick
- **Lệnh**: `/kick`
- **Mô tả**: Kick một thành viên khỏi server
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần kick
  - `reason` (tùy chọn): Lý do kick

### Ban
- **Lệnh**: `/ban`
- **Mô tả**: Ban một thành viên khỏi server
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần ban
  - `reason` (tùy chọn): Lý do ban
  - `days` (tùy chọn): Số ngày xóa tin nhắn (0-7)

### Unban
- **Lệnh**: `/unban`
- **Mô tả**: Unban một người dùng khỏi server
- **Tùy chọn**:
  - `userid` (bắt buộc): ID của người dùng cần unban
  - `reason` (tùy chọn): Lý do unban

### Mute
- **Lệnh**: `/mute`
- **Mô tả**: Mute (timeout) một thành viên
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần mute
  - `duration` (bắt buộc): Thời gian mute (phút)
  - `reason` (tùy chọn): Lý do mute

### Unmute
- **Lệnh**: `/unmute`
- **Mô tả**: Unmute (bỏ timeout) một thành viên
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần unmute
  - `reason` (tùy chọn): Lý do unmute

### Warn
- **Lệnh**: `/warn`
- **Mô tả**: Cảnh cáo một thành viên
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần cảnh cáo
  - `reason` (bắt buộc): Lý do cảnh cáo

### Warnings
- **Lệnh**: `/warnings`
- **Mô tả**: Xem danh sách cảnh cáo của một thành viên
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần xem cảnh cáo

### Clear Warnings
- **Lệnh**: `/clearwarnings`
- **Mô tả**: Xóa cảnh cáo của một thành viên
- **Tùy chọn**:
  - `user` (bắt buộc): Thành viên cần xóa cảnh cáo
  - `type` (bắt buộc): Loại xóa cảnh cáo (all/latest)
  - `reason` (tùy chọn): Lý do xóa cảnh cáo

### Modlog
- **Lệnh**: `/modlog`
- **Mô tả**: Xem nhật ký hành động moderation
- **Tùy chọn**:
  - `user` (tùy chọn): Lọc theo thành viên
  - `action` (tùy chọn): Lọc theo loại hành động
  - `limit` (tùy chọn): Số lượng hành động hiển thị (mặc định: 10)

## Tính năng đặc biệt

1. **Thông báo AI**: Tất cả các lệnh moderation đều sử dụng NeuralNetworks để tạo thông báo AI độc đáo và thú vị.

2. **Hệ thống cảnh cáo thông minh**: Tự động xử phạt khi số lần cảnh cáo vượt quá ngưỡng (mute sau 3 lần, kick sau 5 lần).

3. **Nhật ký moderation**: Ghi lại tất cả các hành động moderation vào cơ sở dữ liệu.

4. **Thông báo DM**: Tự động gửi DM cho người dùng bị xử lý với thông tin chi tiết.

## Cách sử dụng

1. Đảm bảo bot có quyền cần thiết trong server (Kick Members, Ban Members, Moderate Members).
2. Sử dụng lệnh slash tương ứng với hành động bạn muốn thực hiện.
3. Điền các tùy chọn cần thiết và gửi lệnh.

## Lưu ý

- Tất cả các lệnh đều yêu cầu quyền tương ứng để sử dụng.
- Các hành động moderation sẽ được ghi lại trong cơ sở dữ liệu và có thể xem lại bằng lệnh `/modlog`.
- Hệ thống cảnh cáo sẽ tự động xử phạt khi số lần cảnh cáo vượt quá ngưỡng.
