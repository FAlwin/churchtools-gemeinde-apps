import type { UserCapabilities } from '@shared/types/index';
import { darfVorlageBearbeiten, vorlagenRechteAus } from '@shared/ct/ablaufRecht';
import { VorlagenBereich } from '@ui/ablauf/VorlagenBereich';
import { Coachmarks } from '../components/Coachmarks';
import { Screen, Scroll } from '../components/Screen';
import { useAgendaServices } from '../hooks/useServices';
import { useTourSobaldDa } from '../hooks/useTourSobaldDa';
import { useVorlagenZugriff } from '../hooks/useVorlagenZugriff';
import { TOUR_VORLAGE, TOUR_VORLAGEN, VORLAGE_STEPS, VORLAGEN_STEPS } from '../utils/onboarding';
import styles from './Vorlagen.module.scss';

/**
 * Die Seite „Ablaufvorlagen“ hinter der Zeile in „Mehr“ (E10-V3b, Entwurf `e10-vorlagen.html` Abschnitt 5). Der Baustein
 * ist derselbe wie im Dienstplaner (`@ui/ablauf/VorlagenBereich`); hier kommen nur die Dinge der Musik-App dazu: der
 * Zugriff über die Weiche (`useVorlagenZugriff`), die Rechte aus den Capabilities und die Infos je Dienstgruppe wie am
 * Termin (`Setlist`). Welche Vorlage offen ist, hält `App` – wie beim Termin, ohne Adresse.
 */
export function Vorlagen({
  caps,
  offeneId,
  onOeffnen,
  zurueck,
}: {
  caps: UserCapabilities;
  /** Die offene Vorlage – `null`: die Liste. */
  offeneId: number | null;
  onOeffnen: (vorlageId: number | null) => void;
  /** „‹ Mehr“ – von der Liste aus zurück. */
  zurueck: () => void;
}) {
  const zugriff = useVorlagenZugriff();
  const rechte = vorlagenRechteAus(caps);
  const dienste = useAgendaServices(true);
  // Zwei Einführungen: die Liste (beim ersten Öffnen der Seite) und eine geöffnete Vorlage (beim ersten Öffnen einer).
  const inVorlage = offeneId !== null;
  const tour = useTourSobaldDa(
    inVorlage ? TOUR_VORLAGE : TOUR_VORLAGEN,
    inVorlage ? '[data-tour="vorlage-bearbeiten"]' : '[data-tour^="vorlagen-"]',
    inVorlage,
  );
  return (
    <Screen>
      <Scroll>
        <div className={styles.rahmen}>
          <VorlagenBereich
            zugriff={zugriff}
            darfIn={(kalenderId) => darfVorlageBearbeiten(rechte, kalenderId)}
            dienste={dienste.data ?? []}
            // Wie am Termin (`Setlist`): Unbekannt (`undefined`) heißt: kein Hinweis.
            infoGruppen={caps.infoGruppen}
            gruppenVerborgen={caps.siehtAlleDienstgruppen === false}
            // Die Spalten-Wahl gehört der Vorlagen-Seite allein – getrennt von der des Ablaufs der Termine.
            infoSpaltenSchluessel="musikapp.vorlage.infoSpalten"
            offeneId={offeneId}
            onOeffnen={onOeffnen}
            zurueck={{ label: 'Mehr', onClick: zurueck }}
          />
        </div>
      </Scroll>
      {tour.aktiv && (
        <Coachmarks steps={inVorlage ? VORLAGE_STEPS : VORLAGEN_STEPS} onClose={tour.schliessen} />
      )}
    </Screen>
  );
}
