import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Unklar } from '@ui/ct/fehler';
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
import { buchungsHinweis } from '@shared/protokolle/terminRessourcen';
import { eventHinweis, hinweiseZusammen } from '@shared/protokolle/terminEvents';
import { vorlageAnwenden, type TerminVorlage } from '@shared/protokolle/terminVorlagen';
import { anfrageHinweis, angefragte } from '@shared/protokolle/besprechungsanfrage';
import { mailsAnAndere } from '@shared/protokolle/einladungsmail';
import { kalenderTermineAmTag } from './terminAnlegen';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { ladeSchreibKalender } from './kalenderListe';
import { ladeRessourcen } from './buchungenLesen';
import { ladeEventVorlagen } from './eventsLesen';
import { ladeKandidaten } from './besprechungsanfragen';
import { ladeTags, ladeVorlagen, vorlageSpeichern } from './terminVorlagenLesen';
import { EinladungHinweis } from './EinladungHinweis';
import { TerminAnfragen } from './TerminAnfragen';
import { TerminFormular } from './TerminFormular';
import { TerminEvents } from './TerminEvents';
import { TerminRessourcen } from './TerminRessourcen';
import { TerminVorlagenWahl } from './TerminVorlagenWahl';
import type { MitarbeitOrt } from './mitarbeitWerte';
import felder from './Fensterfelder.module.scss';
import styles from './TerminFenster.module.scss';
import formular from './TerminFormular.module.scss';

/** Dieselbe leere Liste bei jedem Aufruf – ein neues `[]` je Render ließe `useLaden` endlos neu laden. */
const KEINE: readonly number[] = [];

/**
 * **Fenster „In Kalender eintragen“** (W14, Entwurf `termine-reiter-w14-v1`; seit W15-1 der Reiter „Kalender“ des
 * ChurchTools-Dialogs „Termin erstellen“): links die **Termin-Vorlagen** des gewählten Kalenders, rechts das Formular
 * (`TerminFormular`) – Kalender (nur die, in die man Termine anlegen darf; vorausgewählt der Kalender der Gruppe), Titel
 * ohne Uhrzeit, Beginn und Ende, Wiederholung, Beschreibung, Ort, Tags … Steht am Tag im gewählten Kalender schon ein
 * ähnlicher Termin, ist **„Nur verknüpfen – nichts Neues anlegen“** vorgewählt. Es geht keine Einladung raus. Der Reiter
 * **„Events“** (W15-3, `TerminEvents`) erscheint nur, wenn die Person im gewählten Kalender Events anlegen darf, **„Ressourcen“**
 * (W15-2, `TerminRessourcen`) nur, wenn sie Ressourcen buchen darf, **„Besprechungsanfragen“** (W15-4, `TerminAnfragen`) nur bei
 * einem Gruppenkalender – in der Reihenfolge von ChurchTools; der Reiter Anmeldung kommt mit W15-5. Die Leiste zeigt sich
 * erst bei mehr als einem Reiter.
 *
 * **Besprechungsanfragen verschicken sofort Mails** (jede andere Person bekommt „Neue Besprechungsanfrage“): Sie gehen nur
 * mit, wenn der Reiter da ist, der Schalter an ist und nicht „Nur verknüpfen“ gilt; wechselt der Kalender, ist die Auswahl
 * **geleert** (nicht nur ausgeblendet). Der Fuß sagt vor dem Speichern, an wie viele Personen es geht. Nach einer **unklaren
 * Antwort** beim Anlegen ist „Speichern“ gesperrt, bis die Prüfung „steht schon da?“ neu gelaufen ist und den Termin
 * gefunden hat (dann „Verknüpfen“) – nie ein zweites `POST`, sonst gingen die Mails doppelt raus.
 *
 * Nach dem Anlegen kommt der Vermerk „im Kalender“. Scheitert nur der Vermerk, steht der Termin trotzdem – dann bleibt
 * das Fenster mit „Nochmal vermerken“ offen (wiederholt nur den Vermerk, legt nichts doppelt an). Fehlt nach dem Anlegen eine
 * gewünschte Buchung oder ein gewünschtes Event (oder ließ es sich nicht nachlesen), bleibt der Termin und der Vermerk entsteht –
 * das Fenster sagt dann in EINER Meldung, was in ChurchTools nachzuholen ist, und geht erst mit „Fertig“ zu.
 */
export function TerminFenster({
  zeile,
  gruppenKalender,
  schreibbar,
  ort,
  vorlagenSchreiben = [],
  tagsVerwalten = false,
  ressourcenBuchen = KEINE,
  ressourcenVerwalten = KEINE,
  eventsAnlegen = KEINE,
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
  /** Ressourcen, die man buchen darf (`create bookings`) – ohne keine gibt es den Reiter „Ressourcen“ nicht. */
  ressourcenBuchen?: readonly number[];
  /** Ressourcen, bei denen man den Status einer Buchung setzen darf (`administer bookings`). */
  ressourcenVerwalten?: readonly number[];
  /** Kalender, in denen man Events anlegen darf (`edit events`) – nur dort gibt es den Reiter „Events“. */
  eventsAnlegen?: readonly number[];
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

  // Ressourcen (W15-2): Rechte als Mengen, die Ressourcen werden nur geladen, wenn es den Reiter gibt.
  const buchbar = useMemo(() => new Set(ressourcenBuchen), [ressourcenBuchen]);
  const verwaltbar = useMemo(() => new Set(ressourcenVerwalten), [ressourcenVerwalten]);
  const darfRessourcen = buchbar.size > 0;
  const ressourcen = useLaden(
    () => (darfRessourcen ? ladeRessourcen(buchbar) : null),
    [darfRessourcen, buchbar],
  );
  const ressourcenListe = ressourcen.stand.art === 'fertig' ? ressourcen.stand.daten : [];
  const ressourcenName = (id: number) =>
    ressourcenListe.find((r) => r.id === id)?.name ?? `Ressource ${id}`;

  // Events (W15-3): nur, wenn man im GEWÄHLTEN Kalender Events anlegen darf – wechselt der Kalender, kommt der Reiter oder geht.
  const darfEvents = kalenderId !== null && eventsAnlegen.includes(kalenderId);
  const eventVorlagen = useLaden(() => (darfEvents ? ladeEventVorlagen() : null), [darfEvents]);

  // Besprechungsanfragen (W15-4): nur bei Gruppenkalendern. `anfrage` = der Schalter ist an (mit den Gewählten, ohne mich) –
  // und gehört zu EINEM Kalender: Ein Wechsel leert die Auswahl (`onKalender`), die Prüfung `anfrage.kalender === kalenderId`
  // ist der zweite Riegel.
  const istGruppe = liste.find((k) => k.id === kalenderId)?.gruppe === true;
  const kandidaten = useLaden(
    () => (istGruppe && kalenderId !== null ? ladeKandidaten(kalenderId) : null),
    [istGruppe, kalenderId],
  );
  const kandidatenListe = useMemo(
    () => (kandidaten.stand.art === 'fertig' ? kandidaten.stand.daten : []),
    [kandidaten.stand],
  );
  const [anfrage, setAnfrage] = useState<{
    kalender: number;
    gewaehlt: ReadonlySet<number>;
  } | null>(null);
  const anfrageAn = istGruppe && anfrage !== null && anfrage.kalender === kalenderId;
  const eingeladen = useMemo(
    () => (anfrageAn ? angefragte(kandidatenListe, anfrage.gewaehlt, ich) : []),
    [anfrageAn, anfrage, kandidatenListe, ich],
  );

  // Reiter wie im ChurchTools-Dialog (Reihenfolge von dort): Kalender, Besprechungsanfragen, Events, Ressourcen – Anmeldung kommt mit W15-5.
  type ReiterId = 'kalender' | 'anfragen' | 'events' | 'ressourcen';
  const reiter: Reiter<ReiterId>[] = [
    { id: 'kalender', label: 'Kalender', icon: 'calendar' },
    ...(istGruppe
      ? [{ id: 'anfragen' as const, label: 'Besprechungsanfragen', icon: 'brief' as const }]
      : []),
    ...(darfEvents ? [{ id: 'events' as const, label: 'Events', icon: 'people' as const }] : []),
    ...(darfRessourcen
      ? [{ id: 'ressourcen' as const, label: 'Ressourcen', icon: 'grid' as const }]
      : []),
  ];
  const [gewaehlterReiter, setAktiverReiter] = useState<ReiterId>('kalender');
  const aktiverReiter: ReiterId = reiter.some((r) => r.id === gewaehlterReiter)
    ? gewaehlterReiter
    : 'kalender';

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
  // Nach einer unklaren Antwort beim Anlegen: Speichern ist gesperrt, bis die Prüfung „steht schon da?“ den Termin gefunden hat.
  const [unklarGesperrt, setUnklarGesperrt] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  // Der Termin steht in ChurchTools, der Vermerk fehlt noch.
  const [offen, setOffen] = useState<{ id: number; zeit: string; hinweis: string | null } | null>(
    null,
  );
  // Angelegt und vermerkt, aber eine Buchung fehlt oder ist unklar: das Fenster bleibt mit dieser Meldung stehen.
  const [fertig, setFertig] = useState<{ stand: TerminStand; hinweis: string } | null>(null);

  const problem = eintragFehler(eintrag);
  const prueft = kalenderId !== null && tagTermine.stand.art === 'laedt';
  // Mit Besprechungsanfrage erst, wenn die Personen geladen sind – sonst gingen die Einladungen still verloren.
  const anfrageBereit = !anfrageAn || kandidaten.stand.art === 'fertig';
  const bereit =
    !problem &&
    !prueft &&
    tagTermine.stand.art === 'fertig' &&
    !laeuft &&
    anfrageBereit &&
    (!unklarGesperrt || !!verknuepfen);
  // „Nur verknüpfen“ legt nichts an – dann geht auch keine Einladung raus.
  const mails = verknuepfen ? 0 : mailsAnAndere(eingeladen, ich);
  const personName = (id: number) =>
    kandidatenListe.find((k) => k.id === id)?.name ?? `Person ${id}`;
  const darfVorlage = kalenderId !== null && vorlagenSchreiben.includes(kalenderId);

  const waehleVorlage = (v: TerminVorlage | null) => {
    setTrotzdem(false);
    setVorlageMeldung(null);
    setVorlageId(v?.id ?? null);
    // „Ohne Vorlage“ stellt die Vorbelegung aus dem Protokoll wieder her.
    setE(
      v
        ? vorlageAnwenden(eintrag, v, { buchbar, verwaltbar })
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

  const vermerken = async (r: { id: number; zeit: string; hinweis: string | null }) => {
    if (kalenderId === null) return;
    try {
      const stand = await terminVermerken(
        ort,
        { gruppe: zeile.gruppe.id, sitzung: zeile.sitzung.id, block: zeile.blockId },
        { kalender: kalenderId, id: r.id, name: kalenderName, zeit: r.zeit },
        ich,
        new Date().toISOString(),
      );
      if (r.hinweis) {
        setOffen(null);
        setLaeuft(false);
        setFertig({ stand, hinweis: r.hinweis });
      } else onFertig(stand);
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
    let r: Awaited<ReturnType<typeof terminLegen>>;
    try {
      r = await terminLegen({
        // Events nur, wo die Person sie anlegen darf (der Reiter ist sonst weg) und nur beim Neu-Anlegen.
        eintrag: { ...eintrag, kalender: kalenderId, events: darfEvents ? eintrag.events : {} },
        zeitzone,
        verknuepfen,
        neueTagsErlaubt: tagsVerwalten,
        // Nur mit Schalter an, im Gruppenkalender und nicht beim Verknüpfen (`eingeladen` ist sonst leer).
        eingeladen: verknuepfen ? [] : eingeladen,
      });
    } catch (x) {
      setFehler(fehlerMeldung(x));
      setLaeuft(false);
      if (x instanceof Unklar) {
        // Vielleicht steht der Termin doch da: die Prüfung neu laufen lassen und bis dahin nicht noch einmal anlegen.
        setUnklarGesperrt(true);
        tagTermine.neu();
      }
      return;
    }
    const zeit = verknuepfen
      ? terminZeitText(verknuepfen.beginn, zeitzone)
      : eintrag.ganztaegig
        ? 'ganztägig'
        : `${eintrag.von} Uhr`;
    await vermerken({
      id: r.id,
      zeit,
      hinweis: hinweiseZusammen([
        r.buchungen ? buchungsHinweis(r.buchungen, ressourcenName) : null,
        r.events ? eventHinweis(r.events) : null,
        r.anfragen ? anfrageHinweis(r.anfragen, personName) : null,
      ]),
    });
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
      onClose={fertig ? () => onFertig(fertig.stand) : onClose}
      beschaeftigt={beschaeftigt}
      breit
      links={
        !offen && !fertig && darfVorlage ? (
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
        fertig ? (
          <FensterKnopf onClick={() => onFertig(fertig.stand)}>Fertig</FensterKnopf>
        ) : offen ? (
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
      {reiter.length > 1 &&
        // Am Handy passen vier bis fünf Reiter nicht in die Breite – der Rest war nur durch Wischen ohne Hinweis zu finden
        // (Durchklicken 25.11.2026). Alwin: dort eine Auswahl wie bei den Termin-Vorlagen; am PC die Reiter wie ChurchTools.
        (handy ? (
          <label className={formular.vorlagenAuswahl}>
            <span>Bereich</span>
            <select
              className={formular.eingabe}
              value={aktiverReiter}
              onChange={(ev) => setAktiverReiter(ev.target.value as ReiterId)}
            >
              {reiter.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <ReiterLeiste reiter={reiter} aktiv={aktiverReiter} onWechsel={setAktiverReiter} oben />
        ))}
      <p className={styles.quelle}>
        Aus {zeile.sitzung.titel}
        {zeile.punkt ? ` · ${punktBeschriftung(zeile.punkt)}` : ''}: „{zeile.text}“
      </p>
      {fertig ? (
        <>
          <p className={felder.hinweis} role="status">
            Der Termin steht im Kalender „{kalenderName}“ und ist hier vermerkt.
          </p>
          <p className={felder.fehler} role="alert">
            {fertig.hinweis}
          </p>
        </>
      ) : offen ? (
        <>
          <p className={felder.hinweis} role="status">
            Der Termin steht im Kalender „{kalenderName}“. Es fehlt nur noch der Vermerk hier im
            Reiter. Bitte nicht noch einmal eintragen – „Nochmal vermerken“ reicht.
          </p>
          {offen.hinweis && (
            <p className={felder.fehler} role="alert">
              {offen.hinweis}
            </p>
          )}
        </>
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
          {aktiverReiter === 'anfragen' && verknuepfen && (
            <p className={felder.hinweis} role="status">
              Du verknüpfst einen vorhandenen Termin – dabei geht keine Besprechungsanfrage raus.
              Anfragen gibt es nur beim Neu-Anlegen („Trotzdem neu anlegen“).
            </p>
          )}
          {aktiverReiter === 'anfragen' && kalenderId !== null && (
            <TerminAnfragen
              kalenderName={kalenderName}
              kandidaten={kandidatenListe}
              laedt={kandidaten.stand.art === 'laedt'}
              fehler={kandidaten.stand.art === 'fehler' ? kandidaten.stand.fehler : null}
              onNeu={kandidaten.neu}
              an={anfrageAn}
              onAn={(an) => setAnfrage(an ? { kalender: kalenderId, gewaehlt: new Set() } : null)}
              gewaehlt={anfrage?.gewaehlt ?? new Set()}
              onGewaehlt={(gewaehlt) => setAnfrage({ kalender: kalenderId, gewaehlt })}
              ich={ich}
              deaktiviert={beschaeftigt || !!verknuepfen}
            />
          )}
          {aktiverReiter === 'events' && verknuepfen && (
            <p className={felder.hinweis} role="status">
              Du verknüpfst einen vorhandenen Termin – dabei werden keine Events angelegt. Events
              gibt es nur beim Neu-Anlegen („Trotzdem neu anlegen“).
            </p>
          )}
          {aktiverReiter === 'events' && (
            <TerminEvents
              e={eintrag}
              onAendern={setE}
              vorlagen={eventVorlagen.stand.art === 'fertig' ? eventVorlagen.stand.daten : []}
              laedt={eventVorlagen.stand.art === 'laedt'}
              fehler={eventVorlagen.stand.art === 'fehler' ? eventVorlagen.stand.fehler : null}
              onNeu={eventVorlagen.neu}
              deaktiviert={beschaeftigt || !!verknuepfen}
            />
          )}
          {aktiverReiter === 'ressourcen' && verknuepfen && (
            <p className={felder.hinweis} role="status">
              Du verknüpfst einen vorhandenen Termin – dabei wird nichts gebucht. Ressourcen werden
              nur beim Neu-Anlegen gebucht („Trotzdem neu anlegen“).
            </p>
          )}
          {aktiverReiter === 'ressourcen' && (
            <TerminRessourcen
              e={eintrag}
              onAendern={setE}
              ressourcen={ressourcenListe}
              laedt={ressourcen.stand.art === 'laedt'}
              fehler={ressourcen.stand.art === 'fehler' ? ressourcen.stand.fehler : null}
              onNeu={ressourcen.neu}
              verwaltbar={verwaltbar}
              deaktiviert={beschaeftigt || !!verknuepfen}
            />
          )}
          {aktiverReiter === 'kalender' && (
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
                  setUnklarGesperrt(false);
                  // Besprechungsanfragen gehören zum Kalender: leeren, nicht nur ausblenden.
                  setAnfrage(null);
                  setE({ ...eintrag, kalender: id });
                }}
                onTag={(tag) => {
                  setTrotzdem(false);
                  setUnklarGesperrt(false);
                  setE(beginnTagWechseln(eintrag, tag));
                }}
              />
            </div>
          )}
          <label className={styles.informieren}>
            <input
              type="checkbox"
              checked={e.informieren}
              disabled={beschaeftigt}
              onChange={(ev) => setE({ ...e, informieren: ev.target.checked })}
            />
            <span>Ersteller über Änderungen informieren</span>
          </label>
          <EinladungHinweis mails={mails} />
          {(mails === 0 || e.informieren) && (
            <p className={styles.gebucht}>
              {[
                mails === 0 ? 'Es werden keine Einladungen verschickt.' : null,
                e.informieren
                  ? 'Du bekommst als Ersteller eine Mail von ChurchTools, wenn jemand den Termin ändert.'
                  : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
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
