import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Trash2, EyeOff, Zap, Bell, BellOff, Volume2, VolumeX, Image, X, Check, CheckCheck, Mic, Sparkles, Pause, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import Avatar from '../components/Avatar';

function VoicePlayer({ src }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="voice-player-container">
      <audio 
        ref={audioRef} 
        src={src} 
        onPlay={() => setPlaying(true)} 
        onPause={() => setPlaying(false)} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button type="button" className="voice-player-play-btn" onClick={toggle}>
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />}
      </button>
      <div className="voice-player-track">
        <div className="voice-player-progress" style={{ width: `${progress}%` }} />
      </div>
      <span className="voice-player-duration">{formatAudioTime(audioRef.current?.currentTime || 0)} / {formatAudioTime(duration)}</span>
    </div>
  );
}

export default function Chat({ chatUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // Voice Masker states
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [voiceFilter, setVoiceFilter] = useState('original');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [showVoiceMasker, setShowVoiceMasker] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);

  // Stylometry Cloaker states
  const [showCloakDropdown, setShowCloakDropdown] = useState(false);

  const { token, user } = useAuth();
  const { 
    sendMessage, incomingMessage, setIncomingMessage, isOnline, isTyping, 
    startTyping, stopTyping, markRead, noStoreStates, toggleNoStore, clearedChatEvent,
    messageReadEvent, setMessageReadEvent, messageDeletedEvent, setMessageDeletedEvent
  } = useSocket();
  const { isMuted, muteChat, unmuteChat } = useNotification();
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const noStoreActive = !!noStoreStates[chatUser?.id];
  const chatMuted = chatUser ? isMuted(chatUser.id) : false;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const rawBlob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(rawBlob);
        setAudioUrl(URL.createObjectURL(rawBlob));
        stream.getTracks().forEach(t => t.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const handleSendVoice = async () => {
    if (!audioBlob) return;
    setProcessingAudio(true);
    try {
      const { applyVoiceMask } = await import('../utils/audioProcessor');
      const processedBlob = await applyVoiceMask(audioBlob, voiceFilter);
      
      const reader = new FileReader();
      reader.readAsDataURL(processedBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        
        const r = await fetch('/api/messages/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ audio: base64Audio })
        });
        if (!r.ok) throw new Error('Upload failed');
        const data = await r.json();
        
        sendMessage(chatUser.id, '', noStoreActive, null, data.url);
        
        setShowVoiceMasker(false);
        setAudioBlob(null);
        setAudioUrl(null);
      };
    } catch (err) {
      console.error('Error processing audio:', err);
      alert('Error processing voice mask');
    }
    setProcessingAudio(false);
  };

  const applyCloak = async (style) => {
    const { cloakText } = await import('../utils/stylometryCloak');
    const cloaked = cloakText(text, style);
    setText(cloaked);
    setShowCloakDropdown(false);
  };

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

  // Handle message read updates
  useEffect(() => {
    if (messageReadEvent && chatUser && messageReadEvent.readerId === chatUser.id) {
      setMessages(prev => prev.map(m => m.senderId === user.id ? { ...m, read: true } : m));
      setMessageReadEvent(null);
    }
  }, [messageReadEvent, chatUser]);

  // Handle message deletion updates
  useEffect(() => {
    if (messageDeletedEvent) {
      setMessages(prev => prev.filter(m => m.id !== messageDeletedEvent.messageId));
      setMessageDeletedEvent(null);
    }
  }, [messageDeletedEvent]);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && !selectedImage) return;

    let uploadedUrl = null;
    if (selectedImage) {
      setUploading(true);
      try {
        const res = await fetch('/api/messages/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ image: selectedImage })
        });
        if (res.ok) {
          const data = await res.json();
          uploadedUrl = data.url;
        } else {
          alert('Failed to upload image');
          setUploading(false);
          return;
        }
      } catch (err) {
        console.error(err);
        setUploading(false);
        return;
      }
    }

    sendMessage(chatUser.id, text.trim(), noStoreActive, uploadedUrl);
    setText('');
    setSelectedImage(null);
    setUploading(false);
    stopTyping(chatUser.id);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large! Maximum allowed size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      const r = await fetch(`/api/messages/message/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (err) {
      console.error('Delete message error:', err);
    }
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
            {m.image && (
              <div className="message-image-wrap">
                <img 
                  src={m.image} 
                  alt="Shared media" 
                  className="message-image" 
                  onClick={() => setLightboxUrl(m.image)} 
                />
              </div>
            )}
            {m.audio && (
              <div className="message-audio-wrap">
                <VoicePlayer src={m.audio} />
              </div>
            )}
            {m.content && <div className="message-text">{m.content}</div>}
            <div className="message-meta">
              {m.isTemporary && (
                <span className="message-temp-tag">
                  <Zap size={9} /> Ghost
                </span>
              )}
              <span className="message-time" style={{ margin: 0 }}>{formatTime(m.createdAt)}</span>
              {m.senderId === user.id && !m.isTemporary && (
                <span className="message-status-ticks">
                  {m.read ? (
                    <CheckCheck size={14} className="tick-read" />
                  ) : (
                    <CheckCheck size={14} className="tick-sent" />
                  )}
                </span>
              )}
            </div>
            
            {m.senderId === user.id && (
              <button 
                className="message-action-btn"
                onClick={() => handleDeleteMessage(m.id)}
                title="Unsend message"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        {typing && (
          <div className="typing-indicator">
            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-input-container">
        {selectedImage && (
          <div className="input-image-preview">
            <img src={selectedImage} alt="Selected preview" />
            <button 
              type="button" 
              className="btn btn-ghost btn-icon close-preview-btn" 
              onClick={() => setSelectedImage(null)}
              disabled={uploading}
            >
              <X size={14} />
            </button>
            {uploading && <div className="preview-uploading-overlay">Uploading...</div>}
          </div>
        )}

        {showVoiceMasker && (
          <div className="voice-masker-panel">
            <div className="voice-masker-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}>
                <Mic size={14} className={recording ? "animate-pulse" : ""} style={{ color: recording ? 'rgba(239, 68, 68, 0.9)' : 'var(--primary)' }} />
                <span>Witness Protection Voice Masker</span>
              </div>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowVoiceMasker(false); setAudioUrl(null); setAudioBlob(null); }} style={{ padding: 4 }}>
                <X size={14} />
              </button>
            </div>
            
            <div className="voice-masker-body" style={{ marginTop: 8 }}>
              {!audioUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                    type="button" 
                    className={`btn btn-sm ${recording ? 'btn-danger animate-pulse' : 'btn-primary'}`} 
                    onClick={recording ? stopRecording : startRecording}
                    style={{ borderRadius: 16, padding: '4px 12px' }}
                  >
                    {recording ? 'Stop Recording' : 'Record Voice'}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {recording ? 'Recording active...' : 'Speak with pitch scrambling'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, width: '100%' }}>
                  <VoicePlayer src={audioUrl} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Voice Mask Filter</label>
                    <select 
                      value={voiceFilter} 
                      onChange={e => setVoiceFilter(e.target.value)}
                      style={{ padding: '2px 6px', fontSize: '0.75rem', borderRadius: 4, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text)', outline: 'none' }}
                    >
                      <option value="original">Clean (Original)</option>
                      <option value="deep">Deep Witness (De-pitched)</option>
                      <option value="helium">Helium Spectre (High-pitched)</option>
                      <option value="scrambler">Cyber Scrambler (Overdrive)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAudioUrl(null); setAudioBlob(null); }} style={{ fontSize: '0.75rem' }}>Discard</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSendVoice} disabled={processingAudio} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                      {processingAudio ? 'Processing...' : 'Send Scrambled'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <form className="chat-input-area" onSubmit={handleSend}>
          <label className="btn btn-ghost btn-icon attachment-btn" title="Attach Image" style={{ cursor: 'pointer' }}>
            <Image size={18} />
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageSelect} 
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>

          <button 
            type="button" 
            className={`btn btn-ghost btn-icon attachment-btn ${showVoiceMasker ? 'active' : ''}`} 
            title="Witness Protection Voice Masker"
            onClick={() => {
              setShowVoiceMasker(!showVoiceMasker);
              setShowCloakDropdown(false);
            }}
            disabled={uploading || recording}
          >
            <Mic size={18} />
          </button>
          
          <input 
            className="input" 
            placeholder={noStoreActive ? "Ghost message..." : "Type a message..."} 
            value={text} 
            onChange={e => handleTyping(e.target.value)}
            disabled={uploading}
          />

          {text.trim() && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                type="button" 
                className={`btn btn-ghost btn-icon attachment-btn ${showCloakDropdown ? 'active' : ''}`} 
                title="Stylometry Cloaker"
                onClick={() => {
                  setShowCloakDropdown(!showCloakDropdown);
                  setShowVoiceMasker(false);
                }}
                disabled={uploading}
                style={{ padding: 6 }}
              >
                <Sparkles size={18} />
              </button>
              {showCloakDropdown && (
                <div className="cloak-dropdown-menu animate-in" style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, background: 'rgba(23, 23, 23, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 100, minWidth: 160, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>Cloak Style Fingerprint</div>
                  <button type="button" className="cloak-dropdown-item" onClick={() => applyCloak('leetspeak')} style={{ padding: '6px 8px', fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, width: '100%' }}>
                    Leet H4x0r
                  </button>
                  <button type="button" className="cloak-dropdown-item" onClick={() => applyCloak('cyberpunk')} style={{ padding: '6px 8px', fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, width: '100%' }}>
                    Cyberpunk Netrunner
                  </button>
                  <button type="button" className="cloak-dropdown-item" onClick={() => applyCloak('diplomatic')} style={{ padding: '6px 8px', fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, width: '100%' }}>
                    Corporate Diplomat
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button 
            className={`btn btn-icon send-btn ${(text.trim() || selectedImage) ? 'has-text' : ''}`} 
            type="submit" 
            disabled={(!text.trim() && !selectedImage) || uploading}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

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

      {/* Fullscreen Lightbox Media Viewer */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <div className="lightbox-content animate-in" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Shared media full preview" />
            <button className="btn btn-ghost btn-icon lightbox-close" onClick={() => setLightboxUrl(null)}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
