import type { GruppenRolle } from '@shared/ct/rollenRechte';
import {
  STUFEN,
  stufenText,
  type RolleIst,
  type RollenStufe,
  type Stufe,
} from '@shared/website/rechte';
import styles from './Rechte.module.scss';

/**
 * **Je Rolle der Gruppe eine Stufe wählen** (Bauplan Website W3b-1, E-W21): Kein Zugriff · Redakteur · Leitung. Dieselbe Liste
 * beim Einrichten und unter Einstellungen → „Wer darf was“. `ist` (nur dort) zeigt, wo ChurchTools etwas anderes hat, als die
 * Stufe verspricht („weicht ab“) – gewählt ist dann der Vorschlag, bis „Rechte setzen“ gedrückt wird.
 */
export function RollenStufen({
  rollen,
  wahl,
  ist,
  disabled,
  onWahl,
}: {
  rollen: readonly GruppenRolle[];
  wahl: readonly RollenStufe[];
  ist?: readonly RolleIst[];
  disabled?: boolean;
  onWahl: (rolle: number, stufe: Stufe) => void;
}) {
  if (rollen.length === 0) return <p className={styles.erklaerung}>Die Gruppe hat keine Rollen.</p>;
  return (
    <ul className={styles.liste}>
      {rollen.map((r) => {
        const stufe = wahl.find((x) => x.rolle === r.id)?.stufe ?? 'keine';
        const heute = ist?.find((x) => x.rolle === r.id)?.stufe;
        return (
          <li key={r.id} className={styles.zeile}>
            <span className={styles.name}>{r.name}</span>
            <select
              className={styles.auswahl}
              aria-label={`Stufe von ${r.name}`}
              value={stufe}
              disabled={disabled}
              onChange={(e) => onWahl(r.id, e.target.value as Stufe)}
            >
              {STUFEN.map((s) => (
                <option key={s.wert} value={s.wert}>
                  {s.text}
                </option>
              ))}
            </select>
            {heute === 'abweicht' && (
              <p className={styles.abweicht}>
                Weicht ab: In ChurchTools sind die Rechte dieser Rolle anders gesetzt. „Rechte
                setzen“ macht daraus {stufenText(stufe)}.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
