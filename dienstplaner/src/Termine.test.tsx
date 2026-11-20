// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LEERER_PLAN, zeile, mein } from '@shared/dienstplan/zeile.testutil';
import { Termine } from './Termine';
import type { Tausch } from './useTausch';
import { tauschAttrappe } from './tausch.testutil';
import { mehrEintrag, mehrEintragOder } from './mehrMenue.testutil';

const z = zeile;

const ZEILEN = [
  z(1, 'Gottesdienst', '2026-10-18', {
    meine: [mein('Ton', true), mein('Gesang', false)],
    geplant: 3,
    frei: 2,
  }),
  z(2, 'Gebetsabend', '2026-10-21', { geplant: 1 }),
  z(3, 'Gottesdienst', '2026-11-01'),
  z(4, 'Gebetsabend', '2026-11-04'),
  z(5, 'Gemeindeversammlung', '2026-11-08', { abgesagt: true }),
];

function zeige(planer = true, tausch?: Tausch, zeilen = ZEILEN) {
  const onMehr = vi.fn();
  render(
    <Termine
      zustand={{ art: 'fertig', zeilen, plan: LEERER_PLAN, wochen: 8 }}
      planer={planer}
      onNochmal={() => {}}
      onMehr={onMehr}
      tausch={tausch}
    />,
  );
  return { onMehr };
}

const titel = () =>
  screen.queryAllByRole('listitem').map((li) => li.querySelector('b')?.textContent);

beforeEach(() => localStorage.clear());

describe('Termine (E3-2)', () => {
  it('Vorgabe „Meine“: nur Termine mit eigenem Dienst, mit zugesagt/angefragt', () => {
    zeige();
    expect(titel()).toEqual(['Gottesdienst']);
    const reihe = screen.getAllByRole('listitem')[0];
    expect(within(reihe).getByText('Ton')).toBeTruthy();
    expect(within(reihe).getByText(/Gesang · angefragt/)).toBeTruthy();
    expect(within(reihe).getByText('So, 18.10. · 10:00 Uhr')).toBeTruthy();
  });

  it('„Alle“: nach Monaten, Planer sehen „N frei“ und den Haken nur bei eigenen Plätzen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Oktober 2026',
      'November 2026',
    ]);
    expect(titel()).toHaveLength(5);
    expect(screen.getByText('2 frei')).toBeTruthy();
    // Termin 2 hat Plätze der eigenen Gruppen, alle besetzt → Haken; 3 und 4 haben keine → nichts.
    expect(screen.getAllByLabelText('alles besetzt')).toHaveLength(1);
    expect(screen.getByText('abgesagt')).toBeTruthy();
  });

  it('Hilfe im „⋯“-Menü statt Fußnote: Eintrag da, Fenster nennt, was man unter „Alle“ sieht', () => {
    zeige();
    expect(screen.queryByText(/entscheidet ChurchTools \(Kalender-Rechte\)/)).toBeNull();
    // Kein eigener „?“-Knopf mehr in der Zeile (B4).
    expect(screen.queryByRole('button', { name: 'Hilfe zu Dienste' })).toBeNull();
    mehrEintrag('Hilfe');
    expect(screen.getByRole('dialog', { name: 'Hilfe · Dienste' })).toBeTruthy();
    expect(screen.getByText(/entscheidet ChurchTools \(Kalender-Rechte\)/)).toBeTruthy();
  });

  it('Nicht-Planer sehen keine freien Plätze', () => {
    zeige(false);
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(screen.queryByText(/frei$/)).toBeNull();
    expect(screen.queryByLabelText('alles besetzt')).toBeNull();
  });

  it('Filter nach Veranstaltung: Reihen und „Weitere“; abwählen blendet aus', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const filter = screen.getByRole('group', { name: 'Veranstaltungen' });
    expect(
      within(filter)
        .getAllByRole('checkbox')
        .map((b) => b.closest('label')!.textContent),
    ).toEqual(['Gebetsabend', 'Gottesdienst', 'Weitere']);
    fireEvent.click(within(filter).getByRole('checkbox', { name: 'Gebetsabend' }));
    fireEvent.click(within(filter).getByRole('checkbox', { name: 'Weitere' }));
    expect(titel()).toEqual(['Gottesdienst', 'Gottesdienst']);
    // Der Knopf sagt, wie viel ausgeblendet ist.
    expect(screen.getByRole('button', { name: 'Filter, 2 ausgeblendet' })).toBeTruthy();
  });

  it('Filter nach Kalender (Wunsch 6): oben, umbenannte bleiben, „Veranstaltungen“ nur aus angehakten, gemerkt', () => {
    const GD = { id: 1, name: 'Gottesdienste' };
    const GV = { id: 2, name: 'Gemeindeveranstaltungen' };
    const zeilen = [
      z(1, 'Gottesdienst', '2026-10-18', { kalender: GD }),
      z(2, 'Gebetsabend', '2026-10-21', { kalender: GV }),
      z(3, 'Gottesdienst', '2026-11-01', { kalender: GD }),
      z(4, 'Gebetsabend', '2026-11-04', { kalender: GV }),
      z(5, 'Ostergottesdienst', '2026-11-08', { kalender: GD }),
    ];
    const { unmount } = render(
      <Termine
        zustand={{ art: 'fertig', zeilen, plan: LEERER_PLAN, wochen: 8 }}
        planer
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const legenden = within(screen.getByRole('dialog', { name: 'Filter' }))
      .getAllByRole('group')
      .map((g) => g.querySelector('legend')?.textContent);
    expect(legenden).toEqual(['Kalender', 'Veranstaltungen']);
    const kalender = within(screen.getByRole('group', { name: 'Kalender' }));
    fireEvent.click(kalender.getByRole('checkbox', { name: 'Gemeindeveranstaltungen' }));
    expect(titel()).toEqual(['Gottesdienst', 'Gottesdienst', 'Ostergottesdienst']);
    expect(
      within(screen.getByRole('group', { name: 'Veranstaltungen' }))
        .getAllByRole('checkbox')
        .map((b) => b.closest('label')!.textContent),
    ).toEqual(['Gottesdienst', 'Weitere']);
    unmount();
    zeige(true, undefined, zeilen);
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(titel()).toEqual(['Gottesdienst', 'Gottesdienst', 'Ostergottesdienst']);
  });

  it('nur ein Kalender (oder keiner bekannt) → kein Abschnitt „Kalender“', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.queryByRole('group', { name: 'Kalender' })).toBeNull();
  });

  it('die Wahl bleibt nach dem Neuladen erhalten (im Gerät gemerkt)', () => {
    const { unmount } = render(
      <Termine
        zustand={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        planer
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    unmount();
    zeige();
    expect(titel()).toHaveLength(5);
  });

  it('keine eigenen Dienste → sagt es und verweist auf „Alle“; Nachladen bleibt möglich', () => {
    render(
      <Termine
        zustand={{
          art: 'fertig',
          zeilen: [z(2, 'Gebetsabend', '2026-10-21')],
          plan: LEERER_PLAN,
          wochen: 8,
        }}
        planer={false}
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    expect(screen.getByText(/In den nächsten 8 Wochen hast du keine Dienste/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Weitere Wochen laden' })).toBeTruthy();
    // Der Satz führt mit einem Link zu „Alle“ (B4).
    fireEvent.click(screen.getByRole('button', { name: 'Alle Termine zeigen' }));
    expect(titel()).toEqual(['Gebetsabend']);
    expect(screen.getByRole('button', { name: 'Alle' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Alle Termine zeigen' })).toBeNull();
  });

  it('„Weitere Wochen laden“ ruft das Nachladen; bis die Antwort da ist: „wird geladen …“, gesperrt', () => {
    const onMehr = vi.fn();
    const el = (zustand: Parameters<typeof Termine>[0]['zustand']) => (
      <Termine zustand={zustand} planer onNochmal={() => {}} onMehr={onMehr} />
    );
    const fertig = { art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 } as const;
    const { rerender } = render(el(fertig));
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Wochen laden' }));
    expect(onMehr).toHaveBeenCalledTimes(1);
    // Das Bisherige bleibt stehen (still nachladen) – kein Doppelklick, der zweimal lädt.
    const knopf = screen.getByRole('button', { name: 'wird geladen …' });
    expect(knopf).toHaveProperty('disabled', true);
    expect(titel()).toEqual(['Gottesdienst']); // Vorgabe „Meine“
    rerender(el({ ...fertig, wochen: 16 }));
    expect(screen.getByRole('button', { name: 'Weitere Wochen laden' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('Nachladen schlägt fehl → Liste bleibt, Fehlerkasten; „Erneut versuchen“ lädt wieder', () => {
    const onMehr = vi.fn();
    render(
      <Termine
        zustand={{
          art: 'fertig',
          zeilen: ZEILEN,
          plan: LEERER_PLAN,
          wochen: 8,
          nachladeFehler: { text: 'ChurchTools antwortet gerade nicht.', nochmal: true },
        }}
        planer
        onNochmal={() => {}}
        onMehr={onMehr}
      />,
    );
    expect(titel()).toEqual(['Gottesdienst']); // Vorgabe „Meine“
    expect(screen.getByText('ChurchTools antwortet gerade nicht.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onMehr).toHaveBeenCalledTimes(1);
  });

  it('Ladefehler: gemeinsamer Fehlerkasten mit „Erneut versuchen“', () => {
    const onNochmal = vi.fn();
    render(
      <Termine
        zustand={{
          art: 'fehler',
          fehler: { text: 'ChurchTools antwortet gerade nicht.', nochmal: true },
        }}
        planer={false}
        onNochmal={onNochmal}
        onMehr={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onNochmal).toHaveBeenCalled();
  });
});

describe('Termine → Termin-Ansicht (E6-1b)', () => {
  it('eine Zeile antippen öffnet den Termin; ohne Anschluss bleibt die Zeile reiner Text', () => {
    const onTermin = vi.fn();
    render(
      <Termine
        zustand={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        planer
        onNochmal={() => {}}
        onMehr={() => {}}
        onTermin={onTermin}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend.*21/ }));
    expect(onTermin).toHaveBeenCalledWith(2);
    cleanup();
    zeige();
    expect(screen.queryByRole('button', { name: /Gottesdienst/ })).toBeNull();
  });
});

describe('Dienste: Tauschen (E7-3)', () => {
  it('an jedem eigenen Dienst „Tauschen“ – auch an zugesagten', () => {
    // Mit bekanntem Platz – ohne `ort` gibt es nichts zu tauschen.
    const mitPlatz = ZEILEN.map((z) => ({
      ...z,
      meine: z.meine.map((d, i) => ({ ...d, ort: { serviceId: 1, index: i } })),
    }));
    zeige(false, tauschAttrappe(), mitPlatz);
    const eigene = mitPlatz.reduce((n, z) => n + z.meine.length, 0);
    expect(eigene).toBeGreaterThan(1);
    expect(screen.getAllByRole('button', { name: /Tauschen/ })).toHaveLength(eigene);
  });
});

describe('Dienste: Werkzeugzeile (Ruhige Bedienung B4, R5/R6)', () => {
  const zeigeMit = (handy: boolean, ich = true) =>
    render(
      <Termine
        zustand={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        planer
        onNochmal={() => {}}
        onMehr={() => {}}
        handy={handy}
        ich={ich ? { id: 1, name: 'Alwin Friesen', gemeinde: null } : undefined}
      />,
    );

  it('Rechner: eine Werkzeugzeile über der Karte – links „Meine | Alle“, rechts Filter und „Mehr“, sonst nichts', () => {
    zeigeMit(false);
    const zeile = screen.getByRole('toolbar', { name: 'Werkzeuge' });
    const karte = screen.getByRole('region', { name: 'Dienste' });
    // Über der Karte, nicht darin.
    expect(zeile.compareDocumentPosition(karte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(karte.contains(zeile)).toBe(false);
    expect(
      within(zeile)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Meine', 'Alle', 'Filter', 'Mehr']);
    // Kein gefüllter (Haupt-/Neu-)Knopf: die Seite hat keine Hauptaktion (R1).
    expect(screen.queryByRole('heading', { name: 'Dienste', level: 2 })).toBeNull();
  });

  it('das „⋯“-Menü: „Teilen“ nur bei „Meine“, „Hilfe“ immer – jeder Eintrag tut seins', () => {
    zeigeMit(false);
    expect(mehrEintragOder('Teilen')).toBeTruthy();
    expect(mehrEintragOder('Hilfe')).toBeTruthy();
    mehrEintrag('Hilfe');
    expect(screen.getByRole('dialog', { name: 'Hilfe · Dienste' })).toBeTruthy();
    // „Teilen“ öffnet sein Fenster erst nach dem Schließen des Menüs (Lehre 05.08.2026) – hier: das Menü ist zu.
    expect(screen.queryByRole('menu', { name: 'Mehr' })).toBeNull();
  });

  it('ohne „ich“ gibt es kein „Teilen“, aber weiter die Hilfe', () => {
    zeigeMit(false, false);
    expect(mehrEintragOder('Teilen')).toBeNull();
    expect(mehrEintragOder('Hilfe')).toBeTruthy();
  });

  it('Handy: die Ansicht ist ein Knopf mit Blatt, „Mehr“ ein Blatt von unten – dieselben Einträge', () => {
    zeigeMit(true);
    expect(screen.queryByRole('group', { name: 'Welche Termine' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Welche Termine: Meine' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Welche Termine' })).getByRole('button', {
        name: 'Alle',
      }),
    );
    expect(titel()).toHaveLength(5);
    mehrEintrag('Hilfe');
    expect(screen.getByRole('dialog', { name: 'Hilfe · Dienste' })).toBeTruthy();
  });

  it('„Weitere Wochen laden“ steht unter der Karte, nicht darin', () => {
    zeigeMit(false);
    const karte = screen.getByRole('region', { name: 'Dienste' });
    const mehr = screen.getByRole('button', { name: 'Weitere Wochen laden' });
    expect(karte.contains(mehr)).toBe(false);
  });
});
