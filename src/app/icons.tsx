/** Line icons for the menu and the home page cards, one per page (24×24, drawn with strokes). */
const PATHS: Record<string, string> = {
  '/': 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  '/sources':
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  '/runs': 'M4 12a8 8 0 1016 0 8 8 0 00-16 0zM10 8.5l5 3.5-5 3.5z',
  '/approvals': 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  '/reports': 'M6 3h9l4 4v14H6zM14 3v5h5M9 17v-3M12 17v-6M15 17v-4',
  '/quarantine': 'M12 3l10 18H2zM12 10v5M12 18h.01',
  '/matches':
    'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6',
  '/persons': 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  '/audit': 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 11h6M9 15h6M9 19h3',
  '/status': 'M3 12h4l3-7 4 14 3-7h4',
};

export function PageIcon({ to, className }: { to: string; className?: string }) {
  const d = PATHS[to];
  if (!d) return null;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
