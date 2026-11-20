import { useState, type ReactNode } from 'react';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { HANDY_BREITE, useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import { PunktAnsichtFenster, PunktSeite } from './PunktAnsicht';

/**
 * **Der Hook für die Aufrufer** (Musik-App, Dienstplaner): gibt `oeffnen` an `AblaufListe onPunkt` und die `ueberlagerung`
 * (Fenster oder Seite, je nach Breite) in den Bildschirm. Geblättert wird durch die Punkte **ohne Überschriften** – wie in
 * der App zählt „Position 3/10“ nur echte Punkte, die grauen Bänder nicht.
 *
 * `onLied` ist dasselbe wie an der Liste (`AblaufListe onLied`): Nummer des Lieds im Ablauf und der Punkt. Aus der Ansicht
 * heraus schließt sie sich erst, dann öffnet das Lied – eine Überlagerung ersetzt die andere, sie stapeln sich nicht.
 */
export function usePunktAnsicht({
  zeilen,
  infoGruppen,
  fotos,
  onLied,
  zurueckLabel = 'Ablauf',
}: {
  zeilen: readonly AblaufZeile[];
  infoGruppen?: readonly InfoGruppe[];
  fotos?: boolean;
  onLied?: (liedIndex: number, punkt: AblaufZeile) => void;
  zurueckLabel?: string;
}): { oeffnen: (p: AblaufZeile) => void; ueberlagerung: ReactNode } {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const [offenId, setOffenId] = useState<number | null>(null);
  const [geblaettert, setGeblaettert] = useState(false);
  const sichtbar = zeilen.filter((z) => !z.removed);
  const punkte = sichtbar.filter((z) => !z.isHeader);
  const i = offenId === null ? -1 : punkte.findIndex((z) => z.id === offenId);
  // Wurde der Punkt inzwischen gelöscht (anderer Stand), ist auch die Ansicht weg – kein Geisterfenster.
  const punkt = i >= 0 ? punkte[i] : null;

  const zu = () => setOffenId(null);
  const geheZu = (j: number) => () => {
    setGeblaettert(true);
    setOffenId(punkte[j].id);
  };
  let ueberlagerung: ReactNode = null;
  if (punkt) {
    const position = {
      nr: i + 1,
      von: punkte.length,
      onVorher: i > 0 ? geheZu(i - 1) : undefined,
      onNachher: i < punkte.length - 1 ? geheZu(i + 1) : undefined,
    };
    const liedIndex = sichtbar.filter((z) => z.song).findIndex((z) => z.id === punkt.id);
    const inhalt = {
      punkt,
      infoGruppen,
      fotos,
      onLied:
        punkt.song && onLied
          ? () => {
              zu();
              onLied(liedIndex, punkt);
            }
          : undefined,
    };
    ueberlagerung = handy ? (
      <PunktSeite
        {...inhalt}
        position={position}
        onClose={zu}
        zurueckLabel={zurueckLabel}
        davor={i > 0 ? punkte[i - 1] : undefined}
        danach={i < punkte.length - 1 ? punkte[i + 1] : undefined}
      />
    ) : (
      <PunktAnsichtFenster {...inhalt} position={position} onClose={zu} einblenden={!geblaettert} />
    );
  }
  return {
    oeffnen: (p) => {
      setGeblaettert(false);
      setOffenId(p.id);
    },
    ueberlagerung,
  };
}
