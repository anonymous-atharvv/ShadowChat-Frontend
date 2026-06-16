import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Trash2, EyeOff, Zap, Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import Avatar from '../components/Avatar';

export default function Chat({ chatUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const { token, user } = useAuth();
  const { 
    sendMessage, incomingMessage, setIncomingMessage, isOnline, isTyping, 
    startTyping, stopTyping, markRead, noStoreStates, toggleNoStore, clearedChatEvent 
  } = useSocket();
  const { isMuted, muteChat, unmuteChat } = useNotification();
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const noStoreActive = !!noStoreStates[chatUser?.id];
  const chatMuted = chatUser ? isMuted(chatUser.id) : false;

  useEffect(() => {
    if (!chatUser) return;
    fetch(`/api/messages/${chatUser.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages).catch(() => {});
    markRead(chatUser.id);
  }, [chatUser, token]);

  useEffect(() => {
    if (incomingMessage && chatUser) {
      const m = incomingMessage;
      if ((m.senderId === chatUser.id && m.receiverId === user.id) ||
          (m.senderId === user.id && m.receiverId === chatUser.id)) {
        setMessages(prev => {
          if (prev.some(p => p.id === m.id)) return prev;
          return [...prev, m];
        });
        if (m.senderId === chatUser.id) markRead(chatUser.id);
      }
      setIncomingMessage(null);
    }
  }, [incomingMessage]);

  // Automatically clear temporary messages from state when No-Store mode is turned off
  useEffect(() => {
    if (!noStoreActive) {
      setMessages(prev => prev.filter(m => !m.isTemporary));
    }
  }, [noStoreActive]);

  useEffect(() => {
    if (clearedChatEvent && chatUser && clearedChatEvent.friendId === chatUser.id) {
      if (clearedChatEvent.timeframe === '24h') {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        setMessages(prev => prev.filter(m => new Date(m.createdAt).getTime() < cutoff));
      } else {
        setMessages([]);
      }
    }
  }, [clearedChatEvent, chatUser]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(chatUser.id, text.trim(), noStoreActive);
    setText('');
    stopTyping(chatUser.id);
  };

  const handleTyping = (val) => {
    setText(val);
    if (val) { startTyping(chatUser.id); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => stopTyping(chatUser.id), 2000); }
    else stopTyping(chatUser.id);
  };

  const performClearChat = async (timeframe) => {
    try {
      const r = await fetch(`/api/messages/${chatUser.id}/clear?timeframe=${timeframe}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        if (timeframe === '24h') {
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          setMessages(prev => prev.filter(m => new Date(m.createdAt).getTime() < cutoff));
        } else {
          setMessages([]);
        }
      }
    } catch (err) { console.error(err); }
    setShowClearModal(false);
  };

  const toggleMute = () => {
    if (chatMuted) unmuteChat(chatUser.id);
    else muteChat(chatUser.id);
  };

  const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!chatUser) return (
    <div className="chat-panel">
      <div className="chat-empty">
        <div className="chat-empty-icon-wrap">
          <Send size={48} />
        </div>
        <h3 style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>Select a conversation</h3>
        <p style={{ fontSize: '13px' }}>Choose a friend to start chatting</p>
      </div>
    </div>
  );

  const online = isOnline(chatUser.id);
  const typing = isTyping(chatUser.id);

  return (
    <div className="chat-panel animate-in">
      <div className="chat-header">
        {onBack && <button className="btn btn-ghost btn-icon" onClick={onBack} style={{ marginRight: 4 }}><ArrowLeft size={20} /></button>}
        <Avatar username={chatUser.username} color={chatUser.avatarColor} online={online} />
        <div className="chat-header-info">
          <h3>{chatUser.username}</h3>
          <span className={`status ${online ? '' : 'offline'}`}>{typing ? 'typing...' : online ? 'Online' : 'Offline'}</span>
        </div>
        
        {/* Advanced Chat Controls */}
        <div className="chat-header-controls">
          {/* Mute Toggle */}
          <button 
            className={`btn btn-ghost btn-icon chat-control-btn ${chatMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={chatMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {chatMuted ? <BellOff size={18} /> : <Bell size={18} />}
          </button>

          {/* No-Store Mode Toggle */}
          <div 
            className="nostore-toggle-wrap"
            onClick={() => toggleNoStore(chatUser.id, !noStoreActive)}
            title="Toggle No-Store (Incognito) Mode"
          >
            <span className={`nostore-label ${noStoreActive ? 'active' : ''}`}>
              <EyeOff size={12} /> Ghost
            </span>
            <div className={`nostore-toggle-switch ${noStoreActive ? 'active' : ''}`}>
              <div className="nostore-toggle-thumb" />
            </div>
          </div>

          {/* Clear Chat Button (only visible when No-Store Mode is OFF) */}
          {!noStoreActive && (
            <button 
              className="btn btn-ghost btn-icon chat-control-btn"
              onClick={() => setShowClearModal(true)}
              title="Clear Chat History"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {noStoreActive && (
        <div className="nostore-banner">
          <EyeOff size={13} />
          <span>Ghost mode active — messages vanish when you leave</span>
        </div>
      )}

      {chatMuted && (
        <div className="mute-banner">
          <BellOff size={13} />
          <span>Notifications muted for this chat</span>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div 
            key={m.id} 
            className={`message-bubble ${m.senderId === user.id ? 'message-sent' : 'message-received'} ${m.isTemporary ? 'message-temporary' : ''}`}
            style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
          >
            {m.content}
            <div className="message-meta">
              {m.isTemporary && (
                <span className="message-temp-tag">
                  <Zap size={9} /> Ghost
                </span>
              )}
              <span className="message-time" style={{ margin: 0 }}>{formatTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
        {typing && (
          <div className="typing-indicator">
            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="chat-input-area" onSubmit={handleSend}>
        <input 
          className="input" 
          placeholder={noStoreActive ? "Ghost message..." : "Type a message..."} 
          value={text} 
          onChange={e => handleTyping(e.target.value)} 
        />
        <button className={`btn btn-icon send-btn ${text.trim() ? 'has-text' : ''}`} type="submit" disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div className="modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="modal-card animate-in" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-wrap">
              <Trash2 size={28} />
            </div>
            <h3>Clear Chat History</h3>
            <p>Choose how much of the chat history to clear. This cannot be undone.</p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => performClearChat('24h')}
                style={{ width: '100%' }}
              >
                Last 24 Hours
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => performClearChat('all')}
                style={{ width: '100%' }}
              >
                Clear Everything
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowClearModal(false)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
