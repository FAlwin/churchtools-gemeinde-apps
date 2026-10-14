import { useEffect, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { ZEITRAUM_ZU } from '@shared/anmeldung/vorbereiten';
import { anmeldeBedingungen } from './einrichten';
import { useLinkKopieren } from './useLinkKopieren';
import s from './Startseite.module.scss';
import l from './AnmeldeLink.module.scss';

/** Was die Prüfung wie ein Gast ergab: noch offen, was fehlt (leer = alles da), oder nicht prüfbar. */
type Pruefung = { art: 'prueft' } | { art: 'fertig'; fehlt: string[] } | { art: 'unbekannt' };

/**
 * **Der Anmeldelink einer freigegebenen Veranstaltung** (Alwin, 14.10.2026, Entwurf `link-kopieren-v2`: „B –
 * bitte mit einheitlichen Buttons“). Vorher stand der Link nur im Termin-Fenster – nach dem Freigeben fand man
 * ihn nicht. Jetzt oben auf der Seite: als Text, dazu drei gleiche Knöpfe Kopieren · Öffnen · Teilen.
 *
 * **Erst prüfen, dann zeigen** (Alwin, 15.10.2026, „Warnung statt Link“): Vor A6-2 freigegebene Veranstaltungen
 * stehen auf „Freigegeben“, sind für Gäste aber gesperrt – der Link führte zu „nicht geöffnet“. Die Karte fragt
 * deshalb wie ein Gast bei ChurchTools nach (`anmeldeBedingungen`). Fehlt etwas, steht statt des Links, was fehlt,
 * und „Jetzt einrichten“ öffnet das Freigeben-Fenster (Leitung, Vorgaben, öffentlich). Fehlt nur der laufende
 * Zeitraum, gilt der Link später – er bleibt, mit Hinweis. Lässt sich nicht prüfen (Netz, 5xx), bleibt der Link
 * ebenfalls: Ein Aussetzer darf ihn nicht verstecken.
 *
 * - **Kopieren:** danach kurz „Kopiert“. Lässt der Browser es nicht zu, ist der Link markiert und kann von
 *   Hand kopiert werden (`useLinkKopieren`, wie im Termin-Fenster).
 * - **Öffnen:** das Formular in einem neuen Tab – zum Selbst-Ausprobieren.
 * - **Teilen:** das Teilen-Menü des Geräts (am Handy WhatsApp, Mail …). Gibt es das nicht (manche Browser am
 *   Computer), fehlt der Knopf.
 */
export function AnmeldeLinkKarte({
  id,
  link,
  titel,
  stand,
  onEinrichten,
}: {
  id: number;
  link: string;
  titel: string;
  /** Ändert sich nach jedem Neuladen der Seite – dann wird neu geprüft (z. B. nach „Jetzt einrichten“). */
  stand: unknown;
  /** Öffnet das Freigeben-Fenster; fehlt ohne Recht zum Einrichten. */
  onEinrichten?: () => void;
}) {
  const [pruefung, setPruefung] = useState<Pruefung>({ art: 'prueft' });

  useEffect(() => {
    let aktuell = true;
    setPruefung({ art: 'prueft' });
    anmeldeBedingungen(id).then(
      (fehlt) => aktuell && setPruefung({ art: 'fertig', fehlt }),
      () => aktuell && setPruefung({ art: 'unbekannt' }),
    );
    return () => {
      aktuell = false;
    };
  }, [id, stand]);

  const nurZeitraum =
    pruefung.art === 'fertig' && pruefung.fehlt.length === 1 && pruefung.fehlt[0] === ZEITRAUM_ZU;
  const gesperrt = pruefung.art === 'fertig' && pruefung.fehlt.length > 0 && !nurZeitraum;

  return (
    <section className={s.karte} aria-label="Anmeldelink">
      <div className={s.kopf}>
        <h2>Anmeldelink</h2>
      </div>
      {pruefung.art === 'prueft' && <p className={l.hinweis}>Wird geprüft …</p>}
      {gesperrt && (
        <div className={l.warnung} role="alert">
          <p>ChurchTools nimmt noch keine Anmeldungen an – der Link würde nicht funktionieren:</p>
          <ul>
            {pruefung.fehlt.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {onEinrichten ? (
            <button type="button" className={l.knopf} onClick={onEinrichten}>
              <Icon name="zahnrad" size={14} />
              Jetzt einrichten
            </button>
          ) : (
            <p>Einrichten kann die Leitung der Gruppe.</p>
          )}
        </div>
      )}
      {(pruefung.art === 'unbekannt' || (pruefung.art === 'fertig' && !gesperrt)) && (
        <LinkZeile
          link={link}
          titel={titel}
          hinweis={
            nurZeitraum
              ? 'Der Anmeldezeitraum läuft noch nicht – der Link funktioniert, sobald er beginnt.'
              : pruefung.art === 'unbekannt'
                ? 'Ob ChurchTools Anmeldungen annimmt, ließ sich gerade nicht prüfen.'
                : null
          }
        />
      )}
    </section>
  );
}

function LinkZeile({
  link,
  titel,
  hinweis,
}: {
  link: string;
  titel: string;
  hinweis: string | null;
}) {
  const feld = useRef<HTMLInputElement>(null);
  const { stand, kopieren } = useLinkKopieren(link, feld);
  const teilenGeht = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Abbrechen im Teilen-Menü wirft `AbortError` – kein Fehler, also still.
  const teilen = () => void navigator.share({ title: titel, url: link }).catch(() => undefined);

  return (
    <>
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
          : (hinweis ??
            'Diesen Link verschickst du an alle, die sich anmelden sollen – Gäste brauchen kein ChurchTools.')}
      </p>
    </>
  );
}
