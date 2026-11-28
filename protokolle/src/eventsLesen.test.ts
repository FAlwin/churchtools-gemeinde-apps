import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { ctDaten } from '@ui/ct/verbindung';
import { eventsNachlesen, eventsPfad, eventZumTerminLesen } from './eventsLesen';

vi.mock('@ui/ct/verbindung', () => ({ ctDaten: vi.fn() }));

/** Event zu Termin und Beginn nachlesen: Die Nummer des Events bekommt nur, wer es wirklich gelesen hat. */
const ZONE = 'Europe/Berlin';
const roh = (id: number, termin: number | null, start: string, name = 'Jugendabend') => ({
  id,
  name,
  appointmentId: termin,
  startDate: start,
  calendar: { domainIdentifier: '4' },
});
const ANFRAGE = { termin: 700, tag: '2027-01-27', startDate: '2027-01-27T18:30:00Z', zeitzone: ZONE };

beforeEach(() => vi.resetAllMocks());

describe('eventZumTerminLesen', () => {
  it('liefert das Event mit Nummer, Name und Tag – gelesen mit einem Tag Luft auf beiden Seiten', async () => {
    vi.mocked(ctDaten).mockResolvedValue([
      roh(1, 699, '2027-01-27T18:30:00Z', 'Fremd'),
      roh(2, 700, '2027-01-27T19:30:00Z', 'Falsche Zeit'),
      roh(3, 700, '2027-01-27T18:30:00Z'),
    ]);
    const e = await eventZumTerminLesen(ANFRAGE);
    expect(e).toEqual({
      id: 3,
      name: 'Jugendabend',
      startDate: '2027-01-27T18:30:00Z',
      tag: '2027-01-27',
      kalenderId: 4,
    });
    expect(ctDaten).toHaveBeenCalledWith(eventsPfad('2027-01-26', '2027-01-28'));
  });

  it('der Tag ist die Ortszeit der Gemeinde, nicht der UTC-Tag', async () => {
    vi.mocked(ctDaten).mockResolvedValue([roh(3, 700, '2027-01-27T23:30:00Z')]);
    const e = await eventZumTerminLesen({ ...ANFRAGE, startDate: '2027-01-27T23:30:00Z' });
    expect(e?.tag).toBe('2027-01-28');
  });

  it('gelesen, aber kein Event zu diesem Termin und Beginn: null (nicht ein Wurf)', async () => {
    vi.mocked(ctDaten).mockResolvedValue([roh(1, 699, '2027-01-27T18:30:00Z'), roh(2, null, '2027-01-27T18:30:00Z')]);
    expect(await eventZumTerminLesen(ANFRAGE)).toBeNull();
    vi.mocked(ctDaten).mockResolvedValue(null);
    expect(await eventZumTerminLesen(ANFRAGE)).toBeNull();
  });

  it('scheitert das Lesen oder ist die Antwort keine Liste, wirft es – „weiß man nicht“ ist nicht „fehlt“', async () => {
    vi.mocked(ctDaten).mockRejectedValue(new ApiError(503, 'weg'));
    await expect(eventZumTerminLesen(ANFRAGE)).rejects.toBeInstanceOf(ApiError);
    vi.mocked(ctDaten).mockResolvedValue({ unerwartet: true } as never);
    await expect(eventZumTerminLesen(ANFRAGE)).rejects.toThrow();
  });
});

describe('eventsNachlesen (dieselbe Suche)', () => {
  const gewuenscht = [
    { tag: '2027-01-27', startDate: '2027-01-27T18:30:00Z' },
    { tag: '2027-02-03', startDate: '2027-02-03T18:30:00Z' },
  ];
  it('fehlend sind die Tage ohne Event dieses Termins mit diesem Beginn', async () => {
    vi.mocked(ctDaten).mockResolvedValue([roh(3, 700, '2027-01-27T18:30:00Z'), roh(4, 5, '2027-02-03T18:30:00Z')]);
    expect(await eventsNachlesen({ termin: 700, gewuenscht })).toEqual({
      fehlend: ['2027-02-03'],
      unklar: false,
    });
    expect(ctDaten).toHaveBeenCalledWith(eventsPfad('2027-01-26', '2027-02-04'));
  });
  it('scheitert das Lesen oder liefert keine Liste: unklar, nie „fehlt“', async () => {
    vi.mocked(ctDaten).mockRejectedValue(new Error('weg'));
    expect(await eventsNachlesen({ termin: 700, gewuenscht })).toEqual({ fehlend: [], unklar: true });
    vi.mocked(ctDaten).mockResolvedValue('x' as never);
    expect(await eventsNachlesen({ termin: 700, gewuenscht })).toEqual({ fehlend: [], unklar: true });
  });
});
