package com.example.backend_instagram.utils.constant;

/**
 * Tên các cache dùng chung giữa service (annotation) và cấu hình RedisCacheManager.
 * Giữ tập trung ở một nơi để tránh gõ sai tên cache khi evict.
 */
public final class CacheNames {

    public static final String POSTS = "posts";
    public static final String COMMENTS = "comments";
    public static final String USER_STATS = "userStats";

    private CacheNames() {
    }
}
