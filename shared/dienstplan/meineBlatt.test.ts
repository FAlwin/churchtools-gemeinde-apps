import { describe, expect, it } from 'vitest';
import type { Zelle } from '../ct/terminBlatt';
import { meineBlatt } from './meineBlatt';
import { einteilungenAus } from './tausch';

/** „Meine Dienste“ (E8-3) – aus rohen ChurchTools-Einträgen über denselben Erzeuger wie das Tauschen. */
const ROH = [
  {
    id: 2,
    serviceId: 6,
    serviceName: 'Ton',
    isAccepted: false,
    event: { id: 20, name: 'Gottesdienst', startDate: '2026-11-29T09:00:00Z' },
  },
  {
    id: 1,
    serviceId: 3,
    serviceName: 'Leitung',
    isAccepted: true,
    event: { id: 10, name: 'Gottesdienst', startDate: '2026-11-08T09:00:00Z' },
  },
  {
    id: 3,
    serviceId: 9,
    isValid: false,
    event: { id: 30, name: 'Weg', startDate: '2026-12-01T09:00:00Z' },
  },
];
const text = (c: Zelle) => c.absaetze.map((a) => a.laeufe.map((l) => l.text).join('')).join(' / ');
const quelle = (roh: unknown[]) => ({
  name: 'Alwin Friesen',
  einteilungen: einteilungenAus(roh),
  zeitzone: 'Europe/Berlin',
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  stand: 'Stand 05.11.2026 14:00',
});

describe('Meine Dienste (E8-3)', () => {
  it('nach Beginn sortiert, in Ortszeit, mit Termin, Dienst und zugesagt/angefragt; ungültige fehlen', () => {
    const b = meineBlatt(quelle(ROH));
    expect(b.titel).toBe('Meine Dienste');
    expect(b.untertitel).toBe('Alwin Friesen · 8. November – 29. November 2026');
    expect(b.abschnitte[0].kopf).toEqual(['Datum', 'Termin', 'Dienst', 'Stand']);
    expect(b.abschnitte[0].zeilen.map((z) => z.map(text))).toEqual([
      ['So, 08.11. 10:00', 'Gottesdienst', 'Leitung', 'zugesagt'],
      ['So, 29.11. 10:00', 'Gottesdienst', 'Ton', 'angefragt'],
    ]);
    expect(b.dateiname).toBe('Meine Dienste Alwin Friesen');
  });

  it('die Uhrzeit in der Zeitzone der Gemeinde – nicht in UTC', () => {
    const b = meineBlatt({ ...quelle(ROH), zeitzone: 'Pacific/Kiritimati' });
    expect(text(b.abschnitte[0].zeilen[0][0])).toBe('So, 08.11. 23:00');
  });

  it('keine Dienste → Hinweis statt leerer Tabelle', () => {
    const b = meineBlatt(quelle([]));
    expect(b.abschnitte).toEqual([]);
    expect(b.leer).toBe('Du hast keine kommenden Dienste.');
    expect(b.untertitel).toBe('Alwin Friesen');
  });
});
