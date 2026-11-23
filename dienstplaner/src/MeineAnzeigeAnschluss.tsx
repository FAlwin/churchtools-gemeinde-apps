import { useCallback, useMemo, type ReactNode } from 'react';
import { useAblageSpiegel, type Abgleich } from '@ui/ct/useAblageSpiegel';
import {
  anzeigeAus,
  AnzeigeKontext,
  type AnzeigeSteuerung,
  type MeineAnzeige,
} from './meineAnzeige';
import { anzeigeSchluessel, inChurchTools } from './anzeigeAblage';

/**
 * **Der Anschluss von „Meine Anzeige“ an die Personen-Datei** (L4-5, T7): Eine Stelle für die ganze Seite – Live-Ansicht,
 * Rückblick, Ablauf bearbeiten und das Fenster „Einstellungen“ lesen denselben Stand (Kontext, `meineAnzeige.ts`). Wie
 * gespeichert und abgeglichen wird – und dass nie mit Standardwerten überschrieben wird –, steht in `useAblageSpiegel`.
 */
export function MeineAnzeigeAnschluss({
  person,
  children,
  abgleich = inChurchTools,
  jetzt,
}: {
  person: number;
  children: ReactNode;
  /** Nur für Tests. */
  abgleich?: Abgleich;
  jetzt?: () => number;
}) {
  const { spiegel, setzen, abgleichFehler } = useAblageSpiegel({
    person,
    merkSchluessel: anzeigeSchluessel,
    abgleich,
    jetzt,
    warnung: 'Dienstplaner: „Meine Anzeige“ bleibt vorerst im Gerät',
  });
  const aendern = useCallback(
    (teil: Partial<MeineAnzeige>) => setzen(teil as Record<string, unknown>),
    [setzen],
  );
  const wert = useMemo<AnzeigeSteuerung>(
    () => ({ anzeige: anzeigeAus(spiegel), setzen: aendern, abgleichFehler }),
    [spiegel, aendern, abgleichFehler],
  );
  return <AnzeigeKontext.Provider value={wert}>{children}</AnzeigeKontext.Provider>;
}
