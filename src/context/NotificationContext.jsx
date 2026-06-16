import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const NotificationContext = createContext(null);

const NOTIFICATION_SOUND_FREQ = 880; // A5 note
const NOTIFICATION_DURATION = 0.15;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(NOTIFICATION_SOUND_FREQ, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + NOTIFICATION_DURATION + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + NOTIFICATION_DURATION + 0.15);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function getStoredMutes() {
  try {
    return JSON.parse(localStorage.getItem('sc_muted_chats') || '{}');
  } catch { return {}; }
}

function storeMutes(mutes) {
  localStorage.setItem('sc_muted_chats', JSON.stringify(mutes));
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [mutedChats, setMutedChats] = useState(getStoredMutes);
  const [globalMute, setGlobalMute] = useState(() => localStorage.getItem('sc_global_mute') === 'true');
  const [activeChatId, setActiveChatId] = useState(null);
  const idCounter = useRef(0);

  // Persist mute states
  useEffect(() => { storeMutes(mutedChats); }, [mutedChats]);
  useEffect(() => { localStorage.setItem('sc_global_mute', globalMute); }, [globalMute]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback(({ type = 'message', title, body, avatar, avatarColor, senderId, chatUser, onClick }) => {
    // Don't notify for active chat
    if (senderId && senderId === activeChatId) return;
    // Don't notify for muted chats (message type only)
    if (type === 'message' && senderId && mutedChats[senderId]) return;
    // Don't notify if globally muted
    if (globalMute) return;

    const id = ++idCounter.current;
    const notification = { id, type, title, body, avatar, avatarColor, senderId, chatUser, onClick, createdAt: Date.now() };
    
    setNotifications(prev => [...prev.slice(-4), notification]); // max 5 notifications
    playNotificationSound();

    // Auto-dismiss after 4.5s
    setTimeout(() => removeNotification(id), 4500);

    // Browser notification (if tab is hidden)
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.svg', tag: `sc-${senderId || id}` });
      } catch {}
    }
  }, [activeChatId, mutedChats, globalMute, removeNotification]);

  const muteChat = useCallback((chatId) => {
    setMutedChats(prev => ({ ...prev, [chatId]: true }));
  }, []);

  const unmuteChat = useCallback((chatId) => {
    setMutedChats(prev => { const n = { ...prev }; delete n[chatId]; return n; });
  }, []);

  const isMuted = useCallback((chatId) => !!mutedChats[chatId], [mutedChats]);

  const toggleGlobalMute = useCallback(() => {
    setGlobalMute(prev => !prev);
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, notify, removeNotification,
      muteChat, unmuteChat, isMuted, mutedChats,
      globalMute, toggleGlobalMute,
      activeChatId, setActiveChatId,
      requestPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
