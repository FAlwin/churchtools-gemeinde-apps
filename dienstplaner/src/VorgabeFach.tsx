import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import { modusWort, type Modus } from '@shared/dienstplan/modusVorgabe';
// Dieselben Fach-Bausteine (Unterzeile, Hinweis) wie „Wer kann?“ und das Entwurfs-Fach – ein Aussehen für alle Fenster.
import styles from './WerKann.module.scss';
import eigen from './VorgabeFach.module.scss';

/**
 * **Die Vorgabe eines Dienstes: „Anfrage | direkt“** (Wunsch 2, Scheibe P2m, Entwurf `e9-p2-modus.html`, Variante G4).
 * Ein kleines Fenster, das das runde Symbol am Dienstnamen der Matrix öffnet – umgeschaltet wird nie per Klick auf das
 * Symbol („Klicken geht zu schnell schief“, Alwin 17.11.2026). Gilt für **neue** Entwürfe (aus „Wer kann?“, „Personen“
 * und dem Zauberstab); bestehende bleiben, wie sie sind. Gemerkt wird je Gerät, nicht in ChurchTools.
 */
export function VorgabeFach({
  dienst,
  modus,
  onModus,
  onFuerAlle,
  onClose,
}: {
  dienst: string;
  modus: Modus;
  onModus: (modus: Modus) => void;
  /** „Für alle Dienste übernehmen“ – die jetzt gewählte Vorgabe für jeden Dienst. */
  onFuerAlle: (modus: Modus) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={`Vorgabe · ${dienst}`} onClose={onClose} knoepfe={null}>
      <p className={styles.unter}>Wie werden neue Einteilungen eingetragen?</p>
      <div className={eigen.wahl}>
        <span>Neue Einteilungen bei {dienst}:</span>
        <Segment<Modus>
          value={modus}
          options={[
            { value: 'anfrage', label: 'Anfrage' },
            { value: 'direkt', label: 'direkt' },
          ]}
          onChange={onModus}
          ariaLabel={`Neue Einteilungen bei ${dienst}`}
          verbunden
        />
      </div>
      <p className={styles.hinweis}>
        direkt = ohne Rückfrage als zugesagt eintragen, z. B. für Prediger. Anfrage = die Person
        wird gefragt.
      </p>
      <p className={eigen.fuerAlle}>
        <button type="button" className={eigen.link} onClick={() => onFuerAlle(modus)}>
          Für alle Dienste übernehmen ({modusWort(modus)})
        </button>
      </p>
      <p className={styles.hinweis}>
        Gilt auf diesem Gerät (im Browser gemerkt), nicht für andere Planer. Wirkt auf neue Entwürfe
        und den Zauberstab; bestehende bleiben, wie sie sind.
      </p>
    </Sheet>
  );
}
