# Shopee Link Converter (YT) - Queue + Worker

Tool gồm 3 phần:

1. Frontend static nhận link từ user.
2. Queue backend nhận request, tạo job, chờ worker xử lý.
3. Worker chạy trên máy bạn (Python script hoặc Chrome Extension) để tạo link chuẩn theo account đang treo.

Luồng:

`Web -> /api/convert -> queue -> worker poll -> worker submit -> web poll /api/jobs/:id -> trả affiliate link`

## Cấu trúc

- `index.html`
- `styles.css`
- `app/config.js`
- `app/dom.js`
- `app/validators.js`
- `app/clipboard.js`
- `app/resolve.js`
- `app/converter.js`
- `app/ui.js`
- `app/api.js`
- `app/main.js`
- `backend/server.py` (queue server)
- `worker/local_worker.py` (worker local Python)
- `extension/` (Chrome extension worker skeleton)

## Chạy local (nhanh nhất)

Lưu ý ES Modules:

- Không mở web bằng `file://.../index.html` vì module import có thể bị chặn và gây trắng trang.
- Luôn chạy qua HTTP local (Live Server hoặc `python3 -m http.server`).
- Nếu vừa sửa code mà vẫn trắng trang, hard reload: `Ctrl/Cmd + Shift + R`.

### 1) Chạy queue backend

```bash
cd "/Users/sonmoi/Downloads/YT convert"
WORKER_TOKEN=dev-worker-token python3 backend/server.py
```

### 2) Chạy worker local Python

Mặc định đã dùng `AFFILIATE_ID=17391540096`, bạn có thể override bằng env.

```bash
cd "/Users/sonmoi/Downloads/YT convert"
WORKER_TOKEN=dev-worker-token AFFILIATE_ID=17391540096 SUB_ID=YT3 python3 worker/local_worker.py
```

### 3) Chạy frontend static

```bash
cd "/Users/sonmoi/Downloads/YT convert"
python3 -m http.server 5500
```

Mở `http://localhost:5500`.

## Dùng Chrome Extension worker

Chi tiết ở `extension/README.md`.

Tóm tắt:

1. `chrome://extensions` -> bật `Developer mode` -> `Load unpacked` thư mục `extension/`.
2. Mở `Extension options`, set `serverBaseUrl` + `workerToken`.
3. Đăng nhập `https://affiliate.shopee.vn/` trên cùng profile Chrome.
4. Bật worker.

## Deploy

- Frontend có thể deploy GitHub Pages.
- Backend queue phải deploy ở server riêng (VPS/Render/Fly.io/Cloud Run...).
- Worker phải luôn online để xử lý job.

## Cấu hình quan trọng

- Frontend gọi backend qua `BACKEND_BASE_URL` trong `app/config.js`.
- Frontend hiện ưu tiên gọi API sync `GET /?url=...&yt=1` để nhận kết quả ngay.
- Backend auth worker bằng `WORKER_TOKEN`.
- Job chỉ thành công khi worker trả `affiliateLink` hợp lệ.
- Nếu worker không resolve ra landing URL có `gads_t_sig`, worker sẽ trả lỗi để tránh sai format.
- Backend sẽ chuẩn hóa kết quả về dạng `/product/{shop_id}/{item_id}` và chỉ giữ `gads_t_sig` + `extraParams` trong `origin_link`.

## API kiểu `yt.shpee.cc`

Backend hỗ trợ gọi trực tiếp kiểu mẫu:

```bash
curl "http://localhost:8787/?url=https%3A%2F%2Fs.shopee.vn%2F7fUkCzF5RK&yt=1"
```

Response:

```json
{
  "success": true,
  "affiliateLink": "https://s.shopee.vn/an_redir?affiliate_id=...&sub_id=YT3&origin_link=...",
  "shortAffiliateLink": "http://localhost:8787/r/Ab12",
  "mode": "yt",
  "affiliate_id": "17391540096",
  "sub_id": "YT3"
}
```

- `affiliateLink` luôn là link dài chuẩn `an_redir` theo format bạn cần.
- `shortAffiliateLink` là link rút gọn nội bộ (`/r/<code>`) để tiện share (optional).
- Có thể chỉnh `SUB_ID_YT` bằng env khi chạy backend.
