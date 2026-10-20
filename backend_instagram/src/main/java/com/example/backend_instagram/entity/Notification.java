package com.example.backend_instagram.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter
@Setter
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_notification_id"))
    private User user; // Người nhận thông báo (chủ bài viết)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", referencedColumnName = "id", nullable = false, foreignKey = @ForeignKey(name = "fk_actor_notification_id"))
    private User actor; // Người thực hiện hành động (người thích/bình luận)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", referencedColumnName = "id", nullable = true, foreignKey = @ForeignKey(name = "fk_post_notification_id"))
    private Post post; // Bài viết liên quan

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private NotificationType type; // Loại thông báo (LIKE, COMMENT)

    @Column(name = "message", nullable = false)
    private String message; // Nội dung thông báo

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    public  Notification() {
    }

    public Notification(User user, User actor, Post post, NotificationType type, String message) {
        this.user = user;
        this.actor = actor;
        this.post = post;
        this.type = type;
        this.message = message;
        this.sentAt = LocalDateTime.now();
        this.isRead = false;
    }
}