package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.message.ReadReceiptDTO;
import com.example.backend_instagram.event.MessageCreatedEvent;
import java.time.Instant;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Tập trung toàn bộ việc gửi realtime. Chỉ dùng user destination để mỗi user
 * chỉ nhận được dữ liệu của chính mình.
 */
@Service
public class ChatRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public ChatRealtimePublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true)
    public void onMessageCreated(MessageCreatedEvent event) {
        for (Long participantId : event.participantIds()) {
            sendToUser(participantId, "/queue/messages", event.message());
        }
    }

    public void sendNotification(Long userId, Object payload) {
        sendToUser(userId, "/queue/notifications", payload);
    }

    public void sendVideoCallSignal(Long userId, Object payload) {
        sendToUser(userId, "/queue/video-call", payload);
    }

    public void sendReadReceipt(Long userId, ReadReceiptDTO receipt) {
        sendToUser(userId, "/queue/read-receipts", receipt);
    }

    public void sendError(Long userId, String message) {
        sendToUser(userId, "/queue/errors", Map.of(
                "message", message == null ? "Unexpected error" : message,
                "timestamp", Instant.now().toString()));
    }

    private void sendToUser(Long userId, String destination, Object payload) {
        if (userId == null) {
            return;
        }
        messagingTemplate.convertAndSendToUser(userId.toString(), destination, payload);
    }
}
