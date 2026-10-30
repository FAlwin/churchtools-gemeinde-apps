/**
 * Schreib-Payload für einen Ablaufpunkt in ChurchTools – die riskanteste reine Funktion des
 * Projekts (#212).
 *
 * **Warum das eigene Modul:** Die Funktion lag privat in `churchtools.ts` und war damit nur über
 * Netzwerk-Mocks erreichbar – sie hatte null Tests, obwohl seit #200 JEDES Speichern eines
 * Lied-Punkts darüber läuft. Seit #335 (Phase 3b) liegt sie in `shared/`: Die ChurchTools-Extension
 * schreibt den Ablauf aus dem Browser und braucht **dieselbe** Regel – eine zweite Fassung wäre genau
 * die Stelle, an der die Herabstufung unten wieder passiert.
 *
 * **Die Gefahr:** ChurchTools ignoriert ein verschachteltes `song`-Objekt und stuft den Punkt dann
 * **unwiderruflich auf `text` herab** – die Lied-Verknüpfung ist weg. Deshalb MUSS die
 * Verknüpfung als **top-level `arrangementId`** mitgeschickt werden, zusammen mit `type: 'song'`.
 */
import type { CtAgendaItem } from './typen';

export interface AgendaItemOverrides {
  title?: string;
  note?: string;
  position?: number;
  arrangementId?: number;
  unlink?: boolean;
  responsible?: string;
  /** Neue Dauer in Sekunden (CT-Einheit); überschreibt die bestehende. */
  durationSec?: number;
}

/**
 * Baut den Schreib-Payload aus den Live-Daten des Punkts plus den gewünschten Änderungen.
 *  - `responsible` bleibt Text (Personen-Zuordnungen in ChurchTools bleiben erhalten),
 *  - `arrangementId` wird **top-level** gesetzt (siehe Modul-Kommentar),
 *  - ohne `overrides` beschreibt das Ergebnis den unveränderten Punkt (wichtig beim Umsortieren:
 *    dort wird die ganze Liste zurückgeschrieben und darf nichts nebenbei verändern).
 */
export function agendaItemWritePayload(
  it: CtAgendaItem,
  overrides: AgendaItemOverrides = {},
): Record<string, unknown> {
  // Lied-Verknüpfung: ein übergebenes arrangementId hebt den Punkt auf type 'song' an
  // (verifiziert: PUT mit type 'song' + top-level arrangementId wandelt einen text-Punkt
  // sauber um, ohne Herabstufung); sonst bleibt eine vorhandene Verknüpfung erhalten.
  // unlink=true löst die Verknüpfung wieder (verifiziert: type 'text' ohne arrangementId).
  const arrangementId = overrides.unlink
    ? undefined
    : (overrides.arrangementId ?? it.song?.arrangementId);
  const isSong = !overrides.unlink && (overrides.arrangementId !== undefined || !!it.song);
  return {
    title: overrides.title ?? it.title,
    type: isSong ? 'song' : overrides.unlink ? 'text' : it.type,
    note: overrides.note ?? it.note ?? '',
    duration: overrides.durationSec ?? it.duration ?? 0,
    // Wirkungslos, aber harmlos: ChurchTools leitet `isBeforeEvent` aus der Grenze ab und ignoriert
    // den Wert hier (gemessen 05.10.2026). Den Vorlauf setzt `vorlaufUmschalten` (#423).
    isBeforeEvent: it.isBeforeEvent ?? false,
    // responsible ist ein Textfeld; ChurchTools löst Dienst-Tokens wie „[Musik]" selbst
    // zu den im Dienstplan zugewiesenen Personen auf.
    responsible: overrides.responsible ?? it.responsible?.text ?? '',
    // Ohne dieses Feld leert ChurchTools beim Ändern die Notizen je Dienstgruppe (12.10.2026).
    serviceGroupNotes: dienstgruppenNotizen(it),
    ...(overrides.position !== undefined ? { position: overrides.position } : {}),
    ...(arrangementId ? { arrangementId } : {}),
  };
}

/** Die Notizen je Dienstgruppe in der Form, in der ChurchTools sie schreibend annimmt. */
export function dienstgruppenNotizen(it: CtAgendaItem): { serviceGroupId: number; note: string }[] {
  return (it.serviceGroupNotes ?? [])
    .filter((n) => typeof n.serviceGroupId === 'number' && !!n.note)
    .map((n) => ({ serviceGroupId: n.serviceGroupId, note: n.note }));
}

/**
 * **„Vor Gottesdienstbeginn“ umschalten – nur dieser eine Punkt wechselt die Seite** (Alwin, 30.10.2026). Bis dahin
 * (#423) wanderte nur die Grenze: Einschalten machte auch alle Punkte darüber zum Vorlauf, Ausschalten alle darunter
 * zum Gottesdienst.
 *
 * ChurchTools kennt keinen Vorlauf PRO PUNKT, sondern nur die Grenze `eventStartPosition`: Alles mit kleinerer
 * `position` ist Vorlauf. Deshalb rückt der Punkt an die Grenze, und die Grenze rückt um eins:
 *  - **an:** der Punkt kommt direkt ÜBER „Beginn“ (letzter Punkt des Vorlaufs), die Grenze eins nach unten,
 *  - **aus:** der Punkt kommt direkt UNTER „Beginn“ (erster Punkt des Gottesdienstes), die Grenze eins nach oben.
 * Alle anderen Punkte bleiben auf ihrer Seite und in ihrer Reihenfolge – bei Überschriften genauso (nur sie selbst,
 * Alwin 30.10.2026).
 *
 * `reihenfolge` ist `null`, wenn der Punkt schon direkt an der Grenze steht – dann genügt die Grenze. Das Ergebnis ist
 * `null`, wenn er schon auf der gewünschten Seite steht (etwa weil ein zweites Gerät ihn kurz vorher umgeschaltet hat)
 * oder fehlt: Dann gibt es nichts zu schreiben. Gerechnet wird wie beim Umsortieren mit dem Listenplatz; ob ein Punkt
 * Vorlauf ist, sagt seine `position`.
 */
export function vorlaufUmschalten(
  items: readonly Pick<CtAgendaItem, 'id' | 'position'>[],
  grenze: number,
  itemId: number,
  vorBeginn: boolean,
): { reihenfolge: number[] | null; grenze: number } | null {
  const stelle = items.findIndex((i) => i.id === itemId);
  if (stelle < 0) return null;
  const istVor = (it: Pick<CtAgendaItem, 'position'>, k: number) => (it.position ?? k) < grenze;
  if (istVor(items[stelle], stelle) === vorBeginn) return null;
  // Wie viele ANDERE Punkte Vorlauf sind – genau hinter ihnen steht der Punkt danach (an: als letzter Vorlauf-Punkt,
  // aus: als erster Punkt des Gottesdienstes).
  const vorlauf = items.filter((it, k) => k !== stelle && istVor(it, k)).length;
  const rest = items.filter((_, k) => k !== stelle).map((i) => i.id);
  const reihenfolge = [...rest.slice(0, vorlauf), itemId, ...rest.slice(vorlauf)];
  if (reihenfolge.every((id, k) => items[k].id === id)) {
    // Steht schon an der Grenze: nur sie rückt – an der `position` des Punkts, so wie ChurchTools sie misst.
    const position = items[stelle].position ?? stelle;
    return { reihenfolge: null, grenze: vorBeginn ? position + 1 : position };
  }
  // Nach dem Umsortieren ist `position` der Listenplatz (`ablaufUmsortieren`).
  return { reihenfolge, grenze: vorBeginn ? vorlauf + 1 : vorlauf };
}
