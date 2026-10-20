# 🚀 SocialApp - Backend

Đây là phần backend của dự án **SocialApp** – một ứng dụng mạng xã hội với tính năng đăng bài, kết bạn, trò chuyện và gọi video real-time. Backend được xây dựng bằng **Java Spring Boot**, sử dụng **MySQL** làm cơ sở dữ liệu và **AWS, WebSocket, API** cho chức năng giao tiếp thời gian thực.

> 🔗 **Frontend repository**: [SocialApp Frontend](https://github.com/vanmuoi24/Social-app-fontend)

---

## 🛠️ Công nghệ sử dụng

| Thành phần        | Công nghệ                   |
| ----------------- | --------------------------- |
| Backend Framework | Spring Boot                 |
| Cơ sở dữ liệu     | MySQL                       |
| Real-time         | AWS WebSocket API           |
| ORM               | Spring Data JPA             |
| Bảo mật           | Spring Security, JWT        |
| Triển khai        | AWS EC2 / Elastic Beanstalk |

---

## 📁 Cấu trúc thư mục

```bash
socialapp-backend/
├── src/
│   ├── main/
│   │   ├── java/com/socialapp/
│   │   │   ├── config/         # Cấu hình bảo mật, CORS, WebSocket
│   │   │   ├── controller/     # Các REST API
│   │   │   ├── dto/            # DTO classes
│   │   │   ├── entity/         # Entity JPA
│   │   │   ├── repository/     # Interface JPA Repository
│   │   │   ├── service/        # Business logic
│   │   │   └── SocialApp.java  # Main class
│   └── resources/
│       ├── application.properties
├── pom.xml
└── README.md
```

---

## ⚙️ Cài đặt và chạy dự án

### 1. Clone project

```bash
git clone https://github.com/ten-cua-ban/socialapp-backend.git
cd socialapp-backend
```

### 2. Cấu hình `application.properties`

```properties
server.port=8081
spring.application.name=backend_instagram
spring.devtools.restart.enabled=true
spring.datasource.url=jdbc:mysql://localhost:3306/backend_instagram
spring.datasource.username=root
spring.datasource.password=
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
##cấu hình jwt
# Base64 secret key
tenit.jwt.base64-secret=+s0BonwcaVan5UAz+4armUFFDEEPPpTVl/P0N8OiZp1gZT7GgMZdRkPmfuoZwaV1UxHbXks84FGDWFP3RzkExQ==

server.servlet.encoding.charset=UTF-8
server.servlet.encoding.enabled=true
server.servlet.encoding.force=true
# JWT token validity time in seconds
tenit.jwt.token-validity-in-seconds=1000000000
tenit.jwt.refresh-token-validity-in-seconds=1000000000

# Thêm cấu hình WebSocket
spring.mvc.async.request-timeout=30000

# Nếu cần tăng kích thước tin nhắn
spring.websocket.max-text-message-size=8192
spring.websocket.max-binary-message-size=65536


gemini.api.key=AIzaSyBmPQpung3TyQ1cbOwIILMFKRkuIe7sVAM
gemini.api.url=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent


```

### 3. Cài đặt MySQL

Tạo database tên `backend_instagram`:

```sql
CREATE DATABASE backend_instagram;
```

### 4. Cấu hình AWS

REGION=ap-southeast-2
ACCESS_KEY=AKIA5U6CH3YTHUVGUHHU
SECRET_KEY=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
BUCKET_NAME=my-app-social-2025

### 5. Chạy ứng dụng

```bash
./mvnw spring-boot:run
```

Ứng dụng sẽ chạy tại: `http://localhost:8080`

---

## 🔌 Tích hợp WebSocket (AWS)

1. Tạo WebSocket API trên AWS API Gateway
2. Cấu hình route `$connect`, `$disconnect`, và `message`
3. Sử dụng Amazon API Gateway SDK hoặc HttpClient trong backend để gửi tin nhắn real-time

---

## 📌 Ghi chú

- Đảm bảo bạn đã cài đặt Java 21+ và Maven
- Hệ thống yêu cầu cấu hình AWS IAM cho phép sử dụng WebSocket API Gateway

---

## 📫 Liên hệ

Nếu bạn có thắc mắc hoặc muốn đóng góp, hãy tạo issue hoặc pull request trong repo này.
