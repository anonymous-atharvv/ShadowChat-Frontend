import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [messageReadEvent, setMessageReadEvent] = useState(null); // { readerId }
  const [messageDeletedEvent, setMessageDeletedEvent] = useState(null); // { messageId }
  const [messageEditedEvent, setMessageEditedEvent] = useState(null); // { messageId, newContent }
  const [messageReactionEvent, setMessageReactionEvent] = useState(null); // { messageId, reactions }
  const [friendEvent, setFriendEvent] = useState(null);
  const [noStoreStates, setNoStoreStates] = useState({}); // friendId -> boolean
  const [clearedChatEvent, setClearedChatEvent] = useState(null); // { friendId }
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; setSocket(null); }
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const s = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => { s.emit('get:online'); });
    s.on('online:list', (ids) => setOnlineUsers(new Set(ids)));
    s.on('user:status', ({ userId, isOnline }) => {
      setOnlineUsers(prev => { const n = new Set(prev); isOnline ? n.add(userId) : n.delete(userId); return n; });
    });
    s.on('message:new', (msg) => {
      if (msg.isCover) return; // Discard cover traffic packets silently
      setIncomingMessage(msg);
    });
    s.on('message:read', (data) => setMessageReadEvent(data));
    s.on('message:deleted', (data) => setMessageDeletedEvent(data));
    s.on('message:edited', (data) => setMessageEditedEvent(data));
    s.on('message:reaction:update', (data) => setMessageReactionEvent(data));
    s.on('typing:start', ({ userId }) => setTypingUsers(prev => new Set(prev).add(userId)));
    s.on('typing:stop', ({ userId }) => setTypingUsers(prev => { const n = new Set(prev); n.delete(userId); return n; }));
    s.on('friend:request:received', (data) => setFriendEvent({ type: 'request', ...data }));
    s.on('friend:accepted', (data) => setFriendEvent({ type: 'accepted', ...data }));
    s.on('nostore:toggle', ({ senderId, enabled }) => {
      setNoStoreStates(prev => ({ ...prev, [senderId]: enabled }));
    });
    s.on('chat:cleared', ({ friendId, timeframe }) => {
      setClearedChatEvent({ friendId, timeframe, timestamp: Date.now() });
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, [token, user]);

  const onlineUsersRef = useRef(onlineUsers);
  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  // Cover Traffic (Metadata Guard) Emitter Loop
  useEffect(() => {
    if (!socket || !user) return;

    let timerId = null;

    const scheduleNextCoverTraffic = () => {
      // Random interval between 30s and 300s (30000ms to 300000ms)
      const delay = Math.floor(Math.random() * (300000 - 30000 + 1)) + 30000;
      
      timerId = setTimeout(() => {
        const isEnabled = localStorage.getItem(`sc_metadata_guard_${user.id}`) === 'true';
        const currentOnline = onlineUsersRef.current;
        if (isEnabled && currentOnline && currentOnline.size > 0) {
          // Select a random online friend
          const onlineArr = Array.from(currentOnline);
          const randomFriendId = onlineArr[Math.floor(Math.random() * onlineArr.length)];
          
          if (randomFriendId) {
            // Send empty dummy message payload marked as cover traffic
            socket.emit('message:send', {
              receiverId: randomFriendId,
              content: 'dummy_cover_traffic_' + Math.random().toString(36).substr(2, 9),
              isTemporary: true,
              isCover: true
            });
          }
        }
        // Schedule next cover traffic packet
        scheduleNextCoverTraffic();
      }, delay);
    };

    scheduleNextCoverTraffic();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [socket, user]);

  useEffect(() => {
    if (socket && user?.activeStatusEnabled) {
      socket.emit('get:online');
    } else if (socket && !user?.activeStatusEnabled) {
      setOnlineUsers(new Set());
    }
  }, [socket, user?.activeStatusEnabled]);

  const sendMessage = (receiverId, content, isTemporary = false, image = null, audio = null, replyToMessageId = null, iv = null, isPhantom = false, forgedPersona = null) => { 
    socket?.emit('message:send', { receiverId, content, isTemporary, image, audio, replyToMessageId, iv, isPhantom, forgedPersona }); 
  };
  const editMessage = (messageId, newContent, iv = null) => {
    socket?.emit('message:edit', { messageId, newContent, iv });
  };
  const reactToMessage = (messageId, emoji) => {
    socket?.emit('message:react', { messageId, emoji });
  };
  const startTyping = (receiverId) => { socket?.emit('typing:start', { receiverId }); };
  const stopTyping = (receiverId) => { socket?.emit('typing:stop', { receiverId }); };
  const markRead = (senderId) => { socket?.emit('message:read', { senderId }); };
  const toggleNoStore = (receiverId, enabled) => {
    setNoStoreStates(prev => ({ ...prev, [receiverId]: enabled }));
    socket?.emit('nostore:toggle', { receiverId, enabled });
  };
  const notifyFriendRequest = (toUserId) => { socket?.emit('friend:request', { toUserId }); };
  const notifyFriendAccepted = (toUserId) => { socket?.emit('friend:accepted', { toUserId }); };
  const isOnline = (userId) => user?.activeStatusEnabled ? onlineUsers.has(userId) : false;
  const isTyping = (userId) => typingUsers.has(userId);

  return (
    <SocketContext.Provider value={{
      socket, onlineUsers, sendMessage, editMessage, reactToMessage, startTyping, stopTyping, markRead,
      isOnline, isTyping, incomingMessage, setIncomingMessage,
      messageReadEvent, setMessageReadEvent, messageDeletedEvent, setMessageDeletedEvent,
      messageEditedEvent, setMessageEditedEvent, messageReactionEvent, setMessageReactionEvent,
      friendEvent, setFriendEvent, notifyFriendRequest, notifyFriendAccepted,
      noStoreStates, toggleNoStore, clearedChatEvent
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
