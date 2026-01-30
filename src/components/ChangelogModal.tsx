import React, { useState, useMemo, useEffect } from 'react';
import styles from './ChangelogModal.module.css';
import { mockChangelogData } from '../data/changelogData';

interface ChangelogModalProps {
    onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Keyboard listener for ESC key only (as requested)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const filteredChanges = useMemo(() => {
        if (!searchQuery.trim()) return mockChangelogData;

        const lowerQuery = searchQuery.toLowerCase();
        return mockChangelogData.filter(item =>
            item.mokiName.toLowerCase().includes(lowerQuery)
        );
    }, [searchQuery]);

    // Format date from YYYY-MM-DD to DD/MM/YYYY
    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FFD753' }}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <div className={styles.title}>Changelog</div>
                    </div>

                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            placeholder="Search by Moki..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className={styles.listContainer}>
                    {filteredChanges.length > 0 ? (
                        filteredChanges.map((change) => (
                            <div key={change.id} className={styles.changeLine}>
                                <span className={styles.date}>{formatDate(change.date)}</span>
                                {" - "}
                                <span className={styles.mokiName}>{change.mokiName}</span>
                                {" changed his class from "}
                                <span className={styles.classHighlight}>{change.oldClass}</span>
                                {" to "}
                                <span className={styles.classHighlight}>{change.newClass}</span>
                            </div>
                        ))
                    ) : (
                        <div className={styles.noResults}>
                            No changes found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangelogModal;
