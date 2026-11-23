import { useCallback, useEffect, useRef, useState } from 'react';
import type { LivePunkt, LiveStand } from '@shared/ct/liveAgenda';
import { enthaelt, nachzutragen, zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import { ladeVerlauf, schreibeVerlauf } from './ladeVerlauf';

/** Wie oft der Verlauf nachgelesen (und Ausstehendes erneut geschrieben) wird, solange die Live-Ansicht offen ist. */
export const VERLAUF_TAKT_MS = 15_000;
/** Nach einem neuen Stand von ChurchTools früher nachlesen: Ein anderes Gerät soll die Fehlklick-Regel bald sehen. */
export const VERLAUF_NACH_WECHSEL_MS = 1_500;
/** So lange gönnt ein offenes Gerät dem klickenden Gerät, seinen Wechsel selbst festzuhalten, bevor es ihn nachträgt. */
export const NACHTRAGEN_NACH_MS = 6_000;

const schl = (w: Wechsel) => `${w.zeit}:${w.stelle}`;

/** Wie oft ein Aufruf von `schreibenVersuchen` höchstens schreibt (Wechsel, die währenddessen dazukamen, gehen mit). */
const MAX_RUNDEN = 3;

export interface VerlaufZustand {
  /** Der bekannte Verlauf: gelesen, vereint mit dem, was dieses Gerät noch zu schreiben hat. Leer = keiner (auch ohne Recht). */
  verlauf: Wechsel[];
  /** Wechsel festhalten: sofort in `verlauf`, im Hintergrund im Speicher (nur mit Schreibrecht – sonst bleibt es lokal). */
  notieren: (neue: Wechsel[]) => void;
  /** Frisch lesen und den Verlauf liefern – scheitert das Lesen, der bekannte (vorübergehend ist nicht ungültig). */
  frisch: () => Promise<Wechsel[]>;
}

/**
 * **Den Live-Verlauf eines Termins führen** (L4-3, T4): lesen beim Öffnen und danach alle 15 s – früher, sobald ChurchTools
 * einen neuen Stand meldet –, nur solange die Seite sichtbar ist. Wer die Live-Agenda steuern darf (`schreibenErlaubt`),
 * schreibt: das klickende Gerät über `notieren`, ein offenes Gerät **trägt nach**, was ChurchTools zeigt und im Verlauf fehlt
 * (CT-App/CT-Web geschaltet, oder das klickende Gerät ist gescheitert) – erst nach `NACHTRAGEN_NACH_MS` und nur, wenn der
 * Wechsel dann immer noch fehlt; gleicher `switchdate` = derselbe Wechsel, kein Doppel (`zusammenfuehren`).
 *
 * Ein vorübergehender Fehler (Netz, 5xx) löscht und überschreibt nichts: Ausstehendes bleibt stehen und wird im nächsten
 * Takt wieder versucht, der bekannte Verlauf bleibt. Fehlt das Recht (403) oder passt der Verlauf nicht mehr in einen Wert,
 * hört das Schreiben für diese Sitzung auf – die Anzeige läuft mit dem lokalen Verlauf weiter. Ohne Leserecht kommt eine
 * leere Liste: ± und „Warum“ fehlen dann leise.
 */
export function useVerlauf({
  terminId,
  liste,
  stand,
  schreibenErlaubt,
  lesen = ladeVerlauf,
  schreiben = schreibeVerlauf,
}: {
  terminId: number;
  liste: readonly LivePunkt[];
  /** Der Stand von ChurchTools (roh, nicht der wirksame). */
  stand: LiveStand | null;
  schreibenErlaubt: boolean;
  lesen?: typeof ladeVerlauf;
  schreiben?: typeof schreibeVerlauf;
}): VerlaufZustand {
  const [verlauf, setVerlauf] = useState<Wechsel[]>([]);
  const [gelesen, setGelesen] = useState(false);
  const verlaufRef = useRef<Wechsel[]>([]);
  const ausstehend = useRef<Wechsel[]>([]);
  const gesperrt = useRef(false);
  const schreibtGerade = useRef(false);
  const aus = useRef(false);
  const schreibenVersuchenRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const standRef = useRef(stand);
  const listeRef = useRef(liste);
  standRef.current = stand;
  listeRef.current = liste;
  // Die Zusatzzeit des Punkts, der dran war, bevor der jetzige Stand kam – für `zusatzDavor` beim Nachtragen.
  const beobachtet = useRef<LiveStand | null>(null);
  const davorZusatz = useRef<number | undefined>(undefined);

  const setzen = useCallback((neu: Wechsel[]) => {
    // Nur ändern, wenn sich etwas geändert hat – sonst liefe jeder Takt durch alle Abhängigen.
    if (JSON.stringify(neu) === JSON.stringify(verlaufRef.current)) return;
    verlaufRef.current = neu;
    setVerlauf(neu);
  }, []);

  /**
   * Gelesenes übernehmen: vereint mit dem, was wir schon wissen. Was wir wissen und im Gelesenen **fehlt**, bleibt (oder wird
   * wieder) „ausstehend“ – auch Bestätigtes: Hat ein anderes Gerät zwischen unserem Lesen und Schreiben einen Wert
   * überschrieben (ChurchTools prüft keine Version), holt das Gerät, dessen Wechsel fehlt, ihn beim nächsten Lesen nach.
   * Weil zusammengeführt wird, verlieren sich Geräte so nichts – sie ergänzen einander, bis alle denselben Stand haben.
   */
  const uebernehmen = useCallback(
    (gelesenWechsel: Wechsel[]) => {
      const alle = zusammenfuehren(verlaufRef.current, gelesenWechsel);
      ausstehend.current = alle.filter((w) => !enthaelt(gelesenWechsel, [w]));
      setzen(alle);
    },
    [setzen],
  );

  const lesenJetzt = useCallback(async (): Promise<void> => {
    const r = await lesen(terminId);
    if (aus.current || !r.ok) return;
    setGelesen(true);
    uebernehmen(r.wechsel);
    if (ausstehend.current.length > 0) void schreibenVersuchenRef.current();
  }, [lesen, terminId, uebernehmen]);

  const schreibenVersuchen = useCallback(async (): Promise<void> => {
    if (!schreibenErlaubt || gesperrt.current || schreibtGerade.current) return;
    // Höchstens ein paar Runden je Aufruf: Was dann noch fehlt, holt der nächste Takt – nie eine Endlosschleife.
    for (let runde = 0; runde < MAX_RUNDEN && ausstehend.current.length > 0; runde++) {
      schreibtGerade.current = true;
      const paket = [...ausstehend.current];
      const r = await schreiben(terminId, paket);
      schreibtGerade.current = false;
      if (aus.current) return;
      if (!r.ok) {
        // Ohne Recht oder zu groß ändert Wiederholen nichts; alles andere wird im nächsten Takt wieder versucht.
        if (r.grund === 'kein-recht' || r.grund === 'zu-gross') gesperrt.current = true;
        return;
      }
      // Ein `ok` heißt: alles aus `paket` steht nachgelesen im Verlauf – `uebernehmen` zieht es aus „ausstehend“ ab. Kam
      // beim Schreiben etwas dazu, geht die Schleife noch einmal.
      uebernehmen(r.wechsel);
      // Sicherung gegen eine Endlosschleife: Blieb vom Paket etwas stehen, wird erst im nächsten Takt weiter versucht.
      if (
        ausstehend.current.some(
          (w) => !enthaelt(r.wechsel, [w]) && paket.some((p) => schl(p) === schl(w)),
        )
      ) {
        return;
      }
    }
  }, [schreibenErlaubt, schreiben, terminId, uebernehmen]);

  schreibenVersuchenRef.current = schreibenVersuchen;

  const notieren = useCallback(
    (neue: Wechsel[]) => {
      if (neue.length === 0) return;
      ausstehend.current = zusammenfuehren(ausstehend.current, neue);
      setzen(zusammenfuehren(verlaufRef.current, neue));
      void schreibenVersuchen();
    },
    [schreibenVersuchen, setzen],
  );

  const frisch = useCallback(async (): Promise<Wechsel[]> => {
    await lesenJetzt();
    return verlaufRef.current;
  }, [lesenJetzt]);

  // Lesen beim Öffnen, dann im Takt – sichtbar, Ausstehendes zuerst schreiben.
  useEffect(() => {
    aus.current = false;
    let timer: number | undefined;
    const takt = async () => {
      if (document.visibilityState !== 'hidden') {
        await schreibenVersuchen();
        await lesenJetzt();
      }
      if (!aus.current) timer = window.setTimeout(() => void takt(), VERLAUF_TAKT_MS);
    };
    const sichtbar = () => {
      if (document.visibilityState !== 'hidden') void lesenJetzt();
    };
    document.addEventListener('visibilitychange', sichtbar);
    void lesenJetzt();
    timer = window.setTimeout(() => void takt(), VERLAUF_TAKT_MS);
    return () => {
      aus.current = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [lesenJetzt, schreibenVersuchen]);

  // Meldet ChurchTools einen neuen Wechsel, bald nachlesen (die Fehlklick-Regel kommt von dem Gerät, das geklickt hat).
  const stelle = stand?.stelle ?? null;
  const seit = stand?.seit ?? null;
  useEffect(() => {
    if (stelle === null) return;
    const id = window.setTimeout(() => void lesenJetzt(), VERLAUF_NACH_WECHSEL_MS);
    return () => window.clearTimeout(id);
  }, [stelle, seit, lesenJetzt]);

  // Die Zusatzzeit des vorigen Punkts merken, solange er im Stand zu sehen ist.
  useEffect(() => {
    const alt = beobachtet.current;
    if (alt && (alt.stelle !== stelle || alt.seit !== seit)) davorZusatz.current = alt.zusatzSek;
    beobachtet.current = standRef.current;
  }, [stelle, seit, stand]);

  // Nachtragen: ein Wechsel von ChurchTools, der nach der Schonfrist immer noch fehlt.
  useEffect(() => {
    if (!schreibenErlaubt || !gelesen || stelle === null || seit === null) return;
    const id = window.setTimeout(() => {
      const w = nachzutragen(
        verlaufRef.current,
        listeRef.current,
        standRef.current,
        davorZusatz.current,
      );
      if (w) notieren([w]);
    }, NACHTRAGEN_NACH_MS);
    return () => window.clearTimeout(id);
  }, [schreibenErlaubt, gelesen, stelle, seit, notieren]);

  return { verlauf, notieren, frisch };
}
