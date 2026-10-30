import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { AblaufListe } from '@ui/ablauf/AblaufListe';
import { useAblaufBearbeiten, verlangtNeuLaden } from '@ui/ablauf/useAblaufBearbeiten';
import { AblaufAnlegenFenster, type KopieVorschlag } from '@ui/ablauf/AblaufAnlegenFenster';
import { NeuAufsetzen } from '@ui/ablauf/NeuAufsetzen';
import { InfoSpaltenKnopf } from '@ui/ablauf/InfoSpalten';
import { useInfoSpalten } from '@ui/ablauf/infoSpaltenWahl';
import { browserAblaufLeser, browserSchreiber } from '@ui/ct/schreiber';
import { infoGruppen, siehtAlleDienstgruppen } from '@shared/ct/dienstRechte';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { datumText, tagKurz } from '@shared/ct/datum';
import type { AblaufTermin } from '@shared/ct/ablaufRecht';
import { ablaufAnlegen } from '@shared/ct/ablaufAnlegen';
import { ablaufBestandLesen, ablaufNeuAufsetzen, type AblaufStand } from '@shared/ct/ablaufNeu';
import { vorlagenFuer } from '@shared/ct/ablaufVorschlaege';
import type { CtAgenda, CtSong } from '@shared/ct/typen';
import type { AblaufQuelle, AblaufVorlage } from '@shared/types/index';
import { autorVon, ladeAblauf, ladeLiedDaten } from './ladeBeiwerk';
import { ablaufAktionen, GESPERRT } from './ablaufAktionen';
import { ladeKopieVorschlaege, ladeVorlagen, WOCHEN_ZURUECK } from './ladeAnlegen';
import { ablaufBearbeitbar, type Start } from './start';
import { LiedAnsicht } from './LiedAnsicht';
import styles from './TerminAblauf.module.scss';

const NEU_LADEN_FEHLT =
  'Gespeichert. Der Ablauf ließ sich danach nicht neu laden – zum Aktualisieren den Termin neu öffnen.';

/** Was der Ablauf über seinen Termin wissen muss – aus der Termin-Ansicht oder einer Spalte der Matrix. */
export interface AblaufFuerTermin {
  id: number;
  name: string;
  /** Tag (`JJJJ-MM-TT`, Ortszeit der Gemeinde) und Uhrzeit des Beginns („10:00“). */
  tag: string;
  uhrzeit: string;
  /** Beginn wie von ChurchTools (`startDate`, ISO) – für „Ablauf anlegen“. */
  beginn: string;
  /** Kalender und Admins für die Bearbeiten-Regel (`ablaufBearbeitbar`). */
  ablaufTermin: AblaufTermin;
}

/** Was `TerminAblauf` an seinen Aufrufer gibt – der stellt die Teile an ihre Orte. */
export interface AblaufTeile {
  /** Ansicht, Bearbeiten-Liste oder „kein Ablauf“ (mit „Ablauf anlegen“, wo man darf). */
  inhalt: ReactNode;
  /**
   * Das grüne „+ Eintrag hinzufügen“ am Rechner: in der Termin-Ansicht im Kopf, in der Matrix als Plus neben „N Punkte“
   * (E6-6c).
   */
  kopfKnopf: ReactNode;
  /** Fenster und Hinweise – schweben über der Seite. */
  ueberlagerung: ReactNode;
  /** Darf man diesen Ablauf bearbeiten (`ablaufBearbeitbar`)? */
  darf: boolean;
  /** Die Fehlerzeile über der Bearbeiten-Liste leeren (beim Umschalten des Stifts). */
  fehlerLoeschen: () => void;
  /**
   * Der Knopf „Spalten“ (Infos je Dienstgruppe, E6-4) für den Kopf – nur in der Termin-Ansicht, nicht beim Bearbeiten
   * und nicht in der Matrix (dort keine Infos, Entwurf Bild 4 A).
   */
  spaltenKnopf: ReactNode;
}

/**
 * **Der Ablauf eines Termins** – eine Stelle für die Termin-Ansicht (E6-1b … E6-5) und jede Spalte der Matrix (E6-6a,
 * Entwurf `e6-6-entwurf-2.html`): Lieder nachladen, Ansicht, Bearbeiten-Liste (`useAblaufBearbeiten`), Lied-Ansicht
 * (O4), „Ablauf anlegen“ und „Neu aufsetzen“ (nur Termin-Ansicht), und nach dem Speichern den Ablauf neu lesen. Vorher
 * stand das alles in der Termin-Ansicht; die Matrix hätte es nachbauen müssen.
 *
 * Den Ablauf selbst lädt der Aufrufer (die Termin-Ansicht zusammen mit dem Termin, die Matrix für die gezeigten Spalten)
 * und bekommt jeden neu gelesenen Stand über `onAblauf` zurück. Je Termin eine eigene Instanz (`key` = Termin): Ein
 * Neu-Lesen, das erst nach dem Wechsel ankommt, zählt dann nicht mehr.
 */
export function TerminAblauf({
  start,
  zeitzone,
  termin,
  ablauf,
  onAblauf,
  bearbeiten,
  onBearbeiten,
  musikApp,
  schmal = false,
  mitNeuAufsetzen = true,
  children,
}: {
  start: Start;
  zeitzone: string;
  termin: AblaufFuerTermin;
  /** Der geladene Ablauf; `null` = der Termin hat keinen. */
  ablauf: CtAgenda | null;
  onAblauf: (neu: CtAgenda | null) => void;
  /** Bearbeiten-Modus – gilt nur, wo man darf. */
  bearbeiten: boolean;
  /** Nach „Ablauf anlegen“ gleich bearbeiten (`true`), nach einem inzwischen gelöschten Ablauf nicht mehr (`false`). */
  onBearbeiten: (an: boolean) => void;
  /** Adresse der Musik-App für die Lied-Ansicht: `undefined` = noch unbekannt, `null` = nicht installiert. */
  musikApp: string | null | undefined;
  /** Schmale Form für die Matrix: nur Uhrzeit, Dauer und Titel. */
  schmal?: boolean;
  /**
   * „Neu aufsetzen …“ anbieten – nur in der Termin-Ansicht: Es ersetzt den ganzen Ablauf und braucht Platz für die
   * Nachfrage (Entwurf E6-6 Bild 2). Die Matrix lässt es weg, auch am Handy.
   */
  mitNeuAufsetzen?: boolean;
  children: (teile: AblaufTeile) => ReactNode;
}) {
  const terminId = termin.id;
  const darf = ablaufBearbeitbar(start, termin.ablaufTermin);
  const aktiv = bearbeiten && darf;
  // Die Lied-Ansicht (E6-O O4): aus der Ablauf-Ansicht der angetippte Punkt.
  const [liedOffen, setLiedOffen] = useState<AblaufZeile | null>(null);
  // Die Lieder des Ablaufs aus ChurchTools: Autor für die Lied-Karte (E6-O1), alles Weitere für die Lied-Ansicht (O4).
  const [lieder, setLieder] = useState<Map<number, CtSong>>(new Map());
  // „Ablauf anlegen“ (E6-5a) und „Neu aufsetzen“ (E6-5b, `neu`): Fenster und was es braucht – erst beim Öffnen geladen.
  const [anlegen, setAnlegen] = useState<{
    neu: boolean;
    vorlagen: { liste: AblaufVorlage[]; laedt: boolean; fehler: boolean };
    vorschlaege: KopieVorschlag[] | null;
  } | null>(null);
  // Nur das zuletzt angestoßene Neu-Lesen zählt – sonst überschriebe eine langsame ältere Antwort eine neuere. Nach dem
  // Aushängen (anderer Termin) zählt keines mehr.
  const ladeNr = useRef(0);
  // Eigener Merker statt `ladeNr` zu verderben: Im StrictMode hängt React Effekte einmal aus und wieder ein.
  const eingehaengt = useRef(false);
  useEffect(() => {
    eingehaengt.current = true;
    return () => {
      eingehaengt.current = false;
    };
  }, []);

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
  // Infos je Dienstgruppe (E6-4): nur die Gruppen, die man sieht – dieselbe Regel, nach der ChurchTools filtert.
  const gruppen = useMemo(
    () => infoGruppen(start.rechte, start.dienstgruppen),
    [start.rechte, start.dienstgruppen],
  );
  const spalten = useInfoSpalten('dienstplaner.ablauf.infoSpalten', gruppen);

  /** Die Lied-Ansicht zu einem Punkt (E6-O O4) – eine Stelle für die Ablauf-Ansicht und das Punkt-Fenster. */
  const liedAnsicht = (p: AblaufZeile, schliessen: () => void, zurueck?: () => void) =>
    p.song ? (
      <LiedAnsicht
        terminId={terminId}
        tag={termin.tag}
        punkt={{ ...p, song: p.song }}
        lied={p.song.songId !== undefined ? lieder.get(p.song.songId) : undefined}
        musikApp={musikApp}
        onClose={schliessen}
        zurueck={zurueck}
      />
    ) : null;

  const ziel = {
    beginn: termin.beginn,
    tag: termin.tag,
    kalenderId: termin.ablaufTermin.kalenderId ?? null,
  };

  const liste = useAblaufBearbeiten({
    aktiv,
    bereit: ablauf !== null,
    items: zeilen,
    // Dieselbe Uhrzeit wie der Balken „Beginn“ in der Ansicht.
    beginn: termin.uhrzeit,
    abgeschlossen: ablauf?.isLocked === true,
    sperrHinweis: GESPERRT,
    aktionen: ablaufAktionen(terminId, () => ablaufNeuLaden()),
    dienste,
    gruppenVerborgen: !siehtAlleDienstgruppen(start.rechte, start.dienstgruppen),
    infoGruppen: gruppen,
    // Ablauf inzwischen anders (404/409/412/423, Regel `verlangtNeuLaden`): frisch lesen, damit Liste und Hinweis
    // stimmen. Einen Knopf „neu laden“ gibt es hier nicht.
    beiFehler: (e) => {
      if (verlangtNeuLaden(e)) ablaufNeuLaden();
    },
    // „Neu aufsetzen“ ersetzt den ganzen Ablauf und braucht Platz für die Nachfrage – nur in der Termin-Ansicht
    // (Entwurf E6-6 Bild 2).
    neuAufsetzen: mitNeuAufsetzen ? () => anlegenOeffnen(true) : undefined,
    // Am Rechner/iPad das grüne „+“ oben rechts im Ablauf-Kopf (wie „+ Termin“ im ChurchTools-Kalender), am Handy
    // bleibt das schwebende Plus (Alwin, 28.10.2026 – wie die Musik-App seit S2). In der Matrix nur das Plus, neben
    // „N Punkte“ in der Gruppenzeile (E6-6c, Alwin 29.10.2026).
    plusImKopf: true,
    plusName: `Eintrag hinzufügen – ${termin.name}, ${tagKurz(termin.tag)}`,
    schmal,
    // In der Matrix zieht jede Spalte im gemeinsamen Zieh-Bereich – auch in einen anderen Termin (E6-6b).
    ziehen: schmal ? { spalte: terminId, neuLaden: ablaufNeuLaden } : undefined,
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
        if (nr !== ladeNr.current || !eingehaengt.current) return;
        onAblauf(neu);
        if (neu === null) onBearbeiten(false); // inzwischen gelöscht
      },
      () => {
        if (nr === ladeNr.current && eingehaengt.current) {
          liste.fehlerZeigen(null, NEU_LADEN_FEHLT);
        }
      },
    );
  }

  /**
   * Fenster „Ablauf anlegen“ bzw. „Neu aufsetzen“ (`neu`) öffnen und Vorlagen + frühere Termine nachladen (Beiwerk:
   * Fehler steht im Fenster).
   */
  function anlegenOeffnen(neu = false): void {
    setAnlegen({ neu, vorlagen: { liste: [], laedt: true, fehler: false }, vorschlaege: null });
    ladeVorlagen().then(
      (vorlagen) =>
        setAnlegen(
          (a) =>
            a && {
              ...a,
              vorlagen: {
                liste: vorlagenFuer(vorlagen, ziel.kalenderId),
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
  async function anlegenMit(quelle: AblaufQuelle): Promise<void> {
    if (ziel.kalenderId === null) {
      throw new Error('Der Kalender dieses Termins ist unbekannt. Bitte die Seite neu laden.');
    }
    await ablaufAnlegen(browserSchreiber, terminId, ziel.kalenderId, quelle);
    setAnlegen(null);
    onBearbeiten(true);
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
  ): Promise<void> {
    return ablaufNeuAufsetzen(
      browserSchreiber,
      terminId,
      ziel.kalenderId,
      quelle,
      gesehen,
      nurDieser,
    );
  }

  const fuer = `${termin.name} · ${datumText(termin.tag)} · ${termin.uhrzeit} Uhr`;
  const keineVorschlaege =
    anlegen?.vorschlaege === null
      ? 'Frühere Termine werden geladen …'
      : `Kein früherer Termin mit Ablauf in den letzten ${WOCHEN_ZURUECK} Wochen.`;

  // „Ablauf anlegen“: Wer den Ablauf bearbeiten darf, darf ihn auch anlegen (gemessen E6-0) – dieselbe Regel. In der
  // Matrix steht der Knopf erst nach dem Stift (Entwurf E6-6 Bild 2), sonst stünde er in jeder leeren Spalte.
  const anlegenKnopf = darf && (!schmal || aktiv) && (
    <button
      type="button"
      className={schmal ? styles.anlegenSchmal : styles.anlegenKnopf}
      onClick={() => anlegenOeffnen()}
    >
      <Icon name="plus" size={schmal ? 14 : 16} /> Ablauf anlegen
    </button>
  );

  const inhalt =
    ablauf === null ? (
      schmal ? (
        anlegenKnopf || (
          <span className={styles.keiner} aria-label="kein Ablauf">
            –
          </span>
        )
      ) : (
        <div className={styles.ohneAblauf}>
          <p className={styles.hinweis}>Noch kein Ablauf.</p>
          {anlegenKnopf}
        </div>
      )
    ) : aktiv ? (
      <div className={styles.ablaufGrund}>{liste.liste}</div>
    ) : zeilen.length === 0 ? (
      <p className={`${styles.hinweis}${schmal ? ` ${styles.leerSchmal}` : ''}`}>
        Der Ablauf ist noch leer.
      </p>
    ) : (
      // Die Liste wie die ChurchTools-App (E6-O1): weiß mit feinen Linien, bis an den Rand.
      <div className={styles.ablaufGrund}>
        <AblaufListe
          zeilen={zeilen}
          beginn={termin.uhrzeit}
          onLied={(_, p) => setLiedOffen(p)}
          schmal={schmal}
          // Matrix: wo der Ablauf aufhört (Alwin, 29.10.2026, Entwurf `e6-6-trennung.html` C).
          mitEnde={schmal}
          infoSpalten={spalten.gewaehlt}
        />
      </div>
    );

  const ueberlagerung = (
    <>
      {liste.ueberlagerung}
      {liedOffen && liedAnsicht(liedOffen, () => setLiedOffen(null))}
      {anlegen && !anlegen.neu && (
        <AblaufAnlegenFenster
          fuer={fuer}
          vorlagen={anlegen.vorlagen}
          vorschlaege={anlegen.vorschlaege ?? []}
          keineVorschlaege={keineVorschlaege}
          onAnlegen={anlegenMit}
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
          neuAufsetzen={neuAufsetzenMit}
          neuLaden={ablaufNeuLaden}
          onClose={() => setAnlegen(null)}
        />
      )}
    </>
  );

  return children({
    inhalt,
    kopfKnopf: liste.kopfKnopf,
    ueberlagerung,
    darf,
    fehlerLoeschen: liste.fehlerLoeschen,
    spaltenKnopf:
      !schmal && !aktiv && ablauf !== null && zeilen.length > 0 ? (
        <InfoSpaltenKnopf
          gruppen={gruppen}
          zeilen={zeilen}
          ids={spalten.ids}
          onIds={spalten.setIds}
        />
      ) : null,
  });
}
