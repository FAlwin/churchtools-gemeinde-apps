import { lazy, Suspense, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@ui/icons/icons';
import { AnsichtWahl } from '@ui/bedienung/AnsichtWahl';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import type { Option } from '@ui/bedienung/OptionWaehlen';
import { HilfeFenster } from '@ui/bedienung/HilfeKnopf';
import { HILFE_PLANEN } from './hilfeTexte';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { tagKurz } from '@shared/ct/datum';
import type { TerminVorlage } from '@shared/ct/terminVorlagen';
import { gruppenName, nimmtEintraegeAn, type PlanGruppe } from '@shared/dienstplan/plan';
import type { Dienst } from '@shared/ct/dienste';
import { gezeigteGruppen } from '@shared/dienstplan/planFilter';
import { fokusKandidaten, fokusTexte, fokusZahlen } from '@shared/dienstplan/fokus';
import { terminFilter, WEITERE } from '@shared/dienstplan/termine';
import { zeitraumText, zeitraumVerschieben, type Zeitraum } from '@shared/ct/zeitraum';
import { planenZeitraum } from '@shared/dienstplan/start';
import type { TermineZustand } from './Termine';
import type { TermineDaten } from './ladeTermine';
import { ZeitraumKnopf } from '@ui/bedienung/ZeitraumKnopf';
import {
  ansichtAus,
  gruppenAus,
  leseAnsicht,
  merkeAnsicht,
  type PlanenAnsicht,
} from './planenAnsicht';
import { gruppenAbschnitt } from './gruppenAbschnitt';
import { terminAbschnitte } from './terminAbschnitte';
import { useBreite } from './useBreite';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { PlaetzeFach } from './PlaetzeFach';
import { PlatzFenster } from './PlatzFenster';
import { ErinnernFenster, type ErinnernAnschluss } from './ErinnernFenster';
import { usePlatzDazu } from './usePlatzDazu';
import { usePlaetzeFrisch } from './usePlaetzeFrisch';
import { AlteEntwuerfeFach, type AlterEntwurf } from './AlteEntwuerfeFach';
import { listeGrundText, type EntwurfAnschluss } from './ladeEntwuerfe';
import { useListeBearbeiten } from './useListeBearbeiten';
import { PersonFenster } from './PersonFenster';
import { TagsVerwaltenFenster } from './TagsVerwaltenFenster';
import {
  pauseSetzen,
  reiheNachZiehen,
  reiheSetzen,
  tagListeSetzen,
  tagsSetzen,
  tagsSchluessel,
} from '@shared/dienstplan/personenliste';
import { AblaufFertigKnopf } from './MatrixAblauf';
import { ablaufBearbeitenMoeglich, ablaufBearbeitenStart } from './ablaufBearbeiten';
import { useMatrixAblauf } from './useMatrixAblauf';
import { useMatrixInfos } from './useMatrixInfos';
import type { Start } from './start';
import { schluessel, type Sicht, darfPlanen } from './planSicht';
import { Terminleiste } from './Terminleiste';
import { TabellenPlan, HandyPlan } from './PlanAnsicht';
import { WerWieOft } from './WerWieOft';
import { PersonenRaster } from './PersonenRaster';
import type { PersonenLader } from './ladePersonen';
import type { AntwortenLader } from './ladeAntworten';
import { dienstFarben } from './personenFarben';
import { fehlerHinweis, useEinteilen, type WerKannZurueck } from './useEinteilen';
import { VorgabeFach } from './VorgabeFach';
import { modusFuerDienst, vorgabeFuerAlle, vorgabeSetzen } from '@shared/dienstplan/modusVorgabe';
import { FokusLeiste, FokusSuche, type FokusPerson } from './Fokus';
import {
  entwurfAmPlatz,
  plaetzeZeile,
  plaetzeZeilen,
  vorlageFuer,
  type DiensteKatalog,
} from './planEntwuerfe';
import { plaetzeStand } from '@shared/dienstplan/platzNachEntwurf';
import { usePlanZeitraum } from './usePlanZeitraum';
import styles from './Planen.module.scss';

interface Props {
  zustand: TermineZustand;
  /** Schmaler Bildschirm: ein Termin auf einmal statt der Tabelle (Entwurf v17). */
  handy: boolean;
  onNochmal: () => void;
  /** Nach dem Senden leise neu laden (ohne „wird geladen“) – die Matrix zeigt dann, was in ChurchTools steht. */
  onAktualisieren?: () => void;
  /** Weitere Wochen „ab heute“ nachladen – die Terminleiste ruft das am Ende selbst auf. */
  onMehr: () => void;
  /** Lassen sich „ab heute“ noch weitere Wochen nachladen? */
  mehrMoeglich: boolean;
  /** Einen gewählten Zeitraum laden (Monat, von–bis) – nur für die Matrix, Start und Dienste (Reiter `termine`) bleiben. */
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  /** Heute (`YYYY-MM-DD`, Ortszeit der Gemeinde). */
  heute: string;
  /** Eintragen als Entwurf (E4-3) – ohne Anschluss bleibt „Wer kann?“ nur zum Ansehen. */
  entwuerfe?: EntwurfAnschluss;
  /** Termin öffnen → Termin-Ansicht mit Ablauf und Diensten (E6-1b). */
  onTermin?: (id: number) => void;
  /** Der Ablauf in der Matrix (E6-6a) – ohne steht die Matrix ohne die Gruppe „Ablauf“ da. */
  ablauf?: { start: Start; zeitzone: string };
  /**
   * Alle Dienste der Gemeinde fürs Plätze-Fach – auch die ohne Platz im Zeitraum (`katalogAus(start)`). Ohne stehen im
   * Fach nur die Dienste, die die Matrix zeigt.
   */
  katalog?: DiensteKatalog;
  /**
   * Die Terminvorlagen von ChurchTools für „Vorlage übernehmen“ im Plätze-Fach – geladen wird beim Öffnen des Fachs.
   * Ohne bleibt das Fach ohne Vorlagen-Bereich.
   */
  ladeVorlagen?: () => Promise<TerminVorlage[]>;
  /**
   * Mitglieder und Abwesenheiten der CT-Gruppen für die Ansicht „Personen“ (Wunsch 5, P1). Ohne zeigt die Ansicht nur
   * die Eingeteilten.
   */
  ladePersonen?: PersonenLader;
  /**
   * Die Antworten aus „Wann kann ich?“ für die Ansicht „Personen“ (E5c-3) – Ja/Vielleicht färben die Zellen. Ohne zeigt die
   * Ansicht keine Antworten (und sagt es).
   */
  ladeAntworten?: AntwortenLader;
  /**
   * „Erinnern“ (E5c-5): wie die Mail verschickt wird und wohin ihr Knopf führt. Ohne – oder ohne `ladePersonen` und
   * `ladeAntworten`, aus denen sich „fehlt noch“ rechnet – gibt es den Knopf nicht.
   */
  erinnern?: ErinnernAnschluss;
  /**
   * Von der Startseite (Wunsch 7, `#/planen/gruppe/3`): nur diese Dienstgruppe und die nächsten 6 Wochen – nur für diesen
   * Besuch, der gemerkte Filter und Zeitraum bleiben. `null`/fehlt: Planen wie gewohnt.
   */
  fokusGruppe?: number | null;
  /** „Gewohnte Ansicht“ – zurück zu Planen mit dem gemerkten Filter. */
  onFokusEnde?: () => void;
  /**
   * Die Seite „Ablaufvorlagen“ öffnen (E10-V3a): Knopf „Vorlagen“ links neben „Ablauf bearbeiten“. Ohne steht der Knopf
   * nicht da (Tests ohne die Seite).
   */
  onVorlagen?: () => void;
  /**
   * Wohin die Lupe „Person hervorheben“ kommt (R7/E5): der Platz rechts neben den Reitern, den die App im Seitenkopf frei
   * hält. Am Handy sitzt die Lupe in der Werkzeugzeile; ohne Platz (Tests ohne Seitenkopf) steht sie am Rechner dort auch.
   */
  lupeOrt?: HTMLElement | null;
}

/**
 * „Plan teilen“ (E8-2) erst beim Antippen laden – es bringt pdf.js mit; beim Start legte das sonst einen Worker an (wie
 * „Termin teilen“ in der Termin-Ansicht).
 */
const PlanTeilenFenster = lazy(() =>
  import('./PlanTeilenFenster').then((m) => ({ default: m.PlanTeilenFenster })),
);

/**
 * **Planen** (Bauplan E3-4/E3-5, Entwurf v17): Termine als Spalten, Dienstgruppen und Dienste als Zeilen,
 * in jeder Zelle die Plätze. Darüber die Terminleiste mit dem **Zeitraum-Knopf** (Alwin, 14.10.2026): ab heute
 * (passend zur Fensterbreite, ‹ ＋ ＋ › blättern und laden am Ende selbst nach), ein Monat oder ein eigener
 * Zeitraum – dann stehen alle Termine des Bereichs da, und ‹ › springen um den ganzen Bereich. Dazu Filter,
 * Spaltenbreite und „Wer wie oft?“. Eingeteilt wird über Entwürfe (E4): freien Platz antippen → „Wer kann?“,
 * belegten Platz → zurückziehen oder ersetzen (E4-5), gesendet über die Leiste unten; der Regler in der Gruppenzeile
 * ändert die Anzahl der Plätze (E4-5-3, sofort). Am Handy: eine Datumsleiste
 * und darunter ein Termin.
 */
export function Planen({
  zustand,
  handy,
  onNochmal,
  onAktualisieren,
  onMehr,
  mehrMoeglich,
  ladeZeitraum,
  heute,
  entwuerfe,
  onTermin,
  ablauf,
  katalog,
  ladeVorlagen,
  ladePersonen,
  ladeAntworten,
  erinnern,
  fokusGruppe = null,
  onFokusEnde,
  onVorlagen,
  lupeOrt = null,
}: Props) {
  const [gemerkt, setGemerkt] = useState<PlanenAnsicht>(leseAnsicht);
  // Ein Besuch von der Startseite (Wunsch 7): Zeitraum, Gruppen und Dienste gelten nur hier – `aus: null` heißt „alle
  // außer der Gruppe“, ausgerechnet, sobald der Plan da ist; von den Diensten der Gruppe ist keiner ausgeblendet
  // (`ausDienste`, Wunsch 10). Alles andere (Breite, Ablauf zu …) wird wie immer gemerkt.
  const [besuch, setBesuch] = useState<{
    gruppe: number;
    zeitraum: Zeitraum;
    aus: string[] | null;
    ausDienste: number[];
  } | null>(() =>
    fokusGruppe === null
      ? null
      : { gruppe: fokusGruppe, zeitraum: planenZeitraum(heute), aus: null, ausDienste: [] },
  );
  let ansicht: PlanenAnsicht = besuch
    ? { ...gemerkt, zeitraum: besuch.zeitraum, ausgeblendeteDienste: besuch.ausDienste }
    : gemerkt;
  const setAnsicht = (a: PlanenAnsicht) => {
    const neu = besuch
      ? {
          ...a,
          zeitraum: gemerkt.zeitraum,
          ausgeblendeteGruppen: gemerkt.ausgeblendeteGruppen,
          ausgeblendeteDienste: gemerkt.ausgeblendeteDienste,
        }
      : a;
    // Nur wer Gruppen oder Dienste wirklich ändert, macht aus „nur diese Gruppe“ eine eigene Auswahl (nicht schon „Breite“).
    if (besuch) {
      const gleich = a.ausgeblendeteGruppen.join('|') === ansicht.ausgeblendeteGruppen.join('|');
      const gleicheDienste =
        a.ausgeblendeteDienste.join('|') === ansicht.ausgeblendeteDienste.join('|');
      setBesuch({
        ...besuch,
        zeitraum: a.zeitraum,
        aus: gleich ? besuch.aus : a.ausgeblendeteGruppen,
        ausDienste: gleicheDienste ? besuch.ausDienste : a.ausgeblendeteDienste,
      });
    }
    setGemerkt(neu);
    merkeAnsicht(neu);
  };
  const matrixAblauf = useMatrixAblauf(ablauf, ansicht.ablaufZu, (ablaufZu) =>
    setAnsicht({ ...ansicht, ablaufZu }),
  );
  const matrixInfos = useMatrixInfos(ablauf, ansicht.infosZu, (infosZu) =>
    setAnsicht({ ...ansicht, infosZu }),
  );
  const [zu, setZu] = useState<Set<string> | null>(null);
  // Der Fokus-Modus (Wunsch 11, Alwin 16.11.2026): **eine** Person, deren Plätze in Matrix, Zettel und „Personen“
  // umrandet sind. Der Zustand sitzt nur hier – die Ansichten lesen ihn über `Sicht.fokusId` – und gilt, solange
  // Planen offen ist: Ansichtswechsel und Blättern lassen ihn stehen, Verlassen von Planen beendet ihn (die Seite wird
  // dann abgebaut); gemerkt wird er nicht. `zurueck` ist der Weg zurück zu „Wer kann?“, wenn er von dort kam.
  const [fokusPerson, setFokusPerson] = useState<{
    person: FokusPerson;
    zurueck: WerKannZurueck | null;
  } | null>(null);
  const [fokusEintragen, setFokusEintragen] = useState(false);
  // Das Fenster „Vorgabe · Dienst“ (P2m): welcher Dienst – die Vorgabe selbst steht in `ansicht.direktDienste` (je Gerät).
  const [vorgabeFach, setVorgabeFach] = useState<{ id: number; name: string } | null>(null);
  // Das Plätze-Fach (E4-5-3): Termin und Gruppe – beim Zeichnen aus dem AKTUELLEN Plan geholt (s. dort).
  const [plaetzeFach, setPlaetzeFach] = useState<{ eventId: number; gruppe: PlanGruppe } | null>(
    null,
  );
  // Das Fenster für EINEN Dienst an einem Termin (P2c, Zeile „Plätze“ und roter Tag in „Personen“): Termin und Dienst.
  const [platzFenster, setPlatzFenster] = useState<{ eventId: number; dienst: Dienst } | null>(
    null,
  );
  const [rahmen, platz] = useBreite();

  // Zeitraum, was dafür geladen ist und welcher Ausschnitt zu sehen ist – `usePlanZeitraum`.
  const {
    werWieOft,
    z,
    setzeZeitraum,
    bereich,
    quelle,
    zeitraumNeu,
    plan,
    d,
    f,
    imFenster,
    kannNachladen,
    nachladen,
    gehe,
    waehleZeitraum,
    nimmDazu,
    teilenSpalten,
    zeile1,
    zeile2,
    leiseNeuLaden,
  } = usePlanZeitraum({
    ansicht,
    setAnsicht,
    zustand,
    heute,
    ladeZeitraum,
    platz,
    handy,
    mehrMoeglich,
    onMehr,
    onAktualisieren,
  });
  // Erst mit dem Plan steht fest, welche Gruppen es gibt – beim Besuch sind alle außer der einen ausgeblendet.
  const besuchGruppe = besuch && plan?.gruppen.find((g) => g.gruppe?.id === besuch.gruppe);
  if (besuch) {
    ansicht = {
      ...ansicht,
      ausgeblendeteGruppen:
        besuch.aus ??
        (plan?.gruppen ?? []).map(schluessel).filter((k) => k !== String(besuch.gruppe)),
    };
  }

  // Einteilen über Entwürfe (E4/E5) – Fenster, Leiste und was die Plätze bekommen; dieselben in der Termin-Ansicht (F1).
  const {
    ew,
    daten,
    ewNeu,
    ewSetzeListe,
    lage,
    showToast,
    amPlatz,
    leiste: sendeLeiste,
    fenster,
    werKannOeffnen,
    eintragenMoeglich,
    trageEin,
    amPersonen,
  } = useEinteilen({
    plan,
    entwuerfe,
    heute,
    handy,
    onGesendet: leiseNeuLaden,
    antwortenLader: ladeAntworten,
    // Womit ein neuer Entwurf beginnt – je Dienst, gemerkt je Gerät (P2m); „Wer kann?“, „Personen“, Zauberstab fragen hier.
    modusFuer: (dienstId) => modusFuerDienst(ansicht.direktDienste, dienstId),
    fokus: {
      hervorheben: (person) => setFokusPerson({ person, zurueck: null }),
      zeigen: (person, zurueck) => setFokusPerson({ person, zurueck }),
    },
  });
  // „Liste bearbeiten“ (PL-2): der Modus und das Speichern der Personenliste je Dienstgruppe.
  const liste = useListeBearbeiten({ entwuerfe, daten, setzeListe: ewSetzeListe });
  // Die offenen Fenster dazu: das Personen-Fenster (Tags und Pause bei diesem Dienst) und „Tags verwalten“.
  const [listeFenster, setListeFenster] = useState<
    | { art: 'person'; dienst: Dienst; personId: number; name: string }
    | { art: 'tags'; gruppeId: number }
    | null
  >(null);
  // Nach einer Platzänderung Plan und Entwürfe gemeinsam neu – bis beide da sind, sperren die Plätze-Fenster.
  const plaetzeFrisch = usePlaetzeFrisch({
    plan,
    daten,
    planNeu: leiseNeuLaden,
    entwuerfeNeu: ewNeu,
    showToast,
  });
  /**
   * **Die Platzzahl ändern** (Regler, Plätze-Fach, „Platz dazunehmen“): der Anschluss trägt die Entwürfe des Dienstes mit um
   * (19.11.2026, `anzahlMitEntwuerfen`) – danach müssen Plan **und** Entwürfe neu geladen werden, und zwar sofort, nicht erst
   * beim Schließen: Sonst rechnet das offene Fenster mit neuen Entwurfs-Nummern auf alten Plätzen (`usePlaetzeFrisch`).
   * Die Fenster gibt es nur mit Anschluss; ohne ihn kommt „nicht bestätigt“ zurück.
   */
  const anzahlSetzen = async (
    eventId: number,
    serviceId: number,
    gesehen: number,
    neu: number,
  ): Promise<AnzahlErgebnis> => {
    if (!entwuerfe) return { ok: false, grund: 'voruebergehend' };
    const r = await entwuerfe.anzahl(eventId, serviceId, gesehen, neu);
    if (r.ok && r.anzahl !== gesehen) {
      const e = r.entwuerfe;
      plaetzeFrisch.geaendert(!!e && (e.umgetragen.length > 0 || e.offen > 0 || e.unklar));
    }
    return r;
  };
  // „Platz dazunehmen“ im Fenster „Dienst voll“ (P2c): Platz in ChurchTools, nach dem Neuladen der Entwurf.
  const dazunehmen = usePlatzDazu({
    plan,
    entwuerfe,
    daten,
    anzahl: anzahlSetzen,
    personen: amPersonen,
    neuLaden: leiseNeuLaden,
    showToast,
  });
  // Das Fach „Alte Entwürfe“ (offen mit der Liste, beim Öffnen festgehalten).
  const [alteListe, setAlteListe] = useState<AlterEntwurf[] | null>(null);
  // „Plan teilen“ (E8-2): geteilt werden die Termine, die gerade zählen – dieselben wie in der Aufschrift des
  // Zeitraum-Knopfs – und die eingeblendeten Gruppen.
  const [teilenOffen, setTeilenOffen] = useState(false);
  // „Erinnern“ (E5c-5): die planbaren Dienstgruppen, die der Plan zeigt – als ganze Gruppen (mit allen Diensten, auch den
  // ausgeblendeten: wer dort eingeteilt ist, ist eingeteilt). Ohne planbare Gruppe gibt es den Knopf nicht.
  const [erinnernOffen, setErinnernOffen] = useState(false);
  // „Hilfe“ liegt im „⋯“-Menü (R6) – das Fenster gehört der Seite, nicht dem Menü.
  const [hilfeOffen, setHilfeOffen] = useState(false);
  const erinnernGruppen: PlanGruppe[] =
    plan && erinnern && ladePersonen && ladeAntworten
      ? gezeigteGruppen(plan, gruppenAus(ansicht))
          .filter((g) => g.planbar && g.gruppe !== null)
          .map((g) => plan.gruppen.find((x) => schluessel(x) === schluessel(g)) ?? g)
      : [];

  // Die gezeigten Dienstgruppen, deren Personenliste man ändern darf – ohne sie gibt es „Liste bearbeiten“ nicht. Der Modus
  // gehört zur Ansicht „Personen“: in einer anderen Ansicht ist er aus.
  const listeGruppen = plan
    ? gezeigteGruppen(plan, gruppenAus(ansicht)).filter(
        (g) => g.gruppe !== null && liste.darf(g.gruppe.id),
      )
    : [];
  const listeAn = liste.an && ansicht.unteransicht === 'raster';

  const knopf = (
    <ZeitraumKnopf
      zeitraum={z}
      zeile1={zeile1}
      zeile2={zeile2}
      heute={heute}
      abHeuteZusatz={handy ? 'die nächsten Termine' : 'passend zur Fensterbreite'}
      vergangenheit={werWieOft}
      // „＋ früherer / späterer Termin“ liegen im Fenster des Zeitraums (E6, B3) – am Handy blättert die Datumsleiste.
      dazu={
        handy
          ? undefined
          : {
              frueher: {
                aktiv: bereich ? true : f.davor,
                onClick: () => (bereich ? nimmDazu(-1) : gehe('frueherDazu')),
              },
              spaeter: {
                aktiv: bereich ? true : f.danach || kannNachladen,
                onClick: () => (bereich ? nimmDazu(1) : gehe('spaeterDazu')),
              },
            }
      }
      onWahl={waehleZeitraum}
    />
  );
  const leiste = (
    <Terminleiste
      knopf={knopf}
      bereich={!!bereich}
      handy={handy}
      davor={bereich ? true : f.davor}
      danach={bereich ? true : f.danach || kannNachladen}
      onSchritt={gehe}
      onVerschieben={(r) => setzeZeitraum(zeitraumVerschieben(z, r, heute))}
    />
  );

  const angebot = terminFilter(plan?.spalten ?? [], ansichtAus(ansicht));
  const arten = angebot.arten;

  // Das „⋯“-Menü (R6/E3): was selten gebraucht wird, einen Klick tiefer – Ablauf bearbeiten und Vorlagen, dann Erinnern und
  // Teilen, dann Hilfe; die Linien trennen nur Gruppen, die es gibt.
  const mehrGruppen: Option[][] = [
    [
      ...(!handy &&
      ansicht.unteransicht === 'matrix' &&
      matrixAblauf &&
      plan &&
      !matrixAblauf.bearbeiten &&
      ablaufBearbeitenMoeglich(matrixAblauf, plan, imFenster)
        ? [
            {
              label: 'Ablauf bearbeiten',
              symbol: <Icon name="pencil" size={16} stroke={2.2} />,
              onClick: () => ablaufBearbeitenStart(matrixAblauf),
            },
          ]
        : []),
      ...(onVorlagen
        ? [
            {
              label: 'Vorlagen',
              symbol: <Icon name="grid" size={16} stroke={2.2} />,
              onClick: onVorlagen,
            },
          ]
        : []),
      // „Liste bearbeiten“ (PL-2): nur, wo man die Liste mindestens einer gezeigten Dienstgruppe ändern darf; das Menü
      // schließt zuerst, dann wechselt die Ansicht nach „Personen“ und der Modus geht an.
      ...(listeGruppen.length > 0 && !listeAn
        ? [
            {
              label: 'Liste bearbeiten',
              symbol: <Icon name="liste" size={16} stroke={2.2} />,
              onClick: () => {
                setAnsicht({ ...ansicht, unteransicht: 'raster' });
                liste.setAn(true);
              },
            },
          ]
        : []),
    ],
    [
      ...(erinnernGruppen.length > 0
        ? [
            {
              label: 'Erinnern',
              symbol: <Icon name="brief" size={16} />,
              onClick: () => setErinnernOffen(true),
            },
          ]
        : []),
      {
        label: 'Teilen',
        symbol: <Icon name="share" size={16} />,
        gesperrt: !plan || teilenSpalten.length === 0,
        onClick: () => setTeilenOffen(true),
      },
    ],
    [
      {
        label: 'Hilfe',
        symbol: <Icon name="hilfe" size={16} />,
        onClick: () => setHilfeOffen(true),
      },
    ],
  ];
  const mehr: Option[] = mehrGruppen.flatMap((g, i) =>
    g.map((o, j) => ({
      ...o,
      trenner: j === 0 && mehrGruppen.slice(0, i).some((x) => x.length > 0),
    })),
  );

  // Die Lupe „Person hervorheben“ (R7/E5): am Rechner neben den Reitern (Platz im Seitenkopf), am Handy in der Werkzeugzeile.
  const lupe = plan ? (
    <FokusSuche
      kandidaten={fokusKandidaten(plan, amPlatz.entwurf)}
      onWahl={(person) => setFokusPerson({ person, zurueck: null })}
    />
  ) : null;
  const lupeImKopf = lupe && !handy && lupeOrt ? createPortal(lupe, lupeOrt) : null;
  const lupeInZeile = lupe && !lupeImKopf ? lupe : null;

  const werkzeug = (
    <>
      <Werkzeugzeile
        handy={handy}
        links={
          <AnsichtWahl
            value={ansicht.unteransicht}
            options={[
              { value: 'matrix', label: 'Matrix' },
              { value: 'raster', label: 'Personen' },
              { value: 'werWieOft', label: 'Wer wie oft?' },
            ]}
            onChange={(v) => {
              liste.setAn(false);
              setAnsicht({ ...ansicht, unteransicht: v });
            }}
            handy={handy}
          />
        }
        mitte={leiste}
        rechts={
          <>
            {/* „Fertig“ nur, solange der Ablauf bearbeitet wird – die Hauptaktion dieses Zustands (R1). */}
            {!handy && ansicht.unteransicht === 'matrix' && matrixAblauf && (
              <AblaufFertigKnopf ma={matrixAblauf} />
            )}
            {lupeInZeile}
            <FilterKnopf
              still
              abschnitte={[
                ...terminAbschnitte(angebot, ansichtAus(ansicht), (a) =>
                  setAnsicht({
                    ...ansicht,
                    ausgeblendeteKalender: a.kalender,
                    ausgeblendeteArten: a.arten,
                  }),
                ),
                gruppenAbschnitt(plan, gruppenAus(ansicht), (a) =>
                  setAnsicht({
                    ...ansicht,
                    ausgeblendeteGruppen: [...a.gruppen],
                    ausgeblendeteDienste: [...a.dienste],
                  }),
                ),
                // Anzeige statt Filter (R6): die Spaltenbreite der Matrix – zwei Breiten, vorher ein Umschalter in der Zeile.
                ...(!handy && ansicht.unteransicht === 'matrix'
                  ? [
                      {
                        titel: 'Anzeige',
                        anzeige: true,
                        optionen: [{ wert: 'breit', text: 'Breite Spalten' }],
                        aus: ansicht.breite === 'breit' ? [] : ['breit'],
                        onAus: (aus: string[]) =>
                          setAnsicht({
                            ...ansicht,
                            breite: aus.includes('breit') ? 'schmal' : 'breit',
                          }),
                      },
                    ]
                  : []),
              ]}
            />
            <MehrMenue optionen={mehr} handy={handy} />
          </>
        }
      />
      {lupeImKopf}
      {listeAn && (
        <div className={styles.besuchHinweis} role="status" aria-label="Liste bearbeiten">
          <span>
            {handy
              ? 'Am Griff ziehen, Person antippen für Tags und Pause.'
              : 'Zeilen am Griff ziehen, Person anklicken für Tags und Pause.'}{' '}
            Gilt für alle Planer der Dienstgruppe.
          </span>
          <span className={styles.listeKnoepfe}>
            <KopfKnopf
              label="Tags verwalten …"
              title="Tags verwalten"
              symbol={<Icon name="regler" size={16} stroke={2.2} />}
              disabled={listeGruppen.length === 0}
              onClick={() =>
                listeGruppen[0]?.gruppe &&
                setListeFenster({ art: 'tags', gruppeId: listeGruppen[0].gruppe.id })
              }
            />
            <KopfKnopf
              haupt
              label="Fertig"
              symbol={<Icon name="check" size={16} stroke={2.2} />}
              onClick={() => liste.setAn(false)}
            />
          </span>
        </div>
      )}
      {hilfeOffen && (
        <HilfeFenster
          seite="Planen"
          abschnitte={HILFE_PLANEN}
          onClose={() => setHilfeOffen(false)}
        />
      )}
      {teilenOffen && plan && (
        <Suspense fallback={null}>
          <PlanTeilenFenster
            quelle={{
              plan,
              spalten: teilenSpalten,
              gruppen: gezeigteGruppen(plan, gruppenAus(ansicht)),
              personenlisten: daten?.personenlisten,
              gemeinde: ablauf?.start.gemeinde ?? null,
              app: 'Dienstplaner',
            }}
            onClose={() => setTeilenOffen(false)}
          />
        </Suspense>
      )}
    </>
  );

  const hinweis = (text: string) => (
    <section className={styles.karte}>
      <p className={styles.hinweis} style={{ padding: 14 }}>
        {text}
      </p>
    </section>
  );

  let inhalt: ReactNode;
  if (quelle.art === 'laedt') inhalt = <p className={styles.hinweis}>Termine werden geladen …</p>;
  else if (quelle.art === 'fehler')
    inhalt = <FehlerKasten fehler={quelle.fehler} onNochmal={bereich ? zeitraumNeu : onNochmal} />;
  else if (!plan || !d || plan.spalten.length === 0)
    inhalt = hinweis(
      z.art === 'abHeute'
        ? `In den nächsten ${quelle.wochen} Wochen stehen keine Termine an.`
        : z.art === 'letzte'
          ? `In den letzten ${z.monate} Monaten gab es keine Termine.`
          : z.art === 'monat'
            ? `Im ${zeitraumText(z)} stehen keine Termine an.`
            : `Vom ${zeitraumText(z).replace(' – ', ' bis ')} stehen keine Termine an.`,
    );
  else {
    // Die gezeigten Gruppen mit den gezeigten Diensten – daraus rechnen Matrix, Raster, Kopf und Zettel (`planFilter.ts`).
    const gruppen = gezeigteGruppen(plan, gruppenAus(ansicht));
    // Das Plätze-Fach braucht die ganze Gruppe (auch die ausgeblendeten Dienste – dort schaltet man Dienste ein und aus).
    const ganzeGruppe = (g: PlanGruppe) =>
      plan.gruppen.find((x) => schluessel(x) === schluessel(g)) ?? g;
    // Vorgabe beim ersten Anzeigen: was man nicht plant, ist zugeklappt.
    const zugeklappt = zu ?? new Set(plan.gruppen.filter((g) => !g.planbar).map(schluessel));
    const umschalten = (k: string) => {
      const neu = new Set(zugeklappt);
      if (neu.has(k)) neu.delete(k);
      else neu.add(k);
      setZu(neu);
    };
    // Die Farbe eines Dienstes in „Personen“: nach der Reihenfolge ALLER Dienste der Gemeinde (sonst wanderte sie mit dem
    // gezeigten Zeitraum) – ohne Katalog nach den Diensten des Plans.
    const farben = dienstFarben(
      katalog
        ? katalog.dienste.keys()
        : plan.gruppen.flatMap((g) => g.zeilen.map((x) => x.dienst.id)),
    );
    const haupt = arten[0] !== undefined && arten[0] !== WEITERE ? arten[0] : null;
    const sicht: Sicht = {
      plan,
      spalten: handy ? d.gefiltert : imFenster,
      gruppen,
      personenlisten: daten?.personenlisten,
      zugeklappt,
      neben: (s) => haupt !== null && s.name !== haupt,
      onUmschalten: umschalten,
      ...amPlatz,
      fokusId: fokusPerson?.person.personId ?? null,
      onFokus: (personId, name) => setFokusPerson({ person: { personId, name }, zurueck: null }),
      onFokusAus: () => setFokusPerson(null),
      onPlaetze: (i, g) =>
        entwuerfe &&
        nimmtEintraegeAn(plan.spalten[i]) &&
        ganzeGruppe(g).zeilen.some((z) => darfPlanen(z, plan.spalten[i]))
          ? () => setPlaetzeFach({ eventId: plan.spalten[i].id, gruppe: ganzeGruppe(g) })
          : undefined,
      onPlatz: (i, zl) =>
        entwuerfe && nimmtEintraegeAn(plan.spalten[i]) && darfPlanen(zl, plan.spalten[i])
          ? () => setPlatzFenster({ eventId: plan.spalten[i].id, dienst: zl.dienst })
          : undefined,
      onTermin,
      ablauf: matrixAblauf,
      infos: matrixInfos,
      personen: { ...amPersonen, dazunehmen },
      liste: {
        an: listeAn,
        laeuft: liste.laeuft,
        darf: liste.darf,
        verschieben: (gruppeId, block, von, nach) => {
          // Absolut gesetzt (die ganze neue Reihenfolge, gerechnet aus dem Stand, den der Planer sieht): `personenlisteSpeichern`
          // vergleicht dessen Version – hat ein anderer Planer inzwischen geändert, wird nichts überschrieben.
          const neu = reiheNachZiehen(liste.aktuell(gruppeId), block, von, nach);
          void liste
            .aendern(gruppeId, (alt) => reiheSetzen(alt, neu))
            .then((r) => {
              if (!r.ok) showToast(listeGrundText(r.grund));
            });
        },
        person: (dienst, personId, name) =>
          setListeFenster({ art: 'person', dienst, personId, name }),
      },
      vorgabe: entwuerfe
        ? {
            modus: (dienstId) => modusFuerDienst(ansicht.direktDienste, dienstId),
            oeffnen: (z) => setVorgabeFach({ id: z.dienst.id, name: z.dienst.name }),
          }
        : undefined,
    };
    inhalt =
      d.gefiltert.length === 0 || gruppen.length === 0 ? (
        hinweis(
          'Nichts eingeblendet – über „Filter“ eine Veranstaltung, Gruppe oder einen Dienst wieder anhaken.',
        )
      ) : ansicht.unteransicht === 'werWieOft' ? (
        <WerWieOft sicht={sicht} />
      ) : ansicht.unteransicht === 'raster' ? (
        <PersonenRaster
          sicht={sicht}
          lader={ladePersonen}
          antwortenLader={ladeAntworten}
          farbe={(id) => farben.get(id) ?? 0}
        />
      ) : handy ? (
        <HandyPlan sicht={sicht} amEnde={kannNachladen ? () => nachladen('passend') : undefined} />
      ) : (
        <TabellenPlan sicht={sicht} breite={ansicht.breite} />
      );
  }

  // Nachladen gescheitert, der bisherige Stand steht: bei „ab heute“ wie beim gewählten Zeitraum (Alwin, 06.11.2026).
  const nachladeFehler = quelle.art === 'fertig' ? quelle.nachladeFehler : undefined;

  // Die Fokus-Leiste: gezählt wird über die Termine des gewählten Zeitraums (nach Kalender/Veranstaltung gefiltert), mit
  // allen Diensten – ein ausgeblendeter ist trotzdem ein Einsatz, die Leiste sagt „N ausgeblendet“ (`fokusZahlen`).
  const fokusZurueck = fokusPerson?.zurueck ?? null;
  const fokusLeiste = fokusPerson ? (
    <FokusLeiste
      person={fokusPerson.person}
      handy={handy}
      // Lädt der Plan gerade neu (Zeitraum gewechselt), bleibt die Leiste stehen – nur ohne Zahlen.
      texte={
        plan && d
          ? fokusTexte(
              fokusZahlen(plan, {
                personId: fokusPerson.person.personId,
                spalten: d.gefiltert,
                aus: gruppenAus(ansicht),
                entwurf: amPlatz.entwurf,
              }),
            )
          : { kurz: 'Termine werden geladen …', detail: '' }
      }
      onAus={() => setFokusPerson(null)}
      zurueck={
        fokusZurueck
          ? {
              text: `${fokusZurueck.platz.dienst} · ${fokusZurueck.platz.tag}`,
              onZurueck: () => {
                setFokusPerson({ ...fokusPerson, zurueck: null });
                werKannOeffnen(fokusZurueck);
              },
              laeuft: fokusEintragen,
              // „Hier eintragen“ legt den Entwurf mit derselben Funktion an wie die Wahl in „Wer kann?“.
              onEintragen: eintragenMoeglich(fokusZurueck)
                ? () => {
                    setFokusEintragen(true);
                    void trageEin(fokusZurueck, { art: 'person', ...fokusPerson.person })
                      ?.then((r) => {
                        if (r.ok) setFokusPerson({ ...fokusPerson, zurueck: null });
                        else showToast(fehlerHinweis(r));
                      })
                      .finally(() => setFokusEintragen(false));
                  }
                : undefined,
            }
          : undefined
      }
    />
  ) : null;
  return (
    <div className={styles.planen}>
      {werkzeug}
      {fokusLeiste}
      {nachladeFehler && (
        <FehlerKasten
          fehler={nachladeFehler}
          onNochmal={bereich ? zeitraumNeu : () => nachladen('weiter')}
        />
      )}
      {besuch && (
        <div className={styles.besuchHinweis} role="status" aria-label="Von der Startseite">
          <span>
            {besuch.aus === null && besuch.ausDienste.length === 0 ? (
              <>
                Nur <b>{besuchGruppe ? gruppenName(besuchGruppe) : 'eine Gruppe'}</b>
              </>
            ) : (
              'Eigene Auswahl'
            )}{' '}
            · nächste 6 Wochen – von der Startseite, nur für jetzt.
          </span>
          {onFokusEnde && (
            <button type="button" className={styles.alteKnopf} onClick={onFokusEnde}>
              Gewohnte Ansicht
            </button>
          )}
        </div>
      )}
      {lage.alte.length > 0 && entwuerfe && ew.art === 'fertig' && (
        <div className={styles.alteHinweis} role="status" aria-label="Alte Entwürfe">
          <span>
            <b>
              {lage.alte.length} {lage.alte.length === 1 ? 'alter Entwurf' : 'alte Entwürfe'}
            </b>{' '}
            – Termin vorbei oder gelöscht, oder der Dienst gehört nicht mehr dazu.
          </span>
          <button
            type="button"
            className={styles.alteKnopf}
            onClick={() => setAlteListe(lage.alte)}
          >
            Ansehen
          </button>
        </div>
      )}
      <div ref={rahmen}>{inhalt}</div>
      {sendeLeiste}
      {fenster}
      {erinnernOffen && plan && erinnern && ladePersonen && ladeAntworten && (
        <ErinnernFenster
          plan={plan}
          // „Wie gezeigt“ – dieselben Termine wie „Teilen“ und die Aufschrift des Zeitraum-Knopfs.
          spalten={teilenSpalten}
          gruppen={erinnernGruppen}
          heute={heute}
          ladePersonen={ladePersonen}
          ladeAntworten={ladeAntworten}
          anschluss={erinnern}
          onClose={() => setErinnernOffen(false)}
        />
      )}
      {vorgabeFach && plan && (
        <VorgabeFach
          dienst={vorgabeFach.name}
          modus={modusFuerDienst(ansicht.direktDienste, vorgabeFach.id)}
          onModus={(m) =>
            setAnsicht({
              ...ansicht,
              direktDienste: vorgabeSetzen(ansicht.direktDienste, vorgabeFach.id, m),
            })
          }
          onFuerAlle={(m) => {
            setAnsicht({
              ...ansicht,
              direktDienste: vorgabeFuerAlle(
                ansicht.direktDienste,
                plan.gruppen.flatMap((g) => g.zeilen.map((x) => x.dienst.id)),
                m,
              ),
            });
            showToast(
              m === 'direkt'
                ? 'Alle Dienste: neue Einteilungen direkt.'
                : 'Alle Dienste: neue Einteilungen als Anfrage.',
            );
          }}
          onClose={() => setVorgabeFach(null)}
        />
      )}
      {listeFenster?.art === 'person' &&
        plan &&
        (() => {
          const f = listeFenster;
          const gruppeId = f.dienst.dienstgruppeId;
          const gruppe = plan.gruppen.find((g) => g.gruppe?.id === gruppeId)?.gruppe;
          if (gruppeId === null || !gruppe || !liste.darf(gruppeId)) return null;
          const l = liste.aktuell(gruppeId);
          const schluessel = tagsSchluessel(f.dienst.id, f.personId);
          return (
            <PersonFenster
              // Kein Schlüssel mit der Version: Nach einem Konflikt lädt Planen den Stand des anderen Planers nach, das Fenster
              // bleibt aber offen und behält die Eingabe des Planers (er speichert sie dann auf dem neuen Stand).
              key={`${f.dienst.id}|${f.personId}`}
              name={f.name}
              dienst={f.dienst.name}
              gruppe={gruppe.name}
              tags={l?.tags ?? []}
              gewaehlt={l?.tagsVon[schluessel] ?? []}
              pause={l?.pause[String(f.personId)] ?? null}
              onTagsVerwalten={() => setListeFenster({ art: 'tags', gruppeId })}
              onClose={() => setListeFenster(null)}
              speichern={async (tagIds, pause) => {
                // Absolut: genau die Wahl im Fenster, nicht „weiterrechnen“ auf einem alten Stand.
                const r = await liste.aendern(gruppeId, (alt) =>
                  pauseSetzen(tagsSetzen(alt, f.dienst.id, f.personId, tagIds), f.personId, pause),
                );
                if (r.ok) {
                  setListeFenster(null);
                  return null;
                }
                return listeGrundText(r.grund);
              }}
            />
          );
        })()}
      {listeFenster?.art === 'tags' &&
        (() => {
          // Die Dienstgruppen, deren Liste man ändern darf – aus allen Gruppen des Plans (auch den ausgeblendeten).
          const gruppen = (plan?.gruppen ?? []).flatMap((g) =>
            g.gruppe && liste.darf(g.gruppe.id)
              ? [
                  {
                    id: g.gruppe.id,
                    name: g.gruppe.name,
                    tags: liste.aktuell(g.gruppe.id)?.tags ?? [],
                  },
                ]
              : [],
          );
          if (gruppen.length === 0) return null;
          return (
            <TagsVerwaltenFenster
              gruppen={gruppen}
              start={listeFenster.gruppeId}
              onClose={() => setListeFenster(null)}
              speichern={async (gruppeId, tags) => {
                const r = await liste.aendern(gruppeId, (alt) => tagListeSetzen(alt, tags));
                return r.ok ? null : listeGrundText(r.grund);
              }}
            />
          );
        })()}
      {alteListe && entwuerfe && ew.art === 'fertig' && (
        <AlteEntwuerfeFach
          zeilen={alteListe}
          ichId={entwuerfe.ich.personId}
          verwerfen={(a) =>
            entwuerfe.entfernen(ew.daten, a.gruppeId, a.entwurf.ort, a.entwurf.version)
          }
          onClose={(geaendert) => {
            setAlteListe(null);
            if (geaendert) ewNeu();
          }}
        />
      )}
      {platzFenster &&
        entwuerfe &&
        plan &&
        (() => {
          // Termin und Dienst aus dem aktuellen Plan – er kann sich seit dem Öffnen neu geladen haben.
          const i = plan.spalten.findIndex((s) => s.id === platzFenster.eventId);
          if (i < 0) return null;
          const s = plan.spalten[i];
          const zl = plan.gruppen
            .flatMap((g) => g.zeilen)
            .find((x) => x.dienst.id === platzFenster.dienst.id);
          const name = platzFenster.dienst.name;
          return (
            <PlatzFenster
              key={`${s.id}|${platzFenster.dienst.id}`}
              titel={`Plätze – ${name} · ${tagKurz(s.tag)}`}
              unter={`${s.name} · ${s.uhrzeit} Uhr`}
              z={plaetzeZeile(daten, s, i, platzFenster.dienst, zl)}
              mitEntwuerfen={
                zl
                  ? plaetzeStand(zl.zellen[i] ?? null, (p) => entwurfAmPlatz(daten, s, zl, p))
                  : null
              }
              aendern={(z, gesehen, neu) => anzahlSetzen(s.id, z.serviceId, gesehen, neu)}
              laedt={plaetzeFrisch.laedt}
              onGespeichert={showToast}
              onClose={(geaendert) => {
                setPlatzFenster(null);
                if (geaendert) leiseNeuLaden();
              }}
            />
          );
        })()}
      {plaetzeFach &&
        entwuerfe &&
        plan &&
        (() => {
          // Termin und Gruppe aus dem AKTUELLEN Plan – wie beim Fenster eines Dienstes (oben). Mit der Gruppe vom Öffnen
          // rechnete das Fach nach einer Änderung mit den alten Plätzen weiter: nach 2 → 1 suchte es den Entwurf noch auf
          // „Platz 1“, fand ihn nicht und ließ „−“ bis 0 zu (19.11.2026, beim Durchklicken gefunden).
          const i = plan.spalten.findIndex((s) => s.id === plaetzeFach.eventId);
          if (i < 0) return null;
          const s = plan.spalten[i];
          const g =
            plan.gruppen.find((x) => schluessel(x) === schluessel(plaetzeFach.gruppe)) ??
            plaetzeFach.gruppe;
          return (
            <PlaetzeFach
              titel={`${gruppenName(g)} · Plätze`}
              unter={`${s.name} · ${tagKurz(s.tag)}`}
              zeilen={plaetzeZeilen(daten, s, i, g, katalog)}
              vorlage={
                katalog && ladeVorlagen ? vorlageFuer(katalog, s, g, ladeVorlagen) : undefined
              }
              aendern={(z, gesehen, neu) => anzahlSetzen(s.id, z.serviceId, gesehen, neu)}
              laedt={plaetzeFrisch.laedt}
              onGespeichert={showToast}
              onClose={(geaendert) => {
                setPlaetzeFach(null);
                if (geaendert) leiseNeuLaden();
              }}
            />
          );
        })()}
    </div>
  );
}
