export default function Avatar({ username, color, size = '', online, className = '' }) {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const sizeClass = size ? `avatar-${size}` : '';
  return (
    <div className={`avatar ${sizeClass} ${className}`} style={{ background: color || '#8b5cf6' }}>
      {initial}
      {online && <span className="online-dot" />}
    </div>
  );
}
