import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
import Sidebar, { BottomNav } from './components/Sidebar';
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

  const handleSelect = (c) => { setChatUser(c); setMobileShowChat(true); };
  const handleBack = () => { setMobileShowChat(false); setChatUser(null); };
  const isMobile = window.innerWidth <= 768;

  return (
    <div className="chat-layout">
      <div className={`chat-list-panel ${isMobile && mobileShowChat ? 'hidden' : ''}`}>
        <ChatList onSelectChat={handleSelect} activeChatId={chatUser?.id} />
      </div>
      <div className={`${isMobile && !mobileShowChat ? 'hidden' : ''}`} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        <Chat chatUser={chatUser} onBack={isMobile ? handleBack : null} />
      </div>
    </div>
  );
}

function AppLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const { token } = useAuth();
  const { incomingMessage, friendEvent } = useSocket();

  useEffect(() => {
    if (!token) return;
    fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(convos => {
        setUnreadCount(convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      }).catch(() => {});
    fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setRequestCount(data.incoming?.length || 0)).catch(() => {});
  }, [token, incomingMessage, friendEvent]);

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
      <BottomNav unreadCount={unreadCount} requestCount={requestCount} />
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
        <div style={{ width: 52, height: 52, background: 'var(--accent-gradient)', borderRadius: 'var(--radius-md)', margin: '0 auto 20px', animation: 'pulse 1.8s infinite', boxShadow: '0 4px 18px rgba(139,92,246,0.3)' }} />
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
      {user ? <AppLayout /> : <Auth />}
    </>
  );
}
