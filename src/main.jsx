import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

const originalFetch = window.fetch;
window.fetch = function (input, init) {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  let target = input;
  if (typeof input === 'string' && input.startsWith('/api')) {
    target = `${apiUrl.replace(/\/$/, '')}${input}`;
  }
  
  const options = init || {};
  if (typeof input === 'string' && input.startsWith('/api')) {
    options.credentials = 'include';
  }
  return originalFetch(target, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
