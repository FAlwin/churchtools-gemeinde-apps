import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { Pause, PersonenTag } from '@shared/dienstplan/personenliste';
import werKann from './WerKann.module.scss';
import styles from './PersonFenster.module.scss';

type Art = 'keine' | 'bis' | 'offen';
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Die Pause aus der Wahl im Fenster – `undefined`, solange sie nicht stimmt („Bis Datum“ ohne Datum). */
function pauseAus(art: Art, bis: string): Pause | null | undefined {
  if (art === 'keine') return null;
  if (art === 'offen') return {};
  return TAG.test(bis) ? { bis } : undefined;
}

/**
 * **Das Personen-Fenster der Liste** (PL-2, Entwurf `personenliste.html` Variante B): im Modus „Liste bearbeiten“ öffnet der
 * Klick auf einen Namen dieses Fenster – Tags **bei diesem Dienst** (aus der festen Liste der Dienstgruppe, nur antippen) und
 * die **Pause in der Dienstgruppe** (keine · bis Datum einschließlich · ohne Ende). Immer ein Fenster in der Mitte, auch am Handy
 * (nie ein Blatt von unten). Gespeichert wird beide Mal zusammen; `speichern` liefert den Text, wenn es nicht ging – dann
 * bleibt das Fenster mit der Eingabe offen.
 */
export function PersonFenster({
  name,
  dienst,
  gruppe,
  tags,
  gewaehlt,
  pause,
  speichern,
  onTagsVerwalten,
  onClose,
}: {
  name: string;
  dienst: string;
  gruppe: string;
  /** Die feste Tag-Liste der Dienstgruppe. */
  tags: PersonenTag[];
  /** Die Tags, die die Person bei diesem Dienst jetzt hat. */
  gewaehlt: string[];
  /** Ihre Pause in der Dienstgruppe – `null`: keine. */
  pause: Pause | null;
  /** Speichert Tags und Pause; `null` = geklappt (das Fenster schließt der Aufrufer), sonst der Text für den Planer. */
  speichern: (tagIds: string[], pause: Pause | null) => Promise<string | null>;
  /** „Tags verwalten“ – für die Dienstgruppe ohne Tags und für den Weg dorthin. */
  onTagsVerwalten: () => void;
  onClose: () => void;
}) {
  const [an, setAn] = useState<Set<string>>(() => new Set(gewaehlt));
  const art0: Art = pause ? (pause.bis ? 'bis' : 'offen') : 'keine';
  const [art, setArt] = useState<Art>(art0);
  const [bis, setBis] = useState(pause?.bis ?? '');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const vorname = name.split(' ')[0];
  const neuePause = pauseAus(art, bis);
  // Ein Tipp neben das Fenster verwirft nichts, was schon angefasst ist (wie beim Punkt-Fenster).
  const geaendert =
    an.size !== gewaehlt.length ||
    gewaehlt.some((id) => !an.has(id)) ||
    art !== art0 ||
    (art === 'bis' && bis !== (pause?.bis ?? ''));

  const los = async () => {
    if (neuePause === undefined || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    // Die Reihenfolge der Tag-Liste behalten (nicht die des Antippens).
    const text = await speichern(
      tags.filter((t) => an.has(t.id)).map((t) => t.id),
      neuePause,
    );
    setLaeuft(false);
    if (text !== null) setFehler(text);
  };

  return (
    <Sheet
      title={name}
      onClose={onClose}
      onHintergrund={geaendert ? () => {} : onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={neuePause === undefined || laeuft} onClick={() => void los()}>
          Speichern
        </FensterKnopf>
      }
    >
      <h3 className={styles.ueber}>Tags bei {dienst}</h3>
      {tags.length > 0 ? (
        <ul className={styles.liste} aria-label={`Tags bei ${dienst}`}>
          {tags.map((t) => (
            <li key={t.id}>
              <label className={styles.wahl}>
                <input
                  type="checkbox"
                  className={styles.haken}
                  checked={an.has(t.id)}
                  onChange={() => {
                    const neu = new Set(an);
                    if (neu.has(t.id)) neu.delete(t.id);
                    else neu.add(t.id);
                    setAn(neu);
                  }}
                />
                <span>{t.name}</span>
                <span className={styles.kuerzel} aria-hidden="true">
                  {t.kuerzel}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className={werKann.hinweis}>
          Für {gruppe} gibt es noch keine Tags.{' '}
          <TextKnopf onClick={onTagsVerwalten}>Tags verwalten …</TextKnopf>
        </p>
      )}

      <h3 className={styles.ueber}>Pause in {gruppe}</h3>
      <Segment<Art>
        value={art}
        options={[
          { value: 'keine', label: 'Keine' },
          { value: 'bis', label: 'Bis Datum' },
          { value: 'offen', label: 'Ohne Ende' },
        ]}
        onChange={setArt}
        ariaLabel={`Pause in ${gruppe}`}
        verbunden
      />
      {art === 'bis' && (
        <label className={styles.datum}>
          bis einschließlich
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
      )}
      <p className={werKann.hinweis}>
        Während der Pause steht {vorname} in {gruppe} unten, bekommt keine Erinnerung und steht bei
        „Wer kann?“ bei „Kann nicht“. Selbst antworten geht weiter.
      </p>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
