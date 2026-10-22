/**
 * **Was eine Anmeldung nach den Regeln kostet** – aus dem, was in ChurchTools steht (Geburtstag, wer einen Platz hat,
 * Auswahl, Extras, Anmeldetag für Frühbucher). Die EINE Stelle für Nachprüfung (A6-5c), Nachrücken und Absagen (A7-3);
 * gerechnet wird mit `betragAus` – derselben Regel wie im Formular.
 */
import type { Antworten, OeffentlicheEinstellungen } from './formular';
import type { Preisergebnis } from './preis';
import { betragAus } from './senden';

export interface SollPerson {
  geburtstag: string | null;
  mitPlatz: boolean;
}

export interface Sollbetrag {
  cent: number;
  preis: Preisergebnis;
  /** Die gespeicherte Auswahl gibt es nicht (mehr) – dann ist `cent` nicht verlässlich (Grund `auswahl`). */
  auswahlFehlt: boolean;
}

export function sollBetrag(
  e: OeffentlicheEinstellungen,
  a: {
    personen: SollPerson[];
    auswahl: string | null | undefined;
    extras: string | null | undefined;
    angemeldetAm: string;
  },
): Sollbetrag {
  const g = e.preis.grundpreis;
  const option = g.art === 'auswahl' ? g.optionen.findIndex((o) => o.name === a.auswahl) : 0;
  const gewaehlt = new Set((a.extras ?? '').split(', ').filter(Boolean));
  const antworten: Antworten = {
    anmeldung: {},
    personen: a.personen.map((p) => ({ birth: p.geburtstag ?? undefined })),
  };
  const b = betragAus(
    e,
    antworten,
    {
      option: Math.max(0, option),
      extras: e.preis.extras.map((x) => gewaehlt.has(x.bezeichnung)),
    },
    a.angemeldetAm,
    a.personen.map((p) => p.mitPlatz),
  );
  return { cent: b.gesamtCent, preis: b.preis, auswahlFehlt: option < 0 };
}
