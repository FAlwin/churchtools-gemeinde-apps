import { useEffect, useMemo, useRef, useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useKopieren } from '@ui/bedienung/useKopieren';
import { ApiError } from '@ui/ct/fehler';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import type { Sommerferien, Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { GruppenSicht, Phase } from '@shared/organigramm/gruppenwechselSicht';
import {
  abweichungText,
  jahrStatus,
  leitungenNachricht,
  tageHinweis,
  wechseltagText,
  type TageStand,
} from '@shared/organigramm/wechseltage';
import { Hinweis } from './KjHinweis';
import { ladeRegelAbgleich, type RegelAbgleich } from './ladeRegelAbgleich';
import styles from './KinderJugend.module.scss';

type AbgleichStand = { art: 'laedt' } | { art: 'da'; abgleich: RegelAbgleich };

/**
 * **Die Seite „Wechseltage“** (Bauplan O9-4, Entwurf `kj-gruppenwechsel-v1`) – nur für Bereichsleitung und Admins:
 * wann die Kinder wechseln und bis wann die Regeln dafür in ChurchTools stehen, die Erinnerung, wenn sie auslaufen,
 * und der Text, den man den Leitungen schickt. Admins sehen zusätzlich, ob die Regeln in ChurchTools zu
 * „eingetragen bis“ passen.
 *
 * Ist „eingetragen bis“ nicht bekannt (erst „Einrichten“ schreibt es), steht in der Tabelle „nicht bekannt“, ein ruhiger
 * Hinweis sagt warum – und es gibt weder Erinnerung noch Abgleich.
 */
export function Wechseltage({
  einrichtung,
  jahr,
  jahre,
  ferien,
  phase,
  sichten,
  admin,
  tage,
  onAbgemeldet,
}: {
  einrichtung: Einrichtung;
  /** Das aktuelle Wechseljahr des Reiters. */
  jahr: Wechseljahr;
  /** Alle Jahre, die der Ferienkalender kennt (auch das vergangene Vorjahr). */
  jahre: readonly Wechseljahr[];
  ferien: readonly Sommerferien[];
  phase: Phase;
  sichten: readonly GruppenSicht[];
  admin: boolean;
  tage: TageStand;
  onAbgemeldet: (e: unknown) => void;
}) {
  const bis = einrichtung.eingetragenBis;
  // Das aktuelle Jahr und alle späteren – ein vergangenes darf aus den Regeln gefallen sein.
  const kuenftig = useMemo(() => jahre.filter((j) => j.jahr >= jahr.jahr), [jahre, jahr]);
  const hinweis = tageHinweis(tage, einrichtung.einstellung.ferienkalender);

  const [abgleich, setAbgleich] = useState<AbgleichStand>({ art: 'laedt' });
  const [abgleichFehler, setAbgleichFehler] = useState(false);
  useEffect(() => {
    // Nur Admins dürfen die Regeln lesen (für alle anderen käme 403), und ohne „eingetragen bis“ gibt es nichts zu vergleichen.
    if (!admin || bis === undefined) return;
    let aktiv = true;
    setAbgleich({ art: 'laedt' });
    setAbgleichFehler(false);
    ladeRegelAbgleich(einrichtung, kuenftig, bis).then(
      (a) => aktiv && setAbgleich({ art: 'da', abgleich: a }),
      (e: unknown) => {
        if (!aktiv) return;
        if (e instanceof ApiError && e.status === 401) onAbgemeldet(e);
        else setAbgleichFehler(true);
      },
    );
    return () => {
      aktiv = false;
    };
  }, [admin, bis, einrichtung, kuenftig, onAbgemeldet]);

  const nachricht = useMemo(() => leitungenNachricht(jahr, sichten), [jahr, sichten]);
  const feld = useRef<HTMLTextAreaElement>(null);
  const { stand, kopieren } = useKopieren(nachricht, feld);

  const ergebnis = admin && bis !== undefined && abgleich.art === 'da' ? abgleich.abgleich : null;

  return (
    <>
      <div className={styles.kopf}>
        <h2>Wechseltage</h2>
        <span className={styles.leise}>nichts zu tun – ChurchTools verschiebt von selbst</span>
      </div>
      <p className={styles.leise}>
        Die Termine stehen für mehrere Jahre im Voraus fest. Am Ankündigungstag kommen die Kinder in
        die Wechsel-Liste, am Wechseltag in die neue Gruppe. Ausnahmen setzen die Leitungen in ihrer
        Gruppe.
      </p>
      {bis === undefined && (
        <Hinweis>
          Bis wann die Wechseltage in ChurchTools stehen, merkt sich die Erweiterung erst, wenn ein
          Admin „Einrichten“ ausgeführt hat. Bis dahin steht hier „nicht bekannt“.
        </Hinweis>
      )}
      {hinweis && (
        <Hinweis gelb>
          <b>{hinweis.titel}</b> {hinweis.text}
        </Hinweis>
      )}
      {ergebnis && ergebnis.abweichungen.length > 0 && bis !== undefined && (
        <Hinweis gelb>{abweichungText(ergebnis.abweichungen, bis)}</Hinweis>
      )}
      {(abgleichFehler || (ergebnis && ergebnis.nichtPruefbar.length > 0)) && (
        <Hinweis>
          Ob die Regeln in ChurchTools zu „eingetragen bis {bis}“ passen, ließ sich gerade nicht
          prüfen
          {ergebnis && ergebnis.nichtPruefbar.length > 0
            ? ` (${ergebnis.nichtPruefbar.join(', ')})`
            : ''}
          . Es wurde nichts verändert.
        </Hinweis>
      )}
      <section className={`${styles.karte} ${styles.rahmen}`} aria-label="Wechseltage je Jahr">
        <table className={styles.tabelle}>
          <thead>
            <tr>
              <th scope="col">Jahr</th>
              <th scope="col">Sommerferien</th>
              <th scope="col">Ankündigung</th>
              <th scope="col">Wechseltag</th>
              <th scope="col">Stichtag</th>
              <th scope="col">In ChurchTools</th>
            </tr>
          </thead>
          <tbody>
            {kuenftig.map((j) => {
              const f = ferien.find((x) => x.jahr === j.jahr);
              const status = jahrStatus(bis, j.jahr);
              return (
                <tr key={j.jahr}>
                  <td>
                    <b>{j.jahr}</b>
                  </td>
                  <td>{f ? `${tagPunkt(f.beginn)} – ${tagPunkt(f.ende)}` : '–'}</td>
                  <td>{tagPunkt(j.ankuendigung)}</td>
                  <td>
                    <b>{wechseltagText(j.wechseltag)}</b>
                  </td>
                  <td>{tagPunkt(j.stichtag)}</td>
                  <td>
                    <span
                      className={`${styles.chip} ${
                        status === 'eingetragen'
                          ? styles.gruen
                          : status === 'fehlt'
                            ? styles.gelb
                            : styles.grau
                      }`}
                    >
                      {status === 'eingetragen'
                        ? 'eingetragen'
                        : status === 'fehlt'
                          ? 'fehlt noch'
                          : 'nicht bekannt'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className={styles.karte} aria-label="Leitungen Bescheid geben">
        <h3 className={styles.abschnitt}>Leitungen Bescheid geben</h3>
        <div className={styles.bescheid}>
          {phase === 'angekuendigt' ? (
            <>
              <p className={styles.leise}>
                ChurchTools schickt dazu keine Mail und keinen Push. Den Text kopieren und z. B. in
                die Leitungsgruppe schicken:
              </p>
              <textarea
                ref={feld}
                className={styles.textkopie}
                readOnly
                aria-label="Text für die Leitungen"
                value={nachricht}
                onFocus={(e) => e.target.select()}
              />
              <div className={styles.knopfzeile}>
                <FensterKnopf
                  art={stand === 'kopiert' ? 'hell' : 'zweit'}
                  onClick={() => void kopieren()}
                >
                  <Icon name={stand === 'kopiert' ? 'check' : 'dokument'} size={15} />
                  {stand === 'kopiert' ? 'Kopiert' : 'Text kopieren'}
                </FensterKnopf>
                <span className={styles.leise} role="status">
                  {stand === 'vonHand' ? 'Markiert – jetzt kopieren' : ''}
                </span>
              </div>
            </>
          ) : phase === 'ruhig' ? (
            <p className={styles.leise}>
              Ab der Ankündigung am {tagPunkt(jahr.ankuendigung)} steht hier ein Text, den du an die
              Leitungen schicken kannst.
            </p>
          ) : (
            <p className={styles.leise}>
              Der Wechsel läuft gerade – die Leitungen brauchen keinen Bescheid mehr.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
