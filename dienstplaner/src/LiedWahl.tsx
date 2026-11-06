import { lazy, Suspense } from 'react';
import type { LiedWahlArgs } from '@ui/ablauf/PunktFenster';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { CenterMessage } from '@ui/bedienung/CenterMessage';

/** Die Liedauswahl im Punkt-Fenster des Dienstplaners (LW2b) – Daten über `liedZugriff.ts`. */

/**
 * Das Fenster erst laden, wenn jemand es öffnet: Mit „Neues Lied“ hängen Editor und PDF-Vorschau daran – das soll den
 * Start des Dienstplaners nicht schwerer machen.
 */
const LiedVerknuepfen = lazy(() =>
  import('@ui/lied/LiedVerknuepfen').then((m) => ({ default: m.LiedVerknuepfen })),
);

/** Für den Steckplatz `liedWahl` des Punkt-Fensters. Solange das Fenster lädt, steht es schon da – mit einem Hinweis. */
export function LiedWahl(args: LiedWahlArgs) {
  return (
    <Suspense
      fallback={
        <Sheet
          title="Lied verknüpfen"
          onClose={args.onSchliessen}
          zurueck={args.zurueck}
          // Derselbe Knopf wie im fertigen Fenster (`LiedVerknuepfen`) – zurück ins Punkt-Fenster.
          knoepfe={
            <FensterKnopf art="zweit" onClick={args.onAbbrechen}>
              Abbrechen
            </FensterKnopf>
          }
        >
          <CenterMessage loading text="Liedauswahl wird geladen …" />
        </Sheet>
      }
    >
      <LiedVerknuepfen {...args} />
    </Suspense>
  );
}
