import { useState } from 'react';
import { Shield, Eye, EyeOff, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(null);
  const { login, signup } = useAuth();

  const checkUsername = async (val) => {
    setUsername(val);
    if (!isLogin && val.length >= 3) {
      try {
        const r = await fetch(`/api/auth/check-username/${val}`);
        const d = await r.json();
        setAvailable(d.available);
      } catch { setAvailable(null); }
    } else { setAvailable(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await login(username, password);
      else await signup(username, password);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      {/* Floating particles */}
      <div className="auth-particles">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="auth-particle" style={{
            '--x': `${Math.random() * 100}%`,
            '--y': `${Math.random() * 100}%`,
            '--duration': `${8 + Math.random() * 15}s`,
            '--delay': `${Math.random() * -20}s`,
            '--size': `${2 + Math.random() * 4}px`,
          }} />
        ))}
      </div>

      <div className="auth-card animate-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <MessageCircle size={24} color="white" />
          </div>
          <div>
            <h2>ShadowChat</h2>
            <span className="auth-logo-tag">
              <Sparkles size={10} /> Anonymous Messaging
            </span>
          </div>
        </div>
        <p className="auth-subtitle">
          {isLogin ? 'Welcome back, shadow. Your anonymity awaits.' : 'Create your anonymous identity. No email. No phone. Just you.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input className={`input ${error && !username ? 'input-error' : ''}`} type="text" placeholder="Choose a unique username" value={username} onChange={e => checkUsername(e.target.value)} autoComplete="username" />
            {!isLogin && available === true && username.length >= 3 && <span className="success-text">✓ Username available</span>}
            {!isLogin && available === false && <span className="error-text">✗ Username taken</span>}
          </div>
          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPw ? 'text' : 'password'} placeholder={isLogin ? 'Enter password' : 'Min 6 characters'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="password-toggle">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-gradient btn-shimmer" type="submit" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
            {loading ? (
              <span className="btn-loading">
                <span className="btn-loading-dot" />
                <span className="btn-loading-dot" />
                <span className="btn-loading-dot" />
              </span>
            ) : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {!isLogin && (
          <div className="auth-privacy">
            <Shield size={16} />
            <span>100% anonymous. We never collect personal data.</span>
          </div>
        )}
        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setAvailable(null); }}>
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
