import { describe, expect, it } from 'vitest';
import type { DienstRechte } from '../ct/dienstRechte';
import type { RohTermin } from './termine';
import { terminDiensteAus } from './terminBlattDienste';

/** Die Dienste eines Termins ohne den Dienstplaner (E8-1b, Musik-App) – aus den rohen ChurchTools-Antworten. */
const DIENSTE = [
  { id: 1, name: 'Predigt', serviceGroupId: 1, groupIds: [6] },
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
  { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
  { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
];
const GRUPPEN = [
  { id: 1, name: 'Programm', sortKey: 1, viewAll: true },
  { id: 3, name: 'Technik', sortKey: 2, viewAll: false },
  { id: 4, name: 'Musik', sortKey: 3, viewAll: false },
];
const RECHTE: DienstRechte = {
  planbareDienstgruppen: [],
  sichtbareDienstgruppen: [4],
  ablaufKalender: [],
  terminKalender: [],
  abwesenheitenAller: false,
};
const TERMIN = {
  id: 7,
  name: 'Gottesdienst',
  startDate: '2026-11-01T09:00:00Z',
  endDate: '2026-11-01T10:30:00Z',
  eventServices: [
    { id: 1, serviceId: 1, personId: 5, name: 'Wilhelm Brandt', isAccepted: true },
    { id: 2, serviceId: 6, personId: 1, name: 'Alwin Friesen', isAccepted: true },
    { id: 3, serviceId: 9, personId: 8, name: 'Irene Lang', isAccepted: false, index: 1 },
    { id: 4, serviceId: 9, personId: null, name: null, index: 2 },
  ],
} as unknown as RohTermin;

describe('terminDiensteAus', () => {
  it('Programm (für alle sichtbar) und Musik (sichtbar per Recht) mit Personen, angefragt und frei', () => {
    expect(terminDiensteAus(TERMIN, DIENSTE, GRUPPEN, RECHTE, 'Europe/Berlin')).toEqual([
      {
        id: 1,
        name: 'Programm',
        dienste: [
          { name: 'Predigt', personen: [{ name: 'Wilhelm Brandt', angefragt: false }], frei: 0 },
        ],
      },
      {
        id: 4,
        name: 'Musik',
        dienste: [{ name: 'Gesang', personen: [{ name: 'Irene Lang', angefragt: true }], frei: 1 }],
      },
    ]);
  });

  it('Technik ist weder für alle sichtbar noch per Recht – sie fehlt, statt nur den eigenen Platz zu zeigen', () => {
    const gruppen = terminDiensteAus(TERMIN, DIENSTE, GRUPPEN, RECHTE, 'Europe/Berlin');
    expect(gruppen.map((g) => g.name)).not.toContain('Technik');
    const mitRecht = terminDiensteAus(
      TERMIN,
      DIENSTE,
      GRUPPEN,
      { ...RECHTE, sichtbareDienstgruppen: [3, 4] },
      'Europe/Berlin',
    );
    expect(mitRecht.map((g) => g.name)).toContain('Technik');
  });
});
