import { lazy, Suspense, useEffect, useState } from 'react';
import { useLaden, type Ladestand } from '@ui/ct/useLaden';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf, KopfLink } from '@ui/bedienung/KopfKnopf';
import { HilfeKnopf } from '@ui/bedienung/HilfeKnopf';
import { HILFE_TERMIN } from './hilfeTexte';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { datumText, kachel } from '@shared/ct/datum';
import { musikAppDirektLink } from '@shared/ct/musikAppLink';
import type { CtAgenda } from '@shared/ct/typen';
import { dateienSchluessel, type TerminDatei } from '@shared/ct/terminDateien';
import { gruppenName } from '@shared/dienstplan/plan';
import { modusFuerDienst } from '@shared/dienstplan/modusVorgabe';
import { leseAnsicht } from './planenAnsicht';
import { ladeTermin, type TerminDaten } from './ladeTermine';
import { ladeAblauf } from './ladeBeiwerk';
import { useMusikApp } from './useMusikApp';
import { EinteilPlaetze } from './PlanPlaetze';
import { ZauberKnopf } from './PlanAnsicht';
import { useEinteilen } from './useEinteilen';
import type { AntwortenLader } from './ladeAntworten';
import { darfPlanen } from './planSicht';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { andereTermineText } from './planEntwuerfe';
import { terminAenderbar, type Start } from './start';
import { InfosFenster } from './InfosFenster';
import { CtSymbol } from './CtSymbol';
import { DateienFenster } from './DateienFenster';
import { blattGruppenAus } from '@shared/dienstplan/terminBlattDienste';
import { TerminAblauf } from './TerminAblauf';
import { Rueckblick } from './Rueckblick';
import { useMeineAnzeige } from './meineAnzeige';
import { schnittKurz, useVerlaufDaten } from './useVerlaufDaten';
import { verlaufCacheLeeren, verlaufImCacheErsetzen } from './ladeVerlauf';
import { TauschAmDienst } from './TauschTeile';
import type { VertretungZugriff } from './useVertretung';
import type { Tausch } from './useTausch';
import { adresseFuerTermin, liveAusAdresse } from './reiter';
import styles from './TerminAnsicht.module.scss';

/**
 * „Termin teilen“ erst beim Antippen laden: Es bringt pdf.js samt Worker mit (Vorschau) – beim Start des Dienstplaners
 * legte das sonst jedes Mal einen Worker an, auch ohne dass jemand teilt (volle Prüfung E8-1).
 */
const TerminTeilenFenster = lazy(() =>
  import('@ui/teilen/TerminTeilenFenster').then((m) => ({ default: m.TerminTeilenFenster })),
);

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: TerminDaten; ablauf: CtAgenda | null };

function alsZustand(s: Ladestand<{ daten: TerminDaten; ablauf: CtAgenda | null }>): Zustand {
  if (s.art === 'fertig') return { art: 'fertig', ...s.daten };
  return s.art === 'fehler' ? s : { art: 'laedt' };
}

/**
 * **Die Termin-Ansicht** (Bauplan E6-1b, Entwurf `e6-entwurf.html` Bild 1): oben der Ablauf – derselbe Baustein wie in
 * der Musik-App (`ui/ablauf/AblaufListe`; seit E6-O1 wie die ChurchTools-App, Dauer unter der Uhrzeit) –, darunter die Dienste des
 * Termins mit denselben Plätzen wie in „Planen“. ‹ › blättert durch die geladenen Termine.
 *
 * **Bearbeiten** (E6-3a, #645): Wer den Ablauf bearbeiten darf (`ablaufBearbeitbar`, dieselbe Regel wie die
 * Musik-App), bekommt einen Stift – danach dieselbe Bearbeiten-Liste wie in der Musik-App
 * (`ui/ablauf/useAblaufBearbeiten`), ohne Liedwahl (Lieder wählt man in der Musik-App). Gespeichert wird sofort in
 * ChurchTools; danach wird der Ablauf neu gelesen. Was zum Ablauf gehört, steht seit E6-6a in `TerminAblauf` – dieselbe
 * Stelle wie in den Spalten der Matrix.
 *
 * **Teilen** (E8-1, Entwurf `e8-teilen.html`): Der Knopf gehört zum Titel und steht direkt dahinter – am Handy rutscht
 * die Titelzeile unter die Knöpfe, dort ist Platz (Alwin 05.11.2026: neben ⓘ verdeckte er zu viel). Er öffnet
 * „Termin teilen“ mit Diensten und Ablauf auf einem Blatt.
 *
 * Geladen wird der Termin frisch (`ladeTermin`, dieselbe Regel wie Liste und Matrix) – er kann auch außerhalb des
 * geladenen Zeitraums liegen (aus „Planen“ mit eigenem Zeitraum).
 *
 * **Tauschen** (E7-3, Entwurf `e7-3-tausch.html`): An meinem eigenen Platz steht unter den Plätzen „Tauschen“ bzw. der
 * Stand der Anfrage – derselbe Baustein und derselbe Zustand wie auf der Startseite und in „Dienste“.
 *
 * **Einteilen** (F1, 09.11.2026, Entwurf `f1-termin-planen.html`): Wer einen Dienst planen darf, teilt hier ein wie in
 * „Planen“ – freier Platz → „Wer kann?“, belegter Platz → zurückziehen oder ersetzen, Entwurf → Entwurfs-Fach, Zauberstab
 * je Gruppe – und sendet unten mit „Ansehen und senden“ **nur die Entwürfe dieses Termins** (`useEinteilen`, dieselben
 * Fenster wie in der Matrix). Alle anderen sehen die Plätze wie bisher.
 */
export function TerminAnsicht({
  start,
  terminId,
  zeitzone,
  vorher,
  nachher,
  zurueck,
  onTermin,
  onZurueck,
  onGeaendert,
  tausch,
  vertretung,
  entwuerfe,
  ladeAntworten,
  heute,
  handy,
  liveStart = false,
}: {
  start: Start;
  terminId: number;
  zeitzone: string;
  /** Voriger/nächster geladener Termin – `null`, wenn es keinen gibt (oder der Termin nicht in der Liste steht). */
  vorher: number | null;
  nachher: number | null;
  /** Wohin „zurück“ führt, z. B. „Termine“. */
  zurueck: string;
  onTermin: (id: number) => void;
  onZurueck: () => void;
  /** Infos oder Dateien haben sich geändert – die Termine anderswo (Matrix, Liste) sind damit veraltet. */
  onGeaendert?: () => void;
  /** Dienste tauschen (E7-3) – ohne: kein „Tauschen“. */
  tausch?: Tausch;
  /** Vertretung suchen (E5c-6) – ohne: kein „Vertretung suchen“ neben „Tauschen“. */
  vertretung?: VertretungZugriff;
  /** Einteilen als Entwurf (F1) – ohne Anschluss bleibt „Wer kann?“ nur zum Ansehen. */
  entwuerfe?: EntwurfAnschluss;
  /** Die Antworten aus „Wann kann ich?“ für „Wer kann?“ und den Zauberstab (E5c-4) – ohne bleiben beide wie früher. */
  ladeAntworten?: AntwortenLader;
  /** Die Live-Ansicht gleich öffnen (Adresse `#/termin/ID/live`, Knopf „Live“ auf der Startseite) – nur beim ersten Zeigen. */
  liveStart?: boolean;
  /** Heute (`YYYY-MM-DD`, Ortszeit der Gemeinde) – für den Zauberstab. */
  heute: string;
  /** Schmaler Bildschirm: die Leiste kürzer („Ansehen & senden“). */
  handy: boolean;
}) {
  const {
    stand,
    neu,
    setze: setzeGeladen,
  } = useLaden(
    // Beide gleichzeitig, aber der Fehler des Termins hat Vorrang: Darf man ihn nicht sehen, scheitert meist auch der
    // Ablauf – sonst entschiede, wer zuerst antwortet, ob „Diesen Termin zeigt dir ChurchTools nicht“ dasteht.
    () =>
      Promise.allSettled([ladeTermin(start, terminId, zeitzone), ladeAblauf(terminId)]).then(
        ([daten, ablauf]) => {
          if (daten.status === 'rejected') throw daten.reason;
          if (ablauf.status === 'rejected') throw ablauf.reason;
          return { daten: daten.value, ablauf: ablauf.value };
        },
      ),
    [start, terminId, zeitzone],
  );
  const zustand = alsZustand(stand);
  // Rückblick und Schnitt (L4-4): alle Live-Verläufe, einmal je Seitenaufruf gelesen; nach „Live“ neu (`neuLesen`).
  const anzeige = useMeineAnzeige();
  const verlaeufe = useVerlaufDaten(anzeige.rueckblick || anzeige.schnittBeimPlanen);
  // Einteilen wie in „Planen“ (F1) – mit dem Plan dieses einen Termins; gesendet wird damit nur, was hier steht.
  const einteilen = useEinteilen({
    plan: zustand.art === 'fertig' ? zustand.daten.plan : null,
    entwuerfe,
    heute,
    handy,
    antwortenLader: ladeAntworten,
    nachfragen: false,
    leisteZusatz: 'an diesem Termin',
    sendenZusatz: (daten) => andereTermineText(daten, terminId),
    // Die Vorgabe „Anfrage | direkt“ je Dienst gilt auch hier (P2m) – eingestellt wird sie in der Matrix, gelesen frisch aus
    // dem Gerät (die Termin-Ansicht hält keine eigene Ansicht).
    modusFuer: (dienstId) => modusFuerDienst(leseAnsicht().direktDienste, dienstId),
    // Danach leise neu lesen, was in ChurchTools steht; scheitert das, wie beim ersten Laden mit Fehlerkasten.
    onGesendet: () => {
      ladeTermin(start, terminId, zeitzone).then(
        (daten) => setzeGeladen((alt) => ({ ...alt, daten })),
        () => neu(),
      );
      onGeaendert?.();
    },
  });
  // Adresse der Musik-App: `undefined` = noch unbekannt, `null` = nicht installiert (die Lied-Ansicht sagt es dann).
  const musikApp = useMusikApp();
  const [bearbeiten, setBearbeiten] = useState(false);
  // „Weitere Infos“ (T1): das Fenster und ein frisch gespeicherter Text (bis der Termin neu geladen wird).
  const [infosOffen, setInfosOffen] = useState(false);
  const [infosNeu, setInfosNeu] = useState<string | null>(null);
  // Die Dateien (T2a): das Fenster und die frische Liste daraus (bis der Termin neu geladen wird).
  const [dateienOffen, setDateienOffen] = useState(false);
  const [dateienNeu, setDateienNeu] = useState<TerminDatei[] | null>(null);
  const [teilenOffen, setTeilenOffen] = useState(false);

  // Ein anderer Termin: Fenster und frisch Gespeichertes des alten gelten nicht mehr.
  useEffect(() => {
    setBearbeiten(false);
    setInfosOffen(false);
    setInfosNeu(null);
    setDateienOffen(false);
    setDateienNeu(null);
    setTeilenOffen(false);
  }, [start, terminId, zeitzone]);

  const blaettern = (
    <span className={styles.blaettern}>
      <button
        type="button"
        className={styles.rund}
        aria-label="Voriger Termin"
        disabled={vorher === null}
        onClick={() => vorher !== null && onTermin(vorher)}
      >
        <Icon name="chev-left" size={16} />
      </button>
      <button
        type="button"
        className={styles.rund}
        aria-label="Nächster Termin"
        disabled={nachher === null}
        onClick={() => nachher !== null && onTermin(nachher)}
      >
        <Icon name="chev-right" size={16} />
      </button>
    </span>
  );
  const zurueckKnopf = (
    <button type="button" className={styles.zurueck} onClick={onZurueck}>
      <Icon name="chev-left" size={16} /> {zurueck}
    </button>
  );

  if (zustand.art !== 'fertig') {
    return (
      <div className={styles.seite}>
        <div className={styles.kopf}>
          {zurueckKnopf}
          {blaettern}
        </div>
        {zustand.art === 'laedt' ? (
          <p className={styles.hinweis}>Termin wird geladen …</p>
        ) : (
          <FehlerKasten fehler={zustand.fehler} onNochmal={neu} />
        )}
      </div>
    );
  }

  const { plan } = zustand.daten;
  const s = plan.spalten[0];
  const k = kachel(s.tag);
  // Nur Dienste, die es an diesem Termin gibt: `planAus` lässt die übrigen schon weg (ein Termin = eine Spalte).
  const gruppen = plan.gruppen;
  const { ablauf } = zustand;
  const infos = infosNeu ?? s.infos;
  // Infos und Dateien ändern darf, wer den Termin ändern darf – dieselbe Regel (gemessen 02.11.2026).
  const darf = terminAenderbar(start, s.ablaufTermin);
  // Darf ich hier irgendeinen Dienst planen? Dann steht der Hinweis zum Einteilen unter den Diensten (F1).
  const planer = gruppen.some((g) => g.zeilen.some((z) => darfPlanen(z, s)));
  // Meine Plätze an diesem Termin (dieselbe Zeile wie in der Liste) – je Dienst „Tauschen“ darunter.
  const meine = tausch ? (zustand.daten.zeilen[0]?.meine ?? []) : [];
  // Das ⓘ wie in ChurchTools (Entwurf T, Variante B): wo es Infos gibt oder man welche schreiben darf.
  const infoKnopf = (infos !== '' || darf) && (
    <KopfKnopf
      onClick={() => setInfosOffen(true)}
      label="Infos"
      title="Weitere Infos zum Termin"
      symbol={<CtSymbol name="info" size={16} />}
      nurSymbol
    />
  );
  // Die Büroklammer mit der Zahl der Dateien wie in ChurchTools – wo es Dateien gibt oder man welche anhängen darf
  // (dann ohne Zahl, Alwin 02.11.2026).
  const dateien = dateienNeu ?? s.dateien;
  const dateiKnopf = (dateien.length > 0 || darf) && (
    <KopfKnopf
      onClick={() => setDateienOffen(true)}
      label="Dateien"
      title={
        dateien.length > 0
          ? `Dateien zum Termin (${dateien.length})`
          : 'Datei an den Termin anhängen'
      }
      symbol={<CtSymbol name="paperclip" size={16} />}
      zahl={dateien.length > 0 ? dateien.length : undefined}
      nurSymbol
    />
  );

  return (
    <TerminAblauf
      key={terminId}
      start={start}
      zeitzone={zeitzone}
      termin={s}
      ablauf={ablauf}
      onAblauf={(ablauf) => setzeGeladen((alt) => ({ ...alt, ablauf }))}
      bearbeiten={bearbeiten}
      onBearbeiten={setBearbeiten}
      musikApp={musikApp}
      // „Ø 8:10“ leise unter der Dauer beim Bearbeiten (L4-4, A8) – wer es nicht will, schaltet es unter „Meine Anzeige“ aus.
      schnittText={
        anzeige.schnittBeimPlanen
          ? (z) => schnittKurz(verlaeufe.schnitt, z.title, z.song !== null)
          : undefined
      }
      // Nach „Live“ ist der Verlauf neu: frisch lesen, damit der Rückblick des Termins gleich da ist.
      liveStart={liveStart}
      onLiveGeschlossen={() => {
        // Wer über `#/termin/ID/live` kam: Die Adresse zeigt jetzt wieder nur den Termin (Neuladen öffnet Live nicht noch einmal).
        if (liveAusAdresse(window.location.hash))
          window.history.replaceState(null, '', adresseFuerTermin(terminId));
        verlaufCacheLeeren();
        verlaeufe.neuLesen();
      }}
    >
      {(teile) => (
        <div className={styles.seite}>
          <div className={styles.kopf}>
            {zurueckKnopf}
            <div className={styles.termin}>
              <DatumKachel tag={k.tag} monat={k.monat} />
              <div className={styles.titel}>
                <h2>{s.name}</h2>
                <p>
                  {datumText(s.tag)} · {s.uhrzeit} Uhr
                  {teile.ende && ` · Ende ${teile.ende} Uhr`}
                  {s.abgesagt && <b className={styles.abgesagt}> · abgesagt</b>}
                </p>
                {/* Der Anfang der Infos in einer Zeile – antippen öffnet sie ganz. */}
                {infos !== '' && (
                  <button
                    type="button"
                    className={styles.infoZeile}
                    onClick={() => setInfosOffen(true)}
                  >
                    {infos.replace(/\s+/g, ' ')}
                  </button>
                )}
              </div>
              <KopfKnopf
                onClick={() => setTeilenOffen(true)}
                label="Teilen"
                title="Termin als PDF teilen"
                symbol={<Icon name="share" size={16} />}
                nurSymbol
              />
              {planer && <HilfeKnopf seite="Termin" abschnitte={HILFE_TERMIN} />}
            </div>
            {infoKnopf}
            {dateiKnopf}
            {blaettern}
          </div>

          <section className={styles.karte} aria-label="Ablauf">
            <div className={styles.kartenKopf}>
              <h3>Ablauf</h3>
              <span className={styles.kopfKnoepfe}>
                {teile.kopfKnopf}
                {teile.liveKnopf}
                {/* Öffnet den Ablauf DIESES Termins, nicht nur die App (E6-Abschluss, Alwin 30.10.2026). */}
                {musikApp && !bearbeiten && (
                  <KopfLink
                    href={musikAppDirektLink(musikApp, s.id, null, s.tag)}
                    label="Musik-App"
                    symbol={<Icon name="music" size={16} stroke={2.2} />}
                    still
                  />
                )}
                {/* Das Menü „Mehr“ (R6, wie in der Musik-App): Spalten wählen, Ablauf zeigen – im Bearbeiten Als Vorlage, Neu aufsetzen. */}
                {teile.mehrKnopf}
                {/* Auch bei einem leeren Ablauf – sonst ließe er sich nicht füllen (wie in der Musik-App). */}
                {/* „Bearbeiten“ mit Wort wie in der Musik-App und der Matrix – grau, blau erst „Fertig“ (E6-Abschluss,
                    Alwin 30.10.2026: vorher ein runder Stift ohne Wort, leicht zu übersehen). Seit B8 die Stufen der Musik-App:
                    „Bearbeiten“ + „Mehr“, im Bearbeiten grünes „+ Eintrag hinzufügen“, „Mehr“ und blaues „Fertig“. */}
                {teile.darf && ablauf !== null && (
                  <KopfKnopf
                    onClick={() => {
                      teile.fehlerLoeschen();
                      setBearbeiten((b) => !b);
                    }}
                    label={bearbeiten ? 'Fertig' : 'Bearbeiten'}
                    title={bearbeiten ? 'Fertig' : 'Ablauf bearbeiten'}
                    haupt={bearbeiten}
                    symbol={<Icon name={bearbeiten ? 'check' : 'pencil'} size={16} stroke={2.2} />}
                  />
                )}
              </span>
            </div>
            {teile.inhalt}
          </section>

          {/* Der Rückblick (L4-4): nur, wenn Live zu Ende war – die Karte prüft das selbst und fehlt sonst. */}
          {ablauf !== null && verlaeufe.termine?.get(terminId) && (
            <Rueckblick
              terminId={terminId}
              tag={s.tag}
              items={ablauf.items}
              zeitzone={zeitzone}
              verlauf={verlaeufe.termine.get(terminId)!}
              schnitt={verlaeufe.schnitt}
              darfAusnehmen={planer}
              anzeige={anzeige}
              onAusnahmen={(ausnahmen) => {
                const neu = { wechsel: verlaeufe.termine?.get(terminId)?.wechsel ?? [], ausnahmen };
                verlaeufe.setzeTermin(terminId, neu);
                void verlaufImCacheErsetzen(terminId, neu);
              }}
            />
          )}

          <section className={styles.karte} aria-label="Dienste">
            <div className={styles.kartenKopf}>
              <h3>Dienste</h3>
            </div>
            {gruppen.length === 0 ? (
              <p className={styles.hinweis}>
                An diesem Termin stehen keine Dienste, die du sehen darfst.
              </p>
            ) : (
              gruppen.map((g) => (
                <div key={g.gruppe?.id ?? 'weitere'} className={styles.gruppe}>
                  <h4>
                    {gruppenName(g)}
                    <ZauberKnopf
                      onKlick={einteilen.amPlatz.onZauberstab([0], g)}
                      text={`Automatische Planung ${gruppenName(g)}`}
                    />
                  </h4>
                  {g.zeilen.map((z) => {
                    const eigene = meine.filter((d) => d.ort?.serviceId === z.dienst.id);
                    return (
                      <div key={z.dienst.id} className={styles.dienst}>
                        <span>{z.dienst.name}</span>
                        <div className={styles.platzSpalte}>
                          <EinteilPlaetze
                            am={{ ...einteilen.amPlatz, ichId: start.ichId }}
                            s={s}
                            i={0}
                            z={z}
                          />
                          {tausch &&
                            eigene.map((d, i) => (
                              <div key={i} className={styles.tausch}>
                                <TauschAmDienst
                                  d={{
                                    terminId: s.id,
                                    termin: s.name,
                                    tag: s.tag,
                                    uhrzeit: s.uhrzeit,
                                    dienst: d.dienst,
                                    ort: d.ort!,
                                  }}
                                  tausch={tausch}
                                  zeitzone={zeitzone}
                                  vertretung={vertretung}
                                  zugesagt={d.zugesagt}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>
          {einteilen.leiste}
          {einteilen.fenster}
          {teile.ueberlagerung}
          {infosOffen && (
            <InfosFenster
              fuer={`${s.name} · ${datumText(s.tag)}`}
              terminId={s.id}
              text={infos}
              darf={darf}
              onGespeichert={(t) => {
                setInfosNeu(t);
                onGeaendert?.();
              }}
              onClose={() => setInfosOffen(false)}
            />
          )}
          {teilenOffen && (
            <Suspense fallback={null}>
              <TerminTeilenFenster
                quelle={{
                  titel: s.name,
                  tag: s.tag,
                  beginn: s.uhrzeit,
                  gemeinde: start.gemeinde,
                  app: 'Dienstplaner',
                  zeilen: ablauf === null ? null : teile.zeilen,
                  dienste: blattGruppenAus(gruppen),
                  infoGruppen: teile.infoGruppen,
                  ansichtInfos: teile.infoSpalten,
                }}
                onClose={() => setTeilenOffen(false)}
              />
            </Suspense>
          )}
          {dateienOffen && (
            <DateienFenster
              fuer={`${s.name} · ${datumText(s.tag)}`}
              terminId={s.id}
              dateien={dateien}
              darf={darf}
              onAktuell={(d) => {
                setDateienNeu(d);
                // Auch wenn jemand anderes inzwischen geändert hat: Dann ist der Plan ebenso veraltet.
                if (dateienSchluessel(d) !== dateienSchluessel(s.dateien)) onGeaendert?.();
              }}
              onClose={() => setDateienOffen(false)}
            />
          )}
        </div>
      )}
    </TerminAblauf>
  );
}
