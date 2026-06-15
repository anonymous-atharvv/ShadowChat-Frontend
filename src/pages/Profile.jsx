import { useState } from 'react';
import { LogOut, Shield, Calendar, Users, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your anonymous identity and settings</p>
      </div>
      <div className="page-body">
        <div className="card profile-card animate-in">
          <Avatar username={user?.username} color={user?.avatarColor} size="xl" />
          <h2>@{user?.username}</h2>
          <p className="username">Anonymous Identity</p>
          <div className="profile-stats">
            <div className="profile-stat"><div className="value">{user?.friendCount || 0}</div><div className="label">Friends</div></div>
            <div className="profile-stat"><div className="value"><Shield size={18} style={{ verticalAlign: 'middle', color: 'var(--accent)' }} /></div><div className="label">Anonymous</div></div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>Bio</label>
          <div className="profile-bio" style={{ margin: 0 }}>
            <textarea rows={3} placeholder="Write something about yourself..." value={bio} onChange={e => setBio(e.target.value)} maxLength={150} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bio.length}/150</span>
            <button className="btn btn-primary btn-sm" onClick={saveBio} disabled={saving}>
              <Save size={14} /> {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
            <Calendar size={16} style={{ color: 'var(--accent)' }} /> Member since {memberSince}
          </div>
        </div>
        <button className="btn btn-danger" onClick={logout} style={{ width: '100%', marginTop: 24, padding: '14px' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
