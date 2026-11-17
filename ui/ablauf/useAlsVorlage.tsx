/**
 * **„Als Vorlage …“ im Ablauf eines Termins** (E10-V5) – eine Stelle für Dienstplaner und Musik-App: der Link für die
 * Hinweiszeile (`useAblaufBearbeiten`, `hinweisLinks`), das Fenster (`AlsVorlageFenster`) und die Bestätigung danach.
 *
 * Den Link gibt es **nur, wenn man im Kalender des Termins Ablaufvorlagen bearbeiten darf** (`darfIn`, Regel
 * `darfVorlageBearbeiten`) – sonst `null`. Die Apps geben nur herein, **wie** gelesen und geschrieben wird
 * (`AlsVorlageZugriff`) und was der Termin ist; Rechte und Regeln stehen im Kern.
 */
import { useState, type ReactNode } from 'react';
import { Toast } from '../fenster/Toast';
import { useToast } from '../fenster/useToast';
import { AlsVorlageFenster } from './AlsVorlageFenster';
import { alsVorlageMeldung } from './vorlagenMeta';
import type { HinweisLink } from './useAblaufBearbeiten';
import type { AlsVorlageZugriff } from './vorlagenZugriff';

export function useAlsVorlage(o: {
  /** Aus: kein Link, kein Fenster (Matrix-Kurzansicht, kein Ablauf …). */
  an: boolean;
  /** Darf man in diesem Kalender Vorlagen bearbeiten? */
  darfIn: (kalenderId: number | null) => boolean;
  terminKalenderId: number | null;
  terminTitel: string;
  /** „Gottesdienst · So, 23.11.2026“ */
  terminText: string;
  /** Wie viele Punkte der Ablauf hat. */
  punkte: number;
  /** Muss stabil sein (`useMemo`) – sonst lädt das Fenster ständig neu. */
  zugriff: AlsVorlageZugriff;
}): { link: HinweisLink | null; ueberlagerung: ReactNode } {
  const [offen, setOffen] = useState(false);
  const { toast, showToast } = useToast();
  const darf = o.an && o.darfIn(o.terminKalenderId);

  return {
    link: darf
      ? {
          label: 'Als Vorlage …',
          icon: 'grid',
          onClick: () => setOffen(true),
          davor: true,
          dataTour: 'als-vorlage',
        }
      : null,
    ueberlagerung: (
      <>
        {darf && offen && (
          <AlsVorlageFenster
            terminTitel={o.terminTitel}
            terminText={o.terminText}
            punkte={o.punkte}
            terminKalenderId={o.terminKalenderId}
            darfIn={o.darfIn}
            zugriff={o.zugriff}
            onFertig={(art, name) => {
              setOffen(false);
              showToast(alsVorlageMeldung(art, name));
            }}
            onClose={() => setOffen(false)}
          />
        )}
        <Toast message={toast} />
      </>
    ),
  };
}
