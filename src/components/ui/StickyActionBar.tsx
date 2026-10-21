import type { ReactNode } from 'react';

/** Stays in the scroll container, without covering the final table rows. */
export function StickyActionBar({ children, message }: { children: ReactNode; message?: ReactNode }) {
  return <footer className="sticky bottom-0 z-20 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-planning-line bg-surface px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
    <div className="text-13 text-planning-muted">{message}</div>
    <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div>
  </footer>;
}
