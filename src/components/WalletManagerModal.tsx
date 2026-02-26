'use client';

import React from 'react';
import styles from './WalletManagerModal.module.css';
import { ConnectedWallet } from '@/types';

interface WalletManagerModalProps {
    wallets: ConnectedWallet[];
    onClose: () => void;
    onAddWallet: () => void;
    onRemoveWallet: (address: string) => void;
    onRefreshWallet: (address: string) => void;
    onToast: (msg: string, type: 'error' | 'success' | 'warning' | 'suggestion') => void;
}

export default function WalletManagerModal({
    wallets,
    onClose,
    onAddWallet,
    onRemoveWallet,
    onRefreshWallet,
    onToast
}: WalletManagerModalProps) {
    const now = Date.now();

    const formatTimeLeft = (ms: number) => {
        if (ms <= 0) return 'Ready';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Manage Connected Wallets</h2>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <p className={styles.disclaimer}>
                    You can connect up to 2 wallets per device. A connected wallet can only be removed after 24 hours. Refreshing your wallet updates it entirely if there have been changes and it has a 6h cooldown per wallet.
                </p>

                <div className={styles.walletList}>
                    {wallets.map(wallet => {
                        const timeSinceAdd = now - wallet.addedAt;
                        const canRemove = timeSinceAdd >= 24 * 60 * 60 * 1000;
                        const removeWaitTime = Math.max(0, (24 * 60 * 60 * 1000) - timeSinceAdd);

                        const lastRefresh = wallet.lastRefresh;
                        const timeSinceRefresh = now - lastRefresh;
                        const canRefresh = timeSinceRefresh >= 6 * 60 * 60 * 1000;
                        const refreshWaitTime = Math.max(0, (6 * 60 * 60 * 1000) - timeSinceRefresh);

                        return (
                            <div key={wallet.address} className={styles.walletCard}>
                                <div className={styles.walletInfo}>
                                    <span className={styles.address}>
                                        {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
                                    </span>
                                </div>
                                <div className={styles.walletActions}>
                                    <button
                                        onClick={() => {
                                            if (!canRefresh) onToast(`Cooldown: ${formatTimeLeft(refreshWaitTime)} left`, 'warning');
                                            else onRefreshWallet(wallet.address);
                                        }}
                                        className={`${styles.actionBtn} ${styles.refreshBtn} ${!canRefresh ? styles.disabled : ''}`}
                                        title={canRefresh ? "Force Refresh NFTs" : `Cooldown: ${formatTimeLeft(refreshWaitTime)} left`}
                                    >
                                        <span className={styles.btnText}>Refresh</span>
                                        <svg className={styles.btnIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 4v6h-6"></path>
                                            <path d="M1 20v-6h6"></path>
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!canRemove) onToast(`Locked: ${formatTimeLeft(removeWaitTime)} left`, 'warning');
                                            else onRemoveWallet(wallet.address);
                                        }}
                                        className={`${styles.actionBtn} ${styles.removeBtn} ${!canRemove ? styles.disabled : ''}`}
                                        title={canRemove ? "Disconnect Wallet" : `Locked: ${formatTimeLeft(removeWaitTime)} left`}
                                    >
                                        <span className={styles.btnText}>Remove</span>
                                        <svg className={styles.btnIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {wallets.length < 2 && (
                    <button className={styles.addWalletBtn} onClick={onAddWallet}>
                        + Add Another Wallet
                    </button>
                )}
            </div>
        </div>
    );
}
