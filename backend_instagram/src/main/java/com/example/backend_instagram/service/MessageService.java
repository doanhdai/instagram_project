package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.message.MessageDTO;
import com.example.backend_instagram.dto.message.MessageResponseDTO;
import com.example.backend_instagram.dto.message.ParticipantDTO;
import com.example.backend_instagram.entity.Conversation;
import com.example.backend_instagram.entity.Message;
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.entity.Follow;
import com.example.backend_instagram.entity.ConversationParticipant;
import com.example.backend_instagram.repository.ConversationRepository;
import com.example.backend_instagram.repository.MessageRepository;
import com.example.backend_instagram.repository.UserRepository;
import com.example.backend_instagram.repository.ConversationParticipantRepository;
import com.example.backend_instagram.repository.FollowRepository;
import com.example.backend_instagram.utils.error.IdInvalidException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.stream.Collectors;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.Optional;

@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationParticipantRepository participantRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private FollowRepository followRepository; 

    /**
     * Gửi tin nhắn mới
     */
    @Transactional(rollbackFor = Exception.class)
    public MessageResponseDTO sendMessage(MessageDTO messageDTO) throws IdInvalidException {
        try {
            log.info("Sending message: {}", messageDTO);

            Optional<ConversationParticipant> participantOpt = participantRepository.findByConversationIdAndUserId(
                    messageDTO.getConversationId(), messageDTO.getSenderId());
            if (participantOpt.isEmpty()) {
                throw new IdInvalidException("User not in conversation");
            }
            User sender = participantOpt.get().getUser();

            Conversation conversation = conversationRepository.findById(messageDTO.getConversationId())
                    .orElseThrow(() -> new IdInvalidException("Conversation not found"));

            if (Boolean.FALSE.equals(conversation.getIsGroupChat())) {
                List<ConversationParticipant> participants = participantRepository
                        .findByConversationId(conversation.getId());
                if (participants.size() == 2) {
                    Long otherUserId = participants.stream()
                            .map(cp -> cp.getUser().getId())
                            .filter(id -> !id.equals(messageDTO.getSenderId()))
                            .findFirst().orElse(null);

                    if (otherUserId != null) {
                        // Lấy User còn lại từ participant (không dùng userRepository)
                        User otherUser = participants.stream()
                                .map(ConversationParticipant::getUser)
                                .filter(u -> u.getId().equals(otherUserId))
                                .findFirst().orElse(null);

                        if (otherUser == null)
                            throw new IdInvalidException("User not found");

                        Optional<Follow> followOpt = followRepository.findByFollowerAndFollowing(sender, otherUser);
                        Optional<Follow> reverseFollowOpt = followRepository.findByFollowerAndFollowing(otherUser,
                                sender);

                        boolean isFriend = followOpt.map(Follow::getFriend).orElse(false)
                                && reverseFollowOpt.map(Follow::getFriend).orElse(false);
                        boolean isBlocking = followOpt.map(Follow::isBlocking).orElse(false)
                                || reverseFollowOpt.map(Follow::isBlocking).orElse(false);

                        if (!isFriend) {
                            throw new IdInvalidException("Hai người không còn là bạn bè, không thể gửi tin nhắn");
                        }
                        if (isBlocking) {
                            throw new IdInvalidException("Một trong hai người đã chặn, không thể gửi tin nhắn");
                        }
                    }
                }
            }

            Message message = new Message();
            message.setSender(sender);
            message.setConversation(conversation);
            message.setContent(messageDTO.getContent());
            message.setRead(false);

            Message savedMessage = messageRepository.save(message);
            log.info("Message saved: {}", savedMessage);

            conversation.setUpdatedAt(savedMessage.getCreatedAt());
            conversationRepository.save(conversation);

            MessageResponseDTO responseDTO = convertToMessageResponseDTO(savedMessage);
            messagingTemplate.convertAndSend(
                    "/topic/conversation." + conversation.getId(),
                    responseDTO);

            log.info("Message sent to WebSocket");
            return responseDTO;

        } catch (Exception e) {
            log.error("Error sending message: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Lấy cuộc trò chuyện giữa 2 người dùng
     */
    @Transactional
    public List<MessageResponseDTO> getConversation(Long user1Id, Long user2Id) throws IdInvalidException {
        if (!userRepository.existsById(user1Id)) {
            throw new IdInvalidException("Người dùng 1 không tồn tại");
        }

        if (!userRepository.existsById(user2Id)) {
            throw new IdInvalidException("Người dùng 2 không tồn tại");
        }

        // Tìm hoặc tạo conversation
        Conversation conversation = conversationRepository.findConversationBetweenUsers(user1Id, user2Id)
                .orElseThrow(() -> new IdInvalidException("Cuộc trò chuyện không tồn tại"));

        List<Message> messages = messageRepository.findByConversationId(conversation.getId());

        // Đánh dấu đã đọc tin nhắn
        messageRepository.markMessagesAsReadInConversation(conversation.getId(), user1Id);

        return messages.stream()
                .map(this::convertToMessageResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Đánh dấu đã đọc tất cả tin nhắn trong cuộc trò chuyện
     */
    @Transactional
    public void markMessagesAsRead(Long conversationId, Long userId) throws IdInvalidException {
        // Validate inputs
        if (!conversationRepository.existsById(conversationId)) {
            throw new IdInvalidException("Conversation doesn't exist");
        }
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("User doesn't exist");
        }

        messageRepository.markMessagesAsReadInConversation(conversationId, userId);

        messagingTemplate.convertAndSend(
                "/topic/conversation." + conversationId + ".read",
                userId);
    }

    /**
     * Lấy danh sách người liên hệ của user
     */
    public List<User> getContacts(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }

        // Lấy tất cả ID của các cuộc trò chuyện mà người dùng tham gia
        List<Long> conversationIds = participantRepository.findByUserId(userId)
                .stream()
                .map(cp -> cp.getConversation().getId())
                .collect(Collectors.toList());

        if (conversationIds.isEmpty()) {
            return new ArrayList<>();
        }

        Set<User> contacts = new HashSet<>();
        for (Long convId : conversationIds) {
            participantRepository.findByConversationId(convId)
                    .stream()
                    .map(ConversationParticipant::getUser)
                    .filter(user -> !user.getId().equals(userId))
                    .forEach(contacts::add);
        }

        return new ArrayList<>(contacts);
    }

    /**
     * Lấy danh sách tin nhắn mới nhất cho mỗi cuộc trò chuyện
     */
    public List<MessageResponseDTO> getLatestMessages(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }

        List<Message> latestMessages = messageRepository.findLatestMessagesByUserId(userId);

        return latestMessages.stream()
                .map(this::convertToMessageResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Đếm số lượng tin nhắn chưa đọc
     */
    public Long countUnreadMessages(Long userId) throws IdInvalidException {
        if (!userRepository.existsById(userId)) {
            throw new IdInvalidException("Người dùng không tồn tại");
        }

        return messageRepository.countUnreadMessages(userId);
    }

    /**
     * Đánh dấu đã đọc tất cả tin nhắn từ người gửi cho người nhận
     * 
     * @param senderId   ID của người gửi tin nhắn
     * @param receiverId ID của người nhận tin nhắn
     */
    @Transactional
    public void markMessagesAsReadBySender(Long senderId, Long receiverId) throws IdInvalidException {
        // Kiểm tra người gửi và người nhận có tồn tại không
        if (!userRepository.existsById(senderId)) {
            throw new IdInvalidException("Người gửi không tồn tại");
        }

        if (!userRepository.existsById(receiverId)) {
            throw new IdInvalidException("Người nhận không tồn tại");
        }

        // Tìm cuộc trò chuyện giữa hai người dùng
        Conversation conversation = conversationRepository.findConversationBetweenUsers(senderId, receiverId)
                .orElseThrow(() -> new IdInvalidException("Cuộc trò chuyện không tồn tại"));

        // Đánh dấu tin nhắn đã đọc trong cuộc trò chuyện này
        messageRepository.markMessagesAsReadInConversation(conversation.getId(), receiverId);
    }

    /**
     * Chuyển đổi từ Entity sang DTO
     * Phương thức public để ChatService có thể sử dụng
     */
    public MessageResponseDTO convertToMessageResponseDTO(Message message) {
        MessageResponseDTO dto = new MessageResponseDTO();
        dto.setId(message.getId());
        dto.setConversationId(message.getConversation().getId());
        dto.setSenderId(message.getSender().getId());
        dto.setContent(message.getContent());
        dto.setCreatedAt(message.getCreatedAt());
        dto.setIsRead(message.isRead());

        // Thêm thông tin người gửi
        User sender = message.getSender();
        dto.setSenderName(sender.getUserFullname());
        dto.setSenderAvatar(sender.getUserImage());

        // Thêm danh sách participants nếu cần
        if (message.getConversation() != null) {
            List<ConversationParticipant> participants = participantRepository
                    .findByConversationId(message.getConversation().getId());

            List<ParticipantDTO> participantDTOs = participants.stream()
                    .map(this::convertToParticipantDTO)
                    .collect(Collectors.toList());

            dto.setParticipants(participantDTOs);
        }

        return dto;
    }

    /**
     * Chuyển đổi từ ConversationParticipant sang ParticipantDTO
     */
    private ParticipantDTO convertToParticipantDTO(ConversationParticipant participant) {
        ParticipantDTO dto = new ParticipantDTO();
        dto.setId(participant.getId()); // ID của participant
        dto.setUserId(participant.getUser().getId()); // ID của user
        dto.setUserFullname(participant.getUser().getUserFullname());
        dto.setUserNickname(participant.getUser().getUserNickname());
        dto.setUserImage(participant.getUser().getUserImage());
        return dto;
    }
}