// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { neueAufgabe, statusSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { Block } from '@shared/protokolle/dokument';
import { festePunkteFesthalten } from '@shared/protokolle/festePunkte';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { VerweisBlock } from './EditorBloecke';

/** Die festen Punkte (S4-3a) in der Lese-Ansicht – über den echten Rahmen, so wie Sitzung und Editor sie zeigen. */

const t = (text: string) => [{ type: 'text', text, styles: {} }];

const kopf = (sitzung: string, beginn: string, status: ProtokollKopf['status']): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung,
  titel: 'Leitungssitzung',
  status,
  beginn,
  termin: null,
  treffen: null,
  freigabe: status === 'frei' ? { von: 1, am: '2026-10-15T08:00:00Z' } : null,
  sperre: null,
  stand: 'x',
});
const sitzungAus = (k: ProtokollKopf): Sitzung => ({
  schluessel: `p:${k.sitzung}`,
  beginn: k.beginn,
  titel: k.titel,
  termin: null,
  treffen: null,
  kopf: k,
  anfragen: [],
});

const ALT_DOK: Block[] = [
  { id: 'a1', type: 'heading', props: { level: 1 }, content: t('Finanzen'), children: [] },
  { id: 'a2', type: 'beschluss', content: t('Budget freigegeben'), children: [] },
  { id: 'a3', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
];
const altTeile = teileBauen(ALT_DOK, 'okt');
const ALT = sitzungAus({ ...kopf('okt', '2026-10-14T17:00:00Z', 'frei'), stand: altTeile.stand });
const TEILE = altTeile.werte.map((w) => JSON.parse(w) as ProtokollTeil);
const HEUTE = sitzungAus(kopf('heute', '2026-10-28T17:00:00Z', 'entwurf'));
const SEPT = sitzungAus(kopf('sept', '2026-09-09T17:00:00Z', 'frei'));

const aufgabe = (id: string, extra: Partial<Parameters<typeof neueAufgabe>[0]> = {}): Aufgabe =>
  neueAufgabe({
    id,
    gruppe: 194,
    sitzung: 'okt',
    text: id,
    von: 1,
    am: '2026-10-14T18:00:00Z',
    ...extra,
  });
const AUFGABEN = [
  aufgabe('Beamer kaufen', { bis: '2026-10-01', extern: 'Hausmeister Müller' }),
  aufgabe('Hier entstanden', { sitzung: 'heute' }),
  statusSetzen(aufgabe('Raum gebucht'), 'erledigt', 1, '2026-10-20T10:00:00Z'),
];

const DOK: Block[] = [
  { id: 'p1', type: 'heading', props: { level: 1 }, content: t('Offene To-Dos'), children: [] },
  { id: 'v1', type: 'verweis', props: { art: 'offene-aufgaben' }, children: [] },
  { id: 'p2', type: 'heading', props: { level: 1 }, content: t('Letztes Mal'), children: [] },
  { id: 'v2', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
];

const zeige = (dok: Block[] = DOK, extra: { status?: () => void } = {}) =>
  render(
    <FestePunkteRahmen
      sitzung={HEUTE}
      gruppe={194}
      protokolle={[SEPT, ALT]}
      teile={TEILE}
      aufgaben={AUFGABEN}
      zeitzone="Europe/Berlin"
      {...extra}
    >
      <ProtokollAnsicht dokument={dok} aufgaben={AUFGABEN} />
    </FestePunkteRahmen>,
  );

describe('Fester Punkt „Offene To-Dos“', () => {
  it('zeigt die offenen von früher mit Extern und Bis – nicht die dieser Sitzung', () => {
    zeige();
    expect(screen.getByText('Beamer kaufen')).toBeTruthy();
    expect(screen.getByText(/Hausmeister Müller \(extern\)/)).toBeTruthy();
    expect(screen.getByText(/überfällig · 01\.10\.2026/)).toBeTruthy();
    expect(screen.queryByText('Hier entstanden')).toBeNull();
  });

  it('„seit der Sitzung am … erledigt“ ist eingeklappt und klappt auf', () => {
    zeige();
    const knopf = screen.getByRole('button', {
      name: /Seit der Sitzung am 14\.10\.2026 erledigt · 1/,
    });
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Raum gebucht')).toBeNull();
    fireEvent.click(knopf);
    expect(screen.getByText('Raum gebucht')).toBeTruthy();
  });

  it('in der Lese-Ansicht nur Anzeige – der Kreis ist kein Knopf zum Abhaken, auch wenn es einen Weg gäbe', () => {
    const status = vi.fn();
    zeige(DOK, { status });
    const kreis = screen.getAllByRole('button', { name: /Status: offen/ })[0] as HTMLButtonElement;
    expect(kreis.disabled).toBe(true);
    fireEvent.click(kreis);
    expect(status).not.toHaveBeenCalled();
  });

  it('festgehalten (Freigabe): genau die gemerkten – auch wenn inzwischen neue dazukamen', () => {
    const fest = festePunkteFesthalten(DOK, {
      offen: { offen: [AUFGABEN[2]], erledigt: [], seit: null },
      letztes: null,
    });
    zeige(fest);
    expect(screen.queryByText('Beamer kaufen')).toBeNull();
    // gemerkt als offen, heute erledigt: steht da, durchgestrichen
    expect(screen.getByText('Raum gebucht')).toBeTruthy();
    expect(screen.getByText('Keine frühere Sitzung mit Protokoll.')).toBeTruthy();
  });
});

describe('Fester Punkt „Letztes Protokoll“', () => {
  it('zeigt das letzte freigegebene und öffnet es im Fenster – dort ohne weiteres „Öffnen“', () => {
    zeige();
    expect(screen.getByText(/vom 14\.10\.2026 · freigegeben am 15\.10\.2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    const fenster = screen.getByRole('dialog', { name: 'Leitungssitzung · 14.10.2026' });
    expect(within(fenster).getByText('Budget freigegeben')).toBeTruthy();
    // Im alten Protokoll: dessen eigenes „Letztes Protokoll“ (September) – aber kein Fenster im Fenster.
    expect(within(fenster).getByText(/vom 09\.09\.2026/)).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Öffnen' })).toBeNull();
    fireEvent.click(within(fenster).getAllByRole('button', { name: 'Schließen' })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ohne Rahmen (kein Wissen über die Sitzung): ein ruhiger Satz statt einer falschen Liste', () => {
    render(<ProtokollAnsicht dokument={DOK} />);
    expect(screen.getByText(/offenen To-Dos der Gruppe/)).toBeTruthy();
    expect(screen.getByText(/Protokoll der letzten Sitzung/)).toBeTruthy();
  });
});

describe('Fester Punkt im Editor', () => {
  it('ein Klick in den Kasten setzt weder Cursor noch erreicht er den Editor – Knöpfe bleiben bedienbar', () => {
    const editor = document.createElement('div');
    const editorHoert = vi.fn();
    editor.addEventListener('mousedown', editorHoert);
    document.body.append(editor);
    render(
      <FestePunkteRahmen
        sitzung={HEUTE}
        gruppe={194}
        protokolle={[SEPT, ALT]}
        teile={TEILE}
        aufgaben={AUFGABEN}
        zeitzone="Europe/Berlin"
      >
        <VerweisBlock block={{ props: { art: 'letztes-protokoll', fest: '' } }} />
      </FestePunkteRahmen>,
      { container: editor },
    );
    const text = screen.getByText('Leitungssitzung');
    const druck = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    text.dispatchEvent(druck);
    expect(druck.defaultPrevented).toBe(true);
    expect(editorHoert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    editor.remove();
  });
});
