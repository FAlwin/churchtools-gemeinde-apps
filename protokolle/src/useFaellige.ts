/**
 * **Was am Reiter „To-Dos“ und im Band der Startseite hinweist** (Hinweis auf fällige To-Dos, Alwin 19.11.2026) – einmal
 * für die ganze Erweiterung, in `App` gehalten.
 *
 * **Woher die Zahlen kommen (Ladeaufwand):**
 * - Der **Vorlauf** (Einstellung der Verwaltung) wird einmal beim Start gelesen: zwei Abrufe (Kategorien, Werte der
 *   Kategorie „Vorlagen“). Er blockiert nie – bei jedem Fehler gilt der Standard.
 * - Die **To-Dos** liefern die Seiten selbst: Startseite und Reiter „To-Dos“ lesen sie ohnehin (`ladeUebersicht`) und
 *   melden sie über `melden` – das kostet **nichts zusätzlich**, und der Zähler stimmt nach jedem Neuladen und jeder Änderung
 *   dort (Abhaken, Ziehen, Speichern im Fenster).
 * - Nur wer **nicht** auf Start oder To-Dos öffnet (Direktlink, Sitzungen, Verwaltung), bekommt einmal beim Start einen
 *   leichten Abruf: je Gruppe die „Mitarbeit“-Werte (`ladeAufgaben`, höchstens zwei Gruppen gleichzeitig). Scheitert er,
 *   gibt es eben keinen Zähler – nichts bricht.
 * Ändert jemand im Reiter „Sitzungen“ ein To-Do, zeigt der Zähler es erst beim nächsten Besuch von Start oder To-Dos.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { heuteImKalender } from '@shared/ct/zeit';
import { mapLimit } from '@shared/ct/mapLimit';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { faellige, faelligZahl, type Faellige, type Vorlauf } from '@shared/protokolle/hinweis';
import { ladeAufgaben } from './lesen';
import { ladeVorlaufOderStandard } from './todoHinweis';

/** Die To-Dos je Gruppe, wie eine Seite sie gelesen hat. */
export interface AufgabenStand {
  gruppe: number;
  aufgaben: Aufgabe[];
}

export interface FaelligeHinweise {
  /** Eingestellter Vorlauf – `null`, solange er nicht gelesen ist. */
  vorlauf: Vorlauf | null;
  /** Meine fälligen To-Dos – `null`, solange die To-Dos oder der Vorlauf fehlen (dann kein Band, kein Zähler). */
  faellige: Faellige | null;
  /** Die Zahl am Reiter; `null`, solange unbekannt. */
  zahl: number | null;
  /** Eine Seite hat To-Dos gelesen – ersetzt den Stand dieser Gruppen. */
  melden: (stand: readonly AufgabenStand[]) => void;
  /** Ein Admin hat den Vorlauf gespeichert. */
  vorlaufSetzen: (v: Vorlauf) => void;
}

export function useFaellige(q: {
  modul: number | null;
  person: number | null;
  gruppen: readonly ProtokollGruppe[];
  /** Zeigt die Seite beim Start schon To-Dos (Start/To-Dos)? Dann braucht es keinen eigenen Abruf. */
  seiteLiefert: boolean;
}): FaelligeHinweise {
  const { modul, person, gruppen, seiteLiefert } = q;
  const [vorlauf, setVorlauf] = useState<Vorlauf | null>(null);
  const [stand, setStand] = useState<ReadonlyMap<number, Aufgabe[]>>(new Map());
  const liefert = useRef(seiteLiefert);
  liefert.current = seiteLiefert;

  const melden = useCallback((neu: readonly AufgabenStand[]) => {
    setStand((alt) => new Map([...alt, ...neu.map((s) => [s.gruppe, s.aufgaben] as const)]));
  }, []);

  useEffect(() => {
    if (modul === null) return;
    let weg = false;
    void ladeVorlaufOderStandard(modul).then((v) => {
      if (!weg) setVorlauf(v);
    });
    if (!liefert.current) {
      const gelesen: AufgabenStand[] = [];
      mapLimit([...gruppen], 2, async (g) => {
        gelesen.push({ gruppe: g.id, aufgaben: await ladeAufgaben(modul, g) });
      }).then(
        () => {
          // Was eine Seite inzwischen gemeldet hat, ist frischer als dieser Start-Abruf.
          if (!weg)
            setStand(
              (alt) => new Map([...gelesen.map((s) => [s.gruppe, s.aufgaben] as const), ...alt]),
            );
        },
        () => console.warn('Protokolle: To-Dos für den Hinweis nicht gelesen.'),
      );
    }
    return () => {
      weg = true;
    };
    // Nur beim Start: `gruppen` ändert sich nicht, und `seiteLiefert` wird über die Referenz gelesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modul]);

  const alle = gruppen.every((g) => stand.has(g.id)) && gruppen.length > 0;
  const heute = heuteImKalender();
  const f: Faellige | null =
    vorlauf !== null && person !== null && alle
      ? faellige(
          gruppen.flatMap((g) => stand.get(g.id) ?? []),
          person,
          heute,
          vorlauf,
        )
      : null;
  return {
    vorlauf,
    faellige: f,
    zahl: f ? faelligZahl(f) : null,
    melden,
    vorlaufSetzen: setVorlauf,
  };
}
