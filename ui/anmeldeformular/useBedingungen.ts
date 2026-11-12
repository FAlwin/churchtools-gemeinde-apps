import { useCallback, useState, type SetStateAction } from 'react';
import type { Antwort, Antworten, Feld, Formular } from '@shared/anmeldung/formular';
import {
  antwortZustand,
  feldSichtbar,
  geloestHinweis,
  loesen,
  type AntwortZustand,
} from '@shared/anmeldung/bedingungen';

/**
 * **Bedingungen in der Eingabe** (Etappe F1b) – EINE Stelle für das öffentliche Formular, die Vorschau und die
 * Anmeldung von Hand. Die Regeln selbst stehen in `@shared/anmeldung/bedingungen`; hier nur, wie die Eingabe sie
 * anwendet:
 * - Eine ausgeblendete Frage behält ihren Wert, solange man tippt – taucht sie wieder auf, ist er noch da. Geleert wird
 *   erst beim Absenden (`anmeldungAufbauen` → `leeren`).
 * - Wird eine schon gewählte Antwort ungültig, wird die Wahl sofort gelöst (`loesen`), und die Frage sagt warum
 *   (`geloestHinweis`). Der Hinweis bleibt, bis man an dieser Frage etwas ändert (Entwurf F1, Ansicht 2).
 */

export interface BedingtStand {
  antworten: Antworten;
  /** Hinweis je Pfad (`anmeldung.<id>` / `personen.<i>.<id>`), wo eine Wahl gelöst wurde. */
  hinweise: Record<string, string>;
}

function wertAn(a: Antworten, pfad: string): Antwort {
  const [teil, i, id] = pfad.split('.');
  return teil === 'anmeldung' ? a.anmeldung[i] : a.personen[Number(i)]?.[id];
}

/**
 * **Der nächste Stand** – nach einer Eingabe (`roh`): ungültige Wahl lösen, alte Hinweise nur behalten, wo sich an der
 * Frage nichts geändert hat. Fällt eine Person weg oder kommt eine dazu, verschieben sich die Nummern – dann gelten
 * die alten Hinweise je Person nicht mehr.
 */
export function naechsterStand(f: Formular, alt: BedingtStand, roh: Antworten): BedingtStand {
  const gleichePersonen = alt.antworten.personen.length === roh.personen.length;
  const hinweise: Record<string, string> = {};
  for (const [pfad, text] of Object.entries(alt.hinweise)) {
    if (!gleichePersonen && pfad.startsWith('personen.')) continue;
    if (wertAn(alt.antworten, pfad) === wertAn(roh, pfad)) hinweise[pfad] = text;
  }
  const { antworten, geloest } = loesen(f, roh);
  for (const u of geloest) hinweise[u.pfad] = geloestHinweis(u);
  return { antworten, hinweise };
}

/** Was `FeldEingabe` für Bedingungen braucht – zum Ausbreiten: `<FeldEingabe {...bedingt(x, pfad)} />`. */
export interface BedingtEingabe {
  antwortZu?: (antwort: string) => AntwortZustand;
  geloest?: string;
}

/**
 * Antworten mit Bedingungen. `aktiv = false` (Baukasten): alles sichtbar und wählbar, nichts wird gelöst – dort
 * bearbeitet man das Formular, man füllt es nicht aus.
 */
export function useBedingungen(f: Formular, start: () => Antworten, aktiv = true) {
  const [stand, setStand] = useState<BedingtStand>(() => {
    const a = start();
    return { antworten: aktiv ? loesen(f, a).antworten : a, hinweise: {} };
  });

  const setAntworten = useCallback(
    (x: SetStateAction<Antworten>) =>
      setStand((s) => {
        const roh = typeof x === 'function' ? x(s.antworten) : x;
        return aktiv ? naechsterStand(f, s, roh) : { antworten: roh, hinweise: {} };
      }),
    [f, aktiv],
  );

  const { antworten, hinweise } = stand;
  /** Ist die Frage gerade zu sehen? `person` = Index bei Fragen je Person. */
  const zeigen = (x: Feld, person?: number) => !aktiv || feldSichtbar(f, x, antworten, person);
  const bedingt = (x: Feld, pfad: string, person?: number): BedingtEingabe =>
    aktiv
      ? {
          antwortZu: x.antwortBed
            ? (antwort) => antwortZustand(f, x, antwort, antworten, person)
            : undefined,
          geloest: hinweise[pfad],
        }
      : {};

  return { antworten, setAntworten, zeigen, bedingt };
}
