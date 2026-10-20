
# 🌐 SocialApp - Frontend

Đây là phần giao diện người dùng (frontend) của dự án **SocialApp** – một ứng dụng mạng xã hội đơn giản, thân thiện với người dùng, được phát triển bằng **ReactJS**.

> 🔗 **Backend repository**: [SocialApp Backend](https://github.com/doanhdai/backend_instagram)

## 👥 Thành viên xây dựng dự án


| Họ tên            | Vai trò             | Ghi chú                     |
|-------------------|---------------------|-----------------------------|
| Vy Văn Mười       | Developer           | Xây dựng Phần Mềm           |
| Đỗ Anh Đài        | Developer           | Xây dựng Phần Mềm           |
| Lương Tuấn Giai   | Developer           | Xây dựng Phần Mềm           |
| Lê Chí Hào        | Developer           | Xây dựng Phần Mềm           |
| Mai Vũ Trung Tín  | Developer           | Xây dựng Phần Mềm           |
"""

---

## 📌 Giới thiệu

**SocialApp** cho phép người dùng:
- Đăng ký / đăng nhập
- Đăng bài viết, ảnh
- Tương tác với bài viết (like, comment)
- Kết bạn, theo dõi người dùng
- Trò chuyện và gọi video real-time


## 🚀 Công nghệ sử dụng

| Phần mềm         | Công nghệ         |
|------------------|-------------------|
| Frontend         | ReactJS + Vite    |
| Giao tiếp API    | Axios             |
| Giao tiếp realtime | socket.io-client |
| Quản lý trạng thái | Redux Toolkit   |
| Giao diện        | TailwindCSS       |
| Routing          | React Router DOM  |

---

## 📁 Cấu trúc thư mục

```bash
socialapp-frontend/
├── public/                 # Tài nguyên tĩnh
├── src/
│   ├── assets/             # Hình ảnh, icon
│   ├── components/         # Các component tái sử dụng
│   ├── pages/              # Trang (home, profile, login, ...)
│   ├── redux/              # Store Redux
│   ├── services/           # Giao tiếp API
│   ├── App.jsx             # Component gốc
│   └── main.jsx            # Điểm khởi chạy React
├── .env                    # Biến môi trường
├── package.json
└── README.md
```

---

## ⚙️ Cài đặt và chạy dự án

### 1. Clone project

```bash
git clone https://github.com/ten-cua-ban/socialapp-frontend.git
cd socialapp-frontend
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Tạo file `.env` trong thư mục gốc

```env
VITE_API_URL=http://localhost:8080/api
VITE_SOCKET_URL=http://localhost:9090
```

> 📌 **Chú ý**:
> - `VITE_API_URL`: URL của backend server (API)
> - `VITE_SOCKET_URL`: URL socket server (WebSocket)
> - Nếu bạn deploy backend online, thay đổi các giá trị này tương ứng.

### 4. Chạy frontend
```bash
npm run dev
```

Truy cập tại: [http://localhost:3000](http://localhost:3000)
