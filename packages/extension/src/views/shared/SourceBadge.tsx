export type SourceType = 'youtube' | 'github' | 'rss' | 'reddit' | 'npm' | 'wikipedia' | 'web';

const SOURCE_ICONS: Record<SourceType, string> = {
  youtube: '\u25B6',
  github: '\u2325',
  rss: '\u25C9',
  reddit: '\u2B21',
  npm: '\u2B22',
  wikipedia: 'W',
  web: '\u25CE',
};

interface SourceBadgeProps {
  type: SourceType;
  name: string;
}

export function SourceBadge({ type, name }: SourceBadgeProps) {
  return (
    <span className="badge">
      <span className={`source-icon source-icon--${type}`}>{SOURCE_ICONS[type]}</span>
      {name}
    </span>
  );
}
