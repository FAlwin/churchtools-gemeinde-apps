/**
 * **Was der Reiter „Kinder & Jugend“ zeigt** (Bauplan O9-2, Entwurf v3 `kj-gruppenwechsel-v1.html`) – ohne Oberfläche:
 * wer den Reiter sieht, welches Wechseljahr gerade gilt und je Stufe, wer wechselt, wer bleibt und wer neu dazukommt.
 *
 * Woher es kommt:
 * - **Wer wechselt**, rechnet `werWechselt` aus O9-1 – dieselbe Frage, die die Regel der Wechsel-Gruppe ChurchTools
 *   stellt. So steht vor der Ankündigung „nach heutigem Stand“ da, was ChurchTools ab der Ankündigung selbst tut.
 * - **Die Ausnahme** ist der Status „zu löschen“ in der Wechsel-Gruppe (gemessen O9-0); sie bleibt über Jahre stehen,
 *   bis jemand sie aufhebt.
 * - **Kommen neu dazu**: ab der Ankündigung aus der Wechsel-Gruppe davor (dort stehen die Kinder, und die Leitung der
 *   neuen Gruppe sieht sie über ihre Leiter-Rolle, 4.25); vorher – nur wer die Gruppe davor lesen darf – als Vorschau.
 */
import { ctId } from '../ct/ctId';
import { gemeindeZeitzone, tagAusIso } from '../ct/zeit';
import { werWechselt, type Stufe, type Wechseljahr } from './gruppenwechsel';
import { wechselGruppeAb, wechselGruppeNach, type Einrichtung } from './gruppenwechselEinrichtung';
import type { RohMitglied } from './mitglieder';
import { AUSNAHME_STATUS } from './mitgliedschaft';
import type { GruppenRechte } from './rechte';

// ── Wer sieht den Reiter ───────────────────────────────────────────────────────────────────────────────────────

/** `bereich`: Bereichsleitung und Admins sehen alle Stufen; `leitung`: nur die eigenen. */
export type KjZugang = { art: 'bereich' } | { art: 'leitung'; stufen: number[] };

/** Reiter nur für Leitungen der Stufen, die Bereichsleitung und Admins (O9-2). `null` = kein Reiter. */
export function kjZugang(
  e: Einrichtung,
  geleitet: readonly number[],
  admin: boolean,
): KjZugang | null {
  if (admin || geleitet.includes(e.bereichGruppeId)) return { art: 'bereich' };
  const stufen = e.einstellung.stufen.map((s) => s.gruppeId).filter((id) => geleitet.includes(id));
  return stufen.length > 0 ? { art: 'leitung', stufen } : null;
}

/** Alle Gruppen, die der Reiter laden muss: Stufen und Wechsel-Gruppen. */
export const kjGruppen = (e: Einrichtung): number[] => [
  ...new Set([
    ...e.einstellung.stufen.map((s) => s.gruppeId),
    ...e.wechselGruppen.map((w) => w.gruppeId),
  ]),
];

// ── Mitglieder mit Status ──────────────────────────────────────────────────────────────────────────────────────

export type MitgliedStatus = 'active' | 'requested' | 'waiting' | 'to_delete';
const STATUS: readonly string[] = ['active', 'requested', 'waiting', 'to_delete'];

export interface KjMitglied {
  personId: number;
  name: string;
  leitung: boolean;
  status: MitgliedStatus;
  /**
   * Wann der Status zuletzt geändert wurde (ChurchTools: `statusChangedDate`, UTC) – `null`, wenn ChurchTools keins
   * nennt. Daran erkennt man eine Ausnahme vom Vorjahr (O9-3).
   */
  statusGeaendert: string | null;
}

/**
 * Mitglieder einer Gruppe **mit Status** – anders als `mitgliederAus`, das „zu löschen“ weglässt: Genau dieser Status ist
 * hier die Ausnahme. Beendete Mitgliedschaften fallen weg.
 */
export function kjMitgliederAus(
  rows: readonly RohMitglied[] | null | undefined,
  istLeitung: (rolleId: number | null) => boolean,
): KjMitglied[] {
  const aus: KjMitglied[] = [];
  for (const r of rows ?? []) {
    if (r.memberEndDate) continue;
    const personId = ctId(r.personId);
    const status = typeof r.groupMemberStatus === 'string' ? r.groupMemberStatus : '';
    if (personId === null || !STATUS.includes(status)) continue;
    const name = typeof r.person?.title === 'string' ? r.person.title.trim() : '';
    aus.push({
      personId,
      name: name || `Person ${personId}`,
      leitung: istLeitung(ctId(r.groupTypeRoleId)),
      status: status as MitgliedStatus,
      statusGeaendert:
        typeof r.statusChangedDate === 'string' && r.statusChangedDate !== ''
          ? r.statusChangedDate
          : null,
    });
  }
  return aus;
}

/** Eine geladene Gruppe – `verborgen` (403) ist kein Fehler, sondern „darf ich nicht sehen“. */
export type GruppenStand =
  | { art: 'sichtbar'; mitglieder: KjMitglied[] }
  | { art: 'verborgen' }
  | { art: 'fehler' };

export interface KjDaten {
  gruppen: ReadonlyMap<number, GruppenStand>;
  /**
   * `YYYY-MM-DD` oder `null` (kein Geburtstag). **Fehlt eine Person, war sie nicht lesbar** – das ist etwas anderes als
   * „kein Geburtstag“ und darf nicht unter „Daten pflegen“ landen.
   */
  geburtstage: ReadonlyMap<number, string | null>;
}

// ── Das Wechseljahr ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * **Das Jahr, um das es gerade geht:** das erste, dessen Aufnahme noch nicht vorbei ist. Bis 14 Tage nach dem Wechseltag
 * bleibt es dieses Jahr – dann wechseln die Kinder gerade –, danach kommt das nächste. `null`: Der Ferienkalender kennt
 * kein künftiges Jahr mehr.
 */
export function aktuellesWechseljahr(
  jahre: readonly Wechseljahr[],
  heute: string,
): Wechseljahr | null {
  return jahre.find((j) => heute < j.aufnahmeBis) ?? null;
}

/** `ruhig`: noch nicht angekündigt · `angekuendigt`: bis zum Wechseltag · `wechsel`: die Tage, in denen aufgenommen wird. */
export type Phase = 'ruhig' | 'angekuendigt' | 'wechsel';

export const phaseAm = (j: Wechseljahr, heute: string): Phase =>
  heute < j.ankuendigung ? 'ruhig' : heute < j.wechseltag ? 'angekuendigt' : 'wechsel';

// ── Je Stufe ───────────────────────────────────────────────────────────────────────────────────────────────────

export type KindWechsel =
  | { art: 'wechselt'; nach: Stufe }
  /**
   * Alt genug, bleibt aber: „zu löschen“ in der Wechsel-Gruppe. `vomVorjahr`: der Status wurde vor dem Wechseltag des
   * Vorjahres gesetzt (`ausnahmeVomVorjahr`).
   */
  | { art: 'ausnahme'; nach: Stufe; vomVorjahr: boolean }
  | { art: 'bleibt' }
  | { art: 'ohneGeburtstag' }
  /** Die Person ließ sich nicht lesen – ob und wohin sie wechselt, ist offen. */
  | { art: 'unbekannt' };

export interface KindZeile {
  personId: number;
  name: string;
  geburtstag: string | null;
  /** Alter am Stichtag des Wechseljahrs – `null` ohne Geburtstag. */
  alter: number | null;
  wechsel: KindWechsel;
  /** Am Stichtag 18 oder älter (4.20: Bereichsleitung prüft, wohin). */
  wird18: boolean;
}

/**
 * **Ist das eine Ausnahme vom letzten Jahr?** Ja, wenn ihr Status **vor dem Wechseltag des Vorjahres** gesetzt wurde (Tag
 * in der Gemeinde-Zeitzone). Grenze ist der Wechseltag des Vorjahres, nicht die Ankündigung dieses Jahres: Bereichsleitung
 * und Admins dürfen eine Ausnahme schon vor der Ankündigung eintragen (O9-F7) – die gehört zu diesem Jahr.
 * Ohne Zeitpunkt aus ChurchTools oder ohne bekanntes Vorjahr lässt es sich nicht sagen – dann gilt sie als dieses Jahr
 * (lieber „bleibt noch ein Jahr“ als ein falsches „vom letzten Jahr“).
 */
export function ausnahmeVomVorjahr(
  statusGeaendert: string | null,
  vorigerWechseltag: string | null,
  zeitzone: string = gemeindeZeitzone(),
): boolean {
  return (
    statusGeaendert !== null &&
    vorigerWechseltag !== null &&
    tagAusIso(statusGeaendert, zeitzone) < vorigerWechseltag
  );
}

/** Der Wechseltag des Jahres vor `jahr` – `null`, wenn der Ferienkalender ihn nicht hergibt. */
export function vorigerWechseltag(jahre: readonly Wechseljahr[], jahr: Wechseljahr): string | null {
  return jahre.find((j) => j.jahr === jahr.jahr - 1)?.wechseltag ?? null;
}

/** Wie die Sicht rechnet: Zeitzone der Gemeinde und der Wechseltag des Vorjahres (für „Ausnahme vom Vorjahr“). */
export interface SichtOptionen {
  zeitzone?: string;
  vorigerWechseltag?: string | null;
}

export interface NeuZeile {
  personId: number;
  name: string;
  von: Stufe;
}

export interface GruppenSicht {
  stufe: Stufe;
  vorige: Stufe | null;
  naechste: Stufe | null;
  /** Wie die Gruppe selbst gelesen werden konnte. */
  stand: GruppenStand['art'];
  leitung: string[];
  kinder: KindZeile[];
  /** Alt genug für die nächste Stufe – samt Ausnahmen (die Zeile sagt „bleibt noch ein Jahr“). */
  wechseln: KindZeile[];
  bleiben: KindZeile[];
  /** Die Ausnahmen, die schon vom letzten Jahr stammen – sie bekommen einen Hinweis (O9-3). */
  ausVorjahr: KindZeile[];
  /**
   * Ob die Ausnahmen bekannt sind: Ohne lesbare Wechsel-Gruppe stünde jedes Kind als „wechselt“ da, auch eins mit
   * Ausnahme – das sagt die Oberfläche dann dazu.
   */
  ausnahmenBekannt: boolean;
  /** `null` = nicht zu sehen (vor der Ankündigung für Leitungen, oder keine Quelle lesbar); erste Stufe: leer. */
  neu: NeuZeile[] | null;
}

const nachName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'de');

/** Die Ausnahmen einer Wechsel-Gruppe (Person → wann gesetzt) – `null`, wenn sie nicht lesbar ist. */
type Ausnahmen = ReadonlyMap<number, string | null>;

function ausnahmenIn(daten: KjDaten, gruppeId: number | undefined): Ausnahmen | null {
  if (gruppeId === undefined) return new Map(); // keine Wechsel-Gruppe: keine Ausnahmen möglich
  const g = daten.gruppen.get(gruppeId);
  if (g?.art !== 'sichtbar') return null;
  return new Map(
    g.mitglieder
      .filter((m) => !m.leitung && m.status === AUSNAHME_STATUS)
      .map((m): [number, string | null] => [m.personId, m.statusGeaendert]),
  );
}

/** Aktive Teilnehmer (keine Leitung) einer Stufe. */
const kinderIn = (g: GruppenStand | undefined): KjMitglied[] =>
  g?.art === 'sichtbar' ? g.mitglieder.filter((m) => !m.leitung && m.status === 'active') : [];

function zeilen(
  e: Einrichtung,
  stufe: Stufe,
  daten: KjDaten,
  jahr: Wechseljahr,
  ausnahmen: Ausnahmen,
  o: Required<SichtOptionen>,
): KindZeile[] {
  const kinder = kinderIn(daten.gruppen.get(stufe.gruppeId));
  const wechsel = new Map(
    werWechselt(
      kinder.map((k) => ({
        personId: k.personId,
        gruppeId: stufe.gruppeId,
        geburtstag: daten.geburtstage.get(k.personId) ?? null,
      })),
      e.einstellung,
      jahr,
    ).map((w) => [w.personId, w]),
  );
  return kinder
    .map((k): KindZeile => {
      const geburtstag = daten.geburtstage.get(k.personId) ?? null;
      const w = wechsel.get(k.personId);
      const alter = w && w.art !== 'ohneGeburtstag' ? w.alter : null;
      const art: KindWechsel = !daten.geburtstage.has(k.personId)
        ? { art: 'unbekannt' }
        : !w || w.art === 'ohneGeburtstag'
          ? { art: 'ohneGeburtstag' }
          : w.art === 'bleibt'
            ? { art: 'bleibt' }
            : ausnahmen.has(k.personId)
              ? {
                  art: 'ausnahme',
                  nach: w.nach,
                  vomVorjahr: ausnahmeVomVorjahr(
                    ausnahmen.get(k.personId) ?? null,
                    o.vorigerWechseltag,
                    o.zeitzone,
                  ),
                }
              : { art: 'wechselt', nach: w.nach };
      return {
        personId: k.personId,
        name: k.name,
        geburtstag,
        alter,
        wechsel: art,
        wird18: alter !== null && alter >= 18,
      };
    })
    .sort(nachName);
}

/**
 * **Eine Stufe, wie ihre Leitung sie sieht.** `neuZeigen`: Bereichsleitung immer, Leitungen erst ab der Ankündigung
 * (4.25) – davor stünde die Vorschau sonst nur bei denen, die die Gruppe davor zufällig lesen dürfen.
 */
export function gruppenSicht(
  e: Einrichtung,
  stufeId: number,
  daten: KjDaten,
  jahr: Wechseljahr,
  heute: string,
  neuZeigen: 'immer' | 'abAnkuendigung',
  optionen: SichtOptionen = {},
): GruppenSicht | null {
  const o: Required<SichtOptionen> = {
    zeitzone: optionen.zeitzone ?? gemeindeZeitzone(),
    vorigerWechseltag: optionen.vorigerWechseltag ?? null,
  };
  const stufen = e.einstellung.stufen;
  const i = stufen.findIndex((s) => s.gruppeId === stufeId);
  if (i < 0) return null;
  const stufe = stufen[i];
  const vorige = stufen[i - 1] ?? null;
  const naechste = stufen[i + 1] ?? null;
  const g = daten.gruppen.get(stufe.gruppeId);
  const eigeneAusnahmen = ausnahmenIn(daten, wechselGruppeAb(e, stufeId)?.gruppeId);
  const kinder = zeilen(e, stufe, daten, jahr, eigeneAusnahmen ?? new Map(), o);
  const wechselnd = (k: KindZeile) => k.wechsel.art === 'wechselt' || k.wechsel.art === 'ausnahme';
  return {
    stufe,
    vorige,
    naechste,
    stand: g?.art ?? 'fehler',
    leitung:
      g?.art === 'sichtbar'
        ? g.mitglieder.filter((m) => m.leitung && m.status === 'active').map((m) => m.name)
        : [],
    kinder,
    wechseln: kinder.filter(wechselnd),
    bleiben: kinder.filter((k) => !wechselnd(k)),
    ausVorjahr: kinder.filter((k) => k.wechsel.art === 'ausnahme' && k.wechsel.vomVorjahr),
    ausnahmenBekannt: eigeneAusnahmen !== null,
    neu: vorige ? kommenNeu(e, stufe, vorige, daten, jahr, heute, neuZeigen, o) : [],
  };
}

function kommenNeu(
  e: Einrichtung,
  stufe: Stufe,
  vorige: Stufe,
  daten: KjDaten,
  jahr: Wechseljahr,
  heute: string,
  neuZeigen: 'immer' | 'abAnkuendigung',
  o: Required<SichtOptionen>,
): NeuZeile[] | null {
  const angekuendigt = phaseAm(jahr, heute) !== 'ruhig';
  if (!angekuendigt && neuZeigen === 'abAnkuendigung') return null;
  const schonHier = new Set(kinderIn(daten.gruppen.get(stufe.gruppeId)).map((k) => k.personId));
  const wg = wechselGruppeNach(e, stufe.gruppeId);
  const wechselGruppe = wg ? daten.gruppen.get(wg.gruppeId) : undefined;
  // Ab der Ankündigung ist die Wechsel-Gruppe die Wahrheit: Genau ihre aktiven Teilnehmer nimmt die neue Gruppe auf.
  if (angekuendigt && wechselGruppe?.art === 'sichtbar') {
    return wechselGruppe.mitglieder
      .filter((m) => !m.leitung && m.status === 'active' && !schonHier.has(m.personId))
      .map((m) => ({ personId: m.personId, name: m.name, von: vorige }))
      .sort(nachName);
  }
  // Sonst die Vorschau aus der Gruppe davor – nur, wenn sie und ihre Ausnahmen lesbar sind.
  if (daten.gruppen.get(vorige.gruppeId)?.art !== 'sichtbar') return null;
  const ausnahmen = ausnahmenIn(daten, wechselGruppeAb(e, vorige.gruppeId)?.gruppeId);
  if (ausnahmen === null) return null;
  return zeilen(e, vorige, daten, jahr, ausnahmen, o)
    .filter((k) => k.wechsel.art === 'wechselt' && !schonHier.has(k.personId))
    .map((k) => ({ personId: k.personId, name: k.name, von: vorige }));
}

// ── Daten pflegen ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Pflege {
  /** Ohne Geburtstag fällt ein Kind durch jede Altersregel und wechselt nie von selbst. */
  ohneGeburtstag: (KindZeile & { stufe: Stufe })[];
  wird18: (KindZeile & { stufe: Stufe })[];
}

export function pflegeAus(sichten: readonly GruppenSicht[]): Pflege {
  const alle = sichten.flatMap((s) => s.kinder.map((k) => ({ ...k, stufe: s.stufe })));
  return {
    ohneGeburtstag: alle.filter((k) => k.wechsel.art === 'ohneGeburtstag'),
    wird18: alle.filter((k) => k.wird18),
  };
}

// ── Ausnahme setzen (O9-3) ─────────────────────────────────────────────────────────────────────────────────────────

/** Warum es für dieses Kind keinen Schalter gibt, obwohl es dazugehören würde. */
export type KeinSchalterGrund =
  /** Noch nicht angekündigt, und das Recht dafür kommt erst mit der Ankündigung (Leitungen). */
  | 'abAnkuendigung'
  /** Der Wechseltag ist da – das Kind geht gerade in die neue Gruppe, eine Ausnahme käme zu spät. */
  | 'zuSpaet'
  /** Die Rechte an der Wechsel-Gruppe sind gelesen: das nötige fehlt. */
  | 'rechtFehlt'
  /** Die Rechte an der Wechsel-Gruppe ließen sich nicht lesen. */
  | 'rechtUnbekannt'
  /** Die Wechsel-Gruppe selbst ließ sich nicht lesen: Ob das Kind schon drin ist, ist offen. */
  | 'nichtLesbar';

export type AusnahmeStand =
  /** Der Schalter „Bleibt noch ein Jahr“; `an` = es gibt schon eine Ausnahme, `mitglied` = das Kind ist in der Wechsel-Gruppe. */
  | { art: 'schalter'; gruppeId: number; an: boolean; mitglied: boolean }
  | { art: 'hinweis'; grund: KeinSchalterGrund }
  /** Das Kind wechselt ohnehin nicht (zu jung, ohne Geburtstag, letzte Stufe, keine Wechsel-Gruppe). */
  | { art: 'keiner' };

/**
 * **Darf für dieses Kind eine Ausnahme gesetzt oder aufgehoben werden – und womit?** Entscheidend ist nicht die Rolle in
 * der App, sondern das **Recht an der Wechsel-Gruppe** (Alwin 16.11.2026): Ist das Kind dort schon Mitglied, braucht es
 * das Recht, den Status zu ändern; sonst das Recht, Personen aufzunehmen. `rechte` sind die Rechte je Wechsel-Gruppe –
 * fehlt eine Gruppe darin, ließ sich ihr Recht nicht lesen.
 */
export function ausnahmeStand(
  e: Einrichtung,
  stufeId: number,
  kind: KindZeile,
  daten: KjDaten,
  jahr: Wechseljahr,
  heute: string,
  rechte: ReadonlyMap<number, GruppenRechte>,
): AusnahmeStand {
  const w = kind.wechsel;
  const wg = wechselGruppeAb(e, stufeId);
  if ((w.art !== 'wechselt' && w.art !== 'ausnahme') || !wg) return { art: 'keiner' };
  const phase = phaseAm(jahr, heute);
  if (phase === 'wechsel') return { art: 'hinweis', grund: 'zuSpaet' };
  const gruppe = daten.gruppen.get(wg.gruppeId);
  if (gruppe?.art !== 'sichtbar') return { art: 'hinweis', grund: 'nichtLesbar' };
  const mitglied = gruppe.mitglieder.some((m) => m.personId === kind.personId);
  const r = rechte.get(wg.gruppeId);
  if (!r) return { art: 'hinweis', grund: 'rechtUnbekannt' };
  if (!(mitglied ? r.statusAendern : r.aufnehmen)) {
    return { art: 'hinweis', grund: phase === 'ruhig' ? 'abAnkuendigung' : 'rechtFehlt' };
  }
  return { art: 'schalter', gruppeId: wg.gruppeId, an: w.art === 'ausnahme', mitglied };
}

/**
 * Die Rolle, mit der ein Kind in die Wechsel-Gruppe aufgenommen wird: die **Teilnehmer-Rolle** (`type: "participant"`)
 * aus `GET /groups/{id}/roles` (gemessen 16.11.2026: dort heißt die ID `groupTypeRoleId`). Mehrere → die Standardrolle.
 */
export function teilnehmerRolleAus(
  rows:
    | readonly {
        groupTypeRoleId?: unknown;
        type?: unknown;
        isDefault?: unknown;
        isHidden?: unknown;
      }[]
    | null
    | undefined,
): number | null {
  const passend = (rows ?? []).filter(
    (r) => r.type === 'participant' && r.isHidden !== true && ctId(r.groupTypeRoleId) !== null,
  );
  const wahl = passend.find((r) => r.isDefault === true) ?? passend[0];
  return wahl ? ctId(wahl.groupTypeRoleId) : null;
}
