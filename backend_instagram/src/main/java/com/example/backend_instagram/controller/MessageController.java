package com.example.backend_instagram.controller;

import com.example.backend_instagram.dto.message.MessageDTO;
import com.example.backend_instagram.dto.message.MessageResponseDTO;
import com.example.backend_instagram.dto.user.RestResponse; // Đã sửa đường dẫn import
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.service.MessageService;
import com.example.backend_instagram.utils.constant.ApiMessage;
import com.example.backend_instagram.utils.error.IdInvalidException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/v1/messages")
public class MessageController {
    
    @Autowired
    private MessageService messageService;
    
    @PostMapping
    @ApiMessage("Gửi tin nhắn thành công")
    public ResponseEntity<MessageResponseDTO> sendMessage(@RequestBody MessageDTO messageDTO) throws IdInvalidException {
        MessageResponseDTO message = messageService.sendMessage(messageDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }
    
    @GetMapping("/conversation/{user1Id}/{user2Id}")
    @ApiMessage("Lấy cuộc trò chuyện thành công")
    public ResponseEntity<List<MessageResponseDTO>> getConversation(
            @PathVariable Long user1Id,
            @PathVariable Long user2Id) throws IdInvalidException {
        
        List<MessageResponseDTO> messages = messageService.getConversation(user1Id, user2Id);
        return ResponseEntity.ok(messages);
    }
    
    @GetMapping("/contacts/{userId}")
    @ApiMessage("Lấy danh sách liên hệ thành công")
    public ResponseEntity<List<User>> getContacts(@PathVariable Long userId) throws IdInvalidException {
        List<User> contacts = messageService.getContacts(userId);
        return ResponseEntity.ok(contacts);
    }
    
    @GetMapping("/latest/{userId}")
    @ApiMessage("Lấy tin nhắn mới nhất thành công")
    public ResponseEntity<List<MessageResponseDTO>> getLatestMessages(@PathVariable Long userId) throws IdInvalidException {
        List<MessageResponseDTO> messages = messageService.getLatestMessages(userId);
        return ResponseEntity.ok(messages);
    }
    
    @GetMapping("/unread/count/{userId}")
    @ApiMessage("Đếm tin nhắn chưa đọc thành công")
    public ResponseEntity<Long> countUnreadMessages(@PathVariable Long userId) throws IdInvalidException {
        Long count = messageService.countUnreadMessages(userId);
        return ResponseEntity.ok(count);
    }
}