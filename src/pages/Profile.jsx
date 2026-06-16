import { useState } from 'react';
import { LogOut, Shield, Calendar, Users, Save, Sparkles } from 'lucide-react';
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
          <div className="profile-avatar-ring">
            <Avatar username={user?.username} color={user?.avatarColor} size="xl" />
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
        <button className="btn btn-danger btn-logout animate-in" onClick={logout} style={{ animationDelay: '0.3s' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
