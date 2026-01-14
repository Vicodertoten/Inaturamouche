import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { subscribeToNotifications } from '../services/notifications.js';
import './ToastContainer.css';

const buildId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((toast) => {
      if (!toast?.message) return;
      const id = buildId();
      const payload = {
        id,
        type: toast.type || 'error',
        message: toast.message,
        duration: toast.duration || 4000,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, payload]);

      const timeout = setTimeout(() => removeToast(id), payload.duration);
      timers.current.set(id, timeout);
    });
    return () => unsubscribe();
  }, [removeToast]);

  const entries = useMemo(() => toasts.slice(-4), [toasts]);

  const pauseToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    clearTimeout(timer);
    // compute remaining
    const t = toasts.find((t) => t.id === id);
    if (!t) return;
    const elapsed = Date.now() - t.createdAt;
    t._remaining = Math.max(0, (t.duration || 4000) - elapsed);
    timers.current.delete(id);
  }, [toasts]);

  const resumeToast = useCallback((id) => {
    const t = toasts.find((t) => t.id === id);
    if (!t) return;
    const remaining = t._remaining || (t.duration || 4000);
    const timeout = setTimeout(() => removeToast(id), remaining);
    timers.current.set(id, timeout);
    delete t._remaining;
  }, [toasts, removeToast]);

  if (!entries.length) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
      {entries.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Escape') removeToast(toast.id); }}
          onMouseEnter={() => pauseToast(toast.id)}
          onMouseLeave={() => resumeToast(toast.id)}
        >
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
