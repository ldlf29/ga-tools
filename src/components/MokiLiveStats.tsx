'use client';

import { useEffect, useState } from 'react';
import { fetchLiveData, MokiData } from '@/utils/liveData';
import styles from './CardModal.module.css'; // Reusing matching styles

interface MokiMetadata {
    id: string;
    name: string;
    portraitUrl: string;
    fur: string;
    traits: string[];
    marketLink: string;
}

export default function MokiLiveStats({ moki }: { moki: MokiMetadata }) {
    const [mokiData, setMokiData] = useState<MokiData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchLiveData();
                if (data) {
                    const found = Object.values(data).find(m => m.name.toLowerCase() === moki.name.toLowerCase());
                    if (found) {
                        setMokiData(found);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch live stats", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [moki.name]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            {/* Leaderboard Chart Placeholder */}
            <div style={{
                background: '#ffffff',
                border: '3px solid #333333',
                borderBottomWidth: '6px',
                borderRadius: '1rem',
                padding: '1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginTop: '1rem'
            }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: '#333', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                    Leaderboard Position (Day by Day)
                </h3>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', fontWeight: 600 }}>
                    Chart Placeholder - Coming soon!
                </p>
                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
            </div>

            {/* Build Lineups Actions */}
            <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                backgroundColor: '#ffffff', 
                border: '3px solid #333333', 
                borderBottomWidth: '6px',
                borderRadius: '1rem', 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                alignItems: 'center'
            }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', color: '#FFD753', fontSize: '1.5rem', textTransform: 'uppercase', textShadow: '2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 1px 1px #000, -1px -1px #000, 1px -1px #000, -1px 1px #000' }}>
                    Build Lineups with {moki.name}
                </h2>
                <p style={{ color: '#555', margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
                    Simulate the best team compositions and increase your win rate by combining {moki.name} with synergistic classes and Scheme cards.
                </p>
                <button 
                    onClick={() => window.location.href = `/?mokiSearch=${encodeURIComponent(moki.name)}`}
                    className={styles.builderActionBtn}
                >
                    OPEN IN THE BUILDER
                </button>
            </div>
        </div>
    );
}
