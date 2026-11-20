// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as V from '@ui/ct/verbindung';
import {
  BAUSTEIN_TYPEN,
  bausteinSchema,
  type Baustein,
  type BausteinTyp,
} from '@shared/website/modell';
import { BEISPIELE, seite } from '@shared/website/website.testdaten';
import { BausteinFelder } from './BausteinFelder';

vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(),
}));
const ctDaten = vi.mocked(V.ctDaten);

const SEITEN = [
  seite({ id: 's1', titel: 'Start', pfad: 'start' }),
  seite({ id: 's2', titel: 'Kontakt', pfad: 'kontakt', startseite: false }),
];

function zeigen(b: Baustein, htmlErlaubt = true) {
  const onAendern = vi.fn();
  const r = render(
    <BausteinFelder
      baustein={b}
      kontext={{ seiten: SEITEN, seite: SEITEN[0], htmlErlaubt }}
      onAendern={onAendern}
    />,
  );
  /** Der Baustein nach der letzten Änderung – und er besteht das Schema. */
  const letzter = () => {
    const x = onAendern.mock.calls.at(-1)?.[0] as Baustein;
    expect(bausteinSchema.safeParse(x).success, JSON.stringify(x)).toBe(true);
    return x;
  };
  return { onAendern, letzter, ...r };
}

const beispiel = (typ: BausteinTyp) => BEISPIELE[typ]('b1');
const tippe = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const knopf = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  ctDaten.mockReset();
  ctDaten.mockResolvedValue([
    { id: 1, name: 'Gemeindeveranstaltungen' },
    { id: 2, name: 'Jugend' },
  ]);
});

/** Für JEDEN Typ des Modells: ein Eintrag. Ein neuer Typ ohne Eintrag scheitert an der Typprüfung. */
const FAELLE: Record<BausteinTyp, () => Promise<void> | void> = {
  ueberschrift: () => {
    const t = zeigen(beispiel('ueberschrift'));
    tippe('Text', 'Neu');
    expect(t.letzter()).toMatchObject({ text: 'Neu' });
    knopf('Riesig');
    expect(t.letzter()).toMatchObject({ groesse: 'riesig' });
    knopf('Unterpunkt');
    expect(t.letzter()).toMatchObject({ ebene: 3 });
    fireEvent.click(screen.getByRole('checkbox', { name: /Punkt/ }));
    expect(t.letzter()).toMatchObject({ punkt: true });
  },
  akzentzeile: () => {
    const t = zeigen(beispiel('akzentzeile'));
    tippe('Text', 'Hallo!');
    expect(t.letzter()).toMatchObject({ text: 'Hallo!' });
  },
  text: () => {
    const t = zeigen({ typ: 'text', id: 'b1', markdown: 'Ein Wort' });
    const feld = screen.getByLabelText<HTMLTextAreaElement>('Text');
    feld.setSelectionRange(4, 8);
    knopf('Fett');
    expect(t.letzter()).toMatchObject({ markdown: 'Ein **Wort**' });
    for (const n of ['Kursiv', 'Link', 'Liste', 'Zwischenüberschrift'])
      expect(screen.getByRole('button', { name: n })).toBeTruthy();
    tippe('Text', 'Neu');
    expect(t.letzter()).toMatchObject({ markdown: 'Neu' });
  },
  bild: () => {
    const t = zeigen(beispiel('bild'));
    expect(screen.getByText(/Platzhalter-Bild/)).toBeTruthy();
    tippe('Beschreibung für Blinde und Suchmaschinen', 'Ein Haus');
    expect(t.letzter()).toMatchObject({ alt: 'Ein Haus' });
    tippe('Bildunterschrift (optional)', '');
    expect('unterschrift' in t.letzter()).toBe(false); // ein leeres Feld steht gar nicht erst im Baustein
    fireEvent.click(screen.getByRole('checkbox', { name: /füllt die ganze Spalte/ }));
    expect(t.letzter()).toMatchObject({ fuellen: true });
  },
  bildText: () => {
    const t = zeigen(beispiel('bildText'));
    knopf('Rechts');
    expect(t.letzter()).toMatchObject({ bildSeite: 'rechts' });
    tippe('Text', 'Neben dem Bild');
    expect(t.letzter()).toMatchObject({ markdown: 'Neben dem Bild' });
    tippe('Beschreibung für Blinde und Suchmaschinen', 'Gruppe');
    expect(t.letzter()).toMatchObject({ alt: 'Gruppe' });
  },
  galerie: () => {
    const t = zeigen(beispiel('galerie')); // zwei Bilder
    knopf('Bild');
    expect(t.letzter()).toMatchObject({ bilder: expect.arrayContaining([]) });
    expect((t.letzter() as Extract<Baustein, { typ: 'galerie' }>).bilder).toHaveLength(3);
    knopf('Bild 1 entfernen');
    expect((t.letzter() as Extract<Baustein, { typ: 'galerie' }>).bilder).toHaveLength(1);
    tippe('Beschreibung von Bild 1', 'Neu');
    expect((t.letzter() as Extract<Baustein, { typ: 'galerie' }>).bilder[0].alt).toBe('Neu');
  },
  knoepfe: () => {
    const t = zeigen(beispiel('knoepfe')); // zwei Knöpfe
    tippe('Beschriftung von Knopf 1', 'Los');
    expect(t.letzter()).toMatchObject({ knoepfe: [{ text: 'Los' }, expect.anything()] });
    tippe('Ziel von Knopf 1', 'seite:s2');
    expect((t.letzter() as Extract<Baustein, { typ: 'knoepfe' }>).knoepfe[0].ziel).toEqual({
      art: 'seite',
      seiteId: 's2',
    });
    tippe('Art von Knopf 1', 'neben');
    expect((t.letzter() as Extract<Baustein, { typ: 'knoepfe' }>).knoepfe[0].art).toBe('neben');
    knopf('Knopf');
    expect((t.letzter() as Extract<Baustein, { typ: 'knoepfe' }>).knoepfe).toHaveLength(3);
    knopf('Knopf 2 entfernen');
    expect((t.letzter() as Extract<Baustein, { typ: 'knoepfe' }>).knoepfe).toHaveLength(1);
  },
  beitraege: () => {
    const t = zeigen(beispiel('beitraege'));
    tippe('Wie viele Beiträge?', '7');
    expect(t.letzter()).toMatchObject({ anzahl: 7 });
    tippe(/Gruppen \(Nummern/, '3, 7');
    expect(t.letzter()).toMatchObject({ gruppen: [3, 7] });
    tippe(/Gruppen \(Nummern/, '');
    expect('gruppen' in t.letzter()).toBe(false);
  },
  termine: async () => {
    const t = zeigen(beispiel('termine')); // Kalender 1
    expect(await screen.findByRole('checkbox', { name: 'Jugend' })).toBeTruthy();
    expect(ctDaten).toHaveBeenCalledWith('/calendars');
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gemeindeveranstaltungen' }).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Jugend' }));
    expect(t.letzter()).toMatchObject({ kalender: [1, 2] });
    tippe('Wie viele Termine?', '12');
    expect(t.letzter()).toMatchObject({ anzahl: 12 });
  },
  slider: () => {
    const t = zeigen(beispiel('slider'));
    tippe('Wechsel nach (Sekunden)', '9');
    expect(t.letzter()).toMatchObject({ intervallSekunden: 9 });
  },
  livestream: () => {
    const t = zeigen(beispiel('livestream'));
    knopf('Archiv');
    expect(t.letzter()).toMatchObject({ zeigen: 'archiv' });
    tippe('Wie viele Videos im Archiv?', '5');
    expect(t.letzter()).toMatchObject({ archivAnzahl: 5 });
  },
  kontaktformular: () => {
    const t = zeigen(beispiel('kontaktformular'));
    tippe('Einleitung (optional)', 'Schreib uns');
    expect(t.letzter()).toMatchObject({ einleitung: 'Schreib uns' });
    tippe('Einleitung (optional)', '');
    expect('einleitung' in t.letzter()).toBe(false);
  },
  gruppenliste: () => {
    const t = zeigen(beispiel('gruppenliste'));
    tippe(/Gruppentypen/, '2, 4');
    expect(t.letzter()).toMatchObject({ gruppentypen: [2, 4] });
  },
  trenner: () => {
    const t = zeigen(beispiel('trenner'));
    knopf('Nur Abstand');
    expect(t.letzter()).toMatchObject({ art: 'abstand' });
  },
  html: () => {
    const t = zeigen(beispiel('html'));
    tippe('HTML-Code', '<p>Neu</p>');
    expect(t.letzter()).toMatchObject({ html: '<p>Neu</p>' });
  },
};

describe('Felder für alle Typen', () => {
  it('die Liste der Fälle deckt genau die Typen des Modells ab', () => {
    expect(Object.keys(FAELLE).sort()).toEqual([...BAUSTEIN_TYPEN].sort());
    expect(BAUSTEIN_TYPEN).toHaveLength(15);
  });

  for (const typ of BAUSTEIN_TYPEN)
    it(`${typ}: bearbeiten – jede Änderung ergibt einen gültigen Baustein`, async () => {
      await FAELLE[typ]();
    });
});

describe('Einzelheiten', () => {
  it('„Eigenes HTML“ ohne Recht: nur der Hinweis, kein Feld', () => {
    zeigen(beispiel('html'), false);
    expect(screen.getByText(/nur die Leitung/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Zahlen: eine ungültige Eingabe zeigt die Meldung und ändert den Baustein NICHT', () => {
    const t = zeigen(beispiel('beitraege'));
    tippe('Wie viele Beiträge?', '99');
    expect(screen.getByText(/Eine ganze Zahl von 1 bis 20/)).toBeTruthy();
    expect(t.onAendern).not.toHaveBeenCalled();
    tippe(/Gruppen \(Nummern/, '3, x');
    expect(screen.getByText(/Nur Zahlen, durch Komma getrennt/)).toBeTruthy();
    expect(t.onAendern).not.toHaveBeenCalled();
  });

  it('Knöpfe: mindestens einer, höchstens vier; „Andere Adresse“ prüft die Adresse', () => {
    const t = zeigen({
      typ: 'knoepfe',
      id: 'k',
      knoepfe: [{ text: 'A', ziel: { art: 'seite', seiteId: 's1' }, art: 'haupt' }],
    });
    expect(screen.getByRole('button', { name: 'Knopf 1 entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
    tippe('Ziel von Knopf 1', 'extern');
    const ziel = (t.onAendern.mock.calls.at(-1)?.[0] as Extract<Baustein, { typ: 'knoepfe' }>)
      .knoepfe[0].ziel;
    expect(ziel.art).toBe('extern');
    cleanupUndRender({
      typ: 'knoepfe',
      id: 'k',
      knoepfe: [{ text: 'A', ziel: { art: 'extern', url: 'javascript:alert(1)' }, art: 'haupt' }],
    });
    expect(screen.getByText(/Erlaubt sind nur Adressen/)).toBeTruthy();
  });

  it('Knöpfe: ein Ziel, das es nicht mehr gibt, wird benannt statt still ersetzt', () => {
    zeigen({
      typ: 'knoepfe',
      id: 'k',
      knoepfe: [{ text: 'A', ziel: { art: 'seite', seiteId: 'weg' }, art: 'haupt' }],
    });
    expect(screen.getByRole('option', { name: '(Ziel gibt es nicht mehr)' })).toBeTruthy();
  });

  it('Knöpfe: vier sind das Höchste', () => {
    zeigen({
      typ: 'knoepfe',
      id: 'k',
      knoepfe: [1, 2, 3, 4].map((n) => ({
        text: `K${n}`,
        ziel: { art: 'seite' as const, seiteId: 's1' },
        art: 'haupt' as const,
      })),
    });
    expect(screen.getByRole('button', { name: 'Knopf' })).toHaveProperty('disabled', true);
  });

  it('Termine: lassen sich die Kalender nicht laden, bleibt die Eingabe der Nummern', async () => {
    ctDaten.mockRejectedValue(new V.KeinSpeicherRecht('kein Recht'));
    const t = zeigen(beispiel('termine'));
    await waitFor(() => expect(screen.getByText(/lassen sich gerade nicht laden/)).toBeTruthy());
    tippe(/Kalender \(Nummern/, '1, 5');
    expect(t.letzter()).toMatchObject({ kalender: [1, 5] });
  });

  it('Termine: ein Kalender, den ChurchTools nicht (mehr) nennt, bleibt mit seiner Nummer erhalten und lässt sich abwählen', async () => {
    const t = zeigen({ typ: 'termine', id: 't', kalender: [1, 99], anzahl: 5 });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Kalender 99/ }));
    expect(t.letzter()).toMatchObject({ kalender: [1] });
  });

  it('Galerie: mindestens ein Bild', () => {
    zeigen({ typ: 'galerie', id: 'g', bilder: [{ bild: { id: 'platzhalter' }, alt: 'x' }] });
    expect(screen.getByRole('button', { name: 'Bild 1 entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

import { cleanup } from '@testing-library/react';
function cleanupUndRender(b: Baustein) {
  cleanup();
  zeigen(b);
}
