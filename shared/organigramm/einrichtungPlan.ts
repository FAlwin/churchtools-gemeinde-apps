/**
 * **Was „Einrichten“ in ChurchTools anlegen würde** (Bauplan O9-5c-2, Entwurf `o9-5-einrichten-v1`, Vorschau) – als reine
 * Funktion, ohne Netz und ohne Oberfläche. Sie sagt je Baustein `neu | vorhanden | ändern`, **und sie ist der Plan, den
 * O9-5d ausführt**: `schritte` ist die geordnete Liste dessen, was zu schreiben ist, in der Reihenfolge der Messung
 * O9-5a (16.11.2026) – Typ → Rechte → Wechsel-Gruppen → Routinen → Regeln der Wechsel-Gruppen → Status → Regeln der
 * Stufen → Status → neu berechnen. Hier wird nichts getan.
 *
 * **Das Soll kommt aus den Erzeugern** (`LEITER_RECHTE`, `routineBefund` gegen `aufraeumRoutine`, `REGELN`), das Ist aus
 * dem, was `ladeEinrichtungStand` und die Gruppentypen geliefert haben. **Was sich nicht lesen ließ, wird nie zu „fehlt“**
 * (vorübergehend ist nicht ungültig): Es steht in `unsicher`, und `darfSchreiben` lässt dann nicht zu.
 */
import {
  fehlendeLeiterRechte,
  listeAuf,
  routineBefund,
  type EinrichtungDaten,
  type Gelesen,
  type RegelRoh,
} from './einrichtungStand';
import {
  LEITER_RECHTE,
  regelName,
  uebergaenge,
  wechselGruppenName,
  type GruppenwechselEinstellung,
  type Uebergang,
} from './gruppenwechsel';
import type { Einrichtung } from './gruppenwechselEinrichtung';

/** Der Name des Gruppentyps, den „Einrichten“ anlegt (O9-0) – und woran „vorhanden“ erkannt wird. */
export const WECHSEL_TYP_NAME = 'Gruppenwechsel';

/** Gleicher Name heißt gleicher Typ – ohne auf Groß- und Kleinschreibung oder Leerraum zu achten. */
export const istWechselTyp = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.trim().toLocaleLowerCase('de') === WECHSEL_TYP_NAME.toLowerCase();

export type PlanArt = 'neu' | 'vorhanden' | 'aendern';
export type PlanBaustein = 'typ' | 'rechte' | 'wechselGruppen' | 'routinen' | 'regeln';

export interface PlanZeile {
  id: PlanBaustein;
  art: PlanArt;
  titel: string;
  text: string;
  /** Bei den Rechten: die Namen, als Chips gezeigt. */
  rechte?: string[];
}

export type SchrittArt =
  | 'typ'
  | 'rechte'
  | 'wechselGruppe'
  | 'routine'
  | 'regelnWechselGruppe'
  | 'statusWechselGruppe'
  | 'regelnStufe'
  | 'statusStufe'
  | 'neuBerechnen';

export type SchrittZiel =
  | { art: 'typ' }
  /** Die Leiter-Rolle des Typs. */
  | { art: 'rolle'; rolle: 'leiter' }
  /** Die Wechsel-Gruppe eines Übergangs; `gruppeId` ist `null`, solange sie noch nicht angelegt ist. */
  | {
      art: 'uebergang';
      vonGruppeId: number;
      nachGruppeId: number;
      name: string;
      gruppeId: number | null;
    }
  | { art: 'stufe'; gruppeId: number; name: string };

export interface PlanSchritt {
  art: SchrittArt;
  aktion: 'neu' | 'aendern';
  ziel: SchrittZiel;
}

export interface EinrichtungsPlan {
  zeilen: PlanZeile[];
  /** In der Reihenfolge, in der geschrieben wird; was schon stimmt, fehlt. */
  schritte: PlanSchritt[];
  /** Was sich nicht lesen ließ („Gruppentyp“, „Stand in ChurchTools“) – solange etwas drinsteht, wird nicht geschrieben. */
  unsicher: string[];
}

/** Was in ChurchTools steht – vom Aufrufer gelesen. */
export interface PlanIst {
  /** Gibt es den Gruppentyp „Gruppenwechsel“? `ok: false` = ließ sich nicht lesen. */
  typ: Gelesen<boolean>;
  /** Die bisherige Einrichtung – `null` beim ersten Einrichten. */
  alt: Einrichtung | null;
  /** Gruppen, die es in ChurchTools gibt und die man sieht (id → Name). */
  gruppen: ReadonlyMap<number, string>;
  /** Was ChurchTools zur bisherigen Einrichtung hält – `null`, wenn es keine gibt oder sie nicht gelesen wurde. */
  stand: EinrichtungDaten | null;
  /** Die Jahre der Wechseltage (aus dem gewählten Ferienkalender, ab dem nächsten Wechsel). */
  jahre: readonly number[];
}

const anzahl = (n: number, eins: string, mehr: string): string => `${n} ${n === 1 ? eins : mehr}`;

/** Hat die Gruppe schon Regeln von uns (gleich welche)? `null`: nicht gelesen. */
function hatUnsere(stand: EinrichtungDaten | null, id: number): boolean | null {
  const g = stand?.gruppen.get(id);
  if (!g || !g.regeln.ok) return null;
  return g.regeln.wert.some(
    (r: RegelRoh) => typeof r.shorty === 'string' && regelName(r.shorty) !== null,
  );
}

/** Läuft die Gruppe schon (Status nicht `none`)? `null`: nicht gelesen. */
function laeuft(stand: EinrichtungDaten | null, id: number): boolean | null {
  const s = stand?.gruppen.get(id)?.status;
  return s && s.ok ? s.wert !== 'none' : null;
}

/** `neu` für alle, `vorhanden` für keinen, sonst `ändern`. */
function sammel(arten: readonly PlanArt[]): PlanArt {
  if (arten.length > 0 && arten.every((a) => a === 'neu')) return 'neu';
  if (arten.every((a) => a === 'vorhanden')) return 'vorhanden';
  return 'aendern';
}

export function einrichtungsPlan(
  soll: Pick<Einrichtung, 'einstellung' | 'bereichGruppeId'>,
  ist: PlanIst,
): EinrichtungsPlan {
  const e: GruppenwechselEinstellung = soll.einstellung;
  const wege = uebergaenge(e);
  const unsicher: string[] = [];
  const name = (id: number) => ist.gruppen.get(id) ?? `Gruppe ${id}`;
  const bereich = name(soll.bereichGruppeId);

  // ── Typ ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const typArt: PlanArt = ist.typ.ok ? (ist.typ.wert ? 'vorhanden' : 'neu') : 'aendern';
  if (!ist.typ.ok) unsicher.push(`Gruppentyp „${WECHSEL_TYP_NAME}“`);
  const typ: PlanZeile = {
    id: 'typ',
    art: typArt,
    titel: `Gruppentyp „${WECHSEL_TYP_NAME}“`,
    text: !ist.typ.ok
      ? 'ließ sich gerade nicht prüfen'
      : ist.typ.wert
        ? 'gibt es schon und wird übernommen'
        : 'mit den Rollen Leiter und Teilnehmer',
  };

  // ── Wechsel-Gruppen: vorhanden nur, wenn die bisherige Einrichtung sie für GENAU diesen Übergang hat und es sie noch gibt ──
  if (ist.alt && !ist.stand) unsicher.push('Stand in ChurchTools');
  const vorhandene = wege.map((u: Uebergang) => {
    const w = ist.alt?.wechselGruppen.find(
      (x) => x.vonGruppeId === u.von.gruppeId && x.nachGruppeId === u.nach.gruppeId,
    );
    return w && ist.gruppen.has(w.gruppeId) ? w.gruppeId : null;
  });
  const verwaist = (ist.alt?.wechselGruppen ?? []).filter(
    (w) =>
      !wege.some((u) => u.von.gruppeId === w.vonGruppeId && u.nach.gruppeId === w.nachGruppeId),
  );
  const wgArt = sammel(vorhandene.map((id): PlanArt => (id === null ? 'neu' : 'vorhanden')));
  const neueNamen = wege.filter((_, i) => vorhandene[i] === null).map(wechselGruppenName);
  const wechselGruppen: PlanZeile = {
    id: 'wechselGruppen',
    art: wgArt,
    titel: `${anzahl(wege.length, 'Wechsel-Gruppe', 'Wechsel-Gruppen')} unter „${bereich}“`,
    text:
      (wgArt === 'neu'
        ? `versteckt und im Organigramm ausgeblendet: ${wege.map(wechselGruppenName).join(', ')}`
        : wgArt === 'vorhanden'
          ? `gibt es schon: ${wege.map(wechselGruppenName).join(', ')}`
          : `neu: ${listeAuf(neueNamen)} – die übrigen gibt es schon`) +
      (verwaist.length > 0
        ? `. Nicht mehr gebraucht und unverändert: ${listeAuf(
            verwaist.map((w) => name(w.gruppeId)),
          )}`
        : ''),
  };

  // ── Rechte der Leiter-Rolle ─────────────────────────────────────────────────────────────────────────────────
  const leiterRechte = ist.stand?.rechte.leiter;
  const fehlt = leiterRechte?.ok ? fehlendeLeiterRechte(leiterRechte.wert) : null;
  const rechteArt: PlanArt =
    typArt === 'neu' ? 'neu' : fehlt !== null && fehlt.length === 0 ? 'vorhanden' : 'aendern';
  const rechte: PlanZeile = {
    id: 'rechte',
    art: rechteArt,
    titel: 'Rechte der Rolle „Leiter“ an diesem Typ',
    text:
      rechteArt === 'neu'
        ? 'gelten in jeder Wechsel-Gruppe. Teilnehmer bekommen keine Rechte.'
        : rechteArt === 'vorhanden'
          ? 'stehen schon an der Rolle. Teilnehmer bekommen keine Rechte.'
          : fehlt
            ? `${listeAuf(fehlt.map((r) => `„${r.name}“`))} ${fehlt.length === 1 ? 'fehlt und wird' : 'fehlen und werden'} ergänzt. Andere Rechte bleiben, wie sie sind.`
            : 'Fehlende Rechte werden ergänzt, andere bleiben, wie sie sind.',
    rechte: LEITER_RECHTE.map((r) => r.name),
  };

  // ── Routinen ────────────────────────────────────────────────────────────────────────────────────────────────
  const routinenArten = wege.map((u, i): PlanArt => {
    const id = vorhandene[i];
    if (id === null) return 'neu';
    if (!ist.stand) return 'aendern';
    const b = routineBefund(e, u, id, ist.stand);
    return b.art === 'ok' ? 'vorhanden' : b.art === 'fehlt' ? 'neu' : 'aendern';
  });
  const rArt = sammel(routinenArten);
  const routinen: PlanZeile = {
    id: 'routinen',
    art: rArt,
    titel: anzahl(wege.length, 'Routine', 'Routinen'),
    text:
      rArt === 'neu'
        ? `je Wechsel-Gruppe: ${e.aufraeumenTage} Tage nach dem Wechsel austragen`
        : rArt === 'vorhanden'
          ? `gibt es schon und räumen ${e.aufraeumenTage} Tage nach dem Wechsel auf`
          : 'Fehlende werden angelegt, abweichende angepasst',
  };

  // ── Regeln in allen Stufen und Wechsel-Gruppen ──────────────────────────────────────────────────────────────
  const ziele = [
    ...e.stufen.map((s) => s.gruppeId),
    ...vorhandene.filter((x): x is number => x !== null),
  ];
  const unsere = ziele.map((id) => hatUnsere(ist.stand, id));
  // „neu“ nur, wenn bekannt ist, dass nirgends schon Regeln von uns stehen; sonst werden vorhandene ersetzt.
  const regelnArt: PlanArt =
    ist.alt === null || unsere.every((x) => x === false) ? 'neu' : 'aendern';
  const regeln: PlanZeile = {
    id: 'regeln',
    art: regelnArt,
    titel: `Regeln in ${e.stufen.length + wege.length} Gruppen`,
    text:
      (ist.jahre.length > 0
        ? `Wechseltage ${listeAuf(ist.jahre.map(String))}.`
        : 'Der Ferienkalender nennt keine künftigen Sommerferien – es gäbe keine Wechseltage.') +
      ' Jede Kindergruppe nimmt nur am Wechseltag auf und gibt nur an die nächste ab.' +
      (regelnArt === 'aendern' ? ' Vorhandene Regeln dieser Erweiterung werden ersetzt.' : ''),
  };

  // ── Die Reihenfolge (Messung O9-5a) ─────────────────────────────────────────────────────────────────────────
  const schritte: PlanSchritt[] = [];
  const aktion = (a: PlanArt): 'neu' | 'aendern' => (a === 'neu' ? 'neu' : 'aendern');
  const uebergangZiel = (u: Uebergang, i: number): SchrittZiel => ({
    art: 'uebergang',
    vonGruppeId: u.von.gruppeId,
    nachGruppeId: u.nach.gruppeId,
    name: wechselGruppenName(u),
    gruppeId: vorhandene[i],
  });
  if (ist.typ.ok && typArt !== 'vorhanden')
    schritte.push({ art: 'typ', aktion: aktion(typArt), ziel: { art: 'typ' } });
  if (rechteArt !== 'vorhanden')
    schritte.push({
      art: 'rechte',
      aktion: aktion(rechteArt),
      ziel: { art: 'rolle', rolle: 'leiter' },
    });
  wege.forEach((u, i) => {
    if (vorhandene[i] === null)
      schritte.push({ art: 'wechselGruppe', aktion: 'neu', ziel: uebergangZiel(u, i) });
  });
  wege.forEach((u, i) => {
    if (routinenArten[i] !== 'vorhanden')
      schritte.push({
        art: 'routine',
        aktion: aktion(routinenArten[i]),
        ziel: uebergangZiel(u, i),
      });
  });
  wege.forEach((u, i) => {
    const id = vorhandene[i];
    const hat = id === null ? false : hatUnsere(ist.stand, id);
    schritte.push({
      art: 'regelnWechselGruppe',
      aktion: hat ? 'aendern' : 'neu',
      ziel: uebergangZiel(u, i),
    });
  });
  wege.forEach((u, i) => {
    const id = vorhandene[i];
    if (id !== null && laeuft(ist.stand, id) === true) return; // läuft schon
    schritte.push({
      art: 'statusWechselGruppe',
      aktion: id === null ? 'neu' : 'aendern',
      ziel: uebergangZiel(u, i),
    });
  });
  for (const s of e.stufen)
    schritte.push({
      art: 'regelnStufe',
      aktion: hatUnsere(ist.stand, s.gruppeId) ? 'aendern' : 'neu',
      ziel: { art: 'stufe', gruppeId: s.gruppeId, name: s.name },
    });
  for (const s of e.stufen)
    if (laeuft(ist.stand, s.gruppeId) !== true)
      schritte.push({
        art: 'statusStufe',
        aktion: 'aendern',
        ziel: { art: 'stufe', gruppeId: s.gruppeId, name: s.name },
      });
  wege.forEach((u, i) =>
    schritte.push({ art: 'neuBerechnen', aktion: 'aendern', ziel: uebergangZiel(u, i) }),
  );

  return { zeilen: [typ, rechte, wechselGruppen, routinen, regeln], schritte, unsicher };
}

// ── Fremde Regeln = Stopp ─────────────────────────────────────────────────────────────────────────────────────

export type FremdStand =
  | { art: 'frei' }
  /** Eine Stufen-Gruppe hat Regeln, die nicht von dieser Erweiterung sind – „Einrichten“ würde sie ersetzen. */
  | {
      art: 'fremd';
      gruppen: { gruppeId: number; name: string; zahl: number; beispiele: string[] }[];
    }
  /** Die Regeln ließen sich nicht lesen – nie so tun, als gäbe es keine. */
  | { art: 'unlesbar'; gruppen: { gruppeId: number; name: string }[] };

/**
 * **Haben die gewählten Stufen-Gruppen Regeln, die nicht von uns sind?** Fremd ist jede Regel, deren Kurzname nicht in
 * `REGELN` steht. Eine Gruppe, deren Regeln fehlen oder sich nicht lesen ließen, zählt als unlesbar; „fremd“ geht vor
 * (das ist sicher), beides hält das Schreiben auf.
 */
export function fremdeRegeln(
  stufen: readonly { gruppeId: number; name: string }[],
  regeln: ReadonlyMap<number, Gelesen<readonly RegelRoh[]>>,
): FremdStand {
  const fremd: Extract<FremdStand, { art: 'fremd' }>['gruppen'] = [];
  const unlesbar: { gruppeId: number; name: string }[] = [];
  for (const s of stufen) {
    const r = regeln.get(s.gruppeId);
    if (!r || !r.ok) {
      unlesbar.push({ gruppeId: s.gruppeId, name: s.name });
      continue;
    }
    const namen = r.wert
      .map((x) => (typeof x.shorty === 'string' ? x.shorty : null))
      .filter((k) => k === null || regelName(k) === null);
    if (namen.length > 0)
      fremd.push({
        gruppeId: s.gruppeId,
        name: s.name,
        zahl: namen.length,
        beispiele: [...new Set(namen.map((k) => k ?? 'ohne Namen'))].slice(0, 2),
      });
  }
  if (fremd.length > 0) return { art: 'fremd', gruppen: fremd };
  if (unlesbar.length > 0) return { art: 'unlesbar', gruppen: unlesbar };
  return { art: 'frei' };
}

// ── Darf geschrieben werden? ──────────────────────────────────────────────────────────────────────────────────

/**
 * **Wäre „Jetzt einrichten“ / „Änderungen schreiben“ an?** Nur, wenn nichts an der Einstellung fehlt, der Plan mit allem
 * Gelesenen steht (nichts `unsicher`), die Stufen keine fremden Regeln haben (und sie sich lesen ließen), der Ferienkalender
 * mindestens ein künftiges Jahr nennt – und, **nur beim Einrichten**, der Haken „Rechte der Leitung geprüft“ gesetzt ist
 * (O9-F4). `null` bei Plan oder Fremd-Stand = noch nicht geladen. In O9-5c-2 ist der Knopf trotzdem aus; die Rechnung steht
 * schon, damit 5d sie nur noch anschließt.
 */
export function darfSchreiben(o: {
  art: 'einrichten' | 'aendern';
  fehler: readonly string[];
  plan: Pick<EinrichtungsPlan, 'unsicher'> | null;
  fremd: FremdStand | null;
  jahre: number;
  haken: boolean;
}): boolean {
  if (o.fehler.length > 0) return false;
  if (!o.plan || o.plan.unsicher.length > 0) return false;
  if (!o.fremd || o.fremd.art !== 'frei') return false;
  if (o.jahre < 1) return false;
  return o.art === 'aendern' || o.haken;
}
