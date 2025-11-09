import React from 'react';
import config from '../config';
import Modal from './Modal';
import '../styles/ConfirmDialog.css'; // Import global confirmation dialog styles

/**
 * Custom Confirmation Dialog
 * Replaces browser default confirm() with styled modal
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default', // 'default', 'danger', 'warning', 'success'
  icon = null,
  isLoading = false
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onClose();
  };

  const getIconForType = () => {
    if (icon) return icon;

    switch (type) {
      case 'danger':
        return (
          <div className="icon-danger">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="icon-warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
        );
      case 'success':
        return (
          <div className="icon-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22,4 12,14.01 9,11.01"></polyline>
            </svg>
          </div>
        );
      default:
        return (
          <div className="icon-question">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
        );
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger': return 'btn-danger';
      case 'warning': return 'btn-warning';
      case 'success': return 'btn-success';
      default: return 'btn-primary';
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={title}
      size="small"
      closeOnOverlayClick={!isLoading}
      closeOnEscape={!isLoading}
    >
      <div className="confirm-dialog">
        <div className="confirm-content">
          <div className="confirm-icon">
            {getIconForType()}
          </div>
          <div className="confirm-message">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="cancel-btn" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            className={`${getButtonClass()}`} 
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Loading...
              </>
            ) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;