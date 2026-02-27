'use client';

import { useState } from 'react';
import styles from './WalletInput.module.css';

interface WalletInputProps {
    onSubmit: (address: string) => void;
    onCancel: () => void;
    isLoading: boolean;
}

export default function WalletInput({ onSubmit, onCancel, isLoading }: WalletInputProps) {
    const [address, setAddress] = useState('');
    const [error, setError] = useState('');

    const validateAddress = (addr: string): boolean => {
        if (!addr.startsWith('0x')) {
            setError('Address must start with 0x');
            return false;
        }
        if (addr.length !== 42) {
            setError('Address must be 42 characters');
            return false;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
            setError('Invalid address format');
            return false;
        }
        setError('');
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = address.trim();
        if (validateAddress(trimmed)) {
            onSubmit(trimmed);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    if (isLoading) {
        return (
            <div className={styles.walletInputOverlay}>
                <div className={styles.walletInputModal}>
                    <h2 className={styles.walletTitle}>Loading Your Cards</h2>
                    <div className={styles.loadingState}>
                        <div className={styles.loadingSpinner} />
                        <p className={styles.loadingText}>Fetching cards from wallet...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.walletInputOverlay} onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
        }}>
            <div className={styles.walletInputModal} onKeyDown={handleKeyDown}>
                <div className={styles.header}>
                    <h2 className={styles.walletTitle}>MY CARDS</h2>
                    <button className={styles.closeBtn} onClick={onCancel} aria-label="Close modal">&times;</button>
                </div>
                <p className={styles.walletSubtitle}>Paste your Ronin wallet address to load your cards. A connected wallet can only be removed after 24 hours.</p>

                <form className={styles.walletForm} onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className={`${styles.walletInput} ${error ? styles.walletInputError : ''}`}
                        placeholder="0x..."
                        value={address}
                        onChange={(e) => {
                            setAddress(e.target.value);
                            if (error) setError('');
                        }}
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                    />
                    {error && <p className={styles.errorText}>{error}</p>}

                    <div className={styles.walletActions}>
                        <button type="button" className={styles.cancelButton} onClick={onCancel}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.loadButton}
                            disabled={!address.trim()}
                        >
                            Load Cards
                        </button>
                    </div>
                </form>

                <div style={{ marginTop: '1.5rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', textAlign: 'center', lineHeight: '1.4' }}>
                    <p>+10k cards: 3m - 5m</p>
                    <p>5k-10k cards: 1m - 2m</p>
                    <p>0-5k cards: 15s - 1m</p>
                </div>
            </div>
        </div>
    );
}
