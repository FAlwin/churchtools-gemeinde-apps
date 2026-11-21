/**
 * **Mit KI füllen – die Regeln** (Bauplan S8-1, Entwurf `s8-ki-v1`, abgenommen 16.11.2026). Ohne Oberfläche: das Fenster
 * (S8-2) ruft nur diese Funktionen.
 *
 * Der Weg, ein Schritt je Funktion:
 * 1. `tagesordnung` – alle Punkte und Unterpunkte mit der Nummer, wie sie im Protokoll steht (`punktNummer`), feste Punkte
 *    (Verweis-Block in ihrem Abschnitt) als „nichts zuordnen“.
 * 2. `auftragBauen` – der Text für die KI. Er bekommt das **schon ersetzte** Transkript: Namen ersetzt der Aufrufer vorher
 *    mit `namenFinden` + `platzhalterAnwenden` (`platzhalter.ts`), hier wird nichts mehr gesucht.
 * 3. `antwortLesen` – die Antwort der KI: tolerant beim Drumherum (Codeblock, Text davor und danach, `nr` als Zahl oder
 *    „3.“), streng bei den Typen (falsch Getyptes wird verworfen). Namen kommen über `zuruecksetzen` zurück. Wirft nie:
 *    kaputt oder ohne JSON → `{ ok: false, meldung }` mit verständlichem deutschem Text.
 *    Ein neuer Punkt (`neue_punkte`) trägt neben Stichpunkten auch Beschlüsse, To-Dos und Termine – gelesen mit denselben
 *    Regeln wie die Einträge mit `nr` (17.11.2026: ein leeres Protokoll ließ sich sonst nicht füllen).
 * 4. `uebernahmePlanen` – aus den angehakten Einträgen eine Liste `{ vor, bloecke }` für `EditorGriff.einfuegen`.
 *
 * **Vorhandener Text (W12, 21.11.2026):** Hat jemand in der Sitzung schon geschrieben, bekommt die KI diese Zeilen mit einer
 * Kennung (`Z1`, `Z2` …, `vorhandeneZeilen`). Sie wiederholt sie nicht als Stichpunkt und nennt bei einem Beschluss, To-Do
 * oder Termin die Zeile(n), die er ersetzt (`ersetzt`), oder unter welche er gehört (`nach`). `antwortLesen` macht daraus
 * `ZeilenBezug` (mit Block-ID und dem Text von damals), `uebernahmePlanen` setzt den Baustein an die Stelle der Zeile –
 * und ändert nie etwas, was inzwischen anders dasteht. Stichpunkte, die schon dastehen, trägt `doppelt` (Regel:
 * `doppelt.ts`).
 *
 * Wohin etwas kommt: hinter den eigenen Text seines Punkts, also **vor den nächsten Punkt** – hat „3.“ Unterpunkte, vor
 * 3.1 (Alwin 16.11.2026, Fund aus TF-PROT-12: hinter 3.2 zählte es zu 3.2); beim letzten Punkt ans Dokumentende
 * (`vor: null`, im Editor vor die leere Schlusszeile). Gerechnet wird mit der Punktliste aus `ableiten` – derselben wie die
 * Nummern.
 */
import {
  ableiten,
  BLOCK,
  punktNummer,
  terminDatum,
  textAus,
  type Block,
  type Punkt,
} from './dokument';
import { aehnlicheZeile } from './doppelt';
import {
  istPlatzhalter,
  platzhalterAnwenden,
  platzhalterIn,
  zuruecksetzen,
  type Fund,
  type Person,
} from './platzhalter';

export interface TagesordnungPunkt {
  blockId: string;
  /** `3.` beim Tagesordnungspunkt, `3.1` beim Unterpunkt – wie im Protokoll (`punktNummer`). */
  nummer: string;
  tiefe: number;
  titel: string;
  /** Der Abschnitt enthält einen festen Punkt (Verweis-Block): füllt sich selbst, die KI soll nichts zuordnen. */
  fest: boolean;
}

/** Alle Punkte und Unterpunkte in der Reihenfolge des Dokuments. */
export function tagesordnung(dokument: readonly Block[]): TagesordnungPunkt[] {
  const punkte = ableiten(dokument).punkte;
  const ids = new Set(punkte.map((p) => p.blockId));
  const hatVerweis = (b: Block): boolean =>
    b.type === BLOCK.verweis || (b.children ?? []).some(hatVerweis);
  const fest = new Set<string>();
  let aktuell: string | null = null;
  for (const b of dokument) {
    if (ids.has(b.id)) aktuell = b.id;
    if (aktuell && hatVerweis(b)) fest.add(aktuell);
  }
  return punkte.map((p) => ({
    blockId: p.blockId,
    nummer: punktNummer(p),
    tiefe: p.tiefe,
    titel: p.titel,
    fest: fest.has(p.blockId),
  }));
}

/** Blockarten, die als „vorhandener Text“ zählen: Absatz, Aufzählung, Nummerierung (Bausteine, Tabellen, Überschriften nicht). */
const ZEILEN_ARTEN: ReadonlySet<string> = new Set([
  'paragraph',
  'bulletListItem',
  'numberedListItem',
]);

/** Eine Zeile, die schon im Protokoll steht – mit der Kennung, unter der die KI sie nennen kann. */
export interface Zeile {
  /** `Z1`, `Z2` … – eindeutig im ganzen Dokument, in der Reihenfolge des Dokuments. */
  kennung: string;
  blockId: string;
  /** Der Text der Zeile (getrimmt, Zeilenumbrüche als Leerzeichen). */
  text: string;
  /** Wie tief sie eingerückt ist (0 = oberste Ebene). */
  ebene: number;
  /** Block-ID des Punkts, unter dem sie steht. */
  punktId: string;
  /** Hat sie Unterblöcke? (Dann wird sie nie entfernt.) */
  kinder: boolean;
}

/** Die ID als Kennung: `3`, `z3`, `Z 3`, ` Z3 ` → `Z3`; nichts Brauchbares → `''`. */
export function kennungNormal(x: unknown): string {
  const s = typeof x === 'number' ? String(x) : typeof x === 'string' ? x : '';
  const m = /^\s*z?\s*(\d+)\s*$/i.exec(s);
  return m ? `Z${Number(m[1])}` : '';
}

/**
 * **Die Zeilen, die schon im Protokoll stehen** – je Punkt und Unterpunkt (ohne feste Punkte, ohne Text vor dem ersten
 * Punkt), Absätze und Aufzählungen auch eingerückt, in der Reihenfolge des Dokuments. Leere Zeilen zählen nicht. Die EINE
 * Quelle der Kennungen: `auftragBauen` schreibt sie in den Auftrag, `antwortLesen` und `uebernahmePlanen` lösen sie damit
 * wieder auf.
 */
export function vorhandeneZeilen(dokument: readonly Block[]): Zeile[] {
  const punkte = tagesordnung(dokument);
  const ids = new Set(punkte.map((p) => p.blockId));
  const fest = new Set(punkte.filter((p) => p.fest).map((p) => p.blockId));
  const aus: Zeile[] = [];
  let punktId: string | null = null;
  const besuche = (b: Block, ebene: number, punkt: string): void => {
    const t = textAus(b.content).replace(/\s+/g, ' ').trim();
    if (ZEILEN_ARTEN.has(b.type) && t)
      aus.push({
        kennung: `Z${aus.length + 1}`,
        blockId: b.id,
        text: t,
        ebene,
        punktId: punkt,
        kinder: (b.children ?? []).length > 0,
      });
    for (const k of b.children ?? []) besuche(k, ebene + 1, punkt);
  };
  for (const b of dokument) {
    if (ids.has(b.id)) punktId = b.id;
    else if (punktId && !fest.has(punktId)) besuche(b, 0, punktId);
  }
  return aus;
}

const WOCHENTAGE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

/** `2026-11-18` → „Mittwoch, 18.11.2026“ (damit die KI „bis nächsten Freitag“ rechnen kann). Kein gültiges Datum → unverändert. */
export function datumMitWochentag(iso: string): string {
  const d = terminDatum({ datum: iso });
  if (!d) return iso;
  const wochentag = WOCHENTAGE[new Date(`${d}T12:00:00Z`).getUTCDay()];
  return `${wochentag}, ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

/**
 * **Der Text, in dem nach Namen gesucht wird** (`namenFinden`): Transkript, Titel der Tagesordnung, Gruppenname UND die
 * vorhandenen Zeilen (W12) – alles, was `auftragBauen` an die KI schickt. Eine Stelle, damit nichts ungeprüft hinausgeht
 * und die Platzhalter überall dieselben sind.
 */
export function namenSuchtext(a: {
  gruppe: string;
  transkript: string;
  dokument: readonly Block[];
}): string {
  return [
    a.transkript,
    ...tagesordnung(a.dokument).map((p) => p.titel),
    ...vorhandeneZeilen(a.dokument).map((z) => z.text),
    a.gruppe,
  ].join('\n');
}

/**
 * **Der Auftrag an die KI.** `transkript` ist schon ersetzt (Platzhalter statt Namen). Mit `funde` werden zusätzlich die
 * Titel der Tagesordnung ersetzt – ein Punkt heißt manchmal „Andacht Peter“, und `namenFinden` sieht nur das Transkript.
 * Dasselbe gilt für die **vorhandenen Zeilen** (W12): Auch dort kann ein Name stehen. Der Aufrufer sucht darum in
 * Transkript, Titeln UND vorhandenen Zeilen (`vorhandeneZeilen`) nach Namen – mit denselben Funden, damit ein Platzhalter
 * überall derselbe ist und beim Lesen der Antwort zurückgesetzt wird.
 */
export function auftragBauen(a: {
  gruppe: string;
  /** Tag der Sitzung, `JJJJ-MM-TT`. */
  datum: string;
  dokument: readonly Block[];
  transkript: string;
  funde?: readonly Fund[];
}): string {
  const datum = datumMitWochentag(a.datum);
  const ersetzt = (t: string): string => (a.funde ? platzhalterAnwenden(t, a.funde).text : t);
  const punkte = tagesordnung(a.dokument);
  const vorhanden = vorhandeneZeilen(a.dokument);
  // Die Zeilen, die schon dastehen, gehen durch denselben Namensschutz wie Titel und Transkript.
  const textZeilen = (punktId: string): string[] =>
    vorhanden
      .filter((z) => z.punktId === punktId)
      .map((z) => `${'  '.repeat(z.ebene + 1)}${z.kennung} ${ersetzt(z.text)}`);
  const zeilen = punkte.length
    ? punkte.flatMap((p) => [
        `${p.nummer} ${ersetzt(p.titel) || '(ohne Titel)'}${p.fest ? ' (fester Punkt – nichts zuordnen)' : ''}`,
        ...textZeilen(p.blockId),
      ])
    : [
        '(keine Tagesordnung – gliedere den Inhalt selbst in sinnvolle Punkte unter „neue_punkte“, Beschlüsse, To-Dos und Termine dort beim jeweiligen Punkt)',
      ];
  const mitText = vorhanden.length > 0;
  const regelVorhanden = mitText
    ? `
Unter manchen Punkten steht schon Text, den jemand in der Sitzung geschrieben hat – jede Zeile trägt eine Kennung (Z1, Z2 …). Wiederhole diese Zeilen nicht als Stichpunkt. Wird aus einer vorhandenen Zeile ein Beschluss, To-Do oder Termin, nenne ihre Kennung(en) in "ersetzt" (z. B. "ersetzt":["Z3"]) – die Zeile wird dann durch den Baustein ersetzt. Gehört ein neuer Stichpunkt oder Baustein direkt unter eine vorhandene Zeile, schreibe "nach":"Z2". Nenne nur Kennungen, die unter demselben Punkt stehen wie der Eintrag.`
    : '';
  const beispiel = mitText
    ? `{"punkte":[{"nr":"3.1","stichpunkte":["…"],"nach":"Z2"}],"beschluesse":[{"nr":"3","text":"…","ersetzt":["Z3"]}],"todos":[{"nr":"3.2","text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT","ersetzt":["Z4","Z5"]}],"termine":[{"nr":"4","datum":"JJJJ-MM-TT","text":"…","nach":"Z6"}],"neue_punkte":[{"titel":"…","stichpunkte":["…"],"beschluesse":["…"],"todos":[{"text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"datum":"JJJJ-MM-TT","text":"…"}]}]}`
    : `{"punkte":[{"nr":"3.1","stichpunkte":["…"]}],"beschluesse":[{"nr":"3","text":"…"}],"todos":[{"nr":"3.2","text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"nr":"4","datum":"JJJJ-MM-TT","text":"…"}],"neue_punkte":[{"titel":"…","stichpunkte":["…"],"beschluesse":["…"],"todos":[{"text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"datum":"JJJJ-MM-TT","text":"…"}]}]}`;
  return `Du bekommst das Transkript einer Sitzung der Gruppe „${ersetzt(a.gruppe)}“ vom ${datum}.
Personen und vertrauliche Angaben sind durch Platzhalter wie [Person 1] oder [Vertraulich 1] ersetzt. Verwende genau diese Platzhalter und erfinde keine Namen.

Tagesordnung (nr = Nummer des Punkts):
${zeilen.join('\n')}

Ordne den Inhalt diesen Punkten zu – so fein wie möglich, also auch den Unterpunkten – und schreibe zu jedem Punkt knappe Stichpunkte auf Deutsch. Nimm nur auf, was im Transkript steht, und erfinde nichts – keine Namen, Zahlen oder Termine.
Rechne Angaben wie „bis nächsten Freitag“ vom Sitzungsdatum (${datum}) in ein Datum um.
Passt ein Thema zu keinem Punkt, schlage unter „neue_punkte“ einen neuen Punkt mit Titel vor.${regelVorhanden}
Antworte ausschließlich mit JSON in genau diesem Aufbau:
${beispiel}

Transkript:
${a.transkript}`;
}

/** Wohin ein Eintrag soll. */
export type Ziel =
  | { art: 'punkt'; blockId: string; nummer: string; titel: string }
  /** Die Nummer gibt es im Protokoll nicht (oder fehlt) – wird nicht übernommen. */
  | { art: 'unbekannt'; nr: string }
  /** Der Punkt füllt sich selbst – wird nicht übernommen. */
  | { art: 'fest'; blockId: string; nummer: string; titel: string };

/** Eine zuständige Person eines To-Dos. */
export interface Zustaendig {
  /** Mit Namen (Platzhalter schon zurückgesetzt). Ein Platzhalter ohne Namen kommt hier nicht vor (`Eintrag.offen`). */
  name: string;
  /** Person der Gruppe → Mitglied; sonst `null` (dann extern). */
  personId: number | null;
}

interface Basis {
  /** Stabil je Antwort (`stichpunkt-0` …) – für die Häkchen der Vorschau. */
  id: string;
}

/** Ein Beschluss – einzeln (`Eintrag`) oder in einem neuen Punkt. */
export interface BeschlussTeil {
  text: string;
}

/** Ein To-Do – einzeln (`Eintrag`) oder in einem neuen Punkt. */
export interface TodoTeil {
  text: string;
  wer: Zustaendig[];
  /** `JJJJ-MM-TT`; ungültiges Datum → `null`. */
  bis: string | null;
  /**
   * Platzhalter, die als Zuständige genannt waren, aber keinem Namen zugeordnet sind – sie stehen NICHT in `wer`
   * (ein „[Person 1]“ ist kein externer Name). Fehlt, wenn es keine gab.
   */
  offen?: string[];
}

/** Ein Termin – einzeln (`Eintrag`) oder in einem neuen Punkt. */
export interface TerminTeil {
  text: string;
  /** `JJJJ-MM-TT`; ungültiges Datum → `null` (der Block hat dann kein Datum, die Leitung setzt es). */
  datum: string | null;
}

/** Eine vorhandene Zeile, auf die sich ein Eintrag bezieht – mit dem Text von damals (zum Wiedererkennen beim Übernehmen). */
export interface ZeilenBezug {
  kennung: string;
  blockId: string;
  text: string;
}

/** Wohin ein Eintrag zu den vorhandenen Zeilen gehört (W12) – nur gesetzt, wenn die KI es gesagt hat und es stimmt. */
interface Lage {
  /** Zeilen, die dieser Baustein ersetzt (nur Beschluss, To-Do, Termin). Fehlt, wenn keine. */
  ersetzt?: ZeilenBezug[];
  /** Die Zeile, unter die er gehört. */
  nach?: ZeilenBezug;
}

export type Eintrag =
  | (Basis & {
      art: 'stichpunkt';
      ziel: Ziel;
      text: string;
      /** Gehört unter diese Zeile. */
      nach?: ZeilenBezug;
      /** Steht schon da: die Zeile des Punkts, der dieser Stichpunkt entspricht (`doppelt.ts`). */
      doppelt?: ZeilenBezug;
    })
  | (Basis & { art: 'beschluss'; ziel: Ziel } & BeschlussTeil & Lage)
  | (Basis & { art: 'todo'; ziel: Ziel } & TodoTeil & Lage)
  | (Basis & { art: 'termin'; ziel: Ziel } & TerminTeil & Lage)
  | (Basis & {
      art: 'neuerPunkt';
      titel: string;
      stichpunkte: string[];
      /** Beschlüsse, To-Dos und Termine des neuen Punkts (17.11.2026) – leer bei einer Antwort im alten Format. */
      beschluesse: BeschlussTeil[];
      todos: TodoTeil[];
      termine: TerminTeil[];
    });

/** Kann der Eintrag ins Dokument? Nicht: unbekannter oder fester Punkt. */
export function uebernehmbar(e: Eintrag): boolean {
  return e.art === 'neuerPunkt' || e.ziel.art === 'punkt';
}

export type AntwortErgebnis = { ok: true; eintraege: Eintrag[] } | { ok: false; meldung: string };

/** Was `antwortLesen` zum Zurücksetzen der Namen und für die Zuständigen braucht. */
export interface AntwortKontext {
  dokument: readonly Block[];
  /** Platzhalter → Name, aus `platzhalterAnwenden`. */
  zuordnung: Readonly<Record<string, string>>;
  /** Die Funde aus `namenFinden` (mit `personId`). */
  funde: readonly Fund[];
  /** Die Personen der Gruppe – nur deren Platzhalter machen Mitglieder. */
  gruppe: readonly Person[];
}

const KEIN_JSON =
  'In der Antwort steht kein JSON. Bitte die ganze Antwort der KI einfügen – sie beginnt mit { und endet mit }. Sonst den Auftrag noch einmal abschicken.';
const KAPUTT =
  'Die Antwort ist kein lesbares JSON (oft fehlt der Anfang oder das Ende). Bitte die ganze Antwort der KI einfügen – oder die KI bitten, sie noch einmal nur als JSON zu schicken.';
const FALSCHER_AUFBAU =
  'Die Antwort hat nicht den erwarteten Aufbau (punkte, beschluesse, todos, termine, neue_punkte). Bitte die KI bitten, genau den Aufbau aus dem Auftrag zu verwenden.';
const LEER = 'In der Antwort steht nichts, was sich übernehmen lässt.';
const FELDER = ['punkte', 'beschluesse', 'todos', 'termine', 'neue_punkte'];

const istObjekt = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

function jsonObjekt(roh: string): Record<string, unknown> | 'keins' | 'kaputt' {
  const kandidaten: string[] = [];
  for (const m of roh.matchAll(/```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/g)) kandidaten.push(m[1]);
  const a = roh.indexOf('{');
  const b = roh.lastIndexOf('}');
  if (a >= 0 && b > a) kandidaten.push(roh.slice(a, b + 1));
  if (!roh.includes('{')) return 'keins';
  for (const k of kandidaten) {
    const s = k.slice(k.indexOf('{'), k.lastIndexOf('}') + 1);
    try {
      const o: unknown = JSON.parse(s);
      if (istObjekt(o)) return o;
    } catch {
      // nächster Kandidat
    }
  }
  return 'kaputt';
}

/** „3“, „3.“, „Punkt 3.1“, `3.1` (Zahl) → `3` / `3.1`; nichts Brauchbares → `''`. */
function nrNormal(x: unknown): string {
  const s = typeof x === 'number' ? String(x) : typeof x === 'string' ? x : '';
  return s
    .trim()
    .replace(/^(?:punkt|top)\s*/i, '')
    .replace(/\.+$/, '');
}

const text = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
/** Ein Stichpunkt ohne führendes „- “ oder „• “ (manche KI schreibt sie mit). */
const ohneAufzaehlung = (s: string): string => s.replace(/^[-•*–]\s+/, '').trim();
const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : x === undefined ? [] : [x]);
const eintraegeVon = (x: unknown): Record<string, unknown>[] =>
  (Array.isArray(x) ? x : []).filter(istObjekt);

/** **Antwort der KI lesen** – siehe Dateikopf. */
export function antwortLesen(roh: string, k: AntwortKontext): AntwortErgebnis {
  const o = jsonObjekt(roh);
  if (o === 'keins') return { ok: false, meldung: KEIN_JSON };
  if (o === 'kaputt') return { ok: false, meldung: KAPUTT };
  if (!FELDER.some((f) => f in o)) return { ok: false, meldung: FALSCHER_AUFBAU };

  const punkte = tagesordnung(k.dokument);
  const ziel = (nrRoh: unknown): Ziel => {
    const nr = nrNormal(nrRoh);
    const p = punkte.find((x) => nrNormal(x.nummer) === nr);
    if (!nr || !p) return { art: 'unbekannt', nr };
    const ort = { blockId: p.blockId, nummer: p.nummer, titel: p.titel };
    return p.fest ? { art: 'fest', ...ort } : { art: 'punkt', ...ort };
  };
  const zurueck = (s: string): string => zuruecksetzen(s, k.zuordnung);

  // Vorhandene Zeilen (W12): Kennung → Zeile. Eine Kennung gilt nur für einen Eintrag desselben Punkts; eine ersetzte
  // Zeile ersetzt nur der ERSTE Eintrag, der sie nennt (`vergeben`).
  const zeilen = vorhandeneZeilen(k.dokument);
  const vergeben = new Set<string>();
  const bezug = (z: Zeile): ZeilenBezug => ({
    kennung: z.kennung,
    blockId: z.blockId,
    text: z.text,
  });
  const zeileIn = (z: Ziel, roh: unknown): Zeile | null => {
    const kennung = kennungNormal(roh);
    if (!kennung || z.art !== 'punkt') return null;
    return zeilen.find((x) => x.kennung === kennung && x.punktId === z.blockId) ?? null;
  };
  const lage = (z: Ziel, d: Record<string, unknown>): Lage => {
    if (z.art !== 'punkt' || !zeilen.length) return {};
    const ersetzt: ZeilenBezug[] = [];
    for (const roh of liste(d.ersetzt)) {
      const zeile = zeileIn(z, roh);
      if (!zeile || vergeben.has(zeile.kennung) || ersetzt.some((e) => e.kennung === zeile.kennung))
        continue;
      ersetzt.push(bezug(zeile));
    }
    for (const e of ersetzt) vergeben.add(e.kennung);
    const nach = zeileIn(z, d.nach);
    return { ...(ersetzt.length ? { ersetzt } : {}), ...(nach ? { nach: bezug(nach) } : {}) };
  };

  const gruppeIds = new Set(k.gruppe.map((p) => p.id));
  const vollerName = (p: Person): string => `${p.vorname.trim()} ${p.nachname.trim()}`.trim();
  const zustaendig = (wRoh: string): Zustaendig => {
    const w = wRoh.trim();
    const name = zurueck(w);
    const fund = k.funde.find(
      (f) => f.platzhalter === w && f.personId !== undefined && gruppeIds.has(f.personId),
    );
    if (fund?.personId !== undefined) return { name, personId: fund.personId };
    // Die KI hat einen Namen geschrieben (etwa weil der Fund nicht ersetzt wurde): voller Name der Gruppe → Mitglied.
    const treffer = k.gruppe.filter((p) => vollerName(p) === name);
    if (treffer.length === 1) return { name, personId: treffer[0].id };
    return { name, personId: null };
  };

  // Beschluss, To-Do und Termin lesen – für die Einträge mit `nr` UND für die Inhalte eines neuen Punkts (EINE Regel).
  const beschlussTeil = (t: string): BeschlussTeil | null => (t ? { text: zurueck(t) } : null);
  const todoTeil = (d: Record<string, unknown>): TodoTeil | null => {
    const t = text(d.text);
    if (!t) return null;
    const alle = liste(d.wer)
      .filter((w): w is string => typeof w === 'string' && !!w.trim())
      .map(zustaendig);
    // Ein Platzhalter ohne Namen („[Person 1]“) ist kein Zuständiger – schon gar kein externer Name.
    const offen = [...new Set(alle.filter((z) => istPlatzhalter(z.name)).map((z) => z.name))];
    return {
      text: zurueck(t),
      wer: alle.filter((z) => !istPlatzhalter(z.name)),
      bis: typeof d.bis === 'string' ? terminDatum({ datum: d.bis.trim() }) : null,
      ...(offen.length ? { offen } : {}),
    };
  };
  const terminTeil = (m: Record<string, unknown>): TerminTeil | null => {
    const t = text(m.text);
    if (!t) return null;
    return {
      text: zurueck(t),
      datum: typeof m.datum === 'string' ? terminDatum({ datum: m.datum.trim() }) : null,
    };
  };

  const eintraege: Eintrag[] = [];
  const n = { stichpunkt: 0, beschluss: 0, todo: 0, termin: 0, neuerPunkt: 0 };
  const id = (art: keyof typeof n): string => `${art}-${n[art]++}`;

  for (const p of eintraegeVon(o.punkte))
    for (const s of liste(p.stichpunkte)) {
      // Ein Stichpunkt ist Text – oder, tolerant, `{"text":"…","nach":"Z2"}`; `nach` an der Gruppe gilt für alle darin.
      const einzeln = istObjekt(s) ? s : null;
      const t =
        typeof s === 'string'
          ? ohneAufzaehlung(s)
          : einzeln
            ? ohneAufzaehlung(text(einzeln.text))
            : '';
      if (!t) continue;
      const z = ziel(p.nr);
      const nach = zeileIn(z, einzeln?.nach ?? p.nach);
      const klar = zurueck(t);
      const gleich =
        z.art === 'punkt'
          ? aehnlicheZeile(
              klar,
              zeilen.filter((x) => x.punktId === z.blockId),
            )
          : null;
      eintraege.push({
        id: id('stichpunkt'),
        art: 'stichpunkt',
        ziel: z,
        text: klar,
        ...(nach ? { nach: bezug(nach) } : {}),
        ...(gleich ? { doppelt: bezug(gleich) } : {}),
      });
    }
  for (const b of eintraegeVon(o.beschluesse)) {
    const t = beschlussTeil(text(b.text));
    if (!t) continue;
    const z = ziel(b.nr);
    eintraege.push({ id: id('beschluss'), art: 'beschluss', ziel: z, ...t, ...lage(z, b) });
  }
  for (const d of eintraegeVon(o.todos)) {
    const t = todoTeil(d);
    if (!t) continue;
    const z = ziel(d.nr);
    eintraege.push({ id: id('todo'), art: 'todo', ziel: z, ...t, ...lage(z, d) });
  }
  for (const m of eintraegeVon(o.termine)) {
    const t = terminTeil(m);
    if (!t) continue;
    const z = ziel(m.nr);
    eintraege.push({ id: id('termin'), art: 'termin', ziel: z, ...t, ...lage(z, m) });
  }
  for (const q of eintraegeVon(o.neue_punkte)) {
    const titel = text(q.titel);
    if (!titel) continue;
    eintraege.push({
      id: id('neuerPunkt'),
      art: 'neuerPunkt',
      titel: zurueck(titel),
      stichpunkte: liste(q.stichpunkte)
        .map((s) => (typeof s === 'string' ? ohneAufzaehlung(s) : ''))
        .filter(Boolean)
        .map(zurueck),
      // Beschlüsse als Text oder – tolerant – als `{"text":"…"}`.
      beschluesse: liste(q.beschluesse)
        .map((x) =>
          beschlussTeil(typeof x === 'string' ? x.trim() : istObjekt(x) ? text(x.text) : ''),
        )
        .filter((x) => x !== null),
      todos: eintraegeVon(q.todos)
        .map(todoTeil)
        .filter((x) => x !== null),
      termine: eintraegeVon(q.termine)
        .map(terminTeil)
        .filter((x) => x !== null),
    });
  }

  return eintraege.length ? { ok: true, eintraege } : { ok: false, meldung: LEER };
}

/**
 * **Platzhalter, die in der Vorschau noch stehen** (Name nicht zugeordnet) – in den Texten der Einträge und bei den
 * Zuständigen, die deshalb fehlen. Jeder einmal, in der Reihenfolge der Einträge.
 */
export function offenePlatzhalter(eintraege: readonly Eintrag[]): string[] {
  const todoTexte = (d: TodoTeil): string[] => [
    d.text,
    ...d.wer.map((w) => w.name),
    ...(d.offen ?? []),
  ];
  const texte = eintraege.flatMap((e) =>
    e.art === 'neuerPunkt'
      ? [
          e.titel,
          ...e.stichpunkte,
          ...e.beschluesse.map((b) => b.text),
          ...e.todos.flatMap(todoTexte),
          ...e.termine.map((t) => t.text),
        ]
      : e.art === 'todo'
        ? todoTexte(e)
        : [e.text],
  );
  return platzhalterIn(texte.join('\n'));
}

/**
 * Eine Einfügung für `EditorGriff.einfuegungen` – alle zusammen in EINER Transaktion (ein „Rückgängig“ macht alles zurück).
 *
 * - `vor` – vor diesen Block (oberste Ebene **oder** eingerückt, gleiche Ebene wie er); `null` = ans Ende (vor die leere
 *   Schlusszeile). Mit `entfernen` (W12) ist das die Stelle der ersten ersetzten Zeile.
 * - `nach` (W12) – direkt hinter diesen Block, als Geschwister (hat Vorrang vor `vor`).
 * - `entfernen` (W12) – diese Blöcke nach dem Einfügen entfernen (die ersetzten Zeilen; nie eine mit Unterblöcken).
 *
 * Gibt es den Block nicht mehr, kommt der Inhalt wie früher ans Ende – und `entfernen` fasst dann nichts an.
 */
export interface Einfuegung {
  vor: string | null;
  bloecke: Block[];
  nach?: string;
  entfernen?: string[];
}

const inhalt = (t: string): unknown[] => [{ type: 'text', text: t, styles: {} }];

/**
 * **Die Einfügestelle eines Punkts:** der nächste Punkt danach, welcher Stufe auch immer – sonst `null` (Dokumentende).
 * Hat der Punkt Unterpunkte, kommt sein Inhalt also **vor den ersten Unterpunkt** (Alwin 16.11.2026, Fund aus
 * TF-PROT-12): Dahinter zählte er zum letzten Unterpunkt (Bereiche, PDF). Ohne Unterpunkte ist das der nächste Punkt
 * gleicher oder höherer Stufe – das Ende des Punkts.
 */
export function einfuegeStelleKI(punkte: readonly Punkt[], blockId: string): string | null {
  const i = punkte.findIndex((p) => p.blockId === blockId);
  if (i < 0) return null;
  return punkte[i + 1]?.blockId ?? null;
}

/** Der Block mit dieser ID, auch eingerückt. */
function blockFinden(dokument: readonly Block[], id: string): Block | null {
  for (const b of dokument) {
    if (b.id === id) return b;
    const k = blockFinden(b.children ?? [], id);
    if (k) return k;
  }
  return null;
}

/** Was `uebernahmePlanen` zusätzlich wissen kann. */
export interface UebernahmeOptionen {
  /** Einträge (`Eintrag.id`), bei denen der Haken „Zeile ersetzen“ weg ist: Die Zeile bleibt, der Baustein kommt darunter. */
  ersetzenAus?: ReadonlySet<string>;
}

/**
 * **Übernahme planen.** `gewaehlt` sind die angehakten Einträge (der Aufrufer filtert). Rückgabe:
 * - `einfuegungen` – in der Reihenfolge, in der sie auszuführen sind (alle in einer Transaktion, `Einfuegung`):
 *   1. **An einer Zeile verankert (W12):** Ein Baustein mit `ersetzt` kommt **an die Stelle der ersten ersetzten Zeile**
 *      (gleiche Ebene) und die ersetzten Zeilen fallen weg; eine Zeile **mit Unterblöcken wird nie entfernt** (der Baustein
 *      kommt dann darunter), ebenso bleibt die Zeile, wenn der Haken fehlt (`ersetzenAus`). Mit `nach` – oder wenn nichts zu
 *      ersetzen ist – hinter die genannte Zeile. **Nie Text verlieren:** Eine Zeile, die inzwischen anders dasteht (anderer
 *      Text) oder weg ist, wird nicht angefasst; der Baustein kommt dann wie früher ans Ende seines Punkts.
 *      Was hinter eine Zeile gehört, die ein anderer Baustein ersetzt, folgt diesem Baustein.
 *   2. **Ans Ende des Punkts, wie bisher:** je Ziel-Punkt ein Aufruf mit Stichpunkten (Aufzählung), Beschlüssen, To-Dos und
 *      Terminen in dieser Reihenfolge, vor den nächsten Punkt (`einfuegeStelleKI`). Später im Dokument zuerst – gehen der
 *      letzte Punkt und die neuen Punkte beide ans Ende, steht der Punkt so vor den neuen.
 *   3. Die neuen Punkte zuletzt (`vor: null`, Tagesordnungspunkt mit Stichpunkten); „Ende“ heißt im Editor: vor die leere
 *      Schlusszeile (`vorSchlusszeilen`).
 * - `uebersprungen` – Einträge ohne gültiges Ziel (unbekannter/fester Punkt, oder der Punkt ist seit dem Lesen der
 *   Antwort aus dem Dokument verschwunden).
 *
 * To-Do-Blöcke tragen `props.vorab` (Wer/Bis, Format `Vorab`) und keine To-Do-ID – angelegt wird beim Speichern.
 */
export function uebernahmePlanen(
  gewaehlt: readonly Eintrag[],
  dokument: readonly Block[],
  neueId: () => string,
  optionen: UebernahmeOptionen = {},
): { einfuegungen: Einfuegung[]; uebersprungen: Eintrag[] } {
  const punkte = ableiten(dokument).punkte;
  const uebersprungen: Eintrag[] = [];
  const jePunkt = new Map<string, Block[][]>(); // blockId → [stichpunkte, beschluesse, todos, termine]
  const neue: Block[] = [];

  const block = (type: string, t: string, props?: Record<string, unknown>): Block => ({
    id: neueId(),
    type,
    ...(props ? { props } : {}),
    content: inhalt(t),
    children: [],
  });
  const stichpunkt = (t: string): Block => block('bulletListItem', t);
  // Die Blöcke der drei Arten – für einzelne Einträge UND für die Inhalte eines neuen Punkts (EINE Erzeugung).
  const beschlussBlock = (b: BeschlussTeil): Block => block(BLOCK.beschluss, b.text);
  const todoBlock = (d: TodoTeil): Block => {
    const wer = [...new Set(d.wer.flatMap((w) => (w.personId === null ? [] : [w.personId])))];
    const extern = [...new Set(d.wer.flatMap((w) => (w.personId === null ? [w.name] : [])))].join(
      ', ',
    );
    const vorab = wer.length || extern || d.bis ? JSON.stringify({ wer, extern, bis: d.bis }) : '';
    return block(BLOCK.aufgabe, d.text, { aufgabe: '', vorab });
  };
  const terminBlock = (t: TerminTeil): Block =>
    block(BLOCK.termin, t.text, { datum: t.datum ?? '' });
  const bausteinVon = (e: Exclude<Eintrag, { art: 'neuerPunkt' }>): Block =>
    e.art === 'stichpunkt'
      ? stichpunkt(e.text)
      : e.art === 'beschluss'
        ? beschlussBlock(e)
        : e.art === 'todo'
          ? todoBlock(e)
          : terminBlock(e);

  // ── Zeilen: was gilt noch? ─────────────────────────────────────────────────
  // Eine ersetzte Zeile zählt nur, wenn sie noch da ist und noch denselben Text hat – sonst bliebe nur zu raten, ob es
  // dieselbe Zeile ist, und geraten wird nicht mit Text, der verloren gehen kann.
  const nochDa = (z: ZeilenBezug): Block | null => {
    const b = blockFinden(dokument, z.blockId);
    return b && textAus(b.content).replace(/\s+/g, ' ').trim() === z.text ? b : null;
  };
  /** Reihenfolge der Blöcke im Dokument – für „die erste“ und „die letzte“ ersetzte Zeile. */
  const lage = new Map<string, number>();
  const nummeriere = (bs: readonly Block[]): void => {
    for (const b of bs) {
      lage.set(b.id, lage.size);
      nummeriere(b.children ?? []);
    }
  };
  nummeriere(dokument);
  const nachDokument = (a: ZeilenBezug, b: ZeilenBezug): number =>
    (lage.get(a.blockId) ?? 0) - (lage.get(b.blockId) ?? 0);

  type Baustein = Exclude<Eintrag, { art: 'neuerPunkt' }>;
  interface Anker {
    /** Ort: `vor` der Block, vor den eingefügt wird (ersetzen) – oder `nach` der Block, hinter den. */
    ort: { vor: string } | { nach: string };
    entfernen: string[];
    bloecke: Block[];
  }
  const anker = new Map<string, Anker>(); // Schlüssel `vor:<id>` / `nach:<id>`
  const reihenfolge: string[] = [];
  /** Block-ID einer ersetzten Zeile → Schlüssel des Ankers, der sie ersetzt (dorthin folgt, was „nach“ ihr gehört). */
  const ersetztVon = new Map<string, string>();
  const nachFolger: { e: Baustein; nach: ZeilenBezug }[] = [];

  const ankerHolen = (schluessel: string, ort: Anker['ort']): Anker => {
    let a = anker.get(schluessel);
    if (!a) {
      a = { ort, entfernen: [], bloecke: [] };
      anker.set(schluessel, a);
      reihenfolge.push(schluessel);
    }
    return a;
  };
  const amEnde = (e: Baustein, punktId: string): void => {
    const gruppen = jePunkt.get(punktId) ?? [[], [], [], []];
    jePunkt.set(punktId, gruppen);
    const b = bausteinVon(e);
    if (e.art === 'stichpunkt') gruppen[0].push(b);
    else if (e.art === 'beschluss') gruppen[1].push(b);
    else if (e.art === 'todo') gruppen[2].push(b);
    else gruppen[3].push(b);
  };

  for (const e of gewaehlt) {
    if (e.art === 'neuerPunkt') {
      // Stufe 1 = Tagesordnungspunkt (`punktEbene`); darunter Stichpunkte, Beschlüsse, To-Dos, Termine wie bei einem
      // vorhandenen Punkt.
      neue.push(
        block('heading', e.titel, { level: 1 }),
        ...e.stichpunkte.map(stichpunkt),
        ...e.beschluesse.map(beschlussBlock),
        ...e.todos.map(todoBlock),
        ...e.termine.map(terminBlock),
      );
      continue;
    }
    const ziel = e.ziel;
    if (ziel.art !== 'punkt' || !punkte.some((p) => p.blockId === ziel.blockId)) {
      uebersprungen.push(e);
      continue;
    }

    // Verankert an einer Zeile? Erst `ersetzt`, dann `nach`.
    const ersetzt = e.art === 'stichpunkt' ? [] : (e.ersetzt ?? []);
    const gueltig = ersetzt.filter((z) => nochDa(z)).sort(nachDokument);
    if (gueltig.length) {
      const entfernbar =
        optionen.ersetzenAus?.has(e.id) === true
          ? []
          : gueltig.filter((z) => (nochDa(z)?.children ?? []).length === 0);
      const b = bausteinVon(e);
      if (entfernbar.length) {
        const a = ankerHolen(`vor:${entfernbar[0].blockId}`, { vor: entfernbar[0].blockId });
        a.bloecke.push(b);
        a.entfernen.push(...entfernbar.map((z) => z.blockId));
        for (const z of entfernbar) ersetztVon.set(z.blockId, `vor:${entfernbar[0].blockId}`);
      } else {
        // Die Zeile bleibt (Haken weg oder Unterblöcke): der Baustein kommt darunter.
        const letzte = gueltig[gueltig.length - 1];
        ankerHolen(`nach:${letzte.blockId}`, { nach: letzte.blockId }).bloecke.push(b);
      }
      continue;
    }
    if (e.nach && blockFinden(dokument, e.nach.blockId)) {
      nachFolger.push({ e, nach: e.nach });
      continue;
    }
    amEnde(e, ziel.blockId);
  }

  // „Nach einer Zeile“ – steht die Zeile nicht mehr (ein anderer Baustein hat sie ersetzt), folgt der Eintrag diesem Baustein.
  for (const { e, nach } of nachFolger) {
    const schluessel = ersetztVon.get(nach.blockId);
    const a = schluessel
      ? anker.get(schluessel)!
      : ankerHolen(`nach:${nach.blockId}`, { nach: nach.blockId });
    a.bloecke.push(bausteinVon(e));
  }

  const verankert: Einfuegung[] = reihenfolge.map((k) => {
    const a = anker.get(k)!;
    return 'vor' in a.ort
      ? { vor: a.ort.vor, bloecke: a.bloecke, entfernen: [...new Set(a.entfernen)] }
      : { vor: null, nach: a.ort.nach, bloecke: a.bloecke };
  });
  const einfuegungen: Einfuegung[] = [
    ...verankert,
    ...[...punkte]
      .reverse()
      .filter((p) => jePunkt.has(p.blockId))
      .map((p) => ({
        vor: einfuegeStelleKI(punkte, p.blockId),
        bloecke: jePunkt.get(p.blockId)!.flat(),
      })),
  ];
  if (neue.length) einfuegungen.push({ vor: null, bloecke: neue });
  return { einfuegungen, uebersprungen };
}
