// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STANDARD_BETRIEBSART, type Betriebsart } from '@shared/ct/liveAgenda';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import type { SpeicherGrund, Versioniert } from '@shared/ct/versionierterWert';
import { EinstellungenFenster } from './EinstellungenFenster';
import { BETRIEBSART_WAHL, einstellungenFehlerText } from './einstellungenTexte';

/**
 * **Einstellungen** (L4-2): „Live-Ansicht – für alle“ mit den drei Betriebsarten. Lesen und Speichern sind ersetzt (die
 * Regeln dahinter prüft `shared/dienstplan/liveEinstellungen.test.ts`); hier geht es um das, was das Fenster daraus macht:
 * Planer dürfen ändern, andere nur ansehen, Fehler sperren das Speichern, ein Konflikt überschreibt nichts.
 */
const ICH = { personId: 1, name: 'Alwin' };
const BEA = { personId: 2, name: 'Bea' };
const gespeichert = (
  betriebsart: Betriebsart,
  version: number,
  von = BEA,
): Versioniert<{ betriebsart: Betriebsart }> => ({
  version,
  zeit: 'z',
  von,
  inhalt: { betriebsart },
});
const stand = (teil: Partial<EinstellungenStand> = {}): EinstellungenStand => ({
  betriebsart: STANDARD_BETRIEBSART,
  gespeichert: null,
  unlesbar: false,
  fehler: null,
  ...teil,
});

type Lesen = () => Promise<EinstellungenStand>;
type Speichern = typeof import('./ladeEinstellungen').speichereEinstellungen;

function zeige(
  o: {
    darfAendern?: boolean;
    lesen?: Lesen;
    speichern?: Speichern;
  } = {},
) {
  const lesen = vi.fn(o.lesen ?? (() => Promise.resolve(stand())));
  const speichern = vi.fn<Speichern>(
    o.speichern ??
      ((neu, _von, _erwartet) =>
        Promise.resolve({ ok: true, daten: gespeichert(neu.betriebsart, 1, ICH) })),
  );
  const onSchliessen = vi.fn();
  render(
    <EinstellungenFenster
      darfAendern={o.darfAendern ?? true}
      ich={ICH}
      onSchliessen={onSchliessen}
      lesen={lesen}
      speichern={speichern}
    />,
  );
  return { lesen, speichern, onSchliessen };
}

const radio = (label: RegExp) => screen.getByRole<HTMLInputElement>('radio', { name: label });
const speichernKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
const geladen = () => screen.findByRole('radiogroup', { name: 'Live-Ansicht – für alle' });

afterEach(cleanup);

describe('EinstellungenFenster', () => {
  it('zeigt die drei Betriebsarten mit dem Wortlaut des Entwurfs; ohne Wert gilt der Standard', async () => {
    zeige();
    await geladen();
    expect(BETRIEBSART_WAHL.map((w) => w.wert)).toEqual(['bis-beginn', 'immer-uhr', 'klicken']);
    expect(radio(/Bis Beginn nach der Uhr, ab Beginn klicken/).checked).toBe(true);
    expect(radio(/Immer nach der Uhr/).checked).toBe(false);
    expect(radio(/Von Anfang an klicken/).checked).toBe(false);
    expect(screen.getByText(/Wie bisher: folgt der Uhr, bis jemand „Starten“ drückt/)).toBeTruthy();
    expect(screen.getByText(/Ändern dürfen Planer\./)).toBeTruthy();
  });

  it('zeigt die gespeicherte Betriebsart', async () => {
    zeige({
      lesen: () =>
        Promise.resolve(stand({ betriebsart: 'klicken', gespeichert: gespeichert('klicken', 3) })),
    });
    await geladen();
    expect(radio(/Von Anfang an klicken/).checked).toBe(true);
  });

  it('Planer: wählen und speichern – mit der gesehenen Version; danach schließt das Fenster', async () => {
    const { speichern, onSchliessen } = zeige({
      lesen: () =>
        Promise.resolve(
          stand({ betriebsart: 'immer-uhr', gespeichert: gespeichert('immer-uhr', 3) }),
        ),
    });
    await geladen();
    fireEvent.click(radio(/Von Anfang an klicken/));
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).toHaveBeenCalledWith({ betriebsart: 'klicken' }, ICH, 3);
  });

  it('erstes Speichern ohne Wert: erwartet „null“', async () => {
    const { speichern } = zeige();
    await geladen();
    fireEvent.click(radio(/Immer nach der Uhr/));
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][2]).toBeNull();
  });

  it('ohne Planer-Recht: nur ansehen – Auswahl gesperrt, kein „Speichern“, Hinweis', async () => {
    zeige({ darfAendern: false });
    await geladen();
    for (const r of screen.getAllByRole('radio'))
      expect((r as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.getByText(/Ändern dürfen nur Planer\./)).toBeTruthy();
  });

  describe('Fehlerzweige – jeder einzeln', () => {
    it('Lesen scheitert (vorübergehend): Hinweis, Auswahl gesperrt, nicht speichern – „Nochmal versuchen“ liest neu', async () => {
      const lesen = vi
        .fn<Lesen>()
        .mockResolvedValueOnce(stand({ fehler: 'voruebergehend' }))
        .mockResolvedValue(
          stand({ betriebsart: 'klicken', gespeichert: gespeichert('klicken', 2) }),
        );
      const { speichern } = zeige({ lesen });
      await screen.findByText(/konnte nicht gelesen werden/);
      for (const r of screen.getAllByRole('radio'))
        expect((r as HTMLInputElement).disabled).toBe(true);
      expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
      await waitFor(() => expect(radio(/Von Anfang an klicken/).checked).toBe(true));
      expect(radio(/Von Anfang an klicken/).disabled).toBe(false);
      expect(speichern).not.toHaveBeenCalled();
    });

    it('Lesen wirft: wie ein vorübergehender Fehler – nichts speicherbar', async () => {
      zeige({ lesen: () => Promise.reject(new Error('Netz')) });
      await screen.findByRole('button', { name: 'Nochmal versuchen' });
      expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    });

    it.each<[SpeicherGrund, RegExp]>([
      ['kein-recht', /ChurchTools erlaubt dir das nicht/],
      ['voruebergehend', /nicht gespeichert\. Bitte gleich noch einmal/],
      ['abgemeldet', /Nicht mehr bei ChurchTools angemeldet/],
      ['nicht-angekommen', /nachgelesen steht aber der alte Wert da/],
    ])(
      'Speichern scheitert mit „%s“: Meldung, Fenster bleibt offen, Wahl bleibt',
      async (grund, text) => {
        const { onSchliessen } = zeige({
          speichern: () => Promise.resolve({ ok: false, grund }),
        });
        await geladen();
        fireEvent.click(radio(/Von Anfang an klicken/));
        fireEvent.click(speichernKnopf());
        await screen.findByText(text);
        expect(onSchliessen).not.toHaveBeenCalled();
        expect(radio(/Von Anfang an klicken/).checked).toBe(true);
      },
    );

    it('Konflikt: nichts überschrieben, das Fenster zeigt den Stand der anderen – mit Namen', async () => {
      const { onSchliessen } = zeige({
        speichern: () =>
          Promise.resolve({ ok: false, grund: 'konflikt', jetzt: gespeichert('immer-uhr', 5) }),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await screen.findByText(/Bea hat das inzwischen geändert – nichts überschrieben/);
      expect(radio(/Immer nach der Uhr/).checked).toBe(true);
      expect(onSchliessen).not.toHaveBeenCalled();
    });

    it('Konflikt, aber es steht schon genau das da, was gewünscht war: fertig (frühere Versuche kamen an)', async () => {
      const { onSchliessen } = zeige({
        speichern: () =>
          Promise.resolve({ ok: false, grund: 'konflikt', jetzt: gespeichert('klicken', 2, ICH) }),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    });

    it('Speichern wirft (Modul/Kategorie nicht erreichbar): Meldung, nichts geschlossen', async () => {
      const { onSchliessen } = zeige({ speichern: () => Promise.reject(new Error('Netz')) });
      await geladen();
      // Gespeichert wird nur, was sich geändert hat (R-4) – also erst etwas ändern.
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await screen.findByRole('alert');
      expect(onSchliessen).not.toHaveBeenCalled();
    });
  });

  it('alle Gründe haben einen Text', () => {
    const gruende: SpeicherGrund[] = [
      'konflikt',
      'abgemeldet',
      'kein-recht',
      'voruebergehend',
      'nicht-angekommen',
      'zu-gross',
    ];
    for (const g of gruende) {
      expect(einstellungenFehlerText(g, false).length).toBeGreaterThan(10);
      expect(einstellungenFehlerText(g, true).length).toBeGreaterThan(10);
    }
  });
});
