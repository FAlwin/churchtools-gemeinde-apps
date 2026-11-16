/**
 * **Die Daten des Reiters „Kinder & Jugend“** (Bauplan O9-2): Wechseljahre aus dem Ferienkalender, die Mitglieder der
 * Stufen und Wechsel-Gruppen **mit Status** und die Geburtstage der Kinder.
 *
 * Gemessen 12.11.2026 (Test-Instanz, als Gruppenleitung): Den Ferienkalender sieht eine Leitung nur, wenn er ihr
 * freigegeben ist (sonst fehlt er in `GET /calendars`, und die Termine antworten 403) – O9-F5: Alwin gibt ihn frei.
 * `GET /groups/{id}/members` bringt keinen Geburtstag, deshalb `personenRoh`.
 *
 * Abgemeldet (401) wirft – das gilt für die ganze Seite. Alles andere ist vorübergehend und kommt als `fehler`
 * zurück: Ein Aussetzer darf nicht aussehen wie „kein Geburtstag“ oder „kein Kalender“.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { personenRoh, type PersonRoh } from '@ui/ct/personen';
import { terminPfad, type TerminRoh } from '@shared/ct/kalenderTermine';
import {
  ferienkalenderFinden,
  ferientermineAus,
  sommerferienAus,
  wechseljahre,
  type GruppenwechselEinstellung,
  type KalenderKurz,
  type Wechseljahr,
} from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import {
  kjGruppen,
  kjMitgliederAus,
  type GruppenStand,
  type KjDaten,
} from '@shared/organigramm/gruppenwechselSicht';
import type { RohMitglied } from '@shared/organigramm/mitglieder';
import { jeGruppeLaden } from './ladeMitglieder';

/** So weit voraus wird im Ferienkalender gesucht – „Einrichten“ trägt die Jahre ein, die dort stehen (bei uns bis 2029). */
export const JAHRE_VORAUS = 5;

export type FerienStand =
  | { art: 'da'; jahre: Wechseljahr[] }
  /** Kalender nicht gefunden oder nicht freigegeben. */
  | { art: 'keinKalender' }
  | { art: 'fehler' };

const abgemeldet = (e: unknown) => e instanceof ApiError && e.status === 401;

export async function ladeFerien(
  e: Omit<GruppenwechselEinstellung, 'stufen'>,
  heute: string,
  holen: <T>(pfad: string) => Promise<T> = ctDaten,
): Promise<FerienStand> {
  try {
    const kalender = ferienkalenderFinden(
      (await holen<KalenderKurz[] | null>('/calendars')) ?? [],
      e.ferienkalender,
    );
    if (!kalender) return { art: 'keinKalender' };
    const jahr = Number(heute.slice(0, 4));
    const roh =
      (await holen<TerminRoh[] | null>(
        terminPfad(kalender.id, `${jahr}-01-01`, `${jahr + JAHRE_VORAUS}-12-31`),
      )) ?? [];
    return {
      art: 'da',
      jahre: wechseljahre(sommerferienAus(ferientermineAus(roh), e.ferienStichwort), e),
    };
  } catch (x) {
    if (abgemeldet(x)) throw x;
    if (x instanceof ApiError && x.status === 403) return { art: 'keinKalender' };
    return { art: 'fehler' };
  }
}

export type KjLadeStand = { art: 'da'; daten: KjDaten } | { art: 'fehler' };

/**
 * Mitglieder aller Stufen und Wechsel-Gruppen, dann die Geburtstage der Kinder darin. Scheitern die Geburtstage
 * vorübergehend, scheitert alles – sonst stünden alle Kinder unter „Geburtstag fehlt“.
 */
export async function ladeKjDaten(
  e: Einrichtung,
  istLeitung: (rolleId: number | null) => boolean,
  holen?: (pfad: string) => Promise<RohMitglied[]>,
  personen: (ids: number[]) => Promise<PersonRoh[]> = personenRoh,
): Promise<KjLadeStand> {
  const je = await jeGruppeLaden(kjGruppen(e), (rows) => kjMitgliederAus(rows, istLeitung), holen);
  const gruppen = new Map<number, GruppenStand>(
    [...je].map(([id, s]) => [
      id,
      s.art === 'sichtbar' ? { art: 'sichtbar', mitglieder: s.wert } : s,
    ]),
  );
  const kinder = new Set<number>();
  for (const s of gruppen.values())
    if (s.art === 'sichtbar') for (const m of s.mitglieder) if (!m.leitung) kinder.add(m.personId);
  try {
    const roh = kinder.size > 0 ? await personen([...kinder]) : [];
    return {
      art: 'da',
      daten: {
        gruppen,
        geburtstage: new Map(roh.map((p) => [p.id, p.birthday ? p.birthday.slice(0, 10) : null])),
      },
    };
  } catch (x) {
    if (abgemeldet(x)) throw x;
    return { art: 'fehler' };
  }
}
