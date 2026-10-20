package com.example.backend_instagram.service;

import org.springframework.stereotype.Service;

@Service
public class NotificationWebSocketService {

    private final ChatRealtimePublisher realtimePublisher;

    public NotificationWebSocketService(ChatRealtimePublisher realtimePublisher) {
        this.realtimePublisher = realtimePublisher;
    }

    public void sendNotificationToUser(Long userId, Object notificationPayload) {
        realtimePublisher.sendNotification(userId, notificationPayload);
    }

    public void sendVideoCallSignal(Long userId, Object signalPayload) {
        realtimePublisher.sendVideoCallSignal(userId, signalPayload);
    }
}
