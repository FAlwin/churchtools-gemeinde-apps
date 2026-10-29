import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { SeitenGeruest } from '../components/SeitenGeruest';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '@ui/icons/icons';
import { useNeuAnlegen } from '@ui/bedienung/NeuAnlegen';
import { Coachmarks } from '../components/Coachmarks';
import { ZeitraumKnopf } from '@ui/bedienung/ZeitraumKnopf';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import {
  AB_HEUTE,
  spanneText,
  zeitraumGrenzen,
  zeitraumText,
  type Zeitraum,
} from '@shared/ct/zeitraum';
import { AbsenceSheet, type Entwurf } from '../components/AbsenceSheet';
import { ZeitraumFrage } from '../components/ZeitraumFrage';
import {
  useAbsenceEvents,
  useAbsenceReasons,
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
  useSaveAbsenceChanges,
  useUpdateAbsence,
} from '../hooks/useAvailability';
import {
  abwesenheitFuerTermin,
  tagKurz,
  uhrzeit,
  wochentagLang,
  zeitfensterKurz,
  zeitraumKurz,
} from '../utils/absenceDatum';
import { MAX_VORAUS_TAGE, decktTermin, zeitfensterFuer } from '@shared/absences/index';
import { heuteIso } from '../utils/heute';
import { plusTage, tagImMonat } from '../utils/wochen';
import {
  getAbwesenheitenAusgeblendet,
  getAbwesenheitenFilter,
  setAbwesenheitenAusgeblendet,
} from '../utils/devicePrefs';
import { ausgeblendetAusAlterWahl, filtereTermine, knoepfeAus } from '../utils/terminFilter';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { letzterTag, monatLabel, monatNurKurz, monatPlus, monatVon } from '../utils/monate';
import { ApiError } from '../services/api';
import {
  TOUR_VERFUEGBARKEIT,
  VERFUEGBARKEIT_STEPS,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { Segment } from '@ui/bedienung/Segment';
import styles from './Availability.module.scss';

// Nicht exportiert (Fast Refresh mag nur Komponenten als Export) – wer die Zahlen braucht, liest sie hier.
/** So viele Monate ab dem laufenden werden vorab geholt – „dieser“ und „nächster Monat“ brauchen nichts nachzuladen. */
const RASTER_MONATE = 12;
/** „Ab heute“ zeigt die nächsten vier Wochen (Entwurf A, 28.10.2026). */
const AB_HEUTE_TAGE = 28;
/** So weit reicht „Einträge → Früher" zurück. */
const RUECKBLICK_TAGE = 365;

interface AvailabilityProps {
  /** Schreiben braucht Netz (ChurchTools). Lesen kommt aus dem Cache. */
  online: boolean;
  onToast: (text: string) => void;
  /** Nur für Tests: das „Heute" der Ansicht. */
  heute?: string;
}

type Seite = 'termine' | 'eintraege';
/** Was ein Kästchen zeigt: der Eintrag dahinter, ob er zum Löschen vorgemerkt ist, ob der Haken sitzt. */
interface Kasten {
  absence: Absence | undefined;
  soll: boolean;
  vorgemerkt: boolean;
}

/**
 * Abwesenheiten (#177). Aufbau nach acht Entwurfsrunden mit Alwin (18./19.09.2026), Vorbild ist die
 * kleine Abwesenheits-App, die das Musikteam gern benutzt – „an diesem Sonntag kann ich nicht" soll
 * ein Häkchen sein, kein Fenster:
 *
 *  1. **Zeitraum-Knopf** wie im Dienstplaner (`ZeitraumKnopf`, seit 28.10.2026 – vorher eine Monatsleiste mit
 *     Kapseln): ab heute (vier Wochen), dieser oder nächster Monat, eigener Zeitraum. Daneben der **Filter-Knopf**
 *     (`FilterKnopf`) mit Häkchen je Termin-Art. Nur nach vorn – Vergangenes steht unter „Einträge → Früher".
 *  2. **Terminliste des Zeitraums**, nach Monaten überschrieben, mit einem **Abhakfeld** je Termin. Die Kästchen sind immer aktiv,
 *     aber ein Haken ist nur **vorgemerkt** (blauer Ring), bis man unten **Speichern** drückt – dann
 *     gehen alle Häkchen auf einmal nach ChurchTools (`useSaveAbsenceChanges`). Kein Bearbeiten-Modus:
 *     Alwins Frau wollte es wie im alten Planner – anfassen, dann speichern (19.09.2026).
 *  3. Ein Termin in einem **mehrtägigen** Zeitraum (Urlaub) lässt sich nicht stumm herausnehmen:
 *     `ZeitraumFrage` bietet „Zeitraum löschen" (vorgemerkt) oder „Zeitraum anpassen" (Fenster).
 *  4. Das **Plus** unten rechts trägt einen ganzen Zeitraum ein (`AbsenceSheet` mit Schnellwahl); es
 *     verschwindet, solange etwas vorgemerkt ist – dann ist die Speichern-Leiste der einzige Weg.
 *  5. **„Einträge"**: die eigenen Abwesenheiten, „Anstehend" und „Früher"; ein Tipp öffnet das Fenster
 *     zum Ändern und Löschen, Vergangenes nur zum Ansehen.
 *
 * Kopfleiste nur mit Titel, wie bei Termine und Lieder (Alwin, 19.09.2026).
 */
export function Availability({ online, onToast, heute = heuteIso() }: AvailabilityProps) {
  const laufend = monatVon(heute);
  const bisMonat = monatPlus(laufend, RASTER_MONATE - 1);
  /** Gezeigter Zeitraum – beim Öffnen „ab heute“, nicht gemerkt (Vergangenes zählt hier nicht). */
  const [zeitraum, setZeitraum] = useState<Zeitraum>(AB_HEUTE);
  const grenzen = zeitraumGrenzen(zeitraum) ?? {
    von: heute,
    bis: plusTage(heute, AB_HEUTE_TAGE - 1),
  };
  // Höchstens so weit holt der Server Termine (ein Jahr, `MAX_VORAUS_TAGE`) – einen Tag Luft für die Zeitzone. Weiter
  // lässt der Zeitraum-Knopf einen eigenen Zeitraum nicht reichen.
  const spaetestens = plusTage(heute, MAX_VORAUS_TAGE - 1);
  // Geholt werden die nächsten zwölf Monate; ein eigener Zeitraum darüber hinaus holt nach.
  const vorab = letzterTag(bisMonat);
  const ladenBis = grenzen.bis > vorab ? grenzen.bis : vorab;
  const absences = useMyAbsences(true, plusTage(heute, -RUECKBLICK_TAGE), ladenBis);
  const events = useAbsenceEvents(true, ladenBis);
  const gruende = useAbsenceReasons(true);
  const anlegen = useCreateAbsence();
  const aendern = useUpdateAbsence();
  const loeschenEinzeln = useDeleteAbsence();
  const sichern = useSaveAbsenceChanges();
  // Die Termin-Arten des Admins (#400) – die Konfiguration ist ohnehin geladen (Branding).
  const site = useSiteConfig();

  const [seite, setSeite] = useState<Seite>('termine');
  const [frueher, setFrueher] = useState(false);
  /**
   * Vorgemerkte Häkchen: **Termin-ID** → gewünschter Zustand (true = abwesend).
   *
   * Bis zum 22.09.2026 stand hier der Tag. Damit hingen zwei Termine am selben Tag zusammen – genau
   * das, was Alwin gestört hat („manchmal hab ich morgens keine Zeit kann aber nachmittags").
   */
  const [pending, setPending] = useState<Record<number, boolean>>({});
  /** Vorgemerkt zu löschende Zeiträume (IDs). */
  const [loeschen, setLoeschen] = useState<number[]>([]);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [frage, setFrage] = useState<{
    tag: string;
    absence: Absence;
    /** Die anderen Termine, die derselbe Eintrag abdeckt – leer bei einem reinen Zeitraum. */
    weitere: string[];
  } | null>(null);
  const [tour, setTour] = useState(false);
  /**
   * Ausgeblendete Termin-Arten (#400, seit 28.10.2026 mit Häkchen) – vom Gerät gelesen, dorthin geschrieben. `null`:
   * noch nichts gemerkt, dann gilt die umgerechnete alte Wahl (siehe unten).
   */
  const [aus, setAus] = useState<string[] | null>(getAbwesenheitenAusgeblendet);

  useEffect(() => {
    if (!absences.isLoading && !events.isLoading && !isTourDone(TOUR_VERFUEGBARKEIT)) setTour(true);
  }, [absences.isLoading, events.isLoading]);

  const liste = useMemo(() => absences.data ?? [], [absences.data]);
  const alleEvents = useMemo(() => events.data ?? [], [events.data]);
  const anstehend = liste
    .filter((a) => a.endDate >= heute)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const frueherListe = liste
    .filter((a) => a.endDate < heute)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  /**
   * Der Termin-Filter (#400): Den Knopf gibt es nur, wenn es etwas zu wählen gibt – bei einer einzigen
   * Art wäre ein Menü mit einem Häkchen eine Frage ohne Antwort (`FilterKnopf` blendet sich dann selbst aus). Die
   * Auswahl wirkt auf die Liste UND auf die Zahl am Zeitraum-Knopf; die vorgemerkten Häkchen „Abwesend“ hängen am
   * Termin, nicht an der Liste, und überstehen jeden Filterwechsel. Die Regeln stehen in `terminFilter.ts`.
   */
  // Eigenes `useMemo`: `?? []` erzeugte bei fehlenden Arten in jedem Rendern ein NEUES Array, und
  // `knoepfe` darunter wurde dadurch jedes Mal neu berechnet (#406).
  const arten = useMemo(() => site.data.terminArten ?? [], [site.data.terminArten]);
  const knoepfe = useMemo(() => knoepfeAus(arten, alleEvents), [arten, alleEvents]);
  // Noch nichts gemerkt: die Wahl der alten Art („nur Gottesdienst“) einmal umrechnen – gespeichert wird erst beim
  // ersten Häkchen, bis dahin gilt die Umrechnung bei jedem Öffnen gleich.
  const ausgeblendet = aus ?? ausgeblendetAusAlterWahl(getAbwesenheitenFilter(), knoepfe);
  const setzeAusgeblendet = (neu: string[]): void => {
    setAus(neu);
    setAbwesenheitenAusgeblendet(neu);
  };
  // Termine im Zeitraum – nur ab heute (Vergangenes steht unter „Einträge → Früher“), ohne ausgeblendete Arten.
  const ab = grenzen.von > heute ? grenzen.von : heute;
  const zeitraumEvents = filtereTermine(
    alleEvents.filter((e) => e.date >= ab && e.date <= grenzen.bis),
    ausgeblendet,
    arten,
  );
  const monatsGruppen = [...new Set(zeitraumEvents.map((e) => monatVon(e.date)))].map((m) => ({
    monat: m,
    events: zeitraumEvents.filter((e) => monatVon(e.date) === m),
  }));
  const terminText = (n: number) => `${n} ${n === 1 ? 'Termin' : 'Termine'}`;

  const anzahl = Object.keys(pending).length + loeschen.length;

  const meldeFehler = (e: unknown, sonst: string): void => {
    onToast(e instanceof ApiError ? e.message : sonst);
  };

  /* ---------------------------------------------------------------- Häkchen (vorgemerkt) */

  const kasten = (ev: AbsenceEvent): Kasten => {
    const absence = abwesenheitFuerTermin(liste, ev);
    const weg = absence !== undefined && loeschen.includes(absence.id);
    const soll = weg ? false : ev.id in pending ? pending[ev.id] : absence !== undefined;
    return { absence, soll, vorgemerkt: ev.id in pending || weg };
  };

  const haken = (ev: AbsenceEvent): void => {
    if (!online) return onToast('Zum Ändern brauchst du Netz.');
    const a = abwesenheitFuerTermin(liste, ev);
    /**
     * **Deckt der Eintrag mehr ab als diesen einen Termin?** Dann wird gefragt statt stumm gelöscht.
     *
     * Bis zum 23.09.2026 stand hier nur „mehrtägig" – ein **ganztägiger** Eintrag deckt aber ebenso
     * jeden Termin des Tages. Wer bei einem Termin den Haken wegnahm, löschte ihn damit auch für den
     * anderen, ohne Warnung und ohne sichtbare Vormerkung. Das traf JEDEN Bestandseintrag, denn die
     * sind alle ganztägig (Fund im Code-Check vor v2.25.2).
     */
    const weitere = a ? alleEvents.filter((e) => e.id !== ev.id && decktTermin(a, e)) : [];
    if (a && (a.startDate !== a.endDate || weitere.length > 0)) {
      // Entweder die vorgemerkte Löschung zurücknehmen – oder nachfragen.
      if (loeschen.includes(a.id)) setLoeschen((l) => l.filter((id) => id !== a.id));
      else setFrage({ tag: ev.date, absence: a, weitere: weitere.map((e) => e.name) });
      return;
    }
    const ist = a !== undefined;
    const soll = ev.id in pending ? !pending[ev.id] : !ist;
    setPending((p) => {
      const n = { ...p };
      if (soll === ist) delete n[ev.id];
      else n[ev.id] = soll;
      return n;
    });
  };

  const verwerfen = (): void => {
    setPending({});
    setLoeschen([]);
  };

  const speichernAlles = (): void => {
    /** Zu einer vorgemerkten Termin-ID den Termin selbst – ohne ihn gäbe es kein Zeitfenster. */
    const terminZu = (id: string): AbsenceEvent | undefined =>
      alleEvents.find((e) => e.id === Number(id));
    const eintragen = Object.entries(pending)
      .filter(([, soll]) => soll)
      .map(([id]) => terminZu(id))
      .filter((ev): ev is AbsenceEvent => ev !== undefined)
      .map((ev) => {
        // Ein Haken trägt das Zeitfenster GENAU dieses Termins ein; ohne bekanntes Ende den Tag.
        const fenster = zeitfensterFuer(ev);
        return { startDate: ev.date, endDate: ev.date, ...(fenster ?? {}) };
      });
    const weg = [
      ...loeschen,
      ...Object.entries(pending)
        .filter(([, soll]) => !soll)
        .map(([id]) => {
          const ev = terminZu(id);
          return ev && abwesenheitFuerTermin(liste, ev)?.id;
        })
        .filter((id): id is number => id !== undefined),
    ];
    sichern.mutate(
      { eintragen, loeschen: weg },
      {
        onSuccess: (n) => {
          verwerfen();
          onToast(
            `${n} ${n === 1 ? 'Änderung' : 'Änderungen'} gespeichert – steht jetzt in ChurchTools.`,
          );
        },
        onError: (e) => meldeFehler(e, 'Konnte nicht gespeichert werden – bitte noch einmal.'),
      },
    );
  };

  /* ---------------------------------------------------------------- Fenster (Zeitraum, Ändern) */

  const speichernFenster = (neu: NeueAbsence): void => {
    const id = entwurf?.art === 'aendern' ? entwurf.absence.id : null;
    const fertig = (text: string) => () => {
      setEntwurf(null);
      onToast(text);
    };
    if (id === null) {
      anlegen.mutate(neu, {
        onSuccess: fertig('Eingetragen – steht jetzt als Abwesenheit in ChurchTools.'),
        onError: (e) => meldeFehler(e, 'Konnte nicht eingetragen werden.'),
      });
    } else {
      aendern.mutate(
        { id, neu },
        {
          onSuccess: fertig('Geändert.'),
          onError: (e) => meldeFehler(e, 'Konnte nicht geändert werden.'),
        },
      );
    }
  };

  const entfernen = (a: Absence): void => {
    loeschenEinzeln.mutate(a.id, {
      onSuccess: () => {
        setEntwurf(null);
        onToast('Gelöscht.');
      },
      onError: (e) => meldeFehler(e, 'Konnte nicht gelöscht werden.'),
    });
  };

  const zeitraumOeffnen = (): void => {
    if (!online) return onToast('Zum Eintragen brauchst du Netz.');
    const naechster = alleEvents.find((e) => e.date >= heute)?.date ?? heute;
    setEntwurf({ art: 'neu', tag: naechster });
  };

  const laedt = absences.isLoading || events.isLoading;
  const fehler = absences.isError || events.isError;
  /**
   * Neu laden: Einträge UND Termine – `Promise.all` hält beide zusammen, die Ladeanzeige steht, bis
   * das Letzte da ist. Warum ein Versprechen zurückkommen muss, steht an `onNeuLaden` in
   * `SeitenGeruest.tsx` (hier fing es an: zwei mit `void` weggeworfene Abrufe, 22.09.2026).
   */
  const neuLaden = (): Promise<unknown> => Promise.all([absences.refetch(), events.refetch()]);

  /* ---------------------------------------------------------------- Zeilen */

  const datumKachel = (tag: string, dritteZeile: string, ton: 'blau' | 'rot' | 'grau') => (
    <div
      className={`${styles.datum}${ton === 'rot' ? ' ' + styles.datumRot : ton === 'grau' ? ' ' + styles.datumGrau : ''}`}
      aria-hidden="true"
    >
      <b>{tagImMonat(tag)}</b>
      <small>{monatNurKurz(monatVon(tag))}.</small>
      <em>{dritteZeile}</em>
    </div>
  );

  const terminZeile = (ev: AbsenceEvent) => {
    const k = kasten(ev);
    const a = k.absence;
    const ct = a !== undefined && !a.vonApp;
    const teil = a !== undefined && a.startDate !== a.endDate;
    return (
      <div key={`ev-${ev.id}`} className={styles.zeile}>
        {datumKachel(ev.date, uhrzeit(ev.startDate), k.soll ? (ct ? 'grau' : 'rot') : 'blau')}
        <div className={styles.text}>
          <span className={styles.titel}>{ev.name}</span>
          <span className={styles.sub}>
            {wochentagLang(ev.date)}
            {a && k.soll
              ? ` · ${a.reason ?? 'Abwesend'}${teil ? ` · ${zeitraumKurz(a)}` : ''}${
                  zeitfensterKurz(a) ? ` · ${zeitfensterKurz(a)}` : ''
                }`
              : ''}
          </span>
        </div>
        <button
          className={`${styles.kasten}${k.soll ? ' ' + styles.kastenAn : ''}${ct && k.soll ? ' ' + styles.kastenCt : ''}${k.vorgemerkt ? ' ' + styles.vorgemerkt : ''}`}
          aria-pressed={k.soll}
          aria-label={`Abwesend – ${ev.name}, ${tagKurz(ev.date)}`}
          disabled={!online || sichern.isPending}
          onClick={() => haken(ev)}
        >
          <span className={styles.box}>{k.soll ? '✓' : ''}</span>
          Abwesend
        </button>
      </div>
    );
  };

  const abwesenheitZeile = (a: Absence, vergangen: boolean) => {
    const trifft = vergangen ? [] : alleEvents.filter((e) => decktTermin(a, e));
    return (
      <button
        key={`ab-${a.id}`}
        className={`${styles.zeile} ${styles.zeileTip}${vergangen ? ' ' + styles.vergangen : ''}`}
        disabled={!online && !vergangen}
        onClick={() => setEntwurf({ art: 'aendern', absence: a })}
        aria-label={`Abwesenheit ${zeitraumKurz(a)} ${vergangen ? 'ansehen' : 'ändern'}`}
      >
        {/*
          Die dritte Zeile der Kachel zeigt die Uhrzeit, sobald der Eintrag ein Zeitfenster hat –
          sonst den Wochentag wie bisher. Seit ein Haken das Fenster des Termins einträgt
          (22.09.2026), können an einem Tag mehrere Einträge stehen; ohne die Uhrzeit sähen sie
          gleich aus.
        */}
        {datumKachel(
          a.startDate,
          zeitfensterKurz(a) ? uhrzeit(a.startTime ?? '') : tagKurz(a.startDate).slice(0, 2),
          a.vonApp ? 'rot' : 'grau',
        )}
        <div className={styles.text}>
          <span className={styles.titel}>
            {a.reason ?? 'Abwesend'}
            {a.startDate !== a.endDate ? ` · ${zeitraumKurz(a)}` : ''}
            {zeitfensterKurz(a) ? ` · ${zeitfensterKurz(a)}` : ''}
          </span>
          <span className={styles.sub}>
            {[
              trifft.length
                ? `trifft ${trifft.map((e) => tagKurz(e.date)).join(', ')}`
                : vergangen
                  ? ''
                  : 'trifft keinen Termin',
              a.comment,
              a.vonApp ? '' : 'in ChurchTools eingetragen',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <span className={styles.chev}>
          <Icon name="chev-right" size={18} />
        </span>
      </button>
    );
  };

  /** Einträge nach Monat gruppiert – die Reihenfolge der Liste bleibt (anstehend aufwärts, früher abwärts). */
  const gruppiert = (eintraege: Absence[]) => {
    const monate = [...new Set(eintraege.map((a) => monatVon(a.startDate)))];
    return monate.map((m) => ({
      monat: m,
      eintraege: eintraege.filter((a) => monatVon(a.startDate) === m),
    }));
  };

  const termineSeite = (
    <>
      <div className={styles.werkzeug}>
        {/* Zeitraum- und Filter-Knopf: dieselben Komponenten wie im Dienstplaner (28.10.2026). */}
        <div data-tour="verf-zeitraum">
          <ZeitraumKnopf
            zeitraum={zeitraum}
            zeile1={
              zeitraum.art === 'abHeute'
                ? spanneText(grenzen.von, grenzen.bis)
                : zeitraumText(zeitraum)
            }
            zeile2={`${terminText(zeitraumEvents.length)}${zeitraum.art === 'abHeute' ? ' · ab heute' : ''}`}
            heute={heute}
            abHeuteZusatz="die nächsten 4 Wochen"
            spaetestens={spaetestens}
            onWahl={setZeitraum}
          />
        </div>
        {knoepfe.length > 1 && (
          <div data-tour="verf-filter">
            <FilterKnopf
              abschnitte={[
                {
                  titel: 'Veranstaltungen',
                  optionen: knoepfe.map((k) => ({ wert: k.id, text: k.name })),
                  aus: ausgeblendet,
                  onAus: setzeAusgeblendet,
                },
              ]}
            />
          </div>
        )}
      </div>
      <section data-tour="verf-termine">
        {monatsGruppen.length === 0 && (
          <div className={styles.liste}>
            <div className={styles.leer}>Kein Termin in diesem Zeitraum.</div>
          </div>
        )}
        {monatsGruppen.map((g) => (
          <Fragment key={g.monat}>
            <div className={styles.sec}>
              {monatLabel(g.monat)}
              <span>{terminText(g.events.length)}</span>
            </div>
            <div className={styles.liste}>{g.events.map(terminZeile)}</div>
          </Fragment>
        ))}
      </section>
      {/**
       * Der Halbsatz beantwortet die Frage, die Alwin am 05.09.2026 beim Durchklicken hatte: „Sind
       * das die Termine, bei denen ich eingetragen bin?" Nein – es sind ALLE, die das Konto in
       * ChurchTools sehen darf. Wer welchen Dienst hat, weiß die App nicht (Dienst-Einteilung ist Phase 2).
       */}
      <p className={styles.hinweis}>
        Alle Termine aus ChurchTools – wer eingeteilt ist, spielt hier keine Rolle. Ein Haken wird
        erst mit „Speichern" eingetragen.
      </p>
    </>
  );

  const eintraegeListe = frueher ? frueherListe : anstehend;
  const eintraegeSeite = (
    <>
      <Segment
        ariaLabel="Zeitraum"
        value={frueher ? 'frueher' : 'anstehend'}
        onChange={(v) => setFrueher(v === 'frueher')}
        options={[
          { value: 'anstehend', label: `Anstehend (${anstehend.length})` },
          { value: 'frueher', label: `Früher (${frueherListe.length})` },
        ]}
      />
      {eintraegeListe.length === 0 ? (
        <div className={styles.leerBox}>
          <b>{frueher ? 'Nichts in der Vergangenheit.' : 'Noch nichts eingetragen.'}</b>
          {frueher
            ? 'Was du einträgst, bleibt hier ein Jahr lang stehen.'
            : 'Unter „Termine" ein Kästchen abhaken – oder über das Plus einen Zeitraum eintragen.'}
        </div>
      ) : (
        gruppiert(eintraegeListe).map((g) => (
          <section key={g.monat}>
            <div className={styles.sec}>{monatLabel(g.monat)}</div>
            <div className={styles.liste}>
              {g.eintraege.map((a) => abwesenheitZeile(a, frueher))}
            </div>
          </section>
        ))
      )}
      {!frueher && eintraegeListe.length > 0 && (
        <p className={styles.hinweis}>
          Tipp auf eine Zeile: Zeitraum, Grund oder Kommentar ändern, löschen. Auch Einträge, die du
          direkt in ChurchTools gemacht hast – vor dem Löschen fragt die App dann nach.
        </p>
      )}
    </>
  );

  /**
   * Was über dem Inhalt schwebt: die Speichern-Leiste (sobald etwas vorgemerkt ist) oder das Plus,
   * dazu die Fenster und die Einführung. Es scrollt nicht mit, deshalb steht es neben dem Inhalt
   * und nicht darin.
   */
  // Am iPad/Rechner grün im Seitenkopf, am Handy das Plus (`useNeuAnlegen`). Solange etwas vorgemerkt ist, gibt es
  // keins – EIN Speichern-Weg.
  const neu = useNeuAnlegen({
    label: 'Zeitraum eintragen',
    onClick: zeitraumOeffnen,
    sichtbar: !laedt && !fehler && anzahl === 0,
    disabled: !online,
    dataTour: 'verf-plus',
  });

  const ueberlagerung = (
    <>
      {anzahl > 0 ? (
        <div className={styles.leiste} role="status">
          <button className={styles.verwerfen} onClick={verwerfen} disabled={sichern.isPending}>
            Verwerfen
          </button>
          <span className={styles.leisteInfo}>
            {anzahl} {anzahl === 1 ? 'Änderung' : 'Änderungen'} vorgemerkt
          </span>
          <button
            className={styles.speichern}
            onClick={speichernAlles}
            disabled={sichern.isPending}
          >
            {sichern.isPending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      ) : (
        neu.schwebend
      )}

      {entwurf && (
        <AbsenceSheet
          entwurf={entwurf}
          heute={heute}
          laeuft={anlegen.isPending || aendern.isPending}
          loeschtGerade={loeschenEinzeln.isPending}
          gruende={gruende.data ?? []}
          standardGrund={gruende.data?.find((g) => g.standard)?.id ?? null}
          nurLesen={entwurf.art === 'aendern' && entwurf.absence.endDate < heute}
          onClose={() => setEntwurf(null)}
          onSubmit={speichernFenster}
          onDelete={entfernen}
        />
      )}

      {frage && (
        <ZeitraumFrage
          tag={frage.tag}
          absence={frage.absence}
          weitereTermine={frage.weitere}
          onLoeschen={() => {
            setLoeschen((l) => (l.includes(frage.absence.id) ? l : [...l, frage.absence.id]));
            setFrage(null);
          }}
          onAnpassen={() => {
            setEntwurf({ art: 'aendern', absence: frage.absence });
            setFrage(null);
          }}
          onClose={() => setFrage(null)}
        />
      )}

      {tour && (
        <Coachmarks
          steps={VERFUEGBARKEIT_STEPS}
          onClose={() => {
            markTourDone(TOUR_VERFUEGBARKEIT);
            setTour(false);
          }}
        />
      )}
    </>
  );

  return (
    <SeitenGeruest
      titel="Abwesenheiten"
      // „Termine | Einträge“ steht an der Stelle der Überschrift – „Abwesenheiten“ sagt schon der Reiter (28.10.2026).
      stattTitel={
        <Segment
          ariaLabel="Ansicht"
          value={seite}
          onChange={setSeite}
          options={[
            { value: 'termine', label: 'Termine' },
            {
              value: 'eintraege',
              label: (
                <>
                  Einträge
                  {anstehend.length > 0 && (
                    <span className={styles.zaehler}>{anstehend.length}</span>
                  )}
                </>
              ),
            },
          ]}
        />
      }
      onNeuLaden={neuLaden}
      ueberlagerung={ueberlagerung}
      aktionen={neu.kopf}
    >
      {laedt ? (
        <CenterMessage loading text="Wird geladen…" />
      ) : fehler ? (
        <CenterMessage icon="warnung" text="Konnte nicht geladen werden." onRetry={neuLaden} />
      ) : (
        <div className={styles.wrap}>{seite === 'termine' ? termineSeite : eintraegeSeite}</div>
      )}
    </SeitenGeruest>
  );
}
