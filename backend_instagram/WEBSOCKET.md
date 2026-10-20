# WebSocket / STOMP protocol

Tài liệu này mô tả luồng realtime sau khi tối ưu. Mục tiêu: mỗi tab chỉ mở **một**
kết nối STOMP, mọi dữ liệu đi qua **user destination** và không còn topic công
khai.

## 1. Kết nối

- SockJS endpoint: `GET /ws` (giữ tương thích client cũ)
- Native WebSocket endpoint: `/ws-native` (dành cho client mới)
- STOMP CONNECT bắt buộc gửi header:

```
Authorization: Bearer <access_token>
```

`StompAuthChannelInterceptor` decode JWT, lấy claim `userId` (fallback claim
`user.id` cho token cũ) và set `Principal = userId`. Các frame `SUBSCRIBE` /
`SEND` sau đó đều được kiểm tra đã xác thực.

## 2. Destination

| Mục đích | Client subscribe | Ghi chú |
| --- | --- | --- |
| Tin nhắn | `/user/queue/messages` | `MessageResponseDTO` |
| Thông báo | `/user/queue/notifications` | `NotificationDTO`, `LikeUpdateDTO`, follow |
| Read receipt | `/user/queue/read-receipts` | `{ conversationId, userId }` |
| Video call | `/user/queue/video-call` | tín hiệu WebRTC |
| Lỗi | `/user/queue/errors` | `{ message, timestamp }` |

Client gửi:

| Mục đích | Destination | Payload |
| --- | --- | --- |
| Gửi tin nhắn | `/app/chat/{conversationId}` | `{ "content": "..." }` |
| Đánh dấu đã đọc | `/app/chat/{conversationId}/read` | rỗng |
| Video call | `/app/video-call/{toUserId}` | `{ action, signal }` |
| Follow notification | `/app/notifications/{toUserId}` | `{ fromUserName, message, sentAt }` |

Server **luôn** lấy người gửi từ `Principal`; không tin `senderId` / `from` do
client gửi.

## 3. Luồng gửi tin nhắn

1. Client gọi `POST /api/v1/messages` (hoặc STOMP `/app/chat/{id}`).
2. `MessageService.sendMessage` kiểm tra membership + quan hệ bạn bè/block.
3. Lưu message, cập nhật `conversations.updated_at` bằng một câu UPDATE.
4. Publish `MessageCreatedEvent`.
5. `ChatRealtimePublisher` chỉ gửi sau khi transaction commit
   (`@TransactionalEventListener(AFTER_COMMIT)`) tới `/user/queue/messages` của
   từng participant.

REST vẫn là đường gửi chính của frontend; STOMP send dùng cùng write path nên
không còn tin nhắn "ma" không lưu DB.

## 4. Cấu hình

Không cần thêm property vào `application.properties`; có thể override bằng biến
môi trường:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `APP_WEBSOCKET_ALLOWED_ORIGINS` | `http://localhost:3000` | Danh sách origin, phân tách bằng dấu phẩy |
| `APP_WEBSOCKET_MESSAGE_SIZE_LIMIT` | `65536` | Giới hạn frame STOMP |
| `APP_WEBSOCKET_SEND_BUFFER_SIZE_LIMIT` | `524288` | Buffer gửi mỗi session |
| `APP_WEBSOCKET_SEND_TIME_LIMIT` | `20000` | ms trước khi session bị đóng do gửi chậm |

## 5. Lưu ý triển khai

- Simple broker hiện tại là **in-memory**, chỉ đúng khi chạy **một** instance
  backend. Khi scale nhiều pod cần broker relay (RabbitMQ/Redis) — phần này nằm
  ngoài phạm vi nhánh WebSocket và cần phối hợp với nhánh Redis/K8s.
- Index được khai báo trên entity:
  - `messages(conversation_id, created_at)`
  - `conversation_participants(conversation_id, user_id)`
  - `conversation_participants(user_id)`
  - `notifications(user_id, is_read, sent_at)`

  Với DB đã tồn tại, kiểm tra `SHOW INDEX` và thêm thủ công nếu Hibernate
  `ddl-auto=update` không tạo index.
- Token cũ chưa có claim `userId` vẫn dùng được nhờ fallback `user.id`; sau khi
  deploy nên đăng nhập lại để token mới có claim này.
