package com.example.backend_instagram.dto.message;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReadReceiptDTO {
    private Long conversationId;
    private Long userId;
}
