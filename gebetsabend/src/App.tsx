import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { einrichtungsStand } from '@shared/gebetsabend/einrichten';
import { ladeStart, type Start } from './start';
import { Einrichtung } from './Einrichtung';
import { NaechsterTermin } from './TerminKarte';
import { Zuhoeren } from './Zuhoeren';
import styles from './App.module.scss';

/**
 * Der Gebetsabend in ChurchTools (Bauplan Gebetsabend G1/G2): Ist er eingerichtet, stehen der nächste Termin und
 * „Zuhören“ da; sonst der Stand der Einrichtung. Die Technik (G3) kommt dazu. Scheitert das Laden vorübergehend, gibt
 * es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (s) => {
        setStart(s);
        setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, []);

  useEffect(laden, [laden]);

  const zugang = start?.einrichtung.zugang ?? null;
  const fertig =
    start &&
    zugang !== null &&
    einrichtungsStand(start.einrichtung, start.darfAnlegen) === 'fertig';
  return (
    <ErweiterungsSeite app="Gebetsabend" zustand={zustand} onNochmal={laden}>
      {start && !fertig && <Einrichtung start={start} onEingerichtet={laden} />}
      {start && fertig && zugang !== null && (
        <div className={styles.spalte}>
          <NaechsterTermin modul={start.modul} kategorie={start.einrichtung.einstellungen} />
          <Zuhoeren modul={start.modul} kategorie={zugang} name={start.name} />
          {start.technik && (
            <p className={styles.hinweis}>
              Du gehörst zur Technik. Übertragen kommt mit dem nächsten Update.
            </p>
          )}
        </div>
      )}
    </ErweiterungsSeite>
  );
}
