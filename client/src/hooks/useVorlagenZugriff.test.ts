import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { GeloeschterPunkt } from '@shared/ct/schreibKern';
import { schluessel } from './abfrageSchluessel';

/**
 * Der Zugriff der Musik-App auf die Vorlagen-Seite (E10-V3b): Jeder Vorgang geht durch die Weiche (`churchtoolsApi`),
 * **mit dem Ziel „Vorlage“**; `geschrieben()` kommt erst nach gelungenem Schreiben (nie nach einem Fehler), und der
 * Zwischenspeicher der Vorlagen-Auswahl in „Ablauf anlegen“ wird nach jedem gelungenen Schreiben verworfen.
 */
const api = vi.hoisted(() => ({
  getVorlagenStand: vi.fn(),
  getVorlage: vi.fn(),
  vorlageAnlegen: vi.fn(),
  vorlageUmbenennen: vi.fn(),
  vorlageLoeschen: vi.fn(),
  reorderAgenda: vi.fn(),
  createAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
  setAgendaItemVorBeginn: vi.fn(),
  deleteAgendaItem: vi.fn(),
  restoreAgendaItem: vi.fn(),
}));
vi.mock('../services/churchtoolsApi', () => api);

const { vorlagenZugriffAus } = await import('./useVorlagenZugriff');

const ZETTEL: GeloeschterPunkt = {
  felder: {
    type: 'text',
    title: 'T',
    note: '',
    duration: 0,
    responsible: '',
    serviceGroupNotes: [],
  },
  nachId: null,
  vorBeginn: false,
};
const ZIEL = { vorlageId: 5 };

let qc: QueryClient;
let verworfen: MockInstance<QueryClient['invalidateQueries']>;
beforeEach(() => {
  vi.clearAllMocks();
  for (const f of Object.values(api)) f.mockResolvedValue({ ok: true });
  api.deleteAgendaItem.mockResolvedValue({ ok: true, wiederherstellen: ZETTEL });
  api.vorlageAnlegen.mockResolvedValue(42);
  qc = new QueryClient();
  verworfen = vi.spyOn(qc, 'invalidateQueries');
});

const auswahlVerworfen = () =>
  verworfen.mock.calls.filter(
    ([o]) => JSON.stringify(o?.queryKey) === JSON.stringify(schluessel.ablaufVorlagen()),
  ).length;

describe('Lesen: frisch, ohne Zwischenspeicher', () => {
  it('Liste und Vorlage gehen an die Weiche und verwerfen nichts', async () => {
    const z = vorlagenZugriffAus(qc);
    await z.liste();
    await z.vorlage(5);
    expect(api.getVorlagenStand).toHaveBeenCalledTimes(1);
    expect(api.getVorlage).toHaveBeenCalledWith(5);
    expect(auswahlVerworfen()).toBe(0);
  });
});

describe('Die Vorlage als Ganzes', () => {
  it('anlegen liefert die ID, umbenennen und löschen gehen durch – jedes verwirft die Auswahl in „Ablauf anlegen“', async () => {
    const z = vorlagenZugriffAus(qc);
    await expect(z.anlegen({ name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    await z.umbenennen(5, 'Anders');
    await z.loeschen(5);
    expect(api.vorlageAnlegen).toHaveBeenCalledWith({ name: 'Neu', kalenderId: 2 });
    expect(api.vorlageUmbenennen).toHaveBeenCalledWith(5, 'Anders');
    expect(api.vorlageLoeschen).toHaveBeenCalledWith(5);
    expect(auswahlVerworfen()).toBe(3);
  });

  it.each([
    [
      'anlegen',
      'vorlageAnlegen',
      (z: ReturnType<typeof vorlagenZugriffAus>) => z.anlegen({ name: 'N', kalenderId: 2 }),
    ],
    [
      'umbenennen',
      'vorlageUmbenennen',
      (z: ReturnType<typeof vorlagenZugriffAus>) => z.umbenennen(5, 'A'),
    ],
    ['löschen', 'vorlageLoeschen', (z: ReturnType<typeof vorlagenZugriffAus>) => z.loeschen(5)],
  ] as const)(
    '%s scheitert: Fehler geht durch, nichts wird verworfen',
    async (_n, kern, aufruf) => {
      api[kern].mockRejectedValue(Object.assign(new Error('Nein'), { status: 403 }));
      await expect(aufruf(vorlagenZugriffAus(qc))).rejects.toMatchObject({ status: 403 });
      expect(auswahlVerworfen()).toBe(0);
    },
  );
});

describe('Die Punkte einer Vorlage', () => {
  it('jede Aktion schreibt mit dem Ziel „Vorlage“, meldet `geschrieben` und verwirft die Auswahl', async () => {
    const geschrieben = vi.fn();
    const a = vorlagenZugriffAus(qc).aktionen(5, geschrieben);
    await a.reorder([2, 1], [1, 2]);
    await a.add({ type: 'header', title: 'Neu' } as never);
    await a.update(3, { title: 'X' }, undefined);
    await a.setVorBeginn(3, true);
    await expect(a.remove(3)).resolves.toBe(ZETTEL);
    await a.restore(ZETTEL);
    expect(api.reorderAgenda).toHaveBeenCalledWith(ZIEL, [2, 1], [1, 2]);
    expect(api.createAgendaItem.mock.calls[0][0]).toEqual(ZIEL);
    expect(api.updateAgendaItem).toHaveBeenCalledWith(ZIEL, 3, { title: 'X' }, undefined);
    expect(api.setAgendaItemVorBeginn).toHaveBeenCalledWith(ZIEL, 3, true);
    expect(api.deleteAgendaItem).toHaveBeenCalledWith(ZIEL, 3);
    expect(api.restoreAgendaItem).toHaveBeenCalledWith(ZIEL, ZETTEL);
    expect(geschrieben).toHaveBeenCalledTimes(6);
    expect(auswahlVerworfen()).toBe(6);
  });

  it('war der Punkt schon weg (`wiederherstellen` fehlt), kommt `null` – kein Merkzettel', async () => {
    api.deleteAgendaItem.mockResolvedValue({ ok: true });
    const a = vorlagenZugriffAus(qc).aktionen(5, vi.fn());
    await expect(a.remove(3)).resolves.toBeNull();
  });

  it('ein Fehler beim Schreiben geht durch – `geschrieben` kommt nicht, nichts wird verworfen', async () => {
    const geschrieben = vi.fn();
    const a = vorlagenZugriffAus(qc).aktionen(5, geschrieben);
    for (const f of [api.reorderAgenda, api.updateAgendaItem, api.deleteAgendaItem]) {
      f.mockRejectedValue(Object.assign(new Error('Woanders geändert'), { status: 412 }));
    }
    await expect(a.reorder([1], [1])).rejects.toMatchObject({ status: 412 });
    await expect(a.update(3, { title: 'X' })).rejects.toMatchObject({ status: 412 });
    await expect(a.remove(3)).rejects.toMatchObject({ status: 412 });
    expect(geschrieben).not.toHaveBeenCalled();
    expect(auswahlVerworfen()).toBe(0);
  });

  it('die Aktionen kennen kein Auge – eine Vorlage hat keinen Termin', () => {
    expect('setWeggelassen' in vorlagenZugriffAus(qc).aktionen(5, vi.fn())).toBe(false);
  });
});
