import type { ReactNode } from 'react';

type CardProps = {
  variant?: 'nest' | 'receiver' | 'empty';
  className?: string;
  children: ReactNode;
};

export function Card({ variant = 'nest', className, children }: CardProps) {
  const base = variant === 'empty' ? 'empty-nest' : 'nest-card';
  const receiver = variant === 'receiver' || variant === 'nest' ? 'receiver-card' : '';
  const classes = [base, receiver, className ?? ''].filter(Boolean).join(' ');

  return <article className={classes}>{children}</article>;
}
