import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import {
  DEFAULT_AUDIENCE_PATHS,
  type DocsAudience,
  getDocsAudience,
  getRememberedAudiencePath,
  rememberAudiencePath,
} from '@site/src/lib/docsAudience';
import { useEffect, useState } from 'react';
import styles from './styles.module.css';

const AUDIENCES: DocsAudience[] = ['community', 'builder'];

const LABELS: Record<DocsAudience, string> = {
  community: 'Community',
  builder: 'Builder',
};

export default function AudienceTabs() {
  const location = useLocation();
  const [targets, setTargets] = useState(DEFAULT_AUDIENCE_PATHS);
  const activeAudience = getDocsAudience(location.pathname);

  useEffect(() => {
    rememberAudiencePath(location.pathname, location.search, location.hash);
    setTargets({
      community: getRememberedAudiencePath('community'),
      builder: getRememberedAudiencePath('builder'),
    });
  }, [location.hash, location.pathname, location.search]);

  return (
    <nav className={styles.tabs} aria-label="Documentation audience">
      {AUDIENCES.map((audience) => (
        <Link
          key={audience}
          className={`${styles.tab}${audience === activeAudience ? ` ${styles.tabActive}` : ''}`}
          to={targets[audience]}
        >
          {LABELS[audience]}
        </Link>
      ))}
    </nav>
  );
}
