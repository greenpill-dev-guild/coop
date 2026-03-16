type SkeletonProps = {
  variant: 'card' | 'pill' | 'text';
  count?: number;
};

export function Skeleton({ variant, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list, no reordering
        <div key={i} className={`skeleton skeleton-${variant}`} aria-hidden="true" />
      ))}
    </>
  );
}
