import { useMemo, useState } from 'react';
import type { AgendaItem, AgendaServiceOption, SongSelectTreffer } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';
import {
  pendingAgendaFields,
  isDurationValid,
  neuerAgendaPunkt,
  type LinkState,
  type NeuerAgendaPunkt,
  type PunktArt,
} from '../utils/agendaItemChanges';
import { SongPicker } from './SongPicker';
import { NewSongSheet } from './NewSongSheet';
import { useCapabilities } from '../hooks/useServices';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from '@ui/icons/icons';
import { useOverlayKeyboardInset } from '@ui/fenster/useOverlayKeyboardInset';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import styles from './ItemActionSheet.module.scss';

interface Gemeinsam {
  onClose: () => void;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
}

/** Einen vorhandenen Punkt bearbeiten (der Normalfall – `modus` darf fehlen). */
interface Bearbeiten extends Gemeinsam {
  modus?: 'bearbeiten';
  item: AgendaItem;
  /** Schreibt die geänderten Felder gesammelt (EIN Request). Wirft bei Fehler. */
  onUpdate: (fields: AgendaItemUpdate) => Promise<void>;
  /** Läuft der Punkt vor dem Beginn der Veranstaltung (Vorlauf, #423)? */
  vorBeginn: boolean;
  /** Schreibt den Vorlauf nach ChurchTools (gilt für den ganzen Block, siehe Schalter). Wirft bei Fehler. */
  onSetVorBeginn: (vorBeginn: boolean) => Promise<void>;
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
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

type ItemActionSheetProps = Bearbeiten | Neu;

/** Der Ausgangsstand für „Neuer Eintrag": ein leerer Punkt, gegen den nichts verglichen wird. */
const LEERER_PUNKT: AgendaItem = {
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
 * „Eintrag bearbeiten"-Dialog: ein zentriertes Modal mit allen Einstellungen auf einen Blick
 * (Titel, Lied, Dauer, Zuständig, Vor Gottesdienstbeginn, Löschen) – angelehnt an den
 * „Position bearbeiten"-Dialog in ChurchTools. NICHTS wird sofort geschrieben: auch Lied
 * verknüpfen/aufheben und der Vorlauf-Schalter werden nur vorgemerkt. Erst „Speichern" schreibt
 * alle Änderungen gesammelt nach ChurchTools; „Abbrechen" verwirft sie. (Löschen ist bewusst
 * separat und hat eine eigene Rückfrage.)
 */
export function ItemActionSheet(props: ItemActionSheetProps) {
  const { onClose, services } = props;
  const neu = props.modus === 'neu';
  const item = props.modus === 'neu' ? LEERER_PUNKT : props.item;
  const vorBeginnStart = props.modus === 'neu' ? false : props.vorBeginn;
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
  // Verknüpfung wird vorgemerkt und erst beim Speichern nach ChurchTools geschrieben
  // ('keep' = unverändert, 'unlink' = Lied entfernen, 'link' = neues Arrangement verknüpfen).
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'keep' });
  // Der Anlege-Weg aus „Lied verknüpfen" (#391): „Neues Lied" (der Suchbegriff wird zum Titel) oder
  // ein SongSelect-Treffer. Nur mit dem Recht, Lieder zu bearbeiten – beim Bearbeiten wie beim Anlegen.
  const canEditSongs = useCapabilities(true).data?.canEditSongs ?? false;
  const [neuesLied, setNeuesLied] = useState<{ treffer?: SongSelectTreffer; name?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    : Object.keys(pending).length > 0 || vorBeginn !== vorBeginnStart;

  /** Ein Lied wurde gewählt (Suche, „Neues Lied" oder „gibt es schon") – vorgemerkt, nicht geschrieben. */
  function liedGewaehlt(arrangementId: number, name: string) {
    setLinkState({ kind: 'link', arrangementId, name });
    // Neu ohne eigenen Titel: Der Punkt heißt wie das Lied (wie früher im „Lied hinzufügen").
    if (neu && !title.trim()) setTitle(name);
    setErr(null);
    setNeuesLied(null);
    setSongMode(false);
  }

  async function saveAll() {
    setBusy(true);
    setErr(null);
    try {
      if (props.modus === 'neu') {
        if (neuerPunkt) await props.onAdd(neuerPunkt);
        onClose();
        return;
      }
      const { onUpdate, onSetVorBeginn } = props;
      // Alle Feld-Änderungen in EINEM Request (kein Teilzustand bei Fehlern); nur der Vorlauf ist
      // in ChurchTools etwas anderes – eine Grenze am Ablauf, kein Feld des Punkts.
      if (Object.keys(pending).length > 0) await onUpdate(pending);
      if (vorBeginn !== vorBeginnStart) await onSetVorBeginn(vorBeginn);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  // Klick auf den Hintergrund: nur schließen, wenn nichts vorgemerkt ist – sonst würde ein
  // versehentlicher Tipp daneben alle ungespeicherten Änderungen verwerfen. Mit Änderungen
  // führt der Weg raus bewusst über „Abbrechen" (verwerfen) oder „Speichern".
  function onOverlayClick() {
    if (!dirty) onClose();
  }

  // Unterdialog: ein neues Lied anlegen und mit DIESEM Punkt verknüpfen. Bewusst ohne `eventId`: Das
  // Lied darf nicht als neuer Punkt in den Ablauf, es gehört in den vorhandenen. Die Verknüpfung wird
  // wie eine Auswahl aus der Suche nur vorgemerkt – geschrieben wird erst mit „Speichern"
  // (Entscheidung Alwin, 18.09.2026: ein Fenster, ein Speicherweg).
  if (neuesLied) {
    return (
      <NewSongSheet
        startTreffer={neuesLied.treffer}
        startName={neuesLied.name}
        onClose={() => setNeuesLied(null)}
        onVerknuepfen={liedGewaehlt}
        /* Gibt es das Lied schon (gleiche CCLI-Nummer), wird es vorgemerkt wie eine Auswahl aus der
           Suche – geschrieben wird auch hier erst mit „Speichern" (#395). */
        onVorhandenes={(song) => liedGewaehlt(song.arrangementId, song.name)}
      />
    );
  }

  // Unterdialog: Lied suchen + verknüpfen.
  if (songMode) {
    return (
      <div ref={overlayRef} className={styles.overlay} onClick={onOverlayClick}>
        <div className={styles.card} onClick={(e) => e.stopPropagation()}>
          <div className={styles.title}>Lied verknüpfen</div>
          {err && <div className={styles.err}>{err}</div>}
          <SongPicker
            autoFocus
            aktionLabel="Mit diesem Eintrag verknüpfen"
            onPick={liedGewaehlt}
            neuesLied={
              canEditSongs
                ? { label: 'Neues Lied', onClick: (name) => setNeuesLied({ name }) }
                : undefined
            }
            /* Ohne das Recht, Lieder zu bearbeiten, erscheint SongSelect gar nicht –
               ein Treffer, aus dem nichts werden kann, wäre eine Sackgasse (#378). */
            onSongSelectTreffer={canEditSongs ? (treffer) => setNeuesLied({ treffer }) : undefined}
          />
          {/* „Abbrechen", nicht „Zurück" (Entscheidung Alwin, 04.09.2026): Dieser Knopf verlässt die
              Suche ganz. Zur Trefferliste zurück führt der Pfeil oben in der Vorschau – zwei Knöpfe
              mit demselben Wort und verschiedenen Zielen hatten in die Irre geführt. */}
          <button className={styles.backBtn} onClick={() => setSongMode(false)} disabled={busy}>
            Abbrechen
          </button>
        </div>
      </div>
    );
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
              {/* Dasselbe Liedfeld beim Anlegen wie beim Bearbeiten. */}
              <div className={styles.field}>
                <span className={styles.label}>Lied</span>
                {effSong ? (
                  <>
                    {/* Liedname sichtbar halten – er kommt aus ChurchTools und ist hier nicht änderbar. */}
                    <div className={styles.readonly}>{effSong.title}</div>
                    <button className={styles.linkRow} disabled={busy} onClick={clearLink}>
                      <Icon name="link" size={17} className={styles.linkIcon} />
                      Verknüpfung aufheben
                    </button>
                  </>
                ) : (
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
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          {neu ? (
            <button className={styles.saveBtn} onClick={saveAll} disabled={busy || !neuerPunkt}>
              {busy ? 'Füge hinzu…' : 'Hinzufügen'}
            </button>
          ) : (
            <button
              className={styles.saveBtn}
              onClick={saveAll}
              disabled={busy || !durationValid || !dirty}
            >
              {busy ? 'Speichere…' : 'Speichern'}
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
