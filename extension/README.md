# Chrome Extension Worker (MVP)

Extension này giúp máy bạn làm worker nhận job từ queue server và trả affiliate link.

## Cài đặt

1. Mở `chrome://extensions`
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Trỏ tới thư mục `extension/`

## Cấu hình

Vào `Details` -> `Extension options`:

- `Server Base URL`: mặc định `http://localhost:8787`
- `Worker Token`: phải khớp với backend (`WORKER_TOKEN`)
- `Affiliate ID`: mặc định `17391540096` (fallback ổn định). Bạn có thể đổi theo account khác.
- `Sub ID`: mặc định `YT3`
- `Base Redirect`: `https://s.shopee.vn/an_redir`

## Cách chạy

- Đăng nhập tab `https://affiliate.shopee.vn/`
- Đảm bảo backend queue đang chạy
- Bật worker trong options
- Extension sẽ poll job và submit kết quả

## Popup trạng thái realtime

- Click icon extension để mở popup.
- Popup có:
  - Chấm màu trạng thái realtime (`xanh`: hoạt động, `vàng`: đang xử lý/chờ, `đỏ`: lỗi/offline).
  - Nút nhỏ `Kiểm tra ngay` để force poll và cập nhật tức thì.
  - Nút `Bật/Tắt worker`.
- Nếu vừa sửa code extension, nhớ bấm `Reload` trong `chrome://extensions`.

## Lưu ý

- Đây là skeleton MVP, phần auto detect affiliate id phụ thuộc DOM thực tế của trang affiliate.
- Nếu auto detect không ổn định, hãy nhập `Affiliate ID` thủ công trong options.
