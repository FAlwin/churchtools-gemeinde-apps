import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { datumText } from '@shared/ct/datum';
import { punktBeschriftung } from '@shared/protokolle/dokument';
import {
  aehnlicherTermin,
  beginnTagWechseln,
  eintragFehler,
  eintragVorbelegung,
  terminZeitText,
  type Eintrag,
  type TerminZeile,
} from '@shared/protokolle/termine';
import type { TerminStand } from '@shared/protokolle/terminStand';
import { vorlageAnwenden, type TerminVorlage } from '@shared/protokolle/terminVorlagen';
import { kalenderTermineAmTag } from './terminAnlegen';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { ladeSchreibKalender } from './kalenderListe';
import { ladeTags, ladeVorlagen, vorlageSpeichern } from './terminVorlagenLesen';
import { TerminFormular } from './TerminFormular';
import { TerminVorlagenWahl } from './TerminVorlagenWahl';
import type { MitarbeitOrt } from './mitarbeitWerte';
import felder from './Fensterfelder.module.scss';
import styles from './TerminFenster.module.scss';

/**
 * **Fenster „In Kalender eintragen“** (W14, Entwurf `termine-reiter-w14-v1`; seit W15-1 der Reiter „Kalender“ des
 * ChurchTools-Dialogs „Termin erstellen“): links die **Termin-Vorlagen** des gewählten Kalenders, rechts das Formular
 * (`TerminFormular`) – Kalender (nur die, in die man Termine anlegen darf; vorausgewählt der Kalender der Gruppe), Titel
 * ohne Uhrzeit, Beginn und Ende, Wiederholung, Beschreibung, Ort, Tags … Steht am Tag im gewählten Kalender schon ein
 * ähnlicher Termin, ist **„Nur verknüpfen – nichts Neues anlegen“** vorgewählt. Es geht keine Einladung raus. Die übrigen
 * Reiter von ChurchTools (Besprechungsanfragen, Anmeldung, Events, Ressourcen) kommen mit W15-2…5; die Leiste zeigt sich erst,
 * wenn es mehr als einen gibt.
 *
 * Nach dem Anlegen kommt der Vermerk „im Kalender“. Scheitert nur der Vermerk, steht der Termin trotzdem – dann bleibt
 * das Fenster mit „Nochmal vermerken“ offen (wiederholt nur den Vermerk, legt nichts doppelt an).
 */
export function TerminFenster({
  zeile,
  gruppenKalender,
  schreibbar,
  ort,
  vorlagenSchreiben = [],
  tagsVerwalten = false,
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
  /** Kalender, in die man Termin-Vorlagen speichern darf – nur dort steht „Als Vorlage speichern“. */
  vorlagenSchreiben?: readonly number[];
  /** Darf neue Tags anlegen (sonst nur vorhandene wählen). */
  tagsVerwalten?: boolean;
  /** Wo der Vermerk gespeichert wird („Mitarbeit“ der Gruppe). */
  ort: MitarbeitOrt;
  ich: number;
  zeitzone: string;
  /** Eingetragen und vermerkt – das Fenster geht zu, die Liste zeigt den neuen Stand. */
  onFertig: (stand: TerminStand) => void;
  onClose: () => void;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const kalender = useLaden(() => ladeSchreibKalender(schreibbar), [schreibbar]);
  const liste = kalender.stand.art === 'fertig' ? kalender.stand.daten : [];
  const vorlagen = useLaden(() => ladeVorlagen(), []);
  const tags = useLaden(() => ladeTags(), []);
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

  // Reiter wie im ChurchTools-Dialog: heute nur „Kalender“, die übrigen kommen mit W15-2…5.
  const reiter: Reiter<'kalender'>[] = [{ id: 'kalender', label: 'Kalender', icon: 'calendar' }];
  const [aktiverReiter, setAktiverReiter] = useState<'kalender'>('kalender');

  // Termin-Vorlagen: nur die des gewählten Kalenders.
  const vorlagenDaten = vorlagen.stand.art === 'fertig' ? vorlagen.stand.daten : null;
  const alleVorlagen = useMemo(() => vorlagenDaten ?? [], [vorlagenDaten]);
  const kalenderVorlagen = useMemo(
    () => alleVorlagen.filter((v) => v.kalender === kalenderId),
    [alleVorlagen, kalenderId],
  );
  const [vorlageId, setVorlageId] = useState<number | null>(null);
  const [vorlageMeldung, setVorlageMeldung] = useState<string | null>(null);
  const [vorlageLaeuft, setVorlageLaeuft] = useState(false);

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

  const problem = eintragFehler(eintrag);
  const prueft = kalenderId !== null && tagTermine.stand.art === 'laedt';
  const bereit = !problem && !prueft && tagTermine.stand.art === 'fertig' && !laeuft;
  const darfVorlage = kalenderId !== null && vorlagenSchreiben.includes(kalenderId);

  const waehleVorlage = (v: TerminVorlage | null) => {
    setTrotzdem(false);
    setVorlageMeldung(null);
    setVorlageId(v?.id ?? null);
    // „Ohne Vorlage“ stellt die Vorbelegung aus dem Protokoll wieder her.
    setE(
      v
        ? vorlageAnwenden(eintrag, v)
        : { ...eintragVorbelegung(zeile, kalenderId), informieren: e.informieren },
    );
  };

  const vorlageMerken = async () => {
    if (!darfVorlage || kalenderId === null || problem) return;
    setVorlageLaeuft(true);
    setVorlageMeldung(null);
    setFehler(null);
    try {
      const neu = await vorlageSpeichern(
        { ...eintrag, kalender: kalenderId },
        alleVorlagen.map((v) => v.id),
      );
      vorlagen.setze(neu);
      setVorlageMeldung(`Die Vorlage „${eintrag.titel.trim()}“ ist gespeichert.`);
    } catch (x) {
      setFehler(fehlerMeldung(x));
    }
    setVorlageLaeuft(false);
  };

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
        neueTagsErlaubt: tagsVerwalten,
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
  const beschaeftigt = laeuft || vorlageLaeuft;

  const vorlagenWahl = (
    <TerminVorlagenWahl
      handy={handy}
      kalenderName={kalenderName}
      vorlagen={kalenderVorlagen}
      gewaehlt={vorlageId}
      onWaehlen={waehleVorlage}
      laedt={vorlagen.stand.art === 'laedt'}
      fehler={vorlagen.stand.art === 'fehler' ? vorlagen.stand.fehler : null}
      onNeu={vorlagen.neu}
      deaktiviert={beschaeftigt}
    />
  );

  return (
    <Sheet
      title="In Kalender eintragen"
      onClose={onClose}
      beschaeftigt={beschaeftigt}
      breit
      links={
        !offen && darfVorlage ? (
          <FensterKnopf
            art="link"
            disabled={beschaeftigt || !!problem}
            onClick={() => void vorlageMerken()}
          >
            {vorlageLaeuft ? 'Wird gespeichert …' : 'Als Vorlage speichern'}
          </FensterKnopf>
        ) : undefined
      }
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
          <FensterKnopf disabled={!bereit || vorlageLaeuft} onClick={() => void eintragen()}>
            {laeuft ? 'Wird eingetragen …' : verknuepfen ? 'Verknüpfen' : 'Speichern'}
          </FensterKnopf>
        )
      }
    >
      {reiter.length > 1 && (
        <ReiterLeiste reiter={reiter} aktiv={aktiverReiter} onWechsel={setAktiverReiter} oben />
      )}
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
                  disabled={beschaeftigt}
                  onChange={() => setTrotzdem(false)}
                />
                Nur verknüpfen – nichts Neues anlegen
              </label>
              <label>
                <input
                  type="radio"
                  name="gibts"
                  checked={trotzdem}
                  disabled={beschaeftigt}
                  onChange={() => setTrotzdem(true)}
                />
                Trotzdem neu anlegen
              </label>
            </div>
          )}
          <div className={handy ? styles.rumpfHandy : styles.rumpf}>
            {vorlagenWahl}
            <TerminFormular
              e={eintrag}
              kalenderId={kalenderId}
              kalender={liste}
              kalenderLaedt={kalender.stand.art === 'laedt'}
              tags={tags.stand.art === 'fertig' ? tags.stand.daten : []}
              tagsVerwalten={tagsVerwalten}
              deaktiviert={beschaeftigt}
              onAendern={setE}
              onKalender={(id) => {
                setTrotzdem(false);
                setE({ ...eintrag, kalender: id });
              }}
              onTag={(tag) => {
                setTrotzdem(false);
                setE(beginnTagWechseln(eintrag, tag));
              }}
            />
          </div>
          <label className={styles.informieren}>
            <input
              type="checkbox"
              checked={e.informieren}
              disabled={beschaeftigt}
              onChange={(ev) => setE({ ...e, informieren: ev.target.checked })}
            />
            <span>Ersteller über Änderungen informieren</span>
          </label>
          <p className={styles.gebucht}>
            Es werden keine Einladungen verschickt.
            {e.informieren
              ? ' Du bekommst als Ersteller eine Mail von ChurchTools, wenn jemand den Termin ändert.'
              : ''}
          </p>
          {vorlageMeldung && (
            <p className={styles.gespeichert} role="status">
              {vorlageMeldung}
            </p>
          )}
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
