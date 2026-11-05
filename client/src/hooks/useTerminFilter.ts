import { useState } from 'react';
import type { Service } from '@shared/types/index';
import type { FilterAbschnitt } from '@ui/bedienung/FilterKnopf';
import { getTermineFilter, setTermineFilter } from '../utils/devicePrefs';
import {
  kalenderImFilter,
  kalenderOhneAblauf,
  kalenderUmschalten,
  ohneAblaufUmschalten,
  startFilter,
  terminSichtbar,
  type KalenderFilter,
} from '../utils/kalenderFilter';
import { useKalender, useSiteConfig } from './useSiteConfig';

/**
 * **Filter der Terminliste** (05.11.2026) – der Abschnitt für den `FilterKnopf`, auf dem Gerät gemerkt. Die Regeln stehen
 * in `utils/kalenderFilter`. Gespeichert wird erst beim ersten Häkchen; bis dahin gilt der Startwert bei jedem Öffnen
 * gleich (wie bei den Abwesenheiten).
 *
 * `termine`: alles, was die Liste gerade kennt (kommende und geladene vergangene) – ihre Kalender stehen im Filter.
 */
export function useTerminFilter(
  termine: readonly Service[],
  darfImKalender: (kalenderId: number) => boolean,
) {
  const [gemerkt, setGemerkt] = useState<KalenderFilter | null>(getTermineFilter);
  const frueher = useSiteConfig().data.ablaufAnlegen;
  const filter = gemerkt ?? startFilter(frueher);
  const kalender = useKalender(true);

  const setzen = (neu: KalenderFilter): void => {
    setGemerkt(neu);
    setTermineFilter(neu);
  };

  const liste = kalenderImFilter(termine, kalender.data, filter, darfImKalender);
  const abschnitt: FilterAbschnitt = {
    titel: 'Kalender',
    optionen: liste.map((k) => ({
      wert: String(k.id),
      text: k.name,
      ...(k.ohneAblaufMoeglich
        ? {
            zusatz: {
              text: 'auch ohne Ablauf',
              an: filter.ohneAblauf.includes(k.id),
              onUmschalten: () => setzen(ohneAblaufUmschalten(filter, k.id)),
            },
          }
        : {}),
    })),
    aus: filter.aus.map(String),
    onAus: (aus) => setzen(kalenderUmschalten(filter, aus.map(Number))),
    ...(liste.some((k) => k.ohneAblaufMoeglich)
      ? {
          hinweis:
            '„auch ohne Ablauf“ zeigt auch Termine, die noch keinen Ablauf haben – nur, wo du Abläufe anlegen darfst.',
        }
      : {}),
  };

  return {
    abschnitt,
    /** Steht dieser Termin in der Liste? */
    sichtbar: (s: Service) => terminSichtbar(s, filter),
    /** Aus welchen Kalendern Termine ohne Ablauf geholt werden. */
    ohneAblauf: kalenderOhneAblauf(filter, darfImKalender),
    /** Ist gerade ein Kalender ausgeblendet? */
    blendetAus: filter.aus.length > 0,
  };
}
