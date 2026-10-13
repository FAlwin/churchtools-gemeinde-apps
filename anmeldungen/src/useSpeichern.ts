import { useState } from 'react';
import { fehlerMeldung } from './zustand';

/** Gemeinsamer Ablauf: speichern, bei Erfolg schließen, sonst die Meldung zeigen. Auch für die Preis-Fenster. */
export function useSpeichern(onGespeichert: () => void) {
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  async function speichern(tun: () => Promise<unknown>) {
    setArbeitet(true);
    setFehler(null);
    try {
      await tun();
      onGespeichert();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }
  return { arbeitet, fehler, speichern };
}
