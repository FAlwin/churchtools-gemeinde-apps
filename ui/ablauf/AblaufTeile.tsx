/**
 * Die Bausteine EINER Ablaufzeile (#198 – vorher in `pages/Setlist.tsx`; seit E6-1a in `ui/ablauf`, damit
 * Musik-App und Dienstplaner dieselben nutzen).
 *
 * Drei kleine Teile, die immer zusammen auftreten: die Bezeichnung des Punkts, das Icon der
 * Zuständigen und deren Zeile. Sie werden von der Ablauf-Ansicht UND von der sortierbaren Zeile
 * im Bearbeiten-Modus verwendet – deshalb gemeinsam und außerhalb beider.
 */
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import { itemTitleParts } from '@shared/ct/ablaufZeile';
import { Icon } from '../icons/icons';
import styles from './AblaufTeile.module.scss';

/**
 * Bezeichnung eines Ablaufpunkts wie in ChurchTools (#200): eigener Titel, dahinter – falls er
 * etwas hinzufügt – der Liedname. Die Regeln stecken in `@shared/ct/ablaufZeile`. `ohneLiedname`: Die Zeile zeigt
 * das Lied in einer eigenen Lied-Karte (E6-O1, wie die ChurchTools-App) – dann nur der eigene Titel.
 */
export function ItemTitle({
  item,
  ohneLiedname = false,
}: {
  item: Pick<AblaufZeile, 'title' | 'song'>;
  ohneLiedname?: boolean;
}) {
  const { title, songName } = itemTitleParts(item);
  return (
    <span className={styles.flowTitle}>
      {title}
      {songName && !ohneLiedname && <span className={styles.flowSongName}>{songName}</span>}
    </span>
  );
}

/**
 * Die Lied-Karte einer Zeile (E6-O1, wie die ChurchTools-App): Liedname, darunter Tonart · Tempo · Autor – was davon
 * bekannt ist. Den Autor liefert der Ablauf nicht (gemessen E6-O0); fehlt er, steht die Karte ohne ihn da.
 */
export function LiedKarte({
  song,
  ohneTitel = false,
  flach = false,
}: {
  song: NonNullable<AblaufZeile['song']>;
  /** Der Liedname steht schon in der Titelzeile (Punkt heißt wie das Lied) – dann nicht doppelt. */
  ohneTitel?: boolean;
  /** Ohne Rahmen – in einer Zeile der Feldliste im Punkt-Fenster (E6-O O3, wie im Entwurf B). */
  flach?: boolean;
}) {
  const meta = [song.originalKey, song.bpm ? `${song.bpm} bpm` : null, song.author]
    .filter((t): t is string => !!t && t.trim() !== '')
    .join(' · ');
  if (ohneTitel && !meta) return null;
  return (
    <span className={flach ? `${styles.liedKarte} ${styles.liedFlach}` : styles.liedKarte}>
      <span className={styles.liedNote} aria-hidden="true">
        <Icon name="music" size={13} />
      </span>
      <span className={styles.liedText}>
        {!ohneTitel && <span className={styles.liedTitel}>{song.title}</span>}
        {meta && <span className={styles.liedMeta}>{meta}</span>}
      </span>
    </span>
  );
}

/** So viele Kreise rechts in der Zeile, danach „+N“ (wie die ChurchTools-App). */
const KREISE = 2;

/**
 * Die Zuständigen als runde Kreise rechts in der Zeile (E6-O1): Foto, wo ChurchTools eins hat, sonst das Kürzel; ab
 * drei Personen „+N“. Offene Dienste stehen nicht darin – die nennt die Namenszeile rot. Die Namen stehen ohnehin unter
 * dem Titel, die Kreise sind deshalb nur Schmuck (`aria-hidden`).
 */
export function Kuerzel({ entries }: { entries: AblaufZeile['responsible'] }) {
  const personen = entries.filter((e) => !e.open && e.kuerzel);
  if (personen.length === 0) return null;
  const mehr = personen.length - KREISE;
  return (
    <span className={styles.kreise} aria-hidden="true">
      {personen.slice(0, KREISE).map((p, i) => (
        <span key={i} className={styles.kreis}>
          {p.bild ? <img src={p.bild} alt="" loading="lazy" /> : p.kuerzel}
        </span>
      ))}
      {mehr > 0 && <span className={styles.kreis}>+{mehr}</span>}
    </span>
  );
}

/**
 * Die Uhrzeit einer Zeile – an diesem Termin weggelassen (Auge, E6-3b) „—“, sonst die Zeit (oder nichts). Eine Stelle
 * für Ansicht und Bearbeiten-Liste.
 */
export function ZeitText({ item }: { item: Pick<AblaufZeile, 'time' | 'weggelassen'> }) {
  return <>{item.weggelassen ? '—' : (item.time ?? '')}</>;
}

/**
 * Der Hinweis für Bearbeitende, die nicht alle Dienstgruppen sehen (#676): ChurchTools löscht beim Ändern oder
 * Verschieben die Gruppen-Infos, die man nicht sieht (gemessen 22.10.2026). Eine Stelle für Liste und Punkt-Fenster.
 */
export function VerborgeneGruppenHinweis() {
  return (
    <p className={styles.gruppenHinweis} role="note">
      Du siehst nicht alle Dienstgruppen. ChurchTools löscht beim Speichern oder Verschieben die
      Infos der Gruppen, die du nicht siehst.
    </p>
  );
}

/** Der Hinweis an einer weggelassenen Zeile (E6-3b) – neben dem Titel. */
export function WeggelassenHinweis() {
  return <span className={styles.weggelassenTag}>an diesem Termin weggelassen</span>;
}

/**
 * Zeile der Zuständigen: besetzte als Name, offene Dienste rot mit „?". Grau unter dem Titel wie in der ChurchTools-App
 * (E6-O1; vorher mit Personen-Symbol davor – das tragen jetzt die Kreise rechts).
 */
export function ResponsibleLine({ entries }: { entries: AblaufZeile['responsible'] }) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.resp}>
      <span className={styles.respList}>
        {entries.map((e, i) => {
          // Kommagetrennt; das Komma steht MIT im Namens-Span, damit es beim Umbruch am Namen bleibt.
          const sep = i < entries.length - 1 ? ',' : '';
          return e.open ? (
            <span key={i} className={styles.respOpen}>
              {e.label} ?{sep}
            </span>
          ) : (
            <span key={i} className={styles.respName}>
              {e.label}
              {sep}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * Der Balken zwischen Vorlauf und Veranstaltung (#423): „Beginn“ links, die Uhrzeit rechts – wie „Eventstart“ in der
 * ChurchTools-App (E6-O1; vorher eine dünne Linie). Steht in der Ansicht UND in der Bearbeiten-Liste an derselben Stelle
 * (`beginnStelle` in `@shared/ct/ablaufZeile`), damit sich beim Umschalten nichts verschiebt. Ohne Uhrzeit (sie fehlt
 * nie, aber sicher ist sicher) steht nur „Beginn".
 */
export function BeginnLinie({ zeit }: { zeit?: string }) {
  return (
    <div className={styles.beginnLinie} role="separator" aria-label={`Beginn ${zeit ?? ''}`.trim()}>
      <span className={styles.beginnText}>Beginn</span>
      {zeit && <span className={styles.beginnZeit}>{zeit}</span>}
    </div>
  );
}
