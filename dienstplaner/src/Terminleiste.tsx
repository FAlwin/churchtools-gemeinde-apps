import type { ReactNode } from 'react';
import { ZeitraumLeiste } from '@ui/bedienung/ZeitraumLeiste';
import type { FensterSchritt } from '@shared/dienstplan/fenster';

/**
 * **Die Zeitraum-Leiste von „Planen“** (R5/E6, B3): ‹ [Zeitraum] › als EIN gerahmtes Element (`ZeitraumLeiste` aus
 * `@ui/bedienung`) – bei „ab heute“ blättern ‹ › im Fenster, bei gewähltem Bereich springen ‹ › um den ganzen Bereich.
 * „＋ früherer / späterer Termin“ (E9-3, Alwin 05.11.2026) stehen nicht daneben, sondern im Fenster des Zeitraum-Knopfs
 * (`dazu`, s. `Planen.tsx`). Am Handy nur Knopf und ‹ › für einen gewählten Bereich – geblättert wird dort in der Datumsleiste.
 * Hier steht nur, was zu „Planen“ gehört: die Namen der Pfeile und was sie tun.
 */
export function Terminleiste({
  knopf,
  bereich,
  handy,
  davor,
  danach,
  onSchritt,
  onVerschieben,
}: {
  knopf: ReactNode;
  bereich: boolean;
  handy: boolean;
  davor: boolean;
  danach: boolean;
  onSchritt: (was: FensterSchritt) => void;
  onVerschieben: (richtung: 1 | -1) => void;
}) {
  const pfeil = (richtung: 1 | -1, aktiv: boolean) => ({
    aktiv,
    label: bereich
      ? richtung < 0
        ? 'Zeitraum davor'
        : 'Zeitraum danach'
      : richtung < 0
        ? 'Einen Termin zurück'
        : 'Einen Termin weiter',
    onClick: () =>
      bereich ? onVerschieben(richtung) : onSchritt(richtung < 0 ? 'zurueck' : 'weiter'),
  });
  return (
    <ZeitraumLeiste
      knopf={knopf}
      handy={handy}
      blaettern={!handy || bereich}
      davor={pfeil(-1, davor)}
      danach={pfeil(1, danach)}
    />
  );
}
