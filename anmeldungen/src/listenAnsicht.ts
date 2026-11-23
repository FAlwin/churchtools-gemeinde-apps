import type { OeffentlicheEinstellungen, SpaltenFilter } from '@shared/anmeldung/formular';
import type { Absage, ListenAnmeldung } from '@shared/anmeldung/liste';
import {
  obenZuerst,
  passtZurSuche,
  personSchluessel,
  personZeilen,
  personenSortiert,
  sortiert,
  type Sortierung,
} from '@shared/anmeldung/tabelle';
import { passtAnmeldung, passtPerson } from '@shared/anmeldung/tabellenFilter';

/** Was die Liste zeigt – auch das Ziel der Kennzahl-Kacheln oben auf der Seite (U1). */
export type ListenFilter = 'alle' | 'offen' | 'warte' | 'abgesagt';

/** Was in der Liste gewählt ist: Reiter, Filter der Spalten (R2), Suche, Sortierung, je Person, angeheftete Zeilen. */
export interface ListenWahl {
  filter: ListenFilter;
  /** Die Filter der Spalten (R2) – mehrere gelten zusammen; leer = ungefiltert. */
  spaltenFilter?: SpaltenFilter[];
  suche: string;
  sortierung: Sortierung;
  jePerson: boolean;
  oben: Set<string>;
}

/**
 * **Was die Liste der Anmeldungen zeigt** (#845, Scheibe 4c-2: aus `AnmeldungenReiter` herausgezogen, unverändert) –
 * je Reiter die Zeilen (je Anmeldung oder je Person), gesucht, sortiert, angeheftete zuerst; die Absagen; die
 * Wartenden nach Warteplatz; die Zahlen an den Reitern.
 */
export function listenAnsicht(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  alleAbsagen: Absage[],
  { filter, spaltenFilter = [], suche, sortierung, jePerson, oben }: ListenWahl,
) {
  const wartende = liste
    .flatMap((x) => x.personen.filter((p) => p.status === 'wartet').map((p) => ({ p, x })))
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const absagen = [...alleAbsagen].sort((u, w) => w.am.localeCompare(u.am));
  // Je Reiter die Anmeldungen (U2-1) – die Anzahl am Reiter ist die Zahl der Zeilen.
  const imReiter = {
    alle: liste,
    offen: liste.filter((x) => x.zahlungOffen),
    warte: liste.filter((x) => x.personen.some((p) => p.status === 'wartet')),
  };
  // Die Filter der Spalten (R2) – EINE Regel (`tabellenFilter.ts`) für Zeilen, Summen und „n von m“.
  const gefiltert =
    filter === 'abgesagt'
      ? []
      : imReiter[filter].filter((x) => passtAnmeldung(e, spaltenFilter, x));
  const zeilen =
    filter === 'abgesagt'
      ? []
      : obenZuerst(
          sortiert(
            e,
            gefiltert.filter((x) => passtZurSuche(x, suche)),
            sortierung,
            filter === 'warte',
          ),
          (x) => oben.has(x.schluessel),
        );
  // Dieselben Reiter je Person: Zahlung offen = die Personen einer Anmeldung mit offener Zahlung.
  const personenImReiter = {
    alle: personZeilen(liste),
    offen: personZeilen(imReiter.offen),
    warte: personZeilen(liste).filter((y) => y.p.status === 'wartet'),
  };
  const personenGezeigt =
    filter === 'abgesagt' || !jePerson
      ? []
      : obenZuerst(
          personenSortiert(
            e,
            personenImReiter[filter].filter(
              (y) =>
                passtPerson(e, spaltenFilter, y) &&
                passtZurSuche({ wer: y.x.wer, nr: y.x.nr, personen: [y.p] }, suche),
            ),
            sortierung,
            filter === 'warte',
          ),
          (y) => oben.has(personSchluessel(y)),
        );
  const absageZeilen = absagen.filter((b) =>
    passtZurSuche({ wer: b.name, nr: null, personen: [] }, suche),
  );
  const zahlen = jePerson
    ? {
        alle: personenImReiter.alle.length,
        offen: personenImReiter.offen.length,
        warte: personenImReiter.warte.length,
      }
    : { alle: liste.length, offen: imReiter.offen.length, warte: imReiter.warte.length };
  // „n von m“ über der Tabelle (R2): m = alle im Reiter, n = was Filter und Suche übrig lassen.
  const imReiterGesamt =
    filter === 'abgesagt'
      ? absagen.length
      : jePerson
        ? personenImReiter[filter].length
        : imReiter[filter].length;
  return {
    wartende,
    absagen,
    zeilen,
    personenGezeigt,
    absageZeilen,
    zahlen,
    imReiterGesamt,
    /** Die Anmeldungen des Reiters ohne Filter – Rundmail und Druckliste filtern sie über `gefilterteListe`. */
    imReiter: filter === 'abgesagt' ? [] : imReiter[filter],
  };
}
