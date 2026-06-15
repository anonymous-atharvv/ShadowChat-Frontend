import { useState, useEffect } from 'react';
import { Search, UserPlus, Check, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Avatar';

export default function Explore() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [sending, setSending] = useState(new Set());
  const { token } = useAuth();
  const { isOnline, notifyFriendRequest, notifyFriendAccepted } = useSocket();

  useEffect(() => {
    fetch('/api/users/explore', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setUsers).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setSearchResults(await r.json());
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);

  const sendRequest = async (userId) => {
    setSending(prev => new Set(prev).add(userId));
    try {
      const r = await fetch('/api/friends/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      if (r.ok) {
        const data = await r.json();
        notifyFriendRequest(userId);
        
        if (data.autoAccepted) {
          notifyFriendAccepted(userId);
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'friend' } : u));
          if (searchResults) setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'friend' } : u));
        } else {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'sent' } : u));
          if (searchResults) setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'sent' } : u));
        }
      }
    } catch {}
    setSending(prev => { const n = new Set(prev); n.delete(userId); return n; });
  };

  const acceptRequest = async (requestId, userId) => {
    setSending(prev => new Set(prev).add(userId));
    try {
      const r = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        notifyFriendAccepted(userId);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'friend' } : u));
        if (searchResults) setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, relationship: 'friend' } : u));
      }
    } catch {}
    setSending(prev => { const n = new Set(prev); n.delete(userId); return n; });
  };

  const displayUsers = searchResults || users;

  const renderActionButton = (u) => {
    const isWorking = sending.has(u.id);

    if (u.relationship === 'friend') {
      return (
        <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.8 }}>
          <Check size={14} /> Friends
        </button>
      );
    }

    if (u.relationship === 'sent') {
      return (
        <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.8 }}>
          <Clock size={14} /> Sent
        </button>
      );
    }

    if (u.relationship === 'received') {
      return (
        <button 
          className="btn btn-sm" 
          onClick={() => acceptRequest(u.requestId, u.id)} 
          disabled={isWorking}
          style={{ backgroundColor: 'var(--green-dim)', borderColor: 'rgba(74, 222, 128, 0.25)', color: 'var(--green)' }}
        >
          <Check size={14} /> Accept
        </button>
      );
    }

    // Default: 'none' or not set (fallback checks requestSent)
    if (u.requestSent) {
      return (
        <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.8 }}>
          <Clock size={14} /> Sent
        </button>
      );
    }

    return (
      <button className="btn btn-primary btn-sm" onClick={() => sendRequest(u.id)} disabled={isWorking}>
        <UserPlus size={14} /> Add
      </button>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Explore</h1>
        <p>Discover anonymous users and add friends</p>
      </div>
      <div className="page-body">
        <div className="search-bar" style={{ marginBottom: 20 }}>
          <Search />
          <input className="input" placeholder="Search by username..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {searchResults && search && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"</p>}
        <div className="user-grid">
          {displayUsers.map(u => (
            <div key={u.id} className="card animate-in">
              <div className="user-item" style={{ padding: 0 }}>
                <Avatar username={u.username} color={u.avatarColor} online={isOnline(u.id)} />
                <div className="user-info">
                  <h4>{u.username}</h4>
                  <p>{u.bio || 'Anonymous user'}</p>
                </div>
                <div className="user-actions">
                  {renderActionButton(u)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {displayUsers.length === 0 && (
          <div className="empty-state">
            <Search size={40} />
            <h3>{search ? 'No users found' : 'No users to explore'}</h3>
            <p>{search ? 'Try a different username' : 'Be the first one here!'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
