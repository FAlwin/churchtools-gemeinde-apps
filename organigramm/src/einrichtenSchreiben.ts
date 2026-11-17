/**
 * **Das Schreiben für „Gruppenwechsel einrichten“** (Bauplan O9-5d) – führt den Plan aus `einrichtungsPlan` aus, Schritt für
 * Schritt in der gemessenen Reihenfolge (O9-5a): Typ → Rechte → Wechsel-Gruppen → Routinen → Regeln der Wechsel-Gruppen →
 * Status → Regeln der Stufen → Status → unsere Regeln aus Stufen, die keine mehr sind → neu berechnen → Einrichtung
 * speichern. Was sie tun darf, steht im Plan; hier wird nur geschrieben und nachgelesen.
 *
 * **Jeder Schritt schreibt und liest sofort nach.** Ein `200`/`201` ist kein Beleg (Lehre vom 11.08.2026): Erst was beim
 * Nachlesen dasteht – Typ, Rechte, Gruppe (Typ, Name, Obergruppe), Routine gegen `aufraeumRoutine`, Regeln Zeichen für
 * Zeichen (O9-5a: ChurchTools gibt sie byte-genau zurück), Status `active` –, zählt als Erfolg. Beim ersten Fehler wird
 * aufgehört; der Rest ist „offen“.
 *
 * **Vorübergehend ist nicht ungültig.** Zeitüberschreitung, 5xx, Drosselung und Netz heißen `voruebergehend`: nichts wird
 * zurückgerollt, nichts gelöscht, „Nochmal versuchen“ liest den Stand neu, rechnet den Plan neu und schreibt nur, was
 * fehlt. 401/403 von ChurchTools heißt `abgelehnt` („dir fehlt das Recht …“).
 *
 * **Nie eine zweite Wechsel-Gruppe für denselben Übergang.** Die Einrichtung wird **sofort nach jeder neu angelegten
 * Wechsel-Gruppe** gespeichert und am Ende noch einmal. Die einzige Lücke: ein Abbruch zwischen „Gruppe angelegt“ und
 * „Einrichtung gespeichert“. Dann steht die Gruppe in ChurchTools, aber nicht in der Einrichtung – der Stand zeigt sie
 * als ⚠ (`waiseKandidaten`), und „Nochmal versuchen“ **übernimmt** sie (gleicher Name, Typ „Gruppenwechsel“, direkt unter
 * der Bereichsgruppe), statt eine zweite anzulegen.
 *
 * **Nichts wird gelöscht.** Nicht mehr gebrauchte Wechsel-Gruppen bleiben stehen (der Plan nennt sie, „Fertig“ zeigt sie);
 * aus Stufen, die keine mehr sind, gehen nur unsere Regeln (`REGELN`), fremde bleiben. Rechte werden nur ergänzt, nie
 * entzogen. Vor dem Schreiben prüft der Lauf noch einmal alles, was auch die Vorschau verlangt (fremde Regeln, Ferien,
 * Plan nicht `unsicher`) – er verlässt sich nicht auf den Knopf.
 */
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';
import type { SpeicherErgebnis } from '@shared/ct/versionierterWert';
import {
  einrichtungsPlan,
  fremdeRegeln,
  type EinrichtungsPlan,
  type PlanSchritt,
} from '@shared/organigramm/einrichtungPlan';
import {
  fehlendeLeiterRechte,
  rollenAus,
  routineBefund,
  waiseKandidaten,
  type EinrichtungDaten,
  type Gelesen,
  type RechtRoh,
  type RegelRoh,
  type RolleRoh,
  type RoutineRoh,
} from '@shared/organigramm/einrichtungStand';
import {
  alleRegeln,
  aufraeumRoutine,
  istWechselTyp,
  LEITER_RECHTE,
  regelName,
  uebergaenge,
  WECHSEL_TYP_NAME,
  wechselGruppenName,
  type Regel,
  type Uebergang,
  type Wechseljahr,
  type WechselRollen,
} from '@shared/organigramm/gruppenwechsel';
import {
  einrichtungAus,
  einrichtungFehler,
  type Einrichtung,
} from '@shared/organigramm/gruppenwechselEinrichtung';
import { teilnehmerRolleAus } from '@shared/organigramm/gruppenwechselSicht';
import { elternAus, type OrgGruppe, type RohHierarchie } from '@shared/organigramm/gruppen';
import { ctId } from '@shared/ct/ctId';
import { regelnLesen, statusAus } from './ladeEinrichtungStand';
import type { EinrichtungVersioniert } from './gruppenwechselSpeicher';

// ── Eingabe und Ergebnis ───────────────────────────────────────────────────────────────────────────────────────

/** Was geschrieben wird: Einrichten und Ändern den ganzen Plan, Nachtragen nur die Regeln, Rechte nur die Rechte. */
export type SchreibArt = 'einrichten' | 'aendern' | 'nachtragen' | 'rechte';

export type Soll = Pick<Einrichtung, 'einstellung' | 'bereichGruppeId'>;

/** Was zum Schreiben gelesen sein muss – **frisch zu Beginn jedes Laufs** (auch bei „Nochmal versuchen“). */
export interface Lage {
  gespeichert: EinrichtungVersioniert;
  /** Das Soll: beim Einrichten/Ändern das aus dem Formular, beim Nachtragen/Rechte die gespeicherte Einrichtung. */
  soll: Soll | null;
  typ: Gelesen<boolean>;
  /** Stand in ChurchTools zur gespeicherten Einrichtung – `null`, wenn es keine gibt. */
  stand: EinrichtungDaten | null;
  /** Die Regeln der Stufen des Solls (fremde = Stopp). */
  regeln: ReadonlyMap<number, Gelesen<readonly RegelRoh[]>>;
  /** Die Wechseljahre, die geschrieben werden – `null`: der Ferienkalender ließ sich nicht lesen. */
  jahre: Wechseljahr[] | null;
  /** Alle sichtbaren Gruppen samt Obergruppen – `null`: nicht lesbar. */
  gruppen: { gruppen: OrgGruppe[]; eltern: ReadonlyMap<number, readonly number[]> } | null;
}

export interface Eingabe {
  art: SchreibArt;
  /** Das Soll aus dem Formular (Einrichten, Ändern); bei Nachtragen und Rechte `null`. */
  soll: Soll | null;
  /**
   * Was in ChurchTools gespeichert sein muss, damit geschrieben wird: beim ersten Einrichten `null` (es gibt noch keine),
   * beim Ändern die, aus der das Formular stammt, bei „Nochmal versuchen“ die, die der Lauf davor gespeichert hat.
   * Steht etwas anderes da, hat jemand anderes inzwischen gespeichert – dann wird nichts geschrieben.
   */
  ausgang: Einrichtung | null;
  von: { personId: number; name: string };
}

export type FehlerGrund = 'voruebergehend' | 'abgelehnt' | 'anderer';

export type Ausgang =
  | {
      art: 'ok';
      /** Was nachgelesen wurde, z. B. „nachgelesen“. */
      text: string;
      /** Beim Neuberechnen: was ChurchTools gemeldet hat. */
      zahlen?: { created: number; updated: number; deleted: number };
    }
  | { art: 'fehler'; grund: FehlerGrund; text: string }
  | { art: 'offen' };

export interface SchrittErgebnis {
  schritt: PlanSchritt;
  ausgang: Ausgang;
}

export type Lauf =
  /** Nichts geschrieben: Eine Voraussetzung stimmt nicht. `nochmal`: Ein zweiter Versuch kann helfen (nur Lesefehler). */
  | { art: 'gestoppt'; grund: string; nochmal: boolean }
  | {
      art: 'gelaufen';
      /** Alle Schritte des Plans in der Reihenfolge, die nach dem Fehler „offen“. */
      ergebnisse: SchrittErgebnis[];
      ok: boolean;
      /** Was jetzt gespeichert ist (der nächste Versuch erwartet es) – `null`, solange nichts gespeichert wurde. */
      gespeichert: Einrichtung | null;
      /** Wechsel-Gruppen, die nicht mehr zu einem Übergang gehören – nicht gelöscht, „Fertig“ nennt sie. */
      nichtMehrGebraucht: { gruppeId: number; name: string }[];
    };

/** Der Anschluss an ChurchTools – für Tests austauschbar. */
export interface CtPort {
  /** `GET /api<pfad>`, `data` ausgepackt. */
  holen<T>(pfad: string): Promise<T>;
  /** Schreibender Aufruf; liefert `data` (sonst den Rumpf). */
  schicken(pfad: string, methode: 'POST' | 'PUT' | 'PATCH', json?: unknown): Promise<unknown>;
}

export const ctPort: CtPort = {
  holen: (pfad) => ctDaten(pfad),
  async schicken(pfad, methode, json) {
    const body = await ctAnfrage<{ data?: unknown } | null>(pfad, {
      method: methode,
      body: json === undefined ? undefined : JSON.stringify(json),
      verweigert: 'Dir fehlt in ChurchTools das Recht dafür (Berechtigungen verwalten).',
    });
    return body && typeof body === 'object' && 'data' in body ? body.data : body;
  },
};

export interface Anschluss {
  lage: () => Promise<Lage>;
  port: CtPort;
  speichern: (
    inhalt: Einrichtung,
    erwartet: number | null,
    von: Eingabe['von'],
  ) => Promise<SpeicherErgebnis<Einrichtung>>;
  /** Nach jedem Schritt: der Stand aller Schritte (für die Anzeige „es läuft“). */
  fortschritt?: (ergebnisse: readonly SchrittErgebnis[]) => void;
}

// ── Fehler sortieren ───────────────────────────────────────────────────────────────────────────────────────────

/** Ein Schritt ist gescheitert – mit Grund und einem Satz für Menschen. */
export class SchrittFehler extends Error {
  constructor(
    readonly grund: FehlerGrund,
    message: string,
  ) {
    super(message);
    this.name = 'SchrittFehler';
  }
}

const VORUEBERGEHEND =
  'ChurchTools hat nicht (rechtzeitig) geantwortet. Nichts ist kaputt: Was schon steht, bleibt stehen.';
const KEIN_RECHT =
  'Dir fehlt in ChurchTools das Recht dafür. Bitte ein Admin mit „Berechtigungen verwalten“.';

/** Die Zweige einzeln: abgelehnt ist etwas anderes als „antwortet nicht“ – und nur das Zweite darf wiederholt werden. */
export function fehlerSortieren(e: unknown): { grund: FehlerGrund; text: string } {
  if (e instanceof SchrittFehler) return { grund: e.grund, text: e.message };
  if (e instanceof KeinSpeicherRecht) return { grund: 'abgelehnt', text: KEIN_RECHT };
  if (e instanceof NichtUebernommen) return { grund: 'anderer', text: e.message };
  if (e instanceof ApiError) {
    if (e.status === 401)
      return { grund: 'abgelehnt', text: 'Du bist bei ChurchTools nicht mehr angemeldet.' };
    // 403 ohne ChurchTools-Rumpf (Proxy, Firewall), 429, 5xx und Zeitüberschreitung (504) können vorübergehend sein.
    if (e.status === 403 || e.status === 429 || e.status >= 500)
      return { grund: 'voruebergehend', text: VORUEBERGEHEND };
    return { grund: 'anderer', text: e.message };
  }
  // Netzfehler (`fetch` wirft einen TypeError) und alles Unbekannte: nicht „ungültig“, nur nicht bestätigt.
  return { grund: 'voruebergehend', text: VORUEBERGEHEND };
}

const fehl = (text: string): SchrittFehler => new SchrittFehler('anderer', text);
const unlesbar = (was: string): SchrittFehler =>
  new SchrittFehler('voruebergehend', `${was} ließ sich nicht nachlesen. ${VORUEBERGEHEND}`);

// ── Hilfen ─────────────────────────────────────────────────────────────────────────────────────────────────────

const liste = async <T>(port: CtPort, pfad: string, was: string): Promise<T[]> => {
  const roh = await port.holen<unknown>(pfad);
  if (!Array.isArray(roh)) throw unlesbar(was);
  return roh as T[];
};

const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Zwei Einrichtungen gleich? Über `einrichtungAus` vereinheitlicht – nicht von der Reihenfolge der Felder abhängig. */
const gleicheEinrichtung = (a: Einrichtung | null, b: Einrichtung | null): boolean =>
  gleich(a && einrichtungAus(a), b && einrichtungAus(b));

/** Ist die Regel von dieser Erweiterung (Kurzname aus `REGELN`)? */
const istUnsere = (r: RegelRoh): boolean =>
  typeof r.shorty === 'string' && regelName(r.shorty) !== null;

/** Eine Antwort von `POST` mit der neuen Nummer – `null`, wenn keine dabei ist. */
const nummerAus = (antwort: unknown): number | null =>
  ctId((antwort as { id?: unknown } | null)?.id);

interface GruppeRoh {
  name?: unknown;
  information?: { groupTypeId?: unknown } | null;
}

// ── Der Lauf ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Welche Schritte des Plans zu welcher Art gehören. */
const ARTEN: Record<SchreibArt, ((s: PlanSchritt) => boolean) | null> = {
  einrichten: null,
  aendern: null,
  nachtragen: (s) => s.art === 'regelnWechselGruppe' || s.art === 'regelnStufe',
  rechte: (s) => s.art === 'rechte',
};

export async function schreibeEinrichtung(e: Eingabe, a: Anschluss): Promise<Lauf> {
  // ── 1. Frisch lesen und prüfen – bis hierher ist nichts geschrieben ─────────────────────────────────────────────
  let lage: Lage;
  try {
    lage = await a.lage();
  } catch (x) {
    const f = fehlerSortieren(x);
    return { art: 'gestoppt', grund: f.text, nochmal: f.grund === 'voruebergehend' };
  }
  const gestoppt = (grund: string, nochmal = false): Lauf => ({ art: 'gestoppt', grund, nochmal });
  const g = lage.gespeichert;
  if (g.art === 'fehler')
    return gestoppt(
      'Die gespeicherte Einrichtung ließ sich gerade nicht lesen. Es wurde nichts verändert.',
      true,
    );
  if (g.art === 'unlesbar')
    return gestoppt(
      'Die gespeicherte Einrichtung hat ein Format, das diese Fassung nicht lesen kann. Es wird nichts überschrieben.',
    );
  const bisher = g.art === 'da' ? g.einrichtung : null;
  const nachtragen = e.art === 'nachtragen' || e.art === 'rechte';
  if (nachtragen ? bisher === null : !gleicheEinrichtung(bisher, e.ausgang))
    return gestoppt(
      nachtragen
        ? 'Es gibt noch keine Einrichtung – dafür muss erst eingerichtet werden.'
        : bisher === null
          ? 'Die Einrichtung ist inzwischen verschwunden. Bitte das Fenster schließen und neu öffnen.'
          : 'Jemand anderes hat die Einrichtung inzwischen gespeichert. Es wurde nichts überschrieben – bitte das Fenster schließen und neu öffnen.',
    );
  const soll = lage.soll;
  if (!soll) return gestoppt('Es gibt nichts zu schreiben.');
  const fehlerSoll = einrichtungFehler(soll);
  if (fehlerSoll.length > 0)
    return gestoppt(`Die Einstellungen stimmen noch nicht: ${fehlerSoll[0]}`);
  if (!lage.gruppen)
    return gestoppt('Die Gruppen ließen sich gerade nicht lesen. Es wurde nichts verändert.', true);
  const regelnSchreiben = e.art !== 'rechte';
  if (regelnSchreiben) {
    if (!lage.jahre)
      return gestoppt(
        'Der Ferienkalender ließ sich gerade nicht lesen. Es wurde nichts verändert.',
        true,
      );
    if (lage.jahre.length < 1)
      return gestoppt(
        'Der Ferienkalender nennt keine künftigen Sommerferien – es gäbe keine Wechseltage.',
      );
    const fremd = fremdeRegeln(soll.einstellung.stufen, lage.regeln);
    if (fremd.art === 'fremd')
      return gestoppt(
        `${fremd.gruppen.map((x) => `„${x.name}“`).join(', ')} ${fremd.gruppen.length === 1 ? 'hat' : 'haben'} schon eigene Regeln in ChurchTools – sie würden ersetzt. Bitte die Regeln dort ansehen.`,
      );
    if (fremd.art === 'unlesbar')
      return gestoppt(
        `Die Regeln von ${fremd.gruppen.map((x) => `„${x.name}“`).join(', ')} ließen sich nicht prüfen – es wird nie angenommen, dass es keine gibt.`,
        true,
      );
  }
  const jahre = lage.jahre ?? [];
  const gruppenNamen = new Map(lage.gruppen.gruppen.map((x) => [x.id, x.name]));
  const plan: EinrichtungsPlan = einrichtungsPlan(soll, {
    typ: lage.typ,
    alt: bisher,
    gruppen: gruppenNamen,
    stand: lage.stand,
    jahre: jahre.map((j) => j.jahr),
  });
  if (plan.unsicher.length > 0)
    return gestoppt(
      `Nicht alles ließ sich prüfen: ${plan.unsicher.join(', ')}. Solange das so ist, wird nichts geschrieben.`,
      true,
    );
  const filter = ARTEN[e.art];
  const schritte = filter ? plan.schritte.filter(filter) : plan.schritte;

  // ── 2. Die Schritte ─────────────────────────────────────────────────────────────────────────────────────────────
  const ergebnisse: SchrittErgebnis[] = schritte.map((schritt) => ({
    schritt,
    ausgang: { art: 'offen' },
  }));
  const l = new Schreiber(e, a, soll, jahre, lage, bisher, g.art === 'da' ? g.version : null);
  let ok = true;
  for (let i = 0; i < schritte.length; i++) {
    try {
      ergebnisse[i] = { schritt: schritte[i], ausgang: await l.schritt(schritte[i]) };
    } catch (x) {
      const f = fehlerSortieren(x);
      ergebnisse[i] = { schritt: schritte[i], ausgang: { art: 'fehler', ...f } };
      ok = false;
    }
    a.fortschritt?.(ergebnisse);
    if (!ok) break;
  }
  return {
    art: 'gelaufen',
    ergebnisse,
    ok,
    gespeichert: l.gespeichert,
    nichtMehrGebraucht: nachtragen ? [] : plan.nichtMehrGebraucht,
  };
}

/** Hält den Stand des Laufs (neue Gruppen, Rollen, gespeicherte Version) und führt je einen Schritt aus. */
class Schreiber {
  private readonly wege: Uebergang[];
  /** Die Wechsel-Gruppe je Übergang (Schlüssel: Gruppe, aus der gewechselt wird) – bekannte und neu angelegte. */
  private readonly wg = new Map<number, number>();
  private gruppen: OrgGruppe[];
  private readonly eltern: Map<number, number[]>;
  private typNr: number | null = null;
  private version: number | null;
  gespeichert: Einrichtung | null;
  private regelnMemo: Map<number, Regel[]> | null = null;

  constructor(
    private readonly e: Eingabe,
    private readonly a: Anschluss,
    private readonly soll: Soll,
    private readonly jahre: readonly Wechseljahr[],
    lage: Lage,
    bisher: Einrichtung | null,
    version: number | null,
  ) {
    this.wege = uebergaenge(soll.einstellung);
    this.gruppen = [...(lage.gruppen?.gruppen ?? [])];
    this.eltern = new Map([...(lage.gruppen?.eltern ?? [])].map(([k, v]) => [k, [...v]]));
    // Dieselbe Regel wie der Plan („vorhanden“): für GENAU diesen Übergang eingetragen, und es gibt die Gruppe noch.
    for (const u of this.wege) {
      const w = bisher?.wechselGruppen.find(
        (x) => x.vonGruppeId === u.von.gruppeId && x.nachGruppeId === u.nach.gruppeId,
      );
      if (w && this.gruppen.some((x) => x.id === w.gruppeId))
        this.wg.set(u.von.gruppeId, w.gruppeId);
    }
    this.gespeichert = bisher;
    this.version = version;
  }

  private get port(): CtPort {
    return this.a.port;
  }

  async schritt(s: PlanSchritt): Promise<Ausgang> {
    switch (s.art) {
      case 'typ':
        return this.typAnlegen();
      case 'rechte':
        return this.rechteSetzen();
      case 'wechselGruppe':
        return this.wechselGruppeAnlegen(this.uebergangZu(s));
      case 'routine':
        return this.routine(this.uebergangZu(s));
      case 'regelnWechselGruppe':
        return this.regelnSchreiben(this.wechselGruppeZu(this.uebergangZu(s)));
      case 'statusWechselGruppe':
        return this.statusSetzen(this.wechselGruppeZu(this.uebergangZu(s)));
      case 'regelnStufe':
        return this.regelnSchreiben(this.stufeZu(s));
      case 'statusStufe':
        return this.statusSetzen(this.stufeZu(s));
      case 'regelnEntfernen':
        return this.regelnEntfernen(s.ziel.art === 'altGruppe' ? s.ziel.gruppeId : 0);
      case 'neuBerechnen':
        return this.neuBerechnen(this.wechselGruppeZu(this.uebergangZu(s)));
      case 'speichern':
        return this.einrichtungSpeichern();
    }
  }

  // ── Ziele ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private uebergangZu(s: PlanSchritt): Uebergang {
    const z = s.ziel;
    const u =
      z.art === 'uebergang'
        ? this.wege.find(
            (x) => x.von.gruppeId === z.vonGruppeId && x.nach.gruppeId === z.nachGruppeId,
          )
        : undefined;
    if (!u) throw fehl('Der Übergang gehört nicht mehr zu den Stufen.');
    return u;
  }

  private wechselGruppeZu(u: Uebergang): number {
    const id = this.wg.get(u.von.gruppeId);
    if (id === undefined)
      throw fehl(
        `Die Wechsel-Gruppe „${wechselGruppenName(u)}“ gibt es noch nicht. Sie entsteht beim Einrichten („Stufen ändern → Änderungen schreiben“).`,
      );
    return id;
  }

  private stufeZu(s: PlanSchritt): number {
    if (s.ziel.art !== 'stufe') throw fehl('Die Stufe gehört nicht mehr zur Einrichtung.');
    return s.ziel.gruppeId;
  }

  // ── Typ und Rechte ──────────────────────────────────────────────────────────────────────────────────────────────

  /** Die Nummer des Gruppentyps „Gruppenwechsel“ – bei mehreren gleichen die kleinste. `null`: gibt es nicht. */
  private async typSuchen(): Promise<{ id: number | null; sortKeyMax: number }> {
    const typen = await liste<{ id?: unknown; name?: unknown; sortKey?: unknown }>(
      this.port,
      '/group/grouptypes',
      'Die Liste der Gruppentypen',
    );
    const ids = typen
      .filter((t) => istWechselTyp(t.name))
      .map((t) => ctId(t.id))
      .filter((x): x is number => x !== null);
    const sortKeys = typen.map((t) => t.sortKey).filter((k): k is number => typeof k === 'number');
    return {
      id: ids.length ? Math.min(...ids) : null,
      sortKeyMax: sortKeys.length ? Math.max(...sortKeys) : 0,
    };
  }

  private async typId(): Promise<number> {
    if (this.typNr !== null) return this.typNr;
    const { id } = await this.typSuchen();
    if (id === null) throw fehl(`Den Gruppentyp „${WECHSEL_TYP_NAME}“ gibt es nicht.`);
    this.typNr = id;
    return id;
  }

  /** Die Rollen eines Gruppentyps aus `GET /group/roles` (`id` = `groupTypeRoleId`, `isLeader`). */
  private async typRollen(
    typId: number,
  ): Promise<{ leiter: number | null; teilnehmer: number | null }> {
    const rollen = await liste<{
      id?: unknown;
      groupTypeId?: unknown;
      isLeader?: unknown;
      isHidden?: unknown;
      isDefault?: unknown;
    }>(this.port, '/group/roles', 'Die Rollen der Gruppentypen');
    const vomTyp = rollen.filter((r) => ctId(r.groupTypeId) === typId && r.isHidden !== true);
    const waehle = (leiter: boolean) => {
      const passend = vomTyp.filter((r) => (r.isLeader === true) === leiter);
      const w = passend.find((r) => r.isDefault === true) ?? passend[0];
      return w ? ctId(w.id) : null;
    };
    return { leiter: waehle(true), teilnehmer: waehle(false) };
  }

  private async typAnlegen(): Promise<Ausgang> {
    const da = await this.typSuchen();
    if (da.id === null) {
      // Vorläufig – vor O9-6 an der Test-Instanz gemessen (O9-0: `POST /group/grouptypes`); die Rollen Teilnehmer und
      // Leiter entstehen von selbst. Keine Beiträge, kein Pflicht-Leiter, nicht für neue Personen.
      await this.port.schicken('/group/grouptypes', 'POST', {
        name: WECHSEL_TYP_NAME,
        namePlural: WECHSEL_TYP_NAME,
        shorty: 'GW',
        postsEnabled: false,
        isLeaderNecessary: false,
        availableForNewPerson: false,
        permissionDepth: 1,
        sortKey: da.sortKeyMax + 1,
        color: 'gray',
        description:
          'Angelegt von der Erweiterung „Organigramm“: Wechsel-Gruppen für den Gruppenwechsel der Kinder.',
      });
    }
    this.typNr = null;
    const typId = await this.typId();
    const r = await this.typRollen(typId);
    if (r.leiter === null || r.teilnehmer === null)
      throw fehl(
        `Der Gruppentyp „${WECHSEL_TYP_NAME}“ steht in ChurchTools, hat aber nicht beide Rollen (Leiter und Teilnehmer).`,
      );
    return { art: 'ok', text: 'nachgelesen: Typ mit den Rollen Leiter und Teilnehmer' };
  }

  private async rechteSetzen(): Promise<Ausgang> {
    const typId = await this.typId();
    const { leiter } = await this.typRollen(typId);
    if (leiter === null) throw fehl(`Der Typ „${WECHSEL_TYP_NAME}“ hat keine Rolle „Leiter“.`);
    const pfad = `/permissions/group_type_role/${leiter}`;
    const vorher = await liste<RechtRoh>(this.port, pfad, 'Die Rechte der Rolle „Leiter“');
    // Nur ergänzen, nie entziehen: Was jemand von Hand zusätzlich gesetzt hat, bleibt.
    for (const r of fehlendeLeiterRechte(vorher))
      await this.port.schicken(pfad, 'PUT', {
        authId: r.authId,
        ...(r.dataId === null ? {} : { dataId: [r.dataId] }),
      });
    const nachher = await liste<RechtRoh>(this.port, pfad, 'Die Rechte der Rolle „Leiter“');
    const fehlt = fehlendeLeiterRechte(nachher);
    if (fehlt.length > 0)
      throw fehl(
        `ChurchTools hat ${fehlt.map((r) => `„${r.name}“`).join(', ')} nicht übernommen. Bitte noch einmal versuchen.`,
      );
    return { art: 'ok', text: `nachgelesen: ${LEITER_RECHTE.length} Rechte an der Rolle „Leiter“` };
  }

  // ── Wechsel-Gruppen ─────────────────────────────────────────────────────────────────────────────────────────────

  private async wechselGruppeAnlegen(u: Uebergang): Promise<Ausgang> {
    const name = wechselGruppenName(u);
    if (this.wg.has(u.von.gruppeId)) return { art: 'ok', text: 'gibt es schon' };
    const typId = await this.typId();
    const bereich = this.soll.bereichGruppeId;
    // Wiederholen darf nie eine zweite Gruppe für denselben Übergang anlegen: Eine, die der letzte Versuch angelegt, aber
    // nicht mehr eingetragen hat, wird übernommen.
    const waisen = waiseKandidaten({
      name,
      bereichId: bereich,
      typIds: new Set([typId]),
      gruppen: this.gruppen,
      eltern: this.eltern,
      benutzt: new Set(this.wg.values()),
    });
    if (waisen.length > 1)
      throw fehl(
        `Unter dem Bereich gibt es ${waisen.length} Gruppen „${name}“ (${waisen.map((g) => g.id).join(', ')}). Welche gemeint ist, lässt sich nicht erraten – bitte in ChurchTools die überzähligen entfernen.`,
      );
    let id: number;
    let uebernommen = false;
    if (waisen.length === 1) {
      id = waisen[0].id;
      uebernommen = true;
    } else {
      const antwort = await this.port.schicken('/groups', 'POST', {
        name,
        groupTypeId: typId,
        groupStatusId: 1,
        parentGroupId: bereich,
        visibility: 'hidden',
      });
      const neu = nummerAus(antwort);
      if (neu === null)
        throw fehl(
          `ChurchTools hat „${name}“ angenommen, aber keine Nummer geliefert. „Nochmal versuchen“ findet die Gruppe wieder und legt keine zweite an.`,
        );
      id = neu;
    }
    // Nachlesen: Typ, Name und Obergruppe müssen so dastehen.
    const gelesen = await this.port.holen<GruppeRoh | null>(`/groups/${id}`);
    if (!gelesen || gelesen.name !== name || ctId(gelesen.information?.groupTypeId) !== typId)
      throw fehl(`ChurchTools zeigt „${name}“ nicht mit dem Typ „${WECHSEL_TYP_NAME}“.`);
    const hier = await this.port.holen<unknown>('/groups/hierarchies');
    if (!Array.isArray(hier)) throw unlesbar('Die Hierarchie der Gruppen');
    const obergruppen = elternAus(hier as RohHierarchie[]).get(id) ?? [];
    if (!obergruppen.includes(bereich))
      throw fehl(`„${name}“ hängt in ChurchTools nicht unter der gewählten Bereichsgruppe.`);
    this.wg.set(u.von.gruppeId, id);
    this.gruppen = [
      ...this.gruppen.filter((g) => g.id !== id),
      { id, name, typId, statusId: 1, farbe: null },
    ];
    this.eltern.set(id, obergruppen);
    // Sofort eintragen: Bricht es danach ab, kennt die Einrichtung die Gruppe schon.
    try {
      await this.speichern();
    } catch (x) {
      const f = fehlerSortieren(x);
      throw new SchrittFehler(
        f.grund,
        `Die Gruppe „${name}“ (Nummer ${id}) ist angelegt, die Einrichtung ließ sich aber nicht speichern: ${f.text} „Nochmal versuchen“ übernimmt die Gruppe, es entsteht keine zweite.`,
      );
    }
    return {
      art: 'ok',
      text: uebernommen
        ? 'nachgelesen: eine schon angelegte Gruppe übernommen, versteckt'
        : 'nachgelesen: versteckt unter der Bereichsgruppe',
    };
  }

  // ── Einrichtung speichern ───────────────────────────────────────────────────────────────────────────────────────

  /** Die Einrichtung, wie sie jetzt gespeichert werden soll: das Soll mit allen bisher bekannten Wechsel-Gruppen. */
  private inhalt(): Einrichtung {
    return {
      einstellung: this.soll.einstellung,
      bereichGruppeId: this.soll.bereichGruppeId,
      wechselGruppen: this.wege.flatMap((u) => {
        const gruppeId = this.wg.get(u.von.gruppeId);
        return gruppeId === undefined
          ? []
          : [{ vonGruppeId: u.von.gruppeId, nachGruppeId: u.nach.gruppeId, gruppeId }];
      }),
    };
  }

  /** Speichern mit der gelesenen Version; wirft einen `SchrittFehler` (Konflikt heißt: nichts überschrieben). */
  private async speichern(): Promise<boolean> {
    const inhalt = this.inhalt();
    // Nichts speichern, was die Erweiterung selbst nicht wieder lesen könnte.
    if (einrichtungAus(inhalt) === null) throw fehl('Die Einrichtung hat kein gültiges Format.');
    if (this.gespeichert && gleicheEinrichtung(this.gespeichert, inhalt)) return false;
    const r = await this.a.speichern(inhalt, this.version, this.e.von);
    if (r.ok) {
      this.gespeichert = inhalt;
      this.version = r.daten?.version ?? this.version;
      return true;
    }
    switch (r.grund) {
      case 'konflikt':
        throw fehl(
          'Jemand anderes hat die Einrichtung inzwischen geändert. Es wurde nichts überschrieben.',
        );
      case 'abgemeldet':
        throw new SchrittFehler('abgelehnt', 'Du bist bei ChurchTools nicht mehr angemeldet.');
      case 'kein-recht':
        throw new SchrittFehler(
          'abgelehnt',
          'Dir fehlt in ChurchTools das Recht, die Einrichtung zu speichern (Kategorie „Gruppenwechsel“ ändern).',
        );
      case 'voruebergehend':
        throw new SchrittFehler('voruebergehend', VORUEBERGEHEND);
      case 'nicht-angekommen':
        throw fehl(
          'ChurchTools hat die Einrichtung nicht übernommen. Bitte noch einmal versuchen.',
        );
      case 'zu-gross':
        throw fehl('Die Einrichtung ist zu groß für den Speicher von ChurchTools.');
    }
  }

  private async einrichtungSpeichern(): Promise<Ausgang> {
    const geschrieben = await this.speichern();
    return { art: 'ok', text: geschrieben ? 'nachgelesen' : 'steht schon so da' };
  }

  // ── Routine ─────────────────────────────────────────────────────────────────────────────────────────────────────

  private async rollenDerGruppe(id: number): Promise<RolleRoh[]> {
    return liste<RolleRoh>(this.port, `/groups/${id}/roles`, 'Die Rollen der Gruppe');
  }

  private async wechselRollen(id: number): Promise<WechselRollen> {
    const r = rollenAus(await this.rollenDerGruppe(id));
    if (r.teilnehmer === null || r.leiter === null)
      throw fehl('Die Wechsel-Gruppe hat nicht beide Rollen (Leiter und Teilnehmer).');
    return { teilnehmer: r.teilnehmer, leiter: r.leiter };
  }

  private async routine(u: Uebergang): Promise<Ausgang> {
    const gruppe = this.wechselGruppeZu(u);
    const rollen = await this.wechselRollen(gruppe);
    const { neu, schritte } = aufraeumRoutine(u, gruppe, rollen, this.soll.einstellung);
    const pfad = `/groups/${gruppe}/members/routines`;
    const vorhanden = (
      await liste<RoutineRoh & { id?: unknown }>(this.port, pfad, 'Die Routinen')
    ).find(
      (r) => ctId(r.groupTypeRoleId) === rollen.teilnehmer && r.groupMemberStatus === 'active',
    );
    if (!vorhanden) {
      const antwort = await this.port.schicken('/routines', 'POST', neu);
      const id = nummerAus(antwort);
      if (id === null)
        throw fehl('ChurchTools hat die Routine angenommen, aber keine Nummer geliefert.');
      await this.port.schicken(`/routines/${id}`, 'PATCH', { steps: schritte });
    } else {
      const id = ctId(vorhanden.id);
      if (id === null) throw fehl('Die vorhandene Routine hat in ChurchTools keine Nummer.');
      const name = vorhanden.routine?.name;
      if (typeof name === 'string' && !name.startsWith('Gruppenwechsel '))
        throw fehl(
          `In „${wechselGruppenName(u)}“ gibt es schon eine andere Routine („${name}“). Die Erweiterung lässt sie stehen – bitte in ChurchTools ansehen.`,
        );
      // Schritte mit ihrer Nummer mitschicken: So bleiben laufende Abläufe an ihrer Stelle (A9, gemessen).
      const alt = Array.isArray(vorhanden.routine?.steps)
        ? (vorhanden.routine.steps as { id?: unknown; actionKey?: unknown }[])
        : [];
      const mitNummer = schritte.map((s) => {
        const da = alt.find((x) => x.actionKey === s.actionKey && ctId(x.id) !== null);
        return da ? { ...s, id: ctId(da.id) as number } : s;
      });
      await this.port.schicken(`/routines/${id}`, 'PATCH', { isEnabled: true, steps: mitNummer });
    }
    const nachher = await liste<RoutineRoh>(this.port, pfad, 'Die Routinen');
    const daten: EinrichtungDaten = {
      rollen: new Map([[gruppe, { ok: true, wert: await this.rollenDerGruppe(gruppe) }]]),
      routinen: new Map([[gruppe, { ok: true, wert: nachher }]]),
      rechte: { leiter: { ok: false }, teilnehmer: { ok: false } },
      gruppen: new Map(),
    };
    const b = routineBefund(this.soll.einstellung, u, gruppe, daten);
    if (b.art === 'problem')
      throw fehl(
        `Die Routine in „${wechselGruppenName(u)}“ steht nach dem Schreiben noch so da: ${b.text}.`,
      );
    if (b.art !== 'ok')
      throw fehl(
        `Die Routine in „${wechselGruppenName(u)}“ ist nach dem Schreiben nicht zu finden.`,
      );
    return {
      art: 'ok',
      text: `nachgelesen: wartet ${this.soll.einstellung.aufraeumenTage} Tage, trägt dann aus`,
    };
  }

  // ── Regeln und Status ───────────────────────────────────────────────────────────────────────────────────────────

  /** Alle Regeln aller Gruppen – einmal gerechnet, mit den Rollen aus ChurchTools (nach dem Anlegen aller Wechsel-Gruppen). */
  private async sollRegeln(): Promise<Map<number, Regel[]>> {
    if (this.regelnMemo) return this.regelnMemo;
    const ersteWg = this.wege.map((u) => this.wg.get(u.von.gruppeId)).find((x) => x !== undefined);
    if (ersteWg === undefined) throw fehl('Es gibt noch keine Wechsel-Gruppe.');
    const rollen = await this.wechselRollen(ersteWg);
    const teilnehmer = new Map<number, number>();
    for (const u of this.wege) {
      const r = teilnehmerRolleAus(await this.rollenDerGruppe(u.nach.gruppeId));
      if (r === null) throw fehl(`„${u.nach.name}“ hat keine Rolle „Teilnehmer“.`);
      teilnehmer.set(u.nach.gruppeId, r);
    }
    this.regelnMemo = alleRegeln(this.soll.einstellung, this.jahre, this.wg, rollen, teilnehmer);
    return this.regelnMemo;
  }

  private async regelnSetzen(
    id: number,
    regeln: readonly Regel[] | readonly RegelRoh[],
  ): Promise<void> {
    await this.port.schicken(`/dynamicgroups/${id}/ruleset`, 'PUT', {
      dynamicGroupRuleSet: regeln,
    });
    const r = await regelnLesen((p) => this.port.holen(p), id);
    if (!r.ok) throw unlesbar('Die Regeln der Gruppe');
    // Zeichen für Zeichen (O9-5a: ChurchTools gibt sie byte-genau zurück).
    if (!gleich(r.wert, regeln))
      throw fehl(
        'ChurchTools zeigt nach dem Schreiben andere Regeln als geschrieben. Bitte noch einmal versuchen.',
      );
  }

  private async regelnSchreiben(id: number): Promise<Ausgang> {
    const regeln = (await this.sollRegeln()).get(id) ?? [];
    await this.regelnSetzen(id, regeln);
    return {
      art: 'ok',
      text: `nachgelesen: Wechseltage ${this.jahre.map((j) => j.jahr).join(', ')}`,
    };
  }

  private async statusSetzen(id: number, status: 'active' | 'none' = 'active'): Promise<Ausgang> {
    await this.port.schicken(`/dynamicgroups/${id}/status`, 'PUT', { dynamicGroupStatus: status });
    const s = statusAus(await this.port.holen<unknown>(`/dynamicgroups/${id}/status`));
    if (s !== status)
      throw fehl(
        `ChurchTools zeigt den Status „${s ?? 'unbekannt'}“ statt „${status}“. Bitte noch einmal versuchen.`,
      );
    return { art: 'ok', text: `nachgelesen: Status „${status === 'active' ? 'aktiv' : 'aus'}“` };
  }

  /** Unsere Regeln aus einer Gruppe nehmen, die keine Stufe (oder Wechsel-Gruppe) mehr ist; fremde bleiben. */
  private async regelnEntfernen(id: number): Promise<Ausgang> {
    const r = await regelnLesen((p) => this.port.holen(p), id);
    if (!r.ok) throw unlesbar('Die Regeln der Gruppe');
    const rest = r.wert.filter((x) => !istUnsere(x));
    if (rest.length === r.wert.length) return { art: 'ok', text: 'keine Regeln von uns mehr' };
    await this.regelnSetzen(id, rest);
    if (rest.length === 0) await this.statusSetzen(id, 'none');
    return { art: 'ok', text: 'nachgelesen: unsere Regeln entfernt, fremde bleiben' };
  }

  private async neuBerechnen(id: number): Promise<Ausgang> {
    const antwort = await this.port.schicken(`/dynamicgroups/${id}/refresh`, 'POST');
    const zeilen = Array.isArray(antwort) ? (antwort as Record<string, unknown>[]) : [];
    const meine = zeilen.find((z) => ctId(z.groupId) === id);
    // Die Antwort ist hier der einzige Beleg, dass gerechnet wurde.
    if (!meine) throw fehl('ChurchTools hat nicht gemeldet, dass die Gruppe neu berechnet wurde.');
    const n = (k: string) => (typeof meine[k] === 'number' ? meine[k] : 0);
    return {
      art: 'ok',
      text: 'neu berechnet',
      zahlen: { created: n('created'), updated: n('updated'), deleted: n('deleted') },
    };
  }
}
