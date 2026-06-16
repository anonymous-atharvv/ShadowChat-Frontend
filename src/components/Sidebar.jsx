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
      <div className="sidebar-logo" onClick={() => navigate('/chat')}>
        <span>S</span>
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

export function BottomNav({ unreadCount = 0, requestCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();

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
