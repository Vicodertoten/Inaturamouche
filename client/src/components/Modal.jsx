import React, { useEffect } from 'react';
import './Modal.css';

function Modal({ onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button" title="Fermer" aria-label="Fermer">×</button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
