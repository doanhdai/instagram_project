package com.example.backend_instagram.config;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Xác thực JWT ngay ở frame STOMP CONNECT và chặn các destination không hợp lệ.
 *
 * <p>Spring Security không tự áp dụng oauth2ResourceServer cho STOMP CONNECT,
 * nên nếu chỉ permitAll("/ws/**") thì bất kỳ ai cũng có thể subscribe topic của
 * người khác. Interceptor này set Principal = userId để các handler và
 * convertAndSendToUser hoạt động đúng.</p>
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String USER_ID_SESSION_ATTRIBUTE = "stompUserId";
    private static final String USER_QUEUE_PREFIX = "/user/queue/";
    private static final String APP_PREFIX = "/app/";

    private final JwtDecoder jwtDecoder;

    public StompAuthChannelInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            authenticate(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(command)) {
            requireAuthenticated(accessor);
            requireAllowedSubscription(accessor);
        } else if (StompCommand.SEND.equals(command)) {
            requireAuthenticated(accessor);
            requireDestinationPrefix(accessor, APP_PREFIX);
        }

        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new MessagingException("Missing or invalid Authorization header");
        }

        String token = authorization.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            throw new MessagingException("Missing bearer token");
        }

        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(token);
        } catch (Exception ex) {
            throw new MessagingException("Invalid or expired access token", ex);
        }

        Long userId = extractUserId(jwt);
        if (userId == null) {
            throw new MessagingException("Access token does not contain a user id");
        }

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userId.toString(), null, List.of());
        accessor.setUser(authentication);

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null) {
            try {
                sessionAttributes.put(USER_ID_SESSION_ATTRIBUTE, userId.toString());
            } catch (UnsupportedOperationException ignored) {
                // Một số implementation trả về map immutable; khi đó Spring vẫn
                // giữ Principal trong session của STOMP.
            }
        }
    }

    private void requireAuthenticated(StompHeaderAccessor accessor) {
        if (currentUserId(accessor) == null) {
            throw new MessagingException("Unauthenticated STOMP session");
        }
    }

    private void requireDestinationPrefix(StompHeaderAccessor accessor, String prefix) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(prefix)) {
            throw new MessagingException("Destination not allowed: " + destination);
        }
    }

    /**
     * Cho phép /user/queue/** và dạng đã resolve /queue/...-user{sessionId}.
     * Chặn /topic/** và các /queue/** công khai.
     */
    private void requireAllowedSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessagingException("Subscription destination is required");
        }

        boolean rawUserQueue = destination.startsWith(USER_QUEUE_PREFIX);
        boolean resolvedUserQueue = destination.startsWith("/queue/") && destination.contains("-user");
        if (!rawUserQueue && !resolvedUserQueue) {
            throw new MessagingException("Subscription not allowed: " + destination);
        }
    }

    private String currentUserId(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            return accessor.getUser().getName();
        }
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes == null) {
            return null;
        }
        Object userId = sessionAttributes.get(USER_ID_SESSION_ATTRIBUTE);
        return userId == null ? null : userId.toString();
    }

    private Long extractUserId(Jwt jwt) {
        Object claim = jwt.getClaim("userId");
        Long userId = toLong(claim);
        if (userId != null) {
            return userId;
        }

        // Fallback cho token cũ chưa có claim userId.
        Map<String, Object> userClaim = jwt.getClaimAsMap("user");
        if (userClaim != null) {
            return toLong(userClaim.get("id"));
        }
        return null;
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
