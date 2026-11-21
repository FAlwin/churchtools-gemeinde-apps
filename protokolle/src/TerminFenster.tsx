import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { datumText } from '@shared/ct/datum';
import { punktBeschriftung } from '@shared/protokolle/dokument';
import {
  aehnlicherTermin,
  eintragFehler,
  eintragVorbelegung,
  terminZeitText,
  type Eintrag,
  type TerminZeile,
} from '@shared/protokolle/termine';
import type { TerminStand } from '@shared/protokolle/terminStand';
import { kalenderTermineAmTag } from './terminAnlegen';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { ladeSchreibKalender } from './kalenderListe';
import type { MitarbeitOrt } from './mitarbeitWerte';
import felder from './Fensterfelder.module.scss';
import styles from './TerminFenster.module.scss';

/**
 * **Fenster „In Kalender eintragen“** (W14, Entwurf `termine-reiter-w14-v1`): Kalender (nur die, in die man Termine
 * anlegen darf; vorausgewählt der Kalender der Gruppe), Titel ohne Uhrzeit, Datum, „Ganztägig“ oder Von–Bis (aus dem Text
 * gelesen), Ort. Steht am Tag im gewählten Kalender schon ein ähnlicher Termin, ist **„Nur verknüpfen – nichts Neues
 * anlegen“** vorgewählt. Es geht keine Einladung raus.
 *
 * Nach dem Anlegen kommt der Vermerk „im Kalender“. Scheitert nur der Vermerk, steht der Termin trotzdem – dann bleibt
 * das Fenster mit „Nochmal vermerken“ offen (wiederholt nur den Vermerk, legt nichts doppelt an).
 */
export function TerminFenster({
  zeile,
  gruppenKalender,
  schreibbar,
  ort,
  ich,
  zeitzone,
  onFertig,
  onClose,
}: {
  zeile: TerminZeile;
  /** Der Kalender, den die Gruppe für ihre Sitzungen nutzt – vorausgewählt, wenn man dort eintragen darf. */
  gruppenKalender: number | null;
  /** Kalender mit dem Recht „Termine anlegen“. */
  schreibbar: readonly number[];
  /** Wo der Vermerk gespeichert wird („Mitarbeit“ der Gruppe). */
  ort: MitarbeitOrt;
  ich: number;
  zeitzone: string;
  /** Eingetragen und vermerkt – das Fenster geht zu, die Liste zeigt den neuen Stand. */
  onFertig: (stand: TerminStand) => void;
  onClose: () => void;
}) {
  const kalender = useLaden(() => ladeSchreibKalender(schreibbar), [schreibbar]);
  const liste = kalender.stand.art === 'fertig' ? kalender.stand.daten : [];
  const [e, setE] = useState<Eintrag>(() =>
    eintragVorbelegung(
      zeile,
      gruppenKalender !== null && schreibbar.includes(gruppenKalender) ? gruppenKalender : null,
    ),
  );
  // Ohne Wahl des Nutzers: der Kalender der Gruppe, sonst der erste, in den man darf.
  const kalenderId = e.kalender ?? liste[0]?.id ?? null;
  const eintrag: Eintrag = { ...e, kalender: kalenderId };
  const kalenderName = liste.find((k) => k.id === kalenderId)?.name ?? '';

  // Was am Tag im gewählten Kalender schon steht – für „Nur verknüpfen“.
  const tagTermine = useLaden(
    () => (kalenderId === null || !e.tag ? null : kalenderTermineAmTag(kalenderId, e.tag)),
    [kalenderId, e.tag],
  );
  const treffer = useMemo(
    () =>
      tagTermine.stand.art === 'fertig' ? aehnlicherTermin(e.titel, tagTermine.stand.daten) : null,
    [tagTermine.stand, e.titel],
  );
  const [trotzdem, setTrotzdem] = useState(false);
  const verknuepfen = treffer && !trotzdem ? treffer : null;

  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  // Der Termin steht in ChurchTools, der Vermerk fehlt noch.
  const [offen, setOffen] = useState<{ id: number; zeit: string } | null>(null);

  const setze = <K extends keyof Eintrag>(k: K, v: Eintrag[K]) => setE({ ...e, [k]: v });
  const problem = eintragFehler(eintrag);
  const prueft = kalenderId !== null && tagTermine.stand.art === 'laedt';
  const bereit = !problem && !prueft && tagTermine.stand.art === 'fertig' && !laeuft;

  const vermerken = async (r: { id: number; zeit: string }) => {
    if (kalenderId === null) return;
    try {
      const stand = await terminVermerken(
        ort,
        { gruppe: zeile.gruppe.id, sitzung: zeile.sitzung.id, block: zeile.blockId },
        { kalender: kalenderId, id: r.id, name: kalenderName, zeit: r.zeit },
        ich,
        new Date().toISOString(),
      );
      onFertig(stand);
    } catch (x) {
      setOffen(r);
      setFehler(fehlerMeldung(x));
      setLaeuft(false);
    }
  };

  const eintragen = async () => {
    if (!bereit || kalenderId === null) return;
    setLaeuft(true);
    setFehler(null);
    let r: { art: 'angelegt' | 'verknuepft'; id: number };
    try {
      r = await terminLegen({
        eintrag: { ...eintrag, kalender: kalenderId },
        zeitzone,
        verknuepfen,
      });
    } catch (x) {
      setFehler(fehlerMeldung(x));
      setLaeuft(false);
      return;
    }
    const zeit = verknuepfen
      ? terminZeitText(verknuepfen.beginn, zeitzone)
      : eintrag.ganztaegig
        ? 'ganztägig'
        : `${eintrag.von} Uhr`;
    await vermerken({ id: r.id, zeit });
  };

  const meldung =
    fehler ??
    (kalender.stand.art === 'fehler' ? kalender.stand.fehler : null) ??
    (tagTermine.stand.art === 'fehler' ? tagTermine.stand.fehler : null);

  return (
    <Sheet
      title="In Kalender eintragen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        offen ? (
          <FensterKnopf
            disabled={laeuft}
            onClick={() => {
              setLaeuft(true);
              setFehler(null);
              void vermerken(offen);
            }}
          >
            {laeuft ? 'Wird vermerkt …' : 'Nochmal vermerken'}
          </FensterKnopf>
        ) : (
          <FensterKnopf disabled={!bereit} onClick={() => void eintragen()}>
            {laeuft ? 'Wird eingetragen …' : verknuepfen ? 'Verknüpfen' : 'Eintragen'}
          </FensterKnopf>
        )
      }
    >
      <p className={styles.quelle}>
        Aus {zeile.sitzung.titel}
        {zeile.punkt ? ` · ${punktBeschriftung(zeile.punkt)}` : ''}: „{zeile.text}“
      </p>
      {offen ? (
        <p className={felder.hinweis} role="status">
          Der Termin steht im Kalender „{kalenderName}“. Es fehlt nur noch der Vermerk hier im
          Reiter. Bitte nicht noch einmal eintragen – „Nochmal vermerken“ reicht.
        </p>
      ) : (
        <>
          <label className={felder.feld}>
            <span>Kalender</span>
            <select
              className={felder.eingabe}
              value={kalenderId ?? ''}
              disabled={laeuft || !liste.length}
              onChange={(ev) => {
                setTrotzdem(false);
                setze('kalender', Number(ev.target.value));
              }}
            >
              {kalender.stand.art === 'laedt' && <option value="">wird geladen …</option>}
              {liste.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <label className={felder.feld}>
            <span>Titel</span>
            <input
              className={felder.eingabe}
              value={e.titel}
              disabled={laeuft}
              onChange={(ev) => setze('titel', ev.target.value)}
            />
          </label>
          <div className={felder.zeile}>
            <label className={felder.feld}>
              <span>Datum</span>
              <input
                type="date"
                className={felder.eingabe}
                value={e.tag}
                disabled={laeuft}
                onChange={(ev) => {
                  setTrotzdem(false);
                  setze('tag', ev.target.value);
                }}
              />
            </label>
            <label className={felder.schalter}>
              <input
                type="checkbox"
                className={felder.haken}
                checked={e.ganztaegig}
                disabled={laeuft}
                onChange={(ev) => setze('ganztaegig', ev.target.checked)}
              />
              <span>Ganztägig</span>
            </label>
          </div>
          {!e.ganztaegig && (
            <div className={felder.zeile}>
              <label className={felder.feld}>
                <span>Von</span>
                <input
                  type="time"
                  className={felder.eingabe}
                  value={e.von}
                  disabled={laeuft}
                  onChange={(ev) => setze('von', ev.target.value)}
                />
              </label>
              <label className={felder.feld}>
                <span>Bis</span>
                <input
                  type="time"
                  className={felder.eingabe}
                  value={e.bis}
                  disabled={laeuft}
                  onChange={(ev) => setze('bis', ev.target.value)}
                />
              </label>
            </div>
          )}
          <label className={felder.feld}>
            <span>Ort (optional)</span>
            <input
              className={felder.eingabe}
              value={e.ort}
              placeholder="z. B. Gemeindehaus"
              disabled={laeuft || !!verknuepfen}
              onChange={(ev) => setze('ort', ev.target.value)}
            />
          </label>
          {treffer && (
            <div className={styles.gibts} role="group" aria-label="Termin schon vorhanden">
              <b>
                Am {datumText(e.tag)} steht in „{kalenderName}“ schon „{treffer.titel}“.
              </b>
              <label>
                <input
                  type="radio"
                  name="gibts"
                  checked={!trotzdem}
                  disabled={laeuft}
                  onChange={() => setTrotzdem(false)}
                />
                Nur verknüpfen – nichts Neues anlegen
              </label>
              <label>
                <input
                  type="radio"
                  name="gibts"
                  checked={trotzdem}
                  disabled={laeuft}
                  onChange={() => setTrotzdem(true)}
                />
                Trotzdem neu anlegen
              </label>
            </div>
          )}
          <p className={styles.gebucht}>Es werden keine Einladungen verschickt.</p>
          {problem && kalender.stand.art !== 'laedt' && <p className={felder.leise}>{problem}</p>}
          {kalender.stand.art === 'fertig' && !liste.length && (
            <p className={felder.leise}>Du darfst in keinem Kalender Termine anlegen.</p>
          )}
          {(tagTermine.stand.art === 'fehler' || kalender.stand.art === 'fehler') && (
            <TextKnopf
              onClick={() => {
                kalender.neu();
                tagTermine.neu();
              }}
            >
              Noch einmal versuchen
            </TextKnopf>
          )}
        </>
      )}
      {meldung && (
        <p className={felder.fehler} role="alert">
          {meldung.text}
        </p>
      )}
    </Sheet>
  );
}
