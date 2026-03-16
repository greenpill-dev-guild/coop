import type { ReactNode } from 'react';

type ButtonProps = {
  variant: 'primary' | 'secondary';
  size?: 'default' | 'small';
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
};

export function Button({
  variant,
  size = 'default',
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
    <button className={classes} onClick={onClick} type={type}>
      {children}
    </button>
  );
}
