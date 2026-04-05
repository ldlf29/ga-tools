/* eslint-disable @next/next/no-img-element */
import React from 'react';
import styles from '@/app/page.module.css';

interface HeaderControlsProps {
  mokiDropdownOpen: boolean;
  setMokiDropdownOpen: (open: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  iconSize?: number;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  mokiDropdownOpen,
  setMokiDropdownOpen,
  notificationsEnabled,
  setNotificationsEnabled,
  iconSize = 56,
}) => {
  return (
    <div className={styles.headerControls}>


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
