package com.example.backend_instagram.handler;

import com.corundumstudio.socketio.*;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DataListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import com.example.backend_instagram.dto.user.CallData;
import com.example.backend_instagram.dto.user.AnswerData;
import com.example.backend_instagram.dto.notification.NotificationDTO;
import com.example.backend_instagram.repository.NotificationRepository;
import com.example.backend_instagram.entity.Notification;
import com.example.backend_instagram.entity.NotificationType;
import com.example.backend_instagram.entity.Post;
import com.example.backend_instagram.entity.User;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.HashMap;
import org.springframework.stereotype.Component;
import com.example.backend_instagram.service.NotificationService;
import com.example.backend_instagram.repository.NotificationRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.HashMap;

import org.apache.catalina.Server;
import org.springframework.stereotype.Component;

@Component
public class SocketIOHandler {

  private final SocketIOServer server;
  private final ConcurrentHashMap<String, SocketIOClient> userSocketMap = new ConcurrentHashMap<>();
  private final NotificationRepository notificationRepository;

  // Inject SocketIOServer từ Bean
  public SocketIOHandler(SocketIOServer server, NotificationRepository notificationRepository) {
    this.server = server;
    this.notificationRepository = notificationRepository;
  }

  public ConcurrentHashMap<String, SocketIOClient> getUserSocketMap() {
    return userSocketMap;
  }

  public void sendNotification(String userId, Object notificationDTO) {
    SocketIOClient client = userSocketMap.get(userId);
    if (client != null && client.isChannelOpen()) {
      client.sendEvent("notification", notificationDTO);
      System.out.println("✅ Sent notification to user: " + userId);
    } else {
      System.out.println("❌ Cannot send notification: User " + userId + " not connected.");
    }
  }

  @PostConstruct
  public void startServer() {
    // Khi client kết nối
    server.addConnectListener(client -> {
      String userId = client.getHandshakeData().getSingleUrlParam("userId");
      System.out.println(
          "🔍 Handshake data: " + client.getHandshakeData().getUrl());

      if (userId != null) {
        userSocketMap.put(userId, client);
        client.sendEvent("me", userId);
        System.out.println("✅ User connected: " + userId);
        System.out.println(
            "📊 Current connected users: " + userSocketMap.keySet());
      } else {
        System.out.println("⚠️ User ID is null on connection!");
      }
    });

    // Khi client ngắt kết nối
    server.addDisconnectListener(client -> {
      // Find and remove the user by client reference
      String userIdToRemove = null;
      for (Map.Entry<String, SocketIOClient> entry : userSocketMap.entrySet()) {
        if (entry.getValue().equals(client)) {
          userIdToRemove = entry.getKey();
          break;
        }
      }

      if (userIdToRemove != null) {
        userSocketMap.remove(userIdToRemove);
        System.out.println("❌ User disconnected: " + userIdToRemove);
        System.out.println(
            "📊 Remaining connected users: " + userSocketMap.keySet());
      } else {
        System.out.println(
            "❌ Client disconnected: " +
                client.getSessionId() +
                " (not found in user map)");
      }
    });

    // Log khi gửi thông báo (tùy chọn, để debug)
    server.addEventListener("notification", NotificationDTO.class, (client, data, ackSender) -> {
      System.out
          .println("📢 Nhận sự kiện notification cho user: " + data.getUserId() + ", nội dung: " + data.getMessage());
    });

    System.out.println("🚀 Socket.IO Handler started!");

    // Xử lý cuộc gọi
    server.addEventListener(
        "callUser",
        CallData.class,
        new DataListener<CallData>() {
          @Override
          public void onData(
              SocketIOClient client,
              CallData data,
              AckRequest ackSender) {
            System.out.println("📥 Nhận yêu cầu gọi:");
            System.out.println(" - Từ user: " + data.getFrom());
            System.out.println(" - Gọi đến user: " + data.getUserToCall());
            System.out.println(" - Dữ liệu signal: " + data.getSignalData());
            System.out.println(" - Tên người gọi: " + data.getName());

            // Validate signal data
            if (data.getSignalData() == null) {
              System.out.println("❌ Signal data is null!");
              return;
            }

            SocketIOClient receiver = userSocketMap.get(data.getUserToCall());
            if (receiver != null) {
              System.out.println(
                  "📞 Đang chuyển tiếp cuộc gọi đến " + data.getUserToCall());

              // Create a Map with the necessary fields
              Map<String, Object> callData = new HashMap<>();
              callData.put("from", data.getFrom());
              callData.put("signal", data.getSignalData());
              callData.put("name", data.getName());

              // Send the data as a Map
              receiver.sendEvent("callUser", callData);

              System.out.println("✅ Đã chuyển tiếp cuộc gọi thành công");
            } else {
              System.out.println(
                  "❌ Không tìm thấy user " +
                      data.getUserToCall() +
                      " trong danh sách kết nối!");
              System.out.println(
                  "📊 Danh sách user đang kết nối: " + userSocketMap.keySet());
            }
          }
        });

    // Xử lý trả lời cuộc gọi
    server.addEventListener(
        "answerCall",
        AnswerData.class,
        new DataListener<AnswerData>() {
          @Override
          public void onData(
              SocketIOClient client,
              AnswerData data,
              AckRequest ackSender) {
            // Convert Long to String for consistent key lookup
            String toUserId = String.valueOf(data.getTo());
            System.out.println("📥 Nhận trả lời cuộc gọi:");
            System.out.println(" - Từ user: " + client.getSessionId());
            System.out.println(" - Gửi đến user: " + toUserId);
            System.out.println(" - Dữ liệu signal: " + data.getSignal());

            SocketIOClient caller = userSocketMap.get(toUserId);
            if (caller != null) {
              System.out.println(
                  "✅ Answer received from " +
                      client.getSessionId() +
                      " forwarding to " +
                      toUserId);
              // Send the signal data directly
              caller.sendEvent("callAccepted", data.getSignal());
              System.out.println("✅ Đã chuyển tiếp trả lời thành công");
            } else {
              System.out.println("❌ Caller " + toUserId + " is not connected!");
              System.out.println(
                  "📊 Danh sách user đang kết nối: " + userSocketMap.keySet());
            }
          }
        });
    server.addEventListener("endCall", CallData.class, new DataListener<CallData>() {
      @Override
      public void onData(SocketIOClient client, CallData data, AckRequest ackSender) {
        System.out.println("📞 Nhận yêu cầu kết thúc cuộc gọi từ user: " + data.getUserId());
        System.out.println("📞 Call ID: " + data.getCallId());

        // Cập nhật trạng thái cuộc gọi hoặc xóa dữ liệu cuộc gọi từ hệ thống nếu cần
        // thiết
        // (Ví dụ, xóa thông tin cuộc gọi khỏi database hoặc session)

        // Thông báo cho các user khác về việc kết thúc cuộc gọi
        SocketIOClient receiver = userSocketMap.get(data.getUserId());
        if (receiver != null) {
          System.out.println("📞 Đang thông báo kết thúc cuộc gọi đến user: " + data.getUserId());
          receiver.sendEvent("callEnded", data.getCallId());
        } else {
          System.out.println("❌ Không tìm thấy user " + data.getUserId() + " trong danh sách kết nối!");
        }
      }
    });

    // Handle ICE candidates
    server.addEventListener(
        "iceCandidate",
        Map.class,
        new DataListener<Map>() {
          @Override
          public void onData(
              SocketIOClient client,
              Map data,
              AckRequest ackSender) {
            String to = (String) data.get("to");
            SocketIOClient receiver = userSocketMap.get(to);
            if (receiver != null) {
              System.out.println("🧊 Forwarding ICE candidate to: " + to);
              // Send the candidate data directly
              receiver.sendEvent("iceCandidate", data.get("candidate"));
            } else {
              System.out.println(
                  "❌ Receiver " + to + " not found for ICE candidate!");
            }
          }
        });

    // Xử lý thông báo theo dõi người dùng
    server.addEventListener("followNotification", Map.class, new DataListener<Map>() {
      @Override
      public void onData(SocketIOClient client, Map data, AckRequest ackSender) {
        try {
          String fromUserId = (String) data.get("fromUserId");
          String fromUserName = (String) data.get("fromUserName");
          String toUserId = (String) data.get("toUserId");
          String message = (String) data.get("message");
          String timestamp = (String) data.get("timestamp");

          System.out.println("📥 Follow event received:");
          System.out.println(" - From: " + fromUserName + " (ID: " + fromUserId + ")");
          System.out.println(" - To: " + toUserId);
          System.out.println(" - Message: " + message);
          System.out.println(" - Time: " + timestamp);

          // Parse sentAt từ timestamp nếu có, nếu không thì lấy LocalDateTime.now()
          LocalDateTime sentAt;
          try {
            sentAt = (timestamp != null && !timestamp.isEmpty())
                ? LocalDateTime.parse(timestamp)
                : LocalDateTime.now();
          } catch (Exception e) {
            sentAt = LocalDateTime.now();
          }

          SocketIOClient receiver = userSocketMap.get(toUserId);
          if (receiver != null) {
            // Chuẩn bị dữ liệu gửi về client
            Map<String, Object> notifyData = new HashMap<>();
            notifyData.put("fromUserId", fromUserId);
            notifyData.put("fromUserName", fromUserName);
            notifyData.put("message", message);
            notifyData.put("sentAt", sentAt.toString());

            // Tạo các đối tượng liên quan
            User fromUser = new User();
            fromUser.setId(Long.parseLong(fromUserId));

            User toUser = new User();
            toUser.setId(Long.parseLong(toUserId));

            Post post = new Post();
            post.setId(11L); // ID bài post mặc định hoặc lấy từ data nếu muốn

            // Tạo Notification
            Notification notification = new Notification();
            notification.setUser(toUser);
            notification.setActor(fromUser);
            notification.setPost(post);
            notification.setType(NotificationType.FOLLOW);
            notification.setMessage(message);
            notification.setSentAt(sentAt);
            notification.setRead(false);

            // Lưu vào database
            notificationRepository.save(notification);

            // Gửi event tới người nhận
            receiver.sendEvent("receiveFollowNotification", notifyData);

            System.out.println("✅ Follow notification sent to " + toUserId);
          } else {
            System.out.println("❌ User " + toUserId + " is not connected.");
          }
        } catch (Exception ex) {
          ex.printStackTrace();
          System.out.println("❌ Error processing follow notification: " + ex.getMessage());
        }
      }
    });
    System.out.println("🚀 Socket.IO Handler started!");
  }

  @PreDestroy
  public void stopServer() {
    server.stop();
    System.out.println("❌ Socket.IO Server stopped.");
  }
}
