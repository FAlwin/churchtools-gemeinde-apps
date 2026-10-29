import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { KopfKnopf } from './KopfKnopf';
import { SchwebePlus } from './SchwebePlus';
import { HANDY_BREITE, useMedienAbfrage } from './useMedienAbfrage';

/**
 * **„Etwas Neues anlegen“ – einmal für alle Seiten**: am iPad/Rechner grün im Seitenkopf wie „+ Gruppe erstellen“ in
 * ChurchTools (S2), am Handy das runde Plus unten rechts.
 *
 * Bis zum 29.10.2026 baute jede Seite das selbst zusammen (Abwesenheiten: `KopfKnopf` und `SchwebePlus` mit getrennten
 * Bedingungen). Als „Neues Lied“ dasselbe bekam (Alwin: „so wie sonst auch bei allem“), wäre es die zweite Kopie
 * geworden. Der Ablauf hat ein Auswahlmenü statt einer Aktion (`HinzufuegenMenue`) und bleibt deshalb eigen.
 */
export function useNeuAnlegen({
  label,
  onClick,
  sichtbar = true,
  disabled,
  dataTour,
}: {
  /** Was der Knopf tut („Zeitraum eintragen“, „Neues Lied“) – Beschriftung am iPad, Name des Plus am Handy. */
  label: string;
  onClick: () => void;
  /** Ob es gerade etwas anzulegen gibt (Recht, geladen, nichts vorgemerkt …). */
  sichtbar?: boolean;
  disabled?: boolean;
  dataTour?: string;
}): { kopf: ReactNode; schwebend: ReactNode } {
  const handy = useMedienAbfrage(HANDY_BREITE);
  if (!sichtbar) return { kopf: null, schwebend: null };
  if (handy) {
    return {
      kopf: null,
      schwebend: (
        <SchwebePlus label={label} onClick={onClick} disabled={disabled} dataTour={dataTour} />
      ),
    };
  }
  return {
    kopf: (
      <KopfKnopf
        onClick={onClick}
        label={label}
        neu
        disabled={disabled}
        dataTour={dataTour}
        symbol={<Icon name="plus" size={16} stroke={2.4} />}
      />
    ),
    schwebend: null,
  };
}
