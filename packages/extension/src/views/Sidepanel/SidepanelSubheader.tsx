import type { ReactNode } from 'react';

/**
 * Sticky subheader wrapper for sidepanel tabs.
 *
 * Every tab places its filters, action buttons, and sub-navigation
 * inside this component so they remain pinned at the top of the
 * scroll area while content scrolls beneath.
 */
export function SidepanelSubheader({ children }: { children: ReactNode }) {
  return <div className="sidepanel-subheader">{children}</div>;
}
