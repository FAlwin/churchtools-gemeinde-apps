import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useNeuAnlegen } from '@ui/bedienung/NeuAnlegen';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Icon } from '@ui/icons/icons';
import type {
  EigeneAnsicht,
  OeffentlicheEinstellungen,
  SpaltenFilter,
  TabellenWahl,
} from '@shared/anmeldung/formular';
import {
  ansichtenAus,
  ansichtGeaendert,
  ansichtNameFehler,
  ansichtPlatzFehler,
  ansichtSpalten,
  ansichtStand,
  mitAnsichtName,
  mitAnsichtSpalten,
  mitAnsichtStand,
  mitAnsichtVerschoben,
  mitAnsichtZurueck,
  mitNeuerAnsicht,
  neueAnsichtId,
  ohneAnsicht,
} from '@shared/anmeldung/ansichten';
import { euroText } from '@shared/anmeldung/preis';
import { wartenTrotzPlatz } from '@shared/anmeldung/nachpruefung';
import {
  anmeldungenAus,
  listenZahlen,
  type Absage,
  type ListenAnmeldung,
} from '@shared/anmeldung/liste';
import type { GeladenerStand } from './mitglieder';
import {
  gezeigteSpalten,
  mitSpaltenWahl,
  personSchluessel,
  personZeilen,
  personZellText,
  personSumme,
  type PersonZeile,
  spaltenWahl,
  summe,
  wahlGeaendert,
  zellText,
  type Sortierung,
  type TabellenModus,
  type TabellenSpalte,
} from '@shared/anmeldung/tabelle';
import {
  filterArt,
  filterName,
  filterSetzen,
  filterText,
  gefilterteListe,
  passtAnmeldung,
} from '@shared/anmeldung/tabellenFilter';
import { FilterChips } from '@ui/bedienung/SpaltenFilter';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { AnmeldungenTabelle } from './AnmeldungenTabelle';
import { SpaltenFilterFenster } from './SpaltenFilterFenster';
import { AnsichtFenster, type AnsichtFensterArt } from './AnsichtFenster';
import { SpaltenFenster } from './SpaltenFenster';
import { leseZeilenOben, zeileUmschalten } from './zeilenOben';
import { aendereEinstellungen } from './einrichten';
import { fehlerMeldung } from './zustand';
import { anzahlText } from './anzeige';
import { Etikett } from '@ui/bedienung/Etikett';
import type { Option } from '@ui/bedienung/OptionWaehlen';
import { VonHandFenster } from './VonHandFenster';
import { ZurueckFenster } from './ZurueckFenster';
import { RundmailFenster } from './RundmailFenster';
import { DrucklisteFenster } from './DrucklisteFenster';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import a from './AnmeldungenReiter.module.scss';
import { listenAnsicht, type ListenFilter } from './listenAnsicht';
import { useFenster } from './useFenster';

export type { ListenFilter };
/** Ein Reiter der Liste: ein fester (`ListenFilter`) oder eine eigene Ansicht des Teams (U3). */
type ReiterWahl = ListenFilter | `ansicht:${string}`;
import { absageText, ganzerName, kurz } from './anmeldungText';
import { AnmeldungAnsehen, type PlatzLage } from './AnmeldungAnsehen';

/** Stand der Mitglieder einer Veranstaltung – für Liste und Nachprüfung (A7-1). */
export type MitgliederZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'verboten' }
  | { art: 'fertig'; stand: GeladenerStand };

function ZahlungPille({ x, kostet }: { x: ListenAnmeldung; kostet: boolean }) {
  if (!kostet || x.betragCent === null || x.betragCent <= 0) return null;
  if (x.bezahlt)
    return (
      <Etikett ton="gruen">
        ✓ {x.zahlart ?? 'bezahlt'}
        {x.bezahltAm ? ` ${kurz(x.bezahltAm)}` : ''}
      </Etikett>
    );
  return x.zahlungOffen ? <Etikett ton="rot">offen</Etikett> : null;
}

/**
 * **Bereich „Anmeldungen“** (A7-1, seit U2-1 als Tabelle, Entwurf `u2-tabelle-v1`) – Reiter Alle / Zahlung offen /
 * Warteliste / Abgesagt, eine Zeile je Anmeldung, Suche, Sortieren, Summenzeile; im Reiter Warteliste der Hinweis
 * „frei, aber jemand wartet“ (mit „Nachrücken lassen“, A7-3). Klick in eine Zeile öffnet das Fenster der Anmeldung.
 */
export function AnmeldungenReiter({
  id,
  veranstaltung,
  e,
  maxPlaetze,
  warteliste,
  anmeldeschluss,
  entwurf,
  zustand,
  stichtag,
  heute,
  darf,
  zahlarten,
  gemeinde = null,
  onNeuLaden,
  onGespeichert,
  mitBestaetigung = false,
  startFilter = 'alle',
  startRundmail = false,
  startOffen = null,
}: {
  id: number;
  /** Name der Veranstaltung – für die Mail an die Familie (A7-3). */
  veranstaltung: string;
  e: OeffentlicheEinstellungen;
  maxPlaetze: number | null;
  /** Gibt es eine Warteliste? (Anmeldung von Hand, A7-4) */
  warteliste: boolean;
  /** Ende des Anmeldezeitraums (ISO) – von Hand geht es auch danach. */
  anmeldeschluss: string | null;
  entwurf: boolean;
  zustand: MitgliederZustand | null;
  /** Erster Tag der Veranstaltung (Alter), sonst heute. */
  stichtag: string;
  heute: string;
  /** Darf ändern (bezahlt, Betrag) – ChurchTools prüft es beim Schreiben ohnehin. */
  darf: boolean;
  /** Die Zahlarten dieser Veranstaltung (A7-2). */
  zahlarten: string[];
  /** Name der Gemeinde aus ChurchTools – oben auf der Druckliste (A8). */
  gemeinde?: string | null;
  onNeuLaden: () => void;
  /** Nach einer Änderung (und nach „Rückgängig“): Die Seite lädt neu – „Rückgängig“ selbst steht im Fenster. */
  onGespeichert: () => void;
  /** Bestätigungsmails eingerichtet (A9-1). */
  mitBestaetigung?: boolean;
  /** Womit die Liste beginnt – die Kennzahl-Kacheln oben auf der Seite springen so in die passende Ansicht (U1). */
  startFilter?: ListenFilter;
  /** „Rundmail schreiben“ aus dem Hinweis „im Kalender verschoben“ (K1, V6): öffnet sie, sobald die Liste da ist. */
  startRundmail?: boolean;
  /** Diese Anmeldung gleich öffnen (Schlüssel) – Sprung aus der Nachprüfung (F1e). */
  startOffen?: string | null;
}) {
  // Der gewählte Reiter: ein fester oder eine eigene Ansicht des Teams (U3, `ansicht:<id>`).
  const [filter, setFilter] = useState<ReiterWahl>(startFilter);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>(null);
  // Filter der Spalten (R2): gelten nur für jetzt, im gewählten Reiter – mehrere zusammen („und“).
  const [spaltenFilter, setSpaltenFilter] = useState<SpaltenFilter[]>([]);
  // Das offene Filterfenster: welche Spalte, woran es hängt (Trichter oder Chip).
  const [filterOffen, setFilterOffen] = useState<{ spalte: string; anker: HTMLElement } | null>(
    null,
  );
  const karte = useRef<HTMLElement>(null);
  // Eigene Ansichten (U3) kommen aus den Einstellungen; hier steht, was man eben geändert hat – bis sie neu geladen sind
  // (ohne Recht zum Speichern gilt es so bis zum Neuladen, wie bei den Spalten).
  const [lokaleAnsichten, setLokaleAnsichten] = useState<{
    fuer: OeffentlicheEinstellungen;
    liste: EigeneAnsicht[];
  } | null>(null);
  const [ansichtFenster, setAnsichtFenster] = useState<AnsichtFensterArt | null>(null);
  const [ansichtFehler, setAnsichtFehler] = useState<string | null>(null);
  const [geloescht, setGeloescht] = useState<{ ansicht: EigeneAnsicht; stelle: number } | null>(
    null,
  );
  // Eine Zeile je Anmeldung oder je Person (U2-2) – gilt in allen Reitern außer „Abgesagt“ (Absagen sind je Person).
  const [jePerson, setJePerson] = useState(false);
  // Die Spaltenwahl (U2-3) kommt aus den Einstellungen; hier steht nur, was man eben übernommen hat – damit die Tabelle
  // sofort umspringt und es auch ohne Recht zum Speichern bis zum Neuladen gilt.
  const [eigeneWahl, setEigeneWahl] = useState<Partial<Record<TabellenModus, TabellenWahl>>>({});
  const [spaltenOffen, setSpaltenOffen] = useState(false);
  const [spaltenFehler, setSpaltenFehler] = useState<string | null>(null);
  // Angeheftete Zeilen (U2-4) – nur auf diesem Gerät.
  const [oben, setOben] = useState(() => leseZeilenOben(id));
  // Beim Neuladen (nach einer Änderung) bleibt der letzte Stand stehen – sonst ginge das offene Fenster zu.
  const letzter = useRef<GeladenerStand | null>(null);
  if (zustand?.art === 'fertig') letzter.current = zustand.stand;
  const stand =
    zustand?.art === 'fertig' ? zustand.stand : zustand?.art === 'laedt' ? letzter.current : null;
  const liste = useMemo(
    () => (stand ? anmeldungenAus(e, stand, stichtag) : []),
    [e, stand, stichtag],
  );
  const handy = useMedienAbfrage(HANDY_BREITE);
  // ── Die Fenster (`useFenster`) ──
  const {
    meldung,
    setMeldung,
    startModus,
    setStartModus,
    vonHand,
    setVonHand,
    zurueck,
    setZurueck,
    rundmail,
    setRundmail,
    druck,
    setDruck,
    oeffnen,
    zurDazuAnmeldung,
    fertig,
    ausgewaehlt,
    fensterX,
  } = useFenster({
    liste,
    darf,
    mitBestaetigung,
    startRundmail,
    startOffen,
    onGespeichert,
  });

  // „Von Hand“ (R3): am Rechner/iPad grün in der Werkzeugzeile, am Handy das schwebende Plus (`useNeuAnlegen`).
  // Sichtbar nur dort, wo die Liste steht (nicht beim Laden ohne Stand, nicht bei Fehler/verboten) – wie bisher.
  const neuKnopf = useNeuAnlegen({
    label: 'Von Hand',
    onClick: () => setVonHand({ dazu: null }),
    sichtbar:
      darf &&
      !entwurf &&
      !!zustand &&
      (zustand.art === 'fertig' || (zustand.art === 'laedt' && !!stand)),
  });

  if (entwurf || !zustand)
    return (
      <section className={`${s.karte} ${a.leer}`}>
        <b>Noch keine Anmeldungen.</b>
        <span>
          Die Veranstaltung ist noch ein Entwurf. Nach dem Freigeben steht hier, wer sich anmeldet.
        </span>
      </section>
    );
  if (zustand.art === 'laedt' && !stand)
    return <p className={s.leise}>Anmeldungen werden geladen …</p>;
  if (zustand.art === 'verboten')
    return (
      <p className={v.hinweis}>
        Die Anmeldungen sieht, wer in ChurchTools die Mitglieder dieser Gruppe sehen darf.
      </p>
    );
  if (zustand.art === 'fehler')
    return (
      <div className={v.warnung}>
        {zustand.text}{' '}
        <FensterKnopf art="zweit" onClick={onNeuLaden}>
          Nochmal
        </FensterKnopf>
      </div>
    );

  // ── Eigene Ansichten (U3) ──
  // Neu geladene Einstellungen lösen den lokalen Stand ab.
  const ansichten =
    lokaleAnsichten && lokaleAnsichten.fuer === e ? lokaleAnsichten.liste : ansichtenAus(e);
  const eA: OeffentlicheEinstellungen = { ...e, ansichten };
  const aktiveAnsicht = filter.startsWith('ansicht:')
    ? ansichten.find((x) => `ansicht:${x.id}` === filter)
    : undefined;
  // Eine Ansicht zeigt alle Anmeldungen (wie „Alle“) mit ihren Filtern; ist sie weg (gelöscht), steht „Alle“ da.
  const basis: ListenFilter = filter.startsWith('ansicht:') ? 'alle' : (filter as ListenFilter);
  const jetzt = { filter: spaltenFilter, sortierung, jePerson };
  const ansichtOffen = !!aktiveAnsicht && ansichtGeaendert(aktiveAnsicht, jetzt);
  /**
   * Eine Änderung an den Ansichten: sofort hier, für das Team gemerkt nur mit Recht. `aendern` läuft beim Speichern
   * noch einmal auf den frisch gelesenen Einstellungen (`aendereEinstellungen`) – so geht nichts verloren, was jemand
   * anderes inzwischen gespeichert hat.
   */
  const ansichtenAendern = (
    aendern: (x: OeffentlicheEinstellungen) => OeffentlicheEinstellungen,
  ) => {
    setLokaleAnsichten({ fuer: e, liste: aendern(eA).ansichten ?? [] });
    if (!darf) return;
    setAnsichtFehler(null);
    aendereEinstellungen(id, aendern).then(onGespeichert, (x: unknown) =>
      setAnsichtFehler(
        `Die Ansicht ist nur hier geändert, nicht für das Team gemerkt: ${fehlerMeldung(x).text}`,
      ),
    );
  };

  const z = listenZahlen(e, liste);
  const plaetze = { belegt: z.belegt, wartend: z.wartend, max: maxPlaetze };
  const filterAktiv = basis !== 'abgesagt' ? spaltenFilter : [];
  const {
    wartende,
    absagen,
    zeilen,
    personenGezeigt,
    absageZeilen,
    zahlen,
    imReiterGesamt,
    imReiter,
  } = listenAnsicht(e, liste, stand!.absagen, {
    filter: basis,
    spaltenFilter: filterAktiv,
    suche,
    sortierung,
    jePerson,
    oben,
  });
  // Rundmail und Druckliste nehmen immer das Gefilterte (Klick-Runde 23.11.2026) – dieselbe Regel wie die Tabelle.
  const gefiltert = filterAktiv.length > 0 || !!aktiveAnsicht;
  const filterBeschreibung = gefiltert
    ? [
        ...(aktiveAnsicht ? [`Ansicht „${aktiveAnsicht.name}“`] : []),
        ...filterAktiv.map((f) => `${filterName(e, f.spalte)}: ${filterText(f)}`),
      ].join(' · ')
    : null;
  const fuerRundmail = gefiltert
    ? imReiter.filter((x) => passtAnmeldung(e, filterAktiv, x))
    : liste;
  const fuerDruck = gefiltert ? gefilterteListe(e, imReiter, filterAktiv) : liste;
  const frei = maxPlaetze === null ? null : maxPlaetze - z.belegt;
  // Das „⋯“-Menü der Liste (R6, B7): was vorher drei Knöpfe nebeneinander waren.
  const stelle = aktiveAnsicht ? ansichten.indexOf(aktiveAnsicht) : -1;
  // In einer eigenen Ansicht oben „Diese Ansicht“ (Entwurf): umbenennen, Spalten, verschieben, löschen – mit Recht.
  const dieseAnsicht: Option[] = aktiveAnsicht
    ? [
        ...(darf
          ? [
              {
                label: 'Ansicht umbenennen',
                symbol: <Icon name="pencil" size={16} />,
                onClick: () => setAnsichtFenster('umbenennen'),
              },
            ]
          : []),
        {
          label: 'Spalten dieser Ansicht',
          symbol: <Icon name="columns" size={16} />,
          onClick: () => setSpaltenOffen(true),
        },
        ...(darf
          ? [
              {
                label: 'Ansicht nach links',
                symbol: <Icon name="chev-left" size={16} />,
                gesperrt: stelle === 0,
                onClick: () =>
                  ansichtenAendern((x) => mitAnsichtVerschoben(x, aktiveAnsicht.id, -1)),
              },
              {
                label: 'Ansicht nach rechts',
                symbol: <Icon name="chev-right" size={16} />,
                gesperrt: stelle === ansichten.length - 1,
                onClick: () =>
                  ansichtenAendern((x) => mitAnsichtVerschoben(x, aktiveAnsicht.id, 1)),
              },
              {
                label: 'Ansicht löschen',
                symbol: <Icon name="trash" size={16} />,
                onClick: () => {
                  const { weg } = ohneAnsicht(eA, aktiveAnsicht.id);
                  ansichtenAendern((x) => ohneAnsicht(x, aktiveAnsicht.id).e);
                  wechseln('alle');
                  setGeloescht(weg);
                },
              },
            ]
          : []),
      ]
    : [];
  const mehr: Option[] = [
    ...dieseAnsicht,
    ...(!aktiveAnsicht && basis !== 'abgesagt' && liste.length > 0
      ? [
          {
            label: 'Spalten',
            symbol: <Icon name="columns" size={16} />,
            onClick: () => setSpaltenOffen(true),
          },
        ]
      : []),
    ...(liste.length > 0
      ? [
          {
            // Je Person zählt die Druckliste Personen (wie die Tabelle), sonst Anmeldungen.
            label: gefiltert
              ? `Druckliste (nur diese ${jePerson ? fuerDruck.flatMap((x) => x.personen).length : fuerDruck.length})`
              : 'Druckliste',
            symbol: <Icon name="drucker" size={16} />,
            onClick: () => setDruck(true),
            trenner: dieseAnsicht.length > 0,
          },
        ]
      : []),
    ...(darf && liste.length > 0
      ? [
          {
            label: gefiltert ? `Rundmail an diese ${fuerRundmail.length}` : 'Rundmail',
            symbol: <Icon name="brief" size={16} />,
            onClick: () => setRundmail(true),
          },
        ]
      : []),
  ];
  /** Eine Zeile an- oder abheften – was es nicht mehr gibt, fällt dabei aus dem Gerätespeicher. */
  const anheftenUm = (k: string) =>
    setOben(
      zeileUmschalten(
        id,
        oben,
        k,
        new Set([...liste.map((x) => x.schluessel), ...personZeilen(liste).map(personSchluessel)]),
      ),
    );
  const lage: PlatzLage = {
    belegt: z.belegt,
    max: maxPlaetze,
    wartende: wartende.map(({ p }) => ({ personId: p.personId, name: ganzerName(p) })),
  };
  const nrFeld = e.ctFelder.nr;
  const gehoertZu = (b: Absage) => {
    const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
    return nr ? liste.find((x) => x.nr === nr) : undefined;
  };

  const modus: TabellenModus = jePerson ? 'person' : 'anmeldung';
  // In einer eigenen Ansicht ihre Spalten (sonst die des Teams), in den festen Reitern die des Teams (U2-3).
  const wahl = aktiveAnsicht
    ? ansichtSpalten(eA, aktiveAnsicht, modus)
    : (eigeneWahl[modus] ?? spaltenWahl(e, modus));
  const spalten = gezeigteSpalten(e, modus, wahl, { warteliste: basis === 'warte' });
  /** Übernehmen: gilt sofort; gemerkt fürs Team, wenn man darf und sich etwas geändert hat (wie die Druckliste). */
  const spaltenUebernehmen = (w: TabellenWahl) => {
    setSpaltenOffen(false);
    if (aktiveAnsicht) {
      // „Spalten dieser Ansicht“ (U3): gemerkt in der Ansicht, nur was von den Spalten des Teams abweicht.
      if (sortierung && w.aus.includes(sortierung.schluessel)) setSortierung(null);
      ansichtenAendern((x) => mitAnsichtSpalten(x, aktiveAnsicht.id, modus, w));
      return;
    }
    setEigeneWahl((alt) => ({ ...alt, [modus]: w }));
    // Die Sortierung nach einer ausgeblendeten Spalte wäre unsichtbar.
    if (sortierung && w.aus.includes(sortierung.schluessel)) setSortierung(null);
    if (!darf || !wahlGeaendert(e, modus, w)) return;
    setSpaltenFehler(null);
    aendereEinstellungen(id, (x) => mitSpaltenWahl(x, modus, w)).then(onGespeichert, (x: unknown) =>
      setSpaltenFehler(
        `Die Spalten sind nur hier umgestellt, nicht für das Team gemerkt: ${fehlerMeldung(x).text}`,
      ),
    );
  };

  const wechseln = (f: ReiterWahl) => {
    setFilter(f);
    setFilterOffen(null);
    setGeloescht(null);
    setAnsichtFehler(null);
    // Eine eigene Ansicht bringt ihre Filter, Sortierung und „je Person“ mit (U3) …
    const ziel = ansichten.find((x) => `ansicht:${x.id}` === f);
    if (ziel) {
      const st = ansichtStand(ziel);
      setSpaltenFilter(st.filter);
      setSortierung(st.sortierung);
      setJePerson(st.jePerson);
      return;
    }
    // … in den festen Reitern gilt ein Filter nur für jetzt (Entwurf).
    setSortierung(null);
    setSpaltenFilter([]);
  };
  /** Was eine neue Ansicht mitnimmt – für das Fenster „Als Ansicht speichern“. */
  const ansichtWas = (neu: boolean) => [
    {
      titel: 'Filter',
      text:
        !neu && filterAktiv.length
          ? filterAktiv.map((f) => `${filterName(e, f.spalte)}: ${filterText(f)}`).join(' · ')
          : 'keiner – du kannst ihn danach in der Ansicht setzen',
    },
    {
      titel: 'Spalten',
      text: gezeigteSpalten(e, modus, wahl, { warteliste: false })
        .map((x) => x.titel)
        .join(', '),
    },
    {
      titel: 'Zeilen',
      text: jePerson ? 'je Person' : 'je Anmeldung',
    },
    {
      titel: 'Sortierung',
      text:
        !neu && sortierung
          ? `${spalten.find((x) => x.schluessel === sortierung.schluessel)?.titel ?? ''}, ${sortierung.absteigend ? 'absteigend' : 'aufsteigend'}`
          : 'nach Anmeldetag',
    },
  ];
  const ansichtSpeichern = (art: AnsichtFensterArt, name: string) => {
    setAnsichtFenster(null);
    if (art === 'umbenennen' && aktiveAnsicht) {
      ansichtenAendern((x) => mitAnsichtName(x, aktiveAnsicht.id, name));
      return;
    }
    const neueId = neueAnsichtId(eA);
    const stand =
      art === 'neu'
        ? { filter: [], sortierung: null, jePerson }
        : { filter: filterAktiv, sortierung, jePerson };
    ansichtenAendern((x) =>
      mitNeuerAnsicht(x, { id: neueId, name, stand, ...(art === 'neu' ? {} : { spalten: wahl }) }),
    );
    setFilter(`ansicht:${neueId}`);
    setSpaltenFilter(stand.filter);
    setSortierung(stand.sortierung);
    setGeloescht(null);
  };
  /** Filterfenster am Trichter öffnen – ein zweiter Tipp auf denselben Trichter schließt es. */
  const filterOeffnen = (spalte: string, anker: HTMLElement) =>
    setFilterOffen((o) => (o?.spalte === spalte ? null : { spalte, anker }));
  /** Vom Chip aus: am Trichter, wenn die Spalte zu sehen ist, sonst am Chip. */
  const filterVomChip = (spalte: string, chip: HTMLElement) =>
    filterOeffnen(
      spalte,
      karte.current?.querySelector<HTMLElement>(`thead [data-trichter="${spalte}"]`) ?? chip,
    );
  const tabellenFilter = {
    kann: (k: string) => filterArt(e, k) !== null,
    an: (k: string) => filterAktiv.some((f) => f.spalte === k),
    offen: filterOffen?.spalte ?? null,
    oeffnen: filterOeffnen,
  };
  const gezeigt = jePerson ? personenGezeigt.length : zeilen.length;
  /** Die Zahl am Reiter einer eigenen Ansicht – mit ihren Filtern, dieselbe Rechnung wie die Tabelle. */
  const ansichtZahl = (x: EigeneAnsicht) => {
    const r = listenAnsicht(e, liste, [], {
      filter: 'alle',
      spaltenFilter: x.filter,
      suche: '',
      sortierung: null,
      jePerson,
      oben: new Set(),
    });
    return jePerson ? r.personenGezeigt.length : r.zeilen.length;
  };
  const reiter: Reiter<ReiterWahl>[] = [
    { id: 'alle', label: 'Alle', icon: 'people', zahl: zahlen.alle },
    ...(z.kostet
      ? [
          {
            id: 'offen' as const,
            label: 'Zahlung offen',
            icon: 'check' as const,
            zahl: zahlen.offen,
          },
        ]
      : []),
    { id: 'warte', label: 'Warteliste', icon: 'clock', zahl: zahlen.warte },
    { id: 'abgesagt', label: 'Abgesagt', icon: 'user-slash', zahl: absagen.length },
    // Eigene Ansichten (U3) mit blauem Punkt hinter den festen Reitern.
    ...ansichten.map((x) => ({
      id: `ansicht:${x.id}` as const,
      label: x.name,
      icon: 'liste' as const,
      zahl: ansichtZahl(x),
      punkt: true,
      punktName: 'Eigene Ansicht des Teams',
    })),
  ];
  const strich = <span className={a.strich}>–</span>;

  /** Was in einer Zelle steht – Personen, Nr., Betrag und Bezahlt wie bisher in der Liste, Fragen als Text. */
  const zelle = (k: string, x: ListenAnmeldung): ReactNode => {
    switch (k) {
      case 'name':
        return x.wer;
      case 'nr':
        return x.nr ? <span className={v.nr}>{x.nr}</span> : <Etikett>ohne Nr.</Etikett>;
      case 'personen':
        return (
          <span className={a.personen}>
            {x.personen.map((p) => (
              <span key={p.personId} className={a.p}>
                {p.vor}
                {p.alter !== null && ` ${p.alter}`}
                {p.status === 'wartet' && (
                  <Etikett ton="blau">Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}</Etikett>
                )}
              </span>
            ))}
          </span>
        );
      case 'betrag':
        // Alle warten: Das Formular schreibt „0,00 €“ – gezahlt wird erst beim Nachrücken (22.10.2026).
        return x.personen.every((p) => p.status === 'wartet') && !x.betragCent ? (
          <small className={a.leise}>beim Nachrücken</small>
        ) : x.betragCent !== null ? (
          euroText(x.betragCent)
        ) : (
          strich
        );
      case 'bezahlt':
        return <ZahlungPille x={x} kostet={z.kostet} />;
    }
    const text = zellText(e, k, x);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  /** Je Person (U2-2): Status als Pille wie in der Spalte „Personen“, Nr., Betrag und Bezahlt der Anmeldung wie dort. */
  const personZelle = (k: string, y: PersonZeile): ReactNode => {
    switch (k) {
      case 'status':
        return y.p.status === 'wartet' ? (
          <Etikett ton="blau">Warteliste{y.p.warteplatz ? ` ${y.p.warteplatz}` : ''}</Etikett>
        ) : (
          'Platz'
        );
      case 'nr':
      case 'betrag':
      case 'bezahlt':
        return zelle(k, y.x);
    }
    const text = personZellText(e, k, y);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  const absageSpalten: TabellenSpalte[] = [
    { schluessel: 'name', titel: 'Name', zahl: false },
    ...(nrFeld !== undefined ? [{ schluessel: 'nr', titel: 'Nr.', zahl: false }] : []),
    { schluessel: 'abgesagt', titel: 'Abgesagt', zahl: false },
    { schluessel: 'gehoert', titel: 'Gehörte zu', zahl: false },
    // Wer ändern darf, sieht wie bisher, was ein Klick tut.
    ...(darf ? [{ schluessel: 'zurueck', titel: '', zahl: true }] : []),
  ];
  const absageZelle = (k: string, b: Absage): ReactNode => {
    switch (k) {
      case 'name':
        return b.name;
      case 'nr': {
        const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
        return nr ? <span className={v.nr}>{nr}</span> : strich;
      }
      case 'abgesagt':
        return `${absageText(b)}${b.warVorher === 'wartet' ? ' · stand auf der Warteliste' : ''}`;
      case 'zurueck':
        return <small className={a.leise}>Zurückholen</small>;
      default:
        return gehoertZu(b)?.wer ?? strich;
    }
  };

  const leer = (text: string) =>
    gefiltert ? (
      <p className={a.leerZeile}>
        {jePerson ? 'Keine Person passt' : 'Keine Anmeldung passt'} zu den Filtern
        {suche.trim() ? ` und „${suche.trim()}“` : ''}.{' '}
        <TextKnopf onClick={() => setSpaltenFilter([])}>Alle Filter entfernen</TextKnopf>
      </p>
    ) : (
      <p className={a.leerZeile}>
        {suche.trim() ? `Niemand mit „${suche.trim()}“ gefunden.` : text}
      </p>
    );

  return (
    <div className={a.reiter}>
      {/* Plätze, Warteliste und Zahlung offen stehen seit U1 oben auf der Seite (Kennzahlen, `Einstieg.tsx`). */}
      <section className={s.karte} aria-label="Anmeldungen" ref={karte}>
        <ReiterLeiste
          oben
          name="Ansichten"
          reiter={reiter}
          aktiv={aktiveAnsicht || !filter.startsWith('ansicht:') ? filter : 'alle'}
          onWechsel={wechseln}
          rechts={
            darf && liste.length > 0 ? (
              <TextKnopf
                onClick={() => {
                  setAnsichtFehler(ansichtPlatzFehler(eA));
                  if (!ansichtPlatzFehler(eA)) setAnsichtFenster('neu');
                }}
              >
                ＋ Ansicht
              </TextKnopf>
            ) : undefined
          }
        />
        {geloescht && (
          <p className={a.ansichtWeg} role="status">
            Ansicht „{geloescht.ansicht.name}“ gelöscht.
            <TextKnopf
              onClick={() => {
                const g = geloescht;
                ansichtenAendern((x) => mitAnsichtZurueck(x, g));
                wechseln(`ansicht:${g.ansicht.id}`);
                // `wechseln` kennt die zurückgeholte Ansicht noch nicht – ihren Stand hier setzen.
                const st = ansichtStand(g.ansicht);
                setSpaltenFilter(st.filter);
                setSortierung(st.sortierung);
                setJePerson(st.jePerson);
              }}
            >
              Rückgängig
            </TextKnopf>
          </p>
        )}
        {ansichtFehler && (
          <p className={a.hinweisRot} role="alert">
            {ansichtFehler}
          </p>
        )}

        {/* „Platz frei – jemand wartet“ steht seit U2-1 nur noch hier und in der Kachel (Alwin, 29.10.2026). */}
        {basis === 'warte' && wartenTrotzPlatz(plaetze) && wartende[0] && (
          <p className={a.warteHinweis}>
            <span>
              <b>
                {frei === null
                  ? 'Es ist Platz frei'
                  : `${anzahlText(frei, 'Platz', 'Plätze')} frei`}{' '}
                – {z.wartend === 1 ? '1 wartet' : `${z.wartend} warten`}.
              </b>{' '}
              ChurchTools lässt niemanden von selbst nachrücken. Als Nächste wartet{' '}
              {ganzerName(wartende[0].p)}
              {wartende[0].x.angemeldetAm && ` (seit ${kurz(wartende[0].x.angemeldetAm)})`}.
            </span>
            {darf && (
              <FensterKnopf
                art="hell"
                onClick={() =>
                  oeffnen(wartende[0].x.schluessel, {
                    art: 'nach',
                    personId: wartende[0].p.personId,
                  })
                }
              >
                {wartende[0].p.vor} nachrücken lassen
              </FensterKnopf>
            )}
          </p>
        )}

        <div className={a.leiste}>
          <label className={a.suche}>
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Name oder Nr. suchen"
              aria-label="Name suchen"
              value={suche}
              onChange={(ev) => setSuche(ev.target.value)}
            />
          </label>
          {basis !== 'abgesagt' && (
            <Segment
              verbunden
              ariaLabel="Zeilen"
              value={jePerson ? 'person' : 'anmeldung'}
              options={[
                { value: 'anmeldung', label: 'Je Anmeldung' },
                { value: 'person', label: 'Je Person' },
              ]}
              onChange={(w) => {
                setJePerson(w === 'person');
                setSortierung(null);
              }}
            />
          )}
          <span className={a.rechts}>
            {neuKnopf.kopf}
            <MehrMenue optionen={mehr} handy={handy} titel="Mehr zur Liste" />
          </span>
        </div>

        {gefiltert && (
          <div className={a.filterKopf}>
            <FilterChips
              chips={filterAktiv.map((f) => ({
                spalte: f.spalte,
                name: filterName(e, f.spalte),
                text: filterText(f),
              }))}
              onAendern={filterVomChip}
              onWeg={(k) => setSpaltenFilter((alt) => filterSetzen(alt, k, null))}
              onAlleWeg={() => setSpaltenFilter([])}
              ohneFilter={aktiveAnsicht ? 'Diese Ansicht hat keinen Filter.' : undefined}
              rechts={
                aktiveAnsicht ? (
                  ansichtOffen ? (
                    <>
                      <TextKnopf
                        onClick={() => {
                          const st = ansichtStand(aktiveAnsicht);
                          setSpaltenFilter(st.filter);
                          setSortierung(st.sortierung);
                          setJePerson(st.jePerson);
                        }}
                      >
                        Verwerfen
                      </TextKnopf>
                      {darf && (
                        <FensterKnopf
                          art="hell"
                          onClick={() =>
                            ansichtenAendern((x) => mitAnsichtStand(x, aktiveAnsicht.id, jetzt))
                          }
                        >
                          Änderungen speichern
                        </FensterKnopf>
                      )}
                    </>
                  ) : null
                ) : darf && filterAktiv.length > 0 ? (
                  <FensterKnopf
                    art="hell"
                    onClick={() => {
                      setAnsichtFehler(ansichtPlatzFehler(eA));
                      if (!ansichtPlatzFehler(eA)) setAnsichtFenster('speichern');
                    }}
                  >
                    Als Ansicht speichern
                  </FensterKnopf>
                ) : null
              }
            />
            <p className={a.filterStand} aria-live="polite">
              <b>
                {gezeigt} von {imReiterGesamt}
              </b>{' '}
              {jePerson
                ? imReiterGesamt === 1
                  ? 'Person'
                  : 'Personen'
                : imReiterGesamt === 1
                  ? 'Anmeldung'
                  : 'Anmeldungen'}
            </p>
          </div>
        )}

        {spaltenFehler && (
          <p className={a.hinweisRot} role="alert">
            {spaltenFehler}
          </p>
        )}

        {basis === 'abgesagt' ? (
          absageZeilen.length === 0 ? (
            leer('Niemand hat abgesagt.')
          ) : (
            <AnmeldungenTabelle
              name="Absagen"
              spalten={absageSpalten}
              zeilen={absageZeilen}
              schluessel={(b) => String(b.personId)}
              zelle={absageZelle}
              summe={(k) =>
                k === 'name' ? { text: anzahlText(absageZeilen.length, 'Absage', 'Absagen') } : null
              }
              // Wer ändern darf, holt mit einem Klick zurück (A7-4c).
              onZeile={darf ? (b) => setZurueck({ b, von: null }) : undefined}
            />
          )
        ) : gezeigt === 0 ? (
          leer(
            filter === 'offen'
              ? 'Alle haben bezahlt.'
              : filter === 'warte'
                ? 'Niemand auf der Warteliste.'
                : 'Noch keine Anmeldungen.',
          )
        ) : jePerson ? (
          <AnmeldungenTabelle
            name="Personen"
            spalten={spalten}
            zeilen={personenGezeigt}
            schluessel={personSchluessel}
            zelle={personZelle}
            summe={(k) => personSumme(e, k, personenGezeigt)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(y) => oeffnen(y.x.schluessel)}
            filter={tabellenFilter}
            anheften={{
              an: (y) => oben.has(personSchluessel(y)),
              umschalten: (y) => anheftenUm(personSchluessel(y)),
            }}
          />
        ) : (
          <AnmeldungenTabelle
            name="Anmeldungen"
            spalten={spalten}
            zeilen={zeilen}
            schluessel={(x) => x.schluessel}
            zelle={zelle}
            summe={(k) => summe(e, k, zeilen)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(x) => oeffnen(x.schluessel)}
            filter={tabellenFilter}
            anheften={{
              an: (x) => oben.has(x.schluessel),
              umschalten: (x) => anheftenUm(x.schluessel),
            }}
          />
        )}

        <p className={v.pruefFuss}>
          {jePerson
            ? 'Eine Zeile je Person, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert, der Trichter daneben filtert. Die Summen zählen Personen mit Platz (gefiltert nur die gezeigten); Betrag und Bezahlt gehören der Anmeldung und zählen sie einmal.'
            : 'Eine Zeile je Anmeldung, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert, der Trichter daneben filtert. Die Summen zählen Anmeldungen mit Platz (gefiltert nur die gezeigten). Ältere Anmeldungen ohne Nr. stehen je Person einzeln.'}{' '}
          Die Nadel am Zeilenanfang heftet eine Zeile oben an – nur auf diesem Gerät. Die Leitung
          steht nicht in der Liste.
          {stand!.verlaufGekuerzt &&
            ' Der Verlauf in ChurchTools ist sehr lang – die ältesten Absagen fehlen hier.'}{' '}
          <button type="button" className={a.linkKnopf} onClick={onNeuLaden}>
            Neu laden
          </button>
        </p>
      </section>

      {neuKnopf.schwebend}
      {vonHand && (
        <VonHandFenster
          mitBestaetigung={mitBestaetigung}
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          anmeldeschluss={anmeldeschluss}
          dabei={new Set(stand!.mitglieder.map((m) => m.personId))}
          abgesagt={new Set(stand!.absagen.map((b) => b.personId))}
          dazu={vonHand.dazu}
          onZurueckholen={(personId) => {
            const b = stand!.absagen.find((y) => y.personId === personId);
            if (!b) return;
            setZurueck({ b, von: null, vonHand: { dazu: vonHand.dazu } });
            setVonHand(null);
          }}
          // X schließt alles; „‹“ (im ersten Schritt) und „Abbrechen“ führen bei „Person dazu“ zurück in die Anmeldung
          // (02.11.2026).
          onClose={() => setVonHand(null)}
          zurueck={vonHand.dazu ? () => zurDazuAnmeldung(vonHand.dazu) : undefined}
          onAbbrechen={() => zurDazuAnmeldung(vonHand.dazu)}
          onFertig={(x) => {
            setVonHand(null);
            fertig(x);
          }}
        />
      )}

      {rundmail && (
        <RundmailFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          liste={fuerRundmail}
          gefiltert={filterBeschreibung}
          // Wie der Filter der Liste – „Zahlung offen“ beginnt mit der Zahlungserinnerung.
          startFilter={basis === 'offen' ? 'offen' : basis === 'warte' ? 'warte' : 'alle'}
          onClose={() => setRundmail(false)}
        />
      )}

      {ansichtFenster && (
        <AnsichtFenster
          art={ansichtFenster}
          startName={ansichtFenster === 'umbenennen' ? (aktiveAnsicht?.name ?? '') : ''}
          was={ansichtFenster === 'umbenennen' ? undefined : ansichtWas(ansichtFenster === 'neu')}
          fehler={(name) =>
            ansichtFenster === 'umbenennen'
              ? ansichtNameFehler(eA, name, aktiveAnsicht?.id)
              : (ansichtPlatzFehler(eA) ?? ansichtNameFehler(eA, name))
          }
          onSpeichern={(name) => ansichtSpeichern(ansichtFenster, name)}
          onClose={() => setAnsichtFenster(null)}
        />
      )}

      {filterOffen && basis !== 'abgesagt' && (
        <SpaltenFilterFenster
          key={filterOffen.spalte}
          e={e}
          spalte={filterOffen.spalte}
          filter={filterAktiv.find((f) => f.spalte === filterOffen.spalte) ?? null}
          wer={jePerson ? 'Personen' : 'Anmeldungen'}
          anzahl={(f) => {
            // Wie viele mit den übrigen Filtern UND dieser Antwort übrig blieben – dieselbe Rechnung wie die Tabelle.
            const r = listenAnsicht(e, liste, [], {
              filter: basis,
              spaltenFilter: filterSetzen(filterAktiv, f.spalte, f),
              suche: '',
              sortierung: null,
              jePerson,
              oben: new Set(),
            });
            return jePerson ? r.personenGezeigt.length : r.zeilen.length;
          }}
          anker={filterOffen.anker}
          handy={handy}
          onAnwenden={(f) => {
            setSpaltenFilter((alt) => filterSetzen(alt, filterOffen.spalte, f));
            setFilterOffen(null);
          }}
          onClose={() => setFilterOffen(null)}
        />
      )}

      {spaltenOffen && (
        <SpaltenFenster
          e={e}
          modus={modus}
          wahl={wahl}
          darf={darf}
          onUebernehmen={spaltenUebernehmen}
          onClose={() => setSpaltenOffen(false)}
        />
      )}

      {druck && (
        <DrucklisteFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          gemeinde={gemeinde}
          liste={fuerDruck}
          gefiltert={filterBeschreibung}
          darf={darf}
          onGemerkt={onGespeichert}
          onClose={() => setDruck(false)}
        />
      )}

      {zurueck && (
        <ZurueckFenster
          mitBestaetigung={mitBestaetigung}
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          b={zurueck.b}
          liste={liste}
          onClose={() => setZurueck(null)}
          zurueck={
            zurueck.von !== null || zurueck.vonHand
              ? () => {
                  if (zurueck.von !== null) oeffnen(zurueck.von);
                  else if (zurueck.vonHand) setVonHand(zurueck.vonHand);
                  setZurueck(null);
                }
              : undefined
          }
          onFertig={(x) => {
            setZurueck(null);
            fertig(x);
          }}
        />
      )}

      {fensterX && (
        <AnmeldungAnsehen
          key={fensterX.schluessel}
          x={fensterX}
          e={e}
          kostet={z.kostet}
          onClose={() => oeffnen(null)}
          id={id}
          veranstaltung={veranstaltung}
          zahlarten={zahlarten}
          heute={heute}
          darf={darf && !!ausgewaehlt}
          lage={lage}
          start={startModus}
          meldung={meldung}
          onGemeldet={(neu) => {
            setMeldung(neu);
            setStartModus(null);
            onGespeichert();
          }}
          onRueckgaengig={() => {
            // Nach dem Rückgängigmachen ist „… schickt dabei noch einmal“ erledigt (echte Prüfung 24.10.2026).
            setMeldung((m) => (m?.hinweisBisRueckgaengig ? { ...m, hinweis: undefined } : m));
            onGespeichert();
          }}
          mitBestaetigung={mitBestaetigung}
          onZurueckholen={
            darf && ausgewaehlt
              ? (b) => {
                  setZurueck({ b, von: ausgewaehlt.schluessel });
                  oeffnen(null);
                }
              : undefined
          }
          onPersonDazu={
            darf && ausgewaehlt?.nr
              ? () => {
                  setVonHand({ dazu: ausgewaehlt });
                  oeffnen(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
