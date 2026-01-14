import test from 'node:test';
import assert from 'node:assert/strict';
import { notify, subscribeToNotifications } from '../src/services/notifications.js';

test('subscribeToNotifications receives dispatched notifications', async () => {
  // Mock a minimal window-like event system for Node
  const listeners = {};
  const mockWindow = {
    addEventListener: (type, fn) => { listeners[type] = (listeners[type] || []); listeners[type].push(fn); },
    removeEventListener: (type, fn) => { if (!listeners[type]) return; listeners[type] = listeners[type].filter((f) => f !== fn); },
    dispatchEvent: (ev) => { (listeners[ev?.type] || []).forEach((fn) => fn(ev)); },
  };

  globalThis.window = mockWindow;

  await new Promise((resolve, reject) => {
    const unsubscribe = subscribeToNotifications((payload) => {
      try {
        assert.equal(payload.message, 'hello world');
        assert.equal(payload.type, 'info');
        assert.equal(typeof payload.duration, 'number');
        unsubscribe();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    notify('hello world', { type: 'info', duration: 100 });
  });

  // cleanup
  delete globalThis.window;
});
