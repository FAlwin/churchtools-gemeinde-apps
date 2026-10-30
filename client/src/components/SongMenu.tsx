/**
 * Lied-Menü der Chart-Ansicht (#198 – vorher inline in `pages/ChordChart.tsx`, ~190 Zeilen JSX).
 *
 * **Ein Fenster in der Mitte** wie alle ChurchTools-Fenster (Alwin am iPhone, 29.10.2026: „nicht so schön, dass es an
 * verschiedenen Positionen runterklappt … besser sortiert, vielleicht mit Untermenüs“). Vorher klappte es unter dem
 * gewählten Lied der Leiste auf und wanderte mit ihm. Entschieden: Variante 1 (Fenster) mit der Aufteilung aus
 * Variante 2 – Häufiges direkt in der Übersicht, Seltenes auf einer Unterseite mit „‹“ zurück:
 *
 * - **Tonart:** Transponieren · „Kapo · Abschnitte ›“
 * - **Anzeige:** Akkorde & Text · „Nur Text · PDF ›“ (die hochgeladenen Dokumente)
 * - **Version:** die gewählte Fassung › (Arrangements, Versionen, neue Version, löschen)
 * - **Bearbeiten:** „Im Editor öffnen“ direkt · „Dateien · Stammdaten ›“ – nur mit Bearbeitungsrecht. Zuerst stand
 *   der Editor unter „Lied › Teilen, Bearbeiten …“; Alwin fand ihn dort nicht (29.10.2026, am iPhone).
 * - **Teilen:** „Als PDF teilen“
 *
 * Eine Unterseite, auf der nur EIN Punkt stünde, entfällt – der Punkt steht dann direkt in der Übersicht.
 *
 * Das Menü **schließt sich selbst** nach jeder Auswahl. Vorher stand `setShowSongMenu(false)` elf Mal
 * in den Klick-Handlern; ein vergessener Aufruf hätte das Menü offen über der Änderung stehen lassen.
 * Die Rückrufe hier sind reine Aktionen und müssen sich um das Schließen nicht kümmern. Der Weg in eine
 * Unterseite und zurück ist keine Auswahl und schließt nicht.
 */
import { useState, type ReactNode } from 'react';
import type { SetlistSong, ChordProSection, SongArrangementOption } from '@shared/types/index';
import type { SongSettings } from '../utils/chartSettings';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { hasStoredNotesForLevel as hasOwnNotes } from '../utils/annotationKeys';
import { fmtPlayDate } from '../utils/songFilter';
import styles from './SongMenu.module.scss';

/** Eine wählbare Fassung des Lieds (Original oder benannte Version). */
interface VersionChoice {
  key: string;
  name: string;
}

interface SongMenuProps {
  song: SetlistSong;
  set: SongSettings;
  /** Klingende Tonart, wie sie im Menü neben „Transponieren" steht. */
  curKey: string;
  /** Abschnitte des angezeigten Textes – ohne sie gibt es nichts zu transponieren/teilen. */
  sections: ChordProSection[];
  /** Alle Arrangements des Lieds (#320). Bei nur einem erscheint nichts. */
  arrangements: SongArrangementOption[];
  /** Arrangement, das im ABLAUF steht – die Wahl darauf bedeutet „keine eigene Wahl". */
  ablaufArrangementId: number;
  versions: VersionChoice[];
  currentVersion: VersionChoice;
  isOriginal: boolean;
  hasVersions: boolean;
  canEditSong: boolean;
  /**
   * Wann das Lied zuletzt gesungen wurde (ISO, Lied-Statistik aus ChurchTools) – graue Zeile ganz oben (Alwin,
   * 30.10.2026). `null` = noch nie; `undefined` = unbekannt (kein Recht, lädt, Fehler) → keine Zeile.
   */
  zuletztGesungen?: string | null;
  onClose: () => void;
  onOpenKeyPicker: () => void;
  onOpenCapoPicker: () => void;
  onOpenSectionTranspose: () => void;
  onSharePdf: () => void;
  onEditCurrent: () => void;
  /** Dateien des Arrangements verwalten (#321) – nur für Berechtigte. */
  onOpenFiles: () => void;
  /** Stammdaten des Liedes ändern (#322, Schritt 11) – nur für Berechtigte. */
  onEditSong: () => void;
  onNewVersion: () => void;
  onDeleteVersion: () => void;
  onChange: (patch: Partial<SongSettings>) => void;
  onSelectVersion: (versionKey: string) => void;
}

type Seite = 'start' | 'tonart' | 'anzeige' | 'version' | 'pflege';

/** Eine Zeile im Fenster: links der Name, rechts Wert, Haken, Symbol oder „›“ zur Unterseite. */
function Zeile({
  children,
  rechts,
  an = false,
  weiter = false,
  onClick,
}: {
  children: ReactNode;
  rechts?: ReactNode;
  /** Gewählt: blau mit Haken. */
  an?: boolean;
  /** Führt in eine Unterseite („›“). */
  weiter?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.zeile}${an ? ` ${styles.an}` : ''}`}
      onClick={onClick}
    >
      <span className={styles.name}>{children}</span>
      {rechts}
      {an && <Icon name="check" size={16} className={styles.haken} />}
      {weiter && <Icon name="chev-right" size={16} className={styles.weiter} />}
    </button>
  );
}

/** Ein Wert rechts in der Zeile – blau, wenn er vom Normalen abweicht (Kapo, verschobene Abschnitte). */
function Wert({ children, aktiv = false }: { children: ReactNode; aktiv?: boolean }) {
  return <span className={aktiv ? styles.wertAktiv : styles.wert}>{children}</span>;
}

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className={styles.gruppe} aria-label={titel}>
      <div className={styles.gruppenTitel}>{titel}</div>
      {children}
    </section>
  );
}

export function SongMenu({
  song,
  set,
  curKey,
  sections,
  arrangements,
  ablaufArrangementId,
  versions,
  currentVersion,
  isOriginal,
  hasVersions,
  canEditSong,
  zuletztGesungen,
  onClose,
  onOpenKeyPicker,
  onOpenCapoPicker,
  onOpenSectionTranspose,
  onSharePdf,
  onEditCurrent,
  onOpenFiles,
  onEditSong,
  onNewVersion,
  onDeleteVersion,
  onChange,
  onSelectVersion,
}: SongMenuProps) {
  const [seite, setSeite] = useState<Seite>('start');
  /**
   * Jede Auswahl schließt das Menü – siehe Kopfkommentar.
   *
   * ⚠️ **Erst schließen, DANN handeln.** Die umgekehrte Reihenfolge war lange harmlos, weil jedes
   * Overlay seine eigene Boolean-Flagge hatte. Seit alle Overlays EIN Zustandsfeld teilen (#283)
   * würde ein `onClose()` nach der Aktion deren `setOverlay(...)` sofort wieder auf `null` setzen –
   * „Transponieren" schloss dann das Menü, ohne die Tonart-Auswahl zu öffnen. Aufgefallen ist das
   * erst beim Durchklicken im Browser: Build, Lint und alle 672 Tests waren grün.
   */
  const pick = (action: () => void) => () => {
    onClose();
    action();
  };
  const showsChords = set.viewSource === 'chords';

  // ── Was es gibt (dieselben Bedingungen wie vor dem Umbau) ──
  const mitAbschnitten = showsChords;
  /** Auch beim Dokument (07.10.2026): Geteilt wird, was das Lied zeigt. */
  const mitTeilen = !showsChords || sections.length > 0;
  const mitBearbeiten = canEditSong && showsChords;
  const mitArrangements = arrangements.length > 1;
  const mitVersionen = showsChords && (hasVersions || canEditSong);
  const dokumente = song.documents;
  const abschnitteAktiv = Object.keys(set.secShift).length;

  // ── Zeilen, die in Übersicht UND Unterseite stehen können ──
  const kapo = (
    <Zeile
      onClick={pick(onOpenCapoPicker)}
      rechts={set.capo > 0 ? <Wert aktiv>Bund {set.capo}</Wert> : <Wert>–</Wert>}
    >
      Kapo
    </Zeile>
  );
  const nurText = (
    <Zeile
      an={showsChords && set.lyricsOnly}
      onClick={pick(() => onChange({ viewSource: 'chords', lyricsOnly: true }))}
    >
      Nur Text
      {hasOwnNotes(song.id, set.versionKey, true, song.arrangementId) && (
        <Icon name="pencil" size={12} className={styles.notiz} />
      )}
    </Zeile>
  );
  /* Dateien des Arrangements (#321) – auch bei einem Dokument (`showsChords` fehlt hier bewusst): Wer ein PDF ansieht,
     will genau dort ein neues hochladen können. */
  const dateien = (
    <Zeile
      onClick={pick(onOpenFiles)}
      rechts={<Icon name="anhang" size={16} className={styles.symbol} />}
    >
      Dateien …
    </Zeile>
  );
  /* Stammdaten (#322, Schritt 11) – neben den Dateien, weil beides das LIED pflegt und nicht die Anzeige. Wer hier
     merkt, dass der Autor fehlt, soll ihn hier ergänzen können. */
  const stammdaten = (
    <Zeile
      onClick={pick(onEditSong)}
      rechts={<Icon name="info" size={16} className={styles.symbol} />}
    >
      Stammdaten …
    </Zeile>
  );
  const teilen = (
    <Zeile
      onClick={pick(onSharePdf)}
      rechts={<Icon name="share" size={16} className={styles.symbol} />}
    >
      Als PDF teilen
    </Zeile>
  );

  if (seite === 'tonart') {
    return (
      <Fenster titel="Kapo & Abschnitte" zurueck={() => setSeite('start')} onClose={onClose}>
        {kapo}
        <Zeile
          onClick={pick(onOpenSectionTranspose)}
          rechts={abschnitteAktiv > 0 ? <Wert aktiv>{abschnitteAktiv} aktiv</Wert> : <Wert>–</Wert>}
        >
          Abschnitte transponieren
        </Zeile>
      </Fenster>
    );
  }

  if (seite === 'anzeige') {
    return (
      <Fenster titel="Anzeige" zurueck={() => setSeite('start')} onClose={onClose}>
        {nurText}
        {dokumente.map((d) => (
          <Zeile
            key={d.fileId}
            an={set.viewSource === d.fileId}
            onClick={pick(() => onChange({ viewSource: d.fileId }))}
          >
            <Icon
              name={d.type === 'pdf' ? 'dokument' : 'bild'}
              size={14}
              className={styles.dokSymbol}
            />{' '}
            {d.name}
          </Zeile>
        ))}
      </Fenster>
    );
  }

  if (seite === 'version') {
    return (
      <Fenster
        titel={
          mitArrangements && mitVersionen
            ? 'Arrangement & Version'
            : mitArrangements
              ? 'Arrangement'
              : 'Version'
        }
        zurueck={() => setSeite('start')}
        onClose={onClose}
      >
        {/* Arrangement (#320) – NUR bei mehr als einem. Steht VOR der Version, weil es die größere
            Klammer ist: Die Versionen sind ChordPro-Dateien innerhalb eines Arrangements.
            Der Wechsel gilt **nur für mich**; in ChurchTools wird nichts geändert. Deshalb steht
            hier auch kein Hinweis auf ein Speichern – es gibt keines. */}
        {mitArrangements && (
          <Gruppe titel="Arrangement">
            {arrangements.map((a) => (
              <Zeile
                key={a.arrangementId}
                an={a.arrangementId === song.arrangementId}
                onClick={pick(() =>
                  // Das Arrangement aus dem Ablauf wird als „keine Wahl" gespeichert, nicht als
                  // seine Nummer: Ändert das Team den Ablauf später, folgt die App wieder – statt an
                  // einer Nummer festzuhalten, die einmal die richtige war.
                  onChange({
                    arrangementId: a.arrangementId === ablaufArrangementId ? null : a.arrangementId,
                  }),
                )}
              >
                {a.arrangementName}
              </Zeile>
            ))}
          </Gruppe>
        )}
        {mitVersionen && (
          <Gruppe titel="Version">
            {versions.map((v) => (
              <Zeile
                key={v.key}
                an={set.versionKey === v.key}
                onClick={pick(() => onSelectVersion(v.key))}
              >
                {v.name}
                {(hasOwnNotes(song.id, v.key, false, song.arrangementId) ||
                  hasOwnNotes(song.id, v.key, true, song.arrangementId)) && (
                  <Icon name="pencil" size={12} className={styles.notiz} />
                )}
              </Zeile>
            ))}
            {canEditSong && (
              <Zeile
                onClick={pick(onNewVersion)}
                rechts={<Icon name="plus" size={16} className={styles.symbol} />}
              >
                Neue Version…
              </Zeile>
            )}
            {canEditSong && !isOriginal && (
              <Zeile
                onClick={pick(onDeleteVersion)}
                rechts={<Icon name="trash" size={16} className={styles.gefahr} />}
              >
                <span className={styles.gefahr}>„{currentVersion.name}" löschen</span>
              </Zeile>
            )}
          </Gruppe>
        )}
      </Fenster>
    );
  }

  if (seite === 'pflege') {
    return (
      <Fenster titel="Dateien & Stammdaten" zurueck={() => setSeite('start')} onClose={onClose}>
        {dateien}
        {stammdaten}
      </Fenster>
    );
  }

  // ── Übersicht ──
  const anzeigeDok = dokumente.find((d) => d.fileId === set.viewSource);
  const versionName = mitArrangements
    ? [
        arrangements.find((a) => a.arrangementId === song.arrangementId)?.arrangementName,
        mitVersionen ? currentVersion.name : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : currentVersion.name;
  const tonartUnten = [
    set.capo > 0 ? `Bund ${set.capo}` : null,
    abschnitteAktiv > 0 ? `${abschnitteAktiv} Abschn.` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Fenster titel={song.title} onClose={onClose}>
      {zuletztGesungen !== undefined && (
        <div className={styles.zuletzt}>
          <span>Zuletzt gesungen</span>
          <span>{zuletztGesungen ? fmtPlayDate(zuletztGesungen) : 'noch nie'}</span>
        </div>
      )}
      <Gruppe titel="Tonart">
        <Zeile onClick={pick(onOpenKeyPicker)} rechts={<Wert aktiv>{curKey}</Wert>}>
          Transponieren
        </Zeile>
        {mitAbschnitten ? (
          <Zeile
            weiter
            onClick={() => setSeite('tonart')}
            rechts={tonartUnten ? <Wert aktiv>{tonartUnten}</Wert> : undefined}
          >
            Kapo · Abschnitte
          </Zeile>
        ) : (
          kapo
        )}
      </Gruppe>

      <Gruppe titel="Anzeige">
        <Zeile
          an={showsChords && !set.lyricsOnly}
          onClick={pick(() => onChange({ viewSource: 'chords', lyricsOnly: false }))}
        >
          Akkorde &amp; Text
          {hasOwnNotes(song.id, set.versionKey, false, song.arrangementId) && (
            <Icon name="pencil" size={12} className={styles.notiz} />
          )}
        </Zeile>
        {dokumente.length > 0 ? (
          <Zeile
            weiter
            onClick={() => setSeite('anzeige')}
            rechts={
              anzeigeDok ? (
                <Wert aktiv>{anzeigeDok.name}</Wert>
              ) : showsChords && set.lyricsOnly ? (
                <Wert aktiv>Nur Text</Wert>
              ) : undefined
            }
          >
            {dokumente.every((d) => d.type === 'pdf') ? 'Nur Text · PDF' : 'Nur Text · Dateien'}
          </Zeile>
        ) : (
          nurText
        )}
      </Gruppe>

      {(mitArrangements || mitVersionen) && (
        <Gruppe titel="Version">
          <Zeile weiter onClick={() => setSeite('version')}>
            {versionName}
          </Zeile>
        </Gruppe>
      )}

      {canEditSong && (
        <Gruppe titel="Bearbeiten">
          {mitBearbeiten ? (
            <>
              <Zeile
                onClick={pick(onEditCurrent)}
                rechts={<Wert>{isOriginal ? 'als neue Version' : currentVersion.name}</Wert>}
              >
                Im Editor öffnen
              </Zeile>
              <Zeile weiter onClick={() => setSeite('pflege')}>
                Dateien · Stammdaten
              </Zeile>
            </>
          ) : (
            // Beim Dokument gibt es keinen Editor – dann stehen die beiden direkt da statt auf einer Unterseite.
            <>
              {dateien}
              {stammdaten}
            </>
          )}
        </Gruppe>
      )}

      {mitTeilen && <Gruppe titel="Teilen">{teilen}</Gruppe>}
    </Fenster>
  );
}

/** Das Fenster um jede Seite – in der Mitte, Kopf mit Titel (und „‹“ auf Unterseiten), unten „Schließen“. */
function Fenster({
  titel,
  zurueck,
  onClose,
  children,
}: {
  titel: string;
  zurueck?: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet title={titel} onClose={onClose} knoepfe={null} cancelLabel="Schließen" zurueck={zurueck}>
      <div className={styles.liste}>{children}</div>
    </Sheet>
  );
}
