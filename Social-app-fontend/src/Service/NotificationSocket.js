import io from "socket.io-client";
import { toast } from "react-toastify";

class NotificationSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.apiUrl = "http://localhost:9092";
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
    console.log(`Initializing WebSocket for userId=${userId}`);
    this.connect();
  }

  connect() {
    if (this.connected) {
      console.log("Socket.IO already connected");
      return Promise.resolve();
    }

    console.log(
      `Connecting to Socket.IO at ${this.apiUrl} with userId=${this.userId}`
    );
    this.socket = io(this.apiUrl, {
      query: { userId: this.userId },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return new Promise((resolve, reject) => {
      this.socket.on("connect", () => {
        // console.log("✅ Socket.IO connected, socketId: ", this.socket.id);
        this.connected = true;
        this.retryCount = 0;
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("Socket.IO connection error:", error);
        this.connected = false;
        this.reconnect();
        reject(error);
      });

      this.socket.on("disconnect", () => {
        console.log("Socket.IO disconnected");
        this.connected = false;
        this.reconnect();
      });

      this.socket.on("me", (userId) => {
        console.log("Received 'me' event: userId=", userId);
      });

      this.socket.onAny((event, ...args) => {
        console.log(`Received event: ${event}`, args);
      });
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
      toast.error("Mất kết nối với máy chủ, vui lòng thử lại sau!");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    this.retryCount++;
    console.log(
      `Reconnecting in ${delay / 1000} seconds (attempt ${this.retryCount}/${
        this.maxRetries
      })...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((err) => {
        console.error("Reconnection failed:", err);
      });
    }, delay);
  }

  subscribeToNotifications(callback) {
    if (!this.socket) {
      console.warn("Cannot subscribe to notifications: Socket not initialized");
      return;
    }
    this.socket.off("notification");
    console.log(`Subscribing to notifications for userId=${this.userId}`);
    this.socket.on("notification", (data) => {
      console.log("Raw notification data:", data);
      let notification;
      try {
        const jsonData = Array.isArray(data) ? data[0] : data;
        notification =
          typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
        console.log("Parsed notification:", notification);
        if (typeof callback === "function") {
          callback(notification);
        }
      } catch (e) {
        console.error(
          "Error parsing or processing notification:",
          e,
          "Raw data:",
          data
        );
        return;
      }
    });

    if (!this.connected) {
      console.warn("Socket not connected when subscribing to notifications");
    }
  }

  subscribeToLikeUpdates(callback) {
    if (!this.socket) {
      console.warn("Cannot subscribe to like updates: Socket not initialized");
      return;
    }

    this.socket.off("like_update");

    this.socket.on("like_update", (data) => {
      console.log("Received like update:", data);
      
      let notification;
      try {
        const jsonData = Array.isArray(data) ? data[0] : data;
        notification =
          typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
        console.log("Parsed notification:", notification);
        if (typeof callback === "function") {
          callback(notification);
        }
      } catch (e) {
        console.error(
          "Error parsing or processing notification:",
          e,
          "Raw data:",
          data
        );
        return;
      }
    });
  }



  subscribeToCommentUpdates(callback) {
    if (!this.socket) {
      console.warn(
        "Cannot subscribe to comment updates: Socket not initialized"
      );
      return;
    }
this.socket.off("comment_update");
    console.log(`Subscribing to comment updates for userId=${this.userId}`);
    this.socket.on("comment_update", (data) => {
      console.log("Raw comment update data:", data);
      let comment;
      try {
        const jsonData = Array.isArray(data) ? data[0] : data;
        comment =
          typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
        console.log("Parsed comment:", comment);
        if (typeof callback === "function") {
          callback(comment);
        }
      } catch (e) {
        console.error("Error parsing comment update:", e, "Raw data:", data);
        return;
      }
    });

    if (!this.connected) {
      console.warn("Socket not connected when subscribing to comment updates");
    }
  }

  subscribeToFollow(callback) {
    if (!this.socket) {
      console.warn(
        "Cannot subscribe to comment updates: Socket not initialized"
      );
      return;
    }
this.socket.off("receiveFollowNotification");
    // console.log(`Subscribing to comment updates for userId=${this.userId}`);
    this.socket.on("receiveFollowNotification", (data) => {
      console.log("Raw follow update data:", data);
      let follow;
      try {
        const jsonData = Array.isArray(data) ? data[0] : data;
        follow = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
        console.log("Parsed follow:", follow);
        if (typeof callback === "function") {
          callback(follow);
        }
      } catch (e) {
        console.error("Error parsing follow update:", e, "Raw data:", data);
        return;
      }
    });

    if (!this.connected) {
      console.warn("Socket not connected when subscribing to comment updates");
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("Socket.IO disconnected");
    }

    this.connected = false;
  }

  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

const notificationSocket = new NotificationSocket();
export default notificationSocket;
