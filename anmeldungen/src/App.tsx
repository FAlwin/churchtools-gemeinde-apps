import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagAusIso } from '@shared/ct/zeit';
import { ladeStart } from './start';
import { ladeUebersicht } from './veranstaltungen';
import { anlegenMoeglich } from './einrichten';
import { datumText } from './anzeige';
import { Startseite } from './Startseite';
import { VeranstaltungSeite } from './VeranstaltungSeite';
import { NeueVeranstaltung } from './NeueVeranstaltung';
import { fehlerZustand, type Zustand } from './zustand';
import styles from './App.module.scss';
import s from './Startseite.module.scss';

/**
 * Die Anmeldungen in ChurchTools: Wer angemeldet ist, seine Gruppen (#474, A1), deren Veranstaltungen
 * (#480, A2) und das Anlegen und Einrichten (#486, A3). Erst Person und Gruppen, dann Veranstaltungen und
 * Anlege-Rechte – scheitert eines vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 *
 * Welche Seite offen ist, steht in der Adresse (`#/v/91` = Veranstaltung 91), damit Neuladen und der
 * Zurück-Knopf des Browsers funktionieren.
 */
function idAusAdresse(): number | null {
  const m = /^#\/v\/(\d+)$/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [offen, setOffen] = useState<number | null>(idAusAdresse);
  const [neu, setNeu] = useState(false);
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const heute = tagAusIso(new Date().toISOString(), zeitzone);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart()
      .then(async (start) => {
        const teamIds = start.gruppen.map((g) => g.id);
        const [uebersicht, anlegen] = await Promise.all([
          ladeUebersicht(start.gruppen),
          anlegenMoeglich(teamIds),
        ]);
        return { start, uebersicht, anlegen };
      })
      .then(
        (d) => setZustand({ art: 'fertig', ...d }),
        (e: unknown) => setZustand(fehlerZustand(e)),
      );
  }, []);

  useEffect(laden, [laden]);

  useEffect(() => {
    const folgen = () => setOffen(idAusAdresse());
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const oeffnen = (id: number) => {
    window.location.hash = `#/v/${id}`;
  };
  const zurUebersicht = () => {
    window.location.hash = '';
    laden();
  };

  if (offen !== null) {
    return (
      <main className={styles.seite}>
        <VeranstaltungSeite id={offen} zeitzone={zeitzone} onZurueck={zurUebersicht} />
        <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
      </main>
    );
  }

  const fertig = zustand.art === 'fertig' ? zustand : null;
  const anlegeTeams = fertig
    ? fertig.start.gruppen.filter((g) => fertig.anlegen.teamIds.includes(g.id))
    : [];

  return (
    <main className={styles.seite}>
      <header className={styles.kopf}>
        <p className={styles.app}>
          Anmeldungen
          {fertig?.start.gemeinde && ` · ${fertig.start.gemeinde}`}
        </p>
        {fertig && (
          <div className={styles.kopfzeile}>
            <div className={styles.gruss}>
              <h1>{fertig.start.vorname ? `Hallo ${fertig.start.vorname}` : 'Hallo'}</h1>
              <span>{datumText(heute)}</span>
            </div>
            {anlegeTeams.length > 0 && (
              <button type="button" className={s.neu} onClick={() => setNeu(true)}>
                <Icon name="plus" size={18} />
                Neue Veranstaltung
              </button>
            )}
          </div>
        )}
      </header>

      {fertig && fertig.anlegen.artId === null && (
        <p className={styles.hinweis}>
          In dieser Gemeinde fehlt die Gruppenart „Anmeldung“ – ohne sie lassen sich keine
          Veranstaltungen anlegen. Wie man sie einrichtet, steht in der Anleitung der Erweiterung.
        </p>
      )}

      {zustand.art === 'laedt' && <p className={styles.hinweis}>Wird geladen …</p>}

      {zustand.art === 'fehler' && (
        <div className={styles.fehler} role="alert">
          <p>{zustand.text}</p>
          {zustand.nochmal && (
            <button type="button" className={styles.knopf} onClick={laden}>
              Erneut versuchen
            </button>
          )}
        </div>
      )}

      {fertig && (
        <Startseite
          start={fertig.start}
          uebersicht={fertig.uebersicht}
          heute={heute}
          zeitzone={zeitzone}
          onOeffnen={oeffnen}
        />
      )}

      {neu && fertig && fertig.anlegen.artId !== null && (
        <NeueVeranstaltung
          teams={anlegeTeams}
          artId={fertig.anlegen.artId}
          onClose={() => setNeu(false)}
          onFertig={(id) => {
            setNeu(false);
            oeffnen(id);
          }}
        />
      )}

      <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
    </main>
  );
}
