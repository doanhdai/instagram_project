import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import instance from '../../Utils/AxiosApi/Axios';
import webSocketService from '../../Service/WebSocketService'; 

const updateConversationWithNewMessage = (state, message) => {
  if (!message || !message.conversationId) {
    console.error('Invalid message format for updateConversation:', message);
    return;
  }
  
  const conversationIndex = state.conversations.findIndex(
    c => c.id === message.conversationId
  );
  
  if (conversationIndex >= 0) {
    state.conversations[conversationIndex].lastMessage = message;
    if (message.senderId !== state.currentUserId) {
      state.conversations[conversationIndex].unreadCount = 
        (state.conversations[conversationIndex].unreadCount || 0) + 1;
    }
    const updatedConversation = state.conversations[conversationIndex];
    state.conversations.splice(conversationIndex, 1);
    state.conversations.unshift(updatedConversation);
  }
};

export const getConversations = createAsyncThunk(
  'chat/getConversations',
  async (userId) => {
    try {
      const response = await instance.get(`/chat/conversations/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }
);

export const getMessagesByConversation = createAsyncThunk(
  "chat/getMessagesByConversation",
  async ({ conversationId, userId, page, size }, { rejectWithValue }) => {
    try {
      if (!conversationId) return rejectWithValue("Missing conversationId");
      if (!userId) return rejectWithValue("Missing userId");
      
      const response = await instance.get(
        `/chat/messages?conversationId=${conversationId}&userId=${userId}&page=${page || 0}&size=${size || 20}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (error.response?.status === 400) {
        return rejectWithValue({
          status: 400,
          message: "You don't have permission to access messages in this conversation",
          originalError: error.message
        });
      }
      return rejectWithValue(error.message);
    }
  }
);

export const getOrCreateConversation = createAsyncThunk(
  'chat/getOrCreateConversation',
  async ({ userId, otherUserId }) => {
    try {
      const response = await instance.get(
        `/chat/conversation?userId=${userId}&otherUserId=${otherUserId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (message) => {
    try {
      // Sửa đường dẫn từ /chat/messages thành /messages
      console.log('Sending message to API endpoint:', message);
      const response = await instance.post('/messages', message);
      console.log('Response from message API:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending message via API:', error);
      throw error;
    }
  }
);

export const getMoreMessagesByConversation = createAsyncThunk(
  'chat/getMoreMessagesByConversation',
  async ({ conversationId, userId, page, size }) => {
    const response = await instance.get(
      `/chat/messages?conversationId=${conversationId}&userId=${userId}&page=${page}&size=${size || 20}`
    );
    return response.data;
  }
);

export const getConversationDetails = createAsyncThunk(
  'chat/getConversationDetails',
  async ({ conversationId, userId }) => {
    if (!userId || !conversationId) throw new Error("Missing userId or conversationId");
    const response = await instance.get(
      `/chat/conversation/${conversationId}?userId=${userId}`
    );
    return response.data;
  }
);

const reconnectWebSocket = createAsyncThunk(
  'chat/reconnectWebSocket',
  async (_, { getState }) => {
    const state = getState();
    if (state.chat.currentConversation?.id && state.chat.currentUserId) {
      try {
        await webSocketService.connect();
        if (state.chat.currentConversation?.id) {
          await webSocketService.subscribeToConversation(state.chat.currentConversation.id);
        }
        return true;
      } catch (error) {
        console.error('Failed to reconnect WebSocket:', error);
        throw error;
      }
    }
    return false;
  }
);

const initialState = {
  conversations: [],
  messages: [],
  currentConversation: null,
  currentUserId: null,
  loading: false,
  error: null,
  webSocketConnected: false
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      const message = action.payload;
      console.log('Adding message to store:', message);
      
      if (!message || !message.conversationId) {
        console.error('Invalid message format:', message);
        return;
      }
      
      const isDuplicate = state.messages.some(msg => 
        (msg.id && msg.id === message.id) ||
        (msg.tempId && message.tempId && msg.tempId === message.tempId) ||
        (msg.content === message.content && 
         msg.senderId === message.senderId && 
         msg.conversationId === message.conversationId &&
         Math.abs(new Date(msg.createdAt || 0) - new Date(message.createdAt || 0)) < 2000)
      );
      
      if (isDuplicate) {
        console.log('Duplicate message detected, ignoring:', message);
        return;
      }
      
      console.log('New message added to store:', message);
    
      if (state.currentConversation?.id === message.conversationId) {
        state.messages.push(message);
      } 

      const conversationIndex = state.conversations.findIndex(
        c => c.id === message.conversationId
      );
      
      if (conversationIndex >= 0) {
        state.conversations[conversationIndex].lastMessage = message;

        if (message.senderId !== state.currentUserId) {
          state.conversations[conversationIndex].unreadCount = 
            (state.conversations[conversationIndex].unreadCount || 0) + 1;
        }

        const updatedConversation = state.conversations[conversationIndex];
        state.conversations.splice(conversationIndex, 1);
        state.conversations.unshift(updatedConversation);
      }
    },
    
    markMessagesAsRead: (state, action) => {
      const { conversationId, userId } = action.payload;
      
      if (!conversationId || !userId) {
        console.error('Invalid markMessagesAsRead payload:', action.payload);
        return;
      }

      state.messages.forEach(msg => {
        if (msg.conversationId === conversationId && msg.senderId !== userId) {
          msg.isRead = true;
        }
      });

      const conversationIndex = state.conversations.findIndex(
        c => c.id === conversationId
      );
      
      if (conversationIndex >= 0) {
        state.conversations[conversationIndex].unreadCount = 0;
        
        if (state.conversations[conversationIndex].lastMessage) {
          state.conversations[conversationIndex].lastMessage.isRead = true;
        }
      }
    },
    
    setActiveConversation: (state, action) => {
      const conversationId = action.payload;
      const conversation = state.conversations.find(c => c.id === conversationId);
      state.currentConversation = conversation || null;
    },
    
    setCurrentUserId: (state, action) => {
      state.currentUserId = action.payload;
    },
    
    setWebSocketConnected: (state, action) => {
      state.webSocketConnected = action.payload;
    },
    
    resetChatState: (state) => {
      state.messages = [];
    },
    
    updateConversationWithLatestMessage: (state, action) => {
      const message = action.payload;
      
      if (!message || !message.conversationId) {
        console.error('Invalid message format for updateConversation:', message);
        return;
      }
      
      const conversationIndex = state.conversations.findIndex(
        c => c.id === message.conversationId
      );
      
      if (conversationIndex >= 0) {
      
        state.conversations[conversationIndex].lastMessage = message;

        if (message.senderId !== state.currentUserId) {
          state.conversations[conversationIndex].unreadCount = 
            (state.conversations[conversationIndex].unreadCount || 0) + 1;
        }

        const updatedConversation = state.conversations[conversationIndex];
        state.conversations.splice(conversationIndex, 1);
        state.conversations.unshift(updatedConversation);
      } else {
        console.log(`Conversation ${message.conversationId} not found in list, may need to reload`);
      }
    },

    updateMessageStatus: (state, action) => {
      const { tempId, status } = action.payload;
      
      const messageIndex = state.messages.findIndex(
        msg => msg.tempId === tempId
      );
      
      if (messageIndex >= 0) {
        state.messages[messageIndex] = {
          ...state.messages[messageIndex],
          status
        };
      }
    },

    resetMessages: (state) => {
      state.messages = [];
    },

    resetMessages: (state) => {
      state.messages = [];
    },

    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    updateConversationName: (state, action) => {
      const { conversationId, name } = action.payload;
      
      const conversationIndex = state.conversations.findIndex(
        c => c.id === conversationId
      );
      
      if (conversationIndex >= 0) {
        state.conversations[conversationIndex].name = name;
      }
    
      if (state.currentConversation && state.currentConversation.id === conversationId) {
        state.currentConversation.name = name;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConversations.fulfilled, (state, action) => {
        state.conversations = action.payload || [];
        state.loading = false;
      })
      .addCase(getConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      .addCase(getMessagesByConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMessagesByConversation.fulfilled, (state, action) => {
        state.messages = action.payload || [];
        state.loading = false;
      })
      .addCase(getMessagesByConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
        if (action.payload?.status === 400) {
          console.error("Permission denied:", action.payload.message);
        }
      })

      .addCase(getOrCreateConversation.fulfilled, (state, action) => {
        if (!action.payload) return;

        const exists = state.conversations.find(c => c.id === action.payload.id);
        if (!exists) {
          state.conversations.unshift(action.payload);
        }

        state.currentConversation = action.payload;
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        if (!action.payload) return;

        const tempIndex = state.messages.findIndex(
          msg => msg.tempId && msg.conversationId === action.payload.conversationId && 
                 msg.content === action.payload.content
        );
        
        if (tempIndex >= 0) {
          state.messages[tempIndex] = {
            ...state.messages[tempIndex],
            ...action.payload,
            pending: false
          };
        }
      })

      .addCase(getMoreMessagesByConversation.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(getMoreMessagesByConversation.fulfilled, (state, action) => {
        state.loadingMore = false;
        if (!action.payload) return;
        
        console.log(`Processing ${action.payload.length} older messages`);
     
        const newMessages = action.payload.filter(
          newMsg => !state.messages.some(existingMsg => 
            (existingMsg.id && existingMsg.id === newMsg.id) || 
            (existingMsg.tempId && newMsg.tempId && existingMsg.tempId === newMsg.tempId)
          )
        );
        
        console.log(`Adding ${newMessages.length} unique older messages`);
        state.messages = [...newMessages, ...state.messages];
      })
      
      .addCase(getConversationDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        
        console.log('Conversation details received:', action.payload);

        if (!action.payload.participants) {
  
          if (action.payload.name && action.payload.name.includes('between')) {
            const nameParts = action.payload.name.replace('Chat between ', '').split(' and ');
          
            action.payload.participants = nameParts.map(name => ({
              userNickname: name,
              userFullname: name,
              userImage: '/default-avatar.png'
            }));
            
            console.log('Created placeholder participants from conversation name:', 
              action.payload.participants);
          } else {
            action.payload.participants = [];
            console.warn('No participants data in API response, using empty array');
          }
        }

        state.currentConversation = action.payload;

        const index = state.conversations.findIndex(c => c.id === action.payload.id);
        if (index >= 0) {
          state.conversations[index] = {
            ...state.conversations[index],
            ...action.payload
          };
        }
      })

      .addCase(reconnectWebSocket.fulfilled, (state) => {
        state.webSocketConnected = true;
      })
      .addCase(reconnectWebSocket.rejected, (state) => {
        state.webSocketConnected = false;
      })

      // Thêm các action và reducer mới để xử lý trạng thái WebSocket tốt hơn
      .addCase('WEBSOCKET_CONNECTING', (state) => {
        state.webSocketConnecting = true;
      })
      .addCase('WEBSOCKET_CONNECTED', (state) => {
        state.webSocketConnecting = false;
        state.webSocketConnected = true;
        state.webSocketError = null;
      })
      .addCase('WEBSOCKET_DISCONNECTED', (state) => {
        state.webSocketConnecting = false;
        state.webSocketConnected = false;
      })
      .addCase('WEBSOCKET_ERROR', (state, action) => {
        state.webSocketConnecting = false;
        state.webSocketConnected = false;
        state.webSocketError = action.payload;
      })
      .addCase(getConversationById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
        
        // Hiển thị thông báo lỗi phù hợp với người dùng
        if (action.payload?.status === 400) {
          // Có thể dispatch một action khác để hiển thị thông báo
          console.error("Permission denied:", action.payload.message);
        }
      });
  }
});

// Thêm middleware để kiểm tra userId hợp lệ trước khi gọi API
export const getConversationById = createAsyncThunk(
  "chat/getConversationById",
  async ({ conversationId, userId }, { rejectWithValue }) => {
    try {
      // Kiểm tra tính hợp lệ của tham số
      if (!conversationId) return rejectWithValue("Missing conversationId");
      if (!userId) return rejectWithValue("Missing userId");
      
      const response = await instance.get(`/chat/conversation/${conversationId}?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching conversation details:", error);
      // Xử lý lỗi 400 - thường là do không có quyền truy cập
      if (error.response?.status === 400) {
        return rejectWithValue({
          status: 400,
          message: "You don't have permission to access this conversation",
          originalError: error.message
        });
      }
      return rejectWithValue(error.message);
    }
  }
);

export const { 
  addMessage, 
  markMessagesAsRead,
  setActiveConversation,
  setCurrentUserId,
  setWebSocketConnected,
  resetChatState,
  updateMessageStatus,
  updateConversationWithLatestMessage,
  resetMessages, 
  setLoading,
  updateConversationName, 
} = chatSlice.actions;

export default chatSlice.reducer;