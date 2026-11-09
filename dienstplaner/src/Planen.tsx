import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { tagKurz } from '@shared/ct/datum';
import { gruppenName, type PlanGruppe } from '@shared/dienstplan/plan';
import { terminFilter, WEITERE } from '@shared/dienstplan/termine';
import type { Breite } from '@shared/dienstplan/fenster';
import { zeitraumText, zeitraumVerschieben } from '@shared/ct/zeitraum';
import type { TermineZustand } from './Termine';
import type { TermineDaten } from './ladeTermine';
import { ZeitraumKnopf } from '@ui/bedienung/ZeitraumKnopf';
import { ansichtAus, leseAnsicht, merkeAnsicht, type PlanenAnsicht } from './planenAnsicht';
import { terminAbschnitte } from './terminAbschnitte';
import { useBreite } from './useBreite';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { PlaetzeFach } from './PlaetzeFach';
import { AlteEntwuerfeFach, type AlterEntwurf } from './AlteEntwuerfeFach';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { ALLE_REITER } from './reiter';
import { AblaufBearbeitenKnopf } from './MatrixAblauf';
import { useMatrixAblauf } from './useMatrixAblauf';
import { useMatrixInfos } from './useMatrixInfos';
import type { Start } from './start';
import { schluessel, type Sicht, darfPlanen } from './planSicht';
import { Terminleiste } from './Terminleiste';
import { TabellenPlan, HandyPlan } from './PlanAnsicht';
import { WerWieOft } from './WerWieOft';
import { useEinteilen } from './useEinteilen';
import { plaetzeZeilen } from './planEntwuerfe';
import { usePlanZeitraum } from './usePlanZeitraum';
import styles from './Planen.module.scss';

/** Der Name des Reiters mit den eigenen Diensten – aus der Reiterliste, damit der Hilfetext eine Umbenennung mitmacht. */
const DIENSTE_REITER = ALLE_REITER.find((r) => r.id === 'termine')?.label ?? 'Dienste';

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
}: Props) {
  const [ansicht, setAnsichtRoh] = useState<PlanenAnsicht>(leseAnsicht);
  const setAnsicht = (a: PlanenAnsicht) => {
    setAnsichtRoh(a);
    merkeAnsicht(a);
  };
  const matrixAblauf = useMatrixAblauf(ablauf, ansicht.ablaufZu, (ablaufZu) =>
    setAnsicht({ ...ansicht, ablaufZu }),
  );
  const matrixInfos = useMatrixInfos(ablauf, ansicht.infosZu, (infosZu) =>
    setAnsicht({ ...ansicht, infosZu }),
  );
  const [zu, setZu] = useState<Set<string> | null>(null);
  // Das Plätze-Fach (E4-5-3): Termin und Gruppe.
  const [plaetzeFach, setPlaetzeFach] = useState<{ spalte: number; gruppe: PlanGruppe } | null>(
    null,
  );
  const [rahmen, platz] = useBreite();

  // Zeitraum, was dafür geladen ist und welcher Ausschnitt zu sehen ist – `usePlanZeitraum`.
  const {
    personen,
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
  } = useEinteilen({
    plan,
    entwuerfe,
    heute,
    handy,
    onGesendet: leiseNeuLaden,
  });
  // Das Fach „Alte Entwürfe“ (offen mit der Liste, beim Öffnen festgehalten).
  const [alteListe, setAlteListe] = useState<AlterEntwurf[] | null>(null);
  // „Plan teilen“ (E8-2): geteilt werden die Termine, die gerade zählen – dieselben wie in der Aufschrift des
  // Zeitraum-Knopfs – und die eingeblendeten Gruppen.
  const [teilenOffen, setTeilenOffen] = useState(false);

  const knopf = (
    <ZeitraumKnopf
      zeitraum={z}
      zeile1={zeile1}
      zeile2={zeile2}
      heute={heute}
      abHeuteZusatz={handy ? 'die nächsten Termine' : 'passend zur Fensterbreite'}
      vergangenheit={personen}
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
          { value: 'personen', label: 'Wer wie oft?' },
        ]}
        onChange={(v) => setAnsicht({ ...ansicht, unteransicht: v })}
        ariaLabel="Ansicht"
        className={styles.ansicht}
        verbunden
      />
      {!handy && leiste}
      <div className={styles.rechts}>
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
        <FilterKnopf
          abschnitte={[
            ...terminAbschnitte(angebot, ansichtAus(ansicht), (a) =>
              setAnsicht({
                ...ansicht,
                ausgeblendeteKalender: a.kalender,
                ausgeblendeteArten: a.arten,
              }),
            ),
            {
              titel: 'Gruppen',
              optionen: (plan?.gruppen ?? []).map((g) => ({
                wert: schluessel(g),
                text: gruppenName(g),
              })),
              aus: ansicht.ausgeblendeteGruppen,
              onAus: (ausgeblendeteGruppen) => setAnsicht({ ...ansicht, ausgeblendeteGruppen }),
            },
          ]}
        />
        <KopfKnopf
          onClick={() => setTeilenOffen(true)}
          label="Teilen"
          title="Plan als PDF teilen"
          symbol={<Icon name="share" size={16} />}
          disabled={!plan || teilenSpalten.length === 0}
        />
        {teilenOffen && plan && (
          <Suspense fallback={null}>
            <PlanTeilenFenster
              quelle={{
                plan,
                spalten: teilenSpalten,
                gruppen: plan.gruppen.filter(
                  (g) => !ansicht.ausgeblendeteGruppen.includes(schluessel(g)),
                ),
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
    const gruppen = plan.gruppen.filter(
      (g) => !ansicht.ausgeblendeteGruppen.includes(schluessel(g)),
    );
    // Vorgabe beim ersten Anzeigen: was man nicht plant, ist zugeklappt.
    const zugeklappt = zu ?? new Set(plan.gruppen.filter((g) => !g.planbar).map(schluessel));
    const umschalten = (k: string) => {
      const neu = new Set(zugeklappt);
      if (neu.has(k)) neu.delete(k);
      else neu.add(k);
      setZu(neu);
    };
    const haupt = arten[0] !== undefined && arten[0] !== WEITERE ? arten[0] : null;
    const sicht: Sicht = {
      plan,
      spalten: handy ? d.gefiltert : imFenster,
      gruppen,
      zugeklappt,
      neben: (s) => haupt !== null && s.name !== haupt,
      onUmschalten: umschalten,
      ...amPlatz,
      onPlaetze: (i, g) =>
        entwuerfe &&
        !plan.spalten[i].abgesagt &&
        g.zeilen.some((z) => darfPlanen(z, plan.spalten[i]))
          ? () => setPlaetzeFach({ spalte: i, gruppe: g })
          : undefined,
      onTermin,
      ablauf: matrixAblauf,
      infos: matrixInfos,
    };
    inhalt =
      d.gefiltert.length === 0 || gruppen.length === 0 ? (
        hinweis(
          'Nichts eingeblendet – über „Filter“ eine Veranstaltung oder Gruppe wieder anhaken.',
        )
      ) : ansicht.unteransicht === 'personen' ? (
        <WerWieOft sicht={sicht} />
      ) : handy ? (
        <HandyPlan sicht={sicht} amEnde={kannNachladen ? () => nachladen('passend') : undefined} />
      ) : (
        <TabellenPlan sicht={sicht} breite={ansicht.breite} />
      );
  }

  // Nachladen gescheitert, der bisherige Stand steht: bei „ab heute“ wie beim gewählten Zeitraum (Alwin, 06.11.2026).
  const nachladeFehler = quelle.art === 'fertig' ? quelle.nachladeFehler : undefined;
  return (
    <div className={styles.planen}>
      {werkzeug}
      {nachladeFehler && (
        <FehlerKasten
          fehler={nachladeFehler}
          onNochmal={bereich ? zeitraumNeu : () => nachladen('weiter')}
        />
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
      <p className={styles.hinweis}>
        Welche Dienste du siehst, entscheidet ChurchTools. Hier stehen nur Dienstgruppen, die du
        ganz sehen darfst – deine eigenen Dienste findest du immer unter Start und {DIENSTE_REITER}.
        Planen darfst du, wo du die Dienstgruppe bearbeiten darfst, die Gruppe eines Dienstes
        leitest oder Admin des Termins bist. Einen freien Platz antippen zeigt, wer kann – dort
        trägst du jemanden als Entwurf ein. Einen belegten Platz antippen: zurückziehen oder durch
        jemand anderen ersetzen, ebenfalls als Entwurf. Der Regler in der Gruppenzeile ändert die
        Anzahl der Plätze – sofort. Der Zauberstab schlägt für die freien Plätze Personen vor – nach
        der Rangfolge von ChurchTools, ebenfalls als Entwurf. Der Stift neben einem Namen ändert
        dessen Vorlieben – sofort in ChurchTools. Gesendet wird erst mit „Ansehen und senden“ – dann
        bekommen die Angefragten eine Mitteilung von ChurchTools.
      </p>
      {sendeLeiste}
      {fenster}
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
      {plaetzeFach && entwuerfe && plan && (
        <PlaetzeFach
          titel={`${gruppenName(plaetzeFach.gruppe)} · Plätze`}
          unter={`${plan.spalten[plaetzeFach.spalte].name} · ${tagKurz(plan.spalten[plaetzeFach.spalte].tag)}`}
          zeilen={plaetzeZeilen(
            daten,
            plan.spalten[plaetzeFach.spalte],
            plaetzeFach.spalte,
            plaetzeFach.gruppe,
          )}
          aendern={(z, gesehen, neu) =>
            entwuerfe.anzahl(plan.spalten[plaetzeFach.spalte].id, z.serviceId, gesehen, neu)
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
