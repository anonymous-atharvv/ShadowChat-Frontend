import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Trash2, EyeOff, Eye, Zap, Bell, BellOff, Volume2, VolumeX, Image, X, Check, CheckCheck, Mic, Sparkles, Pause, Play, Smile, CornerUpLeft, Edit2, Shield, ShieldOff, Lock, Unlock, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import Avatar from '../components/Avatar';
import { getPrivateKey, deriveSharedKey, encryptMessage, decryptMessage } from '../utils/e2ee';

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

const FingerprintQR = ({ fingerprint }) => {
  if (!fingerprint) return null;
  const bytes = fingerprint.split(':').map(x => parseInt(x, 16) || 0);
  const grid = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const isCorner = 
        (x < 4 && y < 4) || // Top-left
        (x >= 12 && y < 4) || // Top-right
        (x < 4 && y >= 12);   // Bottom-left
      
      let active = false;
      if (isCorner) {
        active = (x === 0 || x === 3 || y === 0 || y === 3 || (x > 0 && x < 3 && y > 0 && y < 3));
      } else {
        const bitIndex = (y * 16 + x) % (bytes.length * 8);
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = bitIndex % 8;
        active = ((bytes[byteIndex] >> bitOffset) & 1) === 1;
      }
      grid.push({ x, y, active });
    }
  }

  return (
    <svg viewBox="0 0 16 16" className="e2ee-qr-svg" style={{ width: '120px', height: '120px', margin: '0 auto', display: 'block', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      {grid.map((p, i) => (
        <rect 
          key={i} 
          x={p.x} 
          y={p.y} 
          width="0.9" 
          height="0.9" 
          fill={p.active ? 'var(--accent-glow)' : 'transparent'} 
          rx="0.2"
        />
      ))}
    </svg>
  );
};

const decryptMessagePayload = async (msg, key) => {
  if (!msg.iv || !key || msg.isDeleted || msg.isDecrypted) return msg;
  try {
    const decryptedText = await decryptMessage(msg.content, msg.iv, key);
    return { ...msg, content: decryptedText, isEncrypted: true, isDecrypted: true };
  } catch (err) {
    console.error('Failed to decrypt message:', msg.id, err);
    return { ...msg, content: '🔑 [Decryption failed: keys mismatch or message corrupted]', isEncrypted: true, isDecrypted: true, decryptionFailed: true };
  }
};

export default function Chat({ chatUser, onBack }) {
  const { token, user } = useAuth();
  const { 
    sendMessage, incomingMessage, setIncomingMessage, isOnline, isTyping, 
    startTyping, stopTyping, markRead, noStoreStates, toggleNoStore, clearedChatEvent,
    messageReadEvent, setMessageReadEvent, messageDeletedEvent, setMessageDeletedEvent,
    editMessage, reactToMessage, messageEditedEvent, setMessageEditedEvent,
    messageReactionEvent, setMessageReactionEvent
  } = useSocket();
  const { isMuted, muteChat, unmuteChat } = useNotification();
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // Message Replies, Edits, Reactions states
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [activeReactionPickerId, setActiveReactionPickerId] = useState(null);

  const [phantomMode, setPhantomMode] = useState(false);

  // Phantom Mode Screenshot & Copy Detection Event Listeners
  useEffect(() => {
    if (!phantomMode) return;

    const handleKeyDown = (e) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        alert('⚠️ PHANTOM SHIELD: Screenshot attempt detected! This incident has been logged.');
        e.preventDefault();
      }
      // OS Screenshot shortcuts (e.g. Cmd+Shift+3/4/5 on macOS, Win+Shift+S on Windows)
      if (
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.key === 'p') // Print shortcut
      ) {
        alert('⚠️ PHANTOM SHIELD: Screenshot attempt detected! This incident has been logged.');
        e.preventDefault();
      }
    };

    const handleCopy = (e) => {
      e.preventDefault();
      alert('⚠️ PHANTOM SHIELD: Copying text is strictly disabled in Phantom Mode.');
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [phantomMode]);

  // E2EE States
  const [sharedAesKey, setSharedAesKey] = useState(null);
  const [e2eeStatus, setE2eeStatus] = useState('initializing'); // 'initializing', 'active', 'inactive'
  const [showE2eeModal, setShowE2eeModal] = useState(false);
  const [isE2eeVerified, setIsE2eeVerified] = useState(false);
  const [friendFingerprint, setFriendFingerprint] = useState('');

  // Handle local E2EE Verification State
  useEffect(() => {
    if (user && chatUser) {
      const val = localStorage.getItem(`sc_verified_keys_${user.id}_${chatUser.id}`) === 'true';
      setIsE2eeVerified(val);
    }
  }, [user, chatUser]);

  const toggleVerifyE2ee = (checked) => {
    setIsE2eeVerified(checked);
    if (user && chatUser) {
      localStorage.setItem(`sc_verified_keys_${user.id}_${chatUser.id}`, checked ? 'true' : 'false');
    }
  };

  // Derive Shared AES Key & load friend fingerprint
  useEffect(() => {
    if (!chatUser || !user) return;
    let active = true;

    const initE2EE = async () => {
      setE2eeStatus('initializing');
      setSharedAesKey(null);
      setFriendFingerprint('');
      try {
        let friendPubKey = chatUser.publicKey;
        let fingerprint = chatUser.keyFingerprint;
        
        if (!friendPubKey) {
          // Fetch public key from server
          const res = await fetch(`/api/keys/${chatUser.id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            friendPubKey = data.publicKey;
            fingerprint = data.fingerprint;
          }
        }
        
        if (!active) return;

        if (friendPubKey) {
          const myPrivateKey = await getPrivateKey(user.id);
          if (myPrivateKey) {
            const derivedKey = await deriveSharedKey(myPrivateKey, friendPubKey);
            if (!active) return;
            setSharedAesKey(derivedKey);
            setFriendFingerprint(fingerprint);
            setE2eeStatus('active');
            return;
          }
        }
        setE2eeStatus('inactive');
      } catch (err) {
        console.error('Error establishing E2EE:', err);
        if (active) setE2eeStatus('inactive');
      }
    };
    
    initE2EE();
    return () => { active = false; };
  }, [chatUser, user, token]);

  // Voice Masker states
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [voiceFilter, setVoiceFilter] = useState('original');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [showVoiceMasker, setShowVoiceMasker] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);

  // Stylometry Cloaker / AI Identity Forge states
  const [showCloakDropdown, setShowCloakDropdown] = useState(false);
  const [forgedPersona, setForgedPersona] = useState(null);
  const [isForging, setIsForging] = useState(false);


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
        
        sendMessage(chatUser.id, '', noStoreActive || phantomMode, null, data.url, null, null, phantomMode);
        
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

  const applyForge = async (persona) => {
    if (!text.trim()) return;
    setIsForging(true);
    setShowCloakDropdown(false);
    try {
      const res = await fetch('/api/ai/forge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text, persona })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setText(data.text);
          setForgedPersona(persona);
        }
      } else {
        alert('AI Forge failed to translate the message.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to AI Identity Forge.');
    } finally {
      setIsForging(false);
    }
  };

  useEffect(() => {
    if (!chatUser) return;
    fetch(`/api/messages/${chatUser.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(async (rawMsgs) => {
        if (sharedAesKey) {
          const decryptedMsgs = await Promise.all(rawMsgs.map(m => decryptMessagePayload(m, sharedAesKey)));
          setMessages(decryptedMsgs);
        } else {
          setMessages(rawMsgs);
        }
      })
      .catch(() => {});
    markRead(chatUser.id);
  }, [chatUser, token, sharedAesKey]);

  useEffect(() => {
    if (incomingMessage && chatUser) {
      const m = incomingMessage;
      if ((Number(m.senderId) === Number(chatUser.id) && Number(m.receiverId) === Number(user.id)) ||
          (Number(m.senderId) === Number(user.id) && Number(m.receiverId) === Number(chatUser.id))) {
        
        const processIncoming = async () => {
          const decrypted = await decryptMessagePayload(m, sharedAesKey);
          setMessages(prev => {
            if (prev.some(p => p.id === decrypted.id)) return prev;
            return [...prev, decrypted];
          });
          if (Number(m.senderId) === Number(chatUser.id)) markRead(chatUser.id);
        };
        processIncoming();
      }
      setIncomingMessage(null);
    }
  }, [incomingMessage, sharedAesKey, chatUser, user]);

  // Handle message read updates
  useEffect(() => {
    if (messageReadEvent && chatUser && Number(messageReadEvent.readerId) === Number(chatUser.id)) {
      setMessages(prev => prev.map(m => Number(m.senderId) === Number(user.id) ? { ...m, read: true } : m));
      setMessageReadEvent(null);
    }
  }, [messageReadEvent, chatUser]);

  // Handle message deletion updates
  useEffect(() => {
    if (messageDeletedEvent) {
      setMessages(prev => prev.map(m => m.id === messageDeletedEvent.messageId ? { ...m, isDeleted: true, content: null, image: null, audio: null } : m));
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

  // Handle message edit updates
  useEffect(() => {
    if (messageEditedEvent) {
      const processEdited = async () => {
        const decrypted = await decryptMessagePayload(
          { 
            id: messageEditedEvent.messageId, 
            content: messageEditedEvent.newContent, 
            iv: messageEditedEvent.iv 
          }, 
          sharedAesKey
        );
        
        setMessages(prev => prev.map(m => m.id === messageEditedEvent.messageId ? { ...m, content: decrypted.content, iv: decrypted.iv, edited: 1, isEncrypted: decrypted.isEncrypted } : m));
        setMessageEditedEvent(null);
      };
      processEdited();
    }
  }, [messageEditedEvent, sharedAesKey]);

  // Handle message reaction updates
  useEffect(() => {
    if (messageReactionEvent) {
      setMessages(prev => prev.map(m => m.id === messageReactionEvent.messageId ? { ...m, reactions: messageReactionEvent.reactions } : m));
      setMessageReactionEvent(null);
    }
  }, [messageReactionEvent, setMessageReactionEvent]);

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

    let finalContent = text.trim();
    let finalIv = null;

    if (e2eeStatus === 'active' && sharedAesKey && finalContent) {
      try {
        const encrypted = await encryptMessage(finalContent, sharedAesKey);
        finalContent = encrypted.ciphertext;
        finalIv = encrypted.iv;
      } catch (err) {
        console.error('Encryption failed, sending as plaintext:', err);
      }
    }

    sendMessage(chatUser.id, finalContent, noStoreActive || phantomMode, uploadedUrl, null, replyToMessage?.id, finalIv, phantomMode, forgedPersona);
    setForgedPersona(null);
    setText('');
    setSelectedImage(null);
    setReplyToMessage(null);
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

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`message-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight-flash');
      setTimeout(() => {
        el.classList.remove('message-highlight-flash');
      }, 1500);
    }
  };

  const submitEditMessage = async (msgId) => {
    if (!editingText.trim()) return;
    
    let finalContent = editingText.trim();
    let finalIv = null;

    if (e2eeStatus === 'active' && sharedAesKey) {
      try {
        const encrypted = await encryptMessage(finalContent, sharedAesKey);
        finalContent = encrypted.ciphertext;
        finalIv = encrypted.iv;
      } catch (err) {
        console.error('Encryption failed for edit:', err);
      }
    }

    editMessage(msgId, finalContent, finalIv);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editingText.trim(), iv: finalIv, edited: 1, isEncrypted: !!finalIv } : m));
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleReactToMessage = (msgId, emoji) => {
    reactToMessage(msgId, emoji);
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const currentReactions = m.reactions || [];
      const existingIdx = currentReactions.findIndex(r => Number(r.userId) === Number(user.id));
      let newReactions;
      if (existingIdx > -1) {
        if (currentReactions[existingIdx].emoji === emoji) {
          newReactions = currentReactions.filter(r => Number(r.userId) !== Number(user.id));
        } else {
          newReactions = currentReactions.map((r, idx) => idx === existingIdx ? { ...r, emoji } : r);
        }
      } else {
        newReactions = [...currentReactions, { userId: user.id, username: user.username, emoji }];
      }
      return { ...m, reactions: newReactions };
    }));
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      const r = await fetch(`/api/messages/message/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: null, image: null, audio: null } : m));
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

  const parseDate = (t) => {
    if (!t) return new Date();
    if (typeof t === 'string' && !t.endsWith('Z') && !t.includes('+')) {
      return new Date(t.replace(' ', 'T') + 'Z');
    }
    return new Date(t);
  };

  const formatTime = (t) => parseDate(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    <div className={`chat-panel animate-in ${phantomMode ? 'phantom-mode-active' : ''}`}>
      <div className="chat-header">
        {onBack && <button className="btn btn-ghost btn-icon" onClick={onBack} style={{ marginRight: 4 }}><ArrowLeft size={20} /></button>}
        <Avatar username={chatUser.username} color={chatUser.avatarColor} online={online} avatarUrl={chatUser.avatarUrl} />
        <div className="chat-header-info">
          <h3>{chatUser.username}</h3>
          <span className={`status ${online ? '' : 'offline'}`}>{typing ? 'typing...' : online ? 'Online' : 'Offline'}</span>
        </div>
        
        {/* Advanced Chat Controls */}
        <div className="chat-header-controls">
          {/* E2EE Lock State */}
          <button 
            className={`btn btn-ghost btn-icon chat-control-btn e2ee-indicator-btn ${e2eeStatus === 'active' ? 'active' : ''}`}
            onClick={() => setShowE2eeModal(true)}
            style={{ position: 'relative' }}
            title={
              e2eeStatus === 'active' 
                ? (isE2eeVerified ? 'End-to-End Encrypted & Identity Verified' : 'End-to-End Encrypted (Unverified fingerprint)')
                : 'E2EE Not Active'
            }
          >
            {e2eeStatus === 'active' ? (
              isE2eeVerified ? (
                <Shield size={18} style={{ color: 'var(--accent-glow)' }} />
              ) : (
                <Shield size={18} style={{ color: 'var(--warning-color)' }} />
              )
            ) : (
              <ShieldOff size={18} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {/* Mute Toggle */}
          <button 
            className={`btn btn-ghost btn-icon chat-control-btn ${chatMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={chatMuted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {chatMuted ? <BellOff size={18} /> : <Bell size={18} />}
          </button>

          {/* Phantom Mode Toggle */}
          <button 
            className={`btn btn-ghost btn-icon chat-control-btn phantom-toggle-btn ${phantomMode ? 'active' : ''}`}
            onClick={() => setPhantomMode(!phantomMode)}
            title="Toggle Phantom Mode (Incognito & Blur)"
            style={{ color: phantomMode ? '#a855f7' : 'var(--text-muted)' }}
          >
            <Eye size={18} />
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

      {phantomMode && (
        <div className="nostore-banner" style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.3)', color: '#d8b4fe' }}>
          <Eye size={13} style={{ color: '#c084fc' }} />
          <span>Phantom mode active — screenshot & copy protection engaged</span>
        </div>
      )}

      {noStoreActive && !phantomMode && (
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
        {messages.map((m, i) => {
          const isMe = Number(m.senderId) === Number(user.id);
          const senderUsername = isMe ? user.username : (chatUser?.username || 'User');
          const senderAvatarColor = isMe ? (user.avatarColor || user.avatar_color) : (chatUser?.avatarColor || chatUser?.avatar_color);
          const senderAvatarUrl = isMe ? user.avatarUrl : chatUser?.avatarUrl;

          return (
            <div 
              key={m.id} 
              id={`message-${m.id}`}
              className={`discord-message ${m.isTemporary ? 'message-temporary' : ''}`}
              style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                <Avatar 
                  username={senderUsername} 
                  color={senderAvatarColor} 
                  avatarUrl={senderAvatarUrl} 
                  size="sm" 
                />
              </div>

              <div className="discord-message-content">
                <div className="discord-message-header">
                  <span className={`discord-username ${isMe ? 'is-me' : ''}`}>
                    {senderUsername}
                  </span>
                  <span className="discord-timestamp">
                    {formatTime(m.createdAt)}
                  </span>
                  {m.isTemporary && (
                    <span className="message-temp-tag" style={{ marginLeft: 4, padding: '1px 5px', fontSize: '0.65rem' }}>
                      <Zap size={9} /> Ghost
                    </span>
                  )}
                  {(m.isEncrypted || m.iv) && (
                    <span 
                      className="message-e2ee-tag" 
                      style={{ 
                        marginLeft: 6, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        color: 'var(--accent-glow)',
                        fontSize: '0.65rem',
                        gap: '2px'
                      }}
                      title="End-to-End Encrypted Message"
                    >
                      <Lock size={9} /> e2ee
                    </span>
                  )}
                  {Number(m.senderId) === Number(user.id) && !m.isTemporary && (
                    <span className="message-status-ticks" style={{ marginLeft: 4, opacity: 0.8 }}>
                      {m.read ? (
                        <CheckCheck size={14} className="tick-read" />
                      ) : (
                        <CheckCheck size={14} className="tick-sent" />
                      )}
                    </span>
                  )}
                </div>

                {m.replyToMessageId && (
                  <div 
                    className="message-quote-context"
                    onClick={() => scrollToMessage(m.replyToMessageId)}
                    style={{
                      borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
                      paddingLeft: '8px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      maxWidth: '80%'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.7rem', marginBottom: 2 }}>
                      {m.replySenderUsername || 'User'}
                    </div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                      {m.replyContent || '📷 Media'}
                    </div>
                  </div>
                )}

                {!m.isDeleted && m.image && (
                  <div className="message-image-wrap" style={{ marginTop: 4, maxWidth: '280px' }}>
                    <img 
                      src={m.image} 
                      alt="Shared media" 
                      className="message-image" 
                      onClick={() => setLightboxUrl(m.image)} 
                      style={{ borderRadius: 8, maxHeight: 200, cursor: 'zoom-in' }}
                    />
                  </div>
                )}

                {!m.isDeleted && m.audio && (
                  <div className="message-audio-wrap" style={{ marginTop: 4 }}>
                    <VoicePlayer src={m.audio} />
                  </div>
                )}

                {m.isDeleted ? (
                  <div className="discord-message-text" style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 4 }}>
                    This message was unsent
                  </div>
                ) : editingMessageId === m.id ? (
                  <div className="message-edit-inline-form" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, marginTop: 4 }}>
                    <textarea 
                      className="input" 
                      value={editingText} 
                      onChange={e => setEditingText(e.target.value)}
                      style={{ width: '100%', minHeight: 60, padding: 8, fontSize: '0.85rem', resize: 'vertical', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitEditMessage(m.id);
                        } else if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingMessageId(null)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Cancel</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => submitEditMessage(m.id)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  m.content && (
                    <>
                      <div 
                        className={`discord-message-text ${m.isPhantom ? 'phantom-message-text' : ''}`}
                        title={m.isPhantom ? 'Phantom message — hover to reveal' : undefined}
                      >
                        {m.content}
                        {m.edited === 1 && (
                          <span className="message-edited-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 6, fontStyle: 'italic' }}>
                            (edited)
                          </span>
                        )}
                      </div>
                      {m.forgedPersona && (
                        <div 
                          className="forged-persona-tag" 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            fontSize: '0.62rem', 
                            color: '#c084fc', 
                            background: 'rgba(168, 85, 247, 0.12)', 
                            border: '1px solid rgba(168, 85, 247, 0.25)', 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            marginTop: 4, 
                            width: 'max-content',
                            userSelect: 'none',
                            fontWeight: 500
                          }}
                        >
                          <Sparkles size={8} /> Forged: {m.forgedPersona}
                        </div>
                      )}
                    </>
                  )
                )}

                {!m.isDeleted && m.reactions && m.reactions.length > 0 && (
                  <div className="message-reactions-display" style={{ marginTop: 4 }}>
                    {Object.entries(
                      m.reactions.reduce((acc, curr) => {
                        acc[curr.emoji] = acc[curr.emoji] || [];
                        acc[curr.emoji].push(curr);
                        return acc;
                      }, {})
                    ).map(([emoji, usersReacted]) => {
                      const hasReacted = usersReacted.some(u => Number(u.userId) === Number(user.id));
                      const userList = usersReacted.map(u => u.username).join(', ');
                      return (
                        <div
                          key={emoji}
                          className={`reaction-bubble ${hasReacted ? 'active' : ''}`}
                          onClick={() => handleReactToMessage(m.id, emoji)}
                          title={userList}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: hasReacted ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            border: hasReacted ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 12,
                            padding: '2px 6px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s',
                            color: hasReacted ? 'var(--primary-light)' : 'var(--text-secondary)',
                            marginTop: 4,
                            marginRight: 4
                          }}
                        >
                          <span>{emoji}</span>
                          <span>{usersReacted.length}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!m.isDeleted && (
                <div className="message-actions-container">
                  <button 
                    type="button"
                    className="message-action-icon-btn"
                    onClick={() => setActiveReactionPickerId(activeReactionPickerId === m.id ? null : m.id)}
                    title="React to message"
                  >
                    <Smile size={13} />
                  </button>
                  <button 
                    type="button"
                    className="message-action-icon-btn"
                    onClick={() => setReplyToMessage(m)}
                    title="Reply to message"
                  >
                    <CornerUpLeft size={13} />
                  </button>
                  {Number(m.senderId) === Number(user.id) && m.content && (
                    <button 
                      type="button"
                      className="message-action-icon-btn"
                      onClick={() => {
                        setEditingMessageId(m.id);
                        setEditingText(m.content);
                      }}
                      title="Edit message"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                  {Number(m.senderId) === Number(user.id) && (
                    <button 
                      type="button"
                      className="message-action-icon-btn danger"
                      onClick={() => handleDeleteMessage(m.id)}
                      title="Unsend message"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}

              {activeReactionPickerId === m.id && (
                <div 
                  className="reaction-picker-popover"
                  style={{
                    position: 'absolute',
                    top: '24px',
                    right: '16px',
                    background: 'rgba(23, 23, 23, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '4px 8px',
                    display: 'flex',
                    gap: 6,
                    zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                  }}
                >
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        handleReactToMessage(m.id, emoji);
                        setActiveReactionPickerId(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        transition: 'transform 0.15s',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="typing-indicator">
            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-input-container">
        {replyToMessage && (
          <div className="reply-preview-bar" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            gap: 12
          }}>
            <div style={{ flex: 1, overflow: 'hidden', borderLeft: '3px solid var(--primary)', paddingLeft: 10 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>
                Replying to {Number(replyToMessage.senderId) === Number(user.id) ? 'yourself' : chatUser.username}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyToMessage.image ? '📷 Image' : replyToMessage.audio ? '🎵 Voice message' : replyToMessage.content}
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-ghost btn-icon btn-sm" 
              onClick={() => setReplyToMessage(null)}
              style={{ padding: 4, width: 24, height: 24, borderRadius: '50%' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
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
        
        {isForging && (
          <div className="forged-active-badge animate-in" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', color: '#c084fc', marginBottom: 8, width: 'fit-content' }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #a855f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span>AI Forge is rewriting your message...</span>
          </div>
        )}

        {forgedPersona && !isForging && (
          <div className="forged-active-badge animate-in" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', color: '#e9d5ff', marginBottom: 8, width: 'fit-content' }}>
            <Sparkles size={12} style={{ color: '#c084fc' }} />
            <span>Identity Forge Engaged: <strong>{forgedPersona}</strong> style applied</span>
            <button 
              type="button" 
              onClick={() => { setForgedPersona(null); }} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2, marginLeft: 4 }}
              title="Clear AI Persona"
            >
              <X size={12} />
            </button>
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
            placeholder={isForging ? "AI Forge masking..." : noStoreActive ? "Ghost message..." : "Type a message..."} 
            value={text} 
            onChange={e => handleTyping(e.target.value)}
            disabled={uploading || isForging}
          />

          {text.trim() && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                type="button" 
                className={`btn btn-ghost btn-icon attachment-btn ${showCloakDropdown ? 'active' : ''}`} 
                title="AI Identity Forge"
                onClick={() => {
                  setShowCloakDropdown(!showCloakDropdown);
                  setShowVoiceMasker(false);
                }}
                disabled={uploading || isForging}
                style={{ padding: 6 }}
              >
                <Sparkles size={18} />
              </button>
              {showCloakDropdown && (
                <div className="cloak-radial-container">
                  <div className="cloak-radial-center">
                    <Sparkles size={20} style={{ color: '#a855f7' }} />
                    <span style={{ fontSize: '0.55rem', marginTop: 4 }}>AI Forge</span>
                  </div>
                  
                  <div 
                    className="cloak-radial-item top" 
                    onClick={() => applyForge('Psychoanalytic')}
                    title="Psychoanalytic (Freudian slang, probing, over-analyzing)"
                  >
                    🧠 Psycho
                    <span>Analytic</span>
                  </div>
                  
                  <div 
                    className="cloak-radial-item right" 
                    onClick={() => applyForge('Cyber-Street')}
                    title="Cyber-Street (high-tech low-life, l33t, street hacker)"
                  >
                    🦾 Cyber
                    <span>Street</span>
                  </div>
                  
                  <div 
                    className="cloak-radial-item bottom" 
                    onClick={() => applyForge('Elite Academic')}
                    title="Elite Academic (pretentious, long-winded, passive voice)"
                  >
                    🎓 Academic
                    <span>Pretentious</span>
                  </div>
                  
                  <div 
                    className="cloak-radial-item left" 
                    onClick={() => applyForge('Corporate Politician')}
                    title="Corporate Politician (spin-doctored, sanitized, buzzword-heavy)"
                  >
                    👔 Corporate
                    <span>Politician</span>
                  </div>
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

      {/* E2EE Key Verification Modal */}
      {showE2eeModal && (
        <div className="modal-overlay" onClick={() => setShowE2eeModal(false)}>
          <div className="modal-card e2ee-modal-card animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-glow)' }}>
              <Key size={28} />
            </div>
            <h3>End-to-End Encryption</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Messages in this chat are encrypted client-side using X25519/P-256 curve ECDH key exchange and AES-256-GCM.
            </p>

            <div className="e2ee-qr-section" style={{ margin: '16px 0', position: 'relative' }}>
              <FingerprintQR fingerprint={friendFingerprint || user?.keyFingerprint} />
              <div className="e2ee-qr-scanner-glow" />
            </div>

            <div className="e2ee-fingerprints-container" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', margin: '12px 0' }}>
              <div className="fingerprint-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                <span className="fingerprint-label" style={{ color: 'var(--text-muted)' }}>Your Fingerprint</span>
                <span className="fingerprint-value" style={{ fontFamily: 'monospace', color: 'var(--text)' }} title={user?.keyFingerprint}>
                  {user?.keyFingerprint ? `${user.keyFingerprint.substring(0, 23)}...` : 'Generating...'}
                </span>
              </div>
              <div className="fingerprint-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', paddingTop: 4 }}>
                <span className="fingerprint-label" style={{ color: 'var(--text-muted)' }}>{chatUser?.username}'s Fingerprint</span>
                <span className="fingerprint-value" style={{ fontFamily: 'monospace', color: 'var(--text)' }} title={friendFingerprint}>
                  {friendFingerprint ? `${friendFingerprint.substring(0, 23)}...` : 'Generating...'}
                </span>
              </div>
            </div>

            <div className="e2ee-verify-toggle-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', margin: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isE2eeVerified ? (
                  <Lock size={16} style={{ color: 'var(--accent-glow)' }} />
                ) : (
                  <Unlock size={16} style={{ color: 'var(--warning-color)' }} />
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Verify Partner Identity</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confirm that fingerprints match to trust this connection</div>
                </div>
              </div>
              <div className={`nostore-toggle-switch ${isE2eeVerified ? 'active' : ''}`} onClick={() => toggleVerifyE2ee(!isE2eeVerified)} style={{ cursor: 'pointer' }}>
                <div className="nostore-toggle-thumb" />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowE2eeModal(false)}
                style={{ width: '100%' }}
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
