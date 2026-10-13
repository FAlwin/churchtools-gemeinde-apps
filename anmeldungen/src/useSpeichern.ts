import { useState } from 'react';
import { fehlerMeldung } from './zustand';

/**
 * Gemeinsamer Ablauf: speichern, bei Erfolg schließen, sonst die Meldung zeigen. Auch für die Preis-Fenster
 * und „Verwalten“. `danach` ersetzt im Einzelfall `onGespeichert` (z. B. mit einer Meldung für „Rückgängig“).
 */
export function useSpeichern(onGespeichert: () => void) {
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  async function speichern(tun: () => Promise<unknown>, danach?: () => void) {
    setArbeitet(true);
    setFehler(null);
    try {
      await tun();
      (danach ?? onGespeichert)();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }
  return { arbeitet, fehler, speichern };
}
