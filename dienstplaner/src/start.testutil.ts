import { diensteAus } from '@shared/ct/dienste';
import type { Start } from './start';

/**
 * Ein `Start` für Tests – wie an der Test-Instanz: Programm (1), Technik (3), Musik (4); Ton/Licht in
 * Technik (Gruppe 7), Gesang in Musik (Gruppe 9). `extra` überschreibt. Eine Stelle für alle Tests des
 * Dienstplaners, damit ein neues Feld nicht in jedem Test nachgetragen werden muss.
 */
export function startFuer(extra: Partial<Start> = {}): Start {
  return {
    ichId: 1,
    vorname: 'Alwin',
    gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
    gruppen: [],
    dienstgruppen: [
      { id: 1, name: 'Programm', fuerAlle: false },
      { id: 3, name: 'Technik', fuerAlle: false },
      { id: 4, name: 'Musik', fuerAlle: false },
    ],
    dienste: diensteAus([
      { id: 1, name: 'Predigt', serviceGroupId: 1, groupIds: [6] },
      { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
      { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
      { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
    ]),
    rechte: {
      planbareDienstgruppen: [3, 4],
      sichtbareDienstgruppen: [],
      ablaufKalender: [],
      abwesenheitenAller: false,
    },
    ...extra,
  };
}
