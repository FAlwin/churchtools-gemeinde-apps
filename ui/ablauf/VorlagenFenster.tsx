/**
 * **Die drei Fenster der Seite „Ablaufvorlagen“** (E10-V3a, Entwurf `e10-vorlagen.html` Abschnitt 3): „Neue Vorlage“,
 * „Vorlage umbenennen“, „Vorlage löschen?“. Modale im Aufbau der ChurchTools-Fenster (`Sheet` mit `knoepfe`,
 * `ConfirmDialog`). Die Namensregel kommt aus dem Kern (`vorlageNameFehler`, `VORLAGE_NAME_MAX`) – dieselbe, die dort
 * vor jedem Schreiben prüft; der Kern bleibt die Instanz, das Fenster warnt nur früher.
 */
import { useState, type FormEvent } from 'react';
import { VORLAGE_NAME_MAX, vorlageNameFehler } from '@shared/ct/ablaufVorlagen';
import type { Kalender } from '@shared/types/index';
import { ConfirmDialog } from '../fenster/ConfirmDialog';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Sheet } from '../fenster/Sheet';
import { meldung } from './vorlagenMeta';
import styles from './VorlagenFenster.module.scss';

export function NameFeld({
  wert,
  onChange,
  fehler,
  hinweis,
  beschaeftigt,
}: {
  wert: string;
  onChange: (w: string) => void;
  fehler: string | null;
  hinweis?: string;
  beschaeftigt: boolean;
}) {
  return (
    <label className={styles.feld}>
      <span className={styles.lab}>Name</span>
      <input
        className={styles.eingabe}
        value={wert}
        // Eine Zeichen über die Grenze hinaus lässt sich nicht tippen – die Meldung des Kerns bleibt für Eingefügtes.
        maxLength={VORLAGE_NAME_MAX}
        autoFocus
        disabled={beschaeftigt}
        aria-invalid={fehler !== null}
        onChange={(e) => onChange(e.target.value)}
      />
      {hinweis && <small className={styles.klein}>{hinweis}</small>}
    </label>
  );
}

/** Die Auswahl des Kalenders – „Neue Vorlage“ und „Als Vorlage …“ (E10-V5) nehmen dasselbe Feld. */
export function KalenderFeld({
  kalender,
  wert,
  onChange,
  beschaeftigt,
}: {
  /** Schon gefiltert: nur Kalender, in denen man Vorlagen bearbeiten darf. */
  kalender: readonly Kalender[];
  wert: number | null;
  onChange: (kalenderId: number) => void;
  beschaeftigt: boolean;
}) {
  return (
    <label className={styles.feld}>
      <span className={styles.lab}>Kalender</span>
      <select
        className={styles.eingabe}
        value={wert ?? ''}
        disabled={beschaeftigt}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {kalender.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <small className={styles.klein}>
        Die Vorlage wird bei Terminen dieses Kalenders angeboten.
      </small>
    </label>
  );
}

/**
 * „Neue Vorlage“: Name und Kalender – **nur Kalender, in denen man Vorlagen bearbeiten darf** (`kalender` ist schon
 * gefiltert), vorbelegt mit dem Kalender, in dem es schon die meisten Vorlagen gibt. Danach öffnet der Aufrufer die neue Vorlage gleich im Bearbeiten-Modus.
 */
export function NeueVorlageFenster({
  kalender,
  vorbelegt,
  onAnlegen,
  onClose,
}: {
  kalender: readonly Kalender[];
  /** Der vorbelegte Kalender (`vorgabeKalender`) – ohne der erste der Auswahl. */
  vorbelegt?: number | null;
  /** Legt an und liefert die ID; wirft bei Fehler – die Meldung steht dann im Fenster. */
  onAnlegen: (daten: { name: string; kalenderId: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [kalenderId, setKalenderId] = useState<number | null>(vorbelegt ?? kalender[0]?.id ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const nameFehler = name === '' ? null : vorlageNameFehler(name);

  async function anlegen(e?: FormEvent) {
    e?.preventDefault();
    const f = vorlageNameFehler(name);
    if (f) return setFehler(f);
    if (kalenderId === null) return setFehler('Bitte einen Kalender wählen.');
    setFehler(null);
    setLaeuft(true);
    try {
      await onAnlegen({ name, kalenderId });
    } catch (err) {
      setFehler(meldung(err, 'Die Vorlage konnte nicht angelegt werden.'));
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title="Neue Vorlage"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf
          onClick={() => void anlegen()}
          disabled={laeuft || vorlageNameFehler(name) !== null || kalenderId === null}
        >
          {laeuft ? 'Lege an …' : 'Anlegen'}
        </FensterKnopf>
      }
    >
      <form onSubmit={(e) => void anlegen(e)}>
        <NameFeld
          wert={name}
          onChange={(w) => {
            setName(w);
            setFehler(null);
          }}
          fehler={nameFehler}
          beschaeftigt={laeuft}
        />
        <KalenderFeld
          kalender={kalender}
          wert={kalenderId}
          onChange={setKalenderId}
          beschaeftigt={laeuft}
        />
        {/* Enter im Namensfeld legt an – ohne verstecktes Absenden-Knöpfchen geht das in manchen Browsern nicht. */}
        <button type="submit" hidden />
      </form>
      {(fehler ?? nameFehler) && (
        <p className={styles.fehler} role="alert">
          {fehler ?? nameFehler}
        </p>
      )}
    </Sheet>
  );
}

/** „Vorlage umbenennen“ – mit dem Hinweis „Höchstens 100 Zeichen.“ */
export function VorlageUmbenennenFenster({
  name: start,
  onUmbenennen,
  onClose,
}: {
  name: string;
  /** Wirft bei Fehler – die Meldung steht dann im Fenster. */
  onUmbenennen: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const nameFehler = vorlageNameFehler(name);

  async function speichern(e?: FormEvent) {
    e?.preventDefault();
    if (nameFehler) return setFehler(nameFehler);
    setFehler(null);
    setLaeuft(true);
    try {
      await onUmbenennen(name);
    } catch (err) {
      setFehler(meldung(err, 'Die Vorlage konnte nicht umbenannt werden.'));
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title="Vorlage umbenennen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf onClick={() => void speichern()} disabled={laeuft || nameFehler !== null}>
          {laeuft ? 'Speichere …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <form onSubmit={(e) => void speichern(e)}>
        <NameFeld
          wert={name}
          onChange={(w) => {
            setName(w);
            setFehler(null);
          }}
          fehler={nameFehler}
          hinweis={`Höchstens ${VORLAGE_NAME_MAX} Zeichen.`}
          beschaeftigt={laeuft}
        />
        <button type="submit" hidden />
      </form>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}

/**
 * „Vorlage löschen?“ – ChurchTools hat dafür keinen Papierkorb, deshalb die Nachfrage mit rotem Hinweis. Ein Fehler
 * (kein Recht, nicht erreichbar) steht im Fenster, das offen bleibt.
 */
export function VorlageLoeschenFenster({
  name,
  onLoeschen,
  onClose,
}: {
  name: string;
  /** Wirft bei Fehler. */
  onLoeschen: () => Promise<void>;
  onClose: () => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function loeschen() {
    setFehler(null);
    setLaeuft(true);
    try {
      await onLoeschen();
    } catch (err) {
      setFehler(meldung(err, 'Die Vorlage konnte nicht gelöscht werden.'));
      setLaeuft(false);
    }
  }

  return (
    <ConfirmDialog
      title="Vorlage löschen?"
      message={`„${name}“ wird in ChurchTools gelöscht. Abläufe, die schon daraus entstanden sind, bleiben unverändert.`}
      confirmLabel={laeuft ? 'Lösche …' : 'Löschen'}
      onConfirm={() => void loeschen()}
      onCancel={onClose}
      beschaeftigt={laeuft}
    >
      <p className={styles.warnung}>Das lässt sich nicht rückgängig machen.</p>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </ConfirmDialog>
  );
}
