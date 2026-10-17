import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import { euroText } from '@shared/anmeldung/preis';
import type { Betragsbefund, Nachpruefung } from '@shared/anmeldung/nachpruefung';
import { datumText } from './anzeige';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';

export type NachpruefungStand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; n: Nachpruefung };

const betrag = (cent: number | null) => (cent === null ? 'nichts' : euroText(cent));

function BetragsZeile({ b }: { b: Betragsbefund }) {
  const grund =
    b.grund === 'nachgerueckt' ? (
      <span className={v.pruefInfo}>
        {b.nachgerueckt!.join(', ')} {b.nachgerueckt!.length === 1 ? 'ist' : 'sind'} nachgerückt
      </span>
    ) : b.grund === 'preise' ? (
      <span>
        Preise am {datumText(b.preiseGeaendert!)} geändert – nach der Anmeldung (
        {datumText(b.angemeldetAm!)}). Der Betrag bleibt, wie er ist.
      </span>
    ) : b.grund === 'weniger' ? (
      <span className={v.pruefInfo}>Weniger als gemeldet – hat jemand abgesagt?</span>
    ) : (
      <span className={v.pruefRot}>Betrag weicht von den Regeln ab – bitte prüfen</span>
    );
  return (
    <li className={v.befund}>
      <div className={v.befundOben}>
        <span>
          <b>{b.name}</b> <span className={v.nr}>{b.nr}</span>
        </span>
        <a
          className={s.link}
          href={`${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${b.personId}/`}
        >
          In ChurchTools
          <Icon name="external" size={13} />
        </a>
      </div>
      <div className={v.befundGrund}>{grund}</div>
      <div className={v.befundBetrag}>
        gemeldet {betrag(b.gemeldetCent)}
        {b.grund === 'nachgerueckt' ? (
          <>
            {' → '}
            <b>jetzt {euroText(b.sollCent)}</b>
          </>
        ) : b.grund === 'preise' ? (
          <> · nach heutigen Preisen {euroText(b.sollCent)}</>
        ) : (
          <>
            {' · nach den Regeln '}
            <b>{euroText(b.sollCent)}</b>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * **Karte „Nachprüfung“** (A6-5c, #623, Entwurf `a6-5c-nachpruefung-v1`) – Plätze, Belegung je Auswahl, Beträge. Ändert
 * nichts. Wo sie steht, entscheidet die Seite (mit Hinweisen oben, sonst unten).
 */
export function NachpruefungKarte({
  stand,
  onNeu,
}: {
  stand: NachpruefungStand;
  onNeu: () => void;
}) {
  const n = stand.art === 'fertig' ? stand.n : null;
  const neu = (
    <button type="button" className={v.bearbeiten} onClick={onNeu} disabled={stand.art === 'laedt'}>
      {stand.art === 'laedt' ? 'Prüft …' : 'Neu prüfen'}
    </button>
  );
  const chip = !n ? null : n.hinweise > 0 ? (
    <span className={s.chip}>{n.hinweise === 1 ? '1 Hinweis' : `${n.hinweise} Hinweise`}</span>
  ) : (
    <span className={`${s.chip} ${s.chipGruen}`}>Alles stimmt ✓</span>
  );

  return (
    <section className={s.karte} aria-label="Nachprüfung">
      <div className={s.kopf}>
        <h2>Nachprüfung {chip}</h2>
        {neu}
      </div>
      {stand.art === 'fehler' && <p className={v.warnung}>{stand.text}</p>}
      {stand.art === 'laedt' && <p className={v.pruefFuss}>Wird geprüft …</p>}
      {n && (
        <>
          <div className={v.pruefTeil}>
            <h3>Plätze</h3>
            <dl className={v.pruefZeilen}>
              <dt>Belegt</dt>
              <dd>
                <b>
                  {n.plaetze.max === null
                    ? n.plaetze.belegt
                    : `${n.plaetze.belegt} von ${n.plaetze.max}`}
                </b>
              </dd>
              <dt>Warteliste</dt>
              <dd className={n.plaetze.wartend ? v.pruefInfo : undefined}>
                {n.plaetze.wartend === 0
                  ? 'niemand wartet'
                  : n.plaetze.wartend === 1
                    ? '1 wartet'
                    : `${n.plaetze.wartend} warten`}
              </dd>
            </dl>
            {n.plaetze.wartenTrotzPlatz && (
              <p className={v.pruefHinweis}>
                {n.plaetze.max === null
                  ? 'Es ist Platz frei'
                  : `${n.plaetze.max - n.plaetze.belegt === 1 ? '1 Platz ist' : `${n.plaetze.max - n.plaetze.belegt} Plätze sind`} frei`}
                , aber {n.plaetze.wartend === 1 ? '1 wartet' : `${n.plaetze.wartend} warten`}.
                ChurchTools lässt niemanden von selbst nachrücken – neue Anmeldungen kommen hinten
                an. Nachrücken lassen: in ChurchTools (bald hier, mit der Liste).
              </p>
            )}
          </div>
          {n.auswahl && (
            <div className={v.pruefTeil}>
              <h3>{n.auswahl.name || 'Auswahl'}</h3>
              <dl className={v.pruefZeilen}>
                {n.auswahl.optionen.map((o) => (
                  <div key={o.name} className={v.pruefZeile}>
                    <dt>{o.name}</dt>
                    <dd className={o.zustand === 'ueberbucht' ? v.pruefRot : undefined}>
                      <b>
                        {o.zustand === 'unbegrenzt' ? o.belegt : `${o.belegt} von ${o.kontingent}`}
                      </b>
                      {o.zustand === 'unbegrenzt'
                        ? ' · unbegrenzt'
                        : o.zustand === 'ausgebucht'
                          ? ' · ausgebucht'
                          : o.zustand === 'ueberbucht'
                            ? ' · überbucht'
                            : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {n.geprueft > 0 && (
            <div className={v.pruefTeil}>
              <h3>Beträge</h3>
              {n.betraege.length === 0 ? (
                <p className={v.pruefGruen}>
                  {n.geprueft === 1 ? 'Der Betrag stimmt.' : `Alle ${n.geprueft} Beträge stimmen.`}
                </p>
              ) : (
                <ul className={v.befunde}>
                  {n.betraege.map((b) => (
                    <BetragsZeile key={b.nr} b={b} />
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className={v.pruefFuss}>
            Geändert wird nichts automatisch – Beträge änderst du in ChurchTools; mit der Liste der
            Anmeldungen geht es später hier.
          </p>
        </>
      )}
    </section>
  );
}
