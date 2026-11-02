import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { DateiZeile } from '@ui/dateien/DateiZeile';
import { terminDateiAnzeige } from '@ui/dateien/terminDatei';
import { ctBasis } from '@ui/ct/verbindung';
import { dateiAdresse, type TerminDatei } from '@shared/ct/terminDateien';
import { ladeDateien } from './ladeTerminDateien';
import styles from './InfosFenster.module.scss';

/**
 * **Die Dateien eines Termins** (Scheibe T2a, Entwurf `termin-einstellungen.html` Variante B, Alwin 02.11.2026): das
 * Fenster hinter der Büroklammer. Sofort steht da, was der Plan kennt (ohne Größe); dann kommt die frische Liste aus
 * ChurchTools mit Größe und geht über `onAktuell` zurück – so stimmt danach auch die Zahl an der Büroklammer. Klappt das
 * Nachladen nicht, bleibt die bekannte Liste stehen: Ein Aussetzer von ChurchTools darf keine Dateien „verschwinden“
 * lassen. Antippen öffnet die Datei aus ChurchTools (`dateiAdresse`). Hochladen, Umbenennen und Löschen folgen in T2b.
 */
export function DateienFenster({
  fuer,
  terminId,
  dateien,
  onAktuell,
  onClose,
  laden = ladeDateien,
}: {
  /** „Gottesdienst · So, 08.11.2026“ – steht über der Liste. */
  fuer: string;
  terminId: number;
  /** Was der Plan kennt – steht da, bis die frische Liste kommt. */
  dateien: readonly TerminDatei[];
  onAktuell: (dateien: TerminDatei[]) => void;
  onClose: () => void;
  /** Nur für Tests. */
  laden?: typeof ladeDateien;
}) {
  const [liste, setListe] = useState<readonly TerminDatei[]>(dateien);
  const [fehler, setFehler] = useState(false);
  // Der Rückruf ändert sich mit jedem Zeichnen der Eltern – nachgeladen wird trotzdem nur einmal je Termin.
  const melden = useRef(onAktuell);
  melden.current = onAktuell;

  useEffect(() => {
    let aktuell = true;
    laden(terminId).then(
      (frisch) => {
        if (!aktuell) return;
        setListe(frisch);
        melden.current(frisch);
      },
      () => aktuell && setFehler(true),
    );
    return () => {
      aktuell = false;
    };
  }, [terminId, laden]);

  const basis = ctBasis();
  return (
    <Sheet title="Dateien" onClose={onClose} knoepfe={null}>
      <p className={styles.fuer}>{fuer}</p>
      {liste.length === 0 ? (
        <p className={styles.leer}>An diesem Termin hängen keine Dateien.</p>
      ) : (
        <ul className={styles.dateiListe}>
          {liste.map((d) => {
            const a = terminDateiAnzeige(d);
            return (
              <li key={d.id}>
                <DateiZeile
                  href={dateiAdresse(d, basis)}
                  symbol={a.symbol}
                  titel={d.name}
                  unter={a.unter}
                />
              </li>
            );
          })}
        </ul>
      )}
      {fehler && (
        <p className={styles.hinweis} role="status">
          Die aktuelle Liste ließ sich gerade nicht laden – das ist der zuletzt bekannte Stand.
        </p>
      )}
    </Sheet>
  );
}
