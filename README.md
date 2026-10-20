# Social App

Ứng dụng mạng xã hội gồm frontend React và backend Spring Boot. Cách chạy được hỗ trợ chính là Docker Compose; Compose khởi động MySQL, LocalStack S3, backend, seed dữ liệu demo và frontend.

## Yêu cầu

- Docker Desktop hoặc Docker Engine với Docker Compose
- Các cổng `3000`, `3306`, `4566` và `8081` chưa được ứng dụng khác sử dụng

## Chạy ứng dụng

Từ thư mục gốc dự án:

```bash
docker compose up --build -d
docker compose ps
```

Mở frontend tại [http://localhost:3000](http://localhost:3000). Backend API chạy tại `http://localhost:8081`; health endpoint là `http://localhost:8081/actuator/health`.

Seed tạo ba tài khoản demo dùng chung mật khẩu `InstagramDemo!2026`:

| Email | Tên hiển thị |
| --- | --- |
| `admin@instagram.local` | Demo Admin |
| `linh@instagram.local` | Linh Nguyen |
| `minh@instagram.local` | Minh Tran |

Tài khoản Demo Admin dùng để đăng nhập và thử dữ liệu mẫu. Backend hiện chưa có cơ chế role superuser, nên tên tài khoản không đồng nghĩa với quyền quản trị đặc biệt.

## Lệnh thường dùng

```bash
# Xem log

docker compose logs -f backend frontend

# Dừng các dịch vụ, giữ dữ liệu trong volumes

docker compose down

# Xóa cả dữ liệu MySQL và LocalStack để khởi tạo lại từ đầu

docker compose down -v
```

`docker compose down -v` xóa dữ liệu trong database và LocalStack. Seed chạy lại khi Compose khởi động; các bản ghi đã có được giữ nguyên.

## Cấu hình

Compose dùng file `.env` ở thư mục gốc cho cấu hình local; không commit file này. Tạo secret JWT riêng trước khi chạy bằng cách đặt `JWT_BASE64_SECRET` trong `.env`. Các biến thường dùng:

- `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `DB_PORT`
- `JWT_BASE64_SECRET`, `JWT_TOKEN_VALIDITY_SECONDS`, `JWT_REFRESH_TOKEN_VALIDITY_SECONDS`
- `GEMINI_API_KEY` để bật tính năng Gemini

S3 được trỏ tới LocalStack và tự tạo bucket `instagram-media`. Mặc định AWS/Gemini credentials trong môi trường Compose chỉ dành cho local; cần thay bằng secrets riêng khi triển khai thật.

## Chạy frontend ngoài Docker

```bash
cd Social-app-fontend
pnpm install --frozen-lockfile
REACT_APP_API_URL=http://localhost:8081 pnpm start
```

## Cấu trúc chính

```text
Social-app-fontend/  React frontend, Dockerfile và nginx config
backend_instagram/   Spring Boot API, Dockerfile và seed-demo.sql
localstack-init/     Khởi tạo bucket S3 local
docker-compose.yml   Bộ dịch vụ phát triển local
```

Frontend source hiện được giữ trong `Social-app-fontend` (tên thư mục giữ nguyên như repo gốc). Backend standalone hướng dẫn cài đặt nằm trong `backend_instagram/README.md`.
