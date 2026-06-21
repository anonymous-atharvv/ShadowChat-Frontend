import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, BellOff, Plus, X, Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import Avatar from '../components/Avatar';

// Gradient Presets for text stories
const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #8b5cf6, #ec4899)', // Purple -> Pink
  'linear-gradient(135deg, #3b82f6, #10b981)', // Blue -> Green
  'linear-gradient(135deg, #f97316, #ef4444)', // Orange -> Red
  'linear-gradient(135deg, #1e293b, #0f172a)', // Dark Slate
  'linear-gradient(135deg, #ec4899, #f43f5e)'  // Magenta -> Coral
];

export default function ChatList({ onSelectChat, activeChatId }) {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  
  // Stories state
  const [stories, setStories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeStoryUser, setActiveStoryUser] = useState(null);
  
  // Create Story Form state
  const [storyText, setStoryText] = useState('');
  const [storyImage, setStoryImage] = useState(null);
  const [selectedGradientIdx, setSelectedGradientIdx] = useState(0);
  const [posting, setPosting] = useState(false);

  const { token, user } = useAuth();
  const { incomingMessage, setIncomingMessage, isOnline } = useSocket();
  const { isMuted } = useNotification();
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setConversations(await r.json());
    } catch {}
  }, [token]);

  const fetchStories = useCallback(async () => {
    try {
      const r = await fetch('/api/stories', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setStories(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => { 
    fetchConversations(); 
    fetchStories();
  }, [fetchConversations, fetchStories]);

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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large! Maximum allowed size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setStoryImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePostStory = async (e) => {
    e.preventDefault();
    if (!storyText.trim() && !storyImage) return;

    setPosting(true);
    try {
      let contentVal = storyText.trim();
      // If there is no image, package the text story with a custom gradient
      if (!storyImage) {
        contentVal = JSON.stringify({
          text: storyText.trim(),
          gradient: GRADIENT_PRESETS[selectedGradientIdx]
        });
      }

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: contentVal,
          image: storyImage
        })
      });

      if (res.ok) {
        setStoryText('');
        setStoryImage(null);
        setShowCreateModal(false);
        fetchStories();
      } else {
        alert('Failed to post story');
      }
    } catch (err) {
      console.error(err);
    }
    setPosting(false);
  };

  const myStories = stories.find(s => s.userId === user?.id);
  const otherStories = stories.filter(s => s.userId !== user?.id);

  return (
    <div className="chat-list-panel">
      <div className="chat-list-header">
        <h1>Messages</h1>
        <div className="search-bar">
          <Search />
          <input className="input" placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Stories Slider */}
      <div className="stories-bar">
        <div className="stories-scroll">
          {/* My Story Avatar */}
          <div className="story-item">
            <div 
              className={`story-avatar-wrap ${myStories ? 'has-stories' : ''}`}
              onClick={myStories ? () => setActiveStoryUser(myStories) : () => setShowCreateModal(true)}
            >
              <Avatar username={user?.username} color={user?.avatarColor} size="md" />
              {!myStories && (
                <div className="story-plus-badge" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}>
                  <Plus size={12} />
                </div>
              )}
            </div>
            <span className="story-username">My Story</span>
          </div>

          {/* Friends Stories Avatars */}
          {otherStories.map(s => (
            <div key={s.userId} className="story-item" onClick={() => setActiveStoryUser(s)}>
              <div className="story-avatar-wrap has-stories">
                <Avatar username={s.username} color={s.avatarColor} size="md" />
              </div>
              <span className="story-username">{s.username}</span>
            </div>
          ))}
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

      {/* Story Creator Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-in" style={{ maxWidth: 420 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Add to Story</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowCreateModal(false); setStoryImage(null); }}><X size={18} /></button>
            </div>
            
            <form onSubmit={handlePostStory}>
              {storyImage ? (
                <div className="story-compose-preview">
                  <img src={storyImage} alt="Story Attachment" />
                  <button type="button" className="btn btn-ghost btn-icon story-preview-close" onClick={() => setStoryImage(null)}><X size={14} /></button>
                  
                  <input 
                    className="input story-caption-input" 
                    placeholder="Add a caption..." 
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    maxLength={100}
                  />
                </div>
              ) : (
                <div className="story-compose-text" style={{ background: GRADIENT_PRESETS[selectedGradientIdx] }}>
                  <textarea 
                    placeholder="Share something with your friends..." 
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    maxLength={200}
                    rows={4}
                  />
                  <div className="story-gradient-selectors">
                    {GRADIENT_PRESETS.map((grad, idx) => (
                      <div 
                        key={idx}
                        className={`gradient-color-dot ${selectedGradientIdx === idx ? 'active' : ''}`}
                        style={{ background: grad }}
                        onClick={() => setSelectedGradientIdx(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="story-compose-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                {!storyImage && (
                  <label className="btn btn-ghost" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Image size={18} />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                  </label>
                )}
                <div style={{ flex: 1 }} />
                <button 
                  className="btn btn-primary" 
                  type="submit" 
                  disabled={posting || (!storyText.trim() && !storyImage)}
                >
                  {posting ? 'Posting...' : 'Post Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {activeStoryUser && (
        <StoryViewer 
          storyUser={activeStoryUser} 
          onClose={() => setActiveStoryUser(null)} 
        />
      )}
    </div>
  );
}

// Story Viewer Overlay Component
function StoryViewer({ storyUser, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeProgress, setActiveProgress] = useState(0);
  const items = storyUser.items;
  const currentItem = items[currentIndex];

  // Auto progression tick
  useEffect(() => {
    setActiveProgress(0);
    const interval = setInterval(() => {
      setActiveProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 50); // 5 seconds total (50ms * 100)

    const timer = setTimeout(() => {
      if (currentIndex < items.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [currentIndex, items, onClose]);

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const renderContent = () => {
    if (currentItem.image) {
      return (
        <div className="story-viewer-image-wrap">
          <img src={currentItem.image} alt="Story Content" />
          {currentItem.content && <p className="story-viewer-caption">{currentItem.content}</p>}
        </div>
      );
    }

    try {
      if (currentItem.content && currentItem.content.startsWith('{')) {
        const parsed = JSON.parse(currentItem.content);
        return (
          <div className="story-viewer-text-wrap" style={{ background: parsed.gradient || GRADIENT_PRESETS[0] }}>
            <p className="story-viewer-text">{parsed.text}</p>
          </div>
        );
      }
    } catch (e) {}

    return (
      <div className="story-viewer-text-wrap" style={{ background: GRADIENT_PRESETS[0] }}>
        <p className="story-viewer-text">{currentItem.content}</p>
      </div>
    );
  };

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer-card" onClick={e => e.stopPropagation()}>
        {/* Story indicators */}
        <div className="story-progress-container">
          {items.map((item, idx) => (
            <div key={item.id} className="story-progress-bar-wrap">
              <div 
                className="story-progress-bar-fill" 
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${activeProgress}%` : '0%'
                }} 
              />
            </div>
          ))}
        </div>

        {/* User details header */}
        <div className="story-viewer-header">
          <Avatar username={storyUser.username} color={storyUser.avatarColor} size="sm" />
          <span className="story-viewer-username">{storyUser.username}</span>
          <span className="story-viewer-time">
            {new Date(currentItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button className="btn btn-ghost btn-icon story-viewer-close" onClick={onClose} style={{ marginLeft: 'auto', color: 'white' }}>
            <X size={18} />
          </button>
        </div>

        {/* Side regions for click navigation */}
        <div className="story-viewer-nav-left" onClick={handlePrev} />
        <div className="story-viewer-nav-right" onClick={handleNext} />

        {/* Story Body */}
        <div className="story-viewer-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
