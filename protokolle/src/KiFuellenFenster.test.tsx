// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import type { Person as Mitglied } from '@shared/organigramm/mitglieder';
import { BLOCK, type Block } from '@shared/protokolle/dokument';
import { docxText } from '@shared/protokolle/docxText';
import {
  antwortLesen,
  auftragBauen,
  namenSuchtext,
  uebernahmePlanen,
  uebernehmbar,
  type Eintrag,
} from '@shared/protokolle/ki';
import {
  namenFinden,
  platzhalterAnwenden,
  zuordnungErgaenzen,
  type Fund,
  type Person,
} from '@shared/protokolle/platzhalter';
import { KiFuellenFenster, type KiFuellenProps } from './KiFuellenFenster';

/**
 * **„Mit KI füllen“, das Fenster** (S8-2): der ganze Weg gegen die echten Erzeuger – `namenFinden`,
 * `platzhalterAnwenden`, `auftragBauen`, `antwortLesen`, `uebernahmePlanen`. Nichts davon wird hier nachgebaut: Der Test
 * rechnet mit denselben Funktionen, was herauskommen muss, und vergleicht. Die Zwischenablage ist eine Attrappe, der
 * Editor ein `einfuegen`-Spion.
 */
const P = (id: number, vorname: string, nachname: string): Person => ({ id, vorname, nachname });
const ALWIN = P(1, 'Alwin', 'Friesen');
const PETER = P(3, 'Peter', 'Wiens');
const MARIA = P(5, 'Maria', 'Dück');
const DANIEL = P(4, 'Daniel', 'Schmidt');
const JOHANN = P(7, 'Johann', 'Becker');
const GRUPPE_PERSONEN = [ALWIN, PETER, MARIA, DANIEL, JOHANN];
const LEA = P(9, 'Lea', 'Janzen');
const ALLE = [...GRUPPE_PERSONEN, P(6, 'Anna', 'Klassen'), P(8, 'Viktor', 'Neumann'), LEA];
const MITGLIEDER: Mitglied[] = GRUPPE_PERSONEN.map((p) => ({
  id: p.id,
  name: `${p.vorname} ${p.nachname}`,
  bild: null,
  initialen: p.vorname.slice(0, 1),
}));

const GRUPPE = 'Leitungsteam';
const DATUM = '2026-11-18';

/** Beispiel-Transkript aus dem abgenommenen Entwurf `s8-ki-v1`. */
const TRANSKRIPT = `Alwin: Gut, dann fangen wir an. Peter Wiens hat heute die Andacht.
Peter: Psalm 91, Verse 1 bis 6. Danach beten wir für Familie Neumann. Und für Anna Klassen, sie hat eine Krebserkrankung.
Alwin: Dann zum Gemeindeessen am 13. Dezember. Maria Dück, wie sieht es in der Küche aus?
Maria: Das Kochteam steht, wir kochen für 70 Personen. Die Tischdekoration besorge ich bis zum 6. Dezember.
Alwin: Und die Kinderbetreuung?
Daniel: Johann Becker hat schon zwei Jugendliche gefragt. Johann, holst du dir bis nächsten Freitag die Zusagen?
Johann: Mach ich.
Alwin: Dann halten wir fest: Das Essen beginnt um 12:30 Uhr. Aufgebaut wird am Samstag, 12. Dezember, ab 15 Uhr.
Peter: Noch ein neues Thema: Auf dem Parkplatz fehlen Hinweisschilder. Viktor Neumann hat angeboten, einen Entwurf zu machen.
Alwin: Gut. Viktor Neumann, zeigst du uns den bis zum 30. November?`;

const text = (t: string) => [{ type: 'text', text: t, styles: {} }];
const heading = (id: string, level: number, t: string): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text(t),
  children: [],
});
/** 1 Andacht · 2 Rückblick (fester Punkt) · 3 Gemeindeessen mit 3.1 und 3.2 · 4 Besuch von Lea Janzen (Name im Titel) · 5 Verschiedenes. */
const dokument = (): Block[] => [
  heading('h1', 1, 'Andacht & Gebet'),
  heading('h2', 1, 'Rückblick'),
  { id: 'v2', type: BLOCK.verweis, props: { art: 'letztes-protokoll' }, children: [] },
  heading('h3', 1, 'Gemeindeessen am 13.12.'),
  heading('h31', 2, 'Küche'),
  heading('h32', 2, 'Kinderbetreuung'),
  heading('h4', 1, 'Besuch von Lea Janzen'),
  heading('h5', 1, 'Verschiedenes'),
];

/** Dieselbe Suche wie im Fenster: Transkript, Titel, vorhandene Zeilen, Gruppenname – über `namenSuchtext`, nicht nachgebaut. */
const fundeFuer = (
  tx: string,
  eigene: string[] = [],
  gruppe = GRUPPE_PERSONEN,
  dok: readonly Block[] = dokument(),
): Fund[] =>
  namenFinden(
    namenSuchtext({ gruppe: GRUPPE, transkript: tx, dokument: dok }),
    { alle: ALLE, gruppe },
    eigene,
  );
const phVon = (funde: Fund[], name: string): string => {
  const f = funde.find((x) => x.text === name);
  if (!f) throw new Error(`kein Fund für ${name}`);
  return f.platzhalter;
};

const neueIdFabrik = () => {
  let n = 0;
  return () => `neu-${++n}`;
};

const schreiben = vi.fn<(t: string) => Promise<void>>();
beforeEach(() => {
  schreiben.mockReset();
  schreiben.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: schreiben },
    configurable: true,
  });
});

function zeige(p: Partial<KiFuellenProps> = {}) {
  const einfuegen = vi.fn();
  const onUebernommen = vi.fn();
  const onClose = vi.fn();
  const r = render(
    <KiFuellenFenster
      gruppe={GRUPPE}
      datum={DATUM}
      dokument={dokument}
      mitglieder={MITGLIEDER}
      einfuegen={einfuegen}
      onUebernommen={onUebernommen}
      onClose={onClose}
      personenLaden={() => Promise.resolve(ALLE)}
      neueId={neueIdFabrik()}
      {...p}
    />,
  );
  return { ...r, einfuegen, onUebernommen, onClose };
}

const tippeTranskript = (t = TRANSKRIPT) =>
  fireEvent.change(screen.getByLabelText('Transkript'), { target: { value: t } });
const kopierKnopf = () => screen.getByRole('button', { name: /Auftrag kopieren|Kopiert/ });
const bereit = () => waitFor(() => expect(kopierKnopf()).toHaveProperty('disabled', false));
const kopieren = async () => {
  await bereit();
  fireEvent.click(kopierKnopf());
  await waitFor(() => expect(schreiben).toHaveBeenCalled());
  return schreiben.mock.calls[schreiben.mock.calls.length - 1][0];
};
const zuSchritt2 = async () => {
  await kopieren();
  fireEvent.click(screen.getByRole('button', { name: 'Weiter: Antwort einfügen' }));
  await screen.findByLabelText('Antwort der KI');
};
const antworten = (a: unknown) =>
  fireEvent.change(screen.getByLabelText('Antwort der KI'), {
    target: { value: typeof a === 'string' ? a : JSON.stringify(a) },
  });

/** Eine Antwort der KI auf den kopierten Auftrag – mit den Platzhaltern, die dort stehen. */
const antwortFuer = (funde: Fund[]) => {
  const ph = (n: string) => phVon(funde, n);
  return {
    punkte: [
      {
        nr: '1',
        stichpunkte: [
          `Andacht von ${ph('Peter Wiens')}: Psalm 91.`,
          `Gebet für ${ph('Familie Neumann')}.`,
        ],
      },
      { nr: '3.1', stichpunkte: [`${ph('Maria Dück')} besorgt die Tischdekoration.`] },
      { nr: '2', stichpunkte: ['Gehört zum festen Punkt.'] },
      { nr: '9', stichpunkte: ['Gibt es nicht.'] },
    ],
    beschluesse: [{ nr: '3', text: 'Das Gemeindeessen beginnt um 12:30 Uhr.' }],
    todos: [
      { nr: '3.2', text: 'Zusagen einholen', wer: [ph('Johann Becker')], bis: '2026-11-20' },
      { nr: '4', text: 'Entwurf zeigen', wer: [ph('Viktor Neumann')], bis: '2026-11-30' },
    ],
    termine: [{ nr: '3', datum: '2026-12-12', text: 'Aufbau ab 15 Uhr' }],
    neue_punkte: [
      { titel: 'Parkplatz', stichpunkte: [`${ph('Viktor Neumann')} macht einen Entwurf.`] },
    ],
  };
};

/** Was `antwortLesen` aus dieser Antwort macht – so wie das Fenster es mit den Funden des Auftrags tut. */
const leseEintraege = (funde: Fund[], antwort: unknown): Eintrag[] => {
  const r = antwortLesen(JSON.stringify(antwort), {
    dokument: dokument(),
    zuordnung: platzhalterAnwenden(TRANSKRIPT, funde).zuordnung,
    funde,
    gruppe: GRUPPE_PERSONEN,
  });
  if (!r.ok) throw new Error(r.meldung);
  return r.eintraege;
};

describe('Schritt 1: Auftrag', () => {
  it('der kopierte Auftrag enthält KEINEN gefundenen Namen, aber die Platzhalter – auch aus dem Titel', async () => {
    zeige();
    tippeTranskript();
    // „Weiteres verbergen“ über das Feld, wie ein Nutzer.
    fireEvent.change(screen.getByLabelText('Weiteres verbergen'), {
      target: { value: 'Krebserkrankung' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    const auftrag = await kopieren();

    const funde = fundeFuer(TRANSKRIPT, ['Krebserkrankung']);
    // Es gibt etwas zu finden – sonst wäre die Prüfung leer.
    expect(funde.length).toBeGreaterThanOrEqual(8);
    for (const f of funde) expect(auftrag).not.toContain(f.text);
    for (const f of funde) expect(auftrag).toContain(f.platzhalter);
    // Der Name steht nur im Titel der Tagesordnung („Besuch von Lea Janzen“) – gefunden und ersetzt.
    expect(funde.some((f) => f.text === 'Lea Janzen')).toBe(true);
    expect(auftrag).toContain(`Besuch von ${phVon(funde, 'Lea Janzen')}`);
    // Der ganze Auftrag ist genau das, was die Regeln bauen.
    expect(auftrag).toBe(
      auftragBauen({
        gruppe: GRUPPE,
        datum: DATUM,
        dokument: dokument(),
        transkript: platzhalterAnwenden(TRANSKRIPT, funde).text,
        funde,
      }),
    );
  });

  it('zeigt die Funde mit Anzahl, Art und Platzhalter; auch der Name im Titel steht in der Liste', async () => {
    zeige();
    tippeTranskript();
    await bereit();
    const liste = screen.getByLabelText('Gefundene Namen');
    const funde = fundeFuer(TRANSKRIPT);
    for (const f of funde) {
      const zeile = within(liste).getByLabelText(`${f.text} ersetzen`).closest('label')!;
      expect(zeile.textContent).toContain(`${f.anzahl}×`);
      expect(zeile.textContent).toContain(f.platzhalter);
    }
    expect(within(liste).getByLabelText('Lea Janzen ersetzen')).toBeTruthy();
  });

  it('Häkchen weg: der Name bleibt im Auftrag stehen, die anderen werden weiter ersetzt', async () => {
    zeige();
    tippeTranskript();
    await bereit();
    fireEvent.click(screen.getByLabelText('Peter ersetzen'));
    const auftrag = await kopieren();
    expect(auftrag).toContain('Peter: Psalm 91');
    expect(auftrag).not.toContain('Alwin');
  });

  it('der feste Hinweis zu Heiklem steht über „Weiteres verbergen“', () => {
    zeige();
    const hinweis = screen.getByText(
      'Namen werden automatisch ersetzt. Heikles (z. B. Krankheiten) hier selbst eintragen oder vorher aus dem Text nehmen.',
    );
    const feld = screen.getByLabelText('Weiteres verbergen');
    expect(hinweis.compareDocumentPosition(feld) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nennt keine bestimmte KI', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    const alles = document.body.textContent ?? '';
    for (const n of ['Claude', 'ChatGPT', 'Copilot', 'Gemini', 'OpenAI', 'Anthropic'])
      expect(alles).not.toContain(n);
    expect(document.querySelector('a')).toBeNull();
  });

  it('ohne Transkript ist nichts zu kopieren; solange die Personenliste fehlt, auch nicht (sonst gingen Namen hinaus)', async () => {
    const r = zeige({ personenLaden: () => new Promise(() => undefined) });
    tippeTranskript();
    expect(kopierKnopf()).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Weiter: Antwort einfügen' })).toHaveProperty(
      'disabled',
      true,
    );
    r.unmount();
    zeige();
    expect(kopierKnopf()).toHaveProperty('disabled', true); // kein Transkript
  });

  it('solange die Gruppenmitglieder fehlen (null), nicht kopieren', async () => {
    zeige({ mitglieder: null });
    tippeTranskript();
    await new Promise((r) => setTimeout(r, 10));
    expect(kopierKnopf()).toHaveProperty('disabled', true);
  });

  it('Mitglieder verborgen: Vornamen allein werden nicht gesucht (nur volle Namen)', async () => {
    zeige({ mitglieder: 'verborgen' });
    tippeTranskript('Peter hat die Andacht. Peter Wiens betet.');
    await bereit();
    const liste = screen.getByLabelText('Gefundene Namen');
    expect(within(liste).getByLabelText('Peter Wiens ersetzen')).toBeTruthy();
    expect(within(liste).queryByLabelText('Peter ersetzen')).toBeNull();
  });
});

describe('Personenliste', () => {
  it('Lesefehler: sichtbarer Hinweis, das Fenster bleibt nutzbar – und es werden keine Namen geloggt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    zeige({ personenLaden: () => Promise.reject(new Error('Netz weg')) });
    expect(
      await screen.findByText(
        'Die Personenliste ließ sich nicht laden – Namen bitte selbst unter „Weiteres verbergen“ eintragen.',
      ),
    ).toBeTruthy();
    tippeTranskript('Maria Dück hat die Küche.');
    fireEvent.change(screen.getByLabelText('Weiteres verbergen'), {
      target: { value: 'Maria Dück' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    const auftrag = await kopieren();
    expect(auftrag).not.toContain('Maria Dück');
    expect(auftrag).toContain('[Vertraulich 1]');
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls.map((c) => String(c[1])))).not.toContain('Maria');
  });
});

describe('Datei wählen', () => {
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const docx = (absaetze: string[]): File => {
    const xml = `<w:document ${NS}><w:body>${absaetze.map((a) => `<w:p><w:r><w:t>${a}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
    const bytes = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8(xml),
    });
    return new File([bytes], 'Sitzung.docx');
  };
  const waehle = (f: File) =>
    fireEvent.change(screen.getByTestId('ki-datei'), { target: { files: [f] } });

  it('.docx: der Text kommt ins Feld (Umlaute), Name und Quelle stehen daneben', async () => {
    zeige();
    waehle(docx(['Größe: Maria Dück bringt Käse', 'Zweiter Absatz ß']));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLTextAreaElement>('Transkript').value).toBe(
        'Größe: Maria Dück bringt Käse\nZweiter Absatz ß',
      ),
    );
    expect(screen.getByText('aus Sitzung.docx übernommen')).toBeTruthy();
    // …und die Namen daraus werden gefunden.
    expect(await screen.findByLabelText('Maria Dück ersetzen')).toBeTruthy();
  });

  it('.docx, die keine ist: Meldung im Fenster (von docxText), das Feld bleibt, wie es war', async () => {
    zeige();
    tippeTranskript('Vorhandener Text');
    const kaputt = new File([strToU8('kein zip')], 'kaputt.docx');
    waehle(kaputt);
    const erwartet = docxText(strToU8('kein zip'));
    if (erwartet.ok) throw new Error('docxText hätte scheitern müssen');
    expect((await screen.findByRole('alert')).textContent).toBe(erwartet.meldung);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Transkript').value).toBe('Vorhandener Text');
  });

  it('.txt wird als UTF-8 gelesen', async () => {
    zeige();
    waehle(new File([strToU8('Schön: Peter Wiens, Größe äöüß')], 'notizen.txt'));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLTextAreaElement>('Transkript').value).toBe(
        'Schön: Peter Wiens, Größe äöüß',
      ),
    );
  });

  it('andere Endung: freundliche Meldung', async () => {
    zeige();
    waehle(new File([strToU8('x')], 'bild.png'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/\.txt oder \.docx/);
  });
});

describe('Schritt 2: Antwort', () => {
  it('Auftrag kopiert: Hinweis „in deine KI einfügen“, „Auftrag anzeigen“ zu', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    expect(screen.getByText(/in deine KI einfügen und die Antwort hier einfügen/)).toBeTruthy();
    const details = screen.getByText('Auftrag anzeigen').closest('details')!;
    expect(details.open).toBe(false);
  });

  it('Kopieren scheitert: gleich Schritt 2, „Auftrag anzeigen“ offen – mit dem markierbaren, schreibgeschützten Auftrag', async () => {
    schreiben.mockRejectedValue(new Error('gesperrt'));
    zeige();
    tippeTranskript();
    await bereit();
    fireEvent.click(kopierKnopf());
    await screen.findByLabelText('Antwort der KI');
    const details = screen.getByText('Auftrag anzeigen').closest('details')!;
    expect(details.open).toBe(true);
    expect(screen.getByText('Kopieren war nicht möglich.')).toBeTruthy();
    const feld = screen.getByLabelText<HTMLTextAreaElement>('Auftrag');
    expect(feld.readOnly).toBe(true);
    const funde = fundeFuer(TRANSKRIPT);
    expect(feld.value).toBe(
      auftragBauen({
        gruppe: GRUPPE,
        datum: DATUM,
        dokument: dokument(),
        transkript: platzhalterAnwenden(TRANSKRIPT, funde).text,
        funde,
      }),
    );
  });

  it('ohne Kopieren weiter: Hinweis „noch nicht kopiert“ und der Ausweg ist offen', async () => {
    zeige();
    tippeTranskript();
    await bereit();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter: Antwort einfügen' }));
    await screen.findByLabelText('Antwort der KI');
    expect(screen.getByText('Der Auftrag ist noch nicht kopiert.')).toBeTruthy();
    expect(screen.getByText('Auftrag anzeigen').closest('details')!.open).toBe(true);
  });

  it('kaputte Antwort: Meldung (von antwortLesen) im Fenster, der Text bleibt stehen', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    const kaputt =
      'Gerne! Hier ist eine Zusammenfassung der Sitzung. Sag Bescheid, wenn ich ändern soll.';
    antworten(kaputt);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    const erwartet = antwortLesen(kaputt, {
      dokument: dokument(),
      zuordnung: {},
      funde: [],
      gruppe: [],
    });
    if (erwartet.ok) throw new Error('hätte scheitern müssen');
    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain(erwartet.meldung);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Antwort der KI').value).toBe(kaputt);
    expect(screen.queryByText('Ausgewählte übernehmen')).toBeNull();
  });

  it('abgeschnittenes JSON: ebenfalls Meldung, nichts geht verloren', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    antworten('{"punkte":[{"nr":"1","stichpunkte":["a"');
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Antwort der KI').value).toContain(
      '"nr":"1"',
    );
  });
});

describe('Direkt zur Antwort (ohne Transkript)', () => {
  const direkt = () => {
    const r = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Antwort schon da? Direkt einfügen' }));
    return r;
  };
  const vorschau = () => fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
  /** Eine Antwort mit Platzhaltern, die dieses Fenster nicht kennt (aus einem früheren Lauf). */
  const fremdeAntwort = {
    punkte: [{ nr: '1', stichpunkte: ['[Person 1] hält die Andacht.'] }],
    todos: [
      { nr: '3.1', text: 'Zusagen einholen', wer: ['[Person 2]'], bis: '2026-11-20' },
      { nr: '3.2', text: 'Beamer prüfen', wer: ['[Person 3]'] },
    ],
  };

  it('der Link in Schritt 1 führt ohne Transkript zur Antwort – ohne „Auftrag anzeigen“ und ohne Kopier-Hinweis', async () => {
    direkt();
    await screen.findByLabelText('Antwort der KI');
    expect(screen.queryByText('Auftrag anzeigen')).toBeNull();
    expect(screen.queryByLabelText('Auftrag')).toBeNull();
    expect(screen.queryByText('Der Auftrag ist noch nicht kopiert.')).toBeNull();
    expect(screen.queryByText(/in deine KI einfügen und die Antwort hier einfügen/)).toBeNull();
  });

  it('Zurück geht von dort wieder zu Schritt 1', async () => {
    direkt();
    await screen.findByLabelText('Antwort der KI');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByLabelText('Transkript')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Antwort schon da? Direkt einfügen' })).toBeTruthy();
  });

  it('der Weg mit Transkript behält seinen Auftrag-Ausweg (der Link ändert nichts daran)', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    expect(screen.getByText('Auftrag anzeigen')).toBeTruthy();
  });

  it('Platzhalter, die das Fenster nicht kennt, stehen in „Platzhalter zuordnen“ – mit den Gruppenmitgliedern als Vorschlag', async () => {
    direkt();
    antworten(fremdeAntwort);
    await screen.findByRole('heading', { name: 'Platzhalter zuordnen' });
    for (const p of ['[Person 1]', '[Person 2]', '[Person 3]'])
      expect(screen.getByLabelText(`Name für ${p}`)).toBeTruthy();
    const vorschlaege = [...document.querySelectorAll('#ki-gruppenmitglieder option')].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(vorschlaege).toEqual(GRUPPE_PERSONEN.map((p) => `${p.vorname} ${p.nachname}`));
    expect(screen.getByLabelText('Name für [Person 1]').getAttribute('list')).toBe(
      'ki-gruppenmitglieder',
    );
  });

  it('ohne Transkript gilt keine Zuordnung aus den Titeln: dessen „[Person n]“ muss von Hand zugeordnet werden', async () => {
    direkt();
    // Der Titel „Besuch von Lea Janzen“ würde im Fenster einen Platzhalter bekommen – ohne Transkript nutzlos.
    const lea = phVon(fundeFuer(''), 'Lea Janzen');
    antworten({ punkte: [{ nr: '1', stichpunkte: [`${lea} spricht.`] }] });
    expect(await screen.findByLabelText(`Name für ${lea}`)).toBeTruthy();
  });

  it('mit Transkript steht nur, was die Zuordnung nicht kennt', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    const funde = fundeFuer(TRANSKRIPT);
    antworten({
      punkte: [
        { nr: '1', stichpunkte: [`${phVon(funde, 'Peter Wiens')} spricht, [Person 77] hört zu.`] },
      ],
    });
    expect(await screen.findByLabelText('Name für [Person 77]')).toBeTruthy();
    expect(screen.queryByLabelText(`Name für ${phVon(funde, 'Peter Wiens')}`)).toBeNull();
  });

  it('ein gewählter Name wird in der Vorschau eingesetzt; ein Mitglied wird zuständige Person – wie die Regeln es rechnen', async () => {
    const { einfuegen } = direkt();
    antworten(fremdeAntwort);
    fireEvent.change(await screen.findByLabelText('Name für [Person 1]'), {
      target: { value: 'Peter Wiens' },
    });
    fireEvent.change(screen.getByLabelText('Name für [Person 2]'), {
      target: { value: ' Daniel Schmidt ' },
    });
    fireEvent.change(screen.getByLabelText('Name für [Person 3]'), {
      target: { value: 'Fremde Frau' },
    });
    vorschau();
    await screen.findByText('Stichpunkte');

    // Dasselbe, was die Regeln aus dieser Zuordnung machen.
    const zuordnung = zuordnungErgaenzen(
      {},
      {
        '[Person 1]': 'Peter Wiens',
        '[Person 2]': 'Daniel Schmidt',
        '[Person 3]': 'Fremde Frau',
      },
    );
    const r = antwortLesen(JSON.stringify(fremdeAntwort), {
      dokument: dokument(),
      zuordnung,
      funde: [],
      gruppe: GRUPPE_PERSONEN,
    });
    if (!r.ok) throw new Error(r.meldung);
    const todo = r.eintraege.find((e) => e.art === 'todo' && e.text === 'Zusagen einholen');
    expect(todo?.art === 'todo' && todo.wer).toEqual([{ name: 'Daniel Schmidt', personId: 4 }]);

    const alles = document.body.textContent ?? '';
    expect(alles).toContain('Peter Wiens hält die Andacht.');
    expect(alles).toContain('Daniel Schmidt');
    expect(alles).not.toContain('Daniel Schmidt (extern)');
    expect(alles).toContain('Fremde Frau (extern)');
    expect(alles).not.toMatch(/\[Person \d+\]/);
    expect(screen.queryByText(/keinem Namen zugeordnet/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ausgewählte übernehmen/ }));
    const plan = uebernahmePlanen(r.eintraege.filter(uebernehmbar), dokument(), neueIdFabrik());
    expect(einfuegen.mock.calls).toEqual([[plan.einfuegungen]]);
    // Die Aufgabe trägt das Mitglied als Zuständigen (vorab.wer), nicht als externen Namen.
    expect(JSON.stringify(einfuegen.mock.calls)).toContain('\\"wer\\":[4]');
  });

  it('leer gelassen: der Platzhalter bleibt stehen, EIN Hinweis oben, und als Zuständiger wird er nicht übernommen', async () => {
    const { einfuegen } = direkt();
    antworten(fremdeAntwort);
    await screen.findByLabelText('Name für [Person 1]');
    vorschau();
    await screen.findByText('Stichpunkte');

    // Ein Hinweis, gesammelt, mit allen drei.
    const hinweise = screen.getAllByText(/keinem Namen zugeordnet/);
    expect(hinweise).toHaveLength(1);
    expect(hinweise[0].textContent).toBe(
      '[Person 1], [Person 2], [Person 3] sind keinem Namen zugeordnet – nach dem Übernehmen selbst ersetzen.',
    );
    // Der Text zeigt den Platzhalter (blau), die To-Dos haben niemanden zuständig – kein „(extern)“.
    expect(screen.getByText('[Person 1]', { selector: 'span span' })).toBeTruthy();
    const todo = screen.getByText('Zusagen einholen').closest('label')!;
    expect(todo.textContent).toContain('niemand zuständig');
    expect(todo.textContent).not.toContain('(extern)');
    expect(todo.textContent).not.toContain('[Person 2]');

    fireEvent.click(screen.getByRole('button', { name: /Ausgewählte übernehmen/ }));
    const gesendet = JSON.stringify(einfuegen.mock.calls);
    // Der Stichpunkt behält den Platzhalter zum Ersetzen, die Aufgabe bekommt ihn NICHT als externen Namen.
    expect(gesendet).toContain('[Person 1] hält die Andacht.');
    expect(gesendet).not.toContain('extern\\":\\"[Person');
    expect(gesendet).not.toContain('[Person 2]');
  });

  it('nur ein einzelner offener Platzhalter: der Hinweis steht in der Einzahl', async () => {
    direkt();
    antworten({ punkte: [{ nr: '1', stichpunkte: ['[Person 5] spricht.'] }] });
    await screen.findByLabelText('Name für [Person 5]');
    vorschau();
    await screen.findByText('Stichpunkte');
    expect(screen.getByText(/ist keinem Namen zugeordnet/).textContent).toBe(
      '[Person 5] ist keinem Namen zugeordnet – nach dem Übernehmen selbst ersetzen.',
    );
  });

  it('kennt die Zuordnung alles (Weg mit Transkript), gibt es weder die Liste noch den Hinweis', async () => {
    zeige();
    tippeTranskript();
    await zuSchritt2();
    antworten(antwortFuer(fundeFuer(TRANSKRIPT)));
    expect(screen.queryByRole('heading', { name: 'Platzhalter zuordnen' })).toBeNull();
    vorschau();
    await screen.findByText('Stichpunkte');
    expect(screen.queryByText(/keinem Namen zugeordnet/)).toBeNull();
  });
});

describe('Schritt 3: Vorschau und Übernahme', () => {
  const bisVorschau = async () => {
    const r = zeige();
    tippeTranskript();
    fireEvent.change(screen.getByLabelText('Weiteres verbergen'), {
      target: { value: 'Krebserkrankung' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    await zuSchritt2();
    const funde = fundeFuer(TRANSKRIPT, ['Krebserkrankung']);
    antworten(antwortFuer(funde));
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    await screen.findByText('Stichpunkte');
    return { ...r, funde };
  };

  it('zeigt die Bereiche, die Namen wieder da (grün), das Ziel je Zeile – und keine Platzhalter mehr', async () => {
    await bisVorschau();
    for (const b of ['Stichpunkte', 'Beschlüsse', 'To-Dos', 'Termine', 'Neue Punkte'])
      expect(screen.getByRole('heading', { name: new RegExp(b) })).toBeTruthy();
    const alles = document.body.textContent ?? '';
    expect(alles).toContain('Andacht von Peter Wiens: Psalm 91.');
    expect(alles).toContain('Gebet für Familie Neumann.');
    expect(alles).not.toMatch(/\[Person \d+\]/);
    const gruen = [...document.querySelectorAll('[data-name]')].map((e) => e.textContent);
    expect(gruen).toContain('Peter Wiens');
    expect(gruen).toContain('Maria Dück');
    // Ziel klein darunter, mit Nummer und Titel.
    expect(alles).toContain('→ 3.1 Küche');
    expect(alles).toContain('→ 3. Gemeindeessen am 13.12.');
    // To-Dos: Mitglied mit Namen, Nicht-Mitglied „(extern)“, Bis-Datum TT.MM.JJJJ.
    expect(alles).toContain('Johann Becker');
    expect(alles).not.toContain('Johann Becker (extern)');
    expect(alles).toContain('Viktor Neumann (extern)');
    expect(alles).toContain('bis 20.11.2026');
    expect(alles).toContain('12.12.2026');
  });

  it('nicht übernehmbare Einträge (fester / unbekannter Punkt): ohne Häkchen, ausgegraut, mit Grund', async () => {
    await bisVorschau();
    const fest = screen.getByText('Gehört zum festen Punkt.').closest('label')!;
    const unbekannt = screen.getByText('Gibt es nicht.').closest('label')!;
    for (const l of [fest, unbekannt]) {
      const haken = within(l).getByRole<HTMLInputElement>('checkbox');
      expect(haken.checked).toBe(false);
      expect(haken.disabled).toBe(true);
    }
    expect(fest.textContent).toContain('fester Punkt');
    expect(unbekannt.textContent).toContain('Punkt 9 gibt es nicht');
  });

  it('„Ausgewählte übernehmen“ ruft einfuegen mit genau dem, was uebernahmePlanen liefert – in dieser Reihenfolge', async () => {
    const { einfuegen, onUebernommen, funde } = await bisVorschau();
    const eintraege = leseEintraege(funde, antwortFuer(funde));
    const plan = uebernahmePlanen(eintraege.filter(uebernehmbar), dokument(), neueIdFabrik());
    expect(plan.einfuegungen.length).toBeGreaterThan(2); // sonst prüft die Reihenfolge nichts
    const anzahl = eintraege.filter(uebernehmbar).length;
    fireEvent.click(screen.getByRole('button', { name: `Ausgewählte übernehmen (${anzahl})` }));
    expect(einfuegen.mock.calls).toEqual([[plan.einfuegungen]]);
    expect(onUebernommen).toHaveBeenCalledWith({ anzahl, uebersprungen: 0 });
  });

  it('Häkchen aus: der Eintrag wird nicht übernommen (und nicht gezählt)', async () => {
    const { einfuegen, onUebernommen, funde } = await bisVorschau();
    const eintraege = leseEintraege(funde, antwortFuer(funde));
    const weg = eintraege.find((e) => e.art === 'beschluss')!;
    fireEvent.click(
      within(
        screen.getByText('Das Gemeindeessen beginnt um 12:30 Uhr.').closest('label')!,
      ).getByRole('checkbox'),
    );
    const gewaehlt = eintraege.filter((e) => uebernehmbar(e) && e.id !== weg.id);
    const plan = uebernahmePlanen(gewaehlt, dokument(), neueIdFabrik());
    fireEvent.click(
      screen.getByRole('button', { name: `Ausgewählte übernehmen (${gewaehlt.length})` }),
    );
    expect(einfuegen.mock.calls).toEqual([[plan.einfuegungen]]);
    expect(JSON.stringify(einfuegen.mock.calls)).not.toContain('beginnt um 12:30');
    expect(onUebernommen).toHaveBeenCalledWith({ anzahl: gewaehlt.length, uebersprungen: 0 });
  });

  it('alles abgehakt: nichts zu übernehmen, Knopf aus', async () => {
    await bisVorschau();
    for (const k of screen.getAllByRole<HTMLInputElement>('checkbox'))
      if (k.checked) fireEvent.click(k);
    expect(screen.getByRole('button', { name: /Ausgewählte übernehmen/ })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('ein Punkt, der seit dem Lesen aus dem Dokument verschwunden ist: übersprungen und gemeldet', async () => {
    let doku = dokument();
    const { einfuegen, onUebernommen } = zeige({ dokument: () => doku });
    tippeTranskript();
    await zuSchritt2();
    const funde = fundeFuer(TRANSKRIPT);
    antworten({
      punkte: [
        { nr: '1', stichpunkte: ['Eins'] },
        { nr: '3.1', stichpunkte: ['Küche'] },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    await screen.findByText('Stichpunkte');
    expect(funde.length).toBeGreaterThan(0);
    doku = doku.filter((b) => b.id !== 'h31'); // 3.1 Küche ist weg
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte übernehmen (2)' }));
    expect(onUebernommen).toHaveBeenCalledWith({ anzahl: 1, uebersprungen: 1 });
    expect(einfuegen).toHaveBeenCalledTimes(1);
  });

  it('Zurück aus der Vorschau: die Antwort steht noch da', async () => {
    await bisVorschau();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    const feld = await screen.findByLabelText<HTMLTextAreaElement>('Antwort der KI');
    expect(feld.value).toContain('"punkte"');
  });
});

describe('nichts wird gespeichert', () => {
  it('weder localStorage noch sessionStorage bekommen etwas', async () => {
    const setLokal = vi.spyOn(Storage.prototype, 'setItem');
    zeige();
    tippeTranskript();
    await zuSchritt2();
    antworten(antwortFuer(fundeFuer(TRANSKRIPT)));
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    await screen.findByText('Stichpunkte');
    expect(setLokal).not.toHaveBeenCalled();
  });
});

describe('Neue Punkte mit Beschluss, To-Do und Termin (leeres Protokoll)', () => {
  const leer = (): Block[] => [{ id: 'p0', type: 'paragraph', content: [], children: [] }];
  /** Antwort nur aus `neue_punkte` – ohne Platzhalter, damit „Direkt einfügen“ ohne Zuordnung auskommt. */
  const antwort = {
    neue_punkte: [
      {
        titel: 'Parkplatz',
        stichpunkte: ['Hinweisschilder fehlen.'],
        beschluesse: ['Wir bestellen drei Schilder.'],
        todos: [
          { text: 'Entwurf zeigen', wer: ['Maria Dück', 'Viktor Neumann'], bis: '2026-11-30' },
        ],
        termine: [{ datum: '2026-12-12', text: 'Aufbau ab 15 Uhr' }],
      },
      { titel: 'Verschiedenes', stichpunkte: ['Nichts weiter.'] },
    ],
  };
  const bisVorschau = () => {
    const r = zeige({ dokument: leer });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort schon da? Direkt einfügen' }));
    antworten(antwort);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    return r;
  };
  const erwartet = () => {
    const e = antwortLesen(JSON.stringify(antwort), {
      dokument: leer(),
      zuordnung: {},
      funde: [],
      gruppe: [], // ohne Transkript kennt das Fenster keine Funde – Namen bleiben extern
    });
    if (!e.ok) throw new Error(e.meldung);
    return e.eintraege;
  };

  it('Vorschau: der neue Punkt mit seinem Inhalt und EINEM Häkchen', async () => {
    bisVorschau();
    await screen.findByRole('heading', { name: /Neue Punkte/ });
    const punkt = screen.getByText('Parkplatz').closest('label')!;
    expect(within(punkt).getAllByRole('checkbox')).toHaveLength(1);
    const t = punkt.textContent ?? '';
    for (const s of [
      'Hinweisschilder fehlen.',
      'Beschlüsse',
      'Wir bestellen drei Schilder.',
      'To-Dos',
      'Entwurf zeigen',
      'Maria Dück (extern)',
      'Viktor Neumann (extern)',
      'bis 30.11.2026',
      'Termine',
      '12.12.2026',
      'Aufbau ab 15 Uhr',
    ])
      expect(t, s).toContain(s);
    // Zwei neue Punkte = zwei Häkchen insgesamt, sonst keine Bereiche für Beschlüsse/To-Dos/Termine.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: /^Beschlüsse/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^To-Dos/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^Termine/ })).toBeNull();
  });

  it('Übernahme in ein leeres Protokoll: Punkt, Stichpunkt, Beschluss, To-Do und Termin kommen ans Ende (vor = null)', async () => {
    const { einfuegen, onUebernommen } = bisVorschau();
    await screen.findByRole('heading', { name: /Neue Punkte/ });
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte übernehmen (2)' }));
    expect(einfuegen).toHaveBeenCalledTimes(1);
    const [liste] = einfuegen.mock.calls[0] as [{ bloecke: Block[]; vor: string | null }[]];
    expect(liste).toHaveLength(1);
    const { bloecke, vor } = liste[0];
    expect(vor).toBeNull();
    expect(
      bloecke.slice(0, 5).map((b) => [b.type, (b.content as { text: string }[])[0].text]),
    ).toEqual([
      ['heading', 'Parkplatz'],
      ['bulletListItem', 'Hinweisschilder fehlen.'],
      [BLOCK.beschluss, 'Wir bestellen drei Schilder.'],
      [BLOCK.aufgabe, 'Entwurf zeigen'],
      [BLOCK.termin, 'Aufbau ab 15 Uhr'],
    ]);
    expect(bloecke[3].props?.vorab).toBe(
      JSON.stringify({ wer: [], extern: 'Maria Dück, Viktor Neumann', bis: '2026-11-30' }),
    );
    expect(bloecke[4].props).toEqual({ datum: '2026-12-12' });
    // Genau das, was die Regeln planen.
    const plan = uebernahmePlanen(erwartet(), leer(), neueIdFabrik());
    expect(einfuegen.mock.calls).toEqual([[plan.einfuegungen]]);
    expect(onUebernommen).toHaveBeenCalledWith({ anzahl: 2, uebersprungen: 0 });
  });
});

describe('W12: vorhandener Text – ersetzen statt doppeln', () => {
  const zeile = (id: string, t: string, type = 'bulletListItem'): Block => ({
    id,
    type,
    content: text(t),
    children: [],
  });
  const dok = (): Block[] => [
    heading('h1', 1, 'Feste'),
    zeile('a1', 'Eishalle Troisdorf anfragen, sonst Wiehl.', 'paragraph'),
    zeile('a2', 'Danach Essen im Gemeindehaus mit Peter Wiens.'),
    heading('h2', 1, 'Ostern'),
    zeile('a3', 'Ab 18 Uhr Stehimbiss.'),
  ];
  const TX = 'Peter Wiens plant das Eislaufen. Alles klar.';

  const bisVorschau = async () => {
    const r = zeige({ dokument: dok });
    tippeTranskript(TX);
    const auftrag = await kopieren();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter: Antwort einfügen' }));
    await screen.findByLabelText('Antwort der KI');
    const funde = fundeFuer(TX, [], GRUPPE_PERSONEN, dok());
    const peter = phVon(funde, 'Peter Wiens');
    antworten({
      punkte: [{ nr: '2', stichpunkte: ['Stehimbiss ab 18 Uhr', 'Kinderchor singt am Sonntag'] }],
      beschluesse: [
        { nr: '1', text: `${peter} organisiert das Essen.`, ersetzt: ['Z2'] },
        { nr: '2', text: 'Imbiss ab 18 Uhr', nach: 'Z3' },
      ],
      todos: [{ nr: '1', text: 'Eishalle anfragen', ersetzt: ['Z1'] }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    await screen.findByText('Stichpunkte');
    return { ...r, auftrag, peter };
  };

  it('der kopierte Auftrag trägt die Kennungen – und keinen Namen aus dem vorhandenen Text', async () => {
    const { auftrag, peter } = await bisVorschau();
    expect(auftrag).toContain('Z1 Eishalle Troisdorf anfragen, sonst Wiehl.');
    expect(auftrag).toContain(`Z2 Danach Essen im Gemeindehaus mit ${peter}.`);
    expect(auftrag).not.toContain('Peter Wiens');
  });

  it('Vorschau: „ersetzt …“ mit eigenem Haken, „kommt unter …“, doppelter Stichpunkt abgewählt mit „steht schon da“', async () => {
    await bisVorschau();
    // ersetzt – mit dem echten Text der Zeile, Namen wieder da
    const ersetzt = screen.getAllByRole('checkbox', { name: 'Zeile ersetzen' });
    expect(ersetzt).toHaveLength(2);
    expect(document.body.textContent).toContain('Danach Essen im Gemeindehaus mit Peter Wiens.');
    expect(document.body.textContent).toMatch(/kommt unter\s*Ab 18 Uhr Stehimbiss\./);
    // doppelt: abgewählt, durchgestrichen, Etikett
    const doppelt = screen.getByText('Stehimbiss ab 18 Uhr').closest('label')!;
    expect(within(doppelt).getByRole('checkbox')).toHaveProperty('checked', false);
    expect(doppelt.querySelector('s')).toBeTruthy();
    expect(screen.getByText('steht schon da')).toBeTruthy();
    // der neue Stichpunkt ist gewählt: 2 Bausteine + 1 Stichpunkt + Beschluss mit nach = 4 − doppelt
    expect(
      within(screen.getByText('Kinderchor singt am Sonntag').closest('label')!).getByRole(
        'checkbox',
      ),
    ).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'Ausgewählte übernehmen (4)' })).toBeTruthy();
  });

  it('übernehmen: ein Aufruf mit allem, ersetzte Zeilen werden entfernt – genau das, was uebernahmePlanen liefert', async () => {
    const { einfuegen, peter } = await bisVorschau();
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte übernehmen (4)' }));
    expect(einfuegen).toHaveBeenCalledTimes(1);
    const liste = (einfuegen.mock.calls[0] as [{ entfernen?: string[] }[]])[0];
    expect(liste.flatMap((x) => x.entfernen ?? []).sort()).toEqual(['a1', 'a2']);
    const funde = fundeFuer(TX, [], GRUPPE_PERSONEN, dok());
    expect(peter).toBe(phVon(funde, 'Peter Wiens'));
  });

  it('Haken „Zeile ersetzen“ weg: die Zeile bleibt (nicht in „entfernen“)', async () => {
    const { einfuegen } = await bisVorschau();
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Zeile ersetzen' })[0]);
    expect(document.body.textContent).toContain('ersetzt nicht, kommt darunter:');
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte übernehmen (4)' }));
    const liste = (einfuegen.mock.calls[0] as [{ entfernen?: string[] }[]])[0];
    expect(liste.flatMap((x) => x.entfernen ?? [])).toEqual(['a1']);
  });

  it('Eintrag abgewählt: sein Ersetzen-Haken ist gesperrt', async () => {
    await bisVorschau();
    const beschluss = screen.getByText(/organisiert das Essen/).closest('label')!;
    fireEvent.click(within(beschluss).getByRole('checkbox'));
    const haken = screen.getAllByRole('checkbox', { name: 'Zeile ersetzen' });
    expect(haken.filter((h) => (h as HTMLInputElement).disabled)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ausgewählte übernehmen (3)' })).toBeTruthy();
  });

  it('der doppelte Stichpunkt lässt sich wieder wählen', async () => {
    await bisVorschau();
    const doppelt = screen.getByText('Stehimbiss ab 18 Uhr').closest('label')!;
    fireEvent.click(within(doppelt).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Ausgewählte übernehmen (5)' })).toBeTruthy();
  });
});
