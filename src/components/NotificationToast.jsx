import { useEffect, useState } from 'react';
import { MessageCircle, UserPlus, X, BellOff } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import Avatar from './Avatar';

function ToastItem({ notification, onDismiss, index }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const handleClick = () => {
    if (notification.onClick) notification.onClick();
    handleDismiss();
  };

  const icon = notification.type === 'friend_request' 
    ? <UserPlus size={16} /> 
    : notification.type === 'friend_accepted'
    ? <UserPlus size={16} />
    : <MessageCircle size={16} />;

  const typeLabel = notification.type === 'friend_request' 
    ? 'Friend Request' 
    : notification.type === 'friend_accepted'
    ? 'Friend Accepted'
    : 'New Message';

  return (
    <div 
      className={`notification-toast ${exiting ? 'notification-toast-exit' : 'notification-toast-enter'}`}
      style={{ '--toast-index': index }}
      onClick={handleClick}
    >
      <div className="notification-toast-accent" />
      <div className="notification-toast-content">
        <div className="notification-toast-left">
          {notification.avatar ? (
            <Avatar username={notification.avatar} color={notification.avatarColor} size="sm" />
          ) : (
            <div className="notification-toast-icon">{icon}</div>
          )}
        </div>
        <div className="notification-toast-body">
          <div className="notification-toast-header">
            <span className="notification-toast-type">{typeLabel}</span>
            <button className="notification-toast-close" onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
              <X size={14} />
            </button>
          </div>
          <p className="notification-toast-title">{notification.title}</p>
          {notification.body && <p className="notification-toast-text">{notification.body}</p>}
        </div>
      </div>
      <div className="notification-toast-progress" />
    </div>
  );
}

export default function NotificationToast() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="notification-toast-container">
      {notifications.map((n, i) => (
        <ToastItem key={n.id} notification={n} onDismiss={removeNotification} index={i} />
      ))}
    </div>
  );
}
