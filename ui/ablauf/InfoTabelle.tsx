/**
 * **Die Info-Spalten als Tabelle** (Alwin, 02.11.2026, Entwurf „Ablauf mit Info-Spalten“ Bild 1+2) – eine Stelle für die
 * Ansicht (`AblaufListe`) und die Bearbeiten-Liste (`useAblaufBearbeiten`, Entwurf `ablauf-infos-bearbeiten.html`
 * Variante B): ein Raster für alle Zeilen – jede Zeile übernimmt es (`subgrid`), damit die Spalten fluchten. Eine Spalte
 * ist so breit wie ihr Inhalt, höchstens `SPALTE_MAX`; der Punkt behält mindestens `PUNKT_MIN`. Reicht der Platz nicht,
 * scrollt alles rechts vom Punkt waagerecht, der Punkt bleibt stehen. Vorher hatte jede Spalte fest 150 px – bei sechs
 * Spalten brach der Punkt Wort für Wort um, und Zeilen mit schmalerem Punkt verrutschten.
 *
 * Die Kinder (Zeilen, Bänder, Linien) sind **direkte Kinder des Rasters** – Bänder spannen über alle Spalten. Was zu
 * den Zeilen gehört (`AblaufListe.module.scss`: `.flowRow`, `.punktZelle`, `.infoZelle` …), steht dort.
 */
import type { ReactNode } from 'react';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { infoText, tabellenRaster, useSpaltenSicht, type SpaltenSicht } from './infoTabellenRegeln';
import styles from './AblaufListe.module.scss';

export function InfoTabelle({
  infos,
  zeilen,
  vorKopf,
  rahmenKlasse,
  children,
}: {
  /** Die Gruppen – je eine Spalte. */
  infos: readonly InfoGruppe[];
  /** Die sichtbaren Zeilen: danach richten sich Breiten und die Zahlen im Kopf. */
  zeilen: readonly Pick<AblaufZeile, 'infos'>[];
  /** Steht im Raster vor der Kopfzeile (Ansicht: Hinweis „Ablauf geändert“). */
  vorKopf?: ReactNode;
  /** Eine Klasse am äußeren Rahmen (Bearbeiten: Platz unten für das schwebende Plus). */
  rahmenKlasse?: string;
  /** Die Zeilen – mit der Messung der Spalten, damit eine Zeile verdeckte Spalten anzeigen kann. */
  children: (sicht: SpaltenSicht) => ReactNode;
}) {
  const sicht = useSpaltenSicht(infos.length);
  return (
    <div className={`${styles.tabelleRahmen}${rahmenKlasse ? ` ${rahmenKlasse}` : ''}`}>
      <div className={styles.tabelleScroll} ref={sicht.rahmenRef} onScroll={sicht.messen}>
        <div
          className={`${styles.flowList} ${styles.tabelle}`}
          style={tabellenRaster(infos, zeilen)}
        >
          {vorKopf}
          <div className={styles.infoKopf}>
            {/* „Eintrag“ wie beim Hinzufügen und im Termin-Blatt (Alwin 05.11.2026), nicht mehr „Punkt“. */}
            <span className={`${styles.infoKopfPunkt} ${styles.punktZelle}`}>Eintrag</span>
            {infos.map((g, i) => {
              const n = zeilen.filter((z) => infoText(z, g.id)).length;
              return (
                <span key={g.id} ref={sicht.kopfRef(i, g.id)} className={styles.infoKopfZelle}>
                  {g.name}
                  {n > 0 && <span className={styles.infoKopfZahl}> · {n}</span>}
                </span>
              );
            })}
          </div>
          {children(sicht)}
        </div>
      </div>
      {sicht.rechtsMehr && (
        <span className={styles.weiterRechts} aria-hidden="true">
          ›
        </span>
      )}
    </div>
  );
}
