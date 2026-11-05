import { useEffect, useState } from 'react';
import type { NeueAbsence } from '@shared/types/index';
import { SeitenGeruest } from '../components/SeitenGeruest';
import { CenterMessage } from '../components/CenterMessage';
import { Coachmarks } from '../components/Coachmarks';
import {
  AbwesenheitenSeite,
  type AbwesenheitenDaten,
  type AbwesenheitenSchreiben,
} from '@ui/abwesenheiten/AbwesenheitenSeite';
import {
  useAbsenceEvents,
  useAbsenceReasons,
  useAbsencesRefresh,
  useMyAbsences,
} from '../hooks/useAvailability';
import * as api from '../services/availability';
import {
  getAbwesenheitenAusgeblendet,
  getAbwesenheitenFilter,
  setAbwesenheitenAusgeblendet,
} from '../utils/devicePrefs';
import { useSiteConfig } from '../hooks/useSiteConfig';
import {
  TOUR_VERFUEGBARKEIT,
  VERFUEGBARKEIT_STEPS,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { heuteImKalender } from '@shared/ct/zeit';

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
  /** Nur für Tests: das „Heute" der Ansicht. */
  heute?: string;
}

/** Die Daten über den Zwischenspeicher der Musik-App (`useAvailability`) – offline lesbar. */
function useMusikDaten({ von, bis }: { von: string; bis: string }): AbwesenheitenDaten {
  const absences = useMyAbsences(true, von, bis);
  const events = useAbsenceEvents(true, bis);
  const gruende = useAbsenceReasons(true);
  return {
    eintraege: absences.data,
    termine: events.data,
    gruende: gruende.data,
    laedt: absences.isLoading || events.isLoading,
    fehler: absences.isError || events.isError,
    // Einträge UND Termine – warum ein Versprechen zurückkommen muss, steht an `onNeuLaden` in `SeitenGeruest.tsx`.
    neuLaden: () => Promise.all([absences.refetch(), events.refetch()]),
  };
}

const filter = {
  lesen: getAbwesenheitenAusgeblendet,
  schreiben: setAbwesenheitenAusgeblendet,
  alteWahl: getAbwesenheitenFilter,
};

/**
 * **Abwesenheiten in der Musik-App** (#177) – der Rahmen um die gemeinsame Seite (`@ui/abwesenheiten`, seit
 * Dienstplaner E7-2b): Seitengerüst, Zwischenspeicher, Termin-Arten der Gemeinde und die Einführung. Geschrieben wird
 * über `services/availability` – auf dem NAS über den eigenen Server, in ChurchTools direkt (`@shared/absences`).
 */
export function Availability({ online, onToast, heute = heuteImKalender() }: AvailabilityProps) {
  const refresh = useAbsencesRefresh();
  // Die Termin-Arten des Admins (#400) – die Konfiguration ist ohnehin geladen (Branding).
  const site = useSiteConfig();
  const [tour, setTour] = useState(false);
  const schreiben: AbwesenheitenSchreiben = {
    anlegen: (neu: NeueAbsence) => api.createAbsence(neu),
    aendern: (id: number, neu: NeueAbsence) => api.updateAbsence(id, neu),
    loeschen: (id: number) => api.deleteAbsence(id),
    geaendert: () => void refresh(),
  };

  return (
    <AbwesenheitenSeite
      online={online}
      onToast={onToast}
      heute={heute}
      useDaten={useMusikDaten}
      schreiben={schreiben}
      arten={site.data.terminArten ?? KEINE_ARTEN}
      filter={filter}
      rahmen={(t) => (
        <SeitenGeruest
          titel="Abwesenheiten"
          stattTitel={t.kopf}
          onNeuLaden={t.neuLaden}
          ueberlagerung={
            <>
              {t.ueberlagerung}
              <Einfuehrung bereit={!t.laedt} tour={tour} setTour={setTour} />
            </>
          }
          aktionen={t.aktionen}
        >
          {t.laedt ? (
            <CenterMessage loading text="Wird geladen…" />
          ) : t.fehler ? (
            <CenterMessage
              icon="warnung"
              text="Konnte nicht geladen werden."
              onRetry={t.neuLaden}
            />
          ) : (
            t.inhalt
          )}
        </SeitenGeruest>
      )}
    />
  );
}

/** Eigene Konstante: `?? []` erzeugte in jedem Rendern ein NEUES Array, und der Filter rechnete jedes Mal neu (#406). */
const KEINE_ARTEN: never[] = [];

/** Die Einführung beim ersten Öffnen – sobald Einträge und Termine geladen sind. */
function Einfuehrung({
  bereit,
  tour,
  setTour,
}: {
  bereit: boolean;
  tour: boolean;
  setTour: (an: boolean) => void;
}) {
  useEffect(() => {
    if (bereit && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [bereit, setTour]);
  if (!tour) return null;
  return (
    <Coachmarks
      steps={VERFUEGBARKEIT_STEPS}
      onClose={() => {
        markTourDone(TOUR_VERFUEGBARKEIT);
        setTour(false);
      }}
    />
  );
}
