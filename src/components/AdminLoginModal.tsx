'use client';

import React, { useState } from 'react';
import styles from './PredictionsTab.module.css';
import { verifyAdminAction } from '../app/actions/auth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * A modal for entering admin credentials.
 * Used to unlock restricted sections like Predictions.
 */
export default function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Call the server action to verify credentials
      const result = await verifyAdminAction(username, password);
      
      if (result.success) {
        onSuccess();
        onClose();
        // Reset fields
        setUsername('');
        setPassword('');
      } else {
        setError(result.error || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('A connection error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.autoLineupsModalOverlay} onClick={onClose}>
      <div 
        className={styles.autoLineupsModalContent} 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '420px', height: 'auto', minHeight: 'fit-content' }}
      >
        <div className={styles.autoLineupsModalHeader}>
          <h2 className={styles.autoLineupsModalTitle}>Admin Access</h2>
          <p className={styles.autoLineupsModalSubtitle}>Enter credentials to unlock restricted tools</p>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className={styles.loginInput}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.loginInput}
                required
              />
            </div>

            {error && <p className={styles.loginError}>{error}</p>}

            <div className={styles.autoLineupsModalActions} style={{ margin: '1rem -2rem -1.5rem -2rem', padding: '1.25rem 2rem' }}>
              <button
                type="button"
                className={styles.autoLineupsModalCloseBtn}
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.autoLineupsSaveAllBtn}
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Unlock Tools'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
