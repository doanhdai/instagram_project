package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.Follow;
import com.example.backend_instagram.entity.FollowId;
import com.example.backend_instagram.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FollowRepository extends JpaRepository<Follow, FollowId> {
    // List<Follow> findByFollower(User follower);
    List<Follow> findByFollowerId(Long userId);
    List<Follow> findByFollowingId(Long userId);
    Optional<Follow> findByFollowerAndFollowing(User follower, User following);

    long countByFollowingId(Long userId);

    long countByFollowerId(Long userId);

}
