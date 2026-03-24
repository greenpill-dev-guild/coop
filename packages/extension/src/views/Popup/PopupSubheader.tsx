import { Tooltip } from '../shared/Tooltip';

export interface PopupSubheaderTag {
  id: string;
  label: string;
  /** Secondary value shown after the label (display tags) */
  value?: string;
  /** Visual tone accent */
  tone?: 'ok' | 'warning' | 'error';
  /** Tooltip detail text */
  detail?: string;
  /** Whether this tag is currently selected (filter tags) */
  active?: boolean;
  /** Makes the tag interactive — used for filter tags */
  onClick?: () => void;
}

export function PopupSubheader(props: {
  ariaLabel: string;
  tags: PopupSubheaderTag[];
  /** When true, tags share equal width across the container */
  equalWidth?: boolean;
  /** Preferred tooltip placement for tags with detail text */
  tooltipPlacement?: 'above' | 'below';
}) {
  const { ariaLabel, tags, equalWidth, tooltipPlacement } = props;
  const containerClass = `popup-subheader${equalWidth ? ' popup-subheader--equal' : ''}`;

  return (
    <fieldset aria-label={ariaLabel} className={containerClass}>
      {tags.map((tag) => {
        const toneClass = tag.tone ? ` popup-subheader__tag--${tag.tone}` : '';
        const activeClass = tag.active ? ' is-active' : '';
        const interactiveClass = tag.onClick ? ' popup-subheader__tag--interactive' : '';
        const className = `popup-subheader__tag${toneClass}${activeClass}${interactiveClass}`;

        if (tag.detail) {
          return (
            <Tooltip content={tag.detail} key={tag.id} placement={tooltipPlacement}>
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label={tag.value ? `${tag.label}: ${tag.value}` : tag.label}
                  aria-pressed={tag.active}
                  className={className}
                  onClick={tag.onClick}
                  type="button"
                >
                  <strong>{tag.label}</strong>
                  {tag.value ? <span>{tag.value}</span> : null}
                </button>
              )}
            </Tooltip>
          );
        }

        if (tag.onClick) {
          return (
            <button
              aria-pressed={tag.active}
              className={className}
              key={tag.id}
              onClick={tag.onClick}
              type="button"
            >
              {tag.label}
            </button>
          );
        }

        return (
          <span className={className} key={tag.id}>
            <strong>{tag.label}</strong>
            {tag.value ? <span>{tag.value}</span> : null}
          </span>
        );
      })}
    </fieldset>
  );
}
