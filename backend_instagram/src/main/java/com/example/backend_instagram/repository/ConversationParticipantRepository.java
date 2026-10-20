package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.ConversationParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationParticipantRepository extends JpaRepository<ConversationParticipant, Long> {

    @Query("SELECT cp FROM ConversationParticipant cp WHERE cp.conversation.id = :conversationId")
    List<ConversationParticipant> findByConversationId(@Param("conversationId") Long conversationId);

    @Query("SELECT cp FROM ConversationParticipant cp WHERE cp.user.id = :userId")
    List<ConversationParticipant> findByUserId(@Param("userId") Long userId);

    @Query("SELECT CASE WHEN COUNT(cp) > 0 THEN true ELSE false END FROM ConversationParticipant cp " +
            "WHERE cp.conversation.id = :conversationId AND cp.user.id = :userId")
    boolean existsByConversationIdAndUserId(@Param("conversationId") Long conversationId,
            @Param("userId") Long userId);

    @Query("SELECT cp FROM ConversationParticipant cp WHERE cp.conversation.id = :conversationId AND cp.user.id = :userId")
    Optional<ConversationParticipant> findByConversationIdAndUserId(@Param("conversationId") Long conversationId,
            @Param("userId") Long userId);
}