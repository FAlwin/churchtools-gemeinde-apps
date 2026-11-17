import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CtSchreiber } from '@shared/ct/schreibKern';
import type { CtAgenda, CtAblaufVorlage } from '@shared/ct/typen';
import { ablaufAktionen, vorlagenAktionen } from './ablaufAktionen';

/**
 * **Eine Zuordnung auf den Schreib-Kern für Termin UND Vorlage** (E10-V3a): Die Aktionen der Bearbeiten-Liste schreiben mit
 * dem Ziel „Termin“ nach `/events/{id}/agenda`, mit dem Ziel „Vorlage“ nach `/agendatemplates/{id}` – dieselbe Kette, kein
 * zweiter Satz Aktionen. Der Schreiber ist ersetzt (er merkt sich die Pfade), die Regeln laufen echt.
 */
const aufrufe: { method: string; pfad: string }[] = [];
const gelesen: string[] = [];
const PUNKTE = [
  { id: 3, position: 0, title: 'Begrüßung', type: 'normal', duration: 300, note: '' },
  { id: 4, position: 1, title: 'Predigt', type: 'normal', duration: 1800, note: '' },
];

vi.mock('@ui/ct/schreiber', () => {
  const s: CtSchreiber = {
    agenda: (id) => {
      gelesen.push(`/events/${id}/agenda`);
      return Promise.resolve({ id, items: PUNKTE, calendarId: 2 } as unknown as CtAgenda);
    },
    vorlage: (id) => {
      gelesen.push(`/agendatemplates/${id}`);
      return Promise.resolve({ id, name: 'V', calendarId: 2, items: PUNKTE } as CtAblaufVorlage);
    },
    song: () => Promise.reject(new Error('nicht gebraucht')),
    schreibe: (pfad, auftrag) => {
      aufrufe.push({ method: auftrag.method, pfad });
      return Promise.resolve(null);
    },
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
  };
  return { browserSchreiber: s };
});

beforeEach(() => {
  aufrufe.length = 0;
  gelesen.length = 0;
});

describe('Aktionen der Bearbeiten-Liste', () => {
  it('Vorlage: Punkt ändern und umsortieren gehen nach /agendatemplates/{id} und melden `geschrieben`', async () => {
    const geschrieben = vi.fn();
    const a = vorlagenAktionen(5, geschrieben);
    await a.update(3, { title: 'Willkommen' });
    await a.reorder([4, 3]);
    expect(gelesen.every((p) => p === '/agendatemplates/5')).toBe(true);
    expect(aufrufe.length).toBeGreaterThan(0);
    expect(aufrufe.every((c) => c.pfad.startsWith('/agendatemplates/5'))).toBe(true);
    expect(geschrieben).toHaveBeenCalledTimes(2);
  });

  it('Vorlage: kein Auge – die Aktion gibt es dort gar nicht', () => {
    expect('setWeggelassen' in vorlagenAktionen(5, () => {})).toBe(false);
  });

  it('Termin: derselbe Weg nach /events/{id}/agenda, mit Auge', async () => {
    const geschrieben = vi.fn();
    const a = ablaufAktionen(7, geschrieben);
    await a.update(3, { title: 'Willkommen' });
    expect(gelesen.every((p) => p === '/events/7/agenda')).toBe(true);
    expect(aufrufe.every((c) => c.pfad.startsWith('/events/7/agenda'))).toBe(true);
    expect(typeof a.setWeggelassen).toBe('function');
    expect(geschrieben).toHaveBeenCalledTimes(1);
  });

  it('Termin: das Auge schreibt …/hide und meldet `geschrieben`', async () => {
    const geschrieben = vi.fn();
    await ablaufAktionen(7, geschrieben).setWeggelassen(3, true);
    expect(aufrufe).toEqual([{ method: 'POST', pfad: '/events/7/agenda/items/3/hide' }]);
    expect(geschrieben).toHaveBeenCalledTimes(1);
  });
});
