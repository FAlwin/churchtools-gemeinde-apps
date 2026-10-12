/**
 * Der Hinweis auf Änderungen am Ablauf (Alwin, 12.10.2026, Variante C): unten ein dunkler Hinweis wie
 * bei „Rückgängig" – „Ablauf aktualisiert · 1 neu · 2 geändert", darunter jeder entfernte Punkt
 * durchgestrichen. Er verschwindet nach `HINWEIS_MS` von selbst und kommt nur wieder, wenn noch etwas
 * dazukommt. Die Schildchen am Punkt bleiben.
 *
 * Vorher (am selben Tag) eine Leiste über der Liste – sie sah aus wie ein Ablaufpunkt (Alwin). Davor
 * Aufleuchten und Zerfallen (#161); das Zerfallen fotografierte mit `html2canvas` die ganze Seite ab
 * und ließ die ChurchTools-Erweiterung hängen.
 */
import { useEffect, useRef, useState } from 'react';
import { Toast } from './Toast';
import { hatAenderungen, type AblaufAenderungen } from '../utils/ablaufAenderungen';
import styles from '../pages/Setlist.module.scss';

/** So lange steht der Hinweis. */
export const HINWEIS_MS = 6000;

export function AblaufHinweis({ aenderungen }: { aenderungen: AblaufAenderungen }) {
  const stand = JSON.stringify(aenderungen);
  const [sichtbar, setSichtbar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Jeder NEUE Stand mit Änderungen zeigt den Hinweis (wieder) an. Derselbe Stand kommt nicht noch
  // einmal: Der Effekt hängt am Stand, nicht an jedem Neuzeichnen.
  useEffect(() => {
    // Nichts (mehr) zu melden – etwa weil der einzige entfernte Punkt zurückgeholt wurde: weg damit,
    // sonst stünde ein leeres „Ablauf aktualisiert" da.
    if (!hatAenderungen(JSON.parse(stand) as AblaufAenderungen)) {
      if (timer.current) clearTimeout(timer.current);
      setSichtbar(false);
      return;
    }
    setSichtbar(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSichtbar(false), HINWEIS_MS);
  }, [stand]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!sichtbar) return null;
  const teile = [
    aenderungen.neu > 0 ? `${aenderungen.neu} neu` : '',
    aenderungen.geaendert > 0 ? `${aenderungen.geaendert} geändert` : '',
  ].filter(Boolean);
  return (
    <Toast
      message={
        <span className={styles.aenderungsHinweis}>
          <span>
            <strong>Ablauf aktualisiert</strong>
            {teile.map((t) => ` · ${t}`).join('')}
          </span>
          {aenderungen.entfernt.map((titel, i) => (
            <span key={i} className={styles.aenderungsEntfernt}>
              Entfernt: <s>{titel}</s>
            </span>
          ))}
        </span>
      }
    />
  );
}
