import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';

vi.mock('../services/ctRead.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ctRead.js')>()),
  getVorlagenStand: vi.fn(),
  getAblaufVorlage: vi.fn(),
}));
vi.mock('../services/ctWrite.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ctWrite.js')>()),
  createVorlage: vi.fn(),
  renameVorlage: vi.fn(),
  deleteVorlage: vi.fn(),
  reorderAgenda: vi.fn(),
  createAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
  deleteAgendaItem: vi.fn(),
  restoreAgendaItem: vi.fn(),
  setAgendaItemVorBeginn: vi.fn(),
}));
vi.mock('../services/setlistBuilder.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/setlistBuilder.js')>()),
  invalidateSongUsageCache: vi.fn(),
}));

const ctrl = await import('./setlistController.js');
const lesen = await import('../services/ctRead.js');
const schreiben = await import('../services/ctWrite.js');
const { invalidateSongUsageCache } = await import('../services/setlistBuilder.js');
const { default: router } = await import('../routes/setlist.js');

/**
 * Die Seite „Ablaufvorlagen“ am Server der Musik-App (E10-V3b): Die Regeln stehen im Kern und werden in `ctWrite.test.ts`
 * (Token-Wächter) und `shared/ct/ablaufVorlagen.test.ts` geprüft – hier nur, dass die Controller richtig verdrahten:
 * Eingaben prüfen, **das richtige Ziel** an den Kern geben (Termin oder Vorlage), Fehler von ChurchTools unverändert
 * durchreichen.
 */
function aufruf(params: Record<string, string>, body: unknown = {}) {
  const req = { ctCookie: 'ct=1', ctUserId: 7, params, body, query: {} } as unknown as Request;
  const res = { json: vi.fn() } as unknown as Response;
  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Vorlagen als Ganzes', () => {
  it('Stand und eine Vorlage werden frisch gelesen und unverändert weitergegeben', async () => {
    const stand = { gruppen: [], kalender: [] };
    vi.mocked(lesen.getVorlagenStand).mockResolvedValue(stand);
    const a = aufruf({});
    await ctrl.getVorlagenStandCtrl(a.req, a.res);
    expect(lesen.getVorlagenStand).toHaveBeenCalledWith('ct=1');
    expect(a.res.json).toHaveBeenCalledWith(stand);

    const vorlage = { id: 5, name: 'V', items: [] };
    vi.mocked(lesen.getAblaufVorlage).mockResolvedValue(vorlage);
    const b = aufruf({ vorlageId: '5' });
    await ctrl.getVorlageCtrl(b.req, b.res);
    expect(lesen.getAblaufVorlage).toHaveBeenCalledWith('ct=1', 5);
    expect(b.res.json).toHaveBeenCalledWith(vorlage);
  });

  it('anlegen: Name und Kalender werden geprüft, die ID kommt zurück', async () => {
    vi.mocked(schreiben.createVorlage).mockResolvedValue(42);
    const a = aufruf({}, { name: 'Neu', kalenderId: '2' });
    await ctrl.postVorlageCtrl(a.req, a.res);
    expect(schreiben.createVorlage).toHaveBeenCalledWith('ct=1', { name: 'Neu', kalenderId: 2 });
    expect(a.res.json).toHaveBeenCalledWith({ id: 42 });

    for (const body of [{ name: 'X' }, { kalenderId: 2 }, { name: 'X', kalenderId: 0 }, {}]) {
      await expect(ctrl.postVorlageCtrl(aufruf({}, body).req, a.res)).rejects.toThrow();
    }
    expect(schreiben.createVorlage).toHaveBeenCalledTimes(1);
  });

  it('umbenennen und löschen: Vorlagen-ID und Name gehen an den Kern; eine Unsinn-ID nicht', async () => {
    const a = aufruf({ vorlageId: '5' }, { name: 'Anders' });
    await ctrl.putVorlageCtrl(a.req, a.res);
    expect(schreiben.renameVorlage).toHaveBeenCalledWith('ct=1', 5, 'Anders');

    const b = aufruf({ vorlageId: '5' });
    await ctrl.deleteVorlageCtrl(b.req, b.res);
    expect(schreiben.deleteVorlage).toHaveBeenCalledWith('ct=1', 5);

    await expect(ctrl.deleteVorlageCtrl(aufruf({ vorlageId: 'x' }).req, b.res)).rejects.toThrow();
    await expect(ctrl.putVorlageCtrl(aufruf({ vorlageId: '5' }, {}).req, b.res)).rejects.toThrow();
  });

  it.each([403, 404, 412, 423])('%s von ChurchTools geht unverändert durch', async (status) => {
    vi.mocked(schreiben.deleteVorlage).mockRejectedValue(new HttpError(status, 'Nein'));
    await expect(
      ctrl.deleteVorlageCtrl(aufruf({ vorlageId: '5' }).req, aufruf({}).res),
    ).rejects.toMatchObject({
      status,
    });
  });
});

/** Alle sechs Punkt-Handler mit ihrem Aufruf im Kern – eine Tabelle, damit keiner vergessen wird. */
const PUNKT_HANDLER: Array<{
  name: string;
  rufen: (req: Request, res: Response) => Promise<void>;
  kern: () => ReturnType<typeof vi.fn>;
  params: Record<string, string>;
  body: unknown;
}> = [
  {
    name: 'umsortieren',
    rufen: ctrl.putAgendaOrder,
    kern: () => vi.mocked(schreiben.reorderAgenda),
    params: {},
    body: { order: [2, 1] },
  },
  {
    name: 'anlegen',
    rufen: ctrl.postAgendaItem,
    kern: () => vi.mocked(schreiben.createAgendaItem),
    params: {},
    body: { type: 'header', title: 'Neu' },
  },
  {
    name: 'ändern',
    rufen: ctrl.putAgendaItem,
    kern: () => vi.mocked(schreiben.updateAgendaItem),
    params: { itemId: '3' },
    body: { title: 'Anders' },
  },
  {
    name: 'löschen',
    rufen: ctrl.deleteAgendaItemCtrl,
    kern: () => vi.mocked(schreiben.deleteAgendaItem),
    params: { itemId: '3' },
    body: {},
  },
  {
    name: 'zurückholen',
    rufen: ctrl.postAgendaItemWiederherstellen,
    kern: () => vi.mocked(schreiben.restoreAgendaItem),
    params: {},
    body: {
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
    },
  },
  {
    name: 'vor Beginn',
    rufen: ctrl.putAgendaItemVorBeginn,
    kern: () => vi.mocked(schreiben.setAgendaItemVorBeginn),
    params: { itemId: '3' },
    body: { vorBeginn: true },
  },
];

describe('Punkt-Routen: das Ziel kommt aus dem Pfad', () => {
  it.each(PUNKT_HANDLER)('$name: Termin → Zahl an den Kern', async (h) => {
    const a = aufruf({ eventId: '9', ...h.params }, h.body);
    await h.rufen(a.req, a.res);
    expect(h.kern().mock.calls[0][1]).toBe(9);
  });

  it.each(PUNKT_HANDLER)('$name: Vorlage → { vorlageId } an den Kern', async (h) => {
    const a = aufruf({ vorlageId: '5', ...h.params }, h.body);
    await h.rufen(a.req, a.res);
    expect(h.kern().mock.calls[0][1]).toEqual({ vorlageId: 5 });
  });

  it.each(PUNKT_HANDLER)(
    '$name: weder Termin noch Vorlage → Fehler, nichts geschrieben',
    async (h) => {
      const a = aufruf({ ...h.params }, h.body);
      await expect(h.rufen(a.req, a.res)).rejects.toThrow();
      expect(h.kern()).not.toHaveBeenCalled();
    },
  );

  it.each(PUNKT_HANDLER)('$name: Unsinn als Vorlagen-ID wird abgelehnt', async (h) => {
    const a = aufruf({ vorlageId: 'abc', ...h.params }, h.body);
    await expect(h.rufen(a.req, a.res)).rejects.toThrow();
    expect(h.kern()).not.toHaveBeenCalled();
  });

  it('die Liedstatistik wird nur für Termine neu geholt, nie für eine Vorlage', async () => {
    const lieder = PUNKT_HANDLER.filter((h) =>
      ['anlegen', 'ändern', 'löschen', 'zurückholen'].includes(h.name),
    );
    for (const h of lieder) {
      vi.mocked(invalidateSongUsageCache).mockClear();
      const v = aufruf({ vorlageId: '5', ...h.params }, h.body);
      await h.rufen(v.req, v.res);
      expect(invalidateSongUsageCache, `${h.name} (Vorlage)`).not.toHaveBeenCalled();
      const t = aufruf({ eventId: '9', ...h.params }, h.body);
      await h.rufen(t.req, t.res);
      expect(invalidateSongUsageCache, `${h.name} (Termin)`).toHaveBeenCalledTimes(1);
    }
  });

  it.each([403, 404, 412, 423])(
    '%s von ChurchTools geht beim Punkt einer Vorlage durch',
    async (status) => {
      vi.mocked(schreiben.updateAgendaItem).mockRejectedValue(new HttpError(status, 'Nein'));
      const a = aufruf({ vorlageId: '5', itemId: '3' }, { title: 'X' });
      await expect(ctrl.putAgendaItem(a.req, a.res)).rejects.toMatchObject({ status });
    },
  );
});

/**
 * Die Pfade selbst: Jeder Punkt-Handler hängt unter dem Termin UND unter der Vorlage – und `/stand` steht vor
 * `/:vorlageId` (sonst läse Express „stand“ als ID).
 */
describe('Routen', () => {
  type Schicht = { route?: { path: string; methods: Record<string, boolean> } };
  const routen = (router.stack as unknown as Schicht[])
    .filter((l) => l.route)
    .map((l) => ({ pfad: l.route!.path, methoden: Object.keys(l.route!.methods) }));
  const hat = (methode: string, pfad: string) =>
    routen.some((r) => r.pfad === pfad && r.methoden.includes(methode));

  it.each([
    ['patch', '/agenda/order'],
    ['post', '/agenda/items'],
    ['post', '/agenda/items/wiederherstellen'],
    ['put', '/agenda/items/:itemId'],
    ['put', '/agenda/items/:itemId/vor-beginn'],
    ['delete', '/agenda/items/:itemId'],
  ])('%s …%s gibt es für Termin und Vorlage', (methode, rest) => {
    expect(hat(methode, `/services/:eventId${rest}`)).toBe(true);
    expect(hat(methode, `/ablauf-vorlagen/:vorlageId${rest}`)).toBe(true);
  });

  it('das Auge gibt es nur am Termin', () => {
    expect(hat('put', '/services/:eventId/agenda/items/:itemId/weglassen')).toBe(true);
    expect(hat('put', '/ablauf-vorlagen/:vorlageId/agenda/items/:itemId/weglassen')).toBe(false);
  });

  it('die Vorlagen selbst: stand, lesen, anlegen, umbenennen, löschen – `/stand` vor `/:vorlageId`', () => {
    expect(hat('get', '/ablauf-vorlagen/stand')).toBe(true);
    expect(hat('get', '/ablauf-vorlagen/:vorlageId')).toBe(true);
    expect(hat('post', '/ablauf-vorlagen')).toBe(true);
    expect(hat('put', '/ablauf-vorlagen/:vorlageId')).toBe(true);
    expect(hat('delete', '/ablauf-vorlagen/:vorlageId')).toBe(true);
    const pfade = routen.filter((r) => r.methoden.includes('get')).map((r) => r.pfad);
    expect(pfade.indexOf('/ablauf-vorlagen/stand')).toBeLessThan(
      pfade.indexOf('/ablauf-vorlagen/:vorlageId'),
    );
  });
});
