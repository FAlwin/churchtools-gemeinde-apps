import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dateien } from './quelltexte.testutil';

/**
 * **Wächter: keine neue eigene Knopfart in den Anmeldungen** (U1, Alwin 28.10.2026: „Verschiedene Button-Stile …
 * muss vereinheitlicht werden“). Liegt bei den anderen Dauerprüfungen in `ui/design`; eine weitere App bekommt hier
 * ihre eigene Liste, sobald sie umgestellt ist. Bis U1 hatte die Erweiterung 17 eigene Knopfarten neben den gemeinsamen. Knöpfe kommen jetzt aus `ui/`:
 * `FensterKnopf`/`FensterLink` (haupt, zweit, hell, gefahr, loeschen – wie die Knöpfe der ChurchTools-Fenster),
 * `KopfKnopf` im Seitenkopf, `ZeilenKnopf` am Ende einer Zeile.
 *
 * Ein eigenes `<button className={…}>` ist nur noch erlaubt, wo es kein Knopf im Sinn dieser Arten ist – die Liste
 * unten, je mit Grund. Kommt eine neue Klasse dazu, schlägt der Test an: dann den gemeinsamen Baustein nehmen oder
 * die Klasse hier begründet aufnehmen. Steht hier etwas, das keiner mehr benutzt, schlägt er ebenfalls an.
 */
const ERLAUBT: Record<string, string> = {
  // Auswahl – wählt etwas aus (wie Chips, Optionen, Schalter), statt etwas zu tun.
  's.filterChip': 'Filter-Chip',
  'styles.filterChip': 'Filter-Chip der Startseite',
  'f.option': 'Option im Fenster (eine von mehreren)',
  'f.aktion': 'Zeile zum Auswählen im Fenster (Von Hand, Verwalten)',
  'k.vorlage': 'Vorlage im Baukasten',
  'k.schalterZeile': 'Zeile mit Schalter (an/aus)',
  'bk.schalterZeile': 'Zeile mit Schalter (an/aus)',
  'k.farbe': 'Farbfeld im Design',
  'k.schrift': 'Schrift im Design',
  'k.logoKachel': 'Logo zum Auswählen',
  'k.pflicht': 'Pflicht/freiwillig umschalten',
  'a.pille': 'Empfänger-Pille in der Rundmail',
  // Klickbare Zeilen und Überschriften – die ganze Fläche öffnet etwas.
  't.oeffnen':
    'Name in einer Zeile der Tabelle – öffnet die Anmeldung wie ein Klick in die Zeile (U2-1)',
  't.sortKnopf': 'Spaltenüberschrift der Tabelle – sortiert (U2-1)',
  'v.baustein': 'Preis-Baustein in der Liste',
  'k.gruppenKopf': 'Auf- und zuklappbare Gruppe im Baukasten',
  'styles.titelKnopf': 'Titel einer Veranstaltung auf der Startseite',
  // Textlinks – blauer (oder roter) Text ohne Rahmen, wie Links in ChurchTools.
  'a.linkKnopf': 'Textlink („＋ Person dazu“, „Zurückholen“)',
  'a.absagenLink': 'roter Textlink „Absagen“',
  'f.textKnopf': 'Textlink im Fenster',
  'd.weitere': 'Textlink „＋ weitere“',
  'k.antwortNeu': 'Textlink „＋ Antwort“',
  'v.zurueck': '„‹ Übersicht“ / „‹ Vorbereiten“',
  // Besondere Lagen.
  'k.bildKnopf': 'liegt über dem Titelbild',
  'k.info': 'Symbol „i“ neben einer Frage',
  'rueckgaengigStile.knopf': 'gemeinsam aus ui/fenster/aenderung',
  'v.leisteZu': 'Schließen-Kreuz der Rückgängig-Leiste',
};

/** Alle `x.y`-Klassen an `<button className={…}>` in den Bildschirmen der Erweiterung, mit Fundort. */
function knopfKlassen(): Map<string, string[]> {
  const gefunden = new Map<string, string[]>();
  for (const pfad of dateien('anmeldungen/src', /\.tsx$/)) {
    if (pfad.includes('.test.')) continue;
    const text = readFileSync(pfad, 'utf8');
    for (const m of text.matchAll(/<button\b([^>]*?)>/gs)) {
      const klasse = /className=\{([^}]*)\}/.exec(m[1])?.[1];
      if (!klasse) continue;
      for (const k of klasse.matchAll(/\b([a-z]\w*)\.(\w+)/g)) {
        const name = `${k[1]}.${k[2]}`;
        gefunden.set(name, [...(gefunden.get(name) ?? []), pfad.split('/').pop()!]);
      }
    }
  }
  return gefunden;
}

describe('Knöpfe der Erweiterung (U1)', () => {
  const gefunden = knopfKlassen();

  it('findet überhaupt Knöpfe (sonst prüft der Wächter nichts)', () => {
    expect(gefunden.size).toBeGreaterThan(10);
  });

  it('keine eigene Knopfart außerhalb der begründeten Liste', () => {
    const neu = [...gefunden]
      .filter(([k]) => !(k in ERLAUBT))
      .map(([k, wo]) => `${k} (${wo.join(', ')})`);
    expect(neu).toEqual([]);
  });

  it('die Liste enthält nichts, was keiner mehr benutzt', () => {
    expect(Object.keys(ERLAUBT).filter((k) => !gefunden.has(k))).toEqual([]);
  });
});
