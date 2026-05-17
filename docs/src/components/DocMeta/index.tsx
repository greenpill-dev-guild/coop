import { useDoc } from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FIELD_LABELS = {
  audience: 'Audience',
  doc_type: 'Type',
  status: 'Status',
  validation_snapshot: 'Validation',
  docs_reviewed: 'Reviewed',
  last_verified: 'Verified',
} as const;

const VALUE_LABELS: Record<string, string> = {
  active: 'Active',
  builder: 'Builder',
  canonical: 'Canonical',
  community: 'Community',
  current: 'Current',
  design: 'Design',
  guide: 'Guide',
  historical: 'Historical',
  'prompt-pack': 'Prompt Pack',
  provisional: 'Provisional',
  reference: 'Reference',
  research: 'Research',
  runbook: 'Runbook',
  snapshot: 'Snapshot',
};

type MetaField = keyof typeof FIELD_LABELS;
type FrontMatter = Record<string, unknown>;

function getString(frontMatter: FrontMatter, field: MetaField): string | undefined {
  const value = frontMatter[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const monthLabel = MONTHS[monthIndex];
  if (!monthLabel) {
    return value;
  }

  return `${monthLabel} ${Number(day)}, ${year}`;
}

function formatValue(field: MetaField, value: string): string {
  if (field === 'validation_snapshot' || field === 'docs_reviewed' || field === 'last_verified') {
    return formatDate(value);
  }

  return VALUE_LABELS[value] ?? value;
}

export default function DocMeta() {
  const { frontMatter } = useDoc();
  const fields: MetaField[] = [
    'audience',
    'doc_type',
    'status',
    'validation_snapshot',
    'docs_reviewed',
    'last_verified',
  ];
  const entries = fields
    .map((field) => {
      const value = getString(frontMatter as FrontMatter, field);
      return value ? { field, value } : null;
    })
    .filter((entry): entry is { field: MetaField; value: string } => Boolean(entry));

  if (entries.length === 0) {
    return null;
  }

  return (
    <aside className={styles.meta} aria-label="Document metadata">
      {entries.map(({ field, value }) => (
        <span className={styles.badge} data-meta-field={field} data-meta-value={value} key={field}>
          <span className={styles.label}>{FIELD_LABELS[field]}</span>
          <span className={styles.value}>{formatValue(field, value)}</span>
        </span>
      ))}
    </aside>
  );
}
