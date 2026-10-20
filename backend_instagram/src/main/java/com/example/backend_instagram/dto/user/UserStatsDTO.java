package com.example.backend_instagram.dto.user;

import com.example.backend_instagram.entity.User;
import lombok.Data;

@Data
public class UserStatsDTO {
    private Long userId;
    private String username;
    private String userNickname;
    private String avatar;
    private String bio;
    private Long followersCount;
    private Long followingCount;
    private Long postsCount;

    public static UserStatsDTO from(User user, Long followersCount, Long followingCount, Long postsCount) {
        UserStatsDTO dto = new UserStatsDTO();
        dto.setUserId(user.getId());
        dto.setUsername(user.getUserNickname());
        dto.setUserNickname(user.getUserNickname());
        dto.setAvatar(user.getUserImage());
        dto.setBio(user.getUserBio());
        dto.setFollowersCount(followersCount);
        dto.setFollowingCount(followingCount);
        dto.setPostsCount(postsCount);
        return dto;
    }
}
