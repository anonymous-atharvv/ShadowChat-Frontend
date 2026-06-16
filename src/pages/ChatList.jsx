import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, BellOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import Avatar from '../components/Avatar';

export default function ChatList({ onSelectChat, activeChatId }) {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const { token } = useAuth();
  const { incomingMessage, setIncomingMessage, isOnline } = useSocket();
  const { isMuted } = useNotification();
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setConversations(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (incomingMessage) {
      fetchConversations();
    }
  }, [incomingMessage, fetchConversations]);

  const filtered = conversations.filter(c => c.username.toLowerCase().includes(search.toLowerCase()));

  const formatTime = (t) => {
    if (!t) return '';
    const d = new Date(t);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSelect = (c) => {
    if (onSelectChat) onSelectChat(c);
    else navigate(`/chat/${c.id}`);
  };

  return (
    <div className="chat-list-panel">
      <div className="chat-list-header">
        <h1>Messages</h1>
        <div className="search-bar">
          <Search />
          <input className="input" placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="chat-list-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={40} />
            <h3>No conversations yet</h3>
            <p>Add friends to start chatting</p>
          </div>
        ) : filtered.map((c, i) => (
          <div 
            key={c.id} 
            className={`convo-item ${activeChatId === c.id ? 'active' : ''}`} 
            onClick={() => handleSelect(c)}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <Avatar username={c.username} color={c.avatarColor} online={isOnline(c.id)} />
            <div className="convo-info">
              <div className="convo-top">
                <div className="convo-name-wrap">
                  <h4>{c.username}</h4>
                  {isMuted(c.id) && (
                    <span className="convo-muted-icon" title="Muted">
                      <BellOff size={12} />
                    </span>
                  )}
                </div>
                <span className="time">{formatTime(c.lastMessageTime)}</span>
              </div>
              <div className="convo-bottom">
                <span className="preview">{c.lastMessage || 'Start a conversation'}</span>
                {c.unreadCount > 0 && <span className="convo-unread">{c.unreadCount}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
