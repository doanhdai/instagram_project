package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.ConversationParticipant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationParticipantRepository extends JpaRepository<ConversationParticipant, Long> {

    /**
     * Join fetch user để tránh N+1 khi map ParticipantDTO.
     */
    @Query("SELECT cp FROM ConversationParticipant cp JOIN FETCH cp.user WHERE cp.conversation.id = :conversationId")
    List<ConversationParticipant> findByConversationId(@Param("conversationId") Long conversationId);

    /**
     * Join fetch conversation + user để tránh lazy load trong các vòng lặp.
     */
    @Query("SELECT cp FROM ConversationParticipant cp JOIN FETCH cp.conversation JOIN FETCH cp.user WHERE cp.user.id = :userId")
    List<ConversationParticipant> findByUserId(@Param("userId") Long userId);

    /**
     * Dùng cho sendMessage: cần cả conversation và user trong 1 query.
     */
    @Query("SELECT cp FROM ConversationParticipant cp JOIN FETCH cp.conversation JOIN FETCH cp.user WHERE cp.conversation.id = :conversationId")
    List<ConversationParticipant> findWithConversationAndUsersByConversationId(
            @Param("conversationId") Long conversationId);

    @Query("SELECT cp.user.id FROM ConversationParticipant cp WHERE cp.conversation.id = :conversationId")
    List<Long> findUserIdsByConversationId(@Param("conversationId") Long conversationId);

    @Query("SELECT CASE WHEN COUNT(cp) > 0 THEN true ELSE false END FROM ConversationParticipant cp " +
            "WHERE cp.conversation.id = :conversationId AND cp.user.id = :userId")
    boolean existsByConversationIdAndUserId(@Param("conversationId") Long conversationId,
            @Param("userId") Long userId);

    @Query("SELECT cp FROM ConversationParticipant cp WHERE cp.conversation.id = :conversationId AND cp.user.id = :userId")
    Optional<ConversationParticipant> findByConversationIdAndUserId(@Param("conversationId") Long conversationId,
            @Param("userId") Long userId);
}
