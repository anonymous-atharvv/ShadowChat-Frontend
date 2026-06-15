import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Trash2, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
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
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const noStoreActive = !!noStoreStates[chatUser?.id];

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

  const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!chatUser) return (
    <div className="chat-panel">
      <div className="chat-empty">
        <Send size={48} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '4px' }}>
          {/* No-Store Mode Toggle */}
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => toggleNoStore(chatUser.id, !noStoreActive)}
            title="Toggle No-Store (Incognito) Mode"
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: noStoreActive ? 'var(--pink)' : 'var(--text-secondary)' }}>
              No-Store
            </span>
            <div className={`nostore-toggle-switch ${noStoreActive ? 'active' : ''}`}>
              <div className="nostore-toggle-thumb" />
            </div>
          </div>

          {/* Clear Chat Button (only visible when No-Store Mode is OFF) */}
          {!noStoreActive && (
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={() => setShowClearModal(true)}
              style={{ width: '36px', height: '36px', color: 'var(--text-secondary)' }}
              title="Clear Chat History"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {noStoreActive && (
        <div style={{ 
          padding: '8px 16px', 
          background: 'rgba(236,72,153,0.06)', 
          borderBottom: '1px dashed rgba(236,72,153,0.15)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px', 
          color: 'var(--pink)', 
          fontSize: '11px',
          fontWeight: 500
        }}>
          <EyeOff size={13} />
          <span>No-Store mode active. Messages will not be saved to chat history.</span>
        </div>
      )}

      <div className="chat-messages">
        {messages.map(m => (
          <div 
            key={m.id} 
            className={`message-bubble ${m.senderId === user.id ? 'message-sent' : 'message-received'} ${m.isTemporary ? 'message-temporary' : ''}`}
          >
            {m.content}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: m.senderId === user.id ? 'flex-end' : 'flex-start', 
              gap: '6px',
              marginTop: '4px'
            }}>
              {m.isTemporary && (
                <span className="message-temp-tag">
                  <Zap size={9} /> Temp
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
        <input className="input" placeholder={noStoreActive ? "Send a temporary message..." : "Type a message..."} value={text} onChange={e => handleTyping(e.target.value)} />
        <button className="btn btn-icon" type="submit" disabled={!text.trim()}><Send size={18} /></button>
      </form>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'var(--backdrop-blur-overlay)',
          WebkitBackdropFilter: 'var(--backdrop-blur-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card animate-in" style={{
            width: '100%',
            maxWidth: '380px',
            padding: '28px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Clear Chat History
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Choose how much of the chat history you want to clear. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => performClearChat('24h')}
                style={{ width: '100%' }}
              >
                Clear Last 24 Hours
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => performClearChat('all')}
                style={{ width: '100%' }}
              >
                Clear All Time
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
