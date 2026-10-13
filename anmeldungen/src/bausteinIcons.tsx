/**
 * Symbole der Baukasten-Kacheln (A5) – nur hier gebraucht, deshalb nicht im gemeinsamen Satz `@ui/icons`.
 * Strichstärke und Größe wie dort.
 */
const PFADE = {
  geburt: 'M4 20h16M6 20v-6h12v6M9 14v-3m6 3v-3m-3 3v-4',
  telefon:
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  anschrift:
    'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  notfall: 'M12 3 2 20h20L12 3ZM12 10v4m0 3v.01',
  essen: 'M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m10-18c-2 0-3 3-3 6s1 4 3 4v8',
  gesund: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11ZM9 11h6m-3-3v6',
  foto: 'M3 9a2 2 0 0 1 2-2h2l1.5-3h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  notiz: 'M5 3h10l4 4v14H5ZM9 11h6m-6 4h6',
  text: 'M4 7V5h16v2M12 5v14m-3 0h6',
  textarea: 'M4 6h16M4 10h16M4 14h16M4 18h10',
  janein: 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7ZM16 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  check: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm1 8 3 3 5-6',
  radio: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  select: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm9 5 2 2 2-2',
  multi: 'M9 6h11M9 12h11M9 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17',
  date: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 10h18M8 3v4m8-4v4',
  number: 'M4 9h16M4 15h16M10 3 8 21m8-18-2 18',
  ueberschrift: 'M6 4v16M18 4v16M6 12h12',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5m0-8v.01',
  trenner: 'M3 12h18',
  kopie:
    'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2ZM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2',
  bild: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM21 16l-5-5-8 8M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
} as const;

export type BausteinIcon = keyof typeof PFADE;

export function BausteinSymbol({ name, size = 20 }: { name: BausteinIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PFADE[name]} />
    </svg>
  );
}
