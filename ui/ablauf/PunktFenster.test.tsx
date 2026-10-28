// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus, zeitPlus, zustaendigText } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { ABLAUFPUNKT_GRENZEN } from '@shared/types/index';
import { fensterKnoepfe } from '../fenster/fenster.testutil';
import { PunktFenster } from './PunktFenster';

/**
 * Das Punkt-Fenster als gemeinsamer Baustein (E6-2b-2). Die Musik-App steckt ihre Liedwahl ein (geprüft in
 * `client/src/components/LiedVerknuepfen.test.tsx`); hier zählt der Vertrag: **ohne** Liedwahl nur anzeigen
 * (Dienstplaner, „Lieder nur anzeigen"), **mit** Liedwahl füllt sie im Lied-Modus das Fenster und ihre Wahl wird
 * erst mit „Speichern" geschrieben.
 */
afterEach(cleanup);

const zeile = (item: Partial<CtAgendaItem>) =>
  ablaufZeileAus({ id: 1, title: 'Lied', duration: 300, ...item }, 7, 'Europe/Berlin');

function zeige(
  item = zeile({ song: { title: 'Treu' } as never }),
  liedWahl?: Parameters<typeof PunktFenster>[0]['liedWahl'],
) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onSetWeggelassen = vi.fn().mockResolvedValue(undefined);
  render(
    <PunktFenster
      item={item}
      onClose={onClose}
      onUpdate={onUpdate}
      vorBeginn={false}
      onSetVorBeginn={vi.fn().mockResolvedValue(undefined)}
      onSetWeggelassen={onSetWeggelassen}
      services={[]}
      onRequestDelete={vi.fn()}
      liedWahl={liedWahl}
    />,
  );
  return { onUpdate, onClose, onSetWeggelassen };
}

describe('PunktFenster ohne Liedwahl (Dienstplaner)', () => {
  it('zeigt das Lied nur an – kein „Lied verknüpfen", kein „Verknüpfung aufheben"', () => {
    zeige();
    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lied verknüpfen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Verknüpfung aufheben/ })).toBeNull();
  });

  it('ohne Lied gibt es gar kein Feld „Lied"; die übrigen Felder werden gesammelt geschrieben', async () => {
    const { onUpdate, onClose } = zeige(zeile({ title: 'Predigt' }));
    expect(screen.queryByText('Lied', { selector: 'span' })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('z. B. 5'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith({ durationMin: 30 }, false);
  });
});

describe('PunktFenster mit Liedwahl (Musik-App)', () => {
  it('„Lied verknüpfen" öffnet die Liedwahl; ihre Wahl ist vorgemerkt und geht mit „Speichern" raus', async () => {
    const { onUpdate } = zeige(zeile({ title: 'Lied' }), ({ onGewaehlt }) => (
      <button onClick={() => onGewaehlt(30, 'Halleluja')}>Halleluja wählen</button>
    ));
    fireEvent.click(screen.getByRole('button', { name: /Lied verknüpfen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Halleluja wählen' }));
    expect(screen.getByText('Wird beim Speichern verknüpft.')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ arrangementId: 30 }, false));
  });

  it('„Abbrechen" in der Liedwahl führt zurück, ohne etwas vorzumerken', () => {
    zeige(zeile({ title: 'Lied' }), ({ onAbbrechen }) => (
      <button onClick={onAbbrechen}>zurück</button>
    ));
    fireEvent.click(screen.getByRole('button', { name: /Lied verknüpfen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'zurück' }));
    expect(screen.getByRole('button', { name: /Lied verknüpfen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });
});

describe('Auge „An diesem Termin weglassen“ (E6-3b)', () => {
  it('Schalter an + Speichern → schreibt nur das Weglassen, keine Felder', async () => {
    const { onUpdate, onClose, onSetWeggelassen } = zeige(zeile({ title: 'Predigt' }));
    const schalter = screen.getByRole('button', { name: /An diesem Termin weglassen/ });
    expect(schalter.getAttribute('aria-pressed')).toBe('false');
    // Ohne Änderung ist nichts zu speichern.
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.click(schalter);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSetWeggelassen).toHaveBeenCalledWith(true);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('ein weggelassener Punkt startet mit Schalter an; aus + Speichern → wieder zeigen', async () => {
    const { onSetWeggelassen } = zeige(zeile({ title: 'Predigt', startTimes: { '7': null } }));
    const schalter = screen.getByRole('button', { name: /An diesem Termin weglassen/ });
    expect(schalter.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(schalter);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onSetWeggelassen).toHaveBeenCalledWith(false));
  });
});

describe('Konflikt: derselbe Punkt woanders geändert (E6-3c)', () => {
  const konflikt = Object.assign(new Error('Dieser Punkt wurde eben woanders geändert.'), {
    status: 412,
  });

  it('412 → Rückfrage im Fenster; „Trotzdem speichern“ schreibt ohne Vergleich', async () => {
    const { onUpdate, onClose } = zeige(zeile({ title: 'Predigt' }));
    onUpdate.mockRejectedValueOnce(konflikt);
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Predigt neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Dieser Punkt wurde eben woanders geändert. Trotzdem speichern oder verwerfen?',
    );
    expect(onUpdate).toHaveBeenLastCalledWith({ title: 'Predigt neu' }, false);
    expect(onClose).not.toHaveBeenCalled();
    // Die eigene Änderung steht noch im Fenster.
    expect(screen.getByPlaceholderText('Titel')).toHaveProperty('value', 'Predigt neu');
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenLastCalledWith({ title: 'Predigt neu' }, true);
  });

  it('„Verwerfen“ schließt, ohne zu schreiben', async () => {
    const { onUpdate, onClose } = zeige(zeile({ title: 'Predigt' }));
    onUpdate.mockRejectedValueOnce(konflikt);
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Predigt neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('ein anderer Fehler bleibt ein Fehler – keine Rückfrage, kein „Trotzdem“', async () => {
    const { onUpdate } = zeige(zeile({ title: 'Predigt' }));
    onUpdate.mockRejectedValueOnce(Object.assign(new Error('Keine Berechtigung'), { status: 403 }));
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Predigt neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Keine Berechtigung')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trotzdem speichern' })).toBeNull();
  });
});

describe('Feldgrenzen wie ChurchTools (#671)', () => {
  it('Titel, Bemerkung und Zuständig lassen nicht mehr zu, als ChurchTools annimmt', () => {
    zeige(zeile({ title: 'Predigt' }));
    expect(screen.getByPlaceholderText('Titel').getAttribute('maxlength')).toBe(
      String(ABLAUFPUNKT_GRENZEN.titel),
    );
    expect(screen.getByPlaceholderText('Optionale Notiz…').getAttribute('maxlength')).toBe(
      String(ABLAUFPUNKT_GRENZEN.bemerkung),
    );
    // „Zuständig“ wird seit O3 in einem eigenen Schritt bearbeitet – dort gilt die Grenze.
    fireEvent.click(screen.getByRole('button', { name: 'Zuständig hinzufügen' }));
    expect(screen.getByPlaceholderText('z.B. [Musik] oder Name').getAttribute('maxlength')).toBe(
      String(ABLAUFPUNKT_GRENZEN.zustaendig),
    );
  });
});

/** Variante B des Fenster-Entwurfs (E6-O O3, Alwin 23./28.10.2026). */
describe('Punkt-Fenster im ChurchTools-Aufbau (Variante B)', () => {
  const zeit = (item: Partial<CtAgendaItem>) => ({ ...zeile(item), time: '10:00', durationMin: 4 });
  function mitPosition(
    pos: { onVorher?: () => void; onNachher?: () => void },
    item = zeit({ title: 'Lied', song: { title: 'Treu' } as never }),
  ) {
    const onClose = vi.fn();
    const onRequestDelete = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <PunktFenster
        item={item}
        onClose={onClose}
        onUpdate={onUpdate}
        vorBeginn={false}
        onSetVorBeginn={vi.fn().mockResolvedValue(undefined)}
        onSetWeggelassen={vi.fn().mockResolvedValue(undefined)}
        services={[{ id: 3, name: 'Musik' }] as never}
        onRequestDelete={onRequestDelete}
        position={{ nr: 2, von: 8, ...pos }}
      />,
    );
    return { onClose, onRequestDelete, onUpdate };
  }

  it('Kopf mit Titel und X; unten links „Eintrag löschen“, rechts „Abbrechen · Speichern“', () => {
    const { onClose, onRequestDelete } = mitPosition({});
    expect(screen.getByRole('dialog', { name: 'Lied' })).toBeTruthy();
    const knoepfe = fensterKnoepfe();
    expect(knoepfe[0]).toBe('Fenster schließen');
    // Auch im Dokument zuerst: Tastatur und Vorleser haben dieselbe Reihenfolge wie das Auge.
    expect(knoepfe.slice(-3)).toEqual(['Eintrag löschen', 'Abbrechen', 'Speichern']);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag löschen' }));
    expect(onClose).toHaveBeenCalled();
    expect(onRequestDelete).toHaveBeenCalled();
  });

  it('„Position 2 von 8 · 10:00 – 10:04“; ‹ › blättern, am Rand gesperrt', () => {
    const vorher = vi.fn();
    mitPosition({ onVorher: vorher });
    expect(screen.getByText('Position 2 von 8 · 10:00 – 10:04')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voriger Eintrag' }));
    expect(vorher).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Nächster Eintrag' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('mit ungespeicherter Änderung: ‹ › gesperrt, mit Hinweis (Alwin, 28.10.2026)', () => {
    const vorher = vi.fn();
    const nachher = vi.fn();
    mitPosition({ onVorher: vorher, onNachher: nachher });
    expect(screen.queryByText(/Zum Blättern erst speichern/)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('z. B. Lied'), { target: { value: 'Lobpreis' } });
    for (const name of ['Voriger Eintrag', 'Nächster Eintrag'])
      expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
    expect(screen.getByText('Zum Blättern erst speichern oder abbrechen.')).toBeTruthy();
  });

  it('weggelassen: statt der Zeit „an diesem Termin weggelassen“', () => {
    mitPosition({}, { ...zeit({ title: 'Ansage' }), weggelassen: true });
    expect(screen.getByText('Position 2 von 8 · an diesem Termin weggelassen')).toBeTruthy();
  });

  it('„Zuständig“: Zeile mit Pfeil öffnet den Schritt; „Übernehmen“ merkt vor, „Speichern“ schreibt', async () => {
    const { onUpdate } = mitPosition(
      {},
      { ...zeit({ title: 'Predigt' }), responsibleText: '[Predigt]', responsible: [] },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zuständig: Predigt – ändern' }));
    // Der Schritt ersetzt die Feldliste; unten nur „Zurück · Übernehmen“.
    expect(screen.queryByPlaceholderText('Titel')).toBeNull();
    expect(fensterKnoepfe().slice(1)).toEqual(['Zurück', 'Übernehmen']);
    fireEvent.change(screen.getByPlaceholderText('z.B. [Musik] oder Name'), {
      target: { value: '[Predigt], [Musik]' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(screen.getByRole('button', { name: 'Zuständig: Predigt, Musik – ändern' })).toBeTruthy();
    expect(screen.getByText('Wird beim Speichern übernommen.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ responsible: '[Predigt], [Musik]' }, false),
    );
  });

  it('„Zuständig“: „Zurück“ verwirft den Entwurf', () => {
    mitPosition(
      {},
      { ...zeit({ title: 'Predigt' }), responsibleText: '[Predigt]', responsible: [] },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zuständig: Predigt – ändern' }));
    fireEvent.change(screen.getByPlaceholderText('z.B. [Musik] oder Name'), {
      target: { value: 'Jemand anderes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByRole('button', { name: 'Zuständig: Predigt – ändern' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });

  it('Tipp daneben: ohne Änderung zu, mit Änderung bleibt das Fenster', () => {
    const { onClose } = mitPosition({});
    const hintergrund = () => fireEvent.click(screen.getByRole('dialog').parentElement!);
    fireEvent.change(screen.getByPlaceholderText('z. B. Lied'), { target: { value: 'Lobpreis' } });
    hintergrund();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('z. B. Lied'), { target: { value: 'Lied' } });
    hintergrund();
    expect(onClose).toHaveBeenCalled();
  });

  it('die Lied-Karte steht flach in der Zeile – die Zeile ist schon der Rahmen (mit und ohne Liedwahl)', () => {
    const flach = () =>
      expect(screen.getByText('Treu').closest('[class*="liedKarte"]')!.className).toMatch(
        /liedFlach/,
      );
    mitPosition({});
    flach();
    cleanup();
    zeige(undefined, () => null);
    flach();
  });

  it('Zeit und Zuständig zum Anzeigen', () => {
    expect(zeitPlus('10:00', 4)).toBe('10:04');
    expect(zeitPlus('23:50', 15)).toBe('00:05');
    expect(zeitPlus('gleich', 4)).toBeNull();
    expect(zustaendigText('[Musik], Peter , [Technik]')).toBe('Musik, Peter , Technik');
  });
});
