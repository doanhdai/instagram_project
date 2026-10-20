package com.example.backend_instagram.event;

import com.example.backend_instagram.dto.message.MessageResponseDTO;
import java.util.Set;

/**
 * Event chỉ chứa dữ liệu đã detach khỏi persistence context. Nhờ vậy listener
 * có thể chạy AFTER_COMMIT mà không bị LazyInitializationException.
 */
public record MessageCreatedEvent(MessageResponseDTO message, Set<Long> participantIds) {
}
