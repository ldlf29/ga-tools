import React, { useState, useMemo, useEffect } from 'react';
import styles from './ChangelogModal.module.css';

interface ClassChange {
    id: string;
    moki_name: string;
    old_class: string;
    new_class: string;
    changed_at: string;
    image_url?: string;
}

interface ChangelogModalProps {
    onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [changes, setChanges] = useState<ClassChange[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch real changelog data from API
    useEffect(() => {
        const fetchChangelog = async () => {
            try {
                const response = await fetch('/api/changelog');
                if (!response.ok) throw new Error('Failed to fetch changelog');
                const data = await response.json();
                setChanges(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error loading changelog';
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChangelog();
    }, []);

    // Prevent scroll when modal is open and handle ESC
    useEffect(() => {
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const filteredChanges = useMemo(() => {
        if (!searchQuery.trim()) return changes;

        const lowerQuery = searchQuery.toLowerCase();
        return changes.filter(item =>
            item.moki_name.toLowerCase().includes(lowerQuery)
        );
    }, [searchQuery, changes]);

    // Format date from ISO to DD/MM/YYYY
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleArea}>

                        <div className={styles.title}>Changelog</div>
                    </div>

                    <div className={styles.headerRight}>
                        <div className={styles.searchWrapper}>
                            <input
                                type="text"
                                placeholder="Search by Moki..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className={styles.closeButton} onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className={styles.listContainer}>
                    {isLoading ? (
                        <div className={styles.noResults}>Loading changelog...</div>
                    ) : error ? (
                        <div className={styles.noResults}>Error: {error}</div>
                    ) : filteredChanges.length > 0 ? (
                        filteredChanges.map((change) => (
                            <div key={change.id} className={styles.changeLine}>
                                <span className={styles.date}>{formatDate(change.changed_at)}</span>
                                {" - "}
                                <span className={styles.mokiName}>{change.moki_name}</span>
                                {" changed his class from "}
                                <span className={styles.classHighlight}>{change.old_class}</span>
                                {" to "}
                                <span className={styles.classHighlight}>{change.new_class}</span>
                            </div>
                        ))
                    ) : (
                        <div className={styles.noResults}>
                            {searchQuery ? `No changes found matching "${searchQuery}"` : "No class changes recorded yet."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangelogModal;
