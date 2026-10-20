package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.message.MessageDTO;
import com.example.backend_instagram.dto.message.MessageResponseDTO;
import com.example.backend_instagram.dto.message.ReadReceiptDTO;
import com.example.backend_instagram.entity.Conversation;
import com.example.backend_instagram.entity.ConversationParticipant;
import com.example.backend_instagram.entity.Follow;
import com.example.backend_instagram.entity.Message;
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.event.MessageCreatedEvent;
import com.example.backend_instagram.repository.ConversationParticipantRepository;
import com.example.backend_instagram.repository.ConversationRepository;
import com.example.backend_instagram.repository.FollowRepository;
import com.example.backend_instagram.repository.MessageRepository;
import com.example.backend_instagram.repository.UserRepository;
import com.example.backend_instagram.utils.error.IdInvalidException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final FollowRepository followRepository;
    private final ChatRealtimePublisher realtimePublisher;
    private final ApplicationEventPublisher eventPublisher;

    public MessageService(MessageRepository messageRepository,
            UserRepository userRepository,
            ConversationRepository conversationRepository,
            ConversationParticipantRepository participantRepository,
            FollowRepository followRepository,
            ChatRealtimePublisher realtimePublisher,
            ApplicationEventPublisher eventPublisher) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.followRepository = followRepository;
        this.realtimePublisher = realtimePublisher;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Giữ chữ ký cũ cho REST controller. senderId phải được controller lấy từ
     * JWT, không lấy trực tiếp từ body.
     */
    @Transactional(rollbackFor = Exception.class)
    public MessageResponseDTO sendMessage(MessageDTO messageDTO) throws IdInvalidException {
        if (messageDTO == null) {
            throw new IdInvalidException("Message payload is required");
        }
        return sendMessage(messageDTO.getConversationId(), messageDTO.getSenderId(),
                messageDTO.getContent());
    }

    /**
     * Một write path duy nhất cho cả REST và STOMP.
     */
    @Transactional(rollbackFor = Exception.class)
    public MessageResponseDTO sendMessage(Long conversationId, Long senderId, String content)
            throws IdInvalidException {
        if (conversationId == null || senderId == null) {
            throw new IdInvalidException("conversationId và senderId là bắt buộc");
        }
        if (content == null || content.isBlank()) {
            throw new IdInvalidException("Nội dung tin nhắn không được để trống");
        }

        // 1 query: lấy participants + user + conversation.
        List<ConversationParticipant> participants = participantRepository
                .findWithConversationAndUsersByConversationId(conversationId);
        if (participants.isEmpty()) {
            throw new IdInvalidException("Cuộc trò chuyện không tồn tại");
        }

        ConversationParticipant senderParticipant = participants.stream()
                .filter(cp -> cp.getUser().getId().equals(senderId))
                .findFirst()
                .orElseThrow(() -> new IdInvalidException("Người gửi không phải thành viên của cuộc trò chuyện"));

        User sender = senderParticipant.getUser();
        Conversation conversation = senderParticipant.getConversation();

        if (Boolean.FALSE.equals(conversation.getIsGroupChat()) && participants.size() == 2) {
            Long otherUserId = participants.stream()
                    .map(cp -> cp.getUser().getId())
                    .filter(id -> !id.equals(senderId))
                    .findFirst()
                    .orElse(null);

            if (otherUserId != null) {
                // 1 query cho cả 2 chiều follow.
                List<Follow> relations = followRepository.findBetweenUsers(senderId, otherUserId);
                boolean isFriend = relations.size() == 2
                        && relations.stream().allMatch(f -> Boolean.TRUE.equals(f.getFriend()));
                boolean isBlocking = relations.stream().anyMatch(Follow::isBlocking);

                if (!isFriend) {
                    throw new IdInvalidException("Hai người không còn là bạn bè, không thể gửi tin nhắn");
                }
                if (isBlocking) {
                    throw new IdInvalidException("Một trong hai người đã chặn, không thể gửi tin nhắn");
                }
            }
        }

        Message message = new Message();
        message.setSender(sender);
        message.setConversation(conversation);
        message.setContent(content);
        message.setRead(false);

        Message savedMessage = messageRepository.save(message);
        conversationRepository.touch(conversationId, savedMessage.getCreatedAt());

        MessageResponseDTO responseDTO = toMessageResponseDTO(savedMessage, sender);
        Set<Long> participantIds = participants.stream()
                .map(cp -> cp.getUser().getId())
                .collect(Collectors.toSet());

        // Listener chạy AFTER_COMMIT: không gửi tin nhắn trước khi DB commit.
        eventPublisher.publishEvent(new MessageCreatedEvent(responseDTO, participantIds));

        if (log.isDebugEnabled()) {
            log.debug("Message {} saved for conversation {}", savedMessage.getId(), conversationId);
        }
        return responseDTO;
    }

    /**
     * Lấy cuộc trò chuyện giữa 2 người dùng.
     */
    @Transactional
    public List<MessageResponseDTO> getConversation(Long user1Id, Long user2Id) throws IdInvalidException {
        if (!userRepository.existsById(user1Id)) {
            throw new IdInvalidException("Người dùng 1 không tồn tại");
        }
        if (!userRepository.existsById(user2Id)) {
            throw new IdInvalidException("Người dùng 2 không tồn tại");
        }

        Conversation conversation = conversationRepository.findConversationBetweenUsers(user1Id, user2Id)
                .orElseThrow(() -> new IdInvalidException("Cuộc trò chuyện không tồn tại"));

        List<Message> messages = messageRepository.findByConversationId(conversation.getId());
        messageRepository.markMessagesAsReadInConversation(conversation.getId(), user1Id);

        return messages.stream()
                .map(this::convertToMessageResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Đánh dấu đã đọc. userId lấy từ Principal của STOMP, không từ client.
     */
    @Transactional
    public void markMessagesAsRead(Long conversationId, Long userId) throws IdInvalidException {
        if (conversationId == null || userId == null) {
            throw new IdInvalidException("conversationId và userId là bắt buộc");
        }
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, userId)) {
            throw new IdInvalidException("Người dùng không trong cuộc trò chuyện này");
        }

        messageRepository.markMessagesAsReadInConversation(conversationId, userId);

        ReadReceiptDTO receipt = new ReadReceiptDTO(conversationId, userId);
        participantRepository.findUserIdsByConversationId(conversationId).stream()
                .filter(participantId -> !participantId.equals(userId))
                .forEach(participantId -> realtimePublisher.sendReadReceipt(participantId, receipt));
    }

    /**
     * Lấy danh sách người liên hệ của user.
     */
    public List<User> getContacts(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }

        List<Long> conversationIds = participantRepository.findByUserId(userId).stream()
                .map(cp -> cp.getConversation().getId())
                .collect(Collectors.toList());

        if (conversationIds.isEmpty()) {
            return new ArrayList<>();
        }

        Set<User> contacts = new HashSet<>();
        for (Long conversationId : conversationIds) {
            participantRepository.findByConversationId(conversationId).stream()
                    .map(ConversationParticipant::getUser)
                    .filter(user -> !user.getId().equals(userId))
                    .forEach(contacts::add);
        }

        return new ArrayList<>(contacts);
    }

    /**
     * Lấy danh sách tin nhắn mới nhất cho mỗi cuộc trò chuyện.
     */
    @Transactional(readOnly = true)
    public List<MessageResponseDTO> getLatestMessages(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }

        return messageRepository.findLatestMessagesByUserId(userId).stream()
                .map(this::convertToMessageResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Đếm số lượng tin nhắn chưa đọc.
     */
    public Long countUnreadMessages(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }
        return messageRepository.countUnreadMessages(userId);
    }

    /**
     * Đánh dấu đã đọc tất cả tin nhắn từ người gửi cho người nhận.
     */
    @Transactional
    public void markMessagesAsReadBySender(Long senderId, Long receiverId) throws IdInvalidException {
        if (!userRepository.existsById(senderId)) {
            throw new IdInvalidException("Người gửi không tồn tại");
        }
        if (!userRepository.existsById(receiverId)) {
            throw new IdInvalidException("Người nhận không tồn tại");
        }

        Conversation conversation = conversationRepository.findConversationBetweenUsers(senderId, receiverId)
                .orElseThrow(() -> new IdInvalidException("Cuộc trò chuyện không tồn tại"));

        messageRepository.markMessagesAsReadInConversation(conversation.getId(), receiverId);
    }

    /**
     * Chuyển entity sang DTO. Không còn query participants cho từng message.
     */
    public MessageResponseDTO convertToMessageResponseDTO(Message message) {
        return toMessageResponseDTO(message, message.getSender());
    }

    private MessageResponseDTO toMessageResponseDTO(Message message, User sender) {
        MessageResponseDTO dto = new MessageResponseDTO();
        dto.setId(message.getId());
        dto.setConversationId(message.getConversation().getId());
        dto.setSenderId(sender.getId());
        dto.setContent(message.getContent());
        dto.setCreatedAt(message.getCreatedAt());
        dto.setIsRead(message.isRead());
        dto.setSenderName(sender.getUserFullname());
        dto.setSenderAvatar(sender.getUserImage());
        return dto;
    }

}
