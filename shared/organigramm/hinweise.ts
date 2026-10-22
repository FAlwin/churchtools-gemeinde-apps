/**
 * **Hinweise** (Bauplan O3, Alwin 22.10.2026): nur allgemeingültige – keine, die eine bestimmte Gemeinde kennen
 * (wie „hängt nicht unter Gottesdienst“ aus dem Entwurf). Immer nur im Sichtbereich der Person (`sichtbereich.ts`).
 *
 * 1. **Teams ohne Leitung** – Gruppe mit Mitgliedern, aber niemand mit Leitungs-Rolle (`isLeader`).
 * 2. **Fast jede Woche** – Personen mit mindestens `FAST_JEDE_WOCHE` Einsätzen in den letzten 6 Monaten.
 * 3. **Dienst-Team, aber kein Einsatz** – Personen in einer Gruppe, die zu einem Dienst gehört, ohne Einsatz in den
 *    letzten 6 und den nächsten 3 Monaten.
 * 4. **Offene Anfragen** – Mitgliedsanfragen, die in ChurchTools noch nicht angenommen oder abgelehnt sind.
 *
 * 2 und 3 brauchen die Einsätze; fehlen sie (Termine gerade nicht ladbar), entfallen beide statt falsch zu zählen
 * („vorübergehend ist nicht ungültig“: ohne Daten wäre JEDE Person „ohne Einsatz“).
 */
import type { Dienst } from '../ct/dienste';
import type { Einsaetze } from './einsaetze';
import { FAST_JEDE_WOCHE } from './einsaetze';
import { istLeitung, type Mitglied, type Rolle } from './mitglieder';
import {
  imBereich,
  personenImBereich,
  type PersonImBereich,
  type Sichtbereich,
} from './sichtbereich';

/** Dient die Person fast jede Woche? EINE Regel für Hinweis und Personen-Filter. */
export function fastJedeWoche(einsaetze: Einsaetze, personId: number): boolean {
  return (einsaetze.jePerson.get(personId)?.vergangen ?? 0) >= FAST_JEDE_WOCHE;
}

/** Die Gruppen, die zu einem Dienst gehören („Dienst-Teams“). */
export function dienstGruppen(dienste: ReadonlyMap<number, Dienst> | null): Set<number> {
  return new Set([...(dienste?.values() ?? [])].flatMap((d) => d.gruppenIds));
}

/** In einem Dienst-Team, aber weder vergangen noch kommend eingeteilt? EINE Regel für Hinweis und Filter. */
export function dienstTeamOhneEinsatz(
  p: PersonImBereich,
  teams: ReadonlySet<number>,
  einsaetze: Einsaetze,
): boolean {
  const e = einsaetze.jePerson.get(p.personId);
  return p.gruppen.some((g) => teams.has(g.gruppeId)) && !e?.vergangen && !e?.kommend;
}

export interface Hinweis {
  art: 'warnung' | 'info';
  titel: string;
  text: string;
  gruppen: number[];
  personen: number[];
}

export interface HinweisDaten {
  /** Mitglieder je LESBARER Gruppe (ohne verborgene / nicht ladbare). */
  mitglieder: ReadonlyMap<number, readonly Mitglied[]>;
  /** Offene Anfragen je lesbarer Gruppe. */
  angefragt: ReadonlyMap<number, readonly Mitglied[]>;
  rollen: ReadonlyMap<number, Rolle>;
  einsaetze: Einsaetze | null;
  dienste: ReadonlyMap<number, Dienst> | null;
  bereich: Sichtbereich;
}

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

export function hinweiseAus(d: HinweisDaten): Hinweis[] {
  const h: Hinweis[] = [];

  const ohneLeitung = [...d.mitglieder]
    .filter(([id, l]) => imBereich(d.bereich, id) && l.length > 0)
    .filter(([, l]) => !l.some((m) => istLeitung(d.rollen, m.rolleId)))
    .map(([id]) => id);
  if (ohneLeitung.length) {
    h.push({
      art: 'warnung',
      titel: `${anzahl(ohneLeitung.length, 'Team', 'Teams')} ohne Leitung`,
      text: 'Niemand hat dort eine Leitungs-Rolle. Wer ist Ansprechpartner?',
      gruppen: ohneLeitung,
      personen: [],
    });
  }

  const personen = personenImBereich(d.mitglieder, d.bereich);
  if (d.einsaetze) {
    const einsaetze = d.einsaetze;
    const e = einsaetze.jePerson;
    const viel = [...personen.keys()]
      .filter((p) => fastJedeWoche(einsaetze, p))
      .sort((a, b) => (e.get(b)?.vergangen ?? 0) - (e.get(a)?.vergangen ?? 0));
    if (viel.length) {
      h.push({
        art: 'warnung',
        titel: `${anzahl(viel.length, 'Person dient', 'Personen dienen')} fast jede Woche`,
        text: `Mindestens ${FAST_JEDE_WOCHE} Einsätze in den letzten 6 Monaten.`,
        gruppen: [],
        personen: viel,
      });
    }
    if (d.dienste) {
      const teams = dienstGruppen(d.dienste);
      const still = [...personen.values()]
        .filter((p) => dienstTeamOhneEinsatz(p, teams, einsaetze))
        .map((p) => p.personId);
      if (still.length) {
        h.push({
          art: 'warnung',
          titel: `${anzahl(still.length, 'Person', 'Personen')} in einem Dienst-Team ohne Einsatz`,
          text: 'Weder in den letzten 6 noch in den nächsten 3 Monaten eingeteilt. Noch dabei? Neu? Pause?',
          gruppen: [],
          personen: still,
        });
      }
    }
  }

  const anfragen = [...d.angefragt].filter(([id, l]) => imBereich(d.bereich, id) && l.length > 0);
  if (anfragen.length) {
    const zahl = anfragen.reduce((n, [, l]) => n + l.length, 0);
    h.push({
      art: 'info',
      titel: `${anzahl(zahl, 'offene Mitgliedsanfrage', 'offene Mitgliedsanfragen')}`,
      text: 'In ChurchTools annehmen oder ablehnen.',
      gruppen: anfragen.map(([id]) => id),
      personen: [...new Set(anfragen.flatMap(([, l]) => l.map((m) => m.personId)))],
    });
  }
  return h;
}
