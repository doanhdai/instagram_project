package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.Conversation;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query(value = "SELECT c.* FROM conversations c " +
           "JOIN conversation_participants cp1 ON c.id = cp1.conversation_id " +
           "JOIN conversation_participants cp2 ON c.id = cp2.conversation_id " +
           "WHERE c.is_group_chat = 0 " +
           "AND cp1.user_id = :userId AND cp2.user_id = :otherUserId " +
           "GROUP BY c.id", nativeQuery = true)
    Optional<Conversation> findConversationBetweenUsers(@Param("userId") Long userId,
                                                        @Param("otherUserId") Long otherUserId);

    @Query(value = "SELECT c.* FROM conversations c " +
           "JOIN conversation_participants cp ON c.id = cp.conversation_id " +
           "WHERE cp.user_id = :userId " +
           "ORDER BY c.updated_at DESC", nativeQuery = true)
    List<Conversation> findConversationsByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT c.* FROM conversations c " +
           "WHERE c.is_group_chat = 1 LIMIT 1", nativeQuery = true)
    Optional<Conversation> findFirstGroupConversation();

    /**
     * Cập nhật có chủ đích thay vì save() toàn bộ entity conversation.
     */
    @Modifying
    @Query("UPDATE Conversation c SET c.updatedAt = :updatedAt WHERE c.id = :conversationId")
    void touch(@Param("conversationId") Long conversationId,
            @Param("updatedAt") LocalDateTime updatedAt);
}
