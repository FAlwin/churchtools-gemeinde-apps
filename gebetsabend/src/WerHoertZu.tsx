import { PersonBild } from '@ui/bedienung/PersonBild';
import { uhrText } from '@shared/ct/zeit';
import { initialenAus } from '@shared/organigramm/mitglieder';
import { WER_HOERT_TEXT, zuhoererListe, type Verbindungen } from '@shared/gebetsabend/werHoert';
import karte from './Zuhoeren.module.scss';
import styles from './Technik.module.scss';

/**
 * **„Wer hört zu?“** (Bauplan Gebetsabend G4, Entwurf v4): eine eigene Karte neben dem Sender, aufgebaut wie
 * „Braucht deine Aufmerksamkeit“ in den Anmeldungen – Titel und Zahl im Kopf, darunter die Personen mit dem Kreis aus
 * ChurchTools (`PersonBild`). Die Verbindungen hält die Technik-Karte (`Technik.tsx`), gezählt wird in
 * `@shared/gebetsabend/werHoert`.
 */
export function WerHoertZu({ verbindungen }: { verbindungen: Verbindungen }) {
  const { liste, zahl } = zuhoererListe(verbindungen);
  return (
    <section className={karte.karte} aria-labelledby="wer-hoert">
      <div className={karte.kopf}>
        <h2 id="wer-hoert">Wer hört zu?</h2>
        <span className={styles.anzahl}>{zahl}</span>
      </div>
      {liste.length > 0 ? (
        <ul className={styles.liste} aria-label="Wer hört zu?">
          {liste.map((z) => (
            <li key={z.name ?? ''}>
              <PersonBild
                name={z.name ?? WER_HOERT_TEXT.ohneName}
                bild={null}
                initialen={z.name ? initialenAus(z.name) : '?'}
              />
              <span className={styles.wer}>
                <span className={z.name ? styles.name : `${styles.name} ${styles.ohneName}`}>
                  {z.name ?? WER_HOERT_TEXT.ohneName}
                </span>
                <small>
                  seit {uhrText(z.seit)} Uhr
                  {z.geraete > 1 &&
                    (z.name ? ` · ${z.geraete} Geräte` : ` · ${z.geraete} Verbindungen`)}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`${karte.inhalt} ${karte.leise}`}>{WER_HOERT_TEXT.niemand}</p>
      )}
      <p className={`${karte.fuss} ${karte.leise}`}>{WER_HOERT_TEXT.hinweis}</p>
    </section>
  );
}
