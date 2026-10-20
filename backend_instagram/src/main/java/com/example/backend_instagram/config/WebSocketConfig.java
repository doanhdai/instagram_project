package com.example.backend_instagram.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor authChannelInterceptor;

    @Value("${app.websocket.allowed-origins:http://localhost:3000}")
    private String[] allowedOrigins;

    @Value("${app.websocket.message-size-limit:65536}")
    private int messageSizeLimit;

    @Value("${app.websocket.send-buffer-size-limit:524288}")
    private int sendBufferSizeLimit;

    @Value("${app.websocket.send-time-limit:20000}")
    private int sendTimeLimit;

    public WebSocketConfig(StompAuthChannelInterceptor authChannelInterceptor) {
        this.authChannelInterceptor = authChannelInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Chỉ dùng user destination (/user/queue/**). Không còn topic công khai
        // cho conversation/notification để tránh lộ dữ liệu giữa các user.
        registry.enableSimpleBroker("/queue")
                .setHeartbeatValue(new long[] { 10_000, 10_000 })
                .setTaskScheduler(heartbeatScheduler());

        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Giữ /ws + SockJS để tương thích client hiện tại.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();

        // Endpoint native WebSocket cho client mới, không đi qua SockJS.
        registry.addEndpoint("/ws-native")
                .setAllowedOriginPatterns(allowedOrigins);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(messageSizeLimit);
        registration.setSendBufferSizeLimit(sendBufferSizeLimit);
        registration.setSendTimeLimit(sendTimeLimit);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authChannelInterceptor);

        int cores = Runtime.getRuntime().availableProcessors();
        registration.taskExecutor()
                .corePoolSize(Math.max(cores, 4))
                .maxPoolSize(Math.max(cores * 4, 16))
                .queueCapacity(1_000)
                .keepAliveSeconds(60);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        int cores = Runtime.getRuntime().availableProcessors();
        registration.taskExecutor()
                .corePoolSize(Math.max(cores, 4))
                .maxPoolSize(Math.max(cores * 4, 16))
                .queueCapacity(1_000)
                .keepAliveSeconds(60);
    }

    @Bean
    public ThreadPoolTaskScheduler heartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.setDaemon(true);
        return scheduler;
    }
}
