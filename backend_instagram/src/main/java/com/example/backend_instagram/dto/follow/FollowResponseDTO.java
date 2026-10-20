package com.example.backend_instagram.dto.follow;

import com.example.backend_instagram.entity.Follow;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FollowResponseDTO {
    private Follow follow;
//    private Notification notification;

    public FollowResponseDTO(Follow follow) {
        this.follow = follow;
//        this.notification = notification;
    }
}
