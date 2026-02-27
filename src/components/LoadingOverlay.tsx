import React from 'react';
import styles from '@/app/page.module.css';

interface LoadingOverlayProps {
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Loading cards...' }) => {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}
        >
            <img
                src="/Gn Moki.png"
                alt="Loading"
                width={100}
                height={100}
                style={{ marginBottom: '1.5rem', objectFit: 'contain' }}
            />
            <div
                className={styles.spinner}
                style={{
                    width: '50px',
                    height: '50px',
                    border: '5px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}
            ></div>
            <p
                style={{
                    color: '#FFD753',
                    marginTop: '1rem',
                    fontFamily: 'Inter',
                    fontWeight: '800',
                    fontSize: '1.2rem',
                    textTransform: 'uppercase'
                }}
            >
                {message}
            </p>
        </div>
    );
};
