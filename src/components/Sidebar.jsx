import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Compass, Users, User, LogOut, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const navItems = [
  { path: '/chat', icon: MessageCircle, label: 'Chats' },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar({ unreadCount = 0, requestCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { globalMute, toggleGlobalMute } = useNotification();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate('/chat')} title="Shadow Onion" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
          <path d="M12 2C8 6.5 5 10.5 5 14.5a7 7 0 0 0 14 0c0-4-3-8-7-12.5z" />
          <path d="M12 6.5c-2.5 3-4.5 5.5-4.5 8a4.5 4.5 0 0 0 9 0c0-2.5-2-5-4.5-8z" />
          <path d="M12 11a3.5 3.5 0 0 0-3.5 3.5 3.5 3.5 0 0 0 7 0A3.5 3.5 0 0 0 12 11z" />
        </svg>
      </div>
      {navItems.map(item => (
        <button
          key={item.path}
          className={`sidebar-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          title={item.label}
        >
          <item.icon size={22} />
          {item.path === '/chat' && unreadCount > 0 && <span className="badge badge-bounce">{unreadCount}</span>}
          {item.path === '/friends' && requestCount > 0 && <span className="badge badge-bounce">{requestCount}</span>}
          <span className="sidebar-tooltip">{item.label}</span>
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button 
        className={`sidebar-item ${globalMute ? 'muted' : ''}`} 
        onClick={toggleGlobalMute} 
        title={globalMute ? 'Unmute all' : 'Mute all'}
      >
        {globalMute ? <VolumeX size={20} /> : <Volume2 size={20} />}
        <span className="sidebar-tooltip">{globalMute ? 'Unmute' : 'Mute All'}</span>
      </button>
      <button className="sidebar-item sidebar-logout" onClick={logout} title="Logout">
        <LogOut size={20} />
        <span className="sidebar-tooltip">Logout</span>
      </button>
    </nav>
  );
}

export function BottomNav({ unreadCount = 0, requestCount = 0, hideOnChat = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (hideOnChat) return null;

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map(item => (
          <button
            key={item.path}
            className={`bottom-nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
            {item.path === '/chat' && unreadCount > 0 && <span className="badge badge-bounce">{unreadCount}</span>}
            {item.path === '/friends' && requestCount > 0 && <span className="badge badge-bounce">{requestCount}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
