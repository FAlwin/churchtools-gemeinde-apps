import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf, FensterLink } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { DATEI_SYMBOL, dateiZeilen } from '@ui/lied/dateiAnzeige';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { CtSong } from '@shared/ct/typen';
import { arrangementFileEntries, fileIdFromUrl } from '@shared/ct/arrangementFiles';
import { arrangementAnsicht } from '@shared/ct/liedVerwaltung';
import { musikAppDirektLink } from '@shared/ct/musikAppLink';
import styles from './LiedAnsicht.module.scss';

interface Props {
  terminId: number;
  /** Tag des Termins (`JJJJ-MM-TT`) – geht in den Direktlink, damit die Musik-App ihn auch außerhalb ihrer Wochen findet. */
  tag?: string;
  /** Der Ablaufpunkt mit Lied – der Direktlink in die Musik-App zielt auf ihn. */
  punkt: AblaufZeile & { song: NonNullable<AblaufZeile['song']> };
  /** Das Lied aus ChurchTools (`ladeLiedDaten`) – fehlt es, steht da, was der Ablauf weiß. */
  lied: CtSong | undefined;
  /** Adresse der Musik-App; `null` = nicht installiert, `undefined` = noch unbekannt. */
  musikApp: string | null | undefined;
  onClose: () => void;
  /** Aus dem Punkt-Fenster geöffnet: „Zurück“ dorthin statt „Schließen“, und ohne neues Einblenden. */
  zurueck?: () => void;
}

/**
 * **Die Lied-Ansicht im Dienstplaner** (E6-O O4, Entwurf `e6-optik-entwurf.html` Abschnitt 6; Alwin 28.10.2026): wie
 * die Song-Seite der ChurchTools-App, nur zum Ansehen – Autor · Verlag · CCLI, Arrangement, Tonart · Tempo und die
 * Dateien (antippbar, sie öffnen sich aus ChurchTools). Unten der Weg in die Musik-App, direkt zum Blatt dieses Lieds;
 * fehlt die Musik-App, steht der Knopf ausgegraut da, mit dem Hinweis, wer sie installiert.
 */
export function LiedAnsicht({ terminId, tag, punkt, lied, musikApp, onClose, zurueck }: Props) {
  const song = punkt.song;
  const arr = lied?.arrangements.find((a) => a.id === song.arrangementId);
  const ansicht = arr ? arrangementAnsicht(arr) : null;
  const meta = [lied?.author, lied?.copyright, lied?.ccli ? `CCLI ${lied.ccli}` : null]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t)
    .join(' · ');
  const tonart = ansicht?.key ?? song.originalKey ?? null;
  const tempo = ansicht?.tempo ?? song.bpm ?? null;
  const tonartTempo = [tonart, tempo ? `${tempo} bpm` : null].filter(Boolean).join(' · ') || '–';
  // Die Versionen, die die Musik-App selbst am Arrangement ablegt, sind kein Stoff für Menschen – wie im Lied-Menü.
  const dateien = arr
    ? arrangementFileEntries(arr.files)
        .filter((d) => d.kind !== 'chordpro-version')
        // Jeder Eintrag hat seine Datei-ID aus der Adresse – die Adresse selbst öffnet die Datei aus ChurchTools.
        .flatMap((d) => {
          const url = arr.files.find((f) => fileIdFromUrl(f.fileUrl) === d.fileId)?.fileUrl;
          return url ? [{ ...d, url }] : [];
        })
    : [];

  return (
    <Sheet
      title={lied?.name ?? song.title}
      onClose={onClose}
      einblenden={!zurueck}
      cancelLabel={zurueck ? null : 'Schließen'}
      knoepfe={
        <>
          {zurueck && (
            <FensterKnopf art="zweit" onClick={zurueck}>
              Zurück
            </FensterKnopf>
          )}
          {musikApp ? (
            <FensterLink href={musikAppDirektLink(musikApp, terminId, punkt.id, tag)}>
              In der Musik-App öffnen
            </FensterLink>
          ) : (
            <FensterKnopf disabled>In der Musik-App öffnen</FensterKnopf>
          )}
        </>
      }
    >
      {meta && <p className={styles.meta}>{meta}</p>}

      <div className={styles.paar}>
        <div>
          <small>Arrangement</small>
          <b>{arr?.name ?? song.arrangement ?? '–'}</b>
        </div>
        <div>
          <small>Tonart · Tempo</small>
          <b>{tonartTempo}</b>
        </div>
      </div>

      {lied ? (
        <section className={styles.dateien} aria-label="Dateien">
          <small>Dateien</small>
          {dateien.length === 0 ? (
            <p className={styles.leise}>An diesem Arrangement liegen keine Dateien.</p>
          ) : (
            <ul>
              {dateien.map((d) => {
                const z = dateiZeilen(d);
                return (
                  <li key={d.fileId}>
                    <a
                      className={styles.datei}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name={DATEI_SYMBOL[d.kind]} size={18} />
                      <span className={styles.dateiText}>
                        {z.titel}
                        <small>{z.unter}</small>
                      </span>
                      <Icon name="chev-right" size={16} className={styles.pfeil} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <p className={styles.leise}>
          Mehr zum Lied (Verlag, Dateien) ließ sich gerade nicht laden.
        </p>
      )}

      {musikApp === null && (
        <p className={styles.hinweis}>
          Die Musik-App ist hier nicht installiert – das macht ein ChurchTools-Admin.
        </p>
      )}
    </Sheet>
  );
}
