package com.example.backend_instagram.repository;

import com.example.backend_instagram.entity.Follow;
import com.example.backend_instagram.entity.FollowId;
import com.example.backend_instagram.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FollowRepository extends JpaRepository<Follow, FollowId> {
    List<Follow> findByFollowerId(Long userId);
    List<Follow> findByFollowingId(Long userId);
    Optional<Follow> findByFollowerAndFollowing(User follower, User following);

    /**
     * Lấy cả 2 chiều follow trong 1 query thay vì 2 query riêng.
     */
    @Query("SELECT f FROM Follow f WHERE " +
           "(f.follower.id = :userA AND f.following.id = :userB) OR " +
           "(f.follower.id = :userB AND f.following.id = :userA)")
    List<Follow> findBetweenUsers(@Param("userA") Long userA, @Param("userB") Long userB);

    long countByFollowingId(Long userId);

    long countByFollowerId(Long userId);
}
