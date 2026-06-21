import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
import { useNotification } from './context/NotificationContext';
import Sidebar, { BottomNav } from './components/Sidebar';
import NotificationToast from './components/NotificationToast';
import Auth from './pages/Auth';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
import Explore from './pages/Explore';
import Friends from './pages/Friends';
import Profile from './pages/Profile';

function ChatPage() {
  const [chatUser, setChatUser] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const { isOnline } = useSocket();
  const { setActiveChatId } = useNotification();

  useEffect(() => {
    if (id) {
      if (location.state?.user) {
        setChatUser(location.state.user);
        setMobileShowChat(true);
      } else {
        fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(u => { setChatUser(u); setMobileShowChat(true); }).catch(() => {});
      }
    }
  }, [id, location.state, token]);

  // Track active chat for notification suppression
  useEffect(() => {
    setActiveChatId(chatUser?.id || null);
    return () => setActiveChatId(null);
  }, [chatUser?.id, setActiveChatId]);

  const handleSelect = (c) => { setChatUser(c); setMobileShowChat(true); };
  const handleBack = () => { setMobileShowChat(false); setChatUser(null); };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="chat-layout">
      <div className={`chat-list-panel ${isMobile && mobileShowChat ? 'hidden' : ''}`}>
        <ChatList onSelectChat={handleSelect} activeChatId={chatUser?.id} />
      </div>
      <div 
        className={isMobile && !mobileShowChat ? 'hidden' : ''} 
        style={{ flex: 1, display: isMobile && !mobileShowChat ? 'none' : 'flex', minWidth: 0 }}
      >
        <Chat chatUser={chatUser} onBack={isMobile ? handleBack : null} />
      </div>
    </div>
  );
}

function AppLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const { token, user } = useAuth();
  const { incomingMessage, friendEvent } = useSocket();
  const { notify, activeChatId, requestPermission } = useNotification();
  const navigate = useNavigate();
  const hasRequestedPermission = useRef(false);

  // Request browser notification permission once
  useEffect(() => {
    if (!hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestPermission();
    }
  }, [requestPermission]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(convos => {
        setUnreadCount(convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      }).catch(() => {});
    fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setRequestCount(data.incoming?.length || 0)).catch(() => {});
  }, [token, incomingMessage, friendEvent]);

  // Trigger notification toast on incoming message
  useEffect(() => {
    if (incomingMessage && user && incomingMessage.senderId !== user.id && incomingMessage.senderId !== activeChatId) {
      // Fetch sender info for the notification
      fetch(`/api/users/${incomingMessage.senderId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(sender => {
          notify({
            type: 'message',
            title: sender.username,
            body: incomingMessage.content?.substring(0, 80) + (incomingMessage.content?.length > 80 ? '...' : ''),
            avatar: sender.username,
            avatarColor: sender.avatarColor || sender.avatar_color,
            senderId: incomingMessage.senderId,
            chatUser: sender,
            onClick: () => navigate(`/chat/${sender.id}`, { state: { user: sender } })
          });
        })
        .catch(() => {
          // Fallback notification without user details
          notify({
            type: 'message',
            title: 'New Message',
            body: incomingMessage.content?.substring(0, 80),
            senderId: incomingMessage.senderId,
          });
        });
    }
  }, [incomingMessage]);

  // Trigger notification on friend events
  useEffect(() => {
    if (friendEvent) {
      if (friendEvent.type === 'request') {
        notify({
          type: 'friend_request',
          title: friendEvent.fromUsername || 'Someone',
          body: 'sent you a friend request',
          avatar: friendEvent.fromUsername,
          senderId: friendEvent.fromUserId,
          onClick: () => navigate('/friends')
        });
      } else if (friendEvent.type === 'accepted') {
        notify({
          type: 'friend_accepted',
          title: friendEvent.username || 'Someone',
          body: 'accepted your friend request!',
          avatar: friendEvent.username,
          senderId: friendEvent.userId,
          onClick: () => navigate('/friends')
        });
      }
    }
  }, [friendEvent]);

  const location = useLocation();
  const isChatActive = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';

  return (
    <div className="app-layout">
      <Sidebar unreadCount={unreadCount} requestCount={requestCount} />
      <div className="main-content">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </div>
      <BottomNav unreadCount={unreadCount} requestCount={requestCount} hideOnChat={isChatActive} />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="ambient-glow-container">
        <div className="ambient-glow-orb ambient-glow-orb-1" />
        <div className="ambient-glow-orb ambient-glow-orb-2" />
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '32px 48px', backdropFilter: 'var(--backdrop-blur)', border: '1px solid var(--border)', zIndex: 1, boxShadow: 'var(--shadow-md)' }}>
        <div className="loading-pulse-logo" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, letterSpacing: '0.05em' }}>CONNECTING...</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="ambient-glow-container">
        <div className="ambient-glow-orb ambient-glow-orb-1" />
        <div className="ambient-glow-orb ambient-glow-orb-2" />
        <div className="ambient-glow-orb ambient-glow-orb-3" />
      </div>
      <NotificationToast />
      {user ? <AppLayout /> : <Auth />}
    </>
  );
}
