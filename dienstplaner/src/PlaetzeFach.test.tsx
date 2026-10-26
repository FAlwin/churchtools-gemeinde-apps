// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { PlaetzeFach, type PlaetzeZeile } from './PlaetzeFach';
import { anzahlFehlerText } from './plaetzeTexte';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

const LICHT: PlaetzeZeile = { serviceId: 7, name: 'Licht', anzahl: 1, belegt: 0, entwuerfe: 0 };
const TON: PlaetzeZeile = { serviceId: 6, name: 'Ton', anzahl: 1, belegt: 1, entwuerfe: 0 };
const VIDEO: PlaetzeZeile = { serviceId: 8, name: 'Video', anzahl: 0, belegt: 0, entwuerfe: 0 };
const KAMERA: PlaetzeZeile = { serviceId: 9, name: 'Kamera', anzahl: 1, belegt: 0, entwuerfe: 1 };
type Aendern = (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;

function zeige(aendern: Aendern = (_z, _g, neu) => Promise.resolve({ ok: true, anzahl: neu })) {
  const p = { aendern: vi.fn(aendern), onGespeichert: vi.fn(), onClose: vi.fn() };
  render(
    <PlaetzeFach
      titel="Technik · Plätze"
      unter="Gottesdienst · So, 25.10."
      zeilen={[LICHT, TON, VIDEO, KAMERA]}
      {...p}
    />,
  );
  return p;
}
const knopf = (name: string) => screen.getByRole('button', { name });
const zahl = (dienst: string) =>
  screen.getByLabelText(new RegExp(`^${dienst}: \\d+ Plätze$`)).textContent;

describe('PlaetzeFach (E4-5-3)', () => {
  it('je Dienst Zahl und Stand; „−“ gesperrt bei belegten und bei 0', () => {
    zeige();
    expect(screen.getAllByText('frei')).toHaveLength(2); // Licht und Kamera
    expect(screen.getByText('1 belegt')).toBeTruthy();
    expect(screen.getByText('nicht vorgesehen')).toBeTruthy();
    expect(knopf('Ton: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(knopf('Video: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(knopf('Licht: ein Platz weniger')).toHaveProperty('disabled', false);
  });

  it('liegen Entwürfe dort, bleibt die Zahl (ChurchTools nummeriert sonst die Plätze neu) – mit Hinweis', () => {
    zeige();
    expect(knopf('Kamera: ein Platz mehr')).toHaveProperty('disabled', true);
    expect(knopf('Kamera: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(screen.getByText(/Hier liegt ein Entwurf – erst senden oder entfernen\./)).toBeTruthy();
  });

  it('„+“ speichert sofort mit der gesehenen Zahl; danach zählt die neue, der Aufrufer sagt Bescheid', async () => {
    const p = zeige();
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    await waitFor(() => expect(zahl('Licht')).toBe('2'));
    expect(p.aendern).toHaveBeenLastCalledWith(LICHT, 1, 2);
    expect(p.onGespeichert).toHaveBeenCalledWith('Licht: jetzt 2 Plätze.');
    fireEvent.click(knopf('Licht: ein Platz weniger'));
    await waitFor(() => expect(p.aendern).toHaveBeenLastCalledWith(LICHT, 2, 1));
    expect(p.onGespeichert).toHaveBeenLastCalledWith('Licht: jetzt 1 Platz.');
    fireEvent.click(knopf('Schließen'));
    expect(p.onClose).toHaveBeenCalledWith(true);
  });

  it('während des Speicherns: alle Knöpfe gesperrt, Schließen geht nicht', async () => {
    let fertig!: (r: AnzahlErgebnis) => void;
    const p = zeige(() => new Promise((r) => (fertig = r)));
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect(knopf('Ton: ein Platz mehr')).toHaveProperty('disabled', true);
    expect(zahl('Licht')).toBe('…');
    // Sichtbar gesperrt wie im ConfirmDialog (E6-O F2, #720), nicht nur wirkungslos.
    expect(knopf('Schließen')).toHaveProperty('disabled', true);
    expect(knopf('Fenster schließen')).toHaveProperty('disabled', true);
    fireEvent.click(knopf('Schließen'));
    expect(p.onClose).not.toHaveBeenCalled();
    await act(async () => fertig({ ok: true, anzahl: 2 }));
    expect(knopf('Ton: ein Platz mehr')).toHaveProperty('disabled', false);
  });

  it('Konflikt: sagt es, übernimmt die Zahl aus ChurchTools – der nächste Tipp geht von ihr aus', async () => {
    const aendern = vi
      .fn<Aendern>()
      .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: 3 })
      .mockResolvedValueOnce({ ok: true, anzahl: 4 });
    const p = zeige(aendern);
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Licht: Jemand hat die Zahl eben geändert – jetzt 3. Nichts geändert.',
    );
    expect(zahl('Licht')).toBe('3');
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    await waitFor(() => expect(aendern).toHaveBeenLastCalledWith(LICHT, 3, 4));
    expect(p.onGespeichert).toHaveBeenCalledTimes(1);
  });

  it('nichts geändert (Fehler ohne neue Zahl) → Schließen meldet „nichts geändert“', async () => {
    const p = zeige(() => Promise.resolve({ ok: false, grund: 'kein-recht' }));
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/erlaubt dir nicht/);
    expect(zahl('Licht')).toBe('1');
    fireEvent.click(knopf('Schließen'));
    expect(p.onClose).toHaveBeenCalledWith(false);
  });
});

describe('anzahlFehlerText', () => {
  it('jeder Grund hat seinen eigenen Text', () => {
    const gruende = [
      'konflikt',
      'belegt',
      'weg',
      'kein-recht',
      'abgemeldet',
      'voruebergehend',
      'nicht-angekommen',
    ] as const;
    const texte = gruende.map((grund) => anzahlFehlerText({ ok: false, grund, jetzt: 2 }));
    expect(new Set(texte).size).toBe(gruende.length);
  });
});

describe('PlaetzeFach im ChurchTools-Aufbau', () => {
  it('nur ansehen: X oben, unten nur Schließen', () => {
    zeige();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().at(-1)).toBe('Schließen');
  });
});
