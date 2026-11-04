import { describe, expect, it, vi } from 'vitest';
import type { AbwesenheitPort } from '@shared/absences/abwesenheiten';
import type { CtAbsence } from '@shared/ct/typen';
import { abwesenheitenDienst } from './ctDienst';
import { ApiError, NichtUebernommen, Unklar } from '../ct/fehler';

vi.mock('../ct/verbindung', () => ({
  ctDaten: vi.fn(async () => [
    { id: 2, name: 'Jugend', startDate: '2027-03-14T17:00:00Z', endDate: '2027-03-14T19:00:00Z' },
    { id: 1, name: 'Gottesdienst', startDate: '2027-03-14T09:00:00Z', endDate: '' },
    { id: 3, name: 'ohne Beginn', startDate: null },
  ]),
}));

const GRUENDE = {
  absenceReasons: [
    { id: 3, name: 'absent.reason.sick', nameTranslated: 'Krank', sortKey: 0 },
    { id: 1, name: 'absent.reason.absence', nameTranslated: 'Abwesend', sortKey: 2 },
  ],
};

/** Ein Anschluss, der jede Antwort aus `antworten` nimmt – nur was die Übersetzung braucht. */
function port(over: Partial<AbwesenheitPort> = {}): AbwesenheitPort {
  return {
    liste: vi.fn(async () => [] as CtAbsence[]),
    einer: vi.fn(async () => null),
    anlegen: vi.fn(async (_p, r) => ({
      data: { id: 7, startDate: '2027-03-10', endDate: '2027-03-10', ...r },
    })),
    ersetzen: vi.fn(async () => ({ data: null })),
    loeschen: vi.fn(async () => {}),
    stammdaten: vi.fn(async () => GRUENDE),
    ...over,
  };
}
const dienst = (p: AbwesenheitPort) =>
  abwesenheitenDienst({ ich: async () => 19, zeitzone: 'Europe/Berlin', port: p });
const tag = { startDate: '2027-03-10', endDate: '2027-03-10' };

describe('abwesenheitenDienst', () => {
  it('anlegen ohne Grund nimmt den vorgewählten der Gemeinde („Abwesend“, nicht den ersten)', async () => {
    const p = port();
    await dienst(p).anlegen(tag);
    expect(p.anlegen).toHaveBeenCalledWith(19, expect.objectContaining({ absenceReasonId: 1 }));
  });

  it('ein gewählter Grund bleibt', async () => {
    const p = port();
    await dienst(p).anlegen({ ...tag, reasonId: 3 });
    expect(p.anlegen).toHaveBeenCalledWith(19, expect.objectContaining({ absenceReasonId: 3 }));
  });

  it('ohne Gründe in ChurchTools → Meldung statt Schreiben', async () => {
    const p = port({ stammdaten: vi.fn(async () => ({ absenceReasons: [] })) });
    await expect(dienst(p).anlegen(tag)).rejects.toMatchObject({
      status: 400,
      message: 'Bitte einen Grund wählen.',
    });
    expect(p.anlegen).not.toHaveBeenCalled();
  });

  it('ungültig → 400 mit dem Satz des Kerns', async () => {
    await expect(dienst(port()).anlegen({ ...tag, endDate: '2027-03-01' })).rejects.toMatchObject({
      status: 400,
      message: 'Das Ende liegt vor dem Anfang.',
    });
  });

  it('Antwort ohne Eintrag → `Unklar` (nicht „versuch es noch einmal“)', async () => {
    const p = port({ anlegen: vi.fn(async () => ({ data: { ok: true } })) });
    await expect(dienst(p).anlegen(tag)).rejects.toBeInstanceOf(Unklar);
  });

  it('ändern: weg → 404, Doppel → 409', async () => {
    await expect(dienst(port()).aendern(5, tag)).rejects.toMatchObject({ status: 404 });
    const eintrag = (id: number): CtAbsence => ({
      id,
      ...tag,
      startTime: null,
      endTime: null,
      comment: '',
      absenceReason: { id: 1 },
    });
    const p = port({
      einer: vi.fn(async () => eintrag(5)),
      liste: vi.fn(async () => [
        eintrag(5),
        { ...eintrag(6), startDate: '2027-03-11', endDate: '2027-03-11' },
      ]),
    });
    await expect(
      dienst(p).aendern(5, { startDate: '2027-03-11', endDate: '2027-03-11' }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Für diesen Zeitraum gibt es schon einen Eintrag.',
    });
  });

  it('löschen: steht er danach noch da → `NichtUebernommen`', async () => {
    const p = port({ einer: vi.fn(async () => ({ id: 5, ...tag })) });
    await expect(dienst(p).loeschen(5)).rejects.toBeInstanceOf(NichtUebernommen);
    await expect(dienst(p).loeschen(5)).rejects.toBeInstanceOf(ApiError);
  });

  it('Termine: Tag in der Gemeinde, nach Beginn sortiert, ohne Ende ganztägig, ohne Beginn weg', async () => {
    expect(await dienst(port()).termine('2027-03-14', '2027-03-14')).toEqual([
      {
        id: 1,
        name: 'Gottesdienst',
        date: '2027-03-14',
        startDate: '2027-03-14T09:00:00Z',
        endDate: '2027-03-14T09:00:00Z',
      },
      {
        id: 2,
        name: 'Jugend',
        date: '2027-03-14',
        startDate: '2027-03-14T17:00:00Z',
        endDate: '2027-03-14T19:00:00Z',
      },
    ]);
  });
});
