import { WEITERE, type TerminAus } from '@shared/dienstplan/termine';
import type { TerminKalender } from '@shared/ct/kalenderFilter';
import type { FilterAbschnitt } from '@ui/bedienung/FilterKnopf';

/**
 * **Die Abschnitte „Kalender“ und „Veranstaltungen“ im Filter** – für Dienste-Liste und Matrix gleich (Wunsch 6,
 * 09.11.2026, Entwurf `w6-kalender-filter.html`). Was angeboten wird, rechnet `terminFilter`; hier wird es nur zu
 * Häkchen. Einen Abschnitt mit nur einer Möglichkeit blendet der `FilterKnopf` selbst aus.
 */
export function terminAbschnitte(
  angebot: { kalender: TerminKalender[]; arten: string[] },
  aus: TerminAus,
  onAus: (aus: { kalender: number[]; arten: string[] }) => void,
): FilterAbschnitt[] {
  return [
    {
      titel: 'Kalender',
      optionen: angebot.kalender.map((k) => ({ wert: String(k.id), text: k.name })),
      aus: aus.kalender.map(String),
      onAus: (kalender) => onAus({ kalender: kalender.map(Number), arten: [...aus.arten] }),
    },
    {
      titel: 'Veranstaltungen',
      optionen: angebot.arten.map((art) => ({
        wert: art,
        text: art === WEITERE ? 'Weitere' : art,
      })),
      aus: [...aus.arten],
      onAus: (arten) => onAus({ kalender: [...aus.kalender], arten }),
    },
  ];
}
