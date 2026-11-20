import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Icon } from '@ui/icons/icons';
import type { Schreiber } from '@shared/ct/sperre';
import type { SchlangenStand } from '@shared/website/schlange';
import { lebenszeichenAlter } from './regeln';
import type { SperrTexte } from './sperrTexte';
import type { Sperrarbeit } from './useSperrarbeit';
import styles from './SperrBaender.module.scss';

/** „Speichert … / Gespeichert / Nicht gespeichert“ – kurz, damit die Werkzeugleiste ruhig bleibt; der Grund steht im Band darunter. */
export function SpeicherZustand({ stand }: { stand: SchlangenStand }) {
  if (stand.art === 'speichert')
    return (
      <span className={styles.zustand} role="status">
        <Icon name="refresh" size={16} />
        Speichert …
      </span>
    );
  if (stand.art === 'fehler' || stand.art === 'gesperrt' || stand.art === 'veraendert')
    return (
      <span className={`${styles.zustand} ${styles.fehler}`}>
        <Icon name="warnung" size={16} />
        Nicht gespeichert
      </span>
    );
  return (
    <span className={styles.zustand} role="status">
      <Icon name="cloud-check" size={16} />
      Gespeichert
    </span>
  );
}

/**
 * **Die Bänder unter der Werkzeugleiste** – Speichern gescheitert, fremd gesperrt, abgewiesen, Hinweis – und die Rückfrage
 * „Bearbeitung übernehmen?“. Für Seiten und Aussehen dieselben; die Worte kommen aus `texte`.
 */
export function SperrBaender({
  a,
  ich,
  texte,
}: {
  a: Sperrarbeit;
  ich: Schreiber;
  texte: SperrTexte;
}) {
  const { speicher, fremd } = a;
  const abgewiesen = speicher.art === 'gesperrt' || speicher.art === 'veraendert';
  return (
    <>
      {speicher.art === 'fehler' && (
        <div className={styles.band} role="alert">
          <p>
            Nicht gespeichert – {fehlerMeldung(speicher.fehler).text} Deine Änderung ist noch hier
            zu sehen und geht nicht verloren.
          </p>
          <KopfKnopf
            label="Erneut versuchen"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => a.schlange.nochmal()}
          />
        </div>
      )}
      {fremd && (
        <div className={styles.band} role="status">
          <p>{texte.fremd(fremd, ich.person, a.verdraengt)}</p>
          <KopfKnopf
            label="Erneut prüfen"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void a.sicherstellen()}
          />
          <KopfKnopf
            label={fremd.von === ich.person ? 'Hier weiterbearbeiten' : 'Bearbeitung übernehmen'}
            symbol={<Icon name="lock" size={16} />}
            onClick={() => a.setFrageUebernehmen(true)}
          />
        </div>
      )}
      {abgewiesen && !fremd && (
        <div className={styles.band} role="alert">
          <p>{texte.veraendert}</p>
          <KopfKnopf
            label="Neu laden"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void a.neuLaden()}
          />
        </div>
      )}
      {abgewiesen && fremd && speicher.art === 'gesperrt' && (
        <div className={styles.band} role="alert">
          <p>Deine letzten Änderungen sind nicht gespeichert.</p>
          <KopfKnopf
            label="Neu laden"
            symbol={<Icon name="refresh" size={16} />}
            onClick={() => void a.neuLaden()}
          />
        </div>
      )}
      {a.hinweis && (
        <div className={styles.band} role="alert">
          <p>{a.hinweis}</p>
        </div>
      )}
      {a.frageUebernehmen && fremd && (
        <ConfirmDialog
          title={fremd.von === ich.person ? 'Hier weiterbearbeiten?' : 'Bearbeitung übernehmen?'}
          message={
            (fremd.von === ich.person
              ? 'Das andere Fenster von dir kann dann nicht mehr speichern. Was dort seit dem letzten Speichern getippt wurde, bleibt nur dort sichtbar.'
              : `${fremd.name} kann dann nicht mehr speichern – das letzte Lebenszeichen war ${lebenszeichenAlter(fremd.seit, new Date())}. Alles, was ${fremd.name} seit dem letzten Speichern geändert hat, geht verloren.`) +
            (speicher.art !== 'gespeichert'
              ? ' Auch deine ungespeicherten Änderungen hier entfallen: Du machst mit dem gespeicherten Stand weiter.'
              : '')
          }
          confirmLabel="Übernehmen"
          harmlos
          beschaeftigt={a.uebernimmt}
          onConfirm={() => void a.bearbeitungUebernehmen()}
          onCancel={() => a.setFrageUebernehmen(false)}
        />
      )}
    </>
  );
}
