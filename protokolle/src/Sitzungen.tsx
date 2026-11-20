import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { TitelWahl } from '@ui/bedienung/TitelWahl';
import { Icon } from '@ui/icons/icons';
import { tagPunkt, datumText } from '@shared/ct/datum';
import { gemeindeZeitzone, heuteImKalender, ortszeitAus, tagAusIso } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { protokollSchluessel, type Sitzung } from '@shared/protokolle/sitzungen';
import { naechsteNach } from '@shared/protokolle/planen';
import type { TeilenRahmen } from './ProtokollTeilen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import {
  ablehnen,
  annehmen,
  aufsNaechsteMal,
  neuerVorschlag,
  offeneFuer,
  uebernommenFuer,
  vorschlagAendern,
  zielSitzung,
  zurueckziehen,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import { ladeMitarbeit, ladeSitzungen, type GruppenSitzungen } from './lesen';
import { VorschlaegeKarte, type VorschlagAktionen } from './Vorschlaege';
import { VorschlagAblehnen, VorschlagFenster } from './VorschlagFenster';
import { vorschlagEinreichen, vorschlagSchreiben } from './vorschlaegeSchreiben';
import { freigabeZuruecknehmen } from './schreiben';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { loeschbar } from '@shared/protokolle/loeschen';
import { ProtokollLoeschen } from './ProtokollLoeschen';
import { kachelVon, uhrzeit } from './anzeige';
import { Etikett } from '@ui/bedienung/Etikett';
import { SitzungAnsicht } from './SitzungAnsicht';
import { ProtokollBeginnen } from './ProtokollBeginnen';
import { ProtokollNachtragen } from './ProtokollNachtragen';
import { NochOhneProtokoll } from './NochOhneProtokoll';
import { SitzungFestlegen } from './SitzungFestlegen';
import { SitzungBearbeiten } from './SitzungBearbeiten';
import { NaechsteSitzung } from './NaechsteSitzung';
import { ProtokollNeu } from './ProtokollNeu';
import { HinzufuegenMenue, type Option } from '@ui/bedienung/OptionWaehlen';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import styles from './Sitzungen.module.scss';

// Der Editor (BlockNote, gut 1 MB) wird erst geladen, wenn die Leitung ein Protokoll schreibt (S4-1) – wer nur liest,
// lädt ihn nie.
const ProtokollSchreiben = lazy(() =>
  import('./ProtokollSchreiben').then((m) => ({ default: m.ProtokollSchreiben })),
);

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: GruppenSitzungen; aufgaben: Aufgabe[]; vorschlaege: Vorschlag[] };

function SitzungZeile({
  s,
  vorschlaege = 0,
  uebernommen = 0,
  onOeffnen,
}: {
  s: Sitzung;
  /** Offene Vorschläge für diese Sitzung (S5-4). */
  vorschlaege?: number;
  /** Übernommene Vorschläge für diese Sitzung – sie stehen nicht mehr in der Karte (W8c). */
  uebernommen?: number;
  onOeffnen: () => void;
}) {
  const k = kachelVon(s.beginn, gemeindeZeitzone());
  const status = s.kopf?.status;
  return (
    <li>
      <button type="button" className={styles.zeile} onClick={onOeffnen}>
        <DatumKachel tag={k.tag} monat={k.monat} gedimmt={!s.kopf} />
        <span className={styles.text}>
          <b>{s.titel}</b>
          <small>
            {datumText(ortszeitAus(s.beginn, gemeindeZeitzone()).slice(0, 10))} ·{' '}
            {uhrzeit(s.beginn, gemeindeZeitzone())}
            {status === 'frei' && s.kopf?.freigabe
              ? ` · freigegeben am ${tagPunkt(s.kopf.freigabe.am.slice(0, 10))}`
              : ''}
          </small>
          {/* Unter dem Datum, nicht daneben – am Handy drückte das Schild den Titel zusammen. */}
          {(vorschlaege > 0 || uebernommen > 0) && (
            <span className={styles.vorschlaege}>
              {vorschlaege > 0 && (
                <Etikett ton="blau">
                  {vorschlaege} {vorschlaege === 1 ? 'Vorschlag' : 'Vorschläge'} offen
                </Etikett>
              )}
              {uebernommen > 0 && (
                <Etikett ton="gruen">
                  {uebernommen} {uebernommen === 1 ? 'Vorschlag' : 'Vorschläge'} übernommen
                </Etikett>
              )}
            </span>
          )}
        </span>
        {status === 'entwurf' && <Etikett ton="neutral">Entwurf</Etikett>}
        {status === 'geplant' && <Etikett ton="neutral">geplant</Etikett>}
        {status === 'frei' && <Etikett ton="gruen">freigegeben</Etikett>}
        <Icon name="chev-right" size={18} />
      </button>
    </li>
  );
}

/**
 * Von der Startseite (S3-3) oder der Suche (S3-4b) gewählt: diese Gruppe – und, wenn angegeben, gleich diese Sitzung
 * öffnen und zu diesem Tagesordnungspunkt springen.
 */
export interface SitzungsAuswahl {
  gruppe: number;
  sitzung?: string;
  /** Block-ID des Tagesordnungspunkts. */
  punkt?: string | null;
}

/**
 * **Reiter „Sitzungen“** (Bauplan S3-2, Entwurf 7): je Gruppe „Kommend“ (Termine mit Besprechungsanfrage,
 * Gruppentreffen, begonnene Protokolle) und „Protokolle“ (freigegeben). Ein Tipp öffnet die Sitzung zum Lesen – einen
 * Entwurf, wenn man schreiben darf (die Leitung), im Editor (S4-1). Ohne Protokoll kann die Leitung es dort beginnen
 * (S5-1); danach öffnet es sich gleich im Editor. Die Leitung legt die nächste Sitzung fest – im Protokoll (Bereich
 * Termine) oder außerordentlich über „Neue Sitzung“ (S5-2, dasselbe Fenster) – und ändert oder sagt sie ab (K2b).
 * Bei mehreren Gruppen wählt man sie oben.
 */
export function Sitzungen({
  modul,
  gruppen,
  ich,
  vollerName = ich.name,
  gemeinde = null,
  schreibbar = [],
  auswahl = null,
}: {
  modul: number;
  gruppen: ProtokollGruppe[];
  /** Wer angemeldet ist – für die Schreibsperre („Alwin schreibt gerade“). */
  ich: { person: number; name: string };
  /** Vor- und Nachname – so steht man unter einem Vorschlag und im Protokoll („vorgeschlagen von …“, S5-4). */
  vollerName?: string;
  /** Name der Gemeinde – oben rechts auf dem PDF eines Protokolls (S6-3b). */
  gemeinde?: string | null;
  /** Kategorien, in denen man schreiben darf (`Start.schreibbar`) – dort öffnet ein Entwurf im Editor (S4-1). */
  schreibbar?: readonly number[];
  auswahl?: SitzungsAuswahl | null;
}) {
  const [gruppeId, setGruppeId] = useState<number | null>(
    auswahl?.gruppe ?? gruppen[0]?.id ?? null,
  );
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [offen, setOffen] = useState<Sitzung | null>(null);
  const [beginnt, setBeginnt] = useState<Sitzung | null>(null);
  // „Protokoll nachtragen“ (v1.0.1): Fenster für frühere Treffen ohne Protokoll.
  const [nachtragen, setNachtragen] = useState(false);
  // „Nächste Sitzung festlegen“ (aus dieser Sitzung) oder „Neue Sitzung“ (S5-2).
  // „Neues Protokoll“ ohne Termin (K2a).
  const [neu, setNeu] = useState(false);
  const [festlegen, setFestlegen] = useState<{
    art: 'naechste' | 'neu';
    bis: Sitzung | null;
  } | null>(null);
  // „Sitzung bearbeiten“ (K2b) – aus der Ansicht oder dem Kasten „Nächste Sitzung“.
  const [bearbeiten, setBearbeiten] = useState<Sitzung | null>(null);
  // Die gewünschte Sitzung gilt nur für das erste Laden – danach bestimmt die Bedienung hier.
  const wunsch = useRef(auswahl?.sitzung);
  const [zuPunkt, setZuPunkt] = useState<string | null>(auswahl?.punkt ?? null);
  // „Öffnen“ im Fenster eines früheren Protokolls (K3b-2): Woher man kam – „Zurück“ führt wieder dorthin.
  const [herkunft, setHerkunft] = useState<string | null>(null);
  // Vorschläge (S5-4): das offene Fenster und eine Meldung, wenn eine Aktion in der Karte scheiterte.
  const [vorschlagFenster, setVorschlagFenster] = useState<
    | { art: 'neu'; id: string }
    | { art: 'aendern'; v: Vorschlag }
    | { art: 'ablehnen'; v: Vorschlag }
    | null
  >(null);
  const [vorschlagFehler, setVorschlagFehler] = useState<string | null>(null);
  // „Freigabe zurücknehmen“ (S6-1): die Rückfrage und, falls es scheitert, warum.
  const [zuruecknehmen, setZuruecknehmen] = useState<{
    laeuft: boolean;
    fehler: string | null;
  } | null>(null);
  // „Löschen“ (W6): die Rückfrage – und danach ein Hinweis in der Liste.
  const [loeschen, setLoeschen] = useState(false);
  const { toast, showToast } = useToast();
  // Handy-Breite: „Neu ⌄“ klappt dort als Blatt von unten auf (`HinzufuegenMenue`).
  const handy = useMedienAbfrage(HANDY_BREITE);
  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0] ?? null;

  const laden = useCallback(() => {
    if (!gruppe) return;
    setZustand({ art: 'laedt' });
    setOffen(null);
    // Das Ziel gilt für das Laden, das es vorfand: Läuft ein zweites Laden schon, bevor das erste fertig ist
    // (React-Prüfmodus, „Erneut versuchen“), hat es dasselbe Ziel – und löscht den Sprung nicht.
    const ziel = wunsch.current;
    Promise.all([
      ladeSitzungen(modul, gruppe, gemeindeZeitzone()),
      ladeMitarbeit(modul, gruppe),
    ]).then(
      ([daten, { aufgaben, vorschlaege }]) => {
        setZustand({ art: 'fertig', daten, aufgaben, vorschlaege });
        if (ziel === undefined) return;
        wunsch.current = undefined;
        const s = [...daten.kommend, ...daten.protokolle].find((x) => x.schluessel === ziel);
        if (s) setOffen(s);
        else setZuPunkt(null);
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppe]);

  useEffect(laden, [laden]);

  // Still nachladen, ohne „Wird geladen …“: Der Editor bleibt offen (er hängt am Zustand „fertig“), nur „Kommend“ und
  // damit die nächste Sitzung sind danach frisch. Scheitert es, bleibt die alte Liste – das nächste Laden holt es nach.
  const nachladen = useCallback(() => {
    if (!gruppe) return;
    Promise.all([
      ladeSitzungen(modul, gruppe, gemeindeZeitzone()),
      ladeMitarbeit(modul, gruppe),
    ]).then(
      ([daten, { aufgaben, vorschlaege }]) => {
        setZustand({ art: 'fertig', daten, aufgaben, vorschlaege });
        // Die offene Sitzung frisch aus der Liste – nach „Bearbeiten“ im Editor stimmen Titel und Zeit im Kopf. Der
        // Editor hängt nur an der Sitzungs-ID, ein neues Objekt lädt ihn nicht neu.
        setOffen(
          (o) =>
            o &&
            ([...daten.kommend, ...daten.protokolle].find((s) => s.schluessel === o.schluessel) ??
              o),
        );
      },
      () => {},
    );
  }, [modul, gruppe]);

  const darfSchreibenIn = (g: ProtokollGruppe) =>
    g.protokolle !== null && schreibbar.includes(g.protokolle);

  const alle =
    zustand.art === 'fertig' ? [...zustand.daten.kommend, ...zustand.daten.protokolle] : [];
  const darfFestlegen =
    !!gruppe &&
    darfSchreibenIn(gruppe) &&
    zustand.art === 'fertig' &&
    zustand.daten.kalender !== null;
  // Bearbeiten darf die Leitung, was nicht freigegeben ist und einen Termin oder ein Protokoll hat (K2b).
  const darfBearbeiten = (s: Sitzung) =>
    !!gruppe &&
    darfSchreibenIn(gruppe) &&
    s.kopf?.status !== 'frei' &&
    (s.termin !== null || s.kopf !== null);
  // „Teilen / PDF“ (S6-3b): mit vollem Namen (sich selbst kennt man auch ohne Mitgliederliste) und der nächsten Sitzung.
  const teilenVon = (s: Sitzung): TeilenRahmen => ({
    gemeinde,
    ich: { person: ich.person, name: vollerName },
    naechste: naechsteNach(s, alle)?.beginn ?? null,
  });
  const naechsteVon = (s: Sitzung) => {
    const n = naechsteNach(s, alle);
    return (
      <NaechsteSitzung
        naechste={n}
        zeitzone={gemeindeZeitzone()}
        onFestlegen={
          darfFestlegen && s.kopf?.status !== 'frei'
            ? () => setFestlegen({ art: 'naechste', bis: s })
            : undefined
        }
        onAendern={
          n && darfBearbeiten(n) && s.kopf?.status !== 'frei' ? () => setBearbeiten(n) : undefined
        }
      />
    );
  };
  const bearbeitenFenster = (geoeffnetImEditor: boolean) =>
    bearbeiten &&
    gruppe &&
    gruppe.protokolle !== null &&
    zustand.art === 'fertig' && (
      <SitzungBearbeiten
        gruppe={gruppe}
        modul={modul}
        kategorie={gruppe.protokolle}
        sitzung={bearbeiten}
        sitzungen={alle}
        ich={ich}
        zeitzone={gemeindeZeitzone()}
        onFertig={() => {
          setBearbeiten(null);
          if (geoeffnetImEditor) {
            nachladen();
            return;
          }
          // Neu laden und die offene Sitzung wieder öffnen – nach einer Absage ist sie weg, dann die Liste.
          if (offen) wunsch.current = offen.schluessel;
          laden();
        }}
        onClose={() => setBearbeiten(null)}
      />
    );
  const festlegenFenster = (geoeffnetImEditor: boolean) =>
    festlegen &&
    gruppe &&
    gruppe.protokolle !== null &&
    zustand.art === 'fertig' &&
    zustand.daten.kalender !== null && (
      <SitzungFestlegen
        art={festlegen.art}
        gruppe={gruppe}
        modul={modul}
        kategorie={gruppe.protokolle}
        kalender={zustand.daten.kalender}
        sitzungen={alle}
        bis={festlegen.bis}
        ich={ich}
        zeitzone={gemeindeZeitzone()}
        onFestgelegt={(id) => {
          setFestlegen(null);
          if (geoeffnetImEditor) {
            nachladen();
            return;
          }
          // Aus der Liste oder der Ansicht: neu laden und die neue Sitzung öffnen.
          if (id !== null) wunsch.current = protokollSchluessel(id);
          laden();
        }}
        onClose={() => setFestlegen(null)}
      />
    );

  // Vorschläge (S5-4) – lesen und schreiben in „Mitarbeit“; jede Aktion liest frisch, schreibt und liest nach.
  const zone = gemeindeZeitzone();
  const heute = heuteImKalender(new Date(), zone);
  const mOrt = gruppe && gruppe.mitarbeit !== null ? { modul, kategorie: gruppe.mitarbeit } : null;
  const ichV = { person: ich.person, name: vollerName };
  const jetzt = () => new Date().toISOString();
  const kommend = zustand.art === 'fertig' ? zustand.daten.kommend : [];
  const vorschlaege = zustand.art === 'fertig' ? zustand.vorschlaege : [];
  const direkt = zustand.art === 'fertig' && zustand.daten.punkte === 'direkt';
  const leitung = !!gruppe && darfSchreibenIn(gruppe);
  const vorschlagSetzen = (v: Vorschlag) =>
    setZustand((z) =>
      z.art !== 'fertig'
        ? z
        : {
            ...z,
            vorschlaege: z.vorschlaege.some((x) => x.id === v.id)
              ? z.vorschlaege.map((x) => (x.id === v.id ? v : x))
              : [...z.vorschlaege, v],
          },
    );
  const vorschlagTun = async (id: string, f: (v: Vorschlag) => Vorschlag) => {
    if (!mOrt) return;
    setVorschlagFehler(null);
    try {
      vorschlagSetzen(await vorschlagSchreiben(mOrt, id, f));
    } catch (e) {
      setVorschlagFehler(fehlerMeldung(e).text);
    }
  };
  // Übernehmen und „Nächstes Mal“ brauchen eine festgelegte Sitzung; ablehnen geht immer.
  const vorschlagAktionen = (s: Sitzung | null): VorschlagAktionen => ({
    aendern: (v) => setVorschlagFenster({ art: 'aendern', v }),
    zurueckziehen: (v) => vorschlagTun(v.id, (x) => zurueckziehen(x, ichV, jetzt())),
    ...(leitung && s
      ? {
          uebernehmen: (v: Vorschlag) => vorschlagTun(v.id, (x) => annehmen(x, s, ichV, jetzt())),
          naechstesMal: (v: Vorschlag) =>
            vorschlagTun(v.id, (x) => aufsNaechsteMal(x, s, ichV, jetzt())),
        }
      : {}),
    ...(leitung ? { ablehnen: (v: Vorschlag) => setVorschlagFenster({ art: 'ablehnen', v }) } : {}),
  });
  const offeneFuerZeile = (s: Sitzung) => offeneFuer(vorschlaege, s, kommend, heute, zone).length;
  const uebernommenFuerZeile = (s: Sitzung) =>
    uebernommenFuer(vorschlaege, s, kommend, heute, zone);
  const vorschlagFensterAnzeigen = () => {
    if (!vorschlagFenster || !gruppe || !mOrt) return null;
    if (vorschlagFenster.art === 'ablehnen') {
      const v = vorschlagFenster.v;
      return (
        <VorschlagAblehnen
          vorschlag={v}
          onAblehnen={async (grund) => {
            vorschlagSetzen(
              await vorschlagSchreiben(mOrt, v.id, (x) => ablehnen(x, grund, ichV, jetzt())),
            );
            setVorschlagFenster(null);
          }}
          onClose={() => setVorschlagFenster(null)}
        />
      );
    }
    const f = vorschlagFenster;
    const vorher = f.art === 'aendern' ? f.v : null;
    return (
      <VorschlagFenster
        gruppe={gruppe.name}
        sitzungen={kommend.filter((s) => tagAusIso(s.beginn, zone) >= heute)}
        vorher={vorher}
        jetzt={vorher ? zielSitzung(vorher, kommend, heute, zone) : null}
        direkt={direkt}
        zeitzone={zone}
        onSpeichern={async (x) => {
          vorschlagSetzen(
            f.art === 'aendern'
              ? await vorschlagSchreiben(mOrt, f.v.id, (y) => vorschlagAendern(y, x, ichV, jetzt()))
              : await vorschlagEinreichen(
                  mOrt,
                  neuerVorschlag({ id: f.id, gruppe: gruppe.id, ...x, ich: ichV, am: jetzt() }),
                ),
          );
          setVorschlagFenster(null);
        }}
        onClose={() => setVorschlagFenster(null)}
      />
    );
  };

  // Gelöscht (W6): zurück zur Liste der Gruppe – gibt es Termin oder Treffen noch, steht die Sitzung dort wieder „ohne
  // Protokoll“ (das ergibt das Laden von selbst).
  const geloescht = () => {
    setLoeschen(false);
    setOffen(null);
    setZuPunkt(null);
    setHerkunft(null);
    showToast('Protokoll gelöscht');
    laden();
  };

  if (!gruppe)
    return (
      <p className={styles.ruhig}>Du bist in keiner Gruppe, die hier Protokolle führen kann.</p>
    );

  if (
    offen?.kopf?.status === 'entwurf' &&
    zustand.art === 'fertig' &&
    gruppe.protokolle !== null &&
    darfSchreibenIn(gruppe)
  )
    return (
      <Suspense fallback={<p className={styles.ruhig}>Editor wird geladen …</p>}>
        {festlegenFenster(true)}
        {bearbeitenFenster(true)}
        <ProtokollSchreiben
          sitzung={offen}
          gruppe={gruppe.name}
          gruppeId={gruppe.id}
          modul={modul}
          kategorie={gruppe.protokolle}
          mitarbeit={gruppe.mitarbeit}
          protokolle={zustand.daten.protokolle}
          teile={zustand.daten.teile}
          ich={ich}
          zeitzone={gemeindeZeitzone()}
          naechste={naechsteVon(offen)}
          teilen={teilenVon(offen)}
          kommend={kommend}
          direkt={direkt}
          vollerName={vollerName}
          onVorschlag={vorschlagSetzen}
          onFreigegeben={() => {
            // Neu laden und gleich wieder öffnen – jetzt zum Lesen, mit „freigegeben am … von …“.
            wunsch.current = offen.schluessel;
            laden();
          }}
          onBearbeiten={darfBearbeiten(offen) ? () => setBearbeiten(offen) : undefined}
          onGeloescht={geloescht}
          onZurueck={(geaendert) => {
            setOffen(null);
            if (geaendert) laden();
          }}
          onZuSitzung={(s, geaendert) => {
            setHerkunft(offen.schluessel);
            setZuPunkt(null);
            if (!geaendert) {
              setOffen(s);
              return;
            }
            // Gespeichert: neu laden (wie „Zurück“) und danach gleich das gewählte Protokoll öffnen.
            wunsch.current = s.schluessel;
            laden();
          }}
        />
      </Suspense>
    );

  const darfSchreiben = darfSchreibenIn(gruppe);
  /**
   * **Alles, was etwas hinzufügt, in EINEM grünen Knopf „Neu ⌄“** (B6, R3/E14) – vorher vier Knöpfe in der Kopfzeile von
   * „Kommend“, zwei davon grün. „Protokoll nachtragen“ ist seltener und steht hinter einer Linie. „Neue Sitzung“ braucht
   * einen Kalender – wer sie darf, darf also immer auch schreiben. Ohne Recht bleibt „Punkt vorschlagen“ allein.
   */
  const neuOptionen: Option[] = [
    ...(darfSchreiben
      ? [{ label: 'Neues Protokoll', onClick: () => setNeu(true) } satisfies Option]
      : []),
    ...(darfFestlegen
      ? [
          {
            label: 'Neue Sitzung',
            onClick: () => setFestlegen({ art: 'neu', bis: null }),
          } satisfies Option,
        ]
      : []),
    ...(mOrt
      ? [
          {
            label: 'Punkt vorschlagen',
            onClick: () => setVorschlagFenster({ art: 'neu', id: crypto.randomUUID() }),
          } satisfies Option,
        ]
      : []),
    ...(darfSchreiben
      ? [
          {
            label: 'Protokoll nachtragen',
            // Die Linie trennt das Seltenere vom Übrigen („Neues Protokoll“ steht für jeden, der nachtragen darf, davor).
            trenner: true,
            onClick: () => setNachtragen(true),
          } satisfies Option,
        ]
      : []),
  ];
  // „Protokoll beginnen“ – aus der geöffneten Sitzung, aus „Noch ohne Protokoll“ und aus „Protokoll nachtragen“.
  const beginnenFenster = () =>
    beginnt &&
    gruppe.protokolle !== null &&
    zustand.art === 'fertig' && (
      <ProtokollBeginnen
        sitzung={beginnt}
        gruppeId={gruppe.id}
        modul={modul}
        kategorie={gruppe.protokolle}
        mitarbeit={gruppe.mitarbeit}
        protokolle={zustand.daten.protokolle}
        teile={zustand.daten.teile}
        ich={ich}
        zeitzone={gemeindeZeitzone()}
        frueher={beginnt.kopf === null && tagAusIso(beginnt.beginn, zone) < heute}
        onBegonnen={(id) => {
          // Neu laden und gleich dieses Protokoll öffnen – als Entwurf im Editor (S4-1).
          setBeginnt(null);
          wunsch.current = protokollSchluessel(id);
          laden();
        }}
        onClose={() => setBeginnt(null)}
      />
    );

  if (offen && zustand.art === 'fertig')
    return (
      <>
        <SitzungAnsicht
          sitzung={offen}
          gruppe={gruppe.name}
          gruppeId={gruppe.id}
          protokolle={zustand.daten.protokolle}
          teile={zustand.daten.teile}
          aufgaben={zustand.aufgaben}
          zeitzone={gemeindeZeitzone()}
          springeZu={zuPunkt}
          naechste={naechsteVon(offen)}
          teilen={teilenVon(offen)}
          onBeginnen={darfSchreiben ? () => setBeginnt(offen) : undefined}
          onBearbeiten={darfBearbeiten(offen) ? () => setBearbeiten(offen) : undefined}
          onZuruecknehmen={
            darfSchreiben && offen.kopf?.status === 'frei'
              ? () => setZuruecknehmen({ laeuft: false, fehler: null })
              : undefined
          }
          onLoeschen={
            darfSchreiben && gruppe.protokolle !== null && loeschbar(offen.kopf?.status)
              ? () => setLoeschen(true)
              : undefined
          }
          onZurueck={() => {
            setZuPunkt(null);
            setHerkunft(null);
            setOffen(
              (herkunft &&
                [...zustand.daten.kommend, ...zustand.daten.protokolle].find(
                  (x) => x.schluessel === herkunft,
                )) ||
                null,
            );
          }}
          onZuSitzung={(s) => {
            setHerkunft(offen.schluessel);
            setZuPunkt(null);
            setOffen(s);
          }}
        />
        {beginnenFenster()}
        {festlegenFenster(false)}
        {bearbeitenFenster(false)}
        {loeschen && offen.kopf && gruppe.protokolle !== null && (
          <ProtokollLoeschen
            sitzung={offen}
            gruppe={{ id: gruppe.id, protokolle: gruppe.protokolle, mitarbeit: gruppe.mitarbeit }}
            modul={modul}
            ich={ichV}
            zeitzone={gemeindeZeitzone()}
            aufgaben={zustand.aufgaben}
            onFertig={geloescht}
            onClose={() => setLoeschen(false)}
          />
        )}
        {zuruecknehmen && offen.kopf && gruppe.protokolle !== null && (
          <ConfirmDialog
            title="Freigabe zurücknehmen?"
            message="Das Protokoll wird wieder ein Entwurf und lässt sich bearbeiten. Im Protokoll steht, wer es wann zurückgenommen hat. Das Gruppentreffen bleibt abgeschlossen, ein Beitrag in der Gruppe bleibt stehen. Beim nächsten Freigeben kannst du wieder Bescheid geben."
            confirmLabel="Zurücknehmen"
            beschaeftigt={zuruecknehmen.laeuft}
            onConfirm={() => {
              const ort = { modul, kategorie: gruppe.protokolle!, sitzung: offen.kopf!.sitzung };
              setZuruecknehmen({ laeuft: true, fehler: null });
              freigabeZuruecknehmen(ort, ichV).then(
                () => {
                  setZuruecknehmen(null);
                  wunsch.current = offen.schluessel;
                  laden();
                },
                (e: unknown) => setZuruecknehmen({ laeuft: false, fehler: fehlerMeldung(e).text }),
              );
            }}
            onCancel={() => setZuruecknehmen(null)}
          >
            {zuruecknehmen.fehler && <p role="alert">{zuruecknehmen.fehler}</p>}
          </ConfirmDialog>
        )}
      </>
    );

  return (
    <div className={styles.seite}>
      {toast && <Toast message={toast} />}
      <div className={styles.kopf}>
        {/* Die Überschrift ist die Gruppenwahl (eine Gruppe: einfache Überschrift) – keine Leiste, die am Handy überläuft. */}
        <TitelWahl
          optionen={gruppen.map((g) => ({ wert: String(g.id), text: g.name }))}
          wert={String(gruppe.id)}
          onWahl={(v) => setGruppeId(Number(v))}
        />
        {/* Ein grüner Knopf für alles, was etwas hinzufügt (R3/E14: „Immer wenn was Grünes kommt, ist es etwas hinzufügen“). */}
        {zustand.art === 'fertig' && (
          <HinzufuegenMenue label="Neu" titel="Neu" pfeil handy={handy} optionen={neuOptionen} />
        )}
      </div>
      {zustand.art === 'laedt' && <p className={styles.ruhig}>Wird geladen …</p>}
      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />}
      {zustand.art === 'fertig' && (
        <>
          {darfSchreiben && gruppe.protokolle !== null && (
            <NochOhneProtokoll
              modul={modul}
              gruppe={gruppe}
              daten={zustand.daten}
              zeitzone={zone}
              onBeginnen={setBeginnt}
            />
          )}
          <section className={styles.karte} aria-labelledby="kommend">
            <div className={styles.kartenkopf}>
              <h3 id="kommend">Kommend</h3>
              <span className={styles.anzahl}>{zustand.daten.kommend.length}</span>
            </div>
            {zustand.daten.kommend.length ? (
              <ul className={styles.liste}>
                {zustand.daten.kommend.map((s) => (
                  <SitzungZeile
                    key={s.schluessel}
                    s={s}
                    vorschlaege={offeneFuerZeile(s)}
                    uebernommen={uebernommenFuerZeile(s)}
                    onOeffnen={() => setOffen(s)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>Keine kommenden Sitzungen.</p>
            )}
            {zustand.daten.kalender === null && (
              <p className={styles.fuss}>
                Für diese Gruppe ist noch kein Kalender gewählt – Termine erscheinen, sobald ein
                Admin ihn in der Verwaltung festlegt.
              </p>
            )}
            {zustand.daten.treffenNichtFreigegeben && (
              <p className={styles.fuss}>
                Die Gruppentreffen dieser Gruppe sind für dich in ChurchTools nicht freigegeben –
                hier stehen nur die Termine aus dem Kalender.
              </p>
            )}
          </section>
          {mOrt && (
            <VorschlaegeKarte
              gruppe={gruppe.id}
              leitung={leitung}
              liste={vorschlaege}
              kommend={kommend}
              heute={heute}
              zeitzone={zone}
              ich={ich.person}
              direkt={direkt}
              aktionen={vorschlagAktionen}
              fehler={vorschlagFehler}
            />
          )}
          {vorschlagFensterAnzeigen()}
          {festlegenFenster(false)}
          {beginnenFenster()}
          {nachtragen && gruppe.protokolle !== null && (
            <ProtokollNachtragen
              gruppeId={gruppe.id}
              gruppeName={gruppe.name}
              modul={modul}
              kategorie={gruppe.protokolle}
              mitarbeit={gruppe.mitarbeit}
              kalender={zustand.daten.kalender}
              kommend={zustand.daten.kommend}
              protokolle={zustand.daten.protokolle}
              teile={zustand.daten.teile}
              ich={ich}
              zeitzone={zone}
              onBegonnen={(id) => {
                setNachtragen(false);
                wunsch.current = protokollSchluessel(id);
                laden();
              }}
              onClose={() => setNachtragen(false)}
            />
          )}
          {neu && (
            <ProtokollNeu
              modul={modul}
              gruppen={gruppen.filter(darfSchreibenIn)}
              start={gruppe.id}
              ich={ich}
              zeitzone={gemeindeZeitzone()}
              onAngelegt={(g, id) => {
                // Die neue Sitzung gleich im Editor öffnen – auch, wenn im Fenster eine andere Gruppe gewählt wurde.
                setNeu(false);
                wunsch.current = protokollSchluessel(id);
                if (g === gruppe.id) laden();
                else setGruppeId(g);
              }}
              onClose={() => setNeu(false)}
            />
          )}
          <section className={styles.karte} aria-labelledby="protokolle">
            <div className={styles.kartenkopf}>
              <h3 id="protokolle">Protokolle</h3>
              <span className={styles.anzahl}>{zustand.daten.protokolle.length}</span>
            </div>
            {zustand.daten.protokolle.length ? (
              <ul className={styles.liste}>
                {zustand.daten.protokolle.map((s) => (
                  <SitzungZeile key={s.schluessel} s={s} onOeffnen={() => setOffen(s)} />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>Noch keine freigegebenen Protokolle.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
