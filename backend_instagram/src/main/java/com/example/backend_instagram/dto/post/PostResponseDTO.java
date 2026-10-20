package com.example.backend_instagram.dto.post;

import com.example.backend_instagram.entity.Media;
import com.example.backend_instagram.entity.Post;
import com.example.backend_instagram.entity.User;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về cho danh sách bài viết. Dùng DTO thay vì entity để:
 * - An toàn khi cache trong Redis (không kéo theo lazy collection/proxy của Hibernate)
 * - Không vô tình trả về các trường nhạy cảm của User (mật khẩu, refresh token)
 */
@Data
public class PostResponseDTO {

    private Long id;
    private String title;
    private String status;
    private String access;
    private Integer likesCount;
    private Long commentsCount;
    private LocalDateTime createdAt;
    private Author user;
    private List<MediaItem> media;

    public static PostResponseDTO from(Post post) {
        PostResponseDTO dto = new PostResponseDTO();
        dto.setId(post.getId());
        dto.setTitle(post.getTitle());
        dto.setStatus(post.getStatus());
        dto.setAccess(post.getAccess());
        dto.setLikesCount(post.getLikesCount());
        dto.setCommentsCount(post.getCommentsCount());
        dto.setCreatedAt(post.getCreatedAt());
        dto.setUser(Author.from(post.getUser()));
        dto.setMedia(post.getMedia() == null
                ? List.of()
                : post.getMedia().stream().map(MediaItem::from).toList());
        return dto;
    }

    @Data
    public static class Author {
        private Long id;
        private String userNickname;
        private String userFullname;
        private String userImage;
        private String userBday;
        private String userEmail;
        private String userPhone;
        private String userGender;
        private String userBio;

        static Author from(User user) {
            if (user == null) {
                return null;
            }
            Author author = new Author();
            author.setId(user.getId());
            author.setUserNickname(user.getUserNickname());
            author.setUserFullname(user.getUserFullname());
            author.setUserImage(user.getUserImage());
            author.setUserBday(user.getUserBday());
            author.setUserEmail(user.getUserEmail());
            author.setUserPhone(user.getUserPhone());
            author.setUserGender(user.getUserGender());
            author.setUserBio(user.getUserBio());
            return author;
        }
    }

    @Data
    public static class MediaItem {
        private Long id;
        private String url;
        private String type;
        private LocalDateTime createdAt;

        static MediaItem from(Media media) {
            MediaItem item = new MediaItem();
            item.setId(media.getId());
            item.setUrl(media.getUrl());
            item.setType(media.getType());
            item.setCreatedAt(media.getCreatedAt());
            return item;
        }
    }
}
