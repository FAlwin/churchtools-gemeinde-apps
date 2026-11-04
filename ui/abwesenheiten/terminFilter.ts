import type { AbsenceEvent, TerminArt } from '@shared/types/index';

/**
 * Der Termin-Filter im Tab „Abwesenheiten" (#400) – als reine Funktionen.
 *
 * Alwin: „nur Gottesdienst oder nur Gebetsabend". Der erste Bau filterte nach ChurchTools-Kalender –
 * bei der ECG liegen beide im selben Kalender, und eine eigene Kategorie kennt ChurchTools an
 * Terminen nicht (gemessen 20.09.2026). Entschieden: **Termin-Arten mit Suchwörtern**, vom Admin
 * gepflegt (`SiteConfig.terminArten`). Ein Termin gehört zur **ersten** Art, deren Suchwort in
 * seinem Namen vorkommt; alle übrigen fallen unter **„Sonstige"**.
 *
 * **Seit 28.10.2026 mit Häkchen wie im Dienstplaner** (`FilterKnopf`, Alwin: „exakt die gleiche Komponente …
 * genauso funktionieren"): Gemerkt wird, was **ausgeblendet** ist – vorher galt „genau EINE Art oder alles"
 * (20.09.2026). Eine ausgeblendete Art, zu der es keinen Knopf mehr gibt, blendet schlicht nichts aus. Eine
 * gemerkte Wahl der alten Art rechnet `ausgeblendetAusAlterWahl` einmal um.
 */
export const SONSTIGE_ID = 'sonstige';

export interface Knopf {
  id: string;
  name: string;
}

/** Zu welcher Art ein Termin gehört – die ID der ersten passenden Art, sonst „Sonstige". */
export function artVon(event: AbsenceEvent, arten: TerminArt[]): string {
  const name = event.name.toLocaleLowerCase('de');
  const treffer = arten.find((a) => {
    const w = a.suchwort.trim().toLocaleLowerCase('de');
    return w !== '' && name.includes(w);
  });
  return treffer?.id ?? SONSTIGE_ID;
}

/**
 * Die Knöpfe: die Arten in der Reihenfolge des Admins, aber nur die, zu denen es Termine gibt –
 * plus „Sonstige", wenn ein Termin nirgends hineinpasst. Ein Knopf ohne Termine wäre eine Frage
 * ohne Antwort.
 */
export function knoepfeAus(arten: TerminArt[], events: AbsenceEvent[]): Knopf[] {
  const belegt = new Set(events.map((e) => artVon(e, arten)));
  const knoepfe: Knopf[] = arten
    .filter((a) => belegt.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));
  if (belegt.has(SONSTIGE_ID)) knoepfe.push({ id: SONSTIGE_ID, name: 'Sonstige' });
  return knoepfe;
}

/** Termine ohne die ausgeblendeten Arten. Nichts ausgeblendet: alle. */
export function filtereTermine(
  events: AbsenceEvent[],
  ausgeblendet: string[],
  arten: TerminArt[],
): AbsenceEvent[] {
  if (ausgeblendet.length === 0) return events;
  const aus = new Set(ausgeblendet);
  return events.filter((e) => !aus.has(artVon(e, arten)));
}

/**
 * **Die gemerkte Wahl der alten Art umrechnen** (bis 28.10.2026: „genau eine Art oder alles", gemerkt als Liste mit
 * höchstens einer gewählten ID). Wer „nur Gottesdienst" gewählt hatte, sieht danach Gottesdienst angehakt und alle
 * anderen Arten ausgeblendet – also dieselbe Liste wie vorher. Ohne gültige Wahl: nichts ausgeblendet.
 */
export function ausgeblendetAusAlterWahl(alteWahl: string[], knoepfe: Knopf[]): string[] {
  const gewaehlt = alteWahl.find((id) => knoepfe.some((k) => k.id === id));
  return gewaehlt ? knoepfe.filter((k) => k.id !== gewaehlt).map((k) => k.id) : [];
}
