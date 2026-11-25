import { Segment } from '@ui/bedienung/Segment';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { AbfrageFormular, Zeitzeile } from '@shared/dienstplan/abfrageFenster';
import { AbfrageZeitleiste } from './AbfrageZeitleiste';
import { automatikHinweis } from './abfragenTexte';
import styles from './AbfrageFenster.module.scss';

/**
 * **Das Formular „Abfrage starten“** (Entwurf Schritt 3): Frist, Zeitraum von/bis, wann die Abfrage öffnet – darunter
 * „Was passiert wann“. Nur die Anzeige; Rechnen und Speichern liegen im Fenster (`AbfrageFenster`).
 */
export function AbfrageStart({
  gruppeName,
  formular,
  onFormular,
  heute,
  fehler,
  planFehler,
  onNochmal,
  keineTermine,
  zeilen,
  automatik,
}: {
  gruppeName: string;
  formular: AbfrageFormular;
  onFormular: (f: AbfrageFormular) => void;
  heute: string;
  /** Warum sich das Formular nicht starten lässt (`formularFehler`) – `null`: passt. */
  fehler: string | null;
  /** Der Plan für den gewählten Zeitraum ließ sich nicht laden. */
  planFehler: string | null;
  onNochmal: () => void;
  /** Im Zeitraum gibt es keine Termine, an denen die Gruppe Dienste hat (und alles ist geladen). */
  keineTermine: boolean;
  /** `null`: noch nichts zu zeigen. */
  zeilen: Zeitzeile[] | null;
  /** Gibt es die automatische Erinnerung für diese Gruppe schon? (R-5) */
  automatik: boolean;
}) {
  const set = (teil: Partial<AbfrageFormular>) => onFormular({ ...formular, ...teil });
  return (
    <>
      <label className={styles.feldName} htmlFor="abfrage-frist">
        Frist – bis dahin sollen die Antworten da sein
      </label>
      <input
        id="abfrage-frist"
        type="date"
        className={styles.feld}
        value={formular.frist}
        onChange={(e) => set({ frist: e.target.value })}
      />
      <div className={styles.reihe}>
        <div>
          <label className={styles.feldName} htmlFor="abfrage-von">
            Zeitraum von
          </label>
          <input
            id="abfrage-von"
            type="date"
            className={styles.feld}
            value={formular.von}
            onChange={(e) => set({ von: e.target.value })}
          />
        </div>
        <div>
          <label className={styles.feldName} htmlFor="abfrage-bis">
            bis
          </label>
          <input
            id="abfrage-bis"
            type="date"
            className={styles.feld}
            value={formular.bis}
            onChange={(e) => set({ bis: e.target.value })}
          />
        </div>
      </div>
      <span className={styles.feldName} id="abfrage-oeffnen-name">
        Abfrage öffnen
      </span>
      <Segment<'sofort' | 'tag'>
        value={formular.oeffnen}
        options={[
          { value: 'sofort', label: 'Sofort' },
          { value: 'tag', label: 'An einem Tag' },
        ]}
        onChange={(oeffnen) =>
          set({ oeffnen, oeffnenTag: formular.oeffnenTag || (oeffnen === 'tag' ? heute : '') })
        }
        ariaLabel="Abfrage öffnen"
        verbunden
      />
      {formular.oeffnen === 'tag' && (
        <input
          type="date"
          className={`${styles.feld} ${styles.oeffnenTag}`}
          aria-label="Öffnungstag"
          value={formular.oeffnenTag}
          onChange={(e) => set({ oeffnenTag: e.target.value })}
        />
      )}
      <p className={styles.leise}>
        {formular.oeffnen === 'sofort'
          ? 'Die Mitarbeitenden sehen die Abfrage ab heute.'
          : 'Die Mitarbeitenden sehen die Abfrage erst ab diesem Tag.'}
      </p>

      {fehler && (
        <p className={styles.fehler} role="status">
          {fehler}
        </p>
      )}
      {!fehler && planFehler && (
        <>
          <p className={styles.fehler} role="alert">
            {planFehler}
          </p>
          <p className={styles.nochmal}>
            <TextKnopf onClick={onNochmal}>Nochmal versuchen</TextKnopf>
          </p>
        </>
      )}
      {!fehler && !planFehler && keineTermine && (
        <p className={styles.fehler} role="status">
          Im Zeitraum gibt es keine Termine, an denen {gruppeName} Dienste hat.
        </p>
      )}
      {!fehler && !planFehler && !keineTermine && zeilen && (
        <>
          <AbfrageZeitleiste zeilen={zeilen} />
          {!automatik && <p className={styles.leise}>{automatikHinweis(gruppeName)}</p>}
        </>
      )}
    </>
  );
}
