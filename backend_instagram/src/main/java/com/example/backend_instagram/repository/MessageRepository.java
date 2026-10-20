package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.Message;
import com.example.backend_instagram.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    // Lấy tất cả tin nhắn giữa 2 người dùng, sắp xếp theo thời gian
    @Query("SELECT m FROM Message m WHERE m.conversation.id IN " +
           "(SELECT cp.conversation.id FROM ConversationParticipant cp WHERE cp.user.id IN (:user1Id, :user2Id) " +
           "GROUP BY cp.conversation.id HAVING COUNT(DISTINCT cp.user.id) = 2) " +
           "ORDER BY m.createdAt ASC")
    List<Message> findConversation(@Param("user1Id") Long user1Id, @Param("user2Id") Long user2Id);

    // Lấy danh sách người dùng đã trao đổi tin nhắn với user
    @Query("SELECT DISTINCT u FROM User u JOIN ConversationParticipant cp ON u.id = cp.user.id " +
           "WHERE cp.conversation.id IN " +
           "(SELECT cp2.conversation.id FROM ConversationParticipant cp2 WHERE cp2.user.id = :userId) " +
           "AND u.id != :userId")
    List<User> findContactsByUserId(@Param("userId") Long userId);

    // Lấy tin nhắn mới nhất cho mỗi cuộc trò chuyện của user
    @Query(value = "SELECT m.* FROM messages m " +
           "JOIN (SELECT c.id, MAX(msg.created_at) as latest " +
           "      FROM messages msg " +
           "      JOIN conversation_participants cp ON cp.conversation_id = msg.conversation_id " +
           "      JOIN conversations c ON c.id = cp.conversation_id " +
           "      WHERE cp.user_id = :userId " +
           "      GROUP BY c.id) latest_msgs " +
           "ON m.conversation_id = latest_msgs.id AND m.created_at = latest_msgs.latest " +
           "ORDER BY m.created_at DESC", nativeQuery = true)
    List<Message> findLatestMessagesByUserId(@Param("userId") Long userId);

    // Đếm số lượng tin nhắn chưa đọc
    @Query("SELECT COUNT(m) FROM Message m " +
           "JOIN ConversationParticipant cp ON cp.conversation.id = m.conversation.id " +
           "WHERE cp.user.id = :userId AND m.sender.id != :userId AND m.isRead = false")
    Long countUnreadMessages(@Param("userId") Long userId);

    // Đánh dấu đã đọc tất cả tin nhắn từ người gửi cho người nhận
    // @Modifying
    // @Transactional
    // @Query("UPDATE Message m SET m.isRead = true WHERE m.sender.id = :senderId AND m.receiver.id = :receiverId AND m.isRead = false")
    // void markMessagesAsRead(@Param("senderId") Long senderId, @Param("receiverId") Long receiverId);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId ORDER BY m.createdAt ASC")
    List<Message> findByConversationId(@Param("conversationId") Long conversationId);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId ORDER BY m.createdAt DESC")
    List<Message> findByConversationIdWithPagination(@Param("conversationId") Long conversationId, Pageable pageable);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.conversation.id = :conversationId AND m.sender.id != :userId AND m.isRead = false")
    Long countUnreadMessagesInConversation(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Modifying
    @Transactional
    @Query("UPDATE Message m SET m.isRead = true WHERE m.conversation.id = :conversationId AND m.sender.id != :userId AND m.isRead = false")
    void markMessagesAsReadInConversation(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId " +
           "AND m.sender.id = :senderId " +
           "AND m.content = :content " +
           "AND m.createdAt > :timestamp " +
           "ORDER BY m.createdAt DESC")
    List<Message> findRecentMessagesByConversationAndSender(
        @Param("conversationId") Long conversationId,
        @Param("senderId") Long senderId,
        @Param("content") String content,
        @Param("timestamp") LocalDateTime timestamp
    );
}