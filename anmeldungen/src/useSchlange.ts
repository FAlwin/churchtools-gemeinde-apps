import { useCallback, useRef, useState } from 'react';
import { fehlerMeldung } from './zustand';

/**
 * **Speichern im Baukasten, eins nach dem anderen** (A5). Im Baukasten wird von selbst gespeichert – nach dem
 * Ziehen, beim Verlassen eines Felds, nach einer Pause beim Tippen. Jedes Speichern liest die Einstellungen frisch
 * und schreibt sie zurück (`aendereEinstellungen`); liefen zwei gleichzeitig, gewänne der letzte und die andere
 * Änderung wäre still weg. Darum eine Schlange: Jede Aufgabe beginnt erst, wenn die vorige fertig ist.
 *
 * Ein Fehler hält die Schlange nicht an – die folgenden Aufgaben laufen weiter, die Meldung bleibt stehen, bis
 * etwas wieder klappt („Nochmal“ wiederholt die gescheiterte Aufgabe).
 */
export type SchlangenStand =
  | { art: 'ruhe' }
  | { art: 'arbeitet' }
  | { art: 'fehler'; text: string; nochmal: () => void };

/**
 * `onFertig(text, umkehrbar)` nach jeder gelungenen Aufgabe – für die Leiste „Rückgängig“ der App. Hängt der Text
 * vom Ergebnis ab (z. B. „ausgeblendet – die Antworten bleiben“), wird statt des Texts eine Funktion übergeben.
 * (Bewusst nicht „liefert die Aufgabe einen Text, gilt der“: Das Hochladen eines Bilds liefert die Bildadresse –
 * die stand dann in der Leiste, gefunden vom Test.)
 */
export function useSchlange(onFertig: (text: string, umkehrbar: boolean) => void) {
  const [stand, setStand] = useState<SchlangenStand>({ art: 'ruhe' });
  const kette = useRef<Promise<void>>(Promise.resolve());
  const offen = useRef(0);
  const fertig = useRef(onFertig);
  fertig.current = onFertig;

  const tun = useCallback(
    (
      text: string | ((ergebnis: unknown) => string),
      aufgabe: () => Promise<unknown>,
      umkehrbar = true,
    ): Promise<boolean> => {
      offen.current++;
      setStand({ art: 'arbeitet' });
      let ok = false;
      const lauf = kette.current.then(async () => {
        try {
          const r = await aufgabe();
          ok = true;
          offen.current--;
          if (offen.current === 0) setStand({ art: 'ruhe' });
          fertig.current(typeof text === 'function' ? text(r) : text, umkehrbar);
        } catch (e) {
          offen.current--;
          setStand({
            art: 'fehler',
            text: fehlerMeldung(e).text,
            nochmal: () => void tun(text, aufgabe, umkehrbar),
          });
        }
      });
      kette.current = lauf;
      return lauf.then(() => ok);
    },
    [],
  );

  /** Läuft gerade etwas oder wartet etwas? (Dann darf der Baukasten seinen Zwischenstand nicht verwerfen.) */
  const laeuft = useCallback(() => offen.current > 0, []);

  return { stand, tun, laeuft };
}
