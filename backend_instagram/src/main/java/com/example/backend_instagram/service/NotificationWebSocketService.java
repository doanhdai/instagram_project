package com.example.backend_instagram.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class NotificationWebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    public NotificationWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendNotificationToUser(Long userId, Object notificationPayload) {
        messagingTemplate.convertAndSend("/topic/notifications." + userId, notificationPayload);
    }

    public void sendVideoCallSignal(Long userId, Object signalPayload) {
        messagingTemplate.convertAndSend("/topic/video-call." + userId, signalPayload);
    }
}
