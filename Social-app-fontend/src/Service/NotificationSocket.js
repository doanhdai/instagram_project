import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { toast } from "react-toastify";

class NotificationWebSocket {
  constructor() {
    // Dùng STOMP endpoint thay vì Socket.IO (port 8081, không phải 9092)
    this.apiUrl = (process.env.REACT_APP_API_URL || "http://localhost:8081").replace(/\/+$/, "");
    this.client = null;
    this.connected = false;
    this.reconnectTimeout = null;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  init(dispatch, userId) {
    if (!dispatch || !userId) {
      console.error("WebSocketService init requires dispatch and userId");
      return;
    }
    this.dispatch = dispatch;
    this.userId = userId;
    console.log(`Initializing STOMP WebSocket for userId=${userId}`);
    this.connect();
  }

  connect() {
    if (this.connected) {
      console.log("STOMP WebSocket already connected");
      return Promise.resolve();
    }

    console.log(`Connecting to STOMP at ${this.apiUrl} with userId=${this.userId}`);

    // Tạo STOMP client
    this.client = new Client({
      webSocketFactory: () => new SockJS(`${this.apiUrl}/ws`),
      reconnectDelay: 1000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = (frame) => {
      console.log("STOMP connected:", frame);
      this.connected = true;
      this.retryCount = 0;
    };

    this.client.onStompError = (frame) => {
      console.error("STOMP error:", frame.headers?.message || frame.body);
      this.connected = false;
      this.reconnect();
    };

    this.client.onWebSocketError = (event) => {
      console.error("STOMP connection error:", event);
      this.connected = false;
      this.reconnect();
    };

    this.client.onWebSocketClose = (event) => {
      console.log("STOMP WebSocket disconnected");
      this.connected = false;
      this.reconnect();
    };

    this.client.activate();

    return new Promise((resolve, reject) => {
      const checkConnected = () => {
        if (this.connected) {
          resolve();
        } else if (this.retryCount >= this.maxRetries) {
          reject(new Error("Failed to connect to STOMP server"));
        } else {
          setTimeout(checkConnected, 500);
        }
      };
      checkConnected();
    });
  }

  reconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.retryCount >= this.maxRetries) {
      console.error(`Exceeded maximum reconnection attempts (${this.maxRetries})`);
      toast.error("Mất kết nối với máy chủ, vui lòng thử lại sau!");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    this.retryCount++;
    console.log(
      `Reconnecting in ${delay / 1000} seconds (attempt ${this.retryCount}/${this.maxRetries})...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((err) => {
        console.error("Reconnection failed:", err);
      });
    }, delay);
  }

  subscribeToNotifications(callback) {
    if (!this.client || !this.connected) {
      console.warn("Cannot subscribe to notifications: STOMP not connected");
      return;
    }
    // Subscribe to /topic/notifications.{userId} (STOMP topic from backend)
    this.client.subscribe(`/topic/notifications.${this.userId}`, (message) => {
      console.log("Raw STOMP notification:", message.body);
      try {
        const notification = JSON.parse(message.body);
        console.log("Parsed notification:", notification);
        if (typeof callback === "function") {
          callback(notification);
        }
      } catch (e) {
        console.error("Error parsing notification:", e, "Raw body:", message.body);
      }
    });
    console.log(`Subscribed to STOMP notifications for userId=${this.userId}`);
  }

  subscribeToLikeUpdates(callback) {
    if (!this.client || !this.connected) {
      console.warn("Cannot subscribe to like updates: STOMP not connected");
      return;
    }
    this.client.subscribe(`/topic/notifications.${this.userId}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        // Filter like updates by checking type field
        if ((data && data.type === "LIKE") || (data && data.message && data.message.includes("liked"))) {
          console.log("Received like update:", data);
          if (typeof callback === "function") {
            callback(data);
          }
        }
      } catch (e) {
        console.error("Error processing like update:", e);
      }
    });
  }

  subscribeToCommentUpdates(callback) {
    if (!this.client || !this.connected) {
      console.warn("Cannot subscribe to comment updates: STOMP not connected");
      return;
    }
    this.client.subscribe(`/topic/notifications.${this.userId}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        // Filter comment updates
        if (data && (data.type === "COMMENT" || data.message?.includes("commented"))) {
          console.log("Received comment update:", data);
          if (typeof callback === "function") {
            callback(data);
          }
        }
      } catch (e) {
        console.error("Error processing comment update:", e);
      }
    });
    console.log(`Subscribed to comment updates for userId=${this.userId}`);
  }

  subscribeToFollow(callback) {
    if (!this.client || !this.connected) {
      console.warn("Cannot subscribe to follow updates: STOMP not connected");
      return;
    }
    this.client.subscribe(`/topic/notifications.${this.userId}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (data && (data.type === "FOLLOW" || data.message?.includes("follow"))) {
          console.log("Received follow update:", data);
          if (typeof callback === "function") {
            callback(data);
          }
        }
      } catch (e) {
        console.error("Error processing follow update:", e);
      }
    });
    console.log(`Subscribed to follow updates for userId=${this.userId}`);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      console.log("STOMP WebSocket disconnected");
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected && this.client && this.client.active;
  }
}

const notificationWebSocket = new NotificationWebSocket();
export default notificationWebSocket;
