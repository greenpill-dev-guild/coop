import type { ReactNode } from 'react';

type ButtonProps = {
  variant: 'primary' | 'secondary';
  size?: 'default' | 'small';
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
};

export function Button({
  variant,
  size = 'default',
  disabled,
  children,
  onClick,
  type = 'button',
  className,
}: ButtonProps) {
  const classes = [
    'button',
    `button-${variant}`,
    size === 'small' ? 'button-small' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} onClick={onClick} type={type} disabled={disabled}>
      {children}
    </button>
  );
}
