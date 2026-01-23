'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

export interface ToastMessage {
    id: number;
    text: string;
    type: 'error' | 'success' | 'warning';
}

interface ToastProps {
    messages: ToastMessage[];
    onClose: (id: number) => void;
}

export default function Toast({ messages, onClose }: ToastProps) {
    return (
        <div className={styles.toastContainer}>
            {messages.map((msg) => (
                <ToastItem key={msg.id} message={msg} onClose={onClose} />
            ))}
        </div>
    );
}

function ToastItem({ message, onClose }: { message: ToastMessage, onClose: (id: number) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(message.id);
        }, 2000);
        return () => clearTimeout(timer);
    }, [message.id, onClose]);

    return (
        <div className={`${styles.toast} ${styles[message.type]}`}>
            {message.type === 'error' && '❌'}
            {message.type === 'success' && '✅'}
            {message.type === 'warning' && '⚠️'}
            <span>{message.text}</span>
        </div>
    );
}
