import { useId, useState } from 'react';
import type { AbsenceEvent } from '@shared/types/index';
import { MAX_NOTIZ } from '@shared/dienstplan/verfuegbarkeit';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Sheet } from '../fenster/Sheet';
import { tagKurz } from './absenceDatum';
import styles from './Abwesenheiten.module.scss';

export interface NotizFensterProps {
  /** Der Termin – steht als Untertitel im Fenster. */
  termin: AbsenceEvent;
  /**
   * `zusage` = bei Ja/Vielleicht: Kommentar + „Nur bestimmte Dienste“. `nein` = nur der Kommentar, er wird der Kommentar der
   * ChurchTools-Abwesenheit.
   */
  art: 'zusage' | 'nein';
  notiz: string;
  /** Die gewählten Dienste (IDs); `undefined` = alle. */
  dienste: number[] | undefined;
  /** Die eigenen Dienste, aus denen man wählt. Leer: kein Abschnitt. */
  alleDienste: { id: number; name: string }[];
  /** „Übernehmen“: merkt vor, speichert nichts. `dienste` ist `undefined`, wenn alle an sind. */
  onUebernehmen: (notiz: string, dienste: number[] | undefined) => void;
  onClose: () => void;
}

/**
 * **Das Notiz-Fenster zu einem Termin** (E5c-2, Entwurf `e5c-wann-kann-ich`, „Notiz“): ein Modal mit dem Kommentar und – bei
 * Ja/Vielleicht – einem Schalter je eigenem Dienst. Standard: alle an = die Antwort gilt für alle. **Mindestens ein Dienst
 * bleibt an** (sonst Hinweis und „Übernehmen“ gesperrt). Das Fenster merkt nur vor; gespeichert wird mit „Speichern“ der Seite.
 */
export function NotizFenster({
  termin,
  art,
  notiz: notizVorher,
  dienste: diensteVorher,
  alleDienste,
  onUebernehmen,
  onClose,
}: NotizFensterProps) {
  const id = useId();
  const [notiz, setNotiz] = useState(notizVorher);
  const mitDiensten = art === 'zusage' && alleDienste.length > 0;
  const [an, setAn] = useState<Set<number>>(
    () =>
      new Set(
        alleDienste.filter((d) => !diensteVorher || diensteVorher.includes(d.id)).map((d) => d.id),
      ),
  );
  const keiner = mitDiensten && an.size === 0;
  const umschalten = (dienst: number): void =>
    setAn((alt) => {
      const neu = new Set(alt);
      if (neu.has(dienst)) neu.delete(dienst);
      else neu.add(dienst);
      return neu;
    });
  const uebernehmen = (): void => {
    if (keiner) return;
    const gewaehlt = alleDienste.filter((d) => an.has(d.id)).map((d) => d.id);
    onUebernehmen(
      notiz,
      mitDiensten && gewaehlt.length < alleDienste.length ? gewaehlt : undefined,
    );
  };
  return (
    <Sheet
      title="Notiz"
      onClose={onClose}
      mittel
      knoepfe={
        <FensterKnopf disabled={keiner} onClick={uebernehmen}>
          Übernehmen
        </FensterKnopf>
      }
    >
      <p className={styles.frageText}>
        <b>{tagKurz(termin.date)}</b> · {termin.name}
      </p>
      <div className={styles.feld}>
        <label htmlFor={`${id}-notiz`}>Kommentar</label>
        <textarea
          id={`${id}-notiz`}
          rows={2}
          maxLength={MAX_NOTIZ}
          placeholder="z. B. nur bis 12 Uhr"
          value={notiz}
          autoFocus
          onChange={(e) => setNotiz(e.target.value)}
        />
        <span className={styles.notizHinweis}>
          {art === 'zusage'
            ? 'Kann deine Dienstgruppe sehen.'
            : 'Steht als Kommentar der Abwesenheit in ChurchTools.'}
        </span>
      </div>
      {mitDiensten && (
        <fieldset className={styles.dienstWahl}>
          <legend>Nur bestimmte Dienste</legend>
          <p className={styles.frageText}>
            Gilt deine Antwort nur für einen Teil deiner Dienste? Dann schalte die anderen aus.
            Sonst gilt sie für alle.
          </p>
          {alleDienste.map((d) => (
            <label key={d.id} className={styles.dienstZeile}>
              <input type="checkbox" checked={an.has(d.id)} onChange={() => umschalten(d.id)} />
              {d.name}
            </label>
          ))}
          {keiner && (
            <p className={styles.fehler} role="alert">
              Mindestens ein Dienst muss an bleiben.
            </p>
          )}
        </fieldset>
      )}
    </Sheet>
  );
}
