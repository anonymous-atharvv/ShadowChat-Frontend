export default function Avatar({ username, color, size = '', online, className = '', avatarUrl }) {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const sizeClass = size ? `avatar-${size}` : '';

  const getFullAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return `${apiUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const resolvedUrl = getFullAvatarUrl(avatarUrl);

  return (
    <div className={`avatar ${sizeClass} ${className}`} style={{ background: resolvedUrl ? 'transparent' : (color || '#8b5cf6'), position: 'relative' }}>
      {resolvedUrl ? (
        <img 
          src={resolvedUrl} 
          alt={username} 
          className="avatar-img"
          style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover', overflow: 'hidden' }}
        />
      ) : (
        initial
      )}
      {online && <span className="online-dot" />}
    </div>
  );
}
