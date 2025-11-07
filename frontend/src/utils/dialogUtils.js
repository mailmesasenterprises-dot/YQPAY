/**
 * Browser Dialog Replacement Utilities
 * Replaces default browser alert(), confirm(), and prompt() with custom modals
 */

import { createRoot } from 'react-dom/client';
import React from 'react';
import { ModalProvider, useModal } from '../contexts/ModalContext';
import config from '../config';

// Create a temporary component to access modal functions outside React components
let modalFunctions = null;

// Initialize modal functions
const initializeModalFunctions = () => {
  if (modalFunctions) return modalFunctions;

  const ModalUtilityComponent = () => {
    const modal = useModal();
    modalFunctions = modal;
    return null;
  };

  // Create a temporary root to get modal functions
  const tempDiv = document.createElement('div');
  document.body.appendChild(tempDiv);
  const root = createRoot(tempDiv);
  
  root.render(
    <ModalProvider>
      <ModalUtilityComponent />
    </ModalProvider>
  );

  // Clean up
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(tempDiv);
  }, 100);

  return modalFunctions;
};

/**
 * Custom replacement for window.alert()
 * Usage: customAlert('Message', 'Title', 'type')
 */
export const customAlert = async (message, title = 'Alert', type = 'info') => {
  const modal = modalFunctions || initializeModalFunctions();
  
  return await modal.alert({
    title,
    message,
    type,
    buttonText: 'OK'
  });
};

/**
 * Custom replacement for window.confirm()
 * Usage: const result = await customConfirm('Are you sure?', 'Confirm', 'type')
 */
export const customConfirm = async (message, title = 'Confirm', type = 'default') => {
  const modal = modalFunctions || initializeModalFunctions();
  
  return await modal.confirm({
    title,
    message,
    type,
    confirmText: 'OK',
    cancelText: 'Cancel'
  });
};

/**
 * Custom replacement for window.prompt()
 * Usage: const value = await customPrompt('Enter value:', 'Input', 'defaultValue')
 */
export const customPrompt = async (message, title = 'Input Required', defaultValue = '') => {
  const modal = modalFunctions || initializeModalFunctions();
  
  return await modal.prompt({
    title,
    message,
    defaultValue,
    placeholder: 'Enter value...',
    inputType: 'text',
    confirmText: 'OK',
    cancelText: 'Cancel'
  });
};

/**
 * Override browser default dialogs globally
 * Call this once in your app initialization
 */
export const overrideBrowserDialogs = () => {
  // Store original functions in case you need them
  window.originalAlert = window.alert;
  window.originalConfirm = window.confirm;
  window.originalPrompt = window.prompt;

  // Override with custom implementations
  window.alert = (message) => {
    customAlert(message);
  };

  window.confirm = (message) => {
    return customConfirm(message);
  };

  window.prompt = (message, defaultValue) => {
    return customPrompt(message, 'Input Required', defaultValue);
  };
  };

/**
 * Restore original browser dialogs
 */
export const restoreBrowserDialogs = () => {
  if (window.originalAlert) {
    window.alert = window.originalAlert;
    window.confirm = window.originalConfirm;
    window.prompt = window.originalPrompt;
    
    delete window.originalAlert;
    delete window.originalConfirm;
    delete window.originalPrompt;
    
  }
};

/**
 * Convenience functions for common dialog types
 */

// Success notification
export const showSuccess = (message, title = 'Success') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.showSuccess(message, title);
};

// Error notification
export const showError = (message, title = 'Error') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.showError(message, title);
};

// Warning notification
export const showWarning = (message, title = 'Warning') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.showWarning(message, title);
};

// Info notification
export const showInfo = (message, title = 'Information') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.showInfo(message, title);
};

// Delete confirmation
export const confirmDelete = (itemName = 'this item') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.confirmDelete(itemName);
};

// Generic action confirmation
export const confirmAction = (action = 'this action') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.confirmAction(action);
};

// Text input prompt
export const promptText = (message, defaultValue = '', placeholder = 'Enter text...') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.promptText(message, defaultValue, placeholder);
};

// Email input prompt
export const promptEmail = (message = 'Please enter your email address:') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.promptEmail(message);
};

// Phone input prompt
export const promptPhone = (message = 'Please enter your phone number:') => {
  const modal = modalFunctions || initializeModalFunctions();
  return modal.promptPhone(message);
};

/**
 * Example usage in components:
 * 
 * import { useModal } from '../contexts/ModalContext';
 * 
 * const MyComponent = () => {
 *   const { confirm, alert, prompt, showSuccess } = useModal();
 * 
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: 'Delete Item',
 *       message: 'Are you sure you want to delete this item?',
 *       type: 'danger',
 *       confirmText: 'Delete',
 *       cancelText: 'Cancel'
 *     });
 * 
 *     if (confirmed) {
 *       // Perform delete operation
 *       showSuccess('Item deleted successfully!');
 *     }
 *   };
 * 
 *   const handleInput = async () => {
 *     const name = await prompt({
 *       title: 'Enter Name',
 *       message: 'What is your name?',
 *       placeholder: 'Enter your name...',
 *       required: true,
 *       validation: (value) => {
 *         if (value.length < 2) return 'Name must be at least 2 characters';
 *         return '';
 *       }
 *     });
 * 
 *     if (name) {
 *       alert({
 *         title: 'Hello!',
 *         message: `Nice to meet you, ${name}!`,
 *         type: 'success'
 *       });
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleDelete}>Delete Item</button>
 *       <button onClick={handleInput}>Get Name</button>
 *     </div>
 *   );
 * };
 */

export default {
  customAlert,
  customConfirm,
  customPrompt,
  overrideBrowserDialogs,
  restoreBrowserDialogs,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  confirmDelete,
  confirmAction,
  promptText,
  promptEmail,
  promptPhone
};