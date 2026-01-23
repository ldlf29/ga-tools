
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './RatingSlider.module.css';

interface RatingSliderProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    size?: 'normal' | 'small';
}

const RatingSlider: React.FC<RatingSliderProps> = ({ value, onChange, disabled, size = 'normal' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = useState(value);
    const valueRef = useRef(value);

    // Sync ref when localValue changes
    useEffect(() => {
        valueRef.current = localValue;
    }, [localValue]);

    useEffect(() => {
        if (!isDragging) {
            setLocalValue(value);
        }
    }, [value, isDragging]);

    const calculateValue = useCallback((clientX: number) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        // Map 0-1 to 0-5
        const rawValue = percentage * 5;
        return Math.round(rawValue);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        // Prevent default drag behavior of image
        e.preventDefault();

        // Calculate initial click position value
        const newValue = calculateValue(e.clientX);
        setLocalValue(newValue);
        // Don't call onChange here, wait for release
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        setIsDragging(true);
        const newValue = calculateValue(e.touches[0].clientX);
        setLocalValue(newValue);
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const newValue = calculateValue(e.clientX);
            setLocalValue(newValue);
            // No onChange here
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            const newValue = calculateValue(e.touches[0].clientX);
            setLocalValue(newValue);
        }

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                onChange(valueRef.current); // Final commit using latest value from ref
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, calculateValue, localValue, onChange]);

    // Calculate position percentage for the knob 
    // Value 0 => 0%, Value 5 => 100%
    const percentage = (localValue / 5) * 100;

    return (
        <div
            className={`${styles.container} ${disabled ? styles.disabled : ''} ${size === 'small' ? styles.small : ''}`}
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {/* Background Line */}
            <div className={styles.trackBackground} />

            {/* Filled Line */}
            <div
                className={styles.trackFill}
                style={{ width: `${percentage}%` }}
            />

            {/* Marks */}
            {[0, 1, 2, 3, 4, 5].map((val) => (
                <div
                    key={val}
                    className={`${styles.mark} ${val <= localValue ? styles.markActive : ''}`}
                    style={{ left: `${(val / 5) * 100}%` }}
                />
            ))}

            {/* Knob (Character) */}
            <div
                className={styles.knob}
                style={{ left: `${percentage}%` }}
            >
                {/* Image centered on knob */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/rating-character.png" alt="Rating Knob" className={styles.character} />

                {/* Floating Value Bubble (optional, but nice) */}
                {/* <div className={styles.valueBubble}>{localValue}</div> */}
            </div>
        </div>
    );
};

export default RatingSlider;
