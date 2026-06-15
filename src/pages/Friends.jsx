import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, MessageCircle, UserMinus, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Avatar';

export default function Friends() {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const { token } = useAuth();
  const { isOnline, friendEvent, setFriendEvent, notifyFriendAccepted } = useSocket();
  const navigate = useNavigate();

  const fetchFriends = async () => {
    try { const r = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setFriends(await r.json()); } catch {}
  };
  const fetchRequests = async () => {
    try { const r = await fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setRequests(await r.json()); } catch {}
  };

  useEffect(() => { fetchFriends(); fetchRequests(); }, [token]);
  useEffect(() => { if (friendEvent) { fetchFriends(); fetchRequests(); setFriendEvent(null); } }, [friendEvent]);

  const accept = async (id, userId) => {
    try {
      const r = await fetch(`/api/friends/accept/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { notifyFriendAccepted(userId); fetchFriends(); fetchRequests(); }
    } catch {}
  };
  const reject = async (id) => {
    try { await fetch(`/api/friends/reject/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); fetchRequests(); } catch {}
  };
  const unfriend = async (id) => {
    try { await fetch(`/api/friends/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchFriends(); } catch {}
  };

  const reqCount = requests.incoming.length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Friends</h1>
        <p>{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
        <div className="tabs" style={{ marginTop: 12 }}>
          <button className={`tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>Friends</button>
          <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>Requests {reqCount > 0 && <span className="notification-dot" />}</button>
        </div>
      </div>
      <div className="page-body">
        {tab === 'friends' && (
          friends.length === 0 ? (
            <div className="empty-state"><Users size={40} /><h3>No friends yet</h3><p>Search and add people to get started</p></div>
          ) : friends.map(f => (
            <div key={f.id} className="card animate-in" style={{ marginBottom: '12px' }}>
              <div className="user-item" style={{ padding: 0 }}>
                <Avatar username={f.username} color={f.avatarColor} online={isOnline(f.id)} />
                <div className="user-info"><h4>{f.username}</h4><p>{f.bio || 'Anonymous user'}</p></div>
                <div className="user-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/chat/${f.id}`, { state: { user: f } })}><MessageCircle size={14} /> Chat</button>
                  <button className="btn btn-danger btn-sm" onClick={() => unfriend(f.id)}><UserMinus size={14} /></button>
                </div>
              </div>
            </div>
          ))
        )}
        {tab === 'requests' && (
          <>
            {requests.incoming.length > 0 && <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Incoming</h3>}
            {requests.incoming.map(r => (
              <div key={r.id} className="card animate-in" style={{ marginBottom: '12px' }}>
                <div className="user-item" style={{ padding: 0 }}>
                  <Avatar username={r.username} color={r.avatarColor} />
                  <div className="user-info"><h4>{r.username}</h4><p>{r.bio || 'Wants to connect'}</p></div>
                  <div className="user-actions">
                    <button className="btn btn-sm" onClick={() => accept(r.id, r.userId)} style={{ backgroundColor: 'var(--green-dim)', borderColor: 'rgba(74, 222, 128, 0.25)', color: 'var(--green)' }}><Check size={14} /> Accept</button>
                    <button className="btn btn-danger btn-sm" onClick={() => reject(r.id)}><X size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {requests.outgoing.length > 0 && <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '16px 0 12px' }}>Sent</h3>}
            {requests.outgoing.map(r => (
              <div key={r.id} className="card animate-in" style={{ marginBottom: '12px' }}>
                <div className="user-item" style={{ padding: 0 }}>
                  <Avatar username={r.username} color={r.avatarColor} />
                  <div className="user-info"><h4>{r.username}</h4><p>Request pending</p></div>
                </div>
              </div>
            ))}
            {requests.incoming.length === 0 && requests.outgoing.length === 0 && (
              <div className="empty-state"><UserPlus size={40} /><h3>No pending requests</h3><p>Friend requests will appear here</p></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
