// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { anfangsOffen } from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import { drucken } from './drucken';
import { DruckFenster } from './DruckFenster';

// jsdom hat keine Zeichenfläche zum Messen – geschätzt wie im Browser ohne Canvas.
vi.mock('./textBreite', () => ({ textBreite: (t: string) => t.length * 8 }));
// Gedruckt wird im Browser – hier nur, WAS gedruckt würde.
vi.mock('./drucken', async (original) => ({
  ...(await original<typeof import('./drucken')>()),
  drucken: vi.fn(() => Promise.resolve()),
}));
const druck = vi.mocked(drucken);

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const BAUM = [
  g(10, 'Gottesdienst', [g(7, 'Technik', [g(12, 'Stream'), g(15, 'Ton')]), g(8, 'Predigt')]),
  g(47, 'Café'),
];

afterEach(() => druck.mockClear());

function zeigen(extra: Partial<Parameters<typeof DruckFenster>[0]> = {}) {
  const onSchliessen = vi.fn();
  render(
    <DruckFenster
      baum={BAUM}
      gemeinde="ECG"
      offen={anfangsOffen(BAUM)}
      spitze={null}
      ansicht="karten"
      onSchliessen={onSchliessen}
      {...extra}
    />,
  );
  return { onSchliessen };
}
const vorschau = () => screen.getByRole('figure', { name: 'Vorschau' });
const auswahl = (name: string) => screen.getByLabelText<HTMLSelectElement>(name);

describe('Drucken / PDF (O7b-4)', () => {
  it('übernimmt den Reiter – aus Karten wird „von oben“ –, druckt anfangs alles aufgeklappt', () => {
    zeigen();
    expect(auswahl('Ansicht').value).toBe('oben');
    expect(auswahl('Ausschnitt').value).toBe('');
    expect(auswahl('Papier').value).toBe('a4-quer');
    const v = vorschau();
    expect(v.textContent).toContain('Organigramm · ECG');
    expect(v.textContent).toContain('Stand ');
    // Technik ist im Reiter zu – „alles aufgeklappt“ zeigt Stream trotzdem.
    expect(v.querySelector('svg')!.textContent).toContain('Stream');
    // Auf Papier gibt es nichts zu klappen und nichts zu klicken.
    expect(v.querySelectorAll('circle')).toHaveLength(0);
    expect(within(v).queryAllByRole('button')).toHaveLength(0);
  });

  it('ohne „alles aufgeklappt“ wie im Reiter; Ausschnitt und Liste wirken auf die Vorschau', () => {
    zeigen({ ansicht: 'mindmap' });
    expect(auswahl('Ansicht').value).toBe('mindmap');
    fireEvent.click(screen.getByLabelText('Alles aufgeklappt drucken'));
    expect(vorschau().textContent).not.toContain('Stream');
    fireEvent.change(auswahl('Ausschnitt'), { target: { value: '10' } });
    expect(vorschau().textContent).toContain('Organigramm · Gottesdienst');
    expect(vorschau().textContent).not.toContain('Café');
    fireEvent.change(auswahl('Ansicht'), { target: { value: 'liste' } });
    expect(vorschau().querySelector('svg[role="img"]')).toBeNull();
    expect(within(vorschau()).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(vorschau()).queryAllByRole('button')).toHaveLength(0);
  });

  it('eine tiefere Spitze aus dem Reiter steht als Ausschnitt bereit', () => {
    zeigen({ spitze: '10/7', ansicht: 'links' });
    expect(auswahl('Ausschnitt').value).toBe('10/7');
    expect(auswahl('Ausschnitt').selectedOptions[0].text).toBe('Technik');
    expect(vorschau().textContent).toContain('Organigramm · Technik');
  });

  it('das Papier bestimmt die Form der Vorschau', () => {
    zeigen();
    expect(vorschau().style.aspectRatio).toBe('297 / 210');
    fireEvent.change(auswahl('Papier'), { target: { value: 'a4-hoch' } });
    expect(vorschau().style.aspectRatio).toBe('210 / 297');
  });

  it('Drucken: genau die Vorschau, mit Seitengröße – danach zu', async () => {
    const { onSchliessen } = zeigen();
    fireEvent.change(auswahl('Papier'), { target: { value: 'a3-quer' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }));
    });
    expect(druck).toHaveBeenCalledTimes(1);
    const html = druck.mock.calls[0][0];
    expect(html).toContain('@page { size: A3 landscape');
    expect(html).toContain('<title>Organigramm · ECG</title>');
    expect(html).toContain('Stream');
    expect(html).not.toContain('<circle');
    expect(onSchliessen).toHaveBeenCalled();
  });

  it('lässt sich das Drucken nicht starten: Meldung, Fenster bleibt offen', async () => {
    druck.mockRejectedValueOnce(new Error('kein Rahmen'));
    const { onSchliessen } = zeigen();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('nicht starten');
    expect(onSchliessen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeTruthy();
  });
});
