# Backend

Backend Spring Boot của Social App. Hướng dẫn chạy Docker Compose, cấu hình và dữ liệu demo nằm trong [README ở thư mục gốc](../README.md).

Có thể chạy riêng backend khi MySQL và LocalStack đã hoạt động:

```bash
./mvnw spring-boot:run
```

Cấu hình backend đọc từ biến môi trường; xem [`.env.example`](.env.example). Không đưa secrets thật vào Git.
