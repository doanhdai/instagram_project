import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import {
  addMessage,
  markMessagesAsRead,
  setWebSocketConnected,
  updateConversationWithLatestMessage,
} from "../Redux/Reducer/chatSlice";

class WebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.connecting = false;
    this.subscriptions = [];
    this.reconnectTimeout = null;
    this.apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8081";
    this.connectionCheckInterval = null;
    this.retryCount = 0;
    this.maxRetries = 5;

    // Thêm event listeners để xử lý khi browser thay đổi trạng thái
    if (typeof window !== "undefined") {
      // Khi tab trở nên active
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          console.log("Tab became visible, checking WebSocket connection...");
          if (!this.isReallyConnected()) {
            console.log(
              "WebSocket disconnected while inactive, reconnecting..."
            );
            this.reconnect();
          }
        }
      });

      // Khi kết nối mạng thay đổi
      window.addEventListener("online", () => {
        console.log("Network connection restored, reconnecting WebSocket...");
        this.reconnect();
      });
    }
  }

  isReallyConnected() {
    return this.stompClient && this.connected && this.stompClient.connected;
  }

  startConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(() => {
      // Nếu kết nối không thành công hoặc đã mất kết nối
      if (
        this.connected &&
        (!this.stompClient || !this.stompClient.connected)
      ) {
        console.warn(
          "WebSocket connection state mismatch detected, reconnecting..."
        );
        this.connected = false;
        if (this.dispatch) {
          this.dispatch(setWebSocketConnected(false));
        }
        this.reconnect();
      }

      // Kiểm tra kết nối mà không cần gửi heartbeat
      if (this.stompClient && this.stompClient.connected) {
        try {
          // Kiểm tra trạng thái của đối tượng websocket gốc
          if (
            this.stompClient.ws &&
            (this.stompClient.ws.readyState === 1 || // OPEN state trong WebSocket API
              (this.stompClient.ws._transport &&
                this.stompClient.ws._transport.readyState === 1))
          ) {
            // Kết nối vẫn hoạt động, không làm gì cả
          } else {
            throw new Error("WebSocket connection appears broken");
          }
        } catch (e) {
          console.warn("Error checking WebSocket connection status:", e);
          this.connected = false;
          if (this.dispatch) {
            this.dispatch(setWebSocketConnected(false));
          }
          this.reconnect();
        }
      }
    }, 30000); // Kiểm tra mỗi 30 giây
  }

  // Sửa lại init() để đảm bảo thứ tự khởi tạo đúng
  init(dispatch) {
    if (!dispatch) {
      console.error("WebSocketService init requires a dispatch function");
      return;
    }

    // Lưu dispatch function
    this.dispatch = dispatch;

    // Lưu getState function để có thể truy xuất state
    if (dispatch.getState) {
      this.dispatch._getState = dispatch.getState;
    }

    console.log("WebSocketService initialized with dispatch");

    // KHÔNG kết nối ngay lập tức - để MessengerPage điều khiển thời điểm kết nối
    // Đảm bảo userId đã được set vào Redux trước khi kết nối
  }

  // Cải thiện hàm getUserId để lấy userId từ nhiều nguồn khác nhau
  getUserId() {
    // Cách 1: Lấy từ Redux state
    const state = this.getReduxState();
    const reduxUserId = state?.chat?.currentUserId || state?.login?.userInfo?.id;
    
    // Cách 2: Lấy từ localStorage
    const localStorageUserId = localStorage.getItem('userId') || localStorage.getItem('user_id');
    
    // Trả về userId từ bất kỳ nguồn nào có giá trị
    return reduxUserId || (localStorageUserId ? parseInt(localStorageUserId) : null);
  }

  // Thêm phương thức mới để đảm bảo có userId trước khi làm bất cứ điều gì
  ensureUserId() {
    const userId = this.getUserId();
    if (!userId) {
      console.error("No user ID available from any source");
      return Promise.reject(new Error("No user ID available"));
    }
    return Promise.resolve(userId);
  }

  getReduxState() {
    if (!this.dispatch || !this.dispatch._getState) {
      return null;
    }
    return this.dispatch._getState();
  }

  connect() {
    if (this.isReallyConnected()) return Promise.resolve();

    if (this.connecting) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isReallyConnected()) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.connecting) {
            clearInterval(checkInterval);
            reject(new Error("Connection attempt failed"));
          }
        }, 100);

        // Tăng thời gian timeout từ 10000 lên 30000
        setTimeout(() => {
          if (!this.isReallyConnected()) {
            clearInterval(checkInterval);
            this.connecting = false;
            reject(new Error("Connection timeout"));
          }
        }, 30000); // Tăng lên 30 giây thay vì 10 giây
      });
    }

    this.connecting = true;
    this.retryCount = 0;
    console.log("Connecting to WebSocket...");

    return new Promise((resolve, reject) => {
      try {
        if (this.stompClient) {
          try {
            this.disconnect();
          } catch (e) {
            console.warn("Error disconnecting old client:", e);
          }
        }

        // Đảm bảo địa chỉ WebSocket chính xác
        const wsBaseUrl =
          process.env.REACT_APP_API_URL || "http://localhost:8081"; // Sửa port thành 8080 nếu backend chạy trên port đó

        console.log(`Connecting to WebSocket at ${wsBaseUrl}/ws`);
        const socket = new SockJS(`${wsBaseUrl}/ws`);
        this.stompClient = Stomp.over(socket);

        // Sửa debug handler
        this.stompClient.debug = () => { }; // Hàm rỗng thay vì null

        const headers = {};
        // Thêm token xác thực
        const token = localStorage.getItem("accessToken");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        this.stompClient.connect(
          headers,
          (frame) => {
            console.log("WebSocket connected successfully!");
            this.connected = true;
            this.connecting = false;
            this.retryCount = 0; // Reset retry count on success

            if (this.dispatch) {
              this.dispatch(setWebSocketConnected(true));
            }

            this.subscribeToUserMessages();
            this._resubscribeToActiveConversations();

            resolve(frame);
          },
          (error) => {
            console.error("WebSocket connection error:", error);
            console.error(
              "Error detail:",
              typeof error === "string"
                ? error
                : error.message || "Unknown error"
            );
            this.connected = false;
            this.connecting = false;

            if (this.dispatch) {
              this.dispatch(setWebSocketConnected(false));
            }

            reject(error);
          }
        );
      } catch (error) {
        console.error("Error setting up WebSocket:", error);
        this.connected = false;
        this.connecting = false;
        reject(error);
      }
    });
  }

  reconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.retryCount >= this.maxRetries) {
      console.error(
        `Exceeded maximum reconnection attempts (${this.maxRetries})`
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Exponential backoff, max 30 seconds
    this.retryCount++;

    console.log(
      `Attempting to reconnect WebSocket in ${delay / 1000} seconds (attempt ${this.retryCount
      }/${this.maxRetries})...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((err) => {
        console.error("Reconnection failed:", err);
      });
    }, delay);
  }

  // Cải thiện phương thức subscribeToUserMessages để chịu trách nhiệm hơn
  subscribeToUserMessages() {
    if (!this.connected || !this.stompClient) {
      console.warn(
        "Cannot subscribe to user messages: Not connected, will try after connecting"
      );
      return;
    }

    const userId = this.getUserId();
    if (!userId) {
      console.error("Cannot subscribe to user messages: No user ID available");
      // Try to get userId from Redux store if available
      const state = this.getReduxState();
      const potentialUserId =
        state?.login?.userInfo?.id || state?.chat?.currentUserId;
      if (potentialUserId) {
        console.log(`Found userId ${potentialUserId} from Redux store`);
        this._doSubscribeToUserMessages(potentialUserId);
      } else {
        console.error("No user ID found in Redux store either");
      }
      return;
    }

    this._doSubscribeToUserMessages(userId);
  }

  // Thêm phương thức mới để xử lý subscription thực tế
  _doSubscribeToUserMessages(userId) {
    // Kiểm tra xem đã subscribe chưa
    const existingSub = this.subscriptions.find(
      (sub) => sub.id === `user-${userId}`
    );
    if (existingSub) {
      console.log(`Already subscribed to user ${userId} messages`);
      return;
    }

    try {
      console.log(`Subscribing to user ${userId} messages queue`);

      // Đăng ký cả hai kênh để đảm bảo nhận đủ tin nhắn
      // 1. Kênh tin nhắn cá nhân - dùng để nhận thông báo 1-1
      const subscription1 = this.stompClient.subscribe(
        `/user/${userId}/queue/messages`,
        (message) => this._handleIncomingMessage(message, "user-queue")
      );

      subscription1.id = `user-${userId}-queue`;
      this.subscriptions.push(subscription1);

      // 2. Kênh thông báo - để nhận các updates khác
      const subscription2 = this.stompClient.subscribe(
        `/user/${userId}/queue/notifications`,
        (message) => this._handleIncomingMessage(message, "notification-queue")
      );

      subscription2.id = `user-${userId}-notifications`;
      this.subscriptions.push(subscription2);

      console.log(`Successfully subscribed to both queues for user ${userId}`);
    } catch (error) {
      console.error(`Error subscribing to user ${userId} messages:`, error);
    }
  }

  // Thêm phương thức mới để xử lý tin nhắn đến
  _handleIncomingMessage(message, source) {
    try {
      const receivedMessage = JSON.parse(message.body);
      console.log(`Received message from ${source}:`, receivedMessage);

      if (!this.dispatch) {
        console.error("No dispatch function available to process message");
        return;
      }

      // Thêm metadata để giúp debug
      const enhancedMessage = {
        ...receivedMessage,
        fromWebSocket: true,
        messageSource: source,
        receivedAt: new Date().toISOString(),
      };

      // Dispatch message to Redux store
      this.dispatch(addMessage(enhancedMessage));

      // Nếu tin nhắn có conversationId, cập nhật conversation
      if (enhancedMessage.conversationId) {
        this.dispatch(updateConversationWithLatestMessage(enhancedMessage));

        // Nếu tin nhắn thuộc conversation hiện tại, mark as read
        const currentState = this.getReduxState();
        if (
          currentState?.chat?.currentConversation?.id ===
          enhancedMessage.conversationId
        ) {
          console.log(
            `Message belongs to current conversation, marking as read`
          );
          this.markAsRead(
            enhancedMessage.conversationId,
            currentState.chat.currentUserId
          ).catch((err) =>
            console.error("Error marking message as read:", err)
          );
        }
      }
    } catch (error) {
      console.error(`Error processing message from ${source}:`, error);
    }
  }

  subscribeToConversation(conversationId) {
    if (!conversationId) {
      console.error(
        "Cannot subscribe to conversation: No conversation ID provided"
      );
      return Promise.reject(new Error("No conversation ID provided"));
    }

    const existingSubscription = this.subscriptions.find(
      (sub) => sub.id === `conversation-${conversationId}`
    );

    if (existingSubscription) {
      console.log(`Already subscribed to conversation ${conversationId}`);
      return Promise.resolve();
    }

    if (!this.connected || !this.stompClient) {
      return this.connect().then(() =>
        this._doSubscribeToConversation(conversationId)
      );
    }

    return Promise.resolve().then(() =>
      this._doSubscribeToConversation(conversationId)
    );
  }

  _doSubscribeToConversation(conversationId) {
    try {
      console.log(`Subscribing to conversation ${conversationId}`);
      const subscription = this.stompClient.subscribe(
        `/topic/conversation.${conversationId}`,
        (message) => {
          try {
            const receivedMessage = JSON.parse(message.body);
            console.log("Received message via WebSocket:", receivedMessage);

            if (this.dispatch) {
              this.dispatch(
                addMessage({
                  ...receivedMessage,
                  fromWebSocket: true,
                })
              );
            }
          } catch (error) {
            console.error("Error processing message:", error);
          }
        }
      );

      subscription.id = `conversation-${conversationId}`;
      this.subscriptions.push(subscription);
    } catch (error) {
      console.error(
        `Error subscribing to conversation ${conversationId}:`,
        error
      );
    }
  }

  sendMessage(message) {
    if (!message || !message.conversationId) {
      console.error("Cannot send message: Invalid message data", message);
      return Promise.reject(new Error("Invalid message data"));
    }

    if (!this.connected || !this.stompClient) {
      console.log("Connecting before sending message");
      return this.connect()
        .then(() => this._doSendMessage(message))
        .catch((err) => {
          console.error("Failed to connect for sending message:", err);
          return Promise.reject(err);
        });
    }

    return this._doSendMessage(message);
  }

  _doSendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.stompClient || !this.connected) {
        console.error("STOMP client not connected in _doSendMessage");
        return reject(new Error("STOMP client not connected"));
      }

      try {
        console.log(
          `Sending message to conversation ${message.conversationId}:`,
          message
        );

        const messageToSend = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
        };

        this.stompClient.send(
          `/app/chat/${message.conversationId}`,
          {
            "content-type": "application/json",
          },
          JSON.stringify(messageToSend)
        );

        console.log("Message sent successfully via WebSocket");
        resolve(true);
      } catch (error) {
        console.error("Error sending message via WebSocket:", error);
        this.handleConnectionError();
        reject(error);
      }
    });
  }

  markAsRead(conversationId, userId) {
    if (!conversationId || !userId) {
      console.error("Cannot mark as read: Missing conversationId or userId");
      return Promise.reject(new Error("Missing conversationId or userId"));
    }

    if (!this.connected || !this.stompClient) {
      console.log("Connecting before marking as read");
      return this.connect()
        .then(() => this._doMarkAsRead(conversationId, userId))
        .catch((err) => {
          console.error("Failed to connect for marking as read:", err);
          return Promise.reject(err);
        });
    }

    return this._doMarkAsRead(conversationId, userId);
  }

  _doMarkAsRead(conversationId, userId) {
    return new Promise((resolve, reject) => {
      try {
        console.log(
          `Marking conversation ${conversationId} as read by user ${userId}`
        );

        this.stompClient.send(
          `/app/chat/${conversationId}/read`,
          {},
          userId.toString()
        );

        if (this.dispatch) {
          this.dispatch(markMessagesAsRead({ conversationId, userId }));
        }

        resolve(true);
      } catch (error) {
        console.error("Error marking as read:", error);
        reject(error);
      }
    });
  }

  handleConnectionError() {
    console.log("Connection error detected, attempting to reconnect...");
    this.connected = false;
    if (this.dispatch) {
      this.dispatch(setWebSocketConnected(false));
    }
    this.reconnect();
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    this.subscriptions.forEach((subscription) => {
      try {
        if (subscription && typeof subscription.unsubscribe === "function") {
          subscription.unsubscribe();
        }
      } catch (e) {
        console.warn("Error unsubscribing:", e);
      }
    });
    this.subscriptions = [];

    if (this.stompClient) {
      try {
        if (this.connected && this.stompClient.connected) {
          this.stompClient.disconnect();
          console.log("WebSocket disconnected");
        }
      } catch (e) {
        console.error("Error disconnecting WebSocket:", e);
      }
      this.stompClient = null;
    }

    this.connected = false;
    this.connecting = false;

    if (this.dispatch) {
      this.dispatch(setWebSocketConnected(false));
    }
  }

  isConnected() {
    return this.connected && this.stompClient && this.stompClient.connected;
  }

  ensureConnected() {
    if (this.isConnected()) {
      return Promise.resolve();
    }

    console.log("WebSocket not connected, establishing connection...");
    return this.connect();
  }

  initialSetupForConversation(conversationId, userId) {
    if (!conversationId || !userId)
      return Promise.reject(new Error("Missing parameters"));

    return this.connect()
      .then(() => {
        return this._doSubscribeToConversation(conversationId);
      })
      .then(() => {
        console.log(`Successfully set up conversation ${conversationId}`);
        return true;
      })
      .catch((err) => {
        console.error("Error setting up conversation:", err);
        return false;
      });
  }

  _resubscribeToActiveConversations() {
    const currentState = this.getReduxState();
    if (currentState?.chat?.currentConversation?.id) {
      const conversationId = currentState.chat.currentConversation.id;
      console.log(`Re-subscribing to active conversation: ${conversationId}`);
      this._doSubscribeToConversation(conversationId);
    }
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
