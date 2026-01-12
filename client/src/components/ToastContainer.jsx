import { useEffect, useMemo, useState } from 'react';
import { subscribeToNotifications } from '../services/notifications.js';
import './ToastContainer.css';

const buildId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((toast) => {
      if (!toast?.message) return;
      const id = buildId();
      const payload = {
        id,
        type: toast.type || 'error',
        message: toast.message,
        duration: toast.duration || 4000,
      };
      setToasts((prev) => [...prev, payload]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, payload.duration);
    });
    return () => unsubscribe();
  }, []);

  const entries = useMemo(() => toasts.slice(-4), [toasts]);

  if (!entries.length) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {entries.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
