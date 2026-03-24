import type { PopupChoiceOption } from './popup-types';

export function PopupChoiceGroup<T extends string | number>(props: {
  ariaLabel: string;
  options: Array<PopupChoiceOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { ariaLabel, options, value, onChange } = props;

  return (
    <fieldset aria-label={ariaLabel} className="popup-choice-group">
      {options.map((option) => {
        const active = option.id === value;

        return (
          <button
            aria-pressed={active}
            className={`popup-choice-group__button${active ? ' is-active' : ''}`}
            key={String(option.id)}
            onClick={() => onChange(option.id)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
