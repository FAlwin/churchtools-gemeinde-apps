import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctDaten } from './verbindung';
import { personenRoh, personenSuchen, TREFFER_MAX } from './personen';

// Aus den Anmeldungen hierher gezogen (A7-4 → O6): die Suche gegen ein nachgestelltes ChurchTools.
vi.mock('./verbindung', () => ({ ctDaten: vi.fn() }));
const daten = vi.mocked(ctDaten);

const HANNA = 152;
beforeEach(() => {
  daten.mockReset();
  daten.mockImplementation((pfad: string) => {
    if (pfad.startsWith('/search'))
      return Promise.resolve([
        { domainType: 'person', domainIdentifier: '152', domainAttributes: {} },
        { domainType: 'person', domainIdentifier: '7', domainAttributes: { isArchived: true } },
        { domainType: 'person', domainIdentifier: '99', domainAttributes: {} },
      ]);
    if (pfad.startsWith('/persons'))
      // 99 darf man nicht sehen – ChurchTools lässt sie weg
      return Promise.resolve([{ id: HANNA, firstName: 'Hanna', lastName: 'Handtest' }]);
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
});

describe('personenSuchen', () => {
  it('ohne Archivierte, in der Reihenfolge von ChurchTools; wen man nicht sehen darf, fehlt', async () => {
    const t = await personenSuchen('Hanna');
    expect(t).toEqual([
      { personId: HANNA, vor: 'Hanna', nach: 'Handtest', geburtstag: null, email: null },
    ]);
    expect(daten).toHaveBeenCalledWith('/persons?ids[]=152&ids[]=99&limit=2');
  });

  it('unter zwei Zeichen wird nicht gesucht', async () => {
    expect(await personenSuchen(' H ')).toEqual([]);
    expect(daten).not.toHaveBeenCalled();
  });

  it(`höchstens ${TREFFER_MAX} Treffer`, async () => {
    daten.mockImplementation((pfad: string) =>
      Promise.resolve(
        pfad.startsWith('/search')
          ? Array.from({ length: 30 }, (_, i) => ({ domainIdentifier: String(i + 1) }))
          : [],
      ),
    );
    await personenSuchen('Viele');
    const personenAbruf = daten.mock.calls.find(([p]) => p.startsWith('/persons'))?.[0] ?? '';
    expect(personenAbruf.match(/ids\[\]/g)).toHaveLength(TREFFER_MAX);
  });
});

describe('personenRoh', () => {
  it('in Paketen zu 50', async () => {
    daten.mockResolvedValue([]);
    await personenRoh(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(daten).toHaveBeenCalledTimes(3);
  });
});
