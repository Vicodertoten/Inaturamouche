import React, { useEffect, useRef, useCallback } from 'react';
import './Modal.css';
import { useLanguage } from '../context/LanguageContext.jsx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({ onClose, children }) {
  const { t } = useLanguage();
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Save previous focus and auto-focus modal on mount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    // Focus the modal content container
    contentRef.current?.focus();

    return () => {
      // Restore focus on unmount
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: keep Tab cycling inside the modal
      if (e.key === 'Tab') {
        const modal = contentRef.current;
        if (!modal) return;
        const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)];
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        ref={contentRef}
        tabIndex="-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="close-button"
          title={t('common.close')}
          aria-label={t('common.close')}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
