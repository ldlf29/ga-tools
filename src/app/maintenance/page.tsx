import type { Metadata } from 'next';
import styles from './maintenance.module.css';

export const metadata: Metadata = {
  title: 'Under Maintenance | Grand Arena Tools',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Under Maintenance</h1>
        <p className={styles.text}>
          Grand Arena Tools is temporarily down for maintenance.<br />
          We&apos;ll be back shortly.
        </p>
      </div>
    </div>
  );
}
