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
 * 4. `uebernahmePlanen` – aus den angehakten Einträgen eine Liste `{ vor, bloecke }` für `EditorGriff.einfuegen`.
 *
 * Wohin etwas kommt: ans **Ende des Abschnitts** seines Punkts, also vor den nächsten Punkt **gleicher oder höherer Stufe**
 * (bei „3.“ hinter 3.1 und 3.2), beim letzten Punkt ans Dokumentende (`vor: null`). Gerechnet wird mit `Punkt.tiefe` aus
 * `ableiten` – derselben Zählung wie die Nummern, auch wenn ein Dokument eine Ebene überspringt.
 */
import { ableiten, BLOCK, punktNummer, terminDatum, type Block, type Punkt } from './dokument';
import { platzhalterAnwenden, zuruecksetzen, type Fund, type Person } from './platzhalter';

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
 * **Der Auftrag an die KI.** `transkript` ist schon ersetzt (Platzhalter statt Namen). Mit `funde` werden zusätzlich die
 * Titel der Tagesordnung ersetzt – ein Punkt heißt manchmal „Andacht Peter“, und `namenFinden` sieht nur das Transkript.
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
  const zeilen = punkte.length
    ? punkte.map(
        (p) =>
          `${p.nummer} ${ersetzt(p.titel) || '(ohne Titel)'}${p.fest ? ' (fester Punkt – nichts zuordnen)' : ''}`,
      )
    : ['(noch keine Punkte – schlage neue Punkte vor)'];
  return `Du bekommst das Transkript einer Sitzung der Gruppe „${ersetzt(a.gruppe)}“ vom ${datum}.
Personen und vertrauliche Angaben sind durch Platzhalter wie [Person 1] oder [Vertraulich 1] ersetzt. Verwende genau diese Platzhalter und erfinde keine Namen.

Tagesordnung (nr = Nummer des Punkts):
${zeilen.join('\n')}

Ordne den Inhalt diesen Punkten zu – so fein wie möglich, also auch den Unterpunkten – und schreibe zu jedem Punkt knappe Stichpunkte auf Deutsch. Nimm nur auf, was im Transkript steht, und erfinde nichts – keine Namen, Zahlen oder Termine.
Rechne Angaben wie „bis nächsten Freitag“ vom Sitzungsdatum (${datum}) in ein Datum um.
Passt ein Thema zu keinem Punkt, schlage unter „neue_punkte“ einen neuen Punkt mit Titel vor.
Antworte ausschließlich mit JSON in genau diesem Aufbau:
{"punkte":[{"nr":"3.1","stichpunkte":["…"]}],"beschluesse":[{"nr":"3","text":"…"}],"todos":[{"nr":"3.2","text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"nr":"4","datum":"JJJJ-MM-TT","text":"…"}],"neue_punkte":[{"titel":"…","stichpunkte":["…"]}]}

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
  /** Mit Namen (Platzhalter schon zurückgesetzt) – oder, bei unbekanntem Platzhalter, der Platzhalter selbst. */
  name: string;
  /** Person der Gruppe → Mitglied; sonst `null` (dann extern). */
  personId: number | null;
}

interface Basis {
  /** Stabil je Antwort (`stichpunkt-0` …) – für die Häkchen der Vorschau. */
  id: string;
}

export type Eintrag =
  | (Basis & { art: 'stichpunkt'; ziel: Ziel; text: string })
  | (Basis & { art: 'beschluss'; ziel: Ziel; text: string })
  | (Basis & {
      art: 'todo';
      ziel: Ziel;
      text: string;
      wer: Zustaendig[];
      /** `JJJJ-MM-TT`; ungültiges Datum → `null`. */
      bis: string | null;
    })
  | (Basis & {
      art: 'termin';
      ziel: Ziel;
      text: string;
      /** `JJJJ-MM-TT`; ungültiges Datum → `null` (der Block hat dann kein Datum, die Leitung setzt es). */
      datum: string | null;
    })
  | (Basis & { art: 'neuerPunkt'; titel: string; stichpunkte: string[] });

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

  const eintraege: Eintrag[] = [];
  const n = { stichpunkt: 0, beschluss: 0, todo: 0, termin: 0, neuerPunkt: 0 };
  const id = (art: keyof typeof n): string => `${art}-${n[art]++}`;

  for (const p of eintraegeVon(o.punkte))
    for (const s of liste(p.stichpunkte)) {
      const t = typeof s === 'string' ? ohneAufzaehlung(s) : '';
      if (t)
        eintraege.push({
          id: id('stichpunkt'),
          art: 'stichpunkt',
          ziel: ziel(p.nr),
          text: zurueck(t),
        });
    }
  for (const b of eintraegeVon(o.beschluesse)) {
    const t = text(b.text);
    if (t)
      eintraege.push({ id: id('beschluss'), art: 'beschluss', ziel: ziel(b.nr), text: zurueck(t) });
  }
  for (const d of eintraegeVon(o.todos)) {
    const t = text(d.text);
    if (!t) continue;
    eintraege.push({
      id: id('todo'),
      art: 'todo',
      ziel: ziel(d.nr),
      text: zurueck(t),
      wer: liste(d.wer)
        .filter((w): w is string => typeof w === 'string' && !!w.trim())
        .map(zustaendig),
      bis: typeof d.bis === 'string' ? terminDatum({ datum: d.bis.trim() }) : null,
    });
  }
  for (const m of eintraegeVon(o.termine)) {
    const t = text(m.text);
    if (!t) continue;
    eintraege.push({
      id: id('termin'),
      art: 'termin',
      ziel: ziel(m.nr),
      text: zurueck(t),
      datum: typeof m.datum === 'string' ? terminDatum({ datum: m.datum.trim() }) : null,
    });
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
    });
  }

  return eintraege.length ? { ok: true, eintraege } : { ok: false, meldung: LEER };
}

/** Ein Aufruf von `EditorGriff.einfuegen(bloecke, vor)`. */
export interface Einfuegung {
  /** Block-ID, vor die eingefügt wird (oberste Ebene); `null` = ans Ende. */
  vor: string | null;
  bloecke: Block[];
}

const inhalt = (t: string): unknown[] => [{ type: 'text', text: t, styles: {} }];

/**
 * **Die Einfügestelle eines Punkts:** der nächste Punkt gleicher oder höherer Stufe (kleinere oder gleiche `tiefe`) nach
 * ihm – sonst `null` (Dokumentende). Unterpunkte bleiben also vor der Stelle.
 */
export function einfuegeStelleKI(punkte: readonly Punkt[], blockId: string): string | null {
  const i = punkte.findIndex((p) => p.blockId === blockId);
  if (i < 0) return null;
  return punkte.slice(i + 1).find((p) => p.tiefe <= punkte[i].tiefe)?.blockId ?? null;
}

/**
 * **Übernahme planen.** `gewaehlt` sind die angehakten Einträge (der Aufrufer filtert). Rückgabe:
 * - `einfuegungen` – in der Reihenfolge, in der `einfuegen` aufzurufen ist. Je Ziel-Punkt ein Aufruf mit
 *   Stichpunkten (Aufzählung), Beschlüssen, To-Dos und Terminen in dieser Reihenfolge. **Später im Dokument zuerst:** Wer
 *   einen Unterpunkt und seinen Punkt füllt, bekommt beide vor derselben Stelle – so landet der Punkt hinter den Inhalten
 *   des Unterpunkts. Die neuen Punkte kommen zuletzt (`vor: null`, Tagesordnungspunkt mit Stichpunkten).
 * - `uebersprungen` – Einträge ohne gültiges Ziel (unbekannter/fester Punkt, oder der Punkt ist seit dem Lesen der
 *   Antwort aus dem Dokument verschwunden).
 *
 * To-Do-Blöcke tragen `props.vorab` (Wer/Bis, Format `Vorab`) und keine To-Do-ID – angelegt wird beim Speichern.
 */
export function uebernahmePlanen(
  gewaehlt: readonly Eintrag[],
  dokument: readonly Block[],
  neueId: () => string,
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

  for (const e of gewaehlt) {
    if (e.art === 'neuerPunkt') {
      neue.push(block('heading', e.titel, { level: 1 }), ...e.stichpunkte.map(stichpunkt));
      continue;
    }
    const ziel = e.ziel;
    if (ziel.art !== 'punkt' || !punkte.some((p) => p.blockId === ziel.blockId)) {
      uebersprungen.push(e);
      continue;
    }
    const gruppen = jePunkt.get(ziel.blockId) ?? [[], [], [], []];
    jePunkt.set(ziel.blockId, gruppen);
    if (e.art === 'stichpunkt') gruppen[0].push(stichpunkt(e.text));
    else if (e.art === 'beschluss') gruppen[1].push(block(BLOCK.beschluss, e.text));
    else if (e.art === 'todo') {
      const wer = [...new Set(e.wer.flatMap((w) => (w.personId === null ? [] : [w.personId])))];
      const extern = [...new Set(e.wer.flatMap((w) => (w.personId === null ? [w.name] : [])))].join(
        ', ',
      );
      const vorab =
        wer.length || extern || e.bis ? JSON.stringify({ wer, extern, bis: e.bis }) : '';
      gruppen[2].push(block(BLOCK.aufgabe, e.text, { aufgabe: '', vorab }));
    } else gruppen[3].push(block(BLOCK.termin, e.text, { datum: e.datum ?? '' }));
  }

  const einfuegungen: Einfuegung[] = [...punkte]
    .reverse()
    .filter((p) => jePunkt.has(p.blockId))
    .map((p) => ({
      vor: einfuegeStelleKI(punkte, p.blockId),
      bloecke: jePunkt.get(p.blockId)!.flat(),
    }));
  if (neue.length) einfuegungen.push({ vor: null, bloecke: neue });
  return { einfuegungen, uebersprungen };
}
