import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import {
  getConversations,
  getMessagesByConversation,
  sendMessage,
  setActiveConversation,
  setCurrentUserId,
  addMessage,
  getOrCreateConversation,
  getMoreMessagesByConversation,
  resetChatState,
  updateMessageStatus,
  getConversationDetails,
  markMessagesAsRead,
  resetMessages,
  updateConversationWithLatestMessage,
} from "../../Redux/Reducer/chatSlice";
import webSocketService from "../../Service/WebSocketService";
import ConversationList from "./ConversationList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import UserSearchModal from "./UserSearchModal";
import {
  FaPhone,
  FaVideo,
  FaInfoCircle,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import { useWebSocket } from "../../Utils/configCallVideo/websocket";
import IncomingCallModal from "./IncomingCallModal";
import VideoCallModal from "./VideoCallModal";

import instance from "../../Utils/AxiosApi/Axios"; // Thêm dòng này ở đầu file
import ConversationDetails from "./ConversationDetails";

const SearchBar = ({ searchTerm, setSearchTerm, className = "" }) => {
  const { t } = useTranslation();
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={t("messenger.searchConversationsOrFriends")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {searchTerm && (
        <button
          className="absolute inset-y-0 right-2 flex items-center"
          onClick={() => setSearchTerm("")}
        >
          <svg
            className="h-5 w-5 text-gray-400 hover:text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

const SearchResults = ({
  filteredConversations,
  friendsWithoutConversation,
  onSelectConversation,
  onStartNewChatWithUser,
  currentUser,
  searchTerm,
}) => {
  const { t } = useTranslation();

  if (!searchTerm) return null;

  return (
    <div className="py-2">
      {filteredConversations.length > 0 && (
        <div className="mb-4">
          <p className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
            {t("messenger.conversations")}
          </p>
          {filteredConversations.map((conversation) => {
            const isGroup = conversation.isGroupChat;
            const otherUser = !isGroup
              ? conversation.participants?.find(
                  (p) => (p.userId || p.id) !== currentUser?.id
                )
              : null;

            return (
              <div
                key={conversation.id}
                className="px-3 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
                onClick={() => onSelectConversation(conversation)}
              >
                {isGroup ? (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                    <FaUsers className="text-white" size={16} />
                  </div>
                ) : (
                  <img
                    src={otherUser?.userImage || "/default-avatar.png"}
                    alt="avatar"
                    className="w-10 h-10 rounded-full mr-3 object-cover"
                  />
                )}
                <div>
                  <p className="text-white">
                    {isGroup
                      ? conversation.name
                      : otherUser?.userFullname || "User"}
                  </p>
                  {isGroup && (
                    <p className="text-gray-400 text-xs">
                      {conversation.participants?.length || 0}{" "}
                      {t("messenger.members")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {friendsWithoutConversation.length > 0 && (
        <div>
          <p className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
            {t("messenger.friends")}
          </p>
          {friendsWithoutConversation.map((user) => (
            <div
              key={user.id}
              className="px-3 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
              onClick={() => onStartNewChatWithUser(user.id)}
            >
              <img
                src={user.userImage || "/default-avatar.png"}
                alt="avatar"
                className="w-10 h-10 rounded-full mr-3 object-cover"
              />
              <div>
                <p className="text-white">{user.userFullname}</p>
                <p className="text-gray-400 text-xs">@{user.userNickname}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredConversations.length === 0 &&
        friendsWithoutConversation.length === 0 && (
          <p className="text-center text-gray-500 py-4">
            {t("messenger.noResultsFound")}
          </p>
        )}
    </div>
  );
};

const MessengerPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const [datafriend, setDatafriend] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  const currentUser = useSelector((state) => state.login?.userInfo);
  console.log(currentUser);
  const {
    conversations,
    currentConversation,
    messages,
    loading,
    webSocketConnected,
  } = useSelector((state) => state.chat);
  const {
    callUser,
    answerCall,
    leaveCall,
    receivingCall,
    callAccepted,
    isVideoCallActive,
    stream,
    remoteStream,
    caller,
    name,
    socketRef,
    selectedCameraId,
    setSelectedCameraId,
    availableCameras,
    listCameras,
  } = useWebSocket();

  const [newMessage, setNewMessage] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [allLoaded, setAllLoaded] = useState(false);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const [idfriend, setIdfriend] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const [showFullSearch, setShowFullSearch] = useState(false); // Thêm state mới để kiểm soát hiển thị thanh tìm kiếm
  const [friendCandidates, setFriendCandidates] = useState([]); // Thêm state để lưu danh sách bạn bè
  const [showDetails, setShowDetails] = useState(false);
  // Add a new state for blocking status
  const [isUserBlocked, setIsUserBlocked] = useState(false);

  // Sửa lại useEffect để đảm bảo thứ tự khởi tạo đúng
  useEffect(() => {
    if (currentUser?.id) {
      // Đặt userId vào Redux trước
      dispatch(setCurrentUserId(currentUser.id));

      // Lưu userId vào localStorage để WebSocketService có thể lấy trong mọi tình huống
      localStorage.setItem("userId", currentUser.id);

      // Sau khi đã lưu userId, mới khởi tạo WebSocket
      webSocketService.init(dispatch);

      // KHÔNG gọi connect() ở đây, để đến khi cần thiết mới kết nối

      // Lấy danh sách conversation
      dispatch(getConversations(currentUser.id));
    }

    return () => {
      dispatch(resetChatState());
      // Đảm bảo disconnect WebSocket khi component unmount
      webSocketService.disconnect();
    };
  }, [currentUser?.id, dispatch]);

  // Thêm useEffect mới để xử lý kết nối WebSocket khi cần thiết
  useEffect(() => {
    // Chỉ connect khi đã có currentUser và chưa kết nối
    if (currentUser?.id && !webSocketConnected) {
      webSocketService
        .connect()
        .then(() => {
          console.log("WebSocket connected successfully in MessengerPage");
          // Sau khi kết nối thành công, mới subscribe
          return webSocketService.subscribeToUserMessages();
        })
        .catch((err) => {
          console.error("Failed to connect WebSocket:", err);
        });
    }
  }, [currentUser?.id, webSocketConnected]);

  useEffect(() => {
    if (conversationId && currentUser?.id) {
      const conversationIdInt = parseInt(conversationId);

      setPage(1);
      setAllLoaded(false);

      console.log(
        `Current conversation changed to ${conversationIdInt}, loading data...`
      );

      // Thêm đoạn kiểm tra quyền truy cập conversation
      instance
        .get(
          `/chat/check-access?conversationId=${conversationIdInt}&userId=${currentUser.id}`
        )
        .then((response) => {
          if (response.data.hasAccess) {
            // Nếu có quyền, mới tiếp tục lấy dữ liệu
            dispatch(setActiveConversation(conversationIdInt));

            dispatch(
              getConversationDetails({
                conversationId: conversationIdInt,
                userId: currentUser.id,
              })
            );

            dispatch(
              getMessagesByConversation({
                conversationId: conversationIdInt,
                userId: currentUser.id,
                page: 0,
                size: 20,
              })
            );

            webSocketService.subscribeToConversation(conversationIdInt);
          } else {
            console.error(
              "You don't have permission to access this conversation"
            );
            navigate("/user/chat"); // Chuyển về trang chính của chat
          }
        })
        .catch((error) => {
          console.error("Error checking conversation access:", error);
          navigate("/user/chat"); // Chuyển về trang chính của chat
        });
    } else if (currentUser?.id) {
      // Khi không có conversationId, đảm bảo reset trạng thái và hiển thị trang chào mừng
      dispatch(resetMessages());
      dispatch({ type: "chat/setActiveConversation", payload: null });
    }
  }, [conversationId, currentUser?.id, dispatch, navigate]);

  // Thêm useEffect mới để xử lý việc reset state khi không có conversationId
  useEffect(() => {
    // Khi component được mount mà không có conversationId, reset trạng thái
    if (!conversationId && currentUser?.id) {
      dispatch(resetMessages());
      dispatch({ type: "chat/setActiveConversation", payload: null });
    }
  }, []);

  // Theo dõi thay đổi currentConversation để load dữ liệu
  useEffect(() => {
    if (currentConversation?.id && currentUser?.id) {
      console.log(
        `Current conversation changed to ${currentConversation.id}, loading data...`
      );
      setPage(0);
      setAllLoaded(false);
      dispatch(
        getConversationDetails({
          conversationId: currentConversation.id,
          userId: currentUser.id,
        })
      );
      dispatch(
        getMessagesByConversation({
          conversationId: currentConversation.id,
          userId: currentUser.id,
          page: 0,
          size: 20,
        })
      );
    }
  }, [currentConversation?.id, currentUser?.id, dispatch]);

  useEffect(() => {
    if (!webSocketConnected && currentConversation) {
      const timer = setTimeout(() => {
        setShowConnectionWarning(true);
      }, 3000); // Chỉ hiện cảnh báo sau 3 giây không kết nối được

      return () => clearTimeout(timer);
    } else {
      setShowConnectionWarning(false);
    }
  }, [webSocketConnected, currentConversation]);

  // Cải thiện useEffect cho WebSocket
  useEffect(() => {
    if (currentConversation?.id && currentUser?.id) {
      console.log(
        `Setting up WebSocket for conversation ${currentConversation.id}`
      );

      const connectAndSubscribe = async (retries = 3) => {
        try {
          // Đảm bảo WebSocket đã kết nối
          if (!webSocketConnected) {
            console.log("WebSocket not connected, connecting first...");
            try {
              await webSocketService.connect();
            } catch (err) {
              console.error("WebSocket connection failed:", err);
            }
          }

          // Đơn giản hóa - sử dụng trực tiếp để tránh gọi ensureConnected
          try {
            // Subscribe vào cuộc trò chuyện bằng cách gọi _doSubscribeToConversation trực tiếp
            if (webSocketService.stompClient && webSocketService.connected) {
              webSocketService._doSubscribeToConversation(
                currentConversation.id
              );
            }

            // Chỉ mark as read nếu còn unread và đã connected
            if (currentConversation.unreadCount > 0 && webSocketConnected) {
              await webSocketService.markAsRead(
                currentConversation.id,
                currentUser.id
              );
            }
          } catch (error) {
            console.error("Error in subscription:", error);
          }
        } catch (error) {
          if (retries > 0) {
            console.log(
              `Retrying WebSocket setup (${retries} attempts left)...`
            );
            setTimeout(() => connectAndSubscribe(retries - 1), 1000);
          } else {
            console.error(
              "Failed to setup WebSocket after multiple attempts:",
              error
            );
          }
        }
      };

      connectAndSubscribe();
    }
  }, [currentConversation?.id, currentUser?.id, webSocketConnected]);

  // Thêm effect để đảm bảo kết nối WebSocket với giải pháp retry tốt hơn
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimer = null;

    const attemptReconnect = async () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log("Maximum reconnect attempts reached, giving up");
        setShowConnectionWarning(true);
        return;
      }

      if (currentUser?.id && !webSocketConnected) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

        console.log(
          `Attempting to connect WebSocket (try ${reconnectAttempts}/${maxReconnectAttempts}) in ${
            delay / 1000
          }s...`
        );

        try {
          await webSocketService.connect();
          console.log("WebSocket connected successfully on reconnect");
          reconnectAttempts = 0;
          setShowConnectionWarning(false);
        } catch (err) {
          console.error("Failed to connect WebSocket:", err);

          // Schedule next retry with exponential backoff
          reconnectTimer = setTimeout(attemptReconnect, delay);
        }
      }
    };

    if (currentUser?.id && !webSocketConnected) {
      attemptReconnect();
    } else {
      setShowConnectionWarning(false);
    }

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [currentUser?.id, webSocketConnected]);

  // Thêm một useEffect mới để đảm bảo nhận tin nhắn
  useEffect(() => {
    // Tạo interval để kiểm tra tin nhắn mới mỗi 10 giây
    let messageRefreshInterval;

    if (currentConversation?.id && currentUser?.id) {
      messageRefreshInterval = setInterval(() => {
        // Kiểm tra nếu WebSocket không được kết nối, thì tải lại tin nhắn qua API
        if (!webSocketConnected) {
          console.log(
            "WebSocket not connected, refreshing messages via API..."
          );
          dispatch(
            getMessagesByConversation({
              conversationId: currentConversation.id,
              userId: currentUser.id,
              page: 0,
              size: 20,
            })
          );
        }
      }, 10000); // 10 giây
    }

    return () => {
      if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
      }
    };
  }, [currentConversation?.id, currentUser?.id, webSocketConnected, dispatch]);

  useEffect(() => {
    if (messageInputRef.current && currentConversation) {
      setTimeout(() => {
        try {
          messageInputRef.current.focus();
        } catch (error) {
          console.warn("Could not focus input:", error);
        }
      }, 100);
    }
  }, [currentConversation]);

  useEffect(() => {
    if (currentConversation) {
      console.log("Current conversation structure:", currentConversation);
      console.log("Participants:", currentConversation.participants);
    }
  }, [currentConversation]);

  useEffect(() => {
    if (currentConversation) {
      console.log("Current conversation structure:", currentConversation);
      console.log(
        "Participants:",
        currentConversation.participants || "undefined"
      );
      if (!currentConversation.participants) {
        console.warn(
          "Participants missing - API might not be returning complete data"
        );
      }
    }
  }, [currentConversation]);

  const handleSelectConversation = useCallback(
    (conversation) => {
      if (!conversation || !conversation.id) return;

      dispatch({ type: "chat/setLoading", payload: true });

      dispatch(resetMessages());

      dispatch(setActiveConversation(conversation.id));

      navigate(`/user/chat/${conversation.id}`);

      if (currentUser?.id) {
        dispatch(
          getConversationDetails({
            conversationId: conversation.id,
            userId: currentUser.id,
          })
        );

        dispatch(
          getMessagesByConversation({
            conversationId: conversation.id,
            userId: currentUser.id,
            page: 0,
            size: 20,
          })
        );

        // THÊM: Đảm bảo subscription
        if (webSocketService.stompClient && webSocketService.connected) {
          try {
            webSocketService._doSubscribeToConversation(conversation.id);
          } catch (err) {
            console.error("Error subscribing to conversation:", err);
          }
        }
      }

      if (
        conversation.unreadCount > 0 &&
        currentUser?.id &&
        webSocketConnected
      ) {
        webSocketService
          .markAsRead(conversation.id, currentUser.id)
          .catch((err) => {
            console.error("Error marking messages as read:", err);
            dispatch(
              markMessagesAsRead({
                conversationId: conversation.id,
                userId: currentUser.id,
              })
            );
          });
      }
    },
    [navigate, currentUser?.id, webSocketConnected, dispatch]
  );

  const handleNewConversation = useCallback(
    async (userId) => {
      if (!currentUser?.id || !userId) return;

      try {
        const resultAction = await dispatch(
          getOrCreateConversation({
            userId: currentUser.id,
            otherUserId: userId,
          })
        );

        if (
          getOrCreateConversation.fulfilled.match(resultAction) &&
          resultAction.payload
        ) {
          navigate(`/user/chat/${resultAction.payload.id}`);
          setShowNewConversation(false);
        }
      } catch (error) {
        console.error("Error creating conversation:", error);
      }
    },
    [currentUser?.id, dispatch, navigate]
  );

  const handleSendMessage = async (customContent) => {
    const messageContent = customContent || newMessage.trim();
    if (!messageContent || !currentConversation?.id || !currentUser?.id) return;

    if (!customContent) {
      setNewMessage("");
    }

    const tempId = `temp-${uuidv4()}`;
    const now = new Date().toISOString();

    const messageData = {
      tempId,
      conversationId: currentConversation.id,
      senderId: currentUser.id,
      content: messageContent,
      createdAt: now,
      senderName: currentUser.userFullname,
      senderAvatar: currentUser.userImage || "/default-avatar.png",
      pending: true,
    };

    setNewMessage("");
    dispatch(addMessage(messageData));
    setForceUpdate((prev) => prev + 1); // Trigger re-render của MessageList

    try {
      console.log("Sending message to API:", messageData);

      const apiMessage = {
        conversationId: currentConversation.id,
        senderId: currentUser.id,
        content: messageData.content,
      };

      if (!webSocketConnected) {
        try {
          await webSocketService.connect();
        } catch (wsError) {
          console.warn(
            "Connection attempt failed, will proceed with API:",
            wsError
          );
        }
      }

      const resultAction = await dispatch(sendMessage(apiMessage));

      if (sendMessage.fulfilled.match(resultAction)) {
        console.log("Message saved successfully:", resultAction.payload);

        const savedMessage = resultAction.payload;

        if (savedMessage?.id) {
          dispatch(updateConversationWithLatestMessage(savedMessage));
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      dispatch(
        updateMessageStatus({
          tempId,
          status: "failed",
        })
      );
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (!currentConversation?.id || !currentUser?.id || loading || allLoaded)
      return;

    try {
      console.log(
        `Loading more messages for conversation ${
          currentConversation.id
        }, page ${page + 1}`
      );
      const nextPage = page + 1;
      const resultAction = await dispatch(
        getMoreMessagesByConversation({
          conversationId: currentConversation.id,
          userId: currentUser.id,
          page: nextPage,
          size: 20,
        })
      );

      if (getMoreMessagesByConversation.fulfilled.match(resultAction)) {
        const payload = resultAction.payload || [];
        console.log(`Received ${payload.length} older messages`);

        if (payload.length === 0) {
          setAllLoaded(true);
          console.log(
            "No more messages to load - reached beginning of conversation"
          );
        } else {
          setPage(nextPage);
        }
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    }
  }, [
    currentConversation?.id,
    currentUser?.id,
    page,
    loading,
    allLoaded,
    dispatch,
  ]);

  const handleCreateGroup = async ({ name, userIds }) => {
    try {
      const res = await instance.post("/chat/group", { name, userIds });
      if (res.data && res.data.id) {
        // Sau khi tạo nhóm, chuyển sang màn hình chat nhóm
        navigate(`/user/chat/${res.data.id}`);
        setShowNewConversation(false); // Đổi tên biến cho đúng
        dispatch(getConversations(currentUser.id));
      }
    } catch (e) {
      // Xử lý lỗi
    }
  };

  const filteredConversations = searchTerm
    ? conversations.filter((conv) => {
        const otherUser = conv.participants?.find(
          (p) => (p.userId || p.id) !== currentUser?.id
        );
        return otherUser?.userFullname
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());
      })
    : conversations;

  const getConversationHeader = () => {
    if (!currentConversation) return null;

    if (currentConversation.isGroupChat) {
      return {
        name: currentConversation.name || t("messenger.groupChat"),
        image: "/group-avatar.png",
        isGroup: true,
        participantCount: currentConversation.participants?.length || 0,
      };
    }

    // Logic cũ xử lý chat 1-1
    if (currentConversation.participants) {
      const otherUser = currentConversation.participants.find(
        (p) => (p.userId || p.id) !== currentUser?.id
      );
      if (otherUser) {
        return {
          name: otherUser.userFullname,
          image: otherUser.userImage || "/default-avatar.png",
          isGroup: false,
        };
      }
    }

    // Fallback từ tên conversation
    if (
      currentConversation.name &&
      currentConversation.name.includes("between")
    ) {
      const nameParts = currentConversation.name
        .replace("Chat between ", "")
        .split(" and ");
      const otherUserName = nameParts.find(
        (name) =>
          !name.toLowerCase().includes(currentUser?.userNickname?.toLowerCase())
      );

      return {
        name: otherUserName,
        image: "/default-avatar.png",
        isGroup: false,
      };
    }

    return {
      name: t("messenger.untitled"),
      image: "/default-avatar.png",
      isGroup: false,
    };
  };

  useEffect(() => {
    if (currentConversation?.participants) {
      let idFr = currentConversation.participants.find(
        (p) => (p.userId || p.id) !== currentUser?.id
      );

      setDatafriend(idFr);
      setIdfriend(idFr.userId);
    }
  }, [currentConversation]);

  const headerInfo = getConversationHeader();

  const handleCameraSelect = (cameraId) => {
    setSelectedCameraId(cameraId);
  };

  const handleVideoCall = async () => {
    try {
      await callUser(idfriend);
    } catch (error) {
      console.error("Error starting video call:", error);
    }
  };

  const handleAcceptCall = async () => {
    try {
      await answerCall();
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  };

  const handleRejectCall = () => {
    leaveCall();
  };

  const handleEndCall = () => {
    if (window.confirm("Bạn có chắc chắn muốn kết thúc cuộc gọi?")) {
      leaveCall();
    }
  };

  const handleMarkAsRead = () => {
    if (currentConversation && currentUser?.id) {
      dispatch(
        markMessagesAsRead({
          conversationId: currentConversation.id,
          userId: currentUser.id,
        })
      );
    }
  };

  // Thêm effect để xử lý khi cuộc gọi bị kết thúc từ phía bên kia
  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      const handleCallEnded = () => {
        // Tự động kết thúc cuộc gọi khi bên kia kết thúc
        leaveCall();
      };

      socket.on("callEnded", handleCallEnded);

      return () => {
        socket.off("callEnded", handleCallEnded);
      };
    }
  }, [socketRef, leaveCall]);

  // Thêm useEffect để lấy danh sách bạn bè khi tìm kiếm
  useEffect(() => {
    const fetchFriends = async () => {
      if (!searchTerm || !currentUser?.id) {
        setFriendCandidates([]);
        return;
      }

      try {
        // Lấy danh sách người mà user đang theo dõi
        const followingRes = await instance.get(
          `/follow/following/${currentUser.id}`
        );
        const followingData = followingRes.data || [];

        // Lọc lấy những người có is_friend = true
        const friends = followingData
          .filter((item) => item.friend === true)
          .map((item) => item.following)
          .filter(
            (friend) =>
              friend.userFullname
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              friend.userNickname
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          );

        // Lọc ra những người chưa có conversation
        const conversationUserIds = conversations
          .filter((conv) => !conv.isGroupChat)
          .flatMap((conv) =>
            conv.participants
              ?.filter((p) => (p.userId || p.id) !== currentUser.id)
              .map((p) => p.userId || p.id)
          );

        const friendsWithoutConversations = friends.filter(
          (friend) => !conversationUserIds.includes(friend.id)
        );

        setFriendCandidates(friendsWithoutConversations);
      } catch (error) {
        console.error("Error fetching friends:", error);
        setFriendCandidates([]);
      }
    };

    fetchFriends();
  }, [searchTerm, currentUser?.id, conversations]);

  // Add a useEffect to check block status when conversation changes
  useEffect(() => {
    if (currentConversation && !currentConversation.isGroupChat && currentConversation.participants?.length === 2) {
      const otherUser = currentConversation.participants.find(
        p => (p.userId || p.id) !== currentUser?.id
      );
      
      if (otherUser && currentUser) {
        checkBlockStatus(otherUser.userId || otherUser.id, currentUser.id);
      }
    } else {
      setIsUserBlocked(false);
    }
  }, [currentConversation, currentUser]);

  // Add this function to check block status
  const checkBlockStatus = async (otherUserId, userId) => {
    try {
      const response = await instance.get(`/chat/block-status?userId=${userId}&otherUserId=${otherUserId}`);
      setIsUserBlocked(response.data.isBlocked || false);
    } catch (error) {
      console.error("Error checking block status:", error);
      setIsUserBlocked(false);
    }
  };

  // Sửa lại phần render để hiển thị trang chào mừng đúng cách
  return (
    <div className="flex h-screen bg-black w-full">
      {/* Conversation List */}
      {/* <div className="w-1/3 border-r border-gray-700 bg-gray-900"> */}
      <div className="w-[400px] border-r border-gray-700 bg-gray-900 ">
        <ConversationList
          conversations={filteredConversations}
          currentConversationId={currentConversation?.id}
          onSelectConversation={handleSelectConversation}
          loading={loading}
          setShowNewConversation={setShowNewConversation}
          onSearch={setSearchTerm}
          searchTerm={searchTerm}
          onStartNewChatWithUser={handleNewConversation}
          currentUser={currentUser}
        />
      </div>

      {/* Messages Area */}
      {/* <div className="w-2/3 flex flex-col bg-black"> */}
      <div className="flex-1 flex flex-col bg-black">
        {currentConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center">
                {headerInfo.isGroup ? (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                    <FaUsers className="text-white" size={18} />
                  </div>
                ) : (
                  <img
                    src={headerInfo.image}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover mr-3"
                  />
                )}
                <div>
                  <h3 className="font-medium text-white">
                    {headerInfo.name}
                    {headerInfo.isGroup && (
                      <span className="text-xs text-gray-400 ml-2">
                        ({headerInfo.participantCount} {t("messenger.members")})
                      </span>
                    )}
                  </h3>
                </div>
              </div>
              <div className="flex">
                <button className="text-gray-400 hover:text-white p-2">
                  <FaPhone />
                </button>

                <div className="flex items-center space-x-4">
                  <button
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                    title={t("messenger.videoCall") || "Gọi video"}
                    onClick={() => handleVideoCall()}
                  >
                    <FaVideo className="text-gray-600 text-lg" />
                  </button>
                </div>
                <button 
                  className="text-gray-400 hover:text-white p-2"
                  onClick={() => setShowDetails(true)}
                >
                  <FaInfoCircle />
                </button>
              </div>
            </div>

            {showConnectionWarning && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-2">
                <div className="flex items-center">
                  <div className="py-1">
                    <svg
                      className="h-6 w-6 text-yellow-500 mr-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-yellow-700">
                      {t("messenger.connectionLost")}
                    </p>
                    <button
                      onClick={() => webSocketService.connect()}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {t("messenger.reconnect")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Message List */}
            <div className="flex-1 overflow-hidden">
              {currentConversation && (
                <MessageList
                  messages={messages}
                  currentUserId={currentUser?.id}
                  selectedUser={headerInfo} // Thay otherUser bằng headerInfo đã tính toán
                  loading={loading}
                  onLoadMore={handleLoadMore} // Sử dụng handleLoadMore đã được định nghĩa
                  allLoaded={allLoaded}
                  forceUpdate={forceUpdate}
                  isGroupChat={currentConversation.isGroupChat}
                  participants={currentConversation.participants}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onSend={handleSendMessage}
              inputRef={messageInputRef}
              isBlocked={isUserBlocked}
              onFocus={handleMarkAsRead} // <-- thêm dòng này
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <img
              src="/images/messages-welcome.png"
              alt="Welcome"
              className="w-24 h-24 mb-6 opacity-50"
            />
            <h3 className="text-xl font-medium text-gray-300 mb-4">
              {t("messenger.welcomeToChat") || "Chào mừng đến với tin nhắn"}
            </h3>

            {!showFullSearch ? (
              <>
                <p className="text-center text-gray-500 mb-6 max-w-md">
                  {t("messenger.selectConversation") ||
                    "Chọn một cuộc trò chuyện từ danh sách hoặc tìm kiếm"}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowFullSearch(true)}
                    className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t("messenger.findConversations") || "Tìm cuộc trò chuyện"}
                  </button>

                  <button
                    onClick={() => setShowNewConversation(true)}
                    className="flex items-center px-5 py-2 border border-blue-600 text-blue-500 rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t("messenger.createNewGroup") || "Tạo nhóm chat mới"}
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full max-w-md">
                <SearchBar
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  className="mb-5"
                />

                {searchTerm && (
                  <div className="bg-gray-900 rounded-lg max-h-80 overflow-y-auto">
                    {/* Hiển thị kết quả tìm kiếm ở đây - dùng logic tương tự của ConversationList */}
                    <SearchResults
                      filteredConversations={filteredConversations}
                      friendsWithoutConversation={friendCandidates} // Cần định nghĩa state này
                      onSelectConversation={handleSelectConversation}
                      onStartNewChatWithUser={handleNewConversation}
                      currentUser={currentUser}
                      searchTerm={searchTerm}
                    />
                  </div>
                )}

                <button
                  className="mt-4 text-blue-500 flex items-center"
                  onClick={() => {
                    setShowFullSearch(false);
                    setSearchTerm("");
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("messenger.back") || "Quay lại"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Search Modal */}
      <UserSearchModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onSelectUser={handleNewConversation}
        onCreateGroup={handleCreateGroup}
        currentUserId={currentUser?.id}
      />
      {receivingCall && !callAccepted && (
        <IncomingCallModal
          caller={{
            userFullname: name,
            userImage: datafriend?.userImage,
          }}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
      {isVideoCallActive && (
        <VideoCallModal
          stream={stream}
          remoteStream={remoteStream}
          onEndCall={handleEndCall}
          callAccepted={callAccepted}
          name={name}
        />
      )}
      {/* Conversation Details Panel */}
      {showDetails && currentConversation && (
        <div className="w-1/4 min-w-[300px]">
          <ConversationDetails 
            conversation={currentConversation} 
            onClose={() => setShowDetails(false)}
            currentUser={currentUser}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(MessengerPage);
