import { useEffect, useRef } from 'react';

/**
 * So oft liest mit, wer ein Entwurf-Protokoll offen hat und nicht selbst schreibt (W16, Alwin 23.11.2026). Wer schreibt,
 * speichert 3 s nach dem letzten Tippen (`PAUSE_MS`) – Mitlesende sehen neuen Text also nach höchstens rund 13 s.
 */
export const MITLESEN_MS = 10_000;

/**
 * **Mitlesen** (W16) – die EINE Stelle für Lese-Ansicht (`SitzungAnsicht`) und Editor bei fremder Sperre
 * (`ProtokollSchreiben`). Echtes Live-Tippen geht nicht: ChurchTools schickt Erweiterungen nichts zu. Darum holt die Seite
 * den Stand selbst – ohne dass jemand etwas anklicken muss:
 * - alle `MITLESEN_MS`, solange `aktiv` ist (der Aufrufer weiß, ob es ein Entwurf ist und ob man selbst schreibt);
 * - **Pause, solange das Fenster verdeckt ist** (`document.hidden`, anderer Tab, Handy gesperrt) – kein Abruf ins Leere;
 *   wird es wieder sichtbar, gleich einmal lesen und weiter im Takt;
 * - **nie zwei Abrufe gleichzeitig:** Dauert einer länger als der Takt, fällt der nächste aus.
 *
 * Ein Fehler beim Lesen ist Sache von `lesen` – Mitlesen ist Beiwerk, beim nächsten Mal wieder.
 */
export function useMitlesen(aktiv: boolean, lesen: () => Promise<unknown>): void {
  // Der neueste Rückruf, ohne dass ein neuer den Takt neu startet (jedes Neuzeichnen brächte sonst einen neuen).
  const rueckruf = useRef(lesen);
  useEffect(() => {
    rueckruf.current = lesen;
  });

  useEffect(() => {
    if (!aktiv) return;
    let uhr: ReturnType<typeof setInterval> | null = null;
    let laeuft = false;
    const einmal = () => {
      if (laeuft) return;
      laeuft = true;
      rueckruf.current().then(
        () => (laeuft = false),
        () => (laeuft = false),
      );
    };
    const starten = () => {
      if (uhr === null) uhr = setInterval(einmal, MITLESEN_MS);
    };
    const halten = () => {
      if (uhr !== null) clearInterval(uhr);
      uhr = null;
    };
    const sichtWechsel = () => {
      if (document.hidden) return halten();
      einmal();
      starten();
    };
    if (!document.hidden) starten();
    document.addEventListener('visibilitychange', sichtWechsel);
    return () => {
      halten();
      document.removeEventListener('visibilitychange', sichtWechsel);
    };
  }, [aktiv]);
}
