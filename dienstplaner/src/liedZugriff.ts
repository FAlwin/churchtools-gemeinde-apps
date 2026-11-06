import { QueryClient } from '@tanstack/react-query';
import { ctLiedZugriff } from '@ui/lied/ctLiedZugriff';
import type { LiedRechte, LiedZugriff } from '@ui/lied/liedZugriff';

/**
 * **Die Liedauswahl im Dienstplaner** (Bauplan E9, Wunsch 4 „LW2b“, 06.11.2026): dasselbe Fenster wie in der Musik-App –
 * ein anderes Lied wählen, „Verknüpfung aufheben“, „Neues Lied“ samt SongSelect und Notenblatt-Editor. Die Bausteine
 * liegen seit LW1 in `ui/lied`, die Wege zu ChurchTools seit LW2a in `ui/ct/lieder`.
 */

/**
 * Der Zwischenspeicher der Lied-Abfragen. Dieselben Vorgaben wie in der Musik-App (`client/src/queryClient.ts`:
 * fünf Minuten, ein zweiter Versuch) – nur ohne Ablage auf dem Gerät, die der Dienstplaner nicht hat. Die Abfragen der
 * Liedwahl setzen ihre Haltezeiten ohnehin selbst (`ui/lied/liedDaten.ts`).
 */
export const liedAbfragen = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

/**
 * Der Liedzugriff des Dienstplaners: ChurchTools direkt (`ctLiedZugriff`), dazu was der Dienstplaner selbst beisteuert.
 *
 * - **Rechte** aus dem Start (`startLiederAus` – dieselbe Regel wie die Musik-App).
 * - **Liedansicht** immer seitenweise – eine Geräte-Einstellung „Scrollen“ gibt es hier nicht.
 * - **Logo**: keins. Die Musik-App druckt ihr eigenes Logo (Einstellung der Musik-App); der Dienstplaner kennt es nicht,
 *   die Vorschau im Editor zeigt das Blatt deshalb ohne.
 * - **Nachladen**: nichts Eigenes. Was hier gewählt oder angelegt wird, wird erst mit „Speichern“ des Punkts
 *   geschrieben; danach liest der Ablauf ohnehin frisch (`ablaufNeuLaden`), und mit ihm die Lieder der Karten.
 */
export function dienstplanerLiedZugriff(rechte: LiedRechte | undefined): LiedZugriff {
  return ctLiedZugriff({
    useRechte: () => rechte,
    liedansicht: () => 'blaettern',
    useBlattLogo: () => null,
    nachAenderung: () => undefined,
  });
}
