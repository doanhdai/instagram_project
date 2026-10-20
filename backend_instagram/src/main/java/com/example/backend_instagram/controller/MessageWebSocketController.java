package com.example.backend_instagram.controller;

import com.example.backend_instagram.dto.message.MessageDTO;
import com.example.backend_instagram.dto.message.MessageResponseDTO;
import com.example.backend_instagram.dto.message.ParticipantDTO;
import com.example.backend_instagram.entity.ConversationParticipant;
import com.example.backend_instagram.service.MessageService;
import com.example.backend_instagram.utils.error.IdInvalidException;
import com.example.backend_instagram.repository.UserRepository;
import com.example.backend_instagram.repository.ConversationParticipantRepository;
import com.example.backend_instagram.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Controller
public class MessageWebSocketController {
    
    private static final Logger log = LoggerFactory.getLogger(MessageWebSocketController.class);
    
    @Autowired
    private MessageService messageService;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationParticipantRepository participantRepository;
    
    @MessageMapping("/chat/{conversationId}")
    @SendTo("/topic/conversation.{conversationId}")
    public MessageResponseDTO forwardMessage(@DestinationVariable Long conversationId, MessageDTO messageDTO) {
        try {
            // Đặt conversationId từ đường dẫn
            messageDTO.setConversationId(conversationId);
            
            // Tìm thông tin người gửi
            User sender = userRepository.findById(messageDTO.getSenderId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người gửi"));
            
            // Kiểm tra xem người gửi có tham gia vào cuộc trò chuyện này không
            boolean isParticipant = participantRepository.existsByConversationIdAndUserId(
                conversationId, messageDTO.getSenderId());
                
            if (!isParticipant) {
                throw new RuntimeException("Người gửi không phải thành viên của cuộc trò chuyện");
            }
            
            // Tạo DTO phản hồi với tất cả trường cần thiết
            MessageResponseDTO responseDTO = new MessageResponseDTO();
            // messageDTO không có id, nên không thể set
            // responseDTO.setId(messageDTO.getId());
            responseDTO.setConversationId(conversationId);
            responseDTO.setSenderId(messageDTO.getSenderId());
            responseDTO.setContent(messageDTO.getContent());
            responseDTO.setSenderName(sender.getUserFullname());
            responseDTO.setSenderAvatar(sender.getUserImage());
            responseDTO.setCreatedAt(LocalDateTime.now());
            responseDTO.setIsRead(false);
            
            // Lấy danh sách người tham gia
            List<ParticipantDTO> participants = participantRepository.findByConversationId(conversationId)
                .stream()
                .map(p -> {
                    ParticipantDTO pdto = new ParticipantDTO();
                    pdto.setId(p.getId());
                    pdto.setUserId(p.getUser().getId());
                    pdto.setUserFullname(p.getUser().getUserFullname());
                    pdto.setUserNickname(p.getUser().getUserNickname());
                    pdto.setUserImage(p.getUser().getUserImage());
                    return pdto;
                })
                .collect(Collectors.toList());
                
            responseDTO.setParticipants(participants);
            
            return responseDTO;
        } catch (Exception e) {
            log.error("Error forwarding message: {}", e.getMessage(), e);
            throw e;
        }
    }
    
    @MessageMapping("/chat/{conversationId}/read")
    public void markAsRead(@DestinationVariable Long conversationId, Long userId) {
        try {
            messageService.markMessagesAsRead(conversationId, userId);
        } catch (IdInvalidException e) {
            messagingTemplate.convertAndSend(
                "/topic/errors." + userId,
                e.getMessage()
            );
        }
    }
}