package com.example.backend_instagram.dto.message;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Payload gửi tin nhắn qua STOMP. Không nhận senderId từ client; server lấy
 * sender từ Principal đã xác thực ở frame CONNECT.
 */
@Data
public class ChatSendRequest {

    @NotBlank(message = "Nội dung tin nhắn không được để trống")
    @Size(max = 8000, message = "Tin nhắn quá dài")
    private String content;
}
