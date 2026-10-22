import { useMemo, useState, type ReactNode } from 'react';
import { ABLAUFPUNKT_GRENZEN, type AgendaServiceOption } from '@shared/types/index';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { PunktAenderung } from '@shared/ct/schreibKern';
import {
  pendingAgendaFields,
  isDurationValid,
  neuerAgendaPunkt,
  type LinkState,
  type NeuerAgendaPunkt,
  type PunktArt,
} from '@shared/ct/agendaItemChanges';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from '../icons/icons';
import { useOverlayKeyboardInset } from '../fenster/useOverlayKeyboardInset';
import { Schalter } from '../bedienung/Schalter';
import { Segment } from '../bedienung/Segment';
import { VerborgeneGruppenHinweis } from './AblaufTeile';
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
  /** Schreibt den Vorlauf nach ChurchTools (gilt für den ganzen Block, siehe Schalter). Wirft bei Fehler. */
  onSetVorBeginn: (vorBeginn: boolean) => Promise<void>;
  /** Schreibt das Auge („an diesem Termin weglassen“, E6-3b) – der Stand kommt aus `item.weggelassen`. Wirft bei Fehler. */
  onSetWeggelassen: (weggelassen: boolean) => Promise<void>;
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
  /** Sieht der Bearbeitende nicht alle Dienstgruppen (#676)? Dann steht der Hinweis über den Knöpfen. */
  gruppenVerborgen?: boolean;
}

/**
 * Einen neuen Punkt anlegen – **derselbe Dialog** (Alwin, 05.10.2026: „das Hinzufügen ist noch nicht
 * konsistent mit allen anderen Einstellungen nachher"). Vorher gab es dafür ein eigenes Blatt mit
 * Typ-Auswahl und drei Formularen; nach einem Lied ging zusätzlich dieser Dialog auf.
 */
interface Neu extends Gemeinsam {
  modus: 'neu';
  /** Legt den Punkt an (am Ende des Ablaufs). Wirft bei Fehler. */
  onAdd: (punkt: NeuerAgendaPunkt) => Promise<void>;
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
 * Musik-App steckt dort ihre Liedwahl ein). „Eintrag bearbeiten"-Dialog: ein zentriertes Modal mit allen Einstellungen auf einen Blick
 * (Titel, Lied, Dauer, Zuständig, Vor Gottesdienstbeginn, Löschen) – angelehnt an den
 * „Position bearbeiten"-Dialog in ChurchTools. NICHTS wird sofort geschrieben: auch Lied
 * verknüpfen/aufheben und der Vorlauf-Schalter werden nur vorgemerkt. Erst „Speichern" schreibt
 * alle Änderungen gesammelt nach ChurchTools; „Abbrechen" verwirft sie. (Löschen ist bewusst
 * separat und hat eine eigene Rückfrage.)
 */
export function PunktFenster(props: PunktFensterProps) {
  const { onClose, services, liedWahl } = props;
  const neu = props.modus === 'neu';
  const item = props.modus === 'neu' ? LEERER_PUNKT : props.item;
  const vorBeginnStart = props.modus === 'neu' ? false : props.vorBeginn;
  const weggelassenStart = item.weggelassen ?? false;
  const isSong = !!item.song;
  // Neu: Programmpunkt oder Überschrift (Alwin, 05.10.2026: erst das Fenster, nicht die Liedsuche).
  // Ein Lied ist ein Programmpunkt mit verknüpftem Lied – wie beim Bearbeiten über „Lied verknüpfen".
  const [art, setArt] = useState<PunktArt>('programmpunkt');
  const [songMode, setSongMode] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [responsible, setResponsible] = useState(item.responsibleText);
  const [note, setNote] = useState(item.note);
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
  // Dialog über der iOS-Tastatur freihalten; verhindert auch die verrutschte Kopfleiste (#207).
  const overlayRef = useOverlayKeyboardInset();

  // Das Lied, das der Punkt nach dem Speichern hätte (steuert Titel-/Lied-Anzeige).
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
    () => pendingAgendaFields(item, { title, duration, responsible, note, link: linkState }),
    [item, title, duration, responsible, note, linkState],
  );

  const neuerPunkt = useMemo(
    () =>
      neu ? neuerAgendaPunkt(art, { title, duration, responsible, note, link: linkState }) : null,
    [neu, art, title, duration, responsible, note, linkState],
  );

  const dirty = neu
    ? !!(title.trim() || duration.trim() || responsible.trim() || note.trim()) ||
      linkState.kind === 'link'
    : Object.keys(pending).length > 0 ||
      vorBeginn !== vorBeginnStart ||
      weggelassen !== weggelassenStart;

  /** Ein Lied wurde gewählt (Suche, „Neues Lied" oder „gibt es schon") – vorgemerkt, nicht geschrieben. */
  function liedGewaehlt(arrangementId: number, name: string) {
    setLinkState({ kind: 'link', arrangementId, name });
    // Neu ohne eigenen Titel: Der Punkt heißt wie das Lied (wie früher im „Lied hinzufügen").
    if (neu && !title.trim()) setTitle(name);
    setErr(null);
    setSongMode(false);
  }

  async function saveAll(trotzdem = false) {
    setBusy(true);
    setErr(null);
    setKonflikt(null);
    try {
      if (props.modus === 'neu') {
        if (neuerPunkt) await props.onAdd(neuerPunkt);
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
  // führt der Weg raus bewusst über „Abbrechen" (verwerfen) oder „Speichern".
  function onOverlayClick() {
    if (!dirty) onClose();
  }

  // Lied-Modus: Die Liedwahl (Steckplatz der Musik-App) füllt das ganze Fenster.
  if (songMode && liedWahl) {
    return liedWahl({
      onGewaehlt: liedGewaehlt,
      onAbbrechen: () => setSongMode(false),
      onHintergrund: onOverlayClick,
      fehler: err,
      busy,
    });
  }

  return (
    <div ref={overlayRef} className={styles.overlay} onClick={onOverlayClick}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{neu ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</div>
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

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.label}>Titel</span>
            {/* Auch bei Liedern änderbar (#200): ChurchTools führt Titel und Lied getrennt und
                zeigt beides. Der Liedname steht darunter im Feld „Lied". */}
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
          </div>

          {/* Überschriften haben nur einen Titel – keine weiteren Felder. */}
          {!(neu ? art === 'ueberschrift' : item.isHeader) && (
            <>
              {/* Dasselbe Liedfeld beim Anlegen wie beim Bearbeiten. Ohne Liedwahl (Dienstplaner) nur, wenn es
                  ein Lied gibt – ein leeres Feld, das man nicht bedienen kann, wäre nur Lärm. */}
              {(effSong || liedWahl) && (
                <div className={styles.field}>
                  <span className={styles.label}>Lied</span>
                  {effSong ? (
                    <>
                      {/* Liedname sichtbar halten – er kommt aus ChurchTools und ist hier nicht änderbar. */}
                      <div className={styles.readonly}>{effSong.title}</div>
                      {liedWahl && (
                        <button className={styles.linkRow} disabled={busy} onClick={clearLink}>
                          <Icon name="link" size={17} className={styles.linkIcon} />
                          Verknüpfung aufheben
                        </button>
                      )}
                    </>
                  ) : (
                    // Ohne Lied steht das Feld nur mit Liedwahl da (Bedingung oben) – hier also immer wählbar.
                    <button
                      className={styles.linkRow}
                      disabled={busy}
                      onClick={() => setSongMode(true)}
                    >
                      <Icon name="music" size={17} className={styles.linkIcon} />
                      Lied verknüpfen
                    </button>
                  )}
                  {/* Beim Anlegen ist ohnehin alles erst mit „Hinzufügen" geschrieben – der Hinweis gilt
                      dem Bearbeiten, wo der Rest des Punkts schon in ChurchTools steht. */}
                  {!neu && linkState.kind !== 'keep' && (
                    <span className={styles.pendingHint}>
                      {linkState.kind === 'unlink'
                        ? 'Wird beim Speichern entfernt.'
                        : 'Wird beim Speichern verknüpft.'}
                    </span>
                  )}
                </div>
              )}

              <div className={styles.field}>
                <span className={styles.label}>Dauer (Minuten)</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="z. B. 5"
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Zuständig</span>
                <ResponsibleField
                  value={responsible}
                  onChange={setResponsible}
                  services={services}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Bemerkung</span>
                <textarea
                  className={styles.textarea}
                  value={note}
                  maxLength={ABLAUFPUNKT_GRENZEN.bemerkung}
                  rows={2}
                  placeholder="Optionale Notiz…"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Für ALLE Punkte, auch Überschriften (#423): Ein Block „Vorbereitung" kann ebenso vor dem
              Beginn liegen. ChurchTools kennt nur eine Grenze, deshalb nennt der Hinweis den Block.
              Nicht beim Anlegen: Neue Punkte kommen ans Ende – dort hieße „an", ALLES sei Vorlauf. */}
          {!neu && (
            <button
              type="button"
              className={styles.toggleRow}
              onClick={() => setVorBeginn((v) => !v)}
              aria-pressed={vorBeginn}
            >
              <span className={styles.toggleText}>
                <span className={styles.label}>Vor Gottesdienstbeginn</span>
                <span className={styles.toggleHint}>
                  {vorBeginn
                    ? 'Dieser und alle Punkte darüber laufen vor dem Beginn.'
                    : 'Gehört zum Gottesdienst – wie alle Punkte darunter.'}
                </span>
              </span>
              <Schalter an={vorBeginn} />
            </button>
          )}

          {/* Auge wie in ChurchTools (E6-3b, #652): bleibt im Ablauf, nur an diesem Termin ohne Zeit. */}
          {!neu && (
            <button
              type="button"
              className={styles.toggleRow}
              onClick={() => setWeggelassen((w) => !w)}
              aria-pressed={weggelassen}
            >
              <span className={styles.toggleText}>
                <span className={styles.label}>An diesem Termin weglassen</span>
                <span className={styles.toggleHint}>
                  {weggelassen
                    ? 'Bleibt im Ablauf, hat hier aber keine Uhrzeit und zählt nicht mit.'
                    : 'Wird an diesem Termin gezeigt und mitgerechnet.'}
                </span>
              </span>
              <Schalter an={weggelassen} />
            </button>
          )}
        </div>

        {props.modus !== 'neu' && props.gruppenVerborgen && <VerborgeneGruppenHinweis />}

        {konflikt && (
          <div className={styles.err} role="alert">
            {konflikt} Trotzdem speichern oder verwerfen?
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={busy}>
            {konflikt ? 'Verwerfen' : 'Abbrechen'}
          </button>
          {neu ? (
            <button
              className={styles.saveBtn}
              onClick={() => void saveAll()}
              disabled={busy || !neuerPunkt}
            >
              {busy ? 'Füge hinzu…' : 'Hinzufügen'}
            </button>
          ) : (
            <button
              className={styles.saveBtn}
              onClick={() => void saveAll(konflikt !== null)}
              disabled={busy || !durationValid || !dirty}
            >
              {busy ? 'Speichere…' : konflikt ? 'Trotzdem speichern' : 'Speichern'}
            </button>
          )}
        </div>

        {props.modus !== 'neu' && (
          <button
            className={styles.deleteBtn}
            onClick={() => {
              onClose();
              props.onRequestDelete();
            }}
          >
            <Icon name="trash" size={16} />
            Eintrag löschen
          </button>
        )}
      </div>
    </div>
  );
}
