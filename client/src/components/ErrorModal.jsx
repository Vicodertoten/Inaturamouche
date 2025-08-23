import React from 'react';
import Modal from './Modal';

function ErrorModal({ message, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="error-modal">
        <h2 className="modal-title">Erreur</h2>
        <p>{message}</p>
      </div>
    </Modal>
  );
}

export default ErrorModal;
