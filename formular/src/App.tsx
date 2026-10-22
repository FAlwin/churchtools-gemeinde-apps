import { heuteImKalender } from '@shared/ct/zeit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnmeldeFormular } from '@ui/anmeldeformular/AnmeldeFormular';
import {
  LADE_FEHLER_TEXT,
  abmeldeOrtAusLink,
  ortAusLink,
  type LadeFehler,
} from '@shared/anmeldung/oeffentlich';
import { AbmeldeSeite } from './AbmeldeSeite';
import { LadeProblem, ladeVeranstaltung, type Geladen } from './laden';
import { abschicken, platzStand } from './senden';
import s from './App.module.scss';

/**
 * **Das öffentliche Anmeldeformular** (A6-1, #542) – eine Seite für alle Gemeinden. Der Link sagt, welche
 * Instanz und welche Gruppe (`…/#test-ecg-donrath.church.tools/165`, gebaut von `anmeldeLink`). Gezeigt wird
 * dasselbe Formular wie im Baukasten (`ui/anmeldeformular`).
 *
 * **A6-2:** Abschicken meldet wirklich bei ChurchTools an (`senden.ts`). Mit `?probe` in der Adresse („Extern
 * öffnen und testen“) bleibt es ein Trockenlauf und schickt nichts.
 *
 * **A6-4:** `…/abmelden/<schlüssel>` (der Link „Austreten“ aus der Mail) öffnet „Deine Anmeldung“ (`AbmeldeSeite`).
 */

type Stand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: LadeFehler }
  | { art: 'fertig'; daten: Geladen };

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const abmelden = useMemo(() => abmeldeOrtAusLink(hash), [hash]);
  const [stand, setStand] = useState<Stand>({ art: 'laedt' });

  useEffect(() => {
    const neu = () => setHash(window.location.hash);
    window.addEventListener('hashchange', neu);
    return () => window.removeEventListener('hashchange', neu);
  }, []);

  const laden = useCallback(() => {
    if (abmeldeOrtAusLink(hash)) return () => {};
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

  useEffect(laden, [laden]);

  useEffect(() => {
    if (stand.art === 'fertig') document.title = `Anmeldung: ${stand.daten.veranstaltung.name}`;
  }, [stand]);

  if (abmelden) return <AbmeldeSeite key={hash} ort={abmelden} />;

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
  const ort = ortAusLink(hash)!;
  const probe = new URLSearchParams(window.location.search).has('probe');
  const heute = heuteImKalender();
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
          warteliste: v.warteliste,
        }}
        heute={heute}
        probe={probe}
        plaetzeNachfragen={() => platzStand(ort)}
        onAbsenden={({ antworten, wahl, nur, nr }) =>
          abschicken(
            ort,
            v.einstellungen,
            antworten,
            wahl,
            heute,
            `${window.location.origin}${window.location.pathname}`,
            { nur, nr },
          )
        }
      />
    </>
  );
}
