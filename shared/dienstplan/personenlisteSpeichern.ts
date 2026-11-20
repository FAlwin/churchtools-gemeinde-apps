/**
 * **Die Personenliste speichern** (Bauplan „Wunsch 19.11.2026: Ansicht Personen – Reihenfolge und Tags“, Scheibe PL-2).
 * Nur Regeln, keine Netzwerk-Technik: Der Aufrufer reicht denselben Port herein wie bei den Entwürfen (`EntwurfPort`).
 * Gelesen wird die Liste in `entwuerfe.ts` (`schubladeLesen` → `Schubladeninhalt.personenliste`), die reinen Änderungen
 * stehen in `personenliste.ts` (`reiheSetzen`, `tagsSetzen`, `pauseSetzen`, `tagListeSetzen`) – hier nur das Schreiben.
 * (Eigene Datei, weil `entwuerfe.ts` die Liste liest und diese Datei `entwuerfe.ts` braucht: in `personenliste.ts` wäre es
 * ein Kreis.)
 *
 * Es gilt dasselbe wie bei den Entwürfen, aus denselben Messungen (E0 §6, E4-3-1): Ein Wert hat kein Änderungsdatum und
 * keinen ETag, zwei gleichzeitige `PUT` gehen beide durch und **einer geht still verloren** – darum steht die `version` im
 * Wert, und vor dem Schreiben wird **frisch gelesen und verglichen**. Zwei gleichzeitige `POST` ergeben zwei Werte; es
 * gewinnt die Regel von `entwuerfe.ts` (`gewinnt`), die anderen werden beim nächsten Schreiben mitgelöscht.
 *
 * Hausregeln: **Kein Schreibvorgang wird automatisch wiederholt.** Erfolg ist erst, was nach dem Schreiben **nachgelesen**
 * dasteht (Lehre vom 11.08.2026) – nicht der Statuscode. Ein vorübergehender Fehler (Netz, Zeitüberschreitung, Drosselung,
 * 5xx) wirft nichts weg: Es wird nachgelesen, und ist es nicht da, heißt das Ergebnis „vorübergehend“; die Eingabe bleibt
 * beim Aufrufer.
 *
 * **Die Änderung muss absolut sein** (`aendern` setzt Werte, es rechnet nicht auf dem alten Stand weiter): Ein früherer
 * Versuch kann doch angekommen sein – dann liefert `aendern` auf dem frischen Stand denselben Inhalt, und es wird nichts
 * noch einmal geschrieben (Erfolg ohne Schreiben, wie bei den Entwürfen).
 */
import {
  MAX_ZEICHEN,
  nachleseUrteil,
  wertAendern,
  wertAnlegen,
  wertLoeschen,
  type Wert,
} from '../ct/modulDaten';
import { grundAus, schubladeLesen, type EntwurfGrund, type EntwurfPort } from './entwuerfe';
import {
  PERSONENLISTE_ART,
  PERSONENLISTE_FASSUNG,
  type ListeInhalt,
  type Personenliste,
} from './personenliste';

export type PersonenlisteErgebnis =
  | { ok: true; liste: Personenliste }
  /** `jetzt`: was nachgelesen dasteht (bei `konflikt` der Stand der anderen, sonst, wenn bekannt, der alte) – `null` ohne Liste. */
  | { ok: false; grund: EntwurfGrund; jetzt?: Personenliste | null };

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, die Personenliste dieser Dienstgruppe zu ändern. Bitte die Verantwortlichen ' +
  'nach den Rechten für die Entwürfe der Gruppe fragen.';

/** Gleicher Inhalt, egal in welcher Reihenfolge die Schlüssel stehen – für „schon so gespeichert“. */
function gleich(a: ListeInhalt, b: ListeInhalt): boolean {
  const norm = (x: ListeInhalt) =>
    JSON.stringify({
      reihe: x.reihe,
      tags: x.tags.map((t) => [t.id, t.name, t.kuerzel]),
      tagsVon: Object.entries(x.tagsVon).sort(([k1], [k2]) => k1.localeCompare(k2)),
      pause: Object.entries(x.pause)
        .sort(([k1], [k2]) => k1.localeCompare(k2))
        .map(([k, p]) => [k, p.bis ?? null]),
    });
  return norm(a) === norm(b);
}

/**
 * **Die Personenliste einer Dienstgruppe ändern.** `erwartet` ist die Version, die der Planer gesehen hat (`null` = es gab
 * keine Liste): Steht inzwischen eine andere da, wird **nicht** überschrieben (`konflikt`, mit `jetzt`). `aendern` bekommt
 * die frisch gelesene Liste (`null` ohne) und liefert den neuen Inhalt.
 */
export async function personenlisteSpeichern(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  aendern: (alt: Personenliste | null) => ListeInhalt,
  erwartet: number | null,
): Promise<PersonenlisteErgebnis> {
  // 1. Frisch lesen.
  const erst = await schubladeLesen(p, modul, kategorie);
  if (!erst.ok) return { ok: false, grund: erst.grund };
  const da = erst.inhalt.personenliste;
  const inhalt = aendern(da);
  // Schon so gespeichert (etwa ein früherer Versuch, der doch angekommen ist) → Erfolg ohne Schreiben.
  if (da && gleich(da, inhalt)) return { ok: true, liste: da };
  if ((da?.version ?? null) !== erwartet) return { ok: false, grund: 'konflikt', jetzt: da };

  // 2. Schreiben – nie wiederholt. Erst die Doppelten (zwei gleichzeitige POST), dann die Liste selbst.
  const neu: Personenliste = {
    version: (da?.version ?? 0) + 1,
    zeit: p.jetzt(),
    reihe: inhalt.reihe,
    tags: inhalt.tags,
    tagsVon: inhalt.tagsVon,
    pause: inhalt.pause,
  };
  const text = JSON.stringify({ art: PERSONENLISTE_ART, fassung: PERSONENLISTE_FASSUNG, ...neu });
  if (text.length > MAX_ZEICHEN) return { ok: false, grund: 'zu-gross' };
  const wert: Wert | null = erst.inhalt.listeWert;
  try {
    for (const w of erst.inhalt.listeDoppelt)
      await wertLoeschen(p, modul, kategorie, w.id, VERWEIGERT);
    if (wert) await wertAendern(p, modul, kategorie, wert.id, text, VERWEIGERT);
    else await wertAnlegen(p, modul, kategorie, text, VERWEIGERT);
  } catch (e) {
    const g = grundAus(p, e);
    if (g !== 'voruebergehend') return { ok: false, grund: g };
    // Gelöscht, während wir ändern wollten (gemessen: 404) – ein anderer war schneller.
    return nachlesen(
      p,
      modul,
      kategorie,
      neu,
      p.istNichtGefunden(e) ? 'konflikt' : 'voruebergehend',
    );
  }

  // 3. Nachlesen – erst was dasteht, ist der Erfolg.
  return nachlesen(p, modul, kategorie, neu, 'nicht-angekommen');
}

async function nachlesen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  neu: Personenliste,
  sonst: EntwurfGrund,
): Promise<PersonenlisteErgebnis> {
  const l = await schubladeLesen(p, modul, kategorie);
  // Nicht lesbar: Ob es angekommen ist, weiß niemand – der Aufrufer behält die Eingabe.
  if (!l.ok) return { ok: false, grund: l.grund };
  const jetzt = l.inhalt.personenliste;
  const urteil = nachleseUrteil(jetzt, neu, true, sonst);
  if (urteil === 'ok' && jetzt) return { ok: true, liste: jetzt };
  return { ok: false, grund: urteil === 'ok' ? sonst : urteil, jetzt };
}
