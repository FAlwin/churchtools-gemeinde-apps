import { useEffect, useState } from 'react';
import { Sheet } from '../fenster/Sheet';
import { KopfKnopf } from './KopfKnopf';
import styles from './HilfeKnopf.module.scss';

/** Ein Abschnitt der Hilfe: eine Überschrift und zwei, drei kurze Stichpunkte. */
export interface HilfeAbschnitt {
  titel: string;
  punkte: readonly string[];
}

/**
 * **Hilfe-Knopf „?“ im Seitenkopf** (Alwin, 17.11.2026: „Muss der lange Text da stehen? Das wird niemals jemand
 * lesen.“). Statt eines langen Erklär-Absatzes unter der Seite öffnet der Knopf ein Fenster mit kurzen Abschnitten –
 * je Überschrift zwei, drei Stichpunkte statt Fließtext. Gilt überall im Dienstplaner gleich.
 *
 * Gedacht für **Erklärungen zur ganzen Seite**. Kurze Hinweise an einem Bedienelement, Fehler-, Status- und
 * Leer-Texte und Warnungen bleiben dort, wo sie stehen – sie gehören zur Bedienung.
 */
export function HilfeKnopf({
  seite,
  abschnitte,
}: {
  /** Name der Seite: „Planen“ → Knopf „Hilfe zu Planen“, Fenster „Hilfe · Planen“. */
  seite: string;
  abschnitte: readonly HilfeAbschnitt[];
}) {
  const [offen, setOffen] = useState(false);

  // Das Fenster schließt auch mit Esc (das gemeinsame `Sheet` kann das selbst nicht).
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen]);

  return (
    <>
      <KopfKnopf
        onClick={() => setOffen(true)}
        label="Hilfe"
        title={`Hilfe zu ${seite}`}
        symbol={
          <span className={styles.fragezeichen} aria-hidden>
            ?
          </span>
        }
        nurSymbol
      />
      {offen && (
        <Sheet title={`Hilfe · ${seite}`} onClose={() => setOffen(false)} knoepfe={null}>
          <div className={styles.hilfe}>
            {abschnitte.map((a) => (
              <section key={a.titel} className={styles.abschnitt}>
                <h3>{a.titel}</h3>
                <ul>
                  {a.punkte.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
