import { useCallback, useEffect, useState } from 'react';
import { AnmeldeFormular } from '@ui/anmeldeformular/AnmeldeFormular';
import { LADE_FEHLER_TEXT, ortAusLink, type LadeFehler } from '@shared/anmeldung/oeffentlich';
import { LadeProblem, ladeVeranstaltung, type Geladen } from './laden';
import s from './App.module.scss';

/**
 * **Das öffentliche Anmeldeformular** (A6-1, #542) – eine Seite für alle Gemeinden. Der Link sagt, welche
 * Instanz und welche Gruppe (`…/#test-ecg-donrath.church.tools/165`, gebaut von `anmeldeLink`). Gezeigt wird
 * dasselbe Formular wie im Baukasten (`ui/anmeldeformular`).
 *
 * **A6-1:** Abschicken ist noch ein Probelauf – es wird nichts an ChurchTools geschickt. Echt anmelden kommt in
 * A6-2.
 */

type Stand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: LadeFehler }
  | { art: 'fertig'; daten: Geladen };

/** Heute im Kalender des Geräts (`YYYY-MM-DD`) – für das Alter am Stichtag und das Löschdatum. */
function heuteLokal(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [stand, setStand] = useState<Stand>({ art: 'laedt' });

  useEffect(() => {
    const neu = () => setHash(window.location.hash);
    window.addEventListener('hashchange', neu);
    return () => window.removeEventListener('hashchange', neu);
  }, []);

  const laden = useCallback(() => {
    const ort = ortAusLink(hash);
    if (!ort) {
      setStand({ art: 'fehler', fehler: 'link' });
      return () => {};
    }
    let aktuell = true;
    setStand({ art: 'laedt' });
    ladeVeranstaltung(ort).then(
      (daten) => aktuell && setStand({ art: 'fertig', daten }),
      (e: unknown) =>
        aktuell &&
        setStand({
          art: 'fehler',
          fehler: e instanceof LadeProblem ? e.art : 'voruebergehend',
        }),
    );
    return () => {
      aktuell = false;
    };
  }, [hash]);

  useEffect(() => laden(), [laden]);

  useEffect(() => {
    if (stand.art === 'fertig') document.title = `Anmeldung: ${stand.daten.veranstaltung.name}`;
  }, [stand]);

  if (stand.art === 'laedt')
    return (
      <main className={s.mitte} aria-busy="true">
        <p className={s.leise}>Anmeldung wird geladen …</p>
      </main>
    );

  if (stand.art === 'fehler') {
    const t = LADE_FEHLER_TEXT[stand.fehler];
    return (
      <main className={s.mitte}>
        <div className={s.karte} role="alert">
          <h1>{t.titel}</h1>
          <p>{t.text}</p>
          {t.nochmal && (
            <button type="button" className={s.knopf} onClick={() => laden()}>
              Noch einmal versuchen
            </button>
          )}
        </div>
      </main>
    );
  }

  const v = stand.daten.veranstaltung;
  return (
    <>
      {!v.offen && (
        <p className={s.zu} role="status">
          Zu dieser Veranstaltung kann man sich gerade nicht anmelden.
        </p>
      )}
      <AnmeldeFormular
        ansicht={{
          name: v.name,
          gemeinde: stand.daten.gemeinde,
          einstellungen: v.einstellungen,
          bildUrl: v.bildUrl,
          freiePlaetze: v.freiePlaetze,
        }}
        heute={heuteLokal()}
        probe
      />
    </>
  );
}
