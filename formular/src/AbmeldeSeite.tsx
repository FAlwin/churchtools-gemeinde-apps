import { useCallback, useEffect, useState } from 'react';
import { DeineAnmeldung } from '@ui/anmeldeformular/DeineAnmeldung';
import { LADE_FEHLER_TEXT, type AbmeldeOrt, type LadeFehler } from '@shared/anmeldung/oeffentlich';
import { anmeldeLink } from '@shared/anmeldung/termin';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { LadeProblem, ladeAbmeldung, type AbmeldungGeladen } from './laden';
import { absagen } from './senden';
import s from './App.module.scss';

type Stand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: LadeFehler }
  | { art: 'fertig'; daten: AbmeldungGeladen };

/**
 * **„Deine Anmeldung“ im öffentlichen Formular** (A6-4) – geöffnet über „Austreten“ in der Mail von ChurchTools
 * (`…/#<instanz>/<gruppe>/abmelden/<schlüssel>`, gebaut von `abmeldeVorlage`). Ist die Veranstaltung selbst nicht
 * mehr lesbar, zeigt die Seite sie schlicht (Standard-Gestaltung) – absagen geht trotzdem.
 */
export function AbmeldeSeite({ ort }: { ort: AbmeldeOrt }) {
  const [stand, setStand] = useState<Stand>({ art: 'laedt' });

  const laden = useCallback(() => {
    let aktuell = true;
    setStand({ art: 'laedt' });
    ladeAbmeldung(ort).then(
      (daten) => aktuell && setStand({ art: 'fertig', daten }),
      (e: unknown) =>
        aktuell &&
        setStand({ art: 'fehler', fehler: e instanceof LadeProblem ? e.art : 'voruebergehend' }),
    );
    return () => {
      aktuell = false;
    };
  }, [ort]);

  useEffect(laden, [laden]);

  if (stand.art === 'laedt')
    return (
      <main className={s.mitte} aria-busy="true">
        <p className={s.leise}>Deine Anmeldung wird geladen …</p>
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

  const { abmeldung, veranstaltung: v, gemeinde } = stand.daten;
  const name = v?.name || abmeldung.veranstaltung || 'Deine Anmeldung';
  document.title = `Deine Anmeldung: ${name}`;
  return (
    <DeineAnmeldung
      ansicht={{
        name,
        gemeinde,
        einstellungen: v?.einstellungen ?? neueEinstellungen('einfach'),
        bildUrl: v?.bildUrl,
      }}
      daten={abmeldung}
      formularLink={anmeldeLink(
        `${window.location.origin}${window.location.pathname}`,
        `https://${ort.instanz}/`,
        ort.gruppeId,
      )}
      onAbsagen={(personId) => absagen(ort, personId)}
    />
  );
}
