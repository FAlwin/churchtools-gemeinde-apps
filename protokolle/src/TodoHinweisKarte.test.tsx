// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import * as T from './todoHinweis';
import { TodoHinweisKarte } from './TodoHinweisKarte';

vi.mock('./todoHinweis', () => ({ ladeVorlauf: vi.fn(), vorlaufSpeichern: vi.fn() }));
const m = vi.mocked(T);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.ladeVorlauf.mockResolvedValue(3);
  m.vorlaufSpeichern.mockResolvedValue(undefined);
});

const feld = () => screen.findByRole<HTMLSelectElement>('combobox', { name: /Wann weist/ });

describe('Karte „Hinweis auf fällige To-Dos“ (Verwaltung)', () => {
  it('zeigt den eingestellten Wert; alle sechs Möglichkeiten stehen zur Wahl', async () => {
    m.ladeVorlauf.mockResolvedValue(7);
    render(<TodoHinweisKarte modul={24} onHinweis={vi.fn()} />);
    const f = await feld();
    expect(f.value).toBe('7');
    expect([...f.options].map((o) => o.value)).toEqual([
      'aus',
      'ueberfaellig',
      '1',
      '3',
      '7',
      '14',
    ]);
  });

  it('Wahl schreibt den Wert (Zahl als Zahl, „aus“ als Text), meldet ihn nach oben und sagt „gespeichert“', async () => {
    const onHinweis = vi.fn();
    const onVorlauf = vi.fn();
    render(<TodoHinweisKarte modul={24} onHinweis={onHinweis} onVorlauf={onVorlauf} />);
    fireEvent.change(await feld(), { target: { value: '14' } });
    await waitFor(() => expect(onHinweis).toHaveBeenCalledWith('Hinweis gespeichert'));
    expect(m.vorlaufSpeichern).toHaveBeenCalledWith(24, 14);
    expect(onVorlauf).toHaveBeenCalledWith(14);

    fireEvent.change(await feld(), { target: { value: 'aus' } });
    await waitFor(() => expect(onVorlauf).toHaveBeenCalledWith('aus'));
    expect(m.vorlaufSpeichern).toHaveBeenLastCalledWith(24, 'aus');
    expect(m.vorlaufSpeichern).toHaveBeenCalledTimes(2);
  });

  it('dieselbe Wahl nochmal: nichts wird geschrieben', async () => {
    render(<TodoHinweisKarte modul={24} onHinweis={vi.fn()} />);
    fireEvent.change(await feld(), { target: { value: '3' } });
    expect(m.vorlaufSpeichern).not.toHaveBeenCalled();
  });

  it('Speichern scheitert: Fehler steht da, die alte Wahl bleibt, nach oben geht nichts', async () => {
    m.vorlaufSpeichern.mockRejectedValue(new NichtUebernommen('die Einstellung'));
    const onVorlauf = vi.fn();
    const onHinweis = vi.fn();
    render(<TodoHinweisKarte modul={24} onHinweis={onHinweis} onVorlauf={onVorlauf} />);
    fireEvent.change(await feld(), { target: { value: '1' } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht übernommen/);
    expect((await feld()).value).toBe('3');
    expect(onVorlauf).not.toHaveBeenCalled();
    expect(onHinweis).not.toHaveBeenCalled();
  });

  it('Lesefehler: „Erneut versuchen“ statt eines erfundenen Standards; danach geht es', async () => {
    m.ladeVorlauf.mockRejectedValueOnce(new ApiError(503, 'weg'));
    render(<TodoHinweisKarte modul={24} onHinweis={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect((await feld()).value).toBe('3');
    expect(m.ladeVorlauf).toHaveBeenCalledTimes(2);
  });
});
