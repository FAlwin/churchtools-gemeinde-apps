/**
 * **To-Do-Vorschläge** (W9b, Alwin 20.11.2026): Ein Mitarbeiter schlägt der Gruppe ein To-Do vor, die Leitung übernimmt
 * oder lehnt ab. Der Vorschlag ist **derselbe Datensatz** wie ein To-Do (Kennzeichen `vorschlag`, siehe `ToDoVorschlag`):
 * Übernehmen nimmt nur das Kennzeichen weg und setzt die Zuständigen – nichts wird neu angelegt, der Verlauf bleibt.
 *
 * Hier stehen die Rechenregeln (Datensatz neu, ändern, übernehmen, ablehnen, zurückziehen, wer darf was, was der Bereich
 * „Vorgeschlagen“ zeigt). Gelesen und geschrieben wird in `protokolle/src/todoVorschlagSchreiben.ts`. **Nie hart löschen:**
 * Zurückziehen vermerkt den Datensatz als gelöscht (`geloescht`), der Verlauf sagt, wer es war.
 */
import { bearbeiten, neueAufgabe, toDoRechte, type Aufgabe, type ToDoAenderung } from './aufgaben';
import { abgelehnteSichtbar, ABGELEHNT_TAGE, tageNoch } from './vorschlaege';

export { ABGELEHNT_TAGE };

/** Wer gerade schreibt – Person und Vorname für den Verlauf. */
export interface Vorschlagender {
  person: number;
  name: string;
}

/** Die erste Notiz im Verlauf – bei einem Vorschlag das „Warum?“; `''`, wenn es keine gibt. */
export function warumVon(a: Pick<Aufgabe, 'verlauf'>): string {
  return a.verlauf.find((v) => v.art === 'notiz')?.text ?? '';
}

/**
 * **Ein neuer Vorschlag**: derselbe Datensatz wie ein To-Do, ohne Zuständige, mit Kennzeichen. Das „Warum?“ wird die erste
 * Notiz (und bleibt es, wenn die Leitung übernimmt).
 */
export function neuerToDoVorschlag(q: {
  id: string;
  gruppe: number;
  text: string;
  bis: string | null;
  warum: string;
  von: Vorschlagender;
  am: string;
}): Aufgabe {
  const a = neueAufgabe({
    id: q.id,
    gruppe: q.gruppe,
    sitzung: null,
    text: q.text,
    bis: q.bis,
    von: q.von.person,
    am: q.am,
  });
  const name = q.von.name.trim().split(' ')[0];
  const warum = q.warum.trim();
  return {
    ...a,
    verlauf: [
      { am: q.am, von: q.von.person, name, art: 'vorgeschlagen' },
      ...(warum ? [{ am: q.am, von: q.von.person, name, art: 'notiz' as const, text: warum }] : []),
    ],
    vorschlag: { stand: 'offen', von: q.von.person, name, am: q.am },
  };
}

/**
 * **Den eigenen Vorschlag ändern** (Text, Bis, Warum). Das „Warum?“ ist die erste Notiz: Sie wird ersetzt, ergänzt oder – leer
 * – entfernt. Nur solange er offen ist; sonst unverändert zurück.
 */
export function vorschlagAendern(
  a: Aufgabe,
  x: { text: string; bis: string | null; warum: string },
  von: Vorschlagender,
  am: string,
): Aufgabe {
  if (!a.vorschlag || a.vorschlag.stand !== 'offen' || a.geloescht) return a;
  const warum = x.warum.trim();
  const i = a.verlauf.findIndex((v) => v.art === 'notiz');
  let verlauf = [...a.verlauf];
  if (i >= 0) {
    if (!warum) verlauf.splice(i, 1);
    else verlauf[i] = { ...verlauf[i], text: warum };
  } else if (warum) {
    const name = von.name.trim().split(' ')[0];
    verlauf.push({ am, von: von.person, name, art: 'notiz', text: warum });
  }
  const text = x.text.trim() || a.text;
  const bis = x.bis || null;
  if (text === a.text && bis === a.bis && JSON.stringify(verlauf) === JSON.stringify(a.verlauf))
    return a;
  verlauf = [
    ...verlauf,
    { am, von: von.person, name: von.name.trim().split(' ')[0], art: 'vorschlagGeaendert' },
  ];
  return { ...a, text, bis, verlauf };
}

/**
 * **Übernehmen** (die Leitung): aus DEMSELBEN Datensatz wird ein normales To-Do – das Kennzeichen fällt weg, die Zuständigen
 * (und was die Leitung im Fenster sonst noch änderte, `x`) kommen dazu, der Verlauf bekommt „übernommen“. Kein Vorschlag
 * (mehr offen) → unverändert zurück.
 */
export function vorschlagUebernehmen(
  a: Aufgabe,
  x: ToDoAenderung,
  von: Vorschlagender,
  am: string,
): Aufgabe {
  if (!a.vorschlag || a.vorschlag.stand !== 'offen' || a.geloescht) return a;
  const n = bearbeiten(a, x, von.person, am);
  const { vorschlag: _weg, ...todo } = n;
  return {
    ...todo,
    verlauf: [
      ...n.verlauf,
      { am, von: von.person, name: von.name.trim().split(' ')[0], art: 'uebernommen' },
    ],
  };
}

/** **Ablehnen** (die Leitung): Stand `abgelehnt`, die Begründung (freiwillig) und der Zeitpunkt – sieben Tage sichtbar. */
export function vorschlagAblehnen(
  a: Aufgabe,
  grund: string,
  von: Vorschlagender,
  am: string,
): Aufgabe {
  if (!a.vorschlag || a.vorschlag.stand !== 'offen' || a.geloescht) return a;
  const g = grund.trim();
  return {
    ...a,
    vorschlag: { ...a.vorschlag, stand: 'abgelehnt', abgelehntAm: am, ...(g ? { grund: g } : {}) },
    verlauf: [
      ...a.verlauf,
      {
        am,
        von: von.person,
        name: von.name.trim().split(' ')[0],
        art: 'abgelehnt',
        ...(g ? { text: g } : {}),
      },
    ],
  };
}

/** **Zurückziehen** (wer vorschlug): als gelöscht vermerkt – nie hart gelöscht –, der Verlauf sagt es. */
export function vorschlagZurueckziehen(a: Aufgabe, von: Vorschlagender, am: string): Aufgabe {
  if (!a.vorschlag || a.vorschlag.stand !== 'offen' || a.geloescht) return a;
  return {
    ...a,
    geloescht: true,
    verlauf: [
      ...a.verlauf,
      { am, von: von.person, name: von.name.trim().split(' ')[0], art: 'zurueckgezogen' },
    ],
  };
}

/** Was mit einem Vorschlag geschehen soll. */
export type VorschlagTun = 'uebernehmen' | 'ablehnen' | 'aendern' | 'zurueckziehen';

/**
 * **Darf das mit diesem (frisch gelesenen) Vorschlag geschehen?** – `null` ja, sonst der Satz. **Die eine Regel** für den
 * Schreibweg und die Oberfläche; sie fußt auf `toDoRechte` (Fall `vorschlag`). Übernehmen und Ablehnen nur die Leitung;
 * Ändern und Zurückziehen nur, wer vorschlug – und alles nur, solange er offen ist.
 */
export function vorschlagVerboten(
  a: Aufgabe,
  tun: VorschlagTun,
  q: { ich: number; leitung: boolean },
): string | null {
  if (!a.vorschlag || a.vorschlag.stand !== 'offen' || a.geloescht)
    return 'Dieser Vorschlag ist nicht mehr offen – bitte neu laden.';
  const r = toDoRechte(a, q);
  const darf =
    tun === 'uebernehmen'
      ? r.uebernehmen
      : tun === 'ablehnen'
        ? r.ablehnen
        : tun === 'aendern'
          ? r.vorschlagAendern
          : r.zurueckziehen;
  if (darf) return null;
  return tun === 'uebernehmen' || tun === 'ablehnen'
    ? 'Das entscheidet nur die Leitung.'
    : 'Den Vorschlag ändert oder zieht nur zurück, wer ihn gemacht hat.';
}

/** Was der Bereich „Vorgeschlagen“ zeigt: wartende und – sieben Tage lang – abgelehnte. */
export interface VorschlaegeAnsicht {
  offen: Aufgabe[];
  abgelehnt: Aufgabe[];
}

/**
 * **Was ich im Bereich „Vorgeschlagen“ sehe** (W9b): die Leitung alle offenen Vorschläge der Gruppen, in denen sie Leitung ist
 * (`leitungIn`), dazu – wie jeder – die eigenen; Abgelehnte sieben Tage lang, nur die eigenen und die der Gruppen, in denen
 * ich Leitung bin, und nicht, wenn ich sie auf diesem Gerät ausgeblendet habe. Zurückgezogene (gelöscht) fehlen. Offene: der
 * älteste Vorschlag zuerst.
 */
export function vorschlaegeSichtbar(
  liste: readonly Aufgabe[],
  q: {
    ich: number;
    leitungIn: (gruppe: number) => boolean;
    heute: string;
    zeitzone: string;
    ausgeblendet?: readonly string[];
  },
): VorschlaegeAnsicht {
  const da = liste.filter((a) => a.vorschlag && !a.geloescht);
  const offen = da
    .filter(
      (a) =>
        a.vorschlag!.stand === 'offen' && (q.leitungIn(a.gruppe) || a.vorschlag!.von === q.ich),
    )
    .sort((x, y) => x.vorschlag!.am.localeCompare(y.vorschlag!.am));
  const abgelehnt = abgelehnteSichtbar(
    da,
    (a) => ({
      id: a.id,
      von: a.vorschlag!.von,
      abgelehnt: a.vorschlag!.stand === 'abgelehnt',
      am: a.vorschlag!.abgelehntAm ?? null,
    }),
    {
      ich: q.ich,
      leitung: (a) => q.leitungIn(a.gruppe),
      heute: q.heute,
      zeitzone: q.zeitzone,
      ausgeblendet: q.ausgeblendet,
    },
  );
  return { offen, abgelehnt };
}

/** Wie viele Tage ein abgelehnter Vorschlag noch sichtbar ist (7 am Tag des Ablehnens, danach 0 = weg). */
export function vorschlagNoch(a: Aufgabe, heute: string, zeitzone: string): number {
  return a.vorschlag?.stand === 'abgelehnt'
    ? tageNoch(a.vorschlag.abgelehntAm ?? null, heute, zeitzone)
    : 0;
}
