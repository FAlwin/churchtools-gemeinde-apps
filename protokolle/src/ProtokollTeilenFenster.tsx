import { useContext, useMemo } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { PdfKnoepfe, PdfStandUndVorschau } from '@ui/teilen/pdfFenster';
import { useGebautesPdf, useStand } from '@ui/teilen/pdfFensterZustand';
import { protokollPdf } from '@ui/teilen/protokollPdf';
import styles from '@ui/teilen/TeilenFenster.module.scss';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Person } from '@shared/organigramm/mitglieder';
import type { TreffenStand } from '@shared/protokolle/anwesenheit';
import { nameAusListe, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { Block } from '@shared/protokolle/dokument';
import { letztesProtokoll } from '@shared/protokolle/festePunkte';
import type { KopfMitVerlauf } from '@shared/protokolle/freigabe';
import { protokollBlatt } from '@shared/protokolle/protokollBlatt';
import { ReiheKontext } from './themenreiheKontext';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { anwesenheitLesen } from './anwesenheitSchreiben';
import { papierFarbe } from './farben';
import { ladeGruppenMitglieder } from './mitglieder';

/** Was das Fenster aus ChurchTools liest – austauschbar für Tests. */
export interface TeilenLesen {
  anwesenheit: (gruppe: number, treffen: number) => Promise<TreffenStand>;
  mitglieder: (gruppe: number) => Promise<Person[] | 'verborgen'>;
}

const LESEN: TeilenLesen = { anwesenheit: anwesenheitLesen, mitglieder: ladeGruppenMitglieder };

interface Daten {
  anwesenheit: TreffenStand | null | 'unbekannt';
  mitglieder: readonly Person[] | 'verborgen';
}

export interface ProtokollTeilenProps {
  sitzung: Sitzung;
  gruppe: string;
  gruppeId: number;
  /** Der Kopf, wie er gerade gilt – im Editor der frisch geladene, sonst `sitzung.kopf`. */
  kopf: KopfMitVerlauf | null;
  /** Das Protokoll – im Editor der Stand im Editor, auch wenn er noch nicht gespeichert ist. */
  dokument: readonly Block[];
  aufgaben: readonly Aufgabe[];
  /** Die freigegebenen Protokolle der Gruppe (für „Letztes Protokoll“). */
  protokolle: readonly Sitzung[];
  /** Beginn der nächsten Sitzung (ISO) – `null`, wenn keine festgelegt ist. */
  naechste: string | null;
  zeitzone: string;
  gemeinde: string | null;
  /** Wer angemeldet ist – sich selbst kennt man auch ohne Mitgliederliste. */
  ich: { person: number; name: string };
  /** Die Mitglieder, wenn der Aufrufer sie schon hat (Editor) – sonst liest das Fenster sie selbst. */
  mitglieder?: readonly Person[] | 'verborgen' | null;
  onClose: () => void;
  lesen?: TeilenLesen;
}

/**
 * **„Protokoll teilen“** (Bauplan S6-3b, Entwurf `s6-freigabe-pdf-v1`, abgenommen 11.11.2026) – aus der Sitzungsansicht
 * und dem Editor, für alle, die das Protokoll lesen dürfen. Das PDF kommt aus `protokollBlatt` (S6-3a) und wird auf dem
 * gemeinsamen Satz gezeichnet; das Fenster selbst ist dasselbe wie im Dienstplaner (`ui/teilen/pdfFenster.tsx`):
 * Stand, Seiten, „Herunterladen“ und „Teilen“. Im Entwurf trägt das PDF Banner, Wasserzeichen und „ENTWURF“ im
 * Dateinamen.
 *
 * Vorher liest es frisch, was die Seite nicht schon hat: die Anwesenheit aus dem Gruppentreffen und – außerhalb des
 * Editors – die Mitglieder für die Namen bei den To-Dos. Scheitert eins, entsteht das PDF trotzdem: Die Anwesenheit
 * sagt dann, dass sie sich nicht laden ließ; Zuständige ohne Namen werden gezählt („eine weitere Person“).
 */
export function ProtokollTeilenFenster(props: ProtokollTeilenProps) {
  const { sitzung, kopf, gruppeId, mitglieder, onClose, lesen = LESEN } = props;
  const treffen = kopf?.treffen ?? sitzung.treffen;
  const { stand } = useLaden<Daten>(async () => {
    const [anwesenheit, liste] = await Promise.all([
      treffen === null
        ? null
        : lesen.anwesenheit(gruppeId, treffen).catch((e: unknown) => {
            console.warn('[protokoll teilen] Anwesenheit nicht geladen:', e);
            return 'unbekannt' as const;
          }),
      mitglieder
        ? mitglieder
        : lesen.mitglieder(gruppeId).catch((e: unknown) => {
            console.warn('[protokoll teilen] Mitglieder nicht geladen:', e);
            return 'verborgen' as const;
          }),
    ]);
    return { anwesenheit, mitglieder: liste };
  }, [lesen, gruppeId, treffen, mitglieder]);

  if (stand.art === 'fertig') return <BlattFenster {...props} daten={stand.daten} />;
  return (
    <Sheet title="Protokoll teilen" onClose={onClose} knoepfe={null}>
      <div className={styles.inhalt}>
        <p className={styles.hinweis} role="status">
          PDF wird vorbereitet …
        </p>
      </div>
    </Sheet>
  );
}

function BlattFenster({
  sitzung,
  gruppe,
  gruppeId,
  kopf,
  dokument,
  aufgaben,
  protokolle,
  naechste,
  zeitzone,
  gemeinde,
  ich,
  onClose,
  daten,
}: ProtokollTeilenProps & { daten: Daten }) {
  const stand = useStand();
  // Die Reihen, die der Bildschirm dahinter schon geladen hat (`ReiheAnbieter`) – ohne sie steht im PDF „ließ sich nicht laden“.
  const themenreihen = useContext(ReiheKontext)?.reihen;
  const blatt = useMemo(
    () =>
      protokollBlatt({
        gruppe,
        gruppeId,
        sitzung: kopf?.sitzung ?? '',
        titel: kopf?.titel ?? sitzung.titel,
        beginn: sitzung.beginn,
        zeitzone,
        kopf,
        dokument,
        aufgaben,
        themenreihen,
        name: nameAusListe(daten.mitglieder, { person: ich.person, name: ich.name }),
        heute: heuteImKalender(),
        protokolle,
        letztes: letztesProtokoll(protokolle, sitzung),
        anwesenheit: daten.anwesenheit,
        naechste,
        gemeinde,
        stand,
        farbe: papierFarbe,
      }),
    [
      sitzung,
      gruppe,
      gruppeId,
      kopf,
      dokument,
      aufgaben,
      themenreihen,
      protokolle,
      naechste,
      zeitzone,
      gemeinde,
      // Nach Werten, nicht nach dem Objekt – der Aufrufer baut es bei jedem Zeichnen neu, das PDF entstünde jedes Mal neu.
      ich.person,
      ich.name,
      daten,
      stand,
    ],
  );
  const { stand: pdf, geladen, setGeladen } = useGebautesPdf(blatt, protokollPdf);
  return (
    <Sheet
      title="Protokoll teilen"
      onClose={onClose}
      einblenden={false}
      knoepfe={
        <PdfKnoepfe
          pdf={pdf}
          dateiname={blatt.dateiname}
          onGeladen={() => setGeladen(true)}
          onClose={onClose}
        />
      }
    >
      <div className={styles.inhalt}>
        <PdfStandUndVorschau pdf={pdf} dateiname={blatt.dateiname} geladen={geladen} />
      </div>
    </Sheet>
  );
}
