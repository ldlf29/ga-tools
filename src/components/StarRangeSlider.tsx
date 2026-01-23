'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './StarRangeSlider.module.css';

interface StarRangeSliderProps {
    min: number;
    max: number;
    onChange: (range: { min: number; max: number }) => void;
    // Current selected range (derived from filters)
    currentRange: { min: number; max: number };
}

export default function StarRangeSlider({ min, max, onChange, currentRange }: StarRangeSliderProps) {
    const [minVal, setMinVal] = useState(currentRange.min);
    const [maxVal, setMaxVal] = useState(currentRange.max);
    const minValRef = useRef(minVal);
    const maxValRef = useRef(maxVal);
    const range = useRef<HTMLDivElement>(null);

    // Convert to percentage
    const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

    // Sync state with props if they change externally (e.g. clear filters)
    useEffect(() => {
        setMinVal(currentRange.min);
        setMaxVal(currentRange.max);
        minValRef.current = currentRange.min;
        maxValRef.current = currentRange.max;
    }, [currentRange.min, currentRange.max]);

    // Update range width/position
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, maxVal, getPercent]);

    // Handlers
    const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.min(Number(event.target.value), maxVal); // Allow = for single value
        setMinVal(value);
        minValRef.current = value;
        onChange({ min: value, max: maxVal });
    };

    const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(Number(event.target.value), minVal); // Allow = for single value
        setMaxVal(value);
        maxValRef.current = value;
        onChange({ min: minVal, max: value });
    };

    return (
        <div className={styles.container}>
            <div className={styles.slider}>
                <div className={styles.track} />
                <div ref={range} className={styles.range} />

                {/* Marks */}
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((val) => {
                    const percent = Math.round(((val - min) / (max - min)) * 100);
                    return (
                        <div
                            key={val}
                            className={`${styles.mark} ${(val >= minVal && val <= maxVal) ? styles.markActive : ''}`}
                            style={{ left: `${percent}%` }}
                        >
                            <span className={styles.markLabel}>{val}</span>
                        </div>
                    );
                })}

                <input
                    type="range"
                    min={min}
                    max={max}
                    value={minVal}
                    onPointerDown={() => onChange({ min: minVal, max: maxVal })}
                    onChange={handleMinChange}
                    className={`${styles.thumb} ${minVal > max - 100 ? styles['thumb--zindex-5'] : ''}`}
                    style={{ zIndex: minVal > max - 1 && minVal > 4 ? 5 : 3 }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={maxVal}
                    onPointerDown={() => onChange({ min: minVal, max: maxVal })}
                    onChange={handleMaxChange}
                    className={`${styles.thumb} ${styles['thumb--zindex-4']}`}
                />
            </div>
        </div>
    );
}
