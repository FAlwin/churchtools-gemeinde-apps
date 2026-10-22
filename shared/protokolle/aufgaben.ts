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
  art: 'angelegt' | 'status' | 'notiz' | 'geloescht';
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
