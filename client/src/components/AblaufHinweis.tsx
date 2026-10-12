/**
 * Der kurze Hinweis auf Änderungen am Ablauf (Alwin, 12.10.2026): unten ein dunkler Hinweis wie bei
 * „Rückgängig" – „Ablauf aktualisiert · 1 neu · 2 geändert", darunter jeder entfernte Punkt
 * durchgestrichen. Er steht `HINWEIS_MS` lang; die Schildchen am Punkt stehen genauso lange und
 * verschwinden mit ihm („nur ein kurzer Hinweis und fertig"). Beides steuert `hooks/useKurzerHinweis`.
 *
 * Vorgeschichte (alles am 12.10.2026): erst eine Leiste über der Liste – sie sah aus wie ein
 * Ablaufpunkt; dann blieben die Schildchen den ganzen Besuch stehen. Davor Aufleuchten und Zerfallen
 * (#161); das Zerfallen fotografierte mit `html2canvas` die ganze Seite ab und ließ die
 * ChurchTools-Erweiterung hängen.
 */
import { Toast } from './Toast';
import type { AblaufAenderungen } from '../utils/ablaufAenderungen';
import styles from '../pages/Setlist.module.scss';

export function AblaufHinweis({ aenderungen }: { aenderungen: AblaufAenderungen }) {
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
