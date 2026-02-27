import React from 'react';
import walletStyles from '@/components/WalletInput.module.css';

interface ModeToggleProps {
    cardMode: 'ALL' | 'USER';
    handleModeChange: (mode: 'ALL' | 'USER') => void;
    userWalletsCount: number;
    onOpenWalletManager: () => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
    cardMode,
    handleModeChange,
    userWalletsCount,
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

            {cardMode === 'USER' && userWalletsCount > 0 ? (
                <div className={walletStyles.connectedGroup}>
                    <button
                        className={walletStyles.connectedButton}
                        onClick={onOpenWalletManager}
                    >
                        MY CARDS ({userWalletsCount})
                    </button>
                </div>
            ) : (
                <button
                    className={`${walletStyles.modeButton} ${cardMode === 'USER' ? walletStyles.modeButtonActive : ''}`}
                    onClick={() => handleModeChange('USER')}
                >
                    MY CARDS
                </button>
            )}
        </div>
    );
};
