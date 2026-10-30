import { useMemo, useState, type ReactNode } from 'react';
import {
  ABLAUFPUNKT_GRENZEN,
  type AgendaServiceOption,
  type InfoGruppe,
} from '@shared/types/index';
import { itemLabel, zeitPlus, zustaendigText, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { PunktAenderung } from '@shared/ct/schreibKern';
import {
  pendingAgendaFields,
  isDurationValid,
  neuerAgendaPunkt,
  vorlaufAnDerStelle,
  type EinfuegeStelle,
  type LinkState,
  type NeuerAgendaPunkt,
  type PunktArt,
} from '@shared/ct/agendaItemChanges';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from '../icons/icons';
import { Sheet } from '../fenster/Sheet';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Schalter } from '../bedienung/Schalter';
import { Segment } from '../bedienung/Segment';
import { LiedKarte, ResponsibleLine, VerborgeneGruppenHinweis } from './AblaufTeile';
import styles from './PunktFenster.module.scss';

/**
 * Was die Liedwahl bekommt (Steckplatz `liedWahl`). Sie füllt im Lied-Modus das GANZE Fenster – auch ein
 * Unterfenster wie „Neues Lied" ersetzt es, wie bisher.
 */
export interface LiedWahlArgs {
  /** Ein Lied gewählt – vorgemerkt, geschrieben wird erst mit „Speichern". */
  onGewaehlt: (arrangementId: number, name: string) => void;
  /** Zurück ins Punkt-Fenster, ohne etwas vorzumerken. */
  onAbbrechen: () => void;
  /** Tipp auf den Hintergrund – schließt nur, wenn nichts vorgemerkt ist. */
  onHintergrund: () => void;
  /** Fehler des letzten Speicherns (steht auch im Lied-Modus). */
  fehler: string | null;
  busy: boolean;
  /** Das X: das ganze Punkt-Fenster schließen – wie überall verwirft das, was nicht gespeichert ist. */
  onSchliessen: () => void;
  /** Blendet die Liedwahl ein? Nur, wenn das Fenster mit ihr anfängt – sonst ersetzt sie das Punkt-Fenster. */
  einblenden: boolean;
}

interface Gemeinsam {
  onClose: () => void;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /**
   * Lieder verknüpfen und lösen – nur die Musik-App kann das (Liedsuche, „Neues Lied", SongSelect). Ohne
   * Steckplatz zeigt das Fenster das Lied nur an (Dienstplaner, Alwin 17.10.2026: „Lieder nur anzeigen").
   */
  liedWahl?: (args: LiedWahlArgs) => ReactNode;
  /**
   * Das Lied ansehen (Dienstplaner, E6-O O4): Die Zeile „Lied“ bekommt einen Pfeil und zeigt, was hier eingesteckt
   * wird, an der Stelle des Fensters – „Zurück“ (`zurueck`) kehrt mit allen ungespeicherten Eingaben zurück, das X
   * (`schliessen`) schließt ganz. Nur ohne `liedWahl` – wer Lieder wählt, hat dort seinen Weg.
   */
  liedAnsehen?: (zurueck: () => void, schliessen: () => void) => ReactNode;
  /**
   * Die Dienstgruppen, deren Infos man sieht (E6-4, Entwurf `e6-infos-spalten.html` Bild 3): je Gruppe ein Feld unter
   * „Bemerkung“ – beim Anlegen unter „Weitere Einstellungen“. Ohne: keine Felder. Nicht bei Überschriften – ChurchTools
   * führt dort keine Infos (gemessen E6-4-0).
   */
  infoGruppen?: readonly InfoGruppe[];
}

/** Einen vorhandenen Punkt bearbeiten (der Normalfall – `modus` darf fehlen). */
interface Bearbeiten extends Gemeinsam {
  modus?: 'bearbeiten';
  item: AblaufZeile;
  /**
   * Schreibt die geänderten Felder gesammelt (EIN Request). Wirft bei Fehler. `trotzdem` (E6-3c): ohne Vergleich mit
   * dem Stand beim Öffnen – nach der Rückfrage „Trotzdem speichern“.
   */
  onUpdate: (fields: PunktAenderung, trotzdem: boolean) => Promise<void>;
  /** Läuft der Punkt vor dem Beginn der Veranstaltung (Vorlauf, #423)? */
  vorBeginn: boolean;
  /** Schreibt den Vorlauf nach ChurchTools (nur dieser Punkt rückt an „Beginn“, siehe Schalter). Wirft bei Fehler. */
  onSetVorBeginn: (vorBeginn: boolean) => Promise<void>;
  /** Schreibt das Auge („an diesem Termin weglassen“, E6-3b) – der Stand kommt aus `item.weggelassen`. Wirft bei Fehler. */
  onSetWeggelassen: (weggelassen: boolean) => Promise<void>;
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
  /** Sieht der Bearbeitende nicht alle Dienstgruppen (#676)? Dann steht der Hinweis über den Knöpfen. */
  gruppenVerborgen?: boolean;
  /**
   * „Darunter einfügen“ links unten (Alwin, 30.10.2026, Entwurf `einfuegen-entwurf.html` B): einen neuen Punkt direkt
   * hinter diesem anlegen. Ohne: kein Knopf. Solange etwas ungespeichert ist, gesperrt – wie das Blättern.
   */
  onDarunter?: () => void;
  /**
   * „Position 2 von 8“ und ‹ › zum vorigen/nächsten Punkt (E6-O O3). Fehlt `onVorher`/`onNachher`, ist der Pfeil
   * gesperrt (erster/letzter Punkt). Solange etwas ungespeichert ist, sind beide gesperrt (Alwin, 28.10.2026).
   */
  position?: { nr: number; von: number; onVorher?: () => void; onNachher?: () => void };
  /** `false` beim Blättern mit ‹ ›: Das Fenster ersetzt sein voriges und blendet nicht noch einmal ein. */
  einblenden?: boolean;
}

/**
 * Einen neuen Punkt anlegen – **derselbe Dialog** (Alwin, 05.10.2026: „das Hinzufügen ist noch nicht
 * konsistent mit allen anderen Einstellungen nachher"). Vorher gab es dafür ein eigenes Blatt mit
 * Typ-Auswahl und drei Formularen; nach einem Lied ging zusätzlich dieser Dialog auf.
 */
interface Neu extends Gemeinsam {
  modus: 'neu';
  /** Womit das Fenster anfängt – gewählt in „Option wählen“ (Scheibe S2). Ohne: Programmpunkt. */
  startArt?: PunktArt;
  /**
   * „Lied hinzufügen“ (S2): gleich die Liedwahl zeigen. Wer sie ohne Lied verlässt, hat nichts angelegt – dann geht
   * das ganze Fenster zu, nicht das leere Programmpunkt-Formular auf.
   */
  startLied?: boolean;
  /** Legt den Punkt an – an der Stelle aus „Einfügen nach“ (`nachId`), sonst am Ende. Wirft bei Fehler. */
  onAdd: (punkt: NeuerAgendaPunkt) => Promise<void>;
  /**
   * Der Ablauf, wie die Liste ihn zeigt – für die Zeile **„Einfügen nach“** (Alwin, 30.10.2026, Entwurf
   * `einfuegen-entwurf.html` A). Ohne (oder leer): keine Zeile, der Punkt kommt ans Ende.
   */
  ablauf?: readonly AblaufZeile[];
  /** Wo „Einfügen nach“ anfängt (Plus an einer Zeile, „Darunter einfügen“). Ohne: am Ende. */
  startNach?: EinfuegeStelle;
  /**
   * Womit „Vor Gottesdienstbeginn“ anfängt, wenn nicht die Stelle es sagt (`vorlaufAnDerStelle`): „… davor einfügen“
   * übernimmt die Seite des Punkts, VOR den er kommt.
   */
  startVorBeginn?: boolean;
}

export type PunktFensterProps = Bearbeiten | Neu;

/** Der Ausgangsstand für „Neuer Eintrag": ein leerer Punkt, gegen den nichts verglichen wird. */
const LEERER_PUNKT: AblaufZeile = {
  id: 0,
  title: '',
  type: null,
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: null,
  vorBeginn: false,
  durationMin: null,
  note: '',
};

/**
 * **Das Punkt-Fenster** (seit E6-2b-2 in `ui/ablauf`, vorher `client/src/components/ItemActionSheet.tsx`; die
 * Musik-App steckt dort ihre Liedwahl ein). **Seit E6-O O3 (Variante B des Fenster-Entwurfs, Alwin 23.10.2026):** ein
 * Fenster im ChurchTools-Aufbau (`Sheet`) mit einer **Feldliste „Beschriftung | Feld“** in einer umrandeten Fläche –
 * alle Felder auf einmal bearbeitbar, unten EINMAL „Speichern“; oben „Position 2 von 8 · 10:00 – 10:04“ mit ‹ ›.
 * „Lied“ und „Zuständig“ sind Zeilen mit Pfeil: Die Liedwahl (nur Musik-App) und „Zuständig“ öffnen sich IM Fenster.
 *
 * NICHTS wird sofort geschrieben: auch Lied verknüpfen/aufheben und die Schalter werden nur vorgemerkt. Erst
 * „Speichern" schreibt alle Änderungen gesammelt nach ChurchTools; „Abbrechen" verwirft sie. Löschen ist bewusst
 * getrennt (links unten) und hat eine eigene Rückfrage.
 */
export function PunktFenster(props: PunktFensterProps) {
  const { onClose, services, liedWahl, liedAnsehen } = props;
  const neu = props.modus === 'neu';
  const item = props.modus === 'neu' ? LEERER_PUNKT : props.item;
  const ablauf = props.modus === 'neu' ? (props.ablauf ?? []) : [];
  // „Einfügen nach“ (nur beim Anlegen): hinter welchen Punkt der neue kommt – `undefined` = ans Ende.
  const [nach, setNach] = useState<EinfuegeStelle>(
    props.modus === 'neu' ? props.startNach : undefined,
  );
  const [stelleWahl, setStelleWahl] = useState(false);
  // „Weitere Einstellungen“ beim Anlegen: zu, bis man sie aufklappt (Alwin, 30.10.2026).
  const [weitere, setWeitere] = useState(false);
  // Beim Anlegen sagt die Stelle, ob der Punkt vor dem Beginn läuft – der Schalter startet damit.
  const vorBeginnStart =
    props.modus === 'neu'
      ? (props.startVorBeginn ?? vorlaufAnDerStelle(ablauf, props.startNach))
      : props.vorBeginn;
  const vorBeginnDerStelle =
    props.modus === 'neu' && nach === props.startNach
      ? vorBeginnStart
      : vorlaufAnDerStelle(ablauf, nach);
  const weggelassenStart = item.weggelassen ?? false;
  const isSong = !!item.song;
  // Neu: Programmpunkt oder Überschrift (Alwin, 05.10.2026: erst das Fenster, nicht die Liedsuche).
  // Ein Lied ist ein Programmpunkt mit verknüpftem Lied – wie beim Bearbeiten über „Lied verknüpfen".
  const [art, setArt] = useState<PunktArt>(
    props.modus === 'neu' ? (props.startArt ?? 'programmpunkt') : 'programmpunkt',
  );
  const liedZuerst = props.modus === 'neu' && !!props.startLied && !!liedWahl;
  const [songMode, setSongMode] = useState(liedZuerst);
  // Die Lied-Ansicht (Dienstplaner) an der Stelle des Fensters – der Zustand hier bleibt dabei erhalten.
  const [liedAnsicht, setLiedAnsicht] = useState(false);
  // Wer schon in der Liedwahl war, sieht das Fenster danach ohne neues Einblenden (es war ja nie weg); umgekehrt blendet
  // die Liedwahl nur ein, wenn das Fenster mit ihr anfängt („Lied hinzufügen“, S2).
  const [warInLiedwahl, setWarInLiedwahl] = useState(false);
  // „Zuständig“ bearbeiten (O3, Alwin: Zeile mit Pfeil): der Entwurf, solange der Schritt offen ist – erst
  // „Übernehmen“ setzt ihn ins Fenster (und auch das ist erst mit „Speichern“ geschrieben).
  const [zustEntwurf, setZustEntwurf] = useState<string | null>(null);
  const [title, setTitle] = useState(item.title);
  const [responsible, setResponsible] = useState(item.responsibleText);
  const [note, setNote] = useState(item.note);
  // Infos je Dienstgruppe (E6-4) – beim Anlegen unter „Weitere Einstellungen“ (Alwin, 30.10.2026). Überschriften zeigen
  // die Felder nicht (sie stehen im Block der Programmpunkt-Felder).
  const infoFelder = props.infoGruppen ?? [];
  const [infos, setInfos] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      infoFelder.map((g) => [g.id, item.infos?.find((i) => i.gruppeId === g.id)?.text ?? '']),
    ),
  );
  const [duration, setDuration] = useState(
    item.durationMin != null ? String(item.durationMin) : '',
  );
  // Vorlauf: lokal – wird wie alles andere erst beim Speichern übernommen.
  const [vorBeginn, setVorBeginn] = useState(vorBeginnStart);
  const [weggelassen, setWeggelassen] = useState(weggelassenStart);
  // Verknüpfung wird vorgemerkt und erst beim Speichern nach ChurchTools geschrieben
  // ('keep' = unverändert, 'unlink' = Lied entfernen, 'link' = neues Arrangement verknüpfen).
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'keep' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Derselbe Punkt wurde inzwischen woanders geändert (412, E6-3c): fragen statt still überschreiben.
  const [konflikt, setKonflikt] = useState<string | null>(null);

  // Das Lied, das der Punkt nach dem Speichern hätte (steuert Titel-/Lied-Anzeige). Ein neu gewähltes Lied kennt nur
  // seinen Namen – Tonart, Tempo und Autor stehen erst nach dem Speichern im Ablauf.
  const effSong =
    linkState.kind === 'link'
      ? { title: linkState.name }
      : linkState.kind === 'keep'
        ? item.song
        : null;
  const willBeSong = !!effSong;

  /** Merkt das Entfernen der Verknüpfung vor – bzw. verwirft eine nur vorgemerkte Verknüpfung. */
  function clearLink() {
    setLinkState(isSong ? { kind: 'unlink' } : { kind: 'keep' });
  }

  // „Was würde gespeichert?" ist Geschäftslogik und liegt als reine Funktion daneben (#215) –
  // damit läuft sie einmal je Änderung statt bei jedem Render und ist geprüft.
  const durationValid = isDurationValid(duration);
  const pending = useMemo(
    () => pendingAgendaFields(item, { title, duration, responsible, note, link: linkState, infos }),
    [item, title, duration, responsible, note, linkState, infos],
  );

  const neuerPunkt = useMemo(
    () =>
      neu ? neuerAgendaPunkt(art, { title, duration, responsible, note, link: linkState }) : null,
    [neu, art, title, duration, responsible, note, linkState],
  );

  const dirty = neu
    ? !!(title.trim() || duration.trim() || responsible.trim() || note.trim()) ||
      linkState.kind === 'link' ||
      Object.values(infos).some((t) => t.trim() !== '') ||
      weggelassen
    : Object.keys(pending).length > 0 ||
      vorBeginn !== vorBeginnStart ||
      weggelassen !== weggelassenStart;

  /**
   * Was beim Anlegen außer den Feldern mitgeht: Stelle, Vorlauf, Auge und die Infos je Gruppe (Alwin, 30.10.2026).
   * Am Ende ohne Schalter geht nichts davon mit – dann legt ChurchTools an wie bisher.
   */
  function mitStelleUndSchaltern(punkt: NeuerAgendaPunkt): NeuerAgendaPunkt {
    const gefuellt = Object.entries(infos).filter(([, t]) => t.trim() !== '');
    return {
      ...punkt,
      ...(punkt.type !== 'header' && gefuellt.length > 0
        ? { infos: Object.fromEntries(gefuellt) }
        : {}),
      ...(nach !== undefined ? { nachId: nach } : {}),
      ...(nach !== undefined || vorBeginn ? { vorBeginn } : {}),
      ...(weggelassen ? { weggelassen: true } : {}),
    };
  }

  /** „Einfügen nach“ gewählt – der Vorlauf-Schalter folgt der neuen Stelle. */
  function stelleGewaehlt(stelle: EinfuegeStelle): void {
    setNach(stelle);
    setVorBeginn(vorlaufAnDerStelle(ablauf, stelle));
    setStelleWahl(false);
  }

  /** Ein Lied wurde gewählt (Suche, „Neues Lied" oder „gibt es schon") – vorgemerkt, nicht geschrieben. */
  function liedGewaehlt(arrangementId: number, name: string) {
    setLinkState({ kind: 'link', arrangementId, name });
    // Neu ohne eigenen Titel: Der Punkt heißt wie das Lied (wie früher im „Lied hinzufügen").
    if (neu && !title.trim()) setTitle(name);
    setErr(null);
    setWarInLiedwahl(true);
    setSongMode(false);
  }

  async function saveAll(trotzdem = false) {
    setBusy(true);
    setErr(null);
    setKonflikt(null);
    try {
      if (props.modus === 'neu') {
        if (neuerPunkt) await props.onAdd(mitStelleUndSchaltern(neuerPunkt));
        onClose();
        return;
      }
      const { onUpdate, onSetVorBeginn, onSetWeggelassen } = props;
      // Alle Feld-Änderungen in EINEM Request (kein Teilzustand bei Fehlern); nur der Vorlauf ist
      // in ChurchTools etwas anderes – eine Grenze am Ablauf, kein Feld des Punkts.
      if (Object.keys(pending).length > 0) await onUpdate(pending, trotzdem);
      if (vorBeginn !== vorBeginnStart) await onSetVorBeginn(vorBeginn);
      // Das Auge zuletzt: Es gilt nur für diesen Termin und ändert nur Uhrzeiten (E6-3b).
      if (weggelassen !== weggelassenStart) await onSetWeggelassen(weggelassen);
      onClose();
    } catch (e) {
      const meldung = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
      if ((e as { status?: unknown } | null)?.status === 412) setKonflikt(meldung);
      else setErr(meldung);
      setBusy(false);
    }
  }

  // Klick auf den Hintergrund: nur schließen, wenn nichts vorgemerkt ist – sonst würde ein
  // versehentlicher Tipp daneben alle ungespeicherten Änderungen verwerfen. Mit Änderungen
  // führt der Weg raus bewusst über „Abbrechen" (verwerfen), das X oder „Speichern".
  function onOverlayClick() {
    if (!dirty) onClose();
  }

  // Lied-Modus: Die Liedwahl (Steckplatz der Musik-App) füllt das ganze Fenster.
  if (songMode && liedWahl) {
    return liedWahl({
      onGewaehlt: liedGewaehlt,
      // „Lied hinzufügen“ ohne gewähltes Lied: nichts angelegt, also ganz zu (S2).
      onAbbrechen: () => {
        if (liedZuerst && linkState.kind !== 'link') return onClose();
        setWarInLiedwahl(true);
        setSongMode(false);
      },
      // Fängt das Fenster mit der Liedwahl an, blendet sie ein; sonst ersetzt sie das Punkt-Fenster (E6-O O3).
      einblenden: liedZuerst && !warInLiedwahl,
      onHintergrund: onOverlayClick,
      onSchliessen: onClose,
      fehler: err,
      busy,
    });
  }

  if (liedAnsicht && liedAnsehen) return liedAnsehen(() => setLiedAnsicht(false), onClose);

  const ueberschrift = neu ? art === 'ueberschrift' : item.isHeader;
  const titel = neu
    ? 'Neuer Eintrag'
    : item.title.trim() || (item.isHeader ? 'Überschrift' : 'Eintrag');
  const einblenden = !warInLiedwahl && (props.modus === 'neu' || props.einblenden !== false);

  // ── Schritt „Einfügen nach“ (Entwurf `einfuegen-entwurf.html` A): alle Punkte zur Wahl, ein Tipp übernimmt ──
  if (stelleWahl)
    return (
      <Sheet
        title={titel}
        onClose={onClose}
        onHintergrund={onOverlayClick}
        einblenden={einblenden}
        mittel
        cancelLabel={null}
        knoepfe={
          <FensterKnopf art="zweit" onClick={() => setStelleWahl(false)}>
            Zurück
          </FensterKnopf>
        }
      >
        <section className={styles.schritt} aria-label="Einfügen nach">
          <h3>Einfügen nach</h3>
          <div className={styles.stellen} role="radiogroup" aria-label="Einfügen nach">
            {[
              { stelle: null, text: 'Am Anfang', zeit: null, band: false },
              ...ablauf.map((z) => ({
                stelle: z.id,
                text: itemLabel(z),
                // Überschriften ohne Uhrzeit – wie in der Liste.
                zeit: z.isHeader ? null : z.time,
                band: z.isHeader,
              })),
              { stelle: undefined, text: 'Am Ende', zeit: null, band: false },
            ].map((o) => (
              <button
                key={String(o.stelle)}
                type="button"
                role="radio"
                aria-checked={nach === o.stelle}
                className={`${styles.stelle}${o.band ? ` ${styles.stelleBand}` : ''}`}
                onClick={() => stelleGewaehlt(o.stelle)}
              >
                <span className={styles.stelleZeit}>{o.zeit ?? ''}</span>
                <span
                  className={
                    o.stelle === null || o.stelle === undefined ? styles.stelleRand : undefined
                  }
                >
                  {o.text}
                </span>
              </button>
            ))}
          </div>
        </section>
      </Sheet>
    );

  // ── Schritt „Zuständig“: ersetzt den Inhalt; unten „Zurück · Übernehmen“, ganz zu über das X ──
  if (zustEntwurf !== null)
    return (
      <Sheet
        title={titel}
        onClose={onClose}
        onHintergrund={onOverlayClick}
        einblenden={einblenden}
        mittel
        cancelLabel={null}
        knoepfe={
          <>
            <FensterKnopf art="zweit" onClick={() => setZustEntwurf(null)}>
              Zurück
            </FensterKnopf>
            <FensterKnopf
              onClick={() => {
                setResponsible(zustEntwurf);
                setZustEntwurf(null);
              }}
            >
              Übernehmen
            </FensterKnopf>
          </>
        }
      >
        <section className={styles.schritt} aria-label="Zuständig">
          <h3>Zuständig</h3>
          <ResponsibleField
            value={zustEntwurf}
            onChange={setZustEntwurf}
            services={services}
            autoFocus
          />
        </section>
      </Sheet>
    );

  const pos = props.modus === 'neu' ? undefined : props.position;
  const zeitVon = neu ? null : item.time;
  const zeitBis = zeitVon && item.durationMin ? zeitPlus(zeitVon, item.durationMin) : null;
  const zeitText = neu
    ? null
    : item.weggelassen
      ? 'an diesem Termin weggelassen'
      : zeitVon
        ? zeitBis
          ? `${zeitVon} – ${zeitBis}`
          : zeitVon
        : null;
  const stelleZeile = typeof nach === 'number' ? ablauf.find((z) => z.id === nach) : undefined;
  const stelleText = nach === null ? 'Am Anfang' : stelleZeile ? itemLabel(stelleZeile) : 'Am Ende';

  const infosBlock = infoFelder.length > 0 && (
    <>
      <div className={styles.abschnitt}>Infos je Gruppe</div>
      {infoFelder.map((g) => (
        <label key={g.id} className={styles.zeile}>
          <span className={styles.lab}>{g.name}</span>
          <span className={styles.wert}>
            <textarea
              className={styles.textarea}
              value={infos[g.id] ?? ''}
              maxLength={ABLAUFPUNKT_GRENZEN.gruppenInfo}
              rows={1}
              aria-label={`Info für ${g.name}`}
              onChange={(e) => {
                const text = e.target.value;
                setInfos((alt) => ({ ...alt, [g.id]: text }));
              }}
            />
          </span>
        </label>
      ))}
    </>
  );

  // Für ALLE Punkte, auch Überschriften (#423): Ein Block „Vorbereitung" kann ebenso vor dem Beginn liegen. Seit
  // 30.10.2026 (Alwin) wechselt nur DIESER Punkt die Seite und rückt direkt über bzw. unter „Beginn“
  // (`vorlaufUmschalten`) – der Hinweis sagt, was beim Speichern passiert. Beim Anlegen startet der Schalter mit der
  // Seite der gewählten Stelle; weicht er davon ab, rückt der Punkt an „Beginn“.
  const vorlaufBleibt = vorBeginn === (neu ? vorBeginnDerStelle : vorBeginnStart);
  const vorlaufSchalter = (
    <button
      type="button"
      className={`${styles.zeile} ${styles.schalterZeile}`}
      onClick={() => setVorBeginn((v) => !v)}
      aria-pressed={vorBeginn}
    >
      <span className={styles.lab}>
        Vor Gottesdienstbeginn
        <small>
          {vorlaufBleibt
            ? vorBeginn
              ? 'Läuft vor dem Beginn.'
              : 'Gehört zum Gottesdienst.'
            : vorBeginn
              ? `${neu ? 'Kommt' : 'Rückt beim Speichern'} direkt über „Beginn“ – nur dieser Punkt.`
              : `${neu ? 'Kommt' : 'Rückt beim Speichern'} direkt unter „Beginn“ – nur dieser Punkt.`}
        </small>
      </span>
      <Schalter an={vorBeginn} />
    </button>
  );

  // Auge wie in ChurchTools (E6-3b, #652): bleibt im Ablauf, nur an diesem Termin ohne Zeit.
  const augeSchalter = (
    <button
      type="button"
      className={`${styles.zeile} ${styles.schalterZeile}`}
      onClick={() => setWeggelassen((w) => !w)}
      aria-pressed={weggelassen}
    >
      <span className={styles.lab}>
        An diesem Termin weglassen
        <small>
          {weggelassen
            ? 'Bleibt im Ablauf, hat hier aber keine Uhrzeit und zählt nicht mit.'
            : 'Wird an diesem Termin gezeigt und mitgerechnet.'}
        </small>
      </span>
      <Schalter an={weggelassen} />
    </button>
  );

  const zustAnzeige = zustaendigText(responsible);
  // Die Personen kommen aus ChurchTools zum gespeicherten Stand – nach einer Änderung erst wieder nach dem Speichern.
  const zustUnveraendert = responsible === item.responsibleText;

  return (
    <Sheet
      title={titel}
      onClose={onClose}
      onHintergrund={onOverlayClick}
      einblenden={einblenden}
      mittel
      beschaeftigt={busy}
      cancelLabel={konflikt ? 'Verwerfen' : 'Abbrechen'}
      links={
        props.modus !== 'neu' && (
          <>
            {/* Vor „Eintrag löschen“: Dessen `margin-right: auto` schiebt dann beide nach links (B, Alwin 30.10.2026). */}
            {props.onDarunter && (
              <FensterKnopf
                art="link"
                disabled={busy || dirty}
                title={dirty ? 'Erst speichern oder abbrechen.' : undefined}
                onClick={props.onDarunter}
              >
                <Icon name="plus" size={15} stroke={2.4} /> Darunter einfügen
              </FensterKnopf>
            )}
            <FensterKnopf
              art="loeschen"
              disabled={busy}
              onClick={() => {
                onClose();
                props.onRequestDelete();
              }}
            >
              Eintrag löschen
            </FensterKnopf>
          </>
        )
      }
      knoepfe={
        <>
          {neu ? (
            <FensterKnopf onClick={() => void saveAll()} disabled={busy || !neuerPunkt}>
              {busy ? 'Füge hinzu…' : 'Hinzufügen'}
            </FensterKnopf>
          ) : (
            <FensterKnopf
              onClick={() => void saveAll(konflikt !== null)}
              disabled={busy || !durationValid || !dirty}
            >
              {busy ? 'Speichere…' : konflikt ? 'Trotzdem speichern' : 'Speichern'}
            </FensterKnopf>
          )}
        </>
      }
    >
      {pos && (
        <div className={styles.position}>
          <span className={styles.positionText}>
            Position {pos.nr} von {pos.von}
            {zeitText && ` · ${zeitText}`}
          </span>
          <span className={styles.blaettern}>
            <button
              type="button"
              aria-label="Voriger Eintrag"
              disabled={dirty || busy || !pos.onVorher}
              onClick={pos.onVorher}
            >
              <Icon name="chev-left" size={18} />
            </button>
            <button
              type="button"
              aria-label="Nächster Eintrag"
              disabled={dirty || busy || !pos.onNachher}
              onClick={pos.onNachher}
            >
              <Icon name="chev-right" size={18} />
            </button>
          </span>
        </div>
      )}
      {pos && dirty && (pos.onVorher || pos.onNachher) && (
        <p className={styles.blaetternHinweis}>Zum Blättern erst speichern oder abbrechen.</p>
      )}

      {err && <div className={styles.err}>{err}</div>}
      {neu && (
        <Segment
          ariaLabel="Art des Eintrags"
          className={styles.art}
          value={art}
          onChange={setArt}
          options={[
            { value: 'programmpunkt', label: 'Programmpunkt' },
            { value: 'ueberschrift', label: 'Überschrift' },
          ]}
        />
      )}

      <div className={styles.liste}>
        <label className={styles.zeile}>
          <span className={styles.lab}>Titel</span>
          <span className={styles.wert}>
            {/* Auch bei Liedern änderbar (#200): ChurchTools führt Titel und Lied getrennt und
                zeigt beides. Der Liedname steht darunter in der Zeile „Lied". */}
            <input
              className={styles.input}
              value={title}
              maxLength={ABLAUFPUNKT_GRENZEN.titel}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                neu && art === 'ueberschrift'
                  ? 'Titel der Überschrift'
                  : willBeSong
                    ? 'z. B. Lied'
                    : 'Titel'
              }
            />
          </span>
        </label>

        {/* Überschriften haben nur einen Titel – keine weiteren Felder. */}
        {!ueberschrift && (
          <>
            <label className={styles.zeile}>
              <span className={styles.lab}>Dauer</span>
              <span className={`${styles.wert} ${styles.dauer}`}>
                <input
                  className={`${styles.input} ${styles.kurz}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label="Dauer in Minuten"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="z. B. 5"
                />
                <span className={styles.einheit}>Min</span>
              </span>
            </label>

            {/* Dasselbe Liedfeld beim Anlegen wie beim Bearbeiten. Ohne Liedwahl (Dienstplaner) nur, wenn es
                ein Lied gibt – eine leere Zeile, die man nicht bedienen kann, wäre nur Lärm. */}
            {(effSong || liedWahl) && (
              <div className={styles.zeile}>
                <span className={styles.lab}>Lied</span>
                <span className={styles.wert}>
                  {liedWahl ? (
                    <button
                      type="button"
                      className={styles.zeilenKnopf}
                      disabled={busy}
                      aria-label={
                        effSong ? `Lied: ${effSong.title} – anderes wählen` : 'Lied verknüpfen'
                      }
                      onClick={() => {
                        setWarInLiedwahl(true);
                        setSongMode(true);
                      }}
                    >
                      {effSong ? (
                        <LiedKarte song={effSong} flach />
                      ) : (
                        <span className={styles.dazu}>
                          <Icon name="plus" size={15} /> Hinzufügen
                        </span>
                      )}
                      <Icon name="chev-right" size={18} className={styles.pfeil} />
                    </button>
                  ) : effSong && liedAnsehen ? (
                    // Dienstplaner (E6-O O4): das Lied ansehen – an der Stelle dieses Fensters, „Zurück“ führt her.
                    <button
                      type="button"
                      className={styles.zeilenKnopf}
                      disabled={busy}
                      aria-label={`Lied: ${effSong.title} – ansehen`}
                      onClick={() => {
                        setWarInLiedwahl(true);
                        setLiedAnsicht(true);
                      }}
                    >
                      <LiedKarte song={effSong} flach />
                      <Icon name="chev-right" size={18} className={styles.pfeil} />
                    </button>
                  ) : (
                    effSong && <LiedKarte song={effSong} flach />
                  )}
                  {liedWahl && effSong && (
                    <button
                      type="button"
                      className={styles.textKnopf}
                      disabled={busy}
                      onClick={clearLink}
                    >
                      Verknüpfung aufheben
                    </button>
                  )}
                  {/* Beim Anlegen ist ohnehin alles erst mit „Hinzufügen" geschrieben – der Hinweis gilt
                      dem Bearbeiten, wo der Rest des Punkts schon in ChurchTools steht. */}
                  {!neu && linkState.kind !== 'keep' && (
                    <small className={styles.vorgemerkt}>
                      {linkState.kind === 'unlink'
                        ? 'Wird beim Speichern entfernt.'
                        : 'Wird beim Speichern verknüpft.'}
                    </small>
                  )}
                </span>
              </div>
            )}

            <div className={styles.zeile}>
              <span className={styles.lab}>Zuständig</span>
              <span className={styles.wert}>
                <button
                  type="button"
                  className={styles.zeilenKnopf}
                  disabled={busy}
                  aria-label={
                    zustAnzeige ? `Zuständig: ${zustAnzeige} – ändern` : 'Zuständig hinzufügen'
                  }
                  onClick={() => setZustEntwurf(responsible)}
                >
                  <span className={styles.zustText}>
                    {zustAnzeige ? (
                      <>
                        <span>{zustAnzeige}</span>
                        {zustUnveraendert ? (
                          <ResponsibleLine entries={item.responsible} />
                        ) : (
                          !neu && (
                            <small className={styles.vorgemerkt}>
                              Wird beim Speichern übernommen.
                            </small>
                          )
                        )}
                      </>
                    ) : (
                      <span className={styles.dazu}>
                        <Icon name="plus" size={15} /> Hinzufügen
                      </span>
                    )}
                  </span>
                  <Icon name="chev-right" size={18} className={styles.pfeil} />
                </button>
              </span>
            </div>

            <label className={styles.zeile}>
              <span className={styles.lab}>Bemerkung</span>
              <span className={styles.wert}>
                <textarea
                  className={styles.textarea}
                  value={note}
                  maxLength={ABLAUFPUNKT_GRENZEN.bemerkung}
                  rows={2}
                  placeholder="Optionale Notiz…"
                  onChange={(e) => setNote(e.target.value)}
                />
              </span>
            </label>

            {/* Beim Anlegen unter „Weitere Einstellungen“ (unten). */}
            {!neu && infosBlock}
          </>
        )}

        {neu ? (
          <>
            {ablauf.length > 0 && (
              <div className={styles.zeile}>
                <span className={styles.lab}>Einfügen nach</span>
                <span className={styles.wert}>
                  <button
                    type="button"
                    className={styles.zeilenKnopf}
                    disabled={busy}
                    aria-label={`Einfügen nach: ${stelleText} – ändern`}
                    onClick={() => setStelleWahl(true)}
                  >
                    <span className={styles.zustText}>
                      <span>{stelleText}</span>
                    </span>
                    <Icon name="chev-right" size={18} className={styles.pfeil} />
                  </button>
                </span>
              </div>
            )}
            <button
              type="button"
              className={styles.weitere}
              aria-expanded={weitere}
              onClick={() => setWeitere((w) => !w)}
            >
              Weitere Einstellungen
              <Icon name={weitere ? 'chev-up' : 'chev-down'} size={18} />
            </button>
            {weitere && (
              <>
                {!ueberschrift && infosBlock}
                {vorlaufSchalter}
                {augeSchalter}
              </>
            )}
          </>
        ) : (
          <>
            {vorlaufSchalter}
            {augeSchalter}
          </>
        )}
      </div>

      {props.modus !== 'neu' && props.gruppenVerborgen && <VerborgeneGruppenHinweis />}

      {konflikt && (
        <div className={styles.err} role="alert">
          {konflikt} Trotzdem speichern oder verwerfen?
        </div>
      )}
    </Sheet>
  );
}
