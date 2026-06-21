import { useState } from 'react';
import { LogOut, Shield, Calendar, Users, Save, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveBio = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/users/me', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio })
      });
      if (r.ok) { updateUser({ bio }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  };

  const toggleActiveStatus = async () => {
    const currentStatus = !!user?.activeStatusEnabled;
    const newStatus = !currentStatus;
    
    // Optimistic update
    updateUser({ activeStatusEnabled: newStatus });
    
    try {
      const r = await fetch('/api/users/me/active-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: newStatus })
      });
      if (!r.ok) {
        updateUser({ activeStatusEnabled: currentStatus });
      }
    } catch {
      updateUser({ activeStatusEnabled: currentStatus });
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const r = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        setShowDeleteModal(false);
        logout();
      }
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
  };

  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your anonymous identity and settings</p>
      </div>
      <div className="page-body">
        <div className="card profile-card animate-in">
          <div className="profile-avatar-ring">
            <Avatar username={user?.username} color={user?.avatarColor} size="xl" avatarUrl={user?.avatarUrl} />
          </div>
          <h2>@{user?.username}</h2>
          <p className="username"><Shield size={12} style={{ verticalAlign: 'middle' }} /> Anonymous Identity</p>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="value">{user?.friendCount || 0}</div>
              <div className="label">Friends</div>
            </div>
            <div className="profile-stat">
              <div className="value"><Sparkles size={18} style={{ verticalAlign: 'middle' }} /></div>
              <div className="label">Anonymous</div>
            </div>
          </div>
        </div>
        <div className="card animate-in" style={{ marginTop: 16, animationDelay: '0.1s' }}>
          <label className="card-label">Bio</label>
          <div className="profile-bio">
            <textarea rows={3} placeholder="Write something about yourself..." value={bio} onChange={e => setBio(e.target.value)} maxLength={150} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span className="char-count">{bio.length}/150</span>
            <button className={`btn btn-primary btn-sm ${saved ? 'btn-saved' : ''}`} onClick={saveBio} disabled={saving}>
              <Save size={14} /> {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
        <div className="card animate-in" style={{ marginTop: 16, animationDelay: '0.2s' }}>
          <div className="profile-meta-item">
            <Calendar size={16} />
            <span>Member since {memberSince}</span>
          </div>
        </div>

        <div className="card animate-in" style={{ marginTop: 16, animationDelay: '0.25s' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Settings</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Show Active Status</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                Allows friends to see when you're online. If you turn this off, you won't see other people's online status either.
              </div>
            </div>
            <div 
              className={`nostore-toggle-switch ${user?.activeStatusEnabled ? 'active' : ''}`}
              onClick={toggleActiveStatus}
              style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}
            >
              <div className="nostore-toggle-thumb" />
            </div>
          </div>
        </div>
        
        <div className="card danger-zone animate-in" style={{ marginTop: 16, borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.03)', animationDelay: '0.3s' }}>
          <h3 style={{ color: '#f87171', margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 600 }}>Danger Zone</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Permanently delete your account and all associated data, including friend requests, friendships, stories, and chats. This action is irreversible.
          </p>
          <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={14} /> Delete Account
          </button>
        </div>

        <button className="btn btn-logout animate-in" onClick={logout} style={{ animationDelay: '0.4s', backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', marginTop: 16 }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-in" style={{ maxWidth: 400 }}>
            <h2 style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}><Trash2 size={24} /> Delete Account?</h2>
            <p style={{ margin: '16px 0', lineHeight: 1.5, color: 'var(--text-secondary)' }}>Are you absolutely sure you want to delete your account? This will permanently erase your profile, chats, friend connections, and stories. This action cannot be undone.</p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
