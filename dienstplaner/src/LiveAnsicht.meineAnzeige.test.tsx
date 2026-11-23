// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import { liveStandAus, type LiveStand } from '@shared/ct/liveAgenda';
import type { CtAgendaItem } from '@shared/ct/typen';
import { LiveAnsicht } from './LiveAnsicht';
import { AnzeigeKontext, STANDARD_ANZEIGE, type MeineAnzeige } from './meineAnzeige';

/**
 * **„Meine Anzeige“ in der Live-Ansicht (L4-5):** „−1 / +1 Min“ (A13) und die Infos meiner Dienstgruppen (A16) – je ein
 * Schalter, getrennt geprüft. Ohne Anschluss gilt der Standard „alles an“. Fake-Timer: Takt und Uhr der Ansicht laufen sonst
 * echt, und ein echter Zeitgeber täte die Arbeit, die der Test der Ansicht zuschreibt.
 */
const T = 216;
const ITEMS: CtAgendaItem[] = [
  {
    id: 1,
    title: 'Begrüßung',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 2 an' }],
  },
  {
    id: 2,
    title: 'Predigt',
    type: 'text',
    duration: 1800,
    startTimes: { '216': '2027-03-07T09:05:00Z' },
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Headset' }],
  },
  {
    id: 3,
    title: 'Segen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Licht warm' }],
  },
];
const stand = (stelle: number, seit: string): LiveStand =>
  liveStandAus({
    pos_id: String(stelle),
    switchdate: seit,
    addseconds: null,
    category_id: '2',
    currentTime: Date.now(),
  }) as LiveStand;

function zeige(anzeige: Partial<MeineAnzeige>) {
  render(
    <AnzeigeKontext.Provider
      value={{
        anzeige: { ...STANDARD_ANZEIGE, ...anzeige },
        setzen: () => {},
        abgleichFehler: false,
      }}
    >
      <LiveAnsicht
        titel="Gottesdienst"
        tag="2027-03-07"
        beginn="10:00"
        terminId={T}
        agendaId={126}
        items={ITEMS}
        zeilen={ITEMS.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'))}
        infoGruppen={[{ id: 3, name: 'Technik' }]}
        zeitzone="Europe/Berlin"
        onSchliessen={() => {}}
        steuern
        betriebsartLesen={() =>
          Promise.resolve({
            betriebsart: 'immer-uhr',
            gespeichert: null,
            unlesbar: false,
            fehler: null,
          })
        }
        lesen={() =>
          Promise.resolve({ ok: true, stand: stand(2, '2027-03-07T09:06:00Z') } as const)
        }
        schreiben={() => new Promise<never>(() => {})}
        ablaufLesen={() => Promise.resolve({ id: 126, items: ITEMS })}
        verlaufLesen={() =>
          Promise.resolve({ ok: true, wechsel: [], ausnahmen: [], vorhanden: false })
        }
        verlaufSchreiben={() => Promise.resolve({ ok: true, wechsel: [], ausnahmen: [] })}
      />
    </AnzeigeKontext.Provider>,
  );
}
const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));
const jetzt = () => screen.getByRole('region', { name: 'Jetzt' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2027-03-07T09:08:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveAnsicht – Meine Anzeige (L4-5)', () => {
  it('Standard (alles an): „−1 / +1 Min“ und die Infos stehen da', async () => {
    zeige({});
    await fertig();
    expect(screen.getByRole('button', { name: 'Eine Minute weniger' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eine Minute mehr' })).toBeTruthy();
    expect(within(jetzt()).getByText(/Headset/)).toBeTruthy();
  });

  it('„−1 / +1 Min“ aus: die zwei Knöpfe fehlen, Zurück und Weiter bleiben, die Restzeit rechnet weiter (A13)', async () => {
    zeige({ minutenKnoepfe: false });
    await fertig();
    expect(screen.queryByRole('button', { name: 'Eine Minute weniger' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eine Minute mehr' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Zum vorigen Punkt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zum nächsten Punkt' })).toBeTruthy();
    expect(screen.getByLabelText('Restzeit').textContent).toBe('28:00noch, von 30 Min');
    // Die Infos hängen nicht an diesem Schalter.
    expect(within(jetzt()).getByText(/Headset/)).toBeTruthy();
  });

  it('Infos aus: weder groß unter „Jetzt“ noch klein in der Liste – die Knöpfe bleiben', async () => {
    zeige({ infosMeinerGruppen: false });
    await fertig();
    expect(screen.queryByText(/Headset/)).toBeNull();
    expect(screen.queryByText(/Licht warm/)).toBeNull();
    expect(screen.queryByText(/Mikro 2 an/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Eine Minute mehr' })).toBeTruthy();
  });

  it('Infos an: groß unter „Jetzt“, klein bei kommenden Punkten, nicht bei erledigten (A16)', async () => {
    zeige({});
    await fertig();
    expect(screen.queryByText(/Mikro 2 an/)).toBeNull();
    expect(screen.getByText(/Licht warm/).textContent).toBe('Technik: Licht warm');
  });
});
