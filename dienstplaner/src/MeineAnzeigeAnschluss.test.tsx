// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ABGLEICH_NACH_MS } from '@ui/ct/useAblageSpiegel';
import type { AblagePort, DatenDatei } from '@shared/ct/personenAblage';
import { MeineAnzeigeAnschluss } from './MeineAnzeigeAnschluss';
import {
  ANZEIGE_DATEI,
  ANZEIGE_PRAEFIX,
  anzeigeAbgleich,
  anzeigeSchluessel,
} from './anzeigeAblage';
import { useMeineAnzeigeAendern } from './meineAnzeige';

/**
 * **„Meine Anzeige“ speichern (L4-5, A15/T7)** – gegen die ECHTE Personen-Ablage (`anzeigeAbgleich` →
 * `erstellePersonenAblage`) mit einem nachgestellten Dateispeicher der eigenen Person. Der Test schreibt keine Dateiinhalte von
 * Hand, sondern nimmt, was die Ablage selbst ablegt. Fake-Timer: Sonst erledigte der echte Zeitgeber die Pause vor dem
 * Abgleich, und ein Test wäre auch ohne die Pause grün.
 *
 * Gegenproben (je Teil einzeln zurückgenommen, 23.11.2026 – siehe Bericht): Standard/Laden, „nie mit Standard überschreiben“,
 * Speichern (nur gewählte Felder), Zusammenführen mit einem zweiten Gerät, Fehler beim Speichern, je Person getrennt.
 */
function speicher() {
  let naechste = 1;
  const dateien: { id: number; name: string; inhalt: string }[] = [];
  const aufrufe: string[] = [];
  const ausfall = { lesen: 0, datei: 0, hochladen: 0 };
  const port: AblagePort = {
    meineId: () => Promise.resolve(19),
    lesen: () => {
      if (ausfall.lesen > 0) {
        ausfall.lesen--;
        return Promise.reject(Object.assign(new Error('Zeitüberschreitung'), { status: 504 }));
      }
      return Promise.resolve({
        data: dateien.map((d) => ({ id: d.id, name: d.name, fileUrl: `u${d.id}` })),
      });
    },
    datei: (url) => {
      if (ausfall.datei > 0) {
        ausfall.datei--;
        return Promise.reject(Object.assign(new Error('Bad Gateway'), { status: 502 }));
      }
      return Promise.resolve(
        new TextEncoder().encode(dateien.find((d) => `u${d.id}` === url)!.inhalt),
      );
    },
    hochladen: (_p, name, inhalt) => {
      if (ausfall.hochladen > 0) {
        ausfall.hochladen--;
        return Promise.reject(Object.assign(new Error('nicht erreichbar'), { status: 503 }));
      }
      aufrufe.push(`hoch ${name}`);
      dateien.push({ id: naechste++, name, inhalt: new TextDecoder().decode(inhalt) });
      return Promise.resolve();
    },
    loeschen: (id) => {
      aufrufe.push(`weg ${id}`);
      dateien.splice(
        dateien.findIndex((d) => d.id === id),
        1,
      );
      return Promise.resolve();
    },
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    istKeinRecht: () => false,
    istNichtGefunden: () => false,
  };
  /** Der Stand der Datei – so, wie ihn die Ablage zuletzt abgelegt hat. */
  const datei = (): DatenDatei | null => {
    const d = dateien.filter((x) => x.name === ANZEIGE_DATEI).at(-1);
    return d ? (JSON.parse(d.inhalt) as DatenDatei) : null;
  };
  return { port, dateien, aufrufe, ausfall, datei };
}

/** Eine zweite App/ein zweites Gerät legt eine Datei ab – über dieselbe Ablage, nicht von Hand. */
async function ablegenVonAnderemGeraet(s: ReturnType<typeof speicher>, lokal: DatenDatei) {
  await anzeigeAbgleich(s.port)(lokal);
}
const felder = (o: Record<string, [unknown, number]>): DatenDatei => ({
  v: 1,
  felder: Object.fromEntries(Object.entries(o).map(([k, [w, t]]) => [k, { w, t }])),
});

let uhr = 10_000;
function zeige(s: ReturnType<typeof speicher>, person = 19) {
  const abgleich = anzeigeAbgleich(s.port);
  function Probe() {
    const { anzeige, setzen, abgleichFehler } = useMeineAnzeigeAendern();
    return (
      <div>
        <output aria-label="anzeige">{JSON.stringify(anzeige)}</output>
        <output aria-label="fehler">{String(abgleichFehler)}</output>
        <button onClick={() => setzen({ minutenKnoepfe: false })}>Minuten aus</button>
        <button onClick={() => setzen({ rueckblick: false })}>Rückblick aus</button>
      </div>
    );
  }
  render(
    <MeineAnzeigeAnschluss person={person} abgleich={abgleich} jetzt={() => uhr++}>
      <Probe />
    </MeineAnzeigeAnschluss>,
  );
}
const anzeige = () =>
  JSON.parse(screen.getByLabelText('anzeige').textContent ?? '{}') as Record<string, boolean>;
const fehler = () => screen.getByLabelText('fehler').textContent;
const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));
const pause = () => act(() => vi.advanceTimersByTimeAsync(ABGLEICH_NACH_MS + 10));
const geraet = (person = 19) =>
  JSON.parse(localStorage.getItem(anzeigeSchluessel(person)) ?? 'null') as DatenDatei | null;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  uhr = 10_000;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MeineAnzeigeAnschluss', () => {
  it('Standard: ohne Datei ist alles an – und beim Öffnen wird NICHTS hochgeladen (der Standard steht nie in der Datei)', async () => {
    const s = speicher();
    zeige(s);
    await fertig();
    expect(Object.values(anzeige())).toEqual([true, true, true, true, true, true]);
    expect(s.aufrufe).toEqual([]);
    expect(s.dateien).toEqual([]);
    expect(fehler()).toBe('false');
  });

  it('Laden: ein anderes Gerät hat „Rückblick“ ausgeschaltet – das gilt hier, ohne dass die Datei neu geschrieben wird', async () => {
    const s = speicher();
    await ablegenVonAnderemGeraet(s, felder({ rueckblick: [false, 5000] }));
    s.aufrufe.length = 0;
    zeige(s);
    await fertig();
    expect(anzeige().rueckblick).toBe(false);
    expect(anzeige().minutenKnoepfe).toBe(true);
    expect(s.aufrufe).toEqual([]);
  });

  describe('Härtung: ein vorübergehender Fehler überschreibt nichts', () => {
    it('die Dateiliste ist nicht zu lesen (504): Standard zur Anzeige, nichts hochgeladen, die vorhandene Datei bleibt', async () => {
      const s = speicher();
      await ablegenVonAnderemGeraet(s, felder({ rueckblick: [false, 5000] }));
      const vorher = JSON.stringify(s.dateien);
      s.aufrufe.length = 0;
      s.ausfall.lesen = 1;
      zeige(s);
      await fertig();
      expect(Object.values(anzeige())).toEqual([true, true, true, true, true, true]);
      expect(fehler()).toBe('true');
      expect(s.aufrufe).toEqual([]);
      expect(JSON.stringify(s.dateien)).toBe(vorher);
      // Nächster Anlass (Netz zurück): jetzt klappt es – die Wahl vom anderen Gerät gilt, noch immer nichts überschrieben.
      await act(async () => {
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(anzeige().rueckblick).toBe(false);
      expect(fehler()).toBe('false');
      expect(s.aufrufe).toEqual([]);
    });

    it('die Datei ist nicht zu laden (502): ebenso – sie wird nicht „leer“ ersetzt', async () => {
      const s = speicher();
      await ablegenVonAnderemGeraet(s, felder({ spalteSchnitt: [false, 5000] }));
      s.aufrufe.length = 0;
      s.ausfall.datei = 1;
      zeige(s);
      await fertig();
      expect(anzeige().spalteSchnitt).toBe(true);
      expect(fehler()).toBe('true');
      expect(s.aufrufe).toEqual([]);
      expect(s.datei()?.felder.spalteSchnitt?.w).toBe(false);
    });

    it('Laden misslungen, dann wählt die Person etwas: der Abgleich holt erst nach, dann kommt nur ihre Wahl dazu – das Feld des anderen Geräts bleibt, kein Standardfeld entsteht', async () => {
      const s = speicher();
      await ablegenVonAnderemGeraet(s, felder({ spalteSchnitt: [false, 5000] }));
      s.ausfall.lesen = 1;
      zeige(s);
      await fertig();
      expect(fehler()).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Minuten aus' }));
      await pause();
      const d = s.datei()!;
      expect(d.felder.spalteSchnitt?.w).toBe(false);
      expect(d.felder.minutenKnoepfe?.w).toBe(false);
      expect(Object.keys(d.felder).sort()).toEqual(['minutenKnoepfe', 'spalteSchnitt']);
      expect(fehler()).toBe('false');
    });
  });

  describe('Speichern', () => {
    it('ein Klick: sofort im Gerät und auf dem Bildschirm, nach ChurchTools erst nach der Pause – und nur dieses Feld', async () => {
      const s = speicher();
      zeige(s);
      await fertig();
      fireEvent.click(screen.getByRole('button', { name: 'Minuten aus' }));
      expect(anzeige().minutenKnoepfe).toBe(false);
      expect(geraet()?.felder.minutenKnoepfe?.w).toBe(false);
      expect(s.aufrufe).toEqual([]);
      await pause();
      expect(s.aufrufe).toEqual([`hoch ${ANZEIGE_DATEI}`]);
      expect(Object.keys(s.datei()!.felder)).toEqual(['minutenKnoepfe']);
      expect(s.datei()!.v).toBe(1);
      expect(s.dateien[0].name.startsWith(ANZEIGE_PRAEFIX)).toBe(true);
    });

    it('zwei Geräte: die Felder werden zusammengeführt, die jüngere Änderung gewinnt', async () => {
      const s = speicher();
      await ablegenVonAnderemGeraet(
        s,
        felder({ spalteSchnitt: [false, 100], rueckblick: [false, 100] }),
      );
      zeige(s);
      await fertig();
      uhr = 20_000;
      // Dieses Gerät schaltet „Rückblick“ wieder an (jünger) – das andere Feld bleibt.
      function Wieder() {
        const { setzen } = useMeineAnzeigeAendern();
        return <button onClick={() => setzen({ rueckblick: true })}>wieder an</button>;
      }
      cleanup();
      render(
        <MeineAnzeigeAnschluss person={19} abgleich={anzeigeAbgleich(s.port)} jetzt={() => uhr++}>
          <Wieder />
        </MeineAnzeigeAnschluss>,
      );
      await fertig();
      fireEvent.click(screen.getByRole('button', { name: 'wieder an' }));
      await pause();
      const d = s.datei()!;
      expect(d.felder.rueckblick?.w).toBe(true);
      expect(d.felder.spalteSchnitt?.w).toBe(false);
    });

    it('Speichern scheitert (503): die Wahl bleibt sichtbar und im Gerät, der Hinweis erscheint; beim nächsten Anlass wird nachgeholt', async () => {
      const s = speicher();
      zeige(s);
      await fertig();
      s.ausfall.hochladen = 1;
      fireEvent.click(screen.getByRole('button', { name: 'Minuten aus' }));
      await pause();
      expect(fehler()).toBe('true');
      expect(anzeige().minutenKnoepfe).toBe(false);
      expect(geraet()?.felder.minutenKnoepfe?.w).toBe(false);
      expect(s.dateien).toEqual([]);
      // Eine weitere Wahl verliert die erste nicht.
      fireEvent.click(screen.getByRole('button', { name: 'Rückblick aus' }));
      await pause();
      expect(fehler()).toBe('false');
      expect(Object.keys(s.datei()!.felder).sort()).toEqual(['minutenKnoepfe', 'rueckblick']);
    });

    it('je Person getrennt: der Spiegel im Gerät trägt die Person im Namen (geteiltes iPad)', async () => {
      const s = speicher();
      zeige(s, 19);
      await fertig();
      fireEvent.click(screen.getByRole('button', { name: 'Minuten aus' }));
      await pause();
      expect(geraet(19)).not.toBeNull();
      expect(geraet(20)).toBeNull();
      cleanup();
      zeige(speicher(), 20);
      await fertig();
      expect(anzeige().minutenKnoepfe).toBe(true);
    });
  });
});
