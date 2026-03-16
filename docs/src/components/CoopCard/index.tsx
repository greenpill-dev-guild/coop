import type { ReactNode } from 'react';
import styles from './styles.module.css';

interface CoopCardProps {
  title?: string;
  variant?: 'default' | 'highlight' | 'warning';
  children: ReactNode;
}

export default function CoopCard({ title, variant = 'default', children }: CoopCardProps) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      {title && <h3 className={styles.cardTitle}>{title}</h3>}
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
}
