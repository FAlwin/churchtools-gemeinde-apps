import { useRef } from 'react';
import { Icon } from '@ui/icons/icons';
import { useLinkKopieren } from './useLinkKopieren';
import s from './Startseite.module.scss';
import l from './AnmeldeLink.module.scss';

/**
 * **Der Anmeldelink einer freigegebenen Veranstaltung** (Alwin, 14.10.2026, Entwurf `link-kopieren-v2`: „B –
 * bitte mit einheitlichen Buttons“). Vorher stand der Link nur im Termin-Fenster – nach dem Freigeben fand man
 * ihn nicht. Jetzt oben auf der Seite: als Text, dazu drei gleiche Knöpfe Kopieren · Öffnen · Teilen.
 *
 * - **Kopieren:** danach kurz „Kopiert ✓“. Lässt der Browser es nicht zu, ist der Link markiert und kann von
 *   Hand kopiert werden (wie `LinkKopieren` im Termin-Fenster).
 * - **Öffnen:** das Formular in einem neuen Tab – zum Selbst-Ausprobieren.
 * - **Teilen:** das Teilen-Menü des Geräts (am Handy WhatsApp, Mail …). Gibt es das nicht (manche Browser am
 *   Computer), fehlt der Knopf.
 */
export function AnmeldeLinkKarte({ link, titel }: { link: string; titel: string }) {
  const feld = useRef<HTMLInputElement>(null);
  const { stand, kopieren } = useLinkKopieren(link, feld);
  const teilenGeht = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Abbrechen im Teilen-Menü wirft `AbortError` – kein Fehler, also still.
  const teilen = () => void navigator.share({ title: titel, url: link }).catch(() => undefined);

  return (
    <section className={s.karte} aria-label="Anmeldelink">
      <div className={s.kopf}>
        <h2>Anmeldelink</h2>
      </div>
      <div className={l.zeile}>
        <input
          ref={feld}
          className={l.link}
          readOnly
          value={link}
          aria-label="Anmeldelink"
          onFocus={(e) => e.target.select()}
        />
        <div className={l.knoepfe}>
          <button
            type="button"
            className={stand === 'kopiert' ? `${l.knopf} ${l.ok}` : l.knopf}
            onClick={() => void kopieren()}
          >
            <Icon name={stand === 'kopiert' ? 'check' : 'link'} size={15} />
            {stand === 'kopiert' ? 'Kopiert' : 'Kopieren'}
          </button>
          <a className={l.knopf} href={link} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={15} />
            Öffnen
          </a>
          {teilenGeht && (
            <button type="button" className={l.knopf} onClick={teilen}>
              <Icon name="share" size={15} />
              Teilen
            </button>
          )}
        </div>
      </div>
      <p className={l.hinweis}>
        {stand === 'vonHand'
          ? 'Kopieren hat nicht geklappt – der Link ist markiert, bitte von Hand kopieren.'
          : 'Diesen Link verschickst du an alle, die sich anmelden sollen – Gäste brauchen kein ChurchTools.'}
      </p>
    </section>
  );
}
