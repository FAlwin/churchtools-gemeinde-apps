/**
 * **Die errechnete Uhrzeit neben Vorlauf und Nachlauf** (W15-2) – „23.11.2026 13:45“: Beginn minus Vorlauf, Ende plus
 * Nachlauf, wie im ChurchTools-Dialog. Wanduhr ohne Zeitzone (`plusSekunden` in `terminVorlagen.ts`).
 * Ganztägig zeigt ChurchTools beide Zeiten ab 00:00 des Tages (Beginn- bzw. Ende-Tag) – gemessen 23.11.2026.
 */
import type { Eintrag } from './termine';
import { plusSekunden } from './terminVorlagen';

const text = (r: { tag: string; zeit: string }): string =>
  `${r.tag.slice(8, 10)}.${r.tag.slice(5, 7)}.${r.tag.slice(0, 4)} ${r.zeit}`;

type Zeitraum = Pick<Eintrag, 'tag' | 'ganztaegig' | 'von' | 'bis'> & { endTag?: string };

/** Beginn minus `minuten`, als „TT.MM.JJJJ HH:MM“ – leer, solange Datum oder Uhrzeit fehlen. */
export function vorlaufZeit(e: Zeitraum, minuten: number): string {
  const zeit = e.ganztaegig ? '00:00' : e.von;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.tag) || !/^\d{2}:\d{2}$/.test(zeit)) return '';
  return text(plusSekunden(e.tag, zeit, -minuten * 60));
}

/** Ende plus `minuten`, als „TT.MM.JJJJ HH:MM“ – leer, solange Datum oder Uhrzeit fehlen. */
export function nachlaufZeit(e: Zeitraum, minuten: number): string {
  const tag = e.endTag || e.tag;
  const zeit = e.ganztaegig ? '00:00' : e.bis;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !/^\d{2}:\d{2}$/.test(zeit)) return '';
  return text(plusSekunden(tag, zeit, minuten * 60));
}
