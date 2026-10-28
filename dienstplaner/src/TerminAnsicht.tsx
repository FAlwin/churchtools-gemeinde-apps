import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { AblaufListe } from '@ui/ablauf/AblaufListe';
import { useAblaufBearbeiten, verlangtNeuLaden } from '@ui/ablauf/useAblaufBearbeiten';
import { siehtAlleDienstgruppen } from '@shared/ct/dienstRechte';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { datumText, kachel } from '@shared/ct/datum';
import type { CtAgenda, CtSong } from '@shared/ct/typen';
import { gruppenName } from '@shared/dienstplan/plan';
import { ladeTermin, type TerminDaten } from './ladeTermine';
import { autorVon, ladeAblauf, ladeLiedDaten, ladeMusikApp } from './ladeBeiwerk';
import { ablaufAktionen } from './ablaufAktionen';
import { ladeKopieVorschlaege, ladeVorlagen, WOCHEN_ZURUECK } from './ladeAnlegen';
import { AblaufAnlegenFenster, type KopieVorschlag } from '@ui/ablauf/AblaufAnlegenFenster';
import { NeuAufsetzen } from '@ui/ablauf/NeuAufsetzen';
import { browserAblaufLeser, browserSchreiber } from '@ui/ct/schreiber';
import { ablaufAnlegen } from '@shared/ct/ablaufAnlegen';
import { ablaufBestandLesen, ablaufNeuAufsetzen, type AblaufStand } from '@shared/ct/ablaufNeu';
import { vorlagenFuer } from '@shared/ct/ablaufVorschlaege';
import type { AblaufQuelle, AblaufVorlage } from '@shared/types/index';
import { Plaetze } from './Planen';
import { ablaufBearbeitbar, type Start } from './start';
import { LiedAnsicht } from './LiedAnsicht';
import styles from './TerminAnsicht.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: TerminDaten; ablauf: CtAgenda | null };

const NEU_LADEN_FEHLT =
  'Gespeichert. Der Ablauf ließ sich danach nicht neu laden – zum Aktualisieren den Termin neu öffnen.';

/** Hinweis, wenn man einen abgeschlossenen Ablauf ändern will – öffnen kann man ihn hier (noch) nicht. */
const GESPERRT =
  'Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern erst in ChurchTools oder in der Musik-App öffnen.';

/**
 * **Die Termin-Ansicht** (Bauplan E6-1b, Entwurf `e6-entwurf.html` Bild 1): oben der Ablauf – derselbe Baustein wie in
 * der Musik-App (`ui/ablauf/AblaufListe`; seit E6-O1 wie die ChurchTools-App, Dauer unter der Uhrzeit) –, darunter die Dienste des
 * Termins mit denselben Plätzen wie in „Planen“. ‹ › blättert durch die geladenen Termine.
 *
 * **Bearbeiten** (E6-3a, #645): Wer den Ablauf bearbeiten darf (`ablaufBearbeitbar`, dieselbe Regel wie die
 * Musik-App), bekommt einen Stift – danach dieselbe Bearbeiten-Liste wie in der Musik-App
 * (`ui/ablauf/useAblaufBearbeiten`), ohne Liedwahl (Lieder wählt man in der Musik-App). Gespeichert wird sofort in
 * ChurchTools; danach wird der Ablauf neu gelesen.
 *
 * Geladen wird der Termin frisch (`ladeTermin`, dieselbe Regel wie Liste und Matrix) – er kann auch außerhalb des
 * geladenen Zeitraums liegen (aus „Planen“ mit eigenem Zeitraum).
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
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);
  // Adresse der Musik-App: `undefined` = noch unbekannt, `null` = nicht installiert (die Lied-Ansicht sagt es dann).
  const [musikApp, setMusikApp] = useState<string | null | undefined>(undefined);
  // Die Lied-Ansicht (E6-O O4): aus der Ablauf-Ansicht der angetippte Punkt.
  const [liedOffen, setLiedOffen] = useState<AblaufZeile | null>(null);
  // Autoren für die Lied-Karte (E6-O1) – Beiwerk, je Ablauf eine Sammelabfrage; scheitert sie, fehlt nur der Autor.
  // Die Lieder des Ablaufs aus ChurchTools: Autor für die Lied-Karte (E6-O1), alles Weitere für die Lied-Ansicht (O4).
  const [lieder, setLieder] = useState<Map<number, CtSong>>(new Map());
  const [bearbeiten, setBearbeiten] = useState(false);
  // „Ablauf anlegen“ (E6-5a) und „Neu aufsetzen“ (E6-5b, `neu`): Fenster und was es braucht – erst beim Öffnen geladen.
  const [anlegen, setAnlegen] = useState<{
    neu: boolean;
    vorlagen: { liste: AblaufVorlage[]; laedt: boolean; fehler: boolean };
    vorschlaege: KopieVorschlag[] | null;
  } | null>(null);
  // Nur das zuletzt angestoßene Neu-Lesen zählt – sonst überschriebe eine langsame ältere Antwort eine neuere.
  const ladeNr = useRef(0);

  useEffect(() => {
    let aktuell = true;
    ladeNr.current++;
    setBearbeiten(false);
    setAnlegen(null);
    setZustand({ art: 'laedt' });
    Promise.all([ladeTermin(start, terminId, zeitzone), ladeAblauf(terminId)]).then(
      ([daten, ablauf]) => aktuell && setZustand({ art: 'fertig', daten, ablauf }),
      (e: unknown) => aktuell && setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
  }, [start, terminId, zeitzone, versuch]);

  const ablauf = zustand.art === 'fertig' ? zustand.ablauf : null;
  const zeilen = useMemo(
    () =>
      (ablauf?.items ?? []).map((i) => {
        const z = ablaufZeileAus(i, terminId, zeitzone);
        const autor = i.song ? autorVon(lieder.get(i.song.songId)) : null;
        return z.song && autor ? { ...z, song: { ...z.song, author: autor } } : z;
      }),
    [ablauf, terminId, zeitzone, lieder],
  );
  // Lieder des Ablaufs einmal je Stand nachladen (der Ablauf nennt weder Autor noch Dateien, gemessen E6-O0).
  const liedIds = useMemo(
    () => (ablauf?.items ?? []).flatMap((i) => (i.song ? [i.song.songId] : [])).join(','),
    [ablauf],
  );
  useEffect(() => {
    let aktuell = true;
    const ids = liedIds ? liedIds.split(',').map(Number) : [];
    ladeLiedDaten(ids).then(
      (l) => aktuell && setLieder(l),
      () => aktuell && setLieder(new Map()),
    );
    return () => {
      aktuell = false;
    };
  }, [liedIds]);
  const dienste = useMemo(
    () => [...start.dienste.values()].map((d) => ({ id: d.id, name: d.name })),
    [start.dienste],
  );

  /** Die Lied-Ansicht zu einem Punkt (E6-O O4) – eine Stelle für die Ablauf-Ansicht und das Punkt-Fenster. */
  const liedAnsicht = (p: AblaufZeile, schliessen: () => void, zurueck?: () => void) =>
    p.song ? (
      <LiedAnsicht
        terminId={terminId}
        punkt={{ ...p, song: p.song }}
        lied={p.song.songId !== undefined ? lieder.get(p.song.songId) : undefined}
        musikApp={musikApp}
        onClose={schliessen}
        zurueck={zurueck}
      />
    ) : null;

  const liste = useAblaufBearbeiten({
    aktiv: bearbeiten,
    bereit: ablauf !== null,
    items: zeilen,
    // Dieselbe Uhrzeit wie der Balken „Beginn“ in der Ansicht (`s.uhrzeit` unten).
    beginn: zustand.art === 'fertig' ? (zustand.daten.plan.spalten[0]?.uhrzeit ?? '') : '',
    abgeschlossen: ablauf?.isLocked === true,
    sperrHinweis: GESPERRT,
    aktionen: ablaufAktionen(terminId, () => ablaufNeuLaden()),
    dienste,
    gruppenVerborgen: !siehtAlleDienstgruppen(start.rechte, start.dienstgruppen),
    // Ablauf inzwischen anders (404/409/412/423, Regel `verlangtNeuLaden`): frisch lesen, damit Liste und Hinweis
    // stimmen. Einen Knopf „neu laden“ hat die Termin-Ansicht nicht.
    beiFehler: (e) => {
      if (verlangtNeuLaden(e)) ablaufNeuLaden();
    },
    neuAufsetzen:
      zustand.art === 'fertig' ? () => anlegenOeffnen(zielVon(zustand.daten), true) : undefined,
    // Am Rechner/iPad das grüne „+“ oben rechts im Ablauf-Kopf (wie „+ Termin“ im ChurchTools-Kalender), am Handy
    // bleibt das schwebende Plus (Alwin, 28.10.2026 – wie die Musik-App seit S2).
    plusImKopf: true,
    // Im Punkt-Fenster: die Zeile „Lied“ öffnet die Lied-Ansicht an seiner Stelle (Alwin, 28.10.2026: an beiden Stellen).
    liedAnsehen: (p, zurueck, schliessen) => liedAnsicht(p, schliessen, zurueck),
  });

  // Fest je Termin – `NeuAufsetzen` liest damit beim Öffnen und bei „Weiter“.
  const bestandLesen = useCallback(
    () => ablaufBestandLesen(browserAblaufLeser, terminId, zeitzone),
    [terminId, zeitzone],
  );

  /**
   * Nach dem Speichern nur den Ablauf neu lesen. Scheitert das, war das Speichern trotzdem gelungen: Der Stand bleibt
   * stehen, oben steht ein Hinweis – zurückgerollt wird nichts.
   */
  function ablaufNeuLaden(): void {
    const nr = ++ladeNr.current;
    ladeAblauf(terminId).then(
      (neu) => {
        if (nr !== ladeNr.current) return;
        setZustand((z) => (z.art === 'fertig' ? { ...z, ablauf: neu } : z));
        if (neu === null) setBearbeiten(false); // inzwischen gelöscht
      },
      () => {
        if (nr === ladeNr.current) liste.fehlerZeigen(null, NEU_LADEN_FEHLT);
      },
    );
  }

  /**
   * Fenster „Ablauf anlegen“ bzw. „Neu aufsetzen“ (`neu`) öffnen und Vorlagen + frühere Termine nachladen (Beiwerk:
   * Fehler steht im Fenster).
   */
  function anlegenOeffnen(
    ziel: { beginn: string; tag: string; kalenderId: number | null },
    neu = false,
  ): void {
    setAnlegen({ neu, vorlagen: { liste: [], laedt: true, fehler: false }, vorschlaege: null });
    ladeVorlagen().then(
      (liste) =>
        setAnlegen(
          (a) =>
            a && {
              ...a,
              vorlagen: {
                liste: vorlagenFuer(liste, ziel.kalenderId),
                laedt: false,
                fehler: false,
              },
            },
        ),
      () => setAnlegen((a) => a && { ...a, vorlagen: { liste: [], laedt: false, fehler: true } }),
    );
    ladeKopieVorschlaege({ id: terminId, ...ziel }, zeitzone).then(
      (vorschlaege) => setAnlegen((a) => a && { ...a, vorschlaege }),
      () => setAnlegen((a) => a && { ...a, vorschlaege: [] }),
    );
  }

  /** Anlegen über den Schreibkern (prüft vorher und liest nachher nach), danach gleich bearbeiten. */
  async function anlegenMit(quelle: AblaufQuelle, kalenderId: number | null): Promise<void> {
    if (kalenderId === null) {
      throw new Error('Der Kalender dieses Termins ist unbekannt. Bitte die Seite neu laden.');
    }
    await ablaufAnlegen(browserSchreiber, terminId, kalenderId, quelle);
    setAnlegen(null);
    setBearbeiten(true);
    ablaufNeuLaden();
  }

  /**
   * Neu aufsetzen über den Kern (vergleicht vorher mit der Nachfrage, liest nachher nach). Ohne Kalender nimmt er den
   * des Ablaufs – gebraucht wird er nur beim Lösen.
   */
  function neuAufsetzenMit(
    quelle: AblaufQuelle,
    gesehen: AblaufStand,
    nurDieser: boolean,
    kalenderId: number | null,
  ): Promise<void> {
    return ablaufNeuAufsetzen(browserSchreiber, terminId, kalenderId, quelle, gesehen, nurDieser);
  }

  // Beiwerk wie auf der Startseite: scheitert es, fehlt nur der Knopf.
  useEffect(() => {
    let aktuell = true;
    ladeMusikApp().then(
      (url) => aktuell && setMusikApp(url),
      () => {},
    );
    return () => {
      aktuell = false;
    };
  }, []);

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
          <FehlerKasten fehler={zustand.fehler} onNochmal={() => setVersuch((v) => v + 1)} />
        )}
      </div>
    );
  }

  const { plan } = zustand.daten;
  const s = plan.spalten[0];
  const k = kachel(s.tag);
  // Nur Dienste, die es an diesem Termin gibt: `planAus` lässt die übrigen schon weg (ein Termin = eine Spalte).
  const gruppen = plan.gruppen;
  const ende = zustand.daten.zeilen[0]?.endeUhrzeit ?? null;
  const darf = ablaufBearbeitbar(start, zustand.daten.ablaufTermin);
  const fuer = `${s.name} · ${datumText(s.tag)} · ${s.uhrzeit} Uhr`;
  const keineVorschlaege =
    anlegen?.vorschlaege === null
      ? 'Frühere Termine werden geladen …'
      : `Kein früherer Termin mit Ablauf in den letzten ${WOCHEN_ZURUECK} Wochen.`;

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        {zurueckKnopf}
        <div className={styles.termin}>
          <DatumKachel tag={k.tag} monat={k.monat} />
          <div className={styles.titel}>
            <h2>{s.name}</h2>
            <p>
              {datumText(s.tag)} · {s.uhrzeit} Uhr
              {ende && ` · Ende ca. ${ende} Uhr`}
              {s.abgesagt && <b className={styles.abgesagt}> · abgesagt</b>}
            </p>
          </div>
        </div>
        {blaettern}
      </div>

      <section className={styles.karte} aria-label="Ablauf">
        <div className={styles.kartenKopf}>
          <h3>Ablauf</h3>
          <span className={styles.kopfKnoepfe}>
            {liste.kopfKnopf}
            {musikApp && !bearbeiten && (
              <a className={styles.leise} href={musikApp}>
                <Icon name="music" size={16} /> Musik-App
              </a>
            )}
            {/* Auch bei einem leeren Ablauf – sonst ließe er sich nicht füllen (wie in der Musik-App). */}
            {darf && ablauf !== null && (
              <button
                type="button"
                className={styles.rund}
                aria-label={bearbeiten ? 'Fertig' : 'Ablauf bearbeiten'}
                title={bearbeiten ? 'Fertig' : 'Ablauf bearbeiten'}
                onClick={() => {
                  liste.fehlerLoeschen();
                  setBearbeiten((b) => !b);
                }}
              >
                <Icon name={bearbeiten ? 'check' : 'pencil'} size={16} />
              </button>
            )}
          </span>
        </div>
        {ablauf === null ? (
          <div className={styles.ohneAblauf}>
            <p className={styles.hinweis}>Noch kein Ablauf.</p>
            {/* Wer den Ablauf bearbeiten darf, darf ihn auch anlegen (gemessen E6-0) – dieselbe Regel. */}
            {darf && (
              <button
                type="button"
                className={styles.anlegenKnopf}
                onClick={() => anlegenOeffnen(zielVon(zustand.daten))}
              >
                <Icon name="plus" size={16} /> Ablauf anlegen
              </button>
            )}
          </div>
        ) : bearbeiten ? (
          <div className={styles.ablaufGrund}>{liste.liste}</div>
        ) : zeilen.length === 0 ? (
          <p className={styles.hinweis}>Der Ablauf ist noch leer.</p>
        ) : (
          // Die Liste wie die ChurchTools-App (E6-O1): weiß mit feinen Linien, bis an den Rand der Karte.
          <div className={styles.ablaufGrund}>
            <AblaufListe zeilen={zeilen} beginn={s.uhrzeit} onLied={(_, p) => setLiedOffen(p)} />
          </div>
        )}
      </section>

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
              <h4>{gruppenName(g)}</h4>
              {g.zeilen.map((z) => (
                <div key={z.dienst.id} className={styles.dienst}>
                  <span>{z.dienst.name}</span>
                  <Plaetze plaetze={z.zellen[0] ?? []} ichId={start.ichId} />
                </div>
              ))}
            </div>
          ))
        )}
      </section>
      {liste.ueberlagerung}
      {liedOffen && liedAnsicht(liedOffen, () => setLiedOffen(null))}
      {anlegen && !anlegen.neu && (
        <AblaufAnlegenFenster
          fuer={fuer}
          vorlagen={anlegen.vorlagen}
          vorschlaege={anlegen.vorschlaege ?? []}
          keineVorschlaege={keineVorschlaege}
          onAnlegen={(q) => anlegenMit(q, zustand.daten.ablaufTermin.kalenderId ?? null)}
          onClose={() => setAnlegen(null)}
        />
      )}
      {anlegen?.neu && (
        <NeuAufsetzen
          fuer={fuer}
          vorlagen={anlegen.vorlagen}
          vorschlaege={anlegen.vorschlaege ?? []}
          keineVorschlaege={keineVorschlaege}
          bestandLesen={bestandLesen}
          neuAufsetzen={(q, gesehen, nurDieser) =>
            neuAufsetzenMit(q, gesehen, nurDieser, zustand.daten.ablaufTermin.kalenderId ?? null)
          }
          neuLaden={ablaufNeuLaden}
          onClose={() => setAnlegen(null)}
        />
      )}
    </div>
  );
}

/** Was „Ablauf anlegen“ und „Neu aufsetzen“ über den Termin wissen müssen – eine Stelle für beide Knöpfe. */
function zielVon(d: TerminDaten): { beginn: string; tag: string; kalenderId: number | null } {
  return {
    beginn: d.zeilen[0]?.beginn ?? '',
    tag: d.plan.spalten[0].tag,
    kalenderId: d.ablaufTermin.kalenderId ?? null,
  };
}
