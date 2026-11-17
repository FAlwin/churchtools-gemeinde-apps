import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeloeschterPunkt } from '@shared/ct/schreibKern';

/**
 * Die Weiche für die Ablaufvorlagen (E10-V3b): **jeder Vorgang** geht in der Erweiterung an `ctLesen`/`ctSchreiben`
 * (direkt an ChurchTools) und im Server-Betrieb an die eigene Route – nie beides, nie die falsche. Die Punkt-Vorgänge
 * (`reorderAgenda` …) nehmen ein Ziel: Termin → `/api/services/:id/agenda/…`, Vorlage → `/api/ablauf-vorlagen/:id/agenda/…`.
 * Die Rechte und Regeln dahinter stehen im Kern und werden dort geprüft.
 */
const modus = vi.hoisted(() => ({ erweiterung: false }));
vi.mock('./modus', async (original) => ({
  ...(await original<typeof import('./modus')>()),
  get istExtension() {
    return modus.erweiterung;
  },
}));

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  apiFetch,
}));

const ext = vi.hoisted(() => ({
  vorlagenStand: vi.fn(),
  vorlage: vi.fn(),
}));
vi.mock('./ctLesen', async (original) => ({
  ...(await original<typeof import('./ctLesen')>()),
  ...ext,
}));

const schreiben = vi.hoisted(() => ({
  vorlageNeu: vi.fn(),
  vorlageUmbenennen: vi.fn(),
  vorlageLoeschen: vi.fn(),
  vorlageAusTermin: vi.fn(),
  vorlageMitTerminErsetzen: vi.fn(),
  reihenfolge: vi.fn(),
  punktNeu: vi.fn(),
  punkt: vi.fn(),
  punktWeg: vi.fn(),
  punktZurueck: vi.fn(),
  vorBeginn: vi.fn(),
}));
vi.mock('./ctSchreiben', async (original) => ({
  ...(await original<typeof import('./ctSchreiben')>()),
  ...schreiben,
}));

const api = await import('./churchtoolsApi');

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

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ ok: true, id: 42 });
});

describe('Server-Betrieb: eigene Routen', () => {
  beforeEach(() => {
    modus.erweiterung = false;
  });

  it('Stand und Vorlage lesen', async () => {
    await api.getVorlagenStand();
    await api.getVorlage(5);
    expect(apiFetch.mock.calls).toEqual([
      ['/api/ablauf-vorlagen/stand'],
      ['/api/ablauf-vorlagen/5'],
    ]);
    expect(ext.vorlagenStand).not.toHaveBeenCalled();
    expect(ext.vorlage).not.toHaveBeenCalled();
  });

  it('anlegen, umbenennen, löschen', async () => {
    await expect(api.vorlageAnlegen({ name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    await api.vorlageUmbenennen(5, 'Anders');
    await api.vorlageLoeschen(5);
    expect(apiFetch.mock.calls).toEqual([
      [
        '/api/ablauf-vorlagen',
        { method: 'POST', body: JSON.stringify({ name: 'Neu', kalenderId: 2 }) },
      ],
      ['/api/ablauf-vorlagen/5', { method: 'PUT', body: JSON.stringify({ name: 'Anders' }) }],
      ['/api/ablauf-vorlagen/5', { method: 'DELETE' }],
    ]);
    for (const f of Object.values(schreiben)) expect(f).not.toHaveBeenCalled();
  });

  it('„Als Vorlage …“: neue Vorlage aus einem Termin (POST, liefert die ID), vorhandene ersetzen (PUT mit `gesehen`)', async () => {
    await expect(api.vorlageAusTermin(9, { name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    await api.vorlageMitTerminErsetzen(5, 9, '2026-11-13T10:00:00Z');
    await api.vorlageMitTerminErsetzen(5, 9);
    expect(apiFetch.mock.calls).toEqual([
      [
        '/api/services/9/agenda/als-vorlage',
        { method: 'POST', body: JSON.stringify({ name: 'Neu', kalenderId: 2 }) },
      ],
      [
        '/api/ablauf-vorlagen/5/aus-termin/9',
        { method: 'PUT', body: JSON.stringify({ gesehen: '2026-11-13T10:00:00Z' }) },
      ],
      ['/api/ablauf-vorlagen/5/aus-termin/9', { method: 'PUT', body: JSON.stringify({}) }],
    ]);
    expect(schreiben.vorlageAusTermin).not.toHaveBeenCalled();
    expect(schreiben.vorlageMitTerminErsetzen).not.toHaveBeenCalled();
  });

  it.each([
    ['Termin', 9, '/api/services/9/agenda'],
    ['Vorlage', { vorlageId: 5 }, '/api/ablauf-vorlagen/5/agenda'],
  ])('Punkt-Vorgänge am Ziel „%s“ gehen unter %s', async (_n, ziel, wurzel) => {
    await api.reorderAgenda(ziel, [2, 1], [1, 2]);
    await api.createAgendaItem(ziel, { type: 'header', title: 'Neu' });
    await api.updateAgendaItem(ziel, 3, { title: 'Anders' });
    await api.setAgendaItemVorBeginn(ziel, 3, true);
    await api.deleteAgendaItem(ziel, 3);
    await api.restoreAgendaItem(ziel, ZETTEL);
    expect(
      apiFetch.mock.calls.map(([pfad, o]) => [
        (o as RequestInit | undefined)?.method ?? 'GET',
        pfad,
      ]),
    ).toEqual([
      ['PATCH', `${wurzel}/order`],
      ['POST', `${wurzel}/items`],
      ['PUT', `${wurzel}/items/3`],
      ['PUT', `${wurzel}/items/3/vor-beginn`],
      ['DELETE', `${wurzel}/items/3`],
      ['POST', `${wurzel}/items/wiederherstellen`],
    ]);
  });
});

describe('Erweiterung: direkt an ChurchTools, nie über den Server', () => {
  beforeEach(() => {
    modus.erweiterung = true;
    for (const f of [...Object.values(ext), ...Object.values(schreiben)])
      f.mockResolvedValue(undefined);
    schreiben.vorlageNeu.mockResolvedValue(42);
  });

  it('Stand und Vorlage lesen', async () => {
    await api.getVorlagenStand();
    await api.getVorlage(5);
    expect(ext.vorlagenStand).toHaveBeenCalledTimes(1);
    expect(ext.vorlage).toHaveBeenCalledWith(5);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('anlegen, umbenennen, löschen', async () => {
    await expect(api.vorlageAnlegen({ name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    await api.vorlageUmbenennen(5, 'Anders');
    await api.vorlageLoeschen(5);
    expect(schreiben.vorlageNeu).toHaveBeenCalledWith({ name: 'Neu', kalenderId: 2 });
    expect(schreiben.vorlageUmbenennen).toHaveBeenCalledWith(5, 'Anders');
    expect(schreiben.vorlageLoeschen).toHaveBeenCalledWith(5);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('„Als Vorlage …“ geht direkt an den Kern – Termin und Vorlage in der richtigen Reihenfolge', async () => {
    schreiben.vorlageAusTermin.mockResolvedValue(42);
    await expect(api.vorlageAusTermin(9, { name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    await api.vorlageMitTerminErsetzen(5, 9, '2026-11-13T10:00:00Z');
    expect(schreiben.vorlageAusTermin).toHaveBeenCalledWith(9, { name: 'Neu', kalenderId: 2 });
    expect(schreiben.vorlageMitTerminErsetzen).toHaveBeenCalledWith(5, 9, '2026-11-13T10:00:00Z');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('Punkt-Vorgänge reichen das Ziel unverändert an den Kern', async () => {
    const ziel = { vorlageId: 5 };
    await api.reorderAgenda(ziel, [2, 1]);
    await api.createAgendaItem(ziel, { type: 'header', title: 'Neu' });
    await api.updateAgendaItem(ziel, 3, { title: 'X' });
    await api.setAgendaItemVorBeginn(ziel, 3, true);
    await api.deleteAgendaItem(ziel, 3);
    await api.restoreAgendaItem(ziel, ZETTEL);
    for (const f of [
      schreiben.reihenfolge,
      schreiben.punktNeu,
      schreiben.punkt,
      schreiben.vorBeginn,
      schreiben.punktWeg,
      schreiben.punktZurueck,
    ]) {
      expect(f.mock.calls[0][0]).toBe(ziel);
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
