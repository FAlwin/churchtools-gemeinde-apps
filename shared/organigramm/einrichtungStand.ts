/**
 * **Stimmt ChurchTools mit der Einrichtung überein?** (Bauplan O9-5c, Entwurf `o9-5-einrichten-v1`, Seite „Einrichtung“)
 * – der Soll/Ist-Abgleich als reine Funktion, ohne Oberfläche und ohne Netz. Der Loader (`ladeEinrichtungStand`) liest,
 * diese Datei urteilt.
 *
 * **Das Soll kommt aus den Erzeugern**, nicht aus Abschriften: die Regeln aus `alleRegeln`, die Routine aus
 * `aufraeumRoutine`, die Rechte aus `LEITER_RECHTE`, die Wechseltage aus `jahrStaende`/`regelnReichenBis` (O9-4, schon
 * vom Aufrufer gerechnet). Ändert sich, was „Einrichten“ schreibt, ändert sich hier das Soll mit.
 *
 * **Jede Zeile hat drei Ausgänge:** in Ordnung, Warnung mit Text – oder „nicht prüfbar“. Ein Lesefehler (kein Recht,
 * Netz, 5xx, eine Antwort in unbekannter Gestalt) wird NIE zu „fehlt“: Vorübergehend ist nicht ungültig, und wer
 * etwas „Fehlendes“ repariert, schreibt in ChurchTools. Was nachweislich nicht stimmt, wird gemeldet – auch wenn
 * anderes nicht prüfbar war.
 */
import { ctId } from '../ct/ctId';
import { fehlendeRechte, rechteAus, rechtSchluessel, type RechtRoh } from '../ct/gruppenart';
import {
  alleRegeln,
  aufraeumRoutine,
  istWechselTyp,
  LEITER_RECHTE,
  uebergaenge,
  WECHSEL_SICHTBARKEIT,
  wechselGruppenName,
  type GruppenwechselEinstellung,
  type Regel,
  type Uebergang,
  type WechselGruppen,
  type WechselRollen,
  regelName,
  REGELN,
} from './gruppenwechsel';
import { wechselGruppeAb, type Einrichtung } from './gruppenwechselEinrichtung';
import { teilnehmerRolleAus } from './gruppenwechselSicht';
import type { OrgGruppe } from './gruppen';
import { wechseltageStand, type JahrStand } from './wechseltage';

// ── Was gelesen wurde ──────────────────────────────────────────────────────────────────────────────────────────

/** Ein Lesevorgang: gelesen (`wert`) oder nicht lesbar (`ok: false` – Recht, Netz, Server, unbekannte Gestalt). */
export type Gelesen<T> = { ok: true; wert: T } | { ok: false };

/** Eine Rolle aus `GET /groups/{id}/roles` (nur was hier zählt). */
export interface RolleRoh {
  groupTypeRoleId?: unknown;
  type?: unknown;
  isDefault?: unknown;
  isHidden?: unknown;
}
export type { RechtRoh };
export interface RegelRoh {
  shorty?: unknown;
}
export interface SchrittRoh {
  actionKey?: unknown;
  isEnabled?: unknown;
  actionData?: unknown;
}
/** Eine Routine aus `GET /groups/{id}/members/routines`. */
export interface RoutineRoh {
  groupId?: unknown;
  groupTypeRoleId?: unknown;
  groupMemberStatus?: unknown;
  routine?: { name?: unknown; isEnabled?: unknown; steps?: unknown } | null;
}

/** Regeln und Status einer Gruppe (Stufe oder Wechsel-Gruppe). `status`: `dynamicGroupStatus`, z. B. `none`. */
export interface GruppenRegelStand {
  regeln: Gelesen<readonly RegelRoh[]>;
  status: Gelesen<string>;
}

export interface EinrichtungDaten {
  /** Rollen je Wechsel-Gruppe. */
  rollen: ReadonlyMap<number, Gelesen<readonly RolleRoh[]>>;
  /** Rechte der Leiter- und der Teilnehmer-Rolle am Typ der Wechsel-Gruppen. */
  rechte: { leiter: Gelesen<readonly RechtRoh[]>; teilnehmer: Gelesen<readonly RechtRoh[]> };
  /** Regeln und Status je Gruppe (Stufen und Wechsel-Gruppen). */
  gruppen: ReadonlyMap<number, GruppenRegelStand>;
  /** Routinen je Wechsel-Gruppe. */
  routinen: ReadonlyMap<number, Gelesen<readonly RoutineRoh[]>>;
  /** Sichtbarkeit je Wechsel-Gruppe (`settings.visibility`, z. B. `restricted`); fehlt der Eintrag, wurde sie nicht gefragt. */
  sichtbarkeit?: ReadonlyMap<number, Gelesen<string>>;
}

/** Was vom Start der Erweiterung gebraucht wird (so ist `Start` zuweisbar). */
export interface StandQuelle {
  gruppen: readonly OrgGruppe[];
  /** Obergruppen je Gruppe. */
  eltern: ReadonlyMap<number, readonly number[]>;
  /** Name je Gruppentyp. */
  typNamen: ReadonlyMap<number, string>;
}

/** Was `ladeRegelStand` (O9-4) liefert – hier nur die Gestalt, damit `shared` nichts aus der App holt. */
export type RegelStandRoh =
  | { art: 'nichtPruefbar' }
  | { art: 'da'; staende: { jahr: number; stand: JahrStand }[]; bis: number };

// ── Was herauskommt ────────────────────────────────────────────────────────────────────────────────────────────

export type ZeilenStand =
  | { art: 'ok'; text: string }
  /** `liste`: mehrere Befunde, je einer pro Zeile (z. B. je Gruppe) – `text` fasst sie dann zusammen. */
  | { art: 'warn'; text: string; liste?: readonly string[] }
  | { art: 'nichtPruefbar'; text: string };

export type ZeilenId = 'typ' | 'rechte' | 'wechselGruppen' | 'wechseltage' | 'regeln' | 'routinen';

export interface StandZeile {
  id: ZeilenId;
  titel: string;
  stand: ZeilenStand;
}

const ok = (text: string): ZeilenStand => ({ art: 'ok', text });
const warn = (text: string): ZeilenStand => ({ art: 'warn', text });
/** Ein Befund steht als Text da, mehrere als Liste mit `zusammen` darüber. */
const warnListe = (befunde: readonly string[], zusammen: string): ZeilenStand =>
  befunde.length === 1 ? warn(befunde[0]) : { art: 'warn', text: zusammen, liste: befunde };
/** „1 Routine“, „3 Routinen“. */
const anzahl = (n: number, eins: string, mehr: string): string => `${n} ${n === 1 ? eins : mehr}`;
const nichtPruefbar = (text = 'nicht prüfbar – ließ sich gerade nicht lesen'): ZeilenStand => ({
  art: 'nichtPruefbar',
  text,
});

const gruppenName = (q: StandQuelle, id: number): string =>
  q.gruppen.find((g) => g.id === id)?.name ?? `Gruppe ${id}`;

/** „2027, 2028 und 2029“. */
export const listeAuf = (teile: readonly string[]): string =>
  teile.length < 2
    ? teile.join('')
    : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;

// ── Rollen ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Leiter-Rolle des Typs (`type: "leader"`) – wie `teilnehmerRolleAus`: nicht versteckt, Standard vor dem Rest. */
export function leiterRolleAus(rows: readonly RolleRoh[] | null | undefined): number | null {
  const passend = (rows ?? []).filter(
    (r) => r.type === 'leader' && r.isHidden !== true && ctId(r.groupTypeRoleId) !== null,
  );
  const wahl = passend.find((r) => r.isDefault === true) ?? passend[0];
  return wahl ? ctId(wahl.groupTypeRoleId) : null;
}

/** Die beiden Rollen des Typs (je `null`, wenn es sie nicht gibt). */
export const rollenAus = (
  rows: readonly RolleRoh[],
): { teilnehmer: number | null; leiter: number | null } => ({
  teilnehmer: teilnehmerRolleAus(rows),
  leiter: leiterRolleAus(rows),
});

// ── Zeile: Gruppentyp ──────────────────────────────────────────────────────────────────────────────────────────

function typZeile(e: Einrichtung, q: StandQuelle, d: EinrichtungDaten): StandZeile {
  const titel = 'Gruppentyp der Wechsel-Gruppen';
  const mit = e.wechselGruppen.flatMap((w) => {
    const g = q.gruppen.find((x) => x.id === w.gruppeId);
    return g && g.typId !== null ? [{ w, g, typId: g.typId }] : [];
  });
  if (mit.length === 0)
    return {
      id: 'typ',
      titel,
      stand: nichtPruefbar(
        'nicht prüfbar – es gibt noch keine Wechsel-Gruppe, deren Typ sich ansehen ließe',
      ),
    };
  const typen = [...new Set(mit.map((m) => m.typId))];
  const typName = (id: number) => q.typNamen.get(id) ?? `Typ ${id}`;
  if (typen.length > 1)
    return {
      id: 'typ',
      titel,
      stand: warn(
        `Die Wechsel-Gruppen haben verschiedene Typen: ${mit
          .map((m) => `„${m.g.name}“ (${typName(m.typId)})`)
          .join(', ')}`,
      ),
    };
  const probleme: string[] = [];
  let unlesbar = false;
  for (const { w, g } of mit) {
    const r = d.rollen.get(w.gruppeId);
    if (!r || !r.ok) {
      unlesbar = true;
      continue;
    }
    const rollen = rollenAus(r.wert);
    if (rollen.leiter === null) probleme.push(`„${g.name}“: die Rolle Leiter fehlt`);
    if (rollen.teilnehmer === null) probleme.push(`„${g.name}“: die Rolle Teilnehmer fehlt`);
  }
  if (probleme.length > 0) return { id: 'typ', titel, stand: warn(probleme.join('; ')) };
  if (unlesbar) return { id: 'typ', titel, stand: nichtPruefbar() };
  return {
    id: 'typ',
    titel: `Gruppentyp „${typName(typen[0])}“`,
    stand: ok('vorhanden, Rollen Leiter und Teilnehmer'),
  };
}

// ── Zeile: Rechte der Leitung am Typ ───────────────────────────────────────────────────────────────────────────

const rechtName = (r: { authId: number; dataId: number | null }): string => {
  const bekannt = LEITER_RECHTE.find((x) => x.authId === r.authId);
  const name = bekannt?.name ?? `Recht ${r.authId}`;
  return r.dataId === null ? name : `${name} (Stufe ${r.dataId})`;
};

/**
 * **Welche Rechte der Leiter-Rolle fehlen** – gegen `LEITER_RECHTE`. Eine Stelle für die Zeile „Rechte der Leitung“ und
 * für den Plan „Das legt die Erweiterung an“ (O9-5c-2); geerbte Rechte zählen als vorhanden.
 */
export const fehlendeLeiterRechte = (rows: readonly RechtRoh[]): (typeof LEITER_RECHTE)[number][] =>
  fehlendeRechte(rows, LEITER_RECHTE);

/** Gruppeninfos sehen: ohne dieses Recht ist die Gruppe für die Leitung unsichtbar (gemessen O9-0). */
const GRUPPENINFOS = 10102;

function rechteZeile(d: EinrichtungDaten): StandZeile {
  const titel = 'Rechte der Leitung am Typ';
  const { leiter, teilnehmer } = d.rechte;
  const probleme: string[] = [];
  if (leiter.ok) {
    const ist = rechteAus(leiter.wert);
    const soll = new Set(LEITER_RECHTE.map(rechtSchluessel));
    const fehlt = fehlendeLeiterRechte(leiter.wert);
    // Geerbte zählen als vorhanden (sie wirken), werden aber nicht als „zusätzlich“ gemeldet – das ließe sich hier nicht abstellen.
    const zusaetzlich = ist.filter((r) => !r.geerbt && !soll.has(rechtSchluessel(r)));
    if (fehlt.length > 0)
      probleme.push(
        `fehlt: ${fehlt.map(rechtName).join(', ')}${
          fehlt.some((r) => r.authId === GRUPPENINFOS)
            ? ' – ohne „Gruppeninfos sehen“ sehen die Leitungen ihre Wechsel-Gruppe nicht'
            : ''
        }`,
      );
    if (zusaetzlich.length > 0)
      probleme.push(`zusätzlich bei der Leitung: ${zusaetzlich.map(rechtName).join(', ')}`);
  }
  if (teilnehmer.ok) {
    const extra = rechteAus(teilnehmer.wert).filter((r) => !r.geerbt);
    if (extra.length > 0)
      probleme.push(`zusätzlich bei den Teilnehmern: ${extra.map(rechtName).join(', ')}`);
  }
  if (probleme.length > 0) return { id: 'rechte', titel, stand: warn(probleme.join('; ')) };
  if (!leiter.ok || !teilnehmer.ok) return { id: 'rechte', titel, stand: nichtPruefbar() };
  return {
    id: 'rechte',
    titel,
    stand: ok(LEITER_RECHTE.map((r) => r.name).join(' · ')),
  };
}

// ── Zeile: Wechsel-Gruppen ─────────────────────────────────────────────────────────────────────────────────────

/**
 * **Gruppen, die wie eine Wechsel-Gruppe aussehen, aber nirgends eingetragen sind** (O9-5d): gleicher Name, Typ
 * „Gruppenwechsel“, direkt unter der Bereichsgruppe, und nicht schon in `benutzt`. Das ist die eine Lücke beim Einrichten:
 * Bricht es nach dem Anlegen und vor dem Speichern ab, steht die Gruppe in ChurchTools, aber nicht in der Einrichtung.
 * Eine Stelle für den Stand („das steht da, ist aber nicht eingetragen“) und fürs Wiederholen (dort wird die Gruppe
 * übernommen, statt eine zweite anzulegen).
 */
export function waiseKandidaten(a: {
  name: string;
  bereichId: number;
  typIds: ReadonlySet<number>;
  gruppen: readonly OrgGruppe[];
  eltern: ReadonlyMap<number, readonly number[]>;
  benutzt: ReadonlySet<number>;
}): OrgGruppe[] {
  return a.gruppen.filter(
    (g) =>
      g.name === a.name &&
      g.typId !== null &&
      a.typIds.has(g.typId) &&
      !a.benutzt.has(g.id) &&
      (a.eltern.get(g.id) ?? []).includes(a.bereichId),
  );
}

/** Die Gruppentypen, die „Gruppenwechsel“ heißen (nach Namen, wie `ladeTypVorhanden`). */
export const wechselTypIds = (typNamen: ReadonlyMap<number, string>): Set<number> =>
  new Set([...typNamen].filter(([, n]) => istWechselTyp(n)).map(([id]) => id));

function wechselGruppenZeile(e: Einrichtung, q: StandQuelle, daten: EinrichtungDaten): StandZeile {
  const wege = uebergaenge(e.einstellung);
  const titel = anzahl(wege.length, 'Wechsel-Gruppe', 'Wechsel-Gruppen');
  const bereich = gruppenName(q, e.bereichGruppeId);
  const probleme: string[] = [];
  let nichtGelesen = 0;
  for (const u of wege) {
    const w = wechselGruppeAb(e, u.von.gruppeId);
    const name = wechselGruppenName(u);
    if (!w) {
      probleme.push(`${name}: fehlt`);
      continue;
    }
    if (!q.gruppen.some((g) => g.id === w.gruppeId)) {
      probleme.push(
        `${name}: Gruppe ${w.gruppeId} ist nicht zu sehen (gelöscht oder kein Zugriff)`,
      );
      continue;
    }
    if (!(q.eltern.get(w.gruppeId) ?? []).includes(e.bereichGruppeId))
      probleme.push(`${name}: hängt nicht unter „${bereich}“`);
    const sicht = daten.sichtbarkeit?.get(w.gruppeId);
    if (sicht && !sicht.ok) nichtGelesen += 1;
    else if (sicht && sicht.wert !== WECHSEL_SICHTBARKEIT)
      probleme.push(
        `${name}: versteckt – Leitungen sehen sie nicht; „Stufen ändern → Änderungen schreiben“ stellt sie um`,
      );
  }
  // Angelegt, aber nicht eingetragen: der Abbruch zwischen „Gruppe anlegen“ und „Einrichtung speichern“.
  const typIds = wechselTypIds(q.typNamen);
  const benutzt = new Set(e.wechselGruppen.map((w) => w.gruppeId));
  for (const u of wege)
    for (const g of waiseKandidaten({
      name: wechselGruppenName(u),
      bereichId: e.bereichGruppeId,
      typIds,
      gruppen: q.gruppen,
      eltern: q.eltern,
      benutzt,
    }))
      probleme.push(
        `${wechselGruppenName(u)}: Gruppe ${g.id} steht unter „${bereich}“, ist aber nicht in der Einrichtung eingetragen – „Stufen ändern → Änderungen schreiben“ übernimmt sie`,
      );
  return {
    id: 'wechselGruppen',
    titel,
    stand:
      probleme.length > 0
        ? warnListe(
            probleme,
            `${anzahl(probleme.length, 'Übergang stimmt', 'Übergänge stimmen')} nicht`,
          )
        : nichtGelesen > 0
          ? nichtPruefbar(
              `nicht prüfbar – ${nichtGelesen === 1 ? 'die Sichtbarkeit einer Gruppe' : 'die Sichtbarkeit von ' + nichtGelesen + ' Gruppen'} ließ sich gerade nicht lesen`,
            )
          : ok(`unter „${bereich}“: ${wege.map(wechselGruppenName).join(', ')}`),
  };
}

// ── Zeile: Wechseltage in den Regeln ───────────────────────────────────────────────────────────────────────────

function wechseltageZeile(regel: RegelStandRoh, naechstesJahr: number): StandZeile {
  const titel = 'Wechseltage in den Regeln';
  if (regel.art === 'nichtPruefbar') return { id: 'wechseltage', titel, stand: nichtPruefbar() };
  // Dieselbe Regel wie der Hinweis im Reiter („läuft aus“) – nicht noch einmal gerechnet.
  const s = wechseltageStand(regel.bis, naechstesJahr);
  if (s.art === 'fehlt')
    return {
      id: 'wechseltage',
      titel,
      // „reichen nur bis …“ hieße nichts: Gezählt wird ab dem nächsten Wechsel, davor steht nichts von uns.
      stand: warn(`fehlen ab ${s.ab}`),
    };
  const jahre = regel.staende
    .filter((x) => x.jahr >= naechstesJahr && x.jahr <= regel.bis)
    .map((x) => String(x.jahr));
  const danach = regel.staende.find((x) => x.jahr === regel.bis + 1)?.stand;
  const teil =
    danach?.art === 'unvollstaendig'
      ? ` – ${regel.bis + 1} steht nur teilweise drin (fehlt bei ${danach.fehlend.join(', ')})`
      : '';
  if (s.art === 'baldAus')
    return { id: 'wechseltage', titel, stand: warn(`nur noch bis ${s.bis}${teil}`) };
  return {
    id: 'wechseltage',
    titel,
    stand: ok(`${listeAuf(jahre)} – in allen Gruppen gleich`),
  };
}

// ── Zeile: Regeln der Gruppen ──────────────────────────────────────────────────────────────────────────────────

/** Die Wechsel-Gruppen je Übergang als Karte für `alleRegeln` (Schlüssel: Gruppe, aus der gewechselt wird). */
function wechselKarte(e: Einrichtung, platzhalter: boolean): WechselGruppen {
  const m = new Map<number, number>();
  uebergaenge(e.einstellung).forEach((u, i) => {
    const w = wechselGruppeAb(e, u.von.gruppeId);
    // Ein Platzhalter (negativ, nie eine echte Gruppe) lässt auch die Regeln der Stufen zum Soll gehören, deren
    // Wechsel-Gruppe fehlt – so gilt dort nur das als „fremd“, was auch „Einrichten“ nie schriebe.
    if (w) m.set(u.von.gruppeId, w.gruppeId);
    else if (platzhalter) m.set(u.von.gruppeId, -(i + 1));
  });
  return m;
}

/** Nur die Kurznamen der Regeln zählen – die Inhalte (Jahre) prüft die Zeile „Wechseltage“. */
const KEINE_ROLLEN: WechselRollen = { teilnehmer: 0, leiter: 0 };

function sollRegeln(e: Einrichtung, platzhalter: boolean): Map<number, Regel[]> {
  return alleRegeln(
    e.einstellung,
    [],
    wechselKarte(e, platzhalter),
    KEINE_ROLLEN,
    new Map(e.einstellung.stufen.map((s) => [s.gruppeId, 0])),
  );
}

/** Die Status einer dynamischen Gruppe in ChurchTools – so, wie ein Mensch sie nennt. */
const STATUS_TEXT: Record<string, string> = {
  active: 'aktiv',
  inactive: 'inaktiv',
  manual: 'manuell',
  none: 'keiner',
};

function regelnZeile(e: Einrichtung, q: StandQuelle, d: EinrichtungDaten): StandZeile {
  const titel = 'Regeln der Gruppen';
  const soll = sollRegeln(e, false);
  const erlaubt = sollRegeln(e, true);
  const probleme: string[] = [];
  let unlesbar = false;
  for (const [id, erlaubteRegeln] of erlaubt) {
    if (id < 0) continue;
    const name = gruppenName(q, id);
    const g = d.gruppen.get(id);
    if (!g || !g.regeln.ok) {
      unlesbar = true;
      continue;
    }
    const sollHier = soll.get(id) ?? [];
    const ist = g.regeln.wert.map((r) => (typeof r.shorty === 'string' ? r.shorty : null));
    // Je Gruppe EINE Zeile mit allen Befunden – sonst wird es bei mehreren Gruppen ein unlesbarer Block.
    const befunde: string[] = [];
    const fehlend = sollHier
      .filter((r) => !ist.includes(r.shorty))
      .map((r) => regelName(r.shorty) ?? r.shorty);
    if (fehlend.length > 0)
      befunde.push(`${listeAuf(fehlend)} ${fehlend.length === 1 ? 'fehlt' : 'fehlen'}`);
    const bekannt = new Set(erlaubteRegeln.map((r) => r.shorty));
    const fremd = ist.filter((s) => s === null || !bekannt.has(s));
    if (fremd.length > 0)
      befunde.push(
        `${fremd.length === 1 ? 'fremde Regel' : 'fremde Regeln'} ${listeAuf(
          fremd.map((s) => (s === null ? 'ohne Namen' : `„${s}“`)),
        )} (nicht von dieser Erweiterung)`,
      );
    // Die Austrag-Regel hängt weder an Jahren noch an Rollen: Sie muss Zeichen für Zeichen dem Erzeuger gleichen (ChurchTools
    // gibt Regeln byte-genau zurück, O9-5a). Die ältere Form trug auch Leitungen der alten Gruppe aus (O9-6-1, 17.11.2026).
    for (const r of sollHier.filter((x) => x.shorty === REGELN.austragen.shorty)) {
      const da = g.regeln.wert.find((x) => x.shorty === r.shorty);
      if (da && JSON.stringify(da) !== JSON.stringify(r))
        befunde.push(
          `${REGELN.austragen.name} ist veraltet (würde auch Leitungen austragen) – „Stufen ändern“ schreibt sie neu`,
        );
    }
    if (sollHier.length > 0) {
      if (!g.status.ok) unlesbar = true;
      else if (g.status.wert === 'none')
        befunde.push('läuft nicht – die Gruppe ist nicht als dynamisch eingeschaltet');
      // Nur „aktiv“ rechnet ChurchTools von selbst neu (O9-5d): bei `manual` verschiebt am Wechseltag niemand.
      else if (g.status.wert !== 'active')
        befunde.push(
          `rechnet nicht von selbst neu – der Status steht auf „${STATUS_TEXT[g.status.wert] ?? g.status.wert}“, nötig ist „aktiv“`,
        );
    }
    if (befunde.length > 0) probleme.push(`${name}: ${befunde.join('; ')}`);
  }
  if (probleme.length > 0)
    return {
      id: 'regeln',
      titel,
      stand: warnListe(
        probleme,
        `${anzahl(probleme.length, 'Gruppe stimmt', 'Gruppen stimmen')} nicht`,
      ),
    };
  if (unlesbar) return { id: 'regeln', titel, stand: nichtPruefbar() };
  return {
    id: 'regeln',
    titel,
    stand: ok('Kinder, Leitungen, Aufnahme und Austragen sind eingetragen und laufen'),
  };
}

// ── Zeile: Routinen ────────────────────────────────────────────────────────────────────────────────────────────

const leer = (x: unknown): boolean =>
  x === null || x === undefined || (typeof x === 'object' && Object.keys(x).length === 0);

const tageDavon = (data: unknown): number | null => {
  const t = (data as { duration?: { numDays?: unknown } } | null | undefined)?.duration?.numDays;
  return typeof t === 'number' ? t : null;
};

/** Stimmt die Routine mit der des Erzeugers überein? `null` = ja, sonst was nicht. */
function routineProblem(
  r: RoutineRoh,
  schritte: ReturnType<typeof aufraeumRoutine>['schritte'],
): string | null {
  if (r.routine?.isEnabled === false) return 'ist ausgeschaltet';
  const ist = Array.isArray(r.routine?.steps) ? (r.routine.steps as SchrittRoh[]) : [];
  if (ist.length === 0) return 'hat keine Schritte';
  const sollSchritt = schritte[0];
  const warten = ist.find((s) => s.actionKey === sollSchritt.actionKey);
  if (!warten) return 'wartet nicht vor dem Austragen';
  const tageSoll = tageDavon(sollSchritt.actionData);
  const tageIst = tageDavon(warten.actionData);
  if (tageIst === null) return 'wartet nicht vor dem Austragen';
  if (tageIst !== tageSoll) return `wartet ${tageIst} statt ${tageSoll} Tage`;
  // Austragen: Der Erzeuger schreibt `{}`, ChurchTools liefert `null` zurück (gemessen 16.11.) – beides gleich.
  const austragen = ist.find((s) => s.actionKey === schritte[1].actionKey);
  if (!austragen) return 'trägt nicht aus';
  if (warten.isEnabled === false || austragen.isEnabled === false)
    return 'hat ausgeschaltete Schritte';
  if (!leer(austragen.actionData) || !leer(schritte[1].actionData))
    return 'trägt anders aus als vorgesehen';
  if (ist.length !== schritte.length || ist.indexOf(warten) > ist.indexOf(austragen))
    return 'hat andere Schritte als vorgesehen';
  return null;
}

/** Was an der Routine einer Wechsel-Gruppe steht: stimmt, fehlt, weicht ab (mit Grund) oder ließ sich nicht lesen. */
export type RoutineBefund =
  | { art: 'ok' }
  | { art: 'fehlt' }
  | { art: 'problem'; text: string }
  | { art: 'unlesbar' };

/**
 * **Die Routine einer Wechsel-Gruppe gegen den Erzeuger** (`aufraeumRoutine`). Eine Stelle für die Zeile „Routinen“ und
 * den Plan (O9-5c-2); `einstellung` ist die, gegen die verglichen wird (im Fenster „Stufen ändern“ die neue).
 */
export function routineBefund(
  einstellung: Pick<GruppenwechselEinstellung, 'aufraeumenTage'>,
  u: Uebergang,
  gruppeId: number,
  d: EinrichtungDaten,
): RoutineBefund {
  const rollenGelesen = d.rollen.get(gruppeId);
  const liste = d.routinen.get(gruppeId);
  if (!rollenGelesen || !rollenGelesen.ok || !liste || !liste.ok) return { art: 'unlesbar' };
  const rollen = rollenAus(rollenGelesen.wert);
  // Ohne Rollen gibt es kein Soll; die Zeile „Gruppentyp“ nennt den Grund.
  if (rollen.teilnehmer === null || rollen.leiter === null) return { art: 'unlesbar' };
  const { schritte } = aufraeumRoutine(
    u,
    gruppeId,
    { teilnehmer: rollen.teilnehmer, leiter: rollen.leiter },
    einstellung,
  );
  const passend = liste.wert.filter(
    (r) =>
      ctId(r.groupTypeRoleId) === rollen.teilnehmer &&
      r.groupMemberStatus === 'active' &&
      (r.groupId === undefined || ctId(r.groupId) === gruppeId),
  );
  if (passend.length === 0) return { art: 'fehlt' };
  const befunde = passend.map((r) => routineProblem(r, schritte));
  if (befunde.includes(null)) return { art: 'ok' };
  return { art: 'problem', text: befunde[0] ?? '' };
}

function routinenZeile(e: Einrichtung, d: EinrichtungDaten): StandZeile {
  const wege = uebergaenge(e.einstellung);
  const titel = anzahl(wege.length, 'Routine', 'Routinen');
  const probleme: string[] = [];
  let unlesbar = false;
  for (const u of wege) {
    const w = wechselGruppeAb(e, u.von.gruppeId);
    if (!w) continue; // Fehlt die Wechsel-Gruppe, meldet das die Zeile dazu – hier gäbe es nur dasselbe noch einmal.
    const name = wechselGruppenName(u);
    const b = routineBefund(e.einstellung, u, w.gruppeId, d);
    if (b.art === 'unlesbar') unlesbar = true;
    else if (b.art === 'fehlt') probleme.push(`${name}: Routine fehlt`);
    else if (b.art === 'problem') probleme.push(`${name}: Routine ${b.text}`);
  }
  if (probleme.length > 0)
    return {
      id: 'routinen',
      titel,
      stand: warnListe(
        probleme,
        `${anzahl(probleme.length, 'Routine stimmt', 'Routinen stimmen')} nicht`,
      ),
    };
  if (unlesbar) return { id: 'routinen', titel, stand: nichtPruefbar() };
  return {
    id: 'routinen',
    titel,
    stand: ok(
      wege.length === 1
        ? `räumt die Wechsel-Gruppe ${e.einstellung.aufraeumenTage} Tage nach dem Wechsel auf`
        : `räumen die Wechsel-Gruppen ${e.einstellung.aufraeumenTage} Tage nach dem Wechsel auf`,
    ),
  };
}

// ── Alles zusammen ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * **Der Stand in ChurchTools**, Zeile für Zeile in der Reihenfolge des Entwurfs. `naechstesJahr` ist das Jahr des
 * nächsten Wechsels (das aktuelle Wechseljahr des Reiters).
 */
export function einrichtungStand(
  e: Einrichtung,
  quelle: StandQuelle,
  daten: EinrichtungDaten,
  regel: RegelStandRoh,
  naechstesJahr: number,
): StandZeile[] {
  return [
    typZeile(e, quelle, daten),
    rechteZeile(daten),
    wechselGruppenZeile(e, quelle, daten),
    wechseltageZeile(regel, naechstesJahr),
    regelnZeile(e, quelle, daten),
    routinenZeile(e, daten),
  ];
}

const ZAHLWORT = ['Keine', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'];

/** Der gelbe Sammelhinweis oben – `null`, wenn nichts ⚠ ist. „nicht prüfbar“ zählt nicht (das ist keine Aufgabe). */
export function sammelHinweis(
  zeilen: readonly StandZeile[],
): { titel: string; text: string } | null {
  const n = zeilen.filter((z) => z.stand.art === 'warn').length;
  if (n === 0) return null;
  return {
    titel: n === 1 ? 'Eine Sache braucht dich.' : `${ZAHLWORT[n] ?? n} Dinge brauchen dich.`,
    text: 'Unten steht, was nicht stimmt.',
  };
}

// ── Karte „Stufen“ ─────────────────────────────────────────────────────────────────────────────────────────────

export interface StufenAnzeige {
  kette: { name: string; abAlter: number }[];
  bereich: string;
  ferien: string;
  /** „30.09.“ */
  stichtag: string;
  /** „8 Wochen vor dem Wechseltag“ */
  ankuendigung: string;
}

export function stufenAnzeige(e: Einrichtung, q: Pick<StandQuelle, 'gruppen'>): StufenAnzeige {
  const s = e.einstellung;
  const [mm, tt] = s.stichtag.split('-');
  const wochen = s.ankuendigungTage / 7;
  return {
    kette: s.stufen.map((x) => ({ name: x.name, abAlter: x.abAlter })),
    bereich:
      q.gruppen.find((g) => g.id === e.bereichGruppeId)?.name ?? `Gruppe ${e.bereichGruppeId}`,
    ferien: s.ferienkalender,
    stichtag: `${tt}.${mm}.`,
    ankuendigung: Number.isInteger(wochen)
      ? `${wochen} ${wochen === 1 ? 'Woche' : 'Wochen'} vor dem Wechseltag`
      : `${s.ankuendigungTage} Tage vor dem Wechseltag`,
  };
}
