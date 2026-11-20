/**
 * **Die Personen einer Nachweis-Art lesen** (N2a, „Stand lesen“) – nur lesen, nie schreiben. Je Art, parallel:
 *
 * 1. die **Mitglieder** (Rolle Teilnehmer, aktiv) mit ihren Gruppenfeldern „Eingesehen am“, „Ausgestellt am“, „Ergebnis“,
 * 2. die **Optionen** des Felds „Ergebnis“ (der Wert kommt als Options-NUMMER, gemessen 20.11.2026),
 * 3. die **Folgeaufgaben** der Gruppe (`GET /groups/{g}/followups`: alle, auch erledigte; offen = `doneDate` leer),
 * 4. nur bei Arten mit Antrag: **Geburtstag und Adresse** der Personen (für „Antrag unvollständig“).
 *
 * Nicht lesbar (403) ist „für dich nicht sichtbar“ (`null`), nicht „niemand“; jeder andere Fehler wirft – vorübergehend ist
 * nicht „leer“. Die Regeln (Stand, Text, Farbe) stehen in `shared/anmeldung/nachweisStand.ts`.
 */
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { personenRoh } from '@ui/ct/personen';
import { gemeindeZeitzone, tagAusIso } from '@shared/ct/zeit';
import { rohWert } from '@shared/anmeldung/feldwert';
import type { CtGruppenfeld } from '@shared/anmeldung/liste';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_AUFGABE_ERSTE,
  NACHWEIS_FELDER,
  gleicherGruppenName,
} from '@shared/anmeldung/nachweise';
import {
  nachStand,
  personStand,
  tagAus,
  type NachweisErgebnisWert,
  type PersonAngaben,
  type PersonStand,
} from '@shared/anmeldung/nachweisStand';
import { personName } from './einrichten';
import { gruppenfelderLaden } from './mitglieder';
import type { NachweisArt } from './nachweisArten';

/** Eine Person der Art, wie ChurchTools sie liefert – ohne Stand (der hängt an „heute“). */
export interface NachweisPerson extends PersonAngaben {
  personId: number;
  name: string;
}

/** Eine Person mit ihrem Stand für einen Tag. */
export interface PersonMitStand extends NachweisPerson, PersonStand {}

/** Eine Nachweis-Art samt ihren Personen. `personen: null` = für dich nicht sichtbar (403 oder nicht deine Art). */
export interface NachweisArtMitPersonen extends NachweisArt {
  personen: NachweisPerson[] | null;
}

interface MitgliedMitFeldern {
  personId?: number;
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  memberStartDate?: string | null;
  person?: { title?: string; domainAttributes?: { firstName?: string; lastName?: string } };
  fields?: { id?: number; name?: string; value?: unknown }[];
}

interface AufgabeRoh {
  personId?: number;
  title?: string;
  doneDate?: string | null;
  meta?: { createdDate?: string | null };
}

const verboten = (x: unknown) => x instanceof ApiError && x.status === 403;

/** Ein 403 heißt hier: nicht sichtbar. */
async function oder403<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (x) {
    if (verboten(x)) return null;
    throw x;
  }
}

/** Das Feld einer Person mit diesem Namen (nach Namen, sonst nach der Nummer aus `memberfields`). */
function feldWert(m: MitgliedMitFeldern, name: string, def: CtGruppenfeld | undefined): unknown {
  const f = (m.fields ?? []).find(
    (x) =>
      (typeof x.name === 'string' && gleicherGruppenName(x.name, name)) || (def && x.id === def.id),
  );
  return f?.value;
}

function ergebnisAus(wert: unknown, def: CtGruppenfeld | undefined): NachweisErgebnisWert {
  const w = rohWert(wert);
  if (typeof w !== 'string' || w.trim() === '') return null;
  // Der Wert ist die Nummer der Option; als Name (Verlauf zeigt Text) lassen wir ihn auch gelten.
  const name = def?.options?.find((o) => String(o.id) === w.trim())?.name ?? w;
  if (gleicherGruppenName(name, ERGEBNIS_EINTRAG)) return 'eintrag';
  if (gleicherGruppenName(name, ERGEBNIS_OHNE)) return 'ohne';
  return null;
}

/**
 * Die **offenen Aufgaben** je Person: der Tag, an dem die älteste angelegt wurde (Ortszeit der Gemeinde). Nur die beiden
 * Aufgaben des Ablaufs zählen (`NACHWEIS_AUFGABE_*`) – eine von Hand angelegte andere Folgeaufgabe macht niemanden „angefordert“.
 */
function offeneAufgaben(liste: readonly AufgabeRoh[]): Map<number, string | null> {
  const titel = [NACHWEIS_AUFGABE_ERSTE, NACHWEIS_AUFGABE_ERNEUT];
  const offen = new Map<number, string | null>();
  const zone = gemeindeZeitzone();
  for (const a of liste) {
    if (typeof a.personId !== 'number' || a.doneDate) continue;
    if (typeof a.title !== 'string' || !titel.some((t) => gleicherGruppenName(t, a.title!)))
      continue;
    const roh = a.meta?.createdDate;
    const tag = typeof roh === 'string' && roh ? tagAus(tagAusIso(roh, zone)) : null;
    // Mehrere offene: die älteste zählt; ein bekannter Tag schlägt einen unbekannten.
    const alt = offen.get(a.personId);
    offen.set(a.personId, alt && (!tag || alt < tag) ? alt : (tag ?? alt ?? null));
  }
  return offen;
}

/**
 * **Die Personen einer Art.** `null`, wenn man Mitglieder oder Aufgaben nicht sehen darf (403). Profildaten sind eine
 * Zugabe: Fehlt dafür das Recht, gibt es keinen Hinweis „Antrag unvollständig“ (kein falscher Alarm).
 */
export async function nachweisPersonenLesen(
  art: Pick<NachweisArt, 'id' | 'einstellungen'>,
  teilnehmerRolle: number | null,
): Promise<NachweisPerson[] | null> {
  const [mitglieder, felder, aufgaben] = await Promise.all([
    oder403(ctAlleSeiten<MitgliedMitFeldern>(`/groups/${art.id}/members`, 200)),
    oder403(gruppenfelderLaden(art.id)),
    oder403(ctDaten<AufgabeRoh[]>(`/groups/${art.id}/followups`)),
  ]);
  if (mitglieder === null || felder === null || aufgaben === null) return null;

  const def = (name: string) => [...felder.values()].find((f) => gleicherGruppenName(f.name, name));
  const [eingesehen, ausgestellt, ergebnis] = NACHWEIS_FELDER.map((f) => def(f.name));
  const dabei = mitglieder.filter(
    (m): m is MitgliedMitFeldern & { personId: number } =>
      teilnehmerRolle !== null &&
      m.groupTypeRoleId === teilnehmerRolle &&
      m.groupMemberStatus === 'active' &&
      typeof m.personId === 'number',
  );
  const offen = offeneAufgaben(Array.isArray(aufgaben) ? aufgaben : []);

  // Nur bei Arten mit Antrag. `null` = nicht gelesen (kein Recht): dann gibt es auch keinen Hinweis „Antrag unvollständig“.
  let profile: Map<number, NonNullable<PersonAngaben['profil']>> | null = null;
  if (art.einstellungen?.antrag?.an && dabei.length > 0) {
    const roh = await oder403(personenRoh(dabei.map((m) => m.personId)));
    if (roh)
      profile = new Map(
        roh.map((p) => [
          p.id,
          {
            geburtstag: p.birthday || null,
            strasse: p.street || null,
            plz: p.zip || null,
            ort: p.city || null,
          },
        ]),
      );
  }

  return dabei.map((m) => ({
    personId: m.personId,
    name: personName(m),
    eingesehenAm: tagAus(feldWert(m, NACHWEIS_FELDER[0].name, eingesehen)),
    ausgestelltAm: tagAus(feldWert(m, NACHWEIS_FELDER[1].name, ausgestellt)),
    ergebnis: ergebnisAus(feldWert(m, NACHWEIS_FELDER[2].name, ergebnis), ergebnis),
    aufgabe: offen.has(m.personId)
      ? // „Angefordert am“: der Tag der Aufgabe, sonst der Beginn der Mitgliedschaft.
        { seit: offen.get(m.personId) ?? tagAus(m.memberStartDate) }
      : null,
    // Ohne Antrag oder ohne Recht: `null` (nicht gelesen). Gelesen, aber die Person fehlt in der Antwort: alles leer.
    profil: profile
      ? (profile.get(m.personId) ?? { geburtstag: null, strasse: null, plz: null, ort: null })
      : null,
  }));
}

/** Die Personen einer Art mit ihrem Stand für `heute`, sortiert (rot, blau, angefordert, gültig; dann nach Name). `null`: nicht sichtbar. */
export function personenMitStand(
  art: Pick<NachweisArtMitPersonen, 'einstellungen' | 'personen'>,
  heute: string,
): PersonMitStand[] | null {
  if (art.personen === null) return null;
  return nachStand(
    art.personen.map((p) => ({ ...p, ...personStand(p, art.einstellungen, heute) })),
  );
}
