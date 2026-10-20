package com.example.backend_instagram.config;

import com.example.backend_instagram.dto.comment.CommentDTO;
import com.example.backend_instagram.dto.post.PostResponseDTO;
import com.example.backend_instagram.dto.user.UserStatsDTO;
import com.example.backend_instagram.utils.constant.CacheNames;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Cấu hình Redis cache cho các truy vấn đọc nhiều.
 *
 * <p>Mỗi cache dùng serializer có kiểu cụ thể (không bật default typing) để:
 * dễ đọc khi debug bằng redis-cli, không phụ thuộc tên class trong dữ liệu cache
 * và tránh lỗi deserialize với collection.</p>
 *
 * <p>TTL được cấu hình riêng cho từng cache và có thể override qua biến môi trường.</p>
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis", matchIfMissing = true)
public class CacheConfig {

    private static final String KEY_PREFIX = "instagram:";

    @Bean
    public RedisCacheManager cacheManager(
            RedisConnectionFactory connectionFactory,
            @Value("${app.cache.ttl.posts:60}") long postsTtlSeconds,
            @Value("${app.cache.ttl.comments:60}") long commentsTtlSeconds,
            @Value("${app.cache.ttl.user-stats:120}") long userStatsTtlSeconds) {

        JsonMapper jsonMapper = JsonMapper.builder().build();

        JavaType postListType = jsonMapper.getTypeFactory()
                .constructCollectionType(List.class, PostResponseDTO.class);
        JavaType commentListType = jsonMapper.getTypeFactory()
                .constructCollectionType(List.class, CommentDTO.class);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .prefixCacheNameWith(KEY_PREFIX)
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigurations = Map.of(
                CacheNames.POSTS, withTtl(base, jsonMapper, postListType, postsTtlSeconds),
                CacheNames.COMMENTS, withTtl(base, jsonMapper, commentListType, commentsTtlSeconds),
                CacheNames.USER_STATS, withTtl(base, jsonMapper, UserStatsDTO.class, userStatsTtlSeconds));

        RedisCacheConfiguration defaults = withTtl(base, jsonMapper, postListType, postsTtlSeconds);

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaults)
                .withInitialCacheConfigurations(cacheConfigurations)
                .build();
    }

    private RedisCacheConfiguration withTtl(RedisCacheConfiguration base,
            JsonMapper jsonMapper, Class<?> valueType, long ttlSeconds) {
        return withTtl(base, jsonMapper, jsonMapper.constructType(valueType), ttlSeconds);
    }

    private RedisCacheConfiguration withTtl(RedisCacheConfiguration base,
            JsonMapper jsonMapper, JavaType valueType, long ttlSeconds) {
        JacksonJsonRedisSerializer<Object> serializer =
                new JacksonJsonRedisSerializer<>(jsonMapper, valueType);
        return base
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(serializer))
                .entryTtl(Duration.ofSeconds(ttlSeconds));
    }
}
