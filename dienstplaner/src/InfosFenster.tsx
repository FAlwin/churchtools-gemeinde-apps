import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { INFOS_MAX } from '@shared/ct/terminInfos';
import { speichereInfos } from './ladeTerminInfos';
import styles from './InfosFenster.module.scss';

/**
 * **„Weitere Infos“ eines Termins** (Scheibe T1, Entwurf `termin-einstellungen.html` Variante B, Alwin 02.11.2026): das
 * Fenster hinter dem ⓘ im Kopf der Termin-Ansicht. Alle lesen; wer den Termin ändern darf (`terminAenderbar`),
 * bekommt „Bearbeiten“ – dann ein Textfeld mit Zähler (höchstens 4000 Zeichen, wie ChurchTools). Gespeichert wird über
 * den Kern (`infosSpeichern`: frisch lesen, Absage mitschicken, nachlesen). Hat jemand die Infos inzwischen anders
 * gespeichert, fragt das Fenster: die eigenen speichern oder die anderen übernehmen – nie still überschreiben.
 */
export function InfosFenster({
  fuer,
  terminId,
  text,
  darf,
  onGespeichert,
  onClose,
  speichern = speichereInfos,
}: {
  /** „Gottesdienst · So, 08.11.2026“ – steht über der Überschrift. */
  fuer: string;
  terminId: number;
  /** Die Infos, wie die Termin-Ansicht sie zuletzt kennt. */
  text: string;
  darf: boolean;
  onGespeichert: (text: string) => void;
  onClose: () => void;
  /** Nur für Tests. */
  speichern?: typeof speichereInfos;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  // Was das Textfeld beim Öffnen zeigte – damit erkennt der Kern, ob jemand dazwischen gespeichert hat.
  const [gesehen, setGesehen] = useState(text);
  const [entwurf, setEntwurf] = useState(text);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState<string | null>(null);

  const zuLang = entwurf.length > INFOS_MAX;
  const geaendert = entwurf !== gesehen;

  function oeffnen(): void {
    setGesehen(text);
    setEntwurf(text);
    setFehler(null);
    setKonflikt(null);
    setBearbeiten(true);
  }

  async function sichern(trotzdem = false): Promise<void> {
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await speichern(terminId, entwurf, gesehen, trotzdem);
      if (r.ok) {
        setKonflikt(null);
        setBearbeiten(false);
        onGespeichert(r.text);
      } else {
        setKonflikt(r.aktuell);
      }
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    } finally {
      setLaeuft(false);
    }
  }

  /** „Ihre übernehmen“: der Text von ChurchTools ins Feld – weiter bearbeiten oder schließen. */
  function uebernehmen(): void {
    if (konflikt === null) return;
    setGesehen(konflikt);
    setEntwurf(konflikt);
    setKonflikt(null);
    onGespeichert(konflikt);
  }

  if (!bearbeiten) {
    return (
      <Sheet
        title="Weitere Infos"
        onClose={onClose}
        cancelLabel={null}
        knoepfe={darf ? <FensterKnopf onClick={oeffnen}>Bearbeiten</FensterKnopf> : null}
      >
        <p className={styles.fuer}>{fuer}</p>
        {text ? (
          <p className={styles.text}>{text}</p>
        ) : (
          <p className={styles.leer}>Noch keine Infos zu diesem Termin.</p>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Weitere Infos"
      onClose={onClose}
      onAbbrechen={() => setBearbeiten(false)}
      zurueck={() => setBearbeiten(false)}
      beschaeftigt={laeuft}
      // Ein Tipp daneben soll keinen Text verwerfen.
      onHintergrund={geaendert ? () => {} : undefined}
      knoepfe={
        konflikt !== null ? (
          <>
            <FensterKnopf art="zweit" disabled={laeuft} onClick={uebernehmen}>
              Ihre übernehmen
            </FensterKnopf>
            <FensterKnopf disabled={laeuft} onClick={() => void sichern(true)}>
              Meine speichern
            </FensterKnopf>
          </>
        ) : (
          <FensterKnopf disabled={laeuft || zuLang || !geaendert} onClick={() => void sichern()}>
            {laeuft ? 'Speichert …' : 'Speichern'}
          </FensterKnopf>
        )
      }
    >
      <p className={styles.fuer}>{fuer}</p>
      <label className={styles.feld}>
        <span>Für alle, die den Termin sehen</span>
        <textarea
          className={styles.textarea}
          value={entwurf}
          rows={8}
          autoFocus
          disabled={laeuft}
          onChange={(ev) => setEntwurf(ev.target.value)}
        />
      </label>
      <p className={`${styles.zaehler}${zuLang ? ` ${styles.zuLang}` : ''}`} aria-live="polite">
        {entwurf.length} / {INFOS_MAX}
        {zuLang && ' – zu lang, ChurchTools nimmt höchstens 4000 Zeichen'}
      </p>
      <p className={styles.hinweis}>Dasselbe Feld wie „Weitere Infos“ in ChurchTools.</p>
      {konflikt !== null && (
        <div className={styles.konflikt} role="alert">
          <b>Die Infos wurden eben woanders geändert.</b> In ChurchTools steht jetzt:
          <p className={styles.text}>{konflikt || '(keine Infos)'}</p>
        </div>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
