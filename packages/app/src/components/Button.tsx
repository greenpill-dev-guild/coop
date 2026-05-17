import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> & {
  variant: 'primary' | 'secondary';
  size?: 'default' | 'small';
  children: ReactNode;
  type?: 'button' | 'submit';
  className?: string;
};

export function Button({
  variant,
  size = 'default',
  children,
  type = 'button',
  className,
  ...buttonProps
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
    <button className={classes} type={type} {...buttonProps}>
      {children}
    </button>
  );
}
