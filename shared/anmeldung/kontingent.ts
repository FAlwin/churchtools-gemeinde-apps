/**
 * **Kontingent je Auswahl** (A6-5b, #616) – z. B. 6 Zweibettzimmer. Alwin, 17.10.2026: „Wie oft buchbar“ zählt
 * **Anmeldungen** (jede belegt eins), „Personen je …“ ist nur ein Hinweis („kleine Kinder schlafen im Ehebett“).
 *
 * Gäste können die Anmeldungen nicht lesen (gemessen 17.10.2026: `/groups/{id}/statistics` 401). Die Erweiterung
 * zählt deshalb mit `optionenBelegt` und schreibt `belegt` in die Einstellungen; das Formular sperrt danach.
 */
import type { PreisOption } from './preis';

/** Ein Mitglied, wie es fürs Zählen gebraucht wird. */
export interface MitgliedAuswahl {
  /** Hat einen Platz (nicht Warteliste, nicht angefragt). */
  aktiv: boolean;
  /** Anmelde-Nr. (A6-5a) – `null` bei älteren Anmeldungen. */
  nr: string | null;
  /** Gewählte Option (Name) – steht nur bei der ersten Person einer Anmeldung. */
  auswahl: string | null;
}

/**
 * **Wie oft jede Option gebucht ist** – je Anmeldung einmal, wenn mindestens eine ihrer Personen einen Platz hat.
 * Zusammengehalten über die Anmelde-Nr.; ohne Nr. zählt jedes Mitglied mit Auswahl für sich.
 */
export function optionenBelegt(optionen: PreisOption[], mitglieder: MitgliedAuswahl[]): number[] {
  const anmeldungen = new Map<string, { aktiv: boolean; auswahl: string | null }>();
  mitglieder.forEach((m, i) => {
    const schluessel = m.nr ? `nr:${m.nr}` : `einzeln:${i}`;
    const a = anmeldungen.get(schluessel) ?? { aktiv: false, auswahl: null };
    anmeldungen.set(schluessel, { aktiv: a.aktiv || m.aktiv, auswahl: a.auswahl ?? m.auswahl });
  });
  const gebucht = [...anmeldungen.values()].filter((a) => a.aktiv && a.auswahl);
  return optionen.map((o) => gebucht.filter((a) => a.auswahl === o.name).length);
}

/** Wie oft die Option noch buchbar ist – `null` = unbegrenzt. Nie unter 0. */
export function optionRest(o: PreisOption): number | null {
  return o.kontingent > 0 ? Math.max(0, o.kontingent - o.belegt) : null;
}

/** Mehr Personen als für eine Buchung vorgesehen? Nur ein Hinweis – anmelden geht trotzdem. */
export function mehrAlsVorgesehen(o: PreisOption, personen: number): boolean {
  return o.personenJe > 0 && personen > o.personenJe;
}
