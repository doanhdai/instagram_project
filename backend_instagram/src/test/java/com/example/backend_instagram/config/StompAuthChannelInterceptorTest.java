package com.example.backend_instagram.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class StompAuthChannelInterceptorTest {

    private JwtDecoder jwtDecoder;
    private StompAuthChannelInterceptor interceptor;
    private MessageChannel channel;

    @BeforeEach
    void setUp() {
        jwtDecoder = mock(JwtDecoder.class);
        interceptor = new StompAuthChannelInterceptor(jwtDecoder);
        channel = mock(MessageChannel.class);
    }

    @Test
    void connectWithUserIdClaimSetsPrincipal() {
        when(jwtDecoder.decode("valid-token")).thenReturn(jwt(42L, null));

        Message<?> result = interceptor.preSend(connectMessage("Bearer valid-token"), channel);

        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertThat(accessor).isNotNull();
        assertThat(accessor.getUser()).isNotNull();
        assertThat(accessor.getUser().getName()).isEqualTo("42");
    }

    @Test
    void connectFallsBackToLegacyUserClaim() {
        when(jwtDecoder.decode("legacy-token")).thenReturn(jwt(null, Map.of("id", 7)));

        Message<?> result = interceptor.preSend(connectMessage("Bearer legacy-token"), channel);

        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertThat(accessor.getUser().getName()).isEqualTo("7");
    }

    @Test
    void connectWithoutTokenIsRejected() {
        assertThatThrownBy(() -> interceptor.preSend(connectMessage(null), channel))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("Authorization");
    }

    @Test
    void subscribeToPublicTopicIsRejected() {
        assertThatThrownBy(() -> interceptor.preSend(subscribeMessage("/topic/conversation.1"), channel))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void subscribeToUserQueueIsAllowed() {
        Message<?> result = interceptor.preSend(subscribeMessage("/user/queue/messages"), channel);
        assertThat(result).isNotNull();
    }

    @Test
    void subscribeToResolvedUserQueueIsAllowed() {
        Message<?> result = interceptor.preSend(
                subscribeMessage("/queue/messages-user1a2b3c"), channel);
        assertThat(result).isNotNull();
    }

    private Message<byte[]> connectMessage(String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        if (authorization != null) {
            accessor.setNativeHeader(HttpHeaders.AUTHORIZATION, authorization);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<byte[]> subscribeMessage(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setUser(new UsernamePasswordAuthenticationToken("42", null));
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Jwt jwt(Long userId, Map<String, Object> legacyUserClaim) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "HS512")
                .subject("test@example.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60));
        if (userId != null) {
            builder.claim("userId", userId);
        }
        if (legacyUserClaim != null) {
            builder.claim("user", legacyUserClaim);
        }
        return builder.build();
    }
}
