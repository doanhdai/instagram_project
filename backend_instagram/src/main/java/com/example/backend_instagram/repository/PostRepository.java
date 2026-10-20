package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByUserIdAndStatus(Long userId, String status);
    List<Post> findByStatus(String status);
    List<Post> findByUserId(Long userId);
    long countByUserId(Long userId);
    List<Post> findByUserIdInAndStatusAndAccess(List<Long> userIds, String status, String access);
}