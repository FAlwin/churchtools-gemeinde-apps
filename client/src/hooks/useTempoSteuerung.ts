import { useEffect, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import type { SongSettings } from '../utils/chartSettings';
import { taktRaster } from '../utils/metronome';
import { useMetronome, type KlickModus } from './useMetronome';

/**
 * Tempo, Puls und Klick des Liedblatts (#145) – aus `ChordChart.tsx` herausgelöst (#465), unverändert.
 *
 * Puls und Klick sind bewusst NICHT gemerkt: Beim Öffnen des Liederhefts ist beides aus, damit im
 * Gottesdienst nichts unerwartet blinkt oder losklickt.
 */
export function useTempoSteuerung(song: SetlistSong, set: SongSettings) {
  const [bpmPulse, setBpmPulse] = useState(false);
  const [klickModus, setKlickModus] = useState<KlickModus>('aus');
  /**
   * Im Tempo-Menü eingestelltes Tempo. `null` heißt „wie im Lied".
   *
   * Der Wert liegt HIER und nicht im Menü, weil Puls und Klick ihm folgen müssen: Wer ein Tempo
   * antippt, soll es erst hören und dann speichern. Läge er im Menü, klänge der Klick weiter im
   * alten Tempo, während das Menü ein neues anzeigt.
   */
  const [tempoWert, setTempoWert] = useState<number | null>(null);

  /**
   * Wirksames Tempo: das eingestellte, sonst das aus ChurchTools. Steht EINMAL hier und wird von
   * Kopfzeile, Puls, Klick und Menü gemeinsam benutzt – jede Stelle, die stattdessen selbst
   * `tempoWert ?? song.bpm` rechnete, wäre eine Kopie dieser Regel.
   */
  const wirksamesTempo = tempoWert ?? song.bpm;

  /**
   * Zählweise und was daraus folgt (#145).
   *
   * Die gespeicherte Tempo-Zahl meint IMMER die Grundschläge – gezählt wird aber unter Umständen
   * gröber (6/8 in Dreiergruppen, schnelles 4/4 in Halben). Beide Rechnungen stehen EINMAL hier;
   * Puls und Klick bekommen fertig das gezählte Tempo und die gezählte Taktlänge, statt jeder für
   * sich aus Taktart und Zählweise dasselbe abzuleiten.
   */
  const { klickTempo, schlaegeProTakt } = taktRaster(wirksamesTempo, song.timeSig, set.zaehlweise);

  // Beim Liedwechsel zurück auf „wie im Lied". Ein eingestelltes Tempo gehört zu DIESEM Lied; es
  // beim Blättern mitzunehmen hieße, das nächste Lied stillschweigend im falschen Takt zu klicken.
  const liedZuvor = useRef(song.id);
  useEffect(() => {
    if (liedZuvor.current === song.id) return;
    liedZuvor.current = song.id;
    setTempoWert(null);
  }, [song.id]);

  /**
   * Nullpunkt des gemeinsamen Takt-Rasters, in `performance.now()`-Millisekunden.
   *
   * Puls und Klick hatten je eine eigene Uhr – wer sie nacheinander einschaltete, bekam zwei
   * Nullpunkte und damit zwei Takte. Jetzt gibt es EINEN, gesetzt beim Einschalten des ersten von
   * beiden und gelöscht, wenn keiner mehr läuft. Der Zweite steigt in das laufende Raster ein,
   * statt bei sich selbst anzufangen.
   *
   * Beim TEMPOWECHSEL wird das Raster neu gesetzt: Aus einem festen Nullpunkt und einer neuen
   * Schlagdauer folgte sonst ein Sprung mitten im Takt. Ein Metronom fängt bei neuem Tempo neu an.
   */
  const [taktStart, setTaktStart] = useState<number | null>(null);
  const taktLaeuft = bpmPulse || klickModus !== 'aus';
  const taktTempo = useRef(wirksamesTempo);
  useEffect(() => {
    if (!taktLaeuft) {
      setTaktStart(null);
      return;
    }
    setTaktStart((bisher) =>
      bisher === null || taktTempo.current !== wirksamesTempo ? performance.now() : bisher,
    );
    taktTempo.current = wirksamesTempo;
  }, [taktLaeuft, wirksamesTempo]);

  // Hörbarer Klick auf der Audio-Uhr. Endet er von selbst (Einzählen fertig), zieht der Modus nach –
  // sonst stünde das Menü weiter auf „Einzählen", obwohl längst nichts mehr klingt.
  useMetronome({
    bpm: klickTempo,
    schlaegeProTakt,
    modus: klickModus,
    taktStartMs: taktStart,
    onEnde: () => setKlickModus('aus'),
  });

  return {
    bpmPulse,
    setBpmPulse,
    klickModus,
    setKlickModus,
    tempoWert,
    setTempoWert,
    wirksamesTempo,
    klickTempo,
    schlaegeProTakt,
    taktStart,
    /** Läuft gerade Puls oder Klick? (Kopfzeile hebt das Tempo-Werkzeug dann hervor.) */
    tempoAktiv: taktLaeuft,
  };
}
