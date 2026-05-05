import type React from 'react';

type ReceiverAppBarIconProps = {
  active: boolean;
};

function ReceiverPairIcon({ active }: ReceiverAppBarIconProps) {
  const stroke = active ? 'var(--coop-orange)' : 'currentColor';
  const width = active ? '2' : '1.8';
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.2 9.2 6.4 11a3.4 3.4 0 0 0 4.8 4.8l1.8-1.8"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={width}
      />
      <path
        d="m15.8 14.8 1.8-1.8A3.4 3.4 0 1 0 12.8 8.2L11 10"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={width}
      />
      <path
        d="m9.8 14.2 4.4-4.4"
        stroke={active ? 'var(--coop-brown)' : 'currentColor'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={width}
      />
    </svg>
  );
}

function ReceiverCaptureIcon({ active }: ReceiverAppBarIconProps) {
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4.8c-2.9 0-5.3 2.4-5.3 5.4 0 4 3.8 7.1 5.3 8.2 1.5-1.1 5.3-4.2 5.3-8.2 0-3-2.4-5.4-5.3-5.4Z"
        fill={active ? 'rgba(253, 138, 1, 0.24)' : 'rgba(79, 46, 31, 0.06)'}
        stroke={active ? 'var(--coop-orange)' : 'currentColor'}
        strokeLinejoin="round"
        strokeWidth={active ? '1.8' : '1.6'}
      />
      <circle cx="12" cy="10.8" fill={active ? 'var(--coop-orange)' : 'currentColor'} r="1.5" />
    </svg>
  );
}

function ReceiverInboxIcon({ active }: ReceiverAppBarIconProps) {
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.8 10.2h14.4l1.2 6.7a1.8 1.8 0 0 1-1.8 2.1H5.4a1.8 1.8 0 0 1-1.8-2.1l1.2-6.7Z"
        fill={active ? 'rgba(90, 125, 16, 0.22)' : 'rgba(79, 46, 31, 0.05)'}
        stroke={active ? 'var(--coop-green)' : 'currentColor'}
        strokeLinejoin="round"
        strokeWidth={active ? '1.8' : '1.6'}
      />
      <path
        d="M7 10.2c.8-2 2.4-3.2 5-3.2s4.2 1.2 5 3.2"
        stroke={active ? 'var(--coop-green)' : 'currentColor'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? '1.8' : '1.6'}
      />
      <path
        d="M9.2 13.2h5.6"
        stroke={active ? 'var(--coop-green)' : 'currentColor'}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export type ReceiverNavKind = 'pair' | 'receiver' | 'inbox';

export const receiverNavItems: Array<{
  kind: ReceiverNavKind;
  href: '/pair' | '/receiver' | '/inbox';
  label: string;
  Icon: ({ active }: ReceiverAppBarIconProps) => React.ReactElement;
}> = [
  {
    kind: 'pair',
    href: '/pair',
    label: 'Mate',
    Icon: ReceiverPairIcon,
  },
  {
    kind: 'receiver',
    href: '/receiver',
    label: 'Hatch',
    Icon: ReceiverCaptureIcon,
  },
  {
    kind: 'inbox',
    href: '/inbox',
    label: 'Roost',
    Icon: ReceiverInboxIcon,
  },
];
