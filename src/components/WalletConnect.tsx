'use client';

import { useState } from 'react';
import { connectRoninWallet } from '@/utils/ronin';
import styles from './WalletConnect.module.css';

export default function WalletConnect() {
    const [address, setAddress] = useState<string | null>(null);

    const handleConnect = async () => {
        const addr = await connectRoninWallet();
        if (addr) {
            setAddress(addr);
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className={styles.container}>
            {address ? (
                <div className={styles.address}>
                    {formatAddress(address)}
                </div>
            ) : (
                <button
                    onClick={handleConnect}
                    className={styles.button}
                >
                    Connect Wallet
                </button>
            )}
        </div>
    );
}
