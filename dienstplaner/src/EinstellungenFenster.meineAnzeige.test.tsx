// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { STANDARD_BETRIEBSART } from '@shared/ct/liveAgenda';
import { EinstellungenFenster } from './EinstellungenFenster';
import {
  ANZEIGE_FELDER,
  AnzeigeKontext,
  STANDARD_ANZEIGE,
  type MeineAnzeige,
} from './meineAnzeige';

/**
 * **Einstellungen → „Meine Anzeige“ (L4-5):** sechs Haken im Wortlaut des Entwurfs; **jeder** darf sie ändern (auch wer nicht
 * planen darf), die zwei Spalten gehören zum Rückblick, scheitert ChurchTools, steht ein leiser Hinweis. Die Personen-Datei
 * dahinter prüft `MeineAnzeigeAnschluss.test.tsx`; hier ersetzt ein Spion das Setzen.
 */
const TEXTE: Record<keyof MeineAnzeige, RegExp> = {
  minutenKnoepfe: /„−1 \/ \+1 Min“ in der Live-Ansicht zeigen/,
  schnittBeimPlanen: /Durchschnitt beim Ablauf bearbeiten zeigen/,
  rueckblick: /Rückblick im Termin zeigen/,
  spalteSchnitt: /Spalte „Ø bisher“/,
  spalteAbweichung: /Spalte „±“/,
  infosMeinerGruppen: /Infos meiner Dienstgruppen in der Live-Ansicht/,
};

function zeige(o: { planer?: boolean; anzeige?: Partial<MeineAnzeige>; fehler?: boolean } = {}) {
  const setzen = vi.fn();
  render(
    <AnzeigeKontext.Provider
      value={{
        anzeige: { ...STANDARD_ANZEIGE, ...o.anzeige },
        setzen,
        abgleichFehler: o.fehler ?? false,
      }}
    >
      <EinstellungenFenster
        darfAendern={o.planer ?? false}
        ich={{ personId: 1, name: 'Alwin' }}
        onSchliessen={() => {}}
        lesen={() =>
          Promise.resolve({
            betriebsart: STANDARD_BETRIEBSART,
            gespeichert: null,
            unlesbar: false,
            fehler: null,
          })
        }
      />
    </AnzeigeKontext.Provider>,
  );
  return { setzen };
}
const haken = (f: keyof MeineAnzeige) =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: TEXTE[f] });

afterEach(cleanup);

describe('EinstellungenFenster – Meine Anzeige (L4-5)', () => {
  it('zeigt den Abschnitt unter „Live-Ansicht – für alle“ mit dem Wortlaut des Entwurfs; alles an', async () => {
    zeige();
    await screen.findByRole('radiogroup');
    const titel = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(titel).toEqual(['Live-Ansicht – für alle', 'Meine Anzeige']);
    expect(screen.getByText('Gilt für dich auf allen deinen Geräten.')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    for (const f of ANZEIGE_FELDER) expect(haken(f).checked).toBe(true);
  });

  it('jeder der sechs Haken schaltet genau sein Feld – ohne Speichern-Knopf', async () => {
    const { setzen } = zeige();
    await screen.findByRole('radiogroup');
    for (const f of ANZEIGE_FELDER) {
      fireEvent.click(haken(f));
      expect(setzen).toHaveBeenLastCalledWith({ [f]: false });
    }
    expect(setzen).toHaveBeenCalledTimes(6);
  });

  it('jeder darf: wer nicht planen darf, ändert „Meine Anzeige“ – die Betriebsarten oben sind für ihn gesperrt', async () => {
    const { setzen } = zeige({ planer: false });
    await screen.findByRole('radiogroup');
    for (const r of screen.getAllByRole<HTMLInputElement>('radio')) expect(r.disabled).toBe(true);
    expect(haken('minutenKnoepfe').disabled).toBe(false);
    fireEvent.click(haken('minutenKnoepfe'));
    expect(setzen).toHaveBeenCalledWith({ minutenKnoepfe: false });
    // Oben nichts zu speichern; geschlossen wird mit „Fertig“.
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });

  it('Planer: die Betriebsarten oben sind offen, „Speichern“ gehört nur zu ihnen; „Meine Anzeige“ ändert sich ohne Speichern', async () => {
    const { setzen } = zeige({ planer: true });
    await screen.findByRole('radiogroup');
    for (const r of screen.getAllByRole<HTMLInputElement>('radio')) expect(r.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
    fireEvent.click(haken('schnittBeimPlanen'));
    expect(setzen).toHaveBeenCalledWith({ schnittBeimPlanen: false });
  });

  it('die zwei Spalten gehören zum Rückblick: ist er aus, sind sie gesperrt (ihr Wert bleibt), sonst frei', async () => {
    zeige({ anzeige: { rueckblick: false, spalteSchnitt: false } });
    await screen.findByRole('radiogroup');
    expect(haken('spalteSchnitt').disabled).toBe(true);
    expect(haken('spalteAbweichung').disabled).toBe(true);
    expect(haken('spalteSchnitt').checked).toBe(false);
    expect(haken('spalteAbweichung').checked).toBe(true);
    // Die anderen Haken bleiben frei.
    expect(haken('infosMeinerGruppen').disabled).toBe(false);
    cleanup();
    zeige({ anzeige: { rueckblick: true } });
    await screen.findByRole('radiogroup');
    expect(haken('spalteSchnitt').disabled).toBe(false);
    expect(haken('spalteAbweichung').disabled).toBe(false);
  });

  it('ChurchTools antwortet nicht: leiser Hinweis, die Haken bleiben bedienbar und zeigen die Auswahl', async () => {
    zeige({ fehler: true, anzeige: { minutenKnoepfe: false } });
    await screen.findByRole('radiogroup');
    expect(screen.getByRole('status').textContent).toMatch(/Noch nicht in ChurchTools gespeichert/);
    expect(haken('minutenKnoepfe').checked).toBe(false);
    expect(haken('minutenKnoepfe').disabled).toBe(false);
  });

  it('kein Hinweis, solange alles gespeichert ist', async () => {
    zeige();
    await screen.findByRole('radiogroup');
    expect(screen.queryByText(/Noch nicht in ChurchTools gespeichert/)).toBeNull();
  });
});
