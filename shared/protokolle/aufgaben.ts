/**
 * **To-Dos der Protokolle** (Bauplan S1/S7) – ein Wert je To-Do in der Kategorie „Mitarbeit“ der Gruppe, damit
 * Abhaken durch die Zuständigen das Protokoll nicht berührt.
 *
 * Entschieden 16.10.2026: Zuständige sind Personen der Gruppe; Externe nur als Name (ohne eigenen Zugriff).
 * Status offen → in Arbeit → erledigt, Fälligkeit, Verlauf mit Notizen.
 *
 * **Nie hart löschen** (S0, 22.10.2026): Wer in „Mitarbeit“ ändern darf, darf dort auch jeden Wert löschen –
 * ChurchTools kennt dafür kein eigenes Recht. Darum wird ein To-Do nur als gelöscht vermerkt; der Verlauf
 * zeigt, wer es war.
 */
export type AufgabenStatus = 'offen' | 'arbeit' | 'erledigt';

export interface VerlaufEintrag {
  /** ISO-Zeit. */
  am: string;
  von: number;
  art: 'angelegt' | 'status' | 'notiz' | 'geloescht' | 'wiederhergestellt';
  status?: AufgabenStatus;
  text?: string;
}

export interface Aufgabe {
  art: 'aufgabe';
  fassung: 1;
  /** Eigene ID (der Block im Protokoll verweist darauf, `props.aufgabe`). */
  id: string;
  gruppe: number;
  /** Sitzung, in der die Aufgabe entstand – `null` bei Aufgaben ohne Sitzung. */
  sitzung: string | null;
  text: string;
  wer: number[];
  /** Name einer Person außerhalb der Gruppe – nur Text. */
  extern: string;
  /** `JJJJ-MM-TT` oder `null`. */
  bis: string | null;
  status: AufgabenStatus;
  verlauf: VerlaufEintrag[];
  geloescht: boolean;
}

const FOLGE: Record<AufgabenStatus, AufgabenStatus> = {
  offen: 'arbeit',
  arbeit: 'erledigt',
  erledigt: 'offen',
};

/** **Wie ein Status heißt** – die eine Stelle dafür (Protokoll, Sitzung, Startseite, Suche). */
export function statusText(s: AufgabenStatus): string {
  return s === 'arbeit' ? 'in Arbeit' : s;
}

/** Der Kreis in der Liste: offen → in Arbeit → erledigt → wieder offen. */
export function naechsterStatus(s: AufgabenStatus): AufgabenStatus {
  return FOLGE[s];
}

export function neueAufgabe(a: {
  id: string;
  gruppe: number;
  sitzung: string | null;
  text: string;
  wer?: number[];
  extern?: string;
  bis?: string | null;
  von: number;
  am: string;
}): Aufgabe {
  return {
    art: 'aufgabe',
    fassung: 1,
    id: a.id,
    gruppe: a.gruppe,
    sitzung: a.sitzung,
    text: a.text.trim(),
    wer: [...new Set(a.wer ?? [])],
    extern: (a.extern ?? '').trim(),
    bis: a.bis ?? null,
    status: 'offen',
    verlauf: [{ am: a.am, von: a.von, art: 'angelegt' }],
    geloescht: false,
  };
}

/** Neuer Status mit Verlaufseintrag. Gleicher Status → unverändert zurück (kein doppelter Eintrag). */
export function statusSetzen(a: Aufgabe, status: AufgabenStatus, von: number, am: string): Aufgabe {
  if (a.status === status) return a;
  return { ...a, status, verlauf: [...a.verlauf, { am, von, art: 'status', status }] };
}

export function notizHinzufuegen(a: Aufgabe, text: string, von: number, am: string): Aufgabe {
  const t = text.trim();
  if (!t) return a;
  return { ...a, verlauf: [...a.verlauf, { am, von, art: 'notiz', text: t }] };
}

/** Als gelöscht vermerken – der Wert bleibt, der Verlauf zeigt, wer es war. */
export function alsGeloescht(a: Aufgabe, von: number, am: string): Aufgabe {
  if (a.geloescht) return a;
  return { ...a, geloescht: true, verlauf: [...a.verlauf, { am, von, art: 'geloescht' }] };
}

/** Wieder da (die Aufgabe steht wieder im Protokoll, etwa nach „Rückgängig“) – mit Verlaufseintrag. */
export function alsWiederhergestellt(a: Aufgabe, von: number, am: string): Aufgabe {
  if (!a.geloescht) return a;
  return { ...a, geloescht: false, verlauf: [...a.verlauf, { am, von, art: 'wiederhergestellt' }] };
}

/** Überfällig: nicht erledigt und das Datum liegt vor heute (`heute` als `JJJJ-MM-TT`, Ortszeit des Aufrufers). */
export function istUeberfaellig(a: Aufgabe, heute: string): boolean {
  return a.status !== 'erledigt' && a.bis !== null && a.bis < heute;
}

export function istMeine(a: Aufgabe, person: number): boolean {
  return !a.geloescht && a.wer.includes(person);
}

/** Wann zuletzt auf „erledigt“ gesetzt (ISO) – `null`, wenn nicht erledigt. */
export function erledigtAm(a: Aufgabe): string | null {
  if (a.status !== 'erledigt') return null;
  for (let i = a.verlauf.length - 1; i >= 0; i--) {
    const e = a.verlauf[i];
    if (e.art === 'status' && e.status === 'erledigt') return e.am;
  }
  return null;
}

export interface Gruppiert {
  ueberfaellig: Aufgabe[];
  arbeit: Aufgabe[];
  offen: Aufgabe[];
  erledigt: Aufgabe[];
}

const nachDatum = (x: Aufgabe, y: Aufgabe): number =>
  (x.bis ?? '9999-99-99').localeCompare(y.bis ?? '9999-99-99') ||
  x.text.localeCompare(y.text, 'de');

/**
 * **Die Liste wie im Entwurf**: überfällig zuerst, dann in Arbeit, offen, erledigt; innerhalb nach Fälligkeit
 * (ohne Datum zuletzt). Gelöschte fehlen; Erledigte zuletzt erledigt zuerst.
 */
export function gruppieren(liste: readonly Aufgabe[], heute: string): Gruppiert {
  const g: Gruppiert = { ueberfaellig: [], arbeit: [], offen: [], erledigt: [] };
  for (const a of liste) {
    if (a.geloescht) continue;
    if (istUeberfaellig(a, heute)) g.ueberfaellig.push(a);
    else if (a.status === 'arbeit') g.arbeit.push(a);
    else if (a.status === 'offen') g.offen.push(a);
    else g.erledigt.push(a);
  }
  g.ueberfaellig.sort(nachDatum);
  g.arbeit.sort(nachDatum);
  g.offen.sort(nachDatum);
  g.erledigt.sort((x, y) => (erledigtAm(y) ?? '').localeCompare(erledigtAm(x) ?? ''));
  return g;
}

/**
 * **Die offenen To-Dos** – alles, was nicht erledigt und nicht gelöscht ist, in der Reihenfolge von `gruppieren`
 * (überfällig, in Arbeit, offen; je nach Fälligkeit). Die eine Stelle dafür (Startseite: Zähler je Gruppe und „Meine“).
 */
export function offene(liste: readonly Aufgabe[], heute: string): Aufgabe[] {
  const g = gruppieren(liste, heute);
  return [...g.ueberfaellig, ...g.arbeit, ...g.offen];
}

/** **Meine offenen To-Dos** (Startseite, S3-3): die mir zugewiesenen unter `offene`. */
export function meineOffenen(liste: readonly Aufgabe[], ich: number, heute: string): Aufgabe[] {
  return offene(
    liste.filter((a) => istMeine(a, ich)),
    heute,
  );
}

/** „Seit der Sitzung am … erledigt“ – erledigt nach `seit` (ISO). */
export function erledigtSeit(liste: readonly Aufgabe[], seit: string): Aufgabe[] {
  return liste.filter((a) => {
    const am = erledigtAm(a);
    return !a.geloescht && am !== null && am > seit;
  });
}

/** Ist das ein To-Do-Wert von uns? Für alles, was aus dem Speicher kommt. */
export function istAufgabe(x: unknown): x is Aufgabe {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Aufgabe>;
  return (
    a.art === 'aufgabe' &&
    a.fassung === 1 &&
    typeof a.id === 'string' &&
    typeof a.gruppe === 'number' &&
    typeof a.text === 'string' &&
    Array.isArray(a.wer) &&
    (a.status === 'offen' || a.status === 'arbeit' || a.status === 'erledigt') &&
    Array.isArray(a.verlauf)
  );
}

/**
 * **Wer und Bis, bevor es das To-Do gibt** (K1, beim Durchklicken 28.10.2026: „Wer und Bis vor dem Inhalt bearbeiten“).
 * Ein To-Do entsteht erst mit Text (sonst stünde ein leeres To-Do bei den Zuständigen, und das nächste Speichern
 * vermerkte es als gelöscht). Bis dahin merkt sich der Aufgaben-Block die Wahl (`props.vorab`, JSON); beim Anlegen wird
 * sie übernommen – beim Speichern (`aufgabenAbgleich`) wie beim ersten Tipp auf den Status-Kreis (`vorabAnwenden`).
 */
export interface Vorab {
  wer: number[];
  extern: string;
  bis: string | null;
}

/** `props.vorab` lesen – leer oder kaputt → `null`. */
export function vorabLesen(x: unknown): Vorab | null {
  if (typeof x !== 'string' || !x) return null;
  try {
    const v = JSON.parse(x) as Partial<Vorab> | null;
    if (!v || typeof v !== 'object') return null;
    const wer = Array.isArray(v.wer) ? v.wer.filter((p): p is number => Number.isInteger(p)) : [];
    const extern = typeof v.extern === 'string' ? v.extern : '';
    const bis = typeof v.bis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.bis) ? v.bis : null;
    return wer.length || extern || bis ? { wer, extern, bis } : null;
  } catch {
    return null;
  }
}

/** Die Vorab-Wahl in ein (neues) To-Do übernehmen – die eine Stelle dafür. */
export function vorabAnwenden(a: Aufgabe, v: Vorab | null): Aufgabe {
  if (!v) return a;
  return { ...a, wer: [...new Set(v.wer)], extern: v.extern.trim(), bis: v.bis };
}

/** Was der Abgleich braucht – ein Block des Protokolls (`AufgabenEintrag` aus `ableiten`). */
interface Eintrag {
  aufgabe: string | null;
  text: string;
  /** Wer/Bis, gewählt bevor es das To-Do gab. */
  vorab?: Vorab | null;
}

/** Ein Block, wie er im Dokument steht – nur, was die ID-Vergabe braucht. */
interface IdBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: IdBlock[];
}

/**
 * **IDs für Aufgaben im Protokoll** (S4-2): Ein Aufgaben-Block ohne ID (neu, aus einer Vorlage) oder mit einer ID, die
 * schon ein früherer Block trägt (kopiert und eingefügt) oder die zu einer anderen Sitzung gehört (aus einem anderen
 * Protokoll eingefügt), bekommt eine neue – sonst teilten sich zwei Aufgaben ein To-Do. Ergebnis: welche Blöcke welche
 * ID bekommen; leer, wenn alles passt.
 */
export function aufgabenIdsVergeben(
  dokument: readonly IdBlock[],
  fremd: (id: string) => boolean,
  neueId: () => string,
): { blockId: string; aufgabe: string }[] {
  const gesehen = new Set<string>();
  const neu: { blockId: string; aufgabe: string }[] = [];
  const besuche = (b: IdBlock): void => {
    if (b.type === 'aufgabe') {
      const id = typeof b.props?.aufgabe === 'string' ? b.props.aufgabe : '';
      if (!id || gesehen.has(id) || fremd(id)) neu.push({ blockId: b.id, aufgabe: neueId() });
      else gesehen.add(id);
    }
    for (const k of b.children ?? []) besuche(k);
  };
  dokument.forEach(besuche);
  return neu;
}

export interface AufgabenPlan {
  /** Neue To-Do-Werte. */
  anlegen: Aufgabe[];
  /** Geänderte To-Dos (Text, gelöscht vermerkt, wiederhergestellt) – jeweils der neue Stand. */
  aendern: Aufgabe[];
}

/**
 * **Das Protokoll führt** (Alwin 24.10.2026, S4-2): Was muss in „Mitarbeit“ geschehen, damit die To-Dos dieser Sitzung zu
 * den Aufgaben im Protokoll passen?
 * - Aufgabe mit Text, aber noch kein To-Do → anlegen (Zuständige sehen es sofort), mit Wer/Bis von vorab (`Vorab`);
 * - Text im Protokoll geändert → Text im To-Do mit (Wer, Bis und Status bleiben – die gehören dem To-Do);
 * - To-Do dieser Sitzung, dessen Aufgabe nicht mehr im Protokoll steht → als gelöscht vermerkt (nie hart gelöscht);
 * - als gelöscht vermerkt, aber wieder im Protokoll (Rückgängig) → wiederhergestellt.
 * To-Dos anderer Sitzungen bleiben unberührt. Nichts zu tun → leere Listen (dann wird nichts geschrieben).
 */
export function aufgabenAbgleich(q: {
  eintraege: readonly Eintrag[];
  vorhanden: readonly Aufgabe[];
  gruppe: number;
  sitzung: string;
  von: number;
  am: string;
}): AufgabenPlan {
  const plan: AufgabenPlan = { anlegen: [], aendern: [] };
  const vorhanden = new Map(q.vorhanden.map((a) => [a.id, a]));
  const imProtokoll = new Set<string>();
  for (const e of q.eintraege) {
    if (!e.aufgabe || imProtokoll.has(e.aufgabe)) continue;
    imProtokoll.add(e.aufgabe);
    const a = vorhanden.get(e.aufgabe);
    const text = e.text.trim();
    if (!a) {
      plan.anlegen.push(
        vorabAnwenden(
          neueAufgabe({
            id: e.aufgabe,
            gruppe: q.gruppe,
            sitzung: q.sitzung,
            text,
            von: q.von,
            am: q.am,
          }),
          e.vorab ?? null,
        ),
      );
      continue;
    }
    if (a.sitzung !== q.sitzung) continue; // gehört einer anderen Sitzung – IDs vergibt `aufgabenIdsVergeben` neu
    let neu = alsWiederhergestellt(a, q.von, q.am);
    if (neu.text !== text) neu = { ...neu, text };
    if (neu !== a) plan.aendern.push(neu);
  }
  for (const a of q.vorhanden)
    if (a.sitzung === q.sitzung && !a.geloescht && !imProtokoll.has(a.id))
      plan.aendern.push(alsGeloescht(a, q.von, q.am));
  return plan;
}
