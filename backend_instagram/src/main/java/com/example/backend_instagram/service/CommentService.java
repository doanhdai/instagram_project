package com.example.backend_instagram.service;

import com.example.backend_instagram.dto.comment.CommentDTO;
import com.example.backend_instagram.entity.Comment;
import com.example.backend_instagram.entity.Post;
import com.example.backend_instagram.entity.User;
import com.example.backend_instagram.repository.CommentRepository;
import com.example.backend_instagram.repository.PostRepository;
import com.example.backend_instagram.utils.constant.CacheNames;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {
    private static final Logger logger = LoggerFactory.getLogger(CommentService.class);

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final NotificationWebSocketService notificationWebSocketService;
    private final ObjectMapper objectMapper;

    public CommentService(CommentRepository commentRepository,
            PostRepository postRepository,
            UserService userService,
            NotificationService notificationService,
            NotificationWebSocketService notificationWebSocketService) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.userService = userService;
        this.notificationService = notificationService;
        this.notificationWebSocketService = notificationWebSocketService;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = CacheNames.COMMENTS, key = "#postId"),
            @CacheEvict(cacheNames = CacheNames.POSTS, allEntries = true)
    })
    public void addComment(Long postId, Long userId, String content) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Bài viết không tồn tại"));
        User user = userService.fetchUserById(userId);

        Comment comment = new Comment();
        comment.setContent(content);
        comment.setUser(user);
        comment.setPost(post);
        commentRepository.save(comment);
        post.setCommentsCount(post.getCommentsCount() + 1);
        postRepository.save(post);
        // Gửi thông báo bình luận qua STOMP
        notificationService.createCommentNotification(postId, userId, content);

        // Tính số lượng bình luận của bài viết
        Long commentsCount = commentRepository.countByPost(post);

        // Phát sự kiện comment_update qua STOMP
        try {
            CommentDTO commentDTO = toDTO(comment);
            commentDTO.setCommentsCount(commentsCount);
            String message = "New comment on post " + postId + ": " + truncateComment(content, 30);
            logger.info("Broadcast comment update via STOMP: postId={}, commentId={}, content={}",
                    postId, comment.getId(), content);
        } catch (Exception e) {
            logger.error("Error broadcasting comment update: {}", e.getMessage(), e);
        }
    }

    @Cacheable(cacheNames = CacheNames.COMMENTS, key = "#postId")
    public List<CommentDTO> getCommentsByPostId(Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Bài viết không tồn tại"));
        List<CommentDTO> comments = commentRepository.findByPostOrderByCreatedAtDesc(post)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        // Thêm commentsCount vào mỗi CommentDTO
        Long commentsCount = commentRepository.countByPost(post);
        comments.forEach(comment -> comment.setCommentsCount(commentsCount));
        return comments;
    }

    private CommentDTO toDTO(Comment comment) {
        CommentDTO dto = new CommentDTO();
        dto.setId(comment.getId());
        dto.setUserId(comment.getUser().getId());
        dto.setUserNickname(comment.getUser().getUserNickname());
        dto.setUserImage(comment.getUser().getUserImage());
        dto.setPostId(comment.getPost().getId());
        dto.setContent(comment.getContent());
        dto.setCreatedAt(comment.getCreatedAt());
        dto.setMessage(comment.getUser().getUserNickname() + " commented: " + truncateComment(comment.getContent(), 50));
        return dto;
    }

    private String truncateComment(String comment, int maxLength) {
        if (comment == null || comment.length() <= maxLength) {
            return comment;
        }
        return comment.substring(0, maxLength - 3) + "...";
    }
}