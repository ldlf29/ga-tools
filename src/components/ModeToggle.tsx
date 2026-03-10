import React from 'react';
import walletStyles from '@/components/WalletInput.module.css';

interface ModeToggleProps {
    cardMode: 'ALL' | 'USER';
    handleModeChange: (mode: 'ALL' | 'USER') => void;
    onOpenWalletManager: () => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
    cardMode,
    handleModeChange,
    onOpenWalletManager
}) => {
    return (
        <div className={walletStyles.modeToggle}>
            <button
                className={`${walletStyles.modeButton} ${cardMode === 'ALL' ? walletStyles.modeButtonActive : ''}`}
                onClick={() => handleModeChange('ALL')}
            >
                ALL CARDS
            </button>

            <button
                className={`${walletStyles.modeButton} ${cardMode === 'USER' ? walletStyles.modeButtonActive : ''}`}
                onClick={() => {
                    if (cardMode === 'USER') {
                        onOpenWalletManager();
                    } else {
                        handleModeChange('USER');
                    }
                }}
            >
                MY CARDS
            </button>
        </div>
    );
};
