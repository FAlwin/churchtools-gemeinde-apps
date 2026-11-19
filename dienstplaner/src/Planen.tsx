import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { HilfeKnopf } from '@ui/bedienung/HilfeKnopf';
import { HILFE_PLANEN } from './hilfeTexte';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { tagKurz } from '@shared/ct/datum';
import type { TerminVorlage } from '@shared/ct/terminVorlagen';
import { gruppenName, nimmtEintraegeAn, type PlanGruppe } from '@shared/dienstplan/plan';
import type { Dienst } from '@shared/ct/dienste';
import { gezeigteGruppen } from '@shared/dienstplan/planFilter';
import { fokusKandidaten, fokusTexte, fokusZahlen } from '@shared/dienstplan/fokus';
import { terminFilter, WEITERE } from '@shared/dienstplan/termine';
import type { Breite } from '@shared/dienstplan/fenster';
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
import { AlteEntwuerfeFach, type AlterEntwurf } from './AlteEntwuerfeFach';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { AblaufBearbeitenKnopf } from './MatrixAblauf';
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
  // Das Plätze-Fach (E4-5-3): Termin und Gruppe.
  const [plaetzeFach, setPlaetzeFach] = useState<{ spalte: number; gruppe: PlanGruppe } | null>(
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
  /**
   * **Die Platzzahl ändern** (Regler, Plätze-Fach, „Platz dazunehmen“): der Anschluss trägt die Entwürfe des Dienstes mit um
   * (19.11.2026, `anzahlMitEntwuerfen`) – danach müssen die Entwürfe neu geladen werden, sonst arbeitet die Matrix mit den
   * alten Nummern weiter. Den Plan laden die Aufrufer selbst neu (beim Schließen des Fensters bzw. nach „dazunehmen“).
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
    const e = r.ok ? r.entwuerfe : undefined;
    if (e && (e.umgetragen.length > 0 || e.offen > 0 || e.unklar)) ewNeu();
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
  const erinnernGruppen: PlanGruppe[] =
    plan && erinnern && ladePersonen && ladeAntworten
      ? gezeigteGruppen(plan, gruppenAus(ansicht))
          .filter((g) => g.planbar && g.gruppe !== null)
          .map((g) => plan.gruppen.find((x) => schluessel(x) === schluessel(g)) ?? g)
      : [];

  const knopf = (
    <ZeitraumKnopf
      zeitraum={z}
      zeile1={zeile1}
      zeile2={zeile2}
      heute={heute}
      abHeuteZusatz={handy ? 'die nächsten Termine' : 'passend zur Fensterbreite'}
      vergangenheit={werWieOft}
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
      onDazu={nimmDazu}
    />
  );

  const angebot = terminFilter(plan?.spalten ?? [], ansichtAus(ansicht));
  const arten = angebot.arten;
  const werkzeug = (
    <div className={styles.werkzeug}>
      <Segment
        value={ansicht.unteransicht}
        options={[
          { value: 'matrix', label: 'Matrix' },
          { value: 'raster', label: 'Personen' },
          { value: 'werWieOft', label: 'Wer wie oft?' },
        ]}
        onChange={(v) => setAnsicht({ ...ansicht, unteransicht: v })}
        ariaLabel="Ansicht"
        className={styles.ansicht}
        verbunden
      />
      {!handy && leiste}
      <div className={styles.rechts}>
        {onVorlagen && (
          <KopfKnopf
            onClick={onVorlagen}
            label="Vorlagen"
            title="Ablaufvorlagen ansehen und bearbeiten"
            symbol={<Icon name="grid" size={16} stroke={2.2} />}
          />
        )}
        {/* „Ablauf bearbeiten“ hier statt neben „Ablauf“ – dort passte er nicht in die Dienst-Spalte (E6-6c). */}
        {!handy && ansicht.unteransicht === 'matrix' && matrixAblauf && plan && (
          <AblaufBearbeitenKnopf ma={matrixAblauf} plan={plan} spalten={imFenster} />
        )}
        {!handy && ansicht.unteransicht === 'matrix' && (
          <Segment<Breite>
            value={ansicht.breite}
            // Zwei Breiten als Symbole statt S/M/L (Alwin, 29.10.2026, Entwurf `e6-6-breiten-plus.html`).
            options={[
              {
                value: 'schmal',
                label: <Icon name="spalten-schmal" size={18} />,
                name: 'Schmale Spalten',
              },
              {
                value: 'breit',
                label: <Icon name="spalten-breit" size={18} />,
                name: 'Breite Spalten',
              },
            ]}
            onChange={(b) => setAnsicht({ ...ansicht, breite: b })}
            ariaLabel="Spaltenbreite"
            verbunden
          />
        )}
        {plan && (
          <FokusSuche
            kandidaten={fokusKandidaten(plan, amPlatz.entwurf)}
            onWahl={(person) => setFokusPerson({ person, zurueck: null })}
            handy={handy}
          />
        )}
        <FilterKnopf
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
          ]}
        />
        {erinnernGruppen.length > 0 && (
          <KopfKnopf
            onClick={() => setErinnernOffen(true)}
            label="Erinnern"
            title="Erinnern: Mail an alle, die noch nicht geantwortet haben"
            symbol={<Icon name="brief" size={16} />}
          />
        )}
        <KopfKnopf
          onClick={() => setTeilenOffen(true)}
          label="Teilen"
          title="Plan als PDF teilen"
          symbol={<Icon name="share" size={16} />}
          disabled={!plan || teilenSpalten.length === 0}
        />
        <HilfeKnopf seite="Planen" abschnitte={HILFE_PLANEN} />
        {teilenOffen && plan && (
          <Suspense fallback={null}>
            <PlanTeilenFenster
              quelle={{
                plan,
                spalten: teilenSpalten,
                gruppen: gezeigteGruppen(plan, gruppenAus(ansicht)),
                gemeinde: ablauf?.start.gemeinde ?? null,
                app: 'Dienstplaner',
              }}
              onClose={() => setTeilenOffen(false)}
            />
          </Suspense>
        )}
      </div>
      {handy && leiste}
    </div>
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
          ? () => setPlaetzeFach({ spalte: i, gruppe: ganzeGruppe(g) })
          : undefined,
      onPlatz: (i, zl) =>
        entwuerfe && nimmtEintraegeAn(plan.spalten[i]) && darfPlanen(zl, plan.spalten[i])
          ? () => setPlatzFenster({ eventId: plan.spalten[i].id, dienst: zl.dienst })
          : undefined,
      onTermin,
      ablauf: matrixAblauf,
      infos: matrixInfos,
      personen: { ...amPersonen, dazunehmen },
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
              onGespeichert={showToast}
              onClose={(geaendert) => {
                setPlatzFenster(null);
                if (geaendert) leiseNeuLaden();
              }}
            />
          );
        })()}
      {plaetzeFach && entwuerfe && plan && (
        <PlaetzeFach
          titel={`${gruppenName(plaetzeFach.gruppe)} · Plätze`}
          unter={`${plan.spalten[plaetzeFach.spalte].name} · ${tagKurz(plan.spalten[plaetzeFach.spalte].tag)}`}
          zeilen={plaetzeZeilen(
            daten,
            plan.spalten[plaetzeFach.spalte],
            plaetzeFach.spalte,
            plaetzeFach.gruppe,
            katalog,
          )}
          vorlage={
            katalog && ladeVorlagen
              ? vorlageFuer(
                  katalog,
                  plan.spalten[plaetzeFach.spalte],
                  plaetzeFach.gruppe,
                  ladeVorlagen,
                )
              : undefined
          }
          aendern={(z, gesehen, neu) =>
            anzahlSetzen(plan.spalten[plaetzeFach.spalte].id, z.serviceId, gesehen, neu)
          }
          onGespeichert={showToast}
          onClose={(geaendert) => {
            setPlaetzeFach(null);
            if (geaendert) leiseNeuLaden();
          }}
        />
      )}
    </div>
  );
}
