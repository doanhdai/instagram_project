# AGENTS.md

Quy tắc làm việc cho AI agent (và người) trong repo `haole2k4/instagram_project`.

## Bối cảnh repo

- Đây là **fork** của `doanhdai/instagram_project` (upstream). Repo làm việc chính là `haole2k4/instagram_project`.
- Nhánh mặc định: `master`.
- Cấu trúc:
  - `backend_instagram/`: Spring Boot 4.1 (Java 25, Maven wrapper `./mvnw`), MySQL, Redis cache, S3 (LocalStack), WebSocket/STOMP.
  - `Social-app-fontend/`: React 19 (react-app-rewired, pnpm), Tailwind.
  - `k8s/`: manifest kind + ingress-nginx. `docker-compose.yml`, `Makefile`, `localstack-init/` ở thư mục gốc.

## Quy trình Git (bắt buộc)

1. **Không commit trực tiếp lên `master`.** Mọi thay đổi, kể cả sửa nhỏ hoặc chỉ sửa tài liệu, đều làm trên một nhánh mới tạo từ `master` mới nhất.
2. Đặt tên nhánh theo dạng `<loại>/<mô-tả-ngắn-kebab-case>`, ví dụ `feature/redis-kubernetes`, `fix/login-cookie`, `docs/add-agents-md`. Loại thường dùng: `feature`, `fix`, `docs`, `chore`, `refactor`, `test`.
3. Khi push nhánh, **tạo Pull Request trên chính repo này**:
   - base: `haole2k4/instagram_project` nhánh `master`
   - head: nhánh vừa push của `haole2k4/instagram_project`
4. **Tuyệt đối không tạo PR sang `doanhdai/instagram_project`** (repo gốc), kể cả khi giao diện GitHub hoặc công cụ mặc định đề xuất repo đó. Nếu dùng `gh`, luôn chỉ rõ repo đích:
   ```bash
   gh pr create --repo haole2k4/instagram_project --base master --head <nhánh>
   ```
   Nếu dùng REST API: `POST /repos/haole2k4/instagram_project/pulls`.
5. Không `push --force` lên `master`.
6. Mỗi PR tập trung vào một mục đích, mô tả rõ thay đổi gì và cách kiểm tra.
7. Chỉ merge PR (trên repo này) khi build/test liên quan đã pass; nếu chưa chạy được test hoặc test fail thì để PR mở và báo lại.

## Repo gốc (upstream)

- Không đụng tới `doanhdai/instagram_project`: không fetch, merge, rebase từ đó, không push hay tạo PR sang đó. Chỉ làm việc với `haole2k4/instagram_project`.

## Bảo mật và cấu hình

- Không commit secret: `.env`, mật khẩu, API key (`GEMINI_API_KEY`, `JWT_BASE64_SECRET`, key AWS), `k8s/secret.yaml`. Chỉ cập nhật các file mẫu (`.env.example`, `k8s/secret.example.yaml`).
- Không sửa và không commit mọi file `.env`, kể cả `Social-app-fontend/.env` (hiện đang bị track trong git dù `.gitignore` đã chặn). Cần đổi biến môi trường thì cập nhật file mẫu và báo lại.
- Không in giá trị secret ra log, PR hoặc tin nhắn.
- Biến môi trường mới phải được thêm vào `.env.example` / `docker-compose.yml` / `k8s/configmap.yaml` khi liên quan.

## Phát triển và kiểm tra

- Backend: chạy test trong `backend_instagram/` bằng `./mvnw test` trước khi tạo PR khi có đổi code backend.
- Frontend: trong `Social-app-fontend/` dùng `pnpm` (có `pnpm-lock.yaml`); kiểm tra bằng `pnpm build` (và `pnpm test` nếu có test liên quan).
- Chạy stack: `docker compose up --build -d` hoặc `make k8s-up` (xem `README.md`).
- Đổi hành vi cache Redis, schema DB hoặc manifest `k8s/` thì cập nhật `README.md` tương ứng.

## Phong cách làm việc

- Đọc code liên quan trước khi sửa; theo convention hiện có (package `controller`/`service`/`repository`/`entity`/`dto` ở backend, cấu trúc `Pages`/`Components` ở frontend).
- Sửa tối thiểu, đúng phạm vi yêu cầu; không refactor hoặc format lại file không liên quan.
- Commit message và mô tả PR ngắn gọn, rõ ý; không ràng buộc định dạng hay ngôn ngữ.
- Khi có sub-agent, dùng model Haiku.
