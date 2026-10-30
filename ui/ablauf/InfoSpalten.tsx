/**
 * **Infos je Dienstgruppe als Spalten** (E6-4, Entwurf `e6-infos-spalten.html` Bild 1, abgenommen 30.10.2026): der Knopf
 * „Spalten“ neben „Bearbeiten“ – wie das „+“ im Spaltenkopf des ChurchTools-Ablaufplans. Er listet die Dienstgruppen,
 * deren Infos man sieht; angehakt = eigene Spalte (am Handy: eine Zeile unter dem Punkt, `AblaufListe`). Die Wahl merkt
 * sich das Gerät. Eine Stelle für Termin-Ansicht (Dienstplaner) und Ablauf der Musik-App.
 */
import { useId } from 'react';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { Icon } from '../icons/icons';
import { KopfKnopf } from '../bedienung/KopfKnopf';
import { useAufklapp } from '../bedienung/useAufklapp';
import styles from './InfoSpalten.module.scss';

/** Wie viele Punkte für diese Gruppe schon eine Info haben – „3 Punkte“ im Menü. */
function anzahl(zeilen: readonly Pick<AblaufZeile, 'infos'>[], gruppe: number): string {
  const n = zeilen.filter((z) => z.infos?.some((i) => i.gruppeId === gruppe)).length;
  return n === 0 ? '–' : n === 1 ? '1 Punkt' : `${n} Punkte`;
}

export function InfoSpaltenKnopf({
  gruppen,
  zeilen,
  ids,
  onIds,
}: {
  gruppen: readonly InfoGruppe[] | undefined;
  zeilen: readonly Pick<AblaufZeile, 'infos'>[];
  ids: readonly number[];
  onIds: (ids: number[]) => void;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const id = useId();
  if (!gruppen || gruppen.length === 0) return null;
  return (
    <div className={styles.rahmen} ref={rahmen}>
      <KopfKnopf
        onClick={() => setOffen((o) => !o)}
        label="Spalten"
        title="Infos je Gruppe zeigen"
        menuOffen={offen}
        offen={offen}
        symbol={<Icon name="columns" size={16} stroke={2.2} />}
      />
      {offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label="Infos je Gruppe zeigen">
          <b className={styles.titel}>Infos als Spalten zeigen</b>
          {gruppen.map((g) => (
            <label key={g.id} className={styles.zeile}>
              <input
                type="checkbox"
                checked={ids.includes(g.id)}
                onChange={() =>
                  onIds(ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id])
                }
              />
              <span className={styles.name}>{g.name}</span>
              <span className={styles.zahl}>{anzahl(zeilen, g.id)}</span>
            </label>
          ))}
          <small className={styles.fuss}>
            Nur Gruppen, die du in ChurchTools siehst. Gemerkt auf diesem Gerät.
          </small>
        </div>
      )}
    </div>
  );
}
