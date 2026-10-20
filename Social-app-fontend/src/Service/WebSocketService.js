import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  addMessage,
  markMessagesAsRead,
  markMessagesAsReadByOther,
  setWebSocketConnected,
} from "../Redux/Reducer/chatSlice";

/**
 * Một STOMP client duy nhất cho toàn app.
 *
 * Server chỉ gửi dữ liệu qua user destination (/user/queue/**). Nhờ đó client
 * không cần subscribe theo từng conversation và không thể nghe dữ liệu của
 * user khác.
 */
class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connectingPromise = null;
    this.subscriptions = new Map();
    this.listeners = new Map();
    this.markReadTimers = new Map();
    this.dispatch = null;
    this.userId = null;
    this.accessToken = null;
    this.apiUrl = (
      process.env.REACT_APP_API_URL || "http://localhost:8081"
    ).replace(/\/+$/, "");
  }

  init(dispatch, userId, accessToken) {
    const userChanged = this.userId && userId && this.userId !== userId;
    const tokenChanged =
      this.accessToken && accessToken && this.accessToken !== accessToken;
    if (userChanged || tokenChanged) {
      // Đổi user/token (logout/login) thì đóng kết nối cũ.
      this.disconnect();
    }
    if (dispatch) {
      this.dispatch = dispatch;
      if (dispatch.getState) {
        this.dispatch._getState = dispatch.getState;
      }
    }
    if (userId) {
      this.userId = userId;
    }
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  /**
   * Token nằm trong Redux (persist) chứ không phải localStorage.accessToken.
   * Hỗ trợ thêm các nguồn cũ để không phá client đang chạy.
   */
  getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    const state = this.getReduxState();
    if (state?.login?.accessToken) {
      return state.login.accessToken;
    }
    const directToken =
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken");
    if (directToken) {
      return directToken;
    }
    try {
      const persistedRoot = JSON.parse(
        localStorage.getItem("persist:root") || "{}"
      );
      const persistedLogin = persistedRoot.login
        ? JSON.parse(persistedRoot.login)
        : null;
      if (persistedLogin?.accessToken) {
        return persistedLogin.accessToken;
      }
    } catch (error) {
      console.warn("Cannot read persisted access token:", error);
    }
    return null;
  }

  getUserId() {
    if (this.userId) {
      return this.userId;
    }
    const state = this.getReduxState();
    const reduxUserId =
      state?.chat?.currentUserId || state?.login?.userInfo?.id;
    const storedUserId =
      localStorage.getItem("userId") || localStorage.getItem("user_id");
    return reduxUserId || (storedUserId ? parseInt(storedUserId, 10) : null);
  }

  getReduxState() {
    if (!this.dispatch || !this.dispatch._getState) {
      return null;
    }
    return this.dispatch._getState();
  }

  isConnected() {
    return !!(this.client && this.client.connected);
  }

  isReallyConnected() {
    return this.isConnected();
  }

  isWebSocketConnected() {
    return this.connected && this.isConnected();
  }

  connect() {
    if (this.isConnected()) {
      return Promise.resolve();
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    const token = this.getAccessToken();
    if (!token) {
      return Promise.reject(new Error("Missing access token"));
    }

    if (this.client && !this.client.active) {
      this.client = null;
    }

    if (!this.client) {
      this.client = new Client({
        webSocketFactory: () => new SockJS(`${this.apiUrl}/ws`),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        beforeConnect: () => {
          // Refresh token trước mỗi lần reconnect.
          const freshToken = this.getAccessToken();
          if (freshToken && this.client) {
            this.accessToken = freshToken;
            this.client.connectHeaders = {
              Authorization: `Bearer ${freshToken}`,
            };
          }
        },
        onConnect: () => {
          this.connected = true;
          this.subscriptions.clear();
          this._subscribeToUserQueues();
          if (this.dispatch) {
            this.dispatch(setWebSocketConnected(true));
          }
        },
        onDisconnect: () => {
          this.connected = false;
          this.subscriptions.clear();
          if (this.dispatch) {
            this.dispatch(setWebSocketConnected(false));
          }
        },
        onWebSocketClose: () => {
          this.connected = false;
          this.subscriptions.clear();
          if (this.dispatch) {
            this.dispatch(setWebSocketConnected(false));
          }
        },
        onStompError: (frame) => {
          console.error(
            "STOMP error:",
            frame.headers?.message || frame.body
          );
          this.connected = false;
          if (this.dispatch) {
            this.dispatch(setWebSocketConnected(false));
          }
        },
      });
    }

    this.client.activate();
    this.connectingPromise = this._waitForConnection(15000).finally(() => {
      this.connectingPromise = null;
    });
    return this.connectingPromise;
  }

  _waitForConnection(timeoutMs) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (this.isConnected()) {
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("WebSocket connection timeout"));
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  _subscribeToUserQueues() {
    this._subscribe("messages", "/user/queue/messages", (frame) =>
      this._handleIncomingMessage(frame)
    );
    this._subscribe("notifications", "/user/queue/notifications", (frame) => {
      const notification = this._parse(frame);
      if (notification) {
        this._emit("notification", notification);
      }
    });
    this._subscribe("read-receipts", "/user/queue/read-receipts", (frame) => {
      const receipt = this._parse(frame);
      if (receipt?.conversationId && receipt?.userId) {
        if (this.dispatch) {
          this.dispatch(
            markMessagesAsReadByOther({
              conversationId: receipt.conversationId,
              readerId: receipt.userId,
            })
          );
        }
        this._emit("read-receipt", receipt);
      }
    });
    this._subscribe("video-call", "/user/queue/video-call", (frame) => {
      const signal = this._parse(frame);
      if (signal) {
        this._emit("video-call", signal);
      }
    });
    this._subscribe("errors", "/user/queue/errors", (frame) => {
      const error = this._parse(frame);
      console.error("STOMP message error:", error);
      this._emit("error", error);
    });
  }

  _subscribe(key, destination, callback) {
    if (!this.isConnected() || this.subscriptions.has(key)) {
      return;
    }
    try {
      const subscription = this.client.subscribe(destination, callback);
      this.subscriptions.set(key, subscription);
    } catch (error) {
      console.error(`Cannot subscribe to ${destination}:`, error);
    }
  }

  _parse(frame) {
    try {
      return frame?.body ? JSON.parse(frame.body) : null;
    } catch (error) {
      console.error("Cannot parse STOMP payload:", error, frame?.body);
      return null;
    }
  }

  _handleIncomingMessage(frame) {
    const receivedMessage = this._parse(frame);
    if (!receivedMessage?.conversationId) {
      return;
    }

    if (this.dispatch) {
      this.dispatch(
        addMessage({
          ...receivedMessage,
          fromWebSocket: true,
          receivedAt: new Date().toISOString(),
        })
      );
    }

    const currentState = this.getReduxState();
    if (
      currentState?.chat?.currentConversation?.id ===
        receivedMessage.conversationId &&
      receivedMessage.senderId !== this.getUserId()
    ) {
      this._scheduleMarkAsRead(receivedMessage.conversationId);
    }
  }

  _scheduleMarkAsRead(conversationId) {
    const existingTimer = this.markReadTimers.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      this.markReadTimers.delete(conversationId);
      this.markAsRead(conversationId).catch((error) =>
        console.error("Cannot mark messages as read:", error)
      );
    }, 400);
    this.markReadTimers.set(conversationId, timer);
  }

  /**
   * Giữ tên cũ để các component hiện tại không phải sửa nhiều. Thực chất chỉ
   * đảm bảo đã subscribe các user queue.
   */
  subscribeToUserMessages() {
    if (this.isConnected()) {
      this._subscribeToUserQueues();
      return Promise.resolve();
    }
    return this.connect().then(() => this._subscribeToUserQueues());
  }

  sendMessage(message) {
    if (!message?.conversationId) {
      return Promise.reject(new Error("Invalid message data"));
    }
    const send = () => {
      this.client.publish({
        destination: `/app/chat/${message.conversationId}`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: message.content }),
      });
    };
    if (!this.isConnected()) {
      return this.connect().then(send);
    }
    return Promise.resolve().then(send);
  }

  markAsRead(conversationId) {
    if (!conversationId) {
      return Promise.reject(new Error("Missing conversationId"));
    }
    const send = () => {
      this.client.publish({
        destination: `/app/chat/${conversationId}/read`,
        body: "",
      });
      const userId = this.getUserId();
      if (userId && this.dispatch) {
        this.dispatch(markMessagesAsRead({ conversationId, userId }));
      }
    };
    if (!this.isConnected()) {
      return this.connect().then(send);
    }
    return Promise.resolve().then(send);
  }

  sendNotification(toUserId, payload) {
    if (!toUserId) {
      return Promise.reject(new Error("Missing toUserId"));
    }
    const send = () => {
      this.client.publish({
        destination: `/app/notifications/${toUserId}`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
    };
    if (!this.isConnected()) {
      return this.connect().then(send);
    }
    return Promise.resolve().then(send);
  }

  sendVideoSignal(toUserId, payload) {
    if (!toUserId) {
      return Promise.reject(new Error("Missing toUserId"));
    }
    const send = () => {
      this.client.publish({
        destination: `/app/video-call/${toUserId}`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
    };
    if (!this.isConnected()) {
      return this.connect().then(send);
    }
    return Promise.resolve().then(send);
  }

  on(event, handler) {
    if (typeof handler !== "function") {
      return () => {};
    }
    const handlers = this.listeners.get(event) || new Set();
    handlers.add(handler);
    this.listeners.set(event, handlers);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  _emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in WebSocket listener ${event}:`, error);
      }
    });
  }

  ensureConnected() {
    return this.connect();
  }

  disconnect() {
    this.markReadTimers.forEach((timer) => clearTimeout(timer));
    this.markReadTimers.clear();
    this.subscriptions.clear();
    this.connectingPromise = null;

    if (this.client) {
      try {
        this.client.deactivate();
      } catch (error) {
        console.warn("Error disconnecting STOMP client:", error);
      }
      this.client = null;
    }

    this.connected = false;
    this.accessToken = null;
    if (this.dispatch) {
      this.dispatch(setWebSocketConnected(false));
    }
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
