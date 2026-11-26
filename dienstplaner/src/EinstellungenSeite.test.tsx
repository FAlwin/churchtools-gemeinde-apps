// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STANDARD_BETRIEBSART, type Betriebsart } from '@shared/ct/liveAgenda';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import type { SpeicherGrund, Versioniert } from '@shared/ct/versionierterWert';
import { EinstellungenSeite } from './EinstellungenSeite';
import {
  aenderungenText,
  anzahlAenderungen,
  BETRIEBSART_WAHL,
  einstellungenFehlerText,
} from './einstellungenTexte';

/**
 * **Einstellungen** (L4-2, V-6): „Live-Ansicht – für alle“ mit den drei Betriebsarten, als Seite mit einer Leiste unten. Lesen
 * und Speichern sind ersetzt (die Regeln dahinter prüft `shared/dienstplan/liveEinstellungen.test.ts`); hier geht es um das,
 * was die Seite daraus macht: Planer dürfen ändern, andere nur ansehen, Fehler sperren das Speichern, ein Konflikt
 * überschreibt nichts, Speichern schließt nichts (die Leiste verschwindet), Verwerfen setzt zurück.
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
  const onGeaendert = vi.fn<(g: boolean) => void>();
  const ansicht = render(
    <EinstellungenSeite
      darfAendern={o.darfAendern ?? true}
      ich={ICH}
      onGeaendert={onGeaendert}
      lesen={lesen}
      speichern={speichern}
    />,
  );
  return { lesen, speichern, onGeaendert, ansicht };
}

const radio = (label: RegExp) => screen.getByRole<HTMLInputElement>('radio', { name: label });
const speichernKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
/** Die Leiste unten („N Änderungen nicht gespeichert“) – `null`, wenn nichts ungespeichert ist. */
const leiste = () => screen.queryByRole('group', { name: 'Noch nicht gespeichert' });
const verwerfenKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verwerfen' });
/** `beforeunload` wie der Browser beim Neuladen/Schließen – `true`, wenn die Seite ihn aufhält. */
const beforeunloadHaelt = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};
const geladen = () => screen.findByRole('radiogroup', { name: 'Live-Ansicht – für alle' });

afterEach(cleanup);

describe('EinstellungenSeite', () => {
  it('zeigt die drei Betriebsarten mit dem Wortlaut des Entwurfs; ohne Wert gilt der Standard', async () => {
    zeige();
    await geladen();
    expect(BETRIEBSART_WAHL.map((w) => w.wert)).toEqual(['bis-beginn', 'immer-uhr', 'klicken']);
    expect(radio(/Bis Beginn nach der Uhr, ab Beginn klicken/).checked).toBe(true);
    expect(radio(/Immer nach der Uhr/).checked).toBe(false);
    expect(radio(/Von Anfang an klicken/).checked).toBe(false);
    expect(screen.getByText(/Wie bisher: folgt der Uhr, bis jemand „Starten“ drückt/)).toBeTruthy();
    expect(screen.getByText(/Ändern dürfen Planer\./)).toBeTruthy();
    // Nichts geändert: keine Leiste.
    expect(leiste()).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeTruthy();
  });

  it('zeigt die gespeicherte Betriebsart', async () => {
    zeige({
      lesen: () =>
        Promise.resolve(stand({ betriebsart: 'klicken', gespeichert: gespeichert('klicken', 3) })),
    });
    await geladen();
    expect(radio(/Von Anfang an klicken/).checked).toBe(true);
  });

  it('Planer: wählen und speichern – mit der gesehenen Version; danach ist die Leiste weg und der Stand nachgezogen (nichts schließt)', async () => {
    const { speichern } = zeige({
      lesen: () =>
        Promise.resolve(
          stand({ betriebsart: 'immer-uhr', gespeichert: gespeichert('immer-uhr', 3) }),
        ),
    });
    await geladen();
    fireEvent.click(radio(/Von Anfang an klicken/));
    expect(leiste()?.textContent).toContain('1 Änderung nicht gespeichert');
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(leiste()).toBeNull());
    expect(speichern).toHaveBeenCalledWith({ betriebsart: 'klicken' }, ICH, 3);
    // Die Seite bleibt, die Wahl steht, und der neue Stand (Version 1 aus der Antwort) ist die Grundlage der nächsten Änderung.
    expect(radio(/Von Anfang an klicken/).checked).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(radio(/Immer nach der Uhr/));
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(2));
    expect(speichern.mock.calls[1][2]).toBe(1);
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
    // Auch nach einem Klick auf eine gesperrte Wahl: keine Leiste, nichts zu verwerfen, nichts hält das Neuladen auf.
    fireEvent.click(radio(/Von Anfang an klicken/));
    expect(leiste()).toBeNull();
    expect(beforeunloadHaelt()).toBe(false);
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
      'Speichern scheitert mit „%s“: Meldung, die Leiste bleibt, Wahl bleibt',
      async (grund, text) => {
        zeige({
          speichern: () => Promise.resolve({ ok: false, grund }),
        });
        await geladen();
        fireEvent.click(radio(/Von Anfang an klicken/));
        fireEvent.click(speichernKnopf());
        await screen.findByText(text);
        expect(leiste()?.textContent).toContain('1 Änderung nicht gespeichert');
        expect(radio(/Von Anfang an klicken/).checked).toBe(true);
      },
    );

    it('Konflikt: nichts überschrieben, die Seite zeigt den Stand der anderen – mit Namen; die Leiste ist weg (nichts mehr ungespeichert)', async () => {
      zeige({
        speichern: () =>
          Promise.resolve({ ok: false, grund: 'konflikt', jetzt: gespeichert('immer-uhr', 5) }),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await screen.findByText(/Bea hat das inzwischen geändert – nichts überschrieben/);
      expect(radio(/Immer nach der Uhr/).checked).toBe(true);
      expect(leiste()).toBeNull();
    });

    it('Konflikt, aber es steht schon genau das da, was gewünscht war: fertig (frühere Versuche kamen an)', async () => {
      zeige({
        speichern: () =>
          Promise.resolve({ ok: false, grund: 'konflikt', jetzt: gespeichert('klicken', 2, ICH) }),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      // Anders als beim Konflikt oben: Leiste weg UND keine Meldung.
      await waitFor(() => expect(leiste()).toBeNull());
      expect(screen.queryByRole('alert')).toBeNull();
      expect(radio(/Von Anfang an klicken/).checked).toBe(true);
    });

    it('Speichern wirft (Modul/Kategorie nicht erreichbar): Meldung, die Leiste bleibt', async () => {
      zeige({ speichern: () => Promise.reject(new Error('Netz')) });
      await geladen();
      // Gespeichert wird nur, was sich geändert hat (R-4) – also erst etwas ändern.
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await screen.findByRole('alert');
      expect(leiste()?.textContent).toContain('1 Änderung nicht gespeichert');
    });
  });

  describe('Leiste, Verwerfen, Warnung vor dem Verlassen', () => {
    it('Verwerfen: die Wahl springt auf den gelesenen Stand zurück, die Leiste geht, nichts wird geschrieben', async () => {
      const { speichern } = zeige({
        lesen: () =>
          Promise.resolve(
            stand({ betriebsart: 'immer-uhr', gespeichert: gespeichert('immer-uhr', 3) }),
          ),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      expect(leiste()).not.toBeNull();
      fireEvent.click(verwerfenKnopf());
      expect(radio(/Immer nach der Uhr/).checked).toBe(true);
      expect(radio(/Von Anfang an klicken/).checked).toBe(false);
      expect(leiste()).toBeNull();
      expect(speichern).not.toHaveBeenCalled();
    });

    it('Verwerfen nach einem Teilfehler nimmt auch die Meldung weg', async () => {
      zeige({ speichern: () => Promise.resolve({ ok: false, grund: 'voruebergehend' }) });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await screen.findByRole('alert');
      fireEvent.click(verwerfenKnopf());
      expect(screen.queryByRole('alert')).toBeNull();
      expect(leiste()).toBeNull();
    });

    it('Wird gespeichert …: beide Knöpfe gesperrt, solange ChurchTools antwortet', async () => {
      let fertig: () => void = () => {};
      zeige({
        speichern: (neu) =>
          new Promise((ok) => {
            fertig = () => ok({ ok: true, daten: gespeichert(neu.betriebsart, 1, ICH) });
          }),
      });
      await geladen();
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      const speichert = await screen.findByRole<HTMLButtonElement>('button', {
        name: 'Wird gespeichert …',
      });
      expect(speichert.disabled).toBe(true);
      expect(verwerfenKnopf().disabled).toBe(true);
      expect(radio(/Immer nach der Uhr/).disabled).toBe(true);
      fertig();
      await waitFor(() => expect(leiste()).toBeNull());
    });

    it('beforeunload hält nur auf, solange es Änderungen gibt – und nicht mehr nach Verwerfen, Speichern oder Verlassen', async () => {
      const { ansicht } = zeige();
      await geladen();
      expect(beforeunloadHaelt()).toBe(false);
      fireEvent.click(radio(/Von Anfang an klicken/));
      expect(beforeunloadHaelt()).toBe(true);
      fireEvent.click(verwerfenKnopf());
      expect(beforeunloadHaelt()).toBe(false);
      fireEvent.click(radio(/Von Anfang an klicken/));
      fireEvent.click(speichernKnopf());
      await waitFor(() => expect(leiste()).toBeNull());
      expect(beforeunloadHaelt()).toBe(false);
      fireEvent.click(radio(/Immer nach der Uhr/));
      expect(beforeunloadHaelt()).toBe(true);
      ansicht.unmount();
      expect(beforeunloadHaelt()).toBe(false);
    });

    it('meldet der App „ungespeichert“ – und beim Verlassen der Seite wieder „nicht mehr“', async () => {
      const { onGeaendert, ansicht } = zeige();
      await geladen();
      expect(onGeaendert).toHaveBeenLastCalledWith(false);
      fireEvent.click(radio(/Von Anfang an klicken/));
      expect(onGeaendert).toHaveBeenLastCalledWith(true);
      fireEvent.click(verwerfenKnopf());
      expect(onGeaendert).toHaveBeenLastCalledWith(false);
      fireEvent.click(radio(/Von Anfang an klicken/));
      expect(onGeaendert).toHaveBeenLastCalledWith(true);
      ansicht.unmount();
      expect(onGeaendert).toHaveBeenLastCalledWith(false);
    });
  });

  describe('anzahlAenderungen / aenderungenText – die eine Zählung der Leiste', () => {
    it('zählt Live-Ansicht, Art der Abfrage und Erinnerungsplan je einmal – höchstens 3', () => {
      const ja = [true, false];
      const alle = ja.flatMap((live) =>
        ja.flatMap((art) => ja.map((plan) => ({ live, art, plan }))),
      );
      expect(alle).toHaveLength(8);
      for (const g of alle) {
        expect(anzahlAenderungen(g)).toBe([g.live, g.art, g.plan].filter(Boolean).length);
      }
      expect(anzahlAenderungen({ live: false, art: false, plan: false })).toBe(0);
      expect(anzahlAenderungen({ live: true, art: true, plan: true })).toBe(3);
    });

    it('Einzahl bei 1, Mehrzahl sonst', () => {
      expect(aenderungenText(1)).toBe('1 Änderung nicht gespeichert');
      expect(aenderungenText(2)).toBe('2 Änderungen nicht gespeichert');
      expect(aenderungenText(3)).toBe('3 Änderungen nicht gespeichert');
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
