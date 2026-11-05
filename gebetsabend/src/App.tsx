import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { einrichtungsStand } from '@shared/gebetsabend/einrichten';
import { ladeStart, type Start } from './start';
import { Einrichtung } from './Einrichtung';
import { NaechsterTermin } from './TerminKarte';
import { Technik } from './Technik';
import { EinstellungenFenster } from './EinstellungenFenster';
import type { Zugang } from '@shared/gebetsabend/zugang';
import { Zuhoeren } from './Zuhoeren';
import styles from './App.module.scss';

/**
 * Der Gebetsabend in ChurchTools (Bauplan Gebetsabend G1–G3): Ist er eingerichtet, stehen der nächste Termin und
 * „Zuhören“ da, für die Technik obendrüber „Übertragung“; sonst der Stand der Einrichtung. Scheitert das Laden
 * vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 *
 * Ob DIESES Gerät sendet (`gesendet`), weiß nur die Seite – Technik und Zuhören brauchen es beide (kein Zuhören auf
 * dem Sender-Gerät).
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [gesendet, setGesendet] = useState<Zugang | null>(null);
  /** Zählt hoch, wenn die Technik etwas gespeichert hat – Zuhören und Termin fragen dann sofort nach. */
  const [zugangNeu, setZugangNeu] = useState(0);
  const [einstellungenNeu, setEinstellungenNeu] = useState(0);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);

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
          {start.technik && (
            <Technik
              start={start}
              kategorie={zugang}
              gesendet={gesendet}
              onGesendet={setGesendet}
              onGeaendert={() => setZugangNeu((n) => n + 1)}
              onEinstellungen={
                start.einstellungenAendern && start.einrichtung.einstellungen !== null
                  ? () => setEinstellungenOffen(true)
                  : undefined
              }
            />
          )}
          <NaechsterTermin
            modul={start.modul}
            kategorie={start.einrichtung.einstellungen}
            aktualisiert={einstellungenNeu}
          />
          <Zuhoeren
            modul={start.modul}
            kategorie={zugang}
            name={start.name}
            sendetHier={gesendet !== null}
            aktualisiert={zugangNeu}
          />
          {einstellungenOffen && start.einrichtung.einstellungen !== null && (
            <EinstellungenFenster
              start={start}
              kategorie={start.einrichtung.einstellungen}
              onGespeichert={() => setEinstellungenNeu((n) => n + 1)}
              onSchliessen={() => setEinstellungenOffen(false)}
            />
          )}
        </div>
      )}
    </ErweiterungsSeite>
  );
}
