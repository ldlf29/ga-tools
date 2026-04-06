/* eslint-disable @next/next/no-img-element */
import React from 'react';
import styles from '@/app/page.module.css';

interface HeaderControlsProps {
  mokiDropdownOpen: boolean;
  setMokiDropdownOpen: (open: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  iconSize?: number;
  hideSupport?: boolean;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  mokiDropdownOpen,
  setMokiDropdownOpen,
  notificationsEnabled,
  setNotificationsEnabled,
  iconSize = 56,
  hideSupport = false,
}) => {
  return (
    <div className={styles.headerControls}>
      {!hideSupport && (
        <a
          href="https://discord.com/users/253329702662569987"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.supportButton} ${styles.supportButtonDesktop}`}
          title="Support"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          <span className={styles.supportText}>SUPPORT</span>
        </a>
      )}

      <button
        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
        className={styles.iconButton}
        title={
          notificationsEnabled
            ? 'Disable Notifications'
            : 'Enable Notifications'
        }
        aria-label="Toggle Notifications"
      >
        {notificationsEnabled ? (
          <svg
            width={iconSize === 56 ? '20' : '24'}
            height={iconSize === 56 ? '20' : '24'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        ) : (
          <svg
            width={iconSize === 56 ? '20' : '24'}
            height={iconSize === 56 ? '20' : '24'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
            <path d="M18 8a6 6 0 0 0-9.33-5"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        )}
      </button>
    </div>
  );
};
