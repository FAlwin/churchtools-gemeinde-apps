import { useState, type ReactNode } from 'react';
import type { Eintrag } from '@shared/protokolle/termine';
import { hatOrt } from '@shared/protokolle/terminFelder';
import {
  artWechseln,
  frequenzEinheit,
  istAutomatisch,
  optionsAuswahl,
  WIEDERHOLUNG,
  WIEDERHOLUNGS_ARTEN,
} from '@shared/protokolle/terminWiederholung';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import { DatumMarken } from './DatumMarken';
import type { KalenderEintrag } from './kalenderListe';
import type { TagEintrag } from './terminVorlagenLesen';
import styles from './TerminFormular.module.scss';

const STUNDEN = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTEN = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/** Eine Zeile „Beschriftung links, Feld rechts“ – wie im ChurchTools-Dialog. Mit `fuer` wird die Beschriftung zum Label. */
function Reihe({
  label,
  children,
  gruppe,
}: {
  label: string;
  children: ReactNode;
  /** Mehrere Felder in einer Zeile: die Zeile ist eine benannte Gruppe, jedes Feld trägt einen eigenen Namen. */
  gruppe?: boolean;
}) {
  return gruppe ? (
    <div className={styles.reihe} role="group" aria-label={label}>
      <span className={styles.beschriftung} aria-hidden="true">
        {label}
      </span>
      <div className={styles.feld}>{children}</div>
    </div>
  ) : (
    <label className={styles.reihe}>
      <span className={styles.beschriftung}>{label}</span>
      <div className={styles.feld}>{children}</div>
    </label>
  );
}

/** Stunde und Minute (5er-Schritte; eine andere Minute aus einer Vorlage bleibt wählbar) als zwei Auswahlen. */
function Uhrzeit({
  name,
  wert,
  onAendern,
  deaktiviert,
}: {
  name: string;
  wert: string;
  onAendern: (v: string) => void;
  deaktiviert: boolean;
}) {
  const [h, m] = /^\d{2}:\d{2}$/.test(wert) ? wert.split(':') : ['', ''];
  const minuten = m && !MINUTEN.includes(m) ? [...MINUTEN, m].sort() : MINUTEN;
  return (
    <>
      <select
        className={`${styles.eingabe} ${styles.klein}`}
        aria-label={`${name} Stunde`}
        value={h}
        disabled={deaktiviert}
        onChange={(ev) => onAendern(`${ev.target.value}:${m || '00'}`)}
      >
        {!h && <option value="" />}
        {STUNDEN.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <select
        className={`${styles.eingabe} ${styles.klein}`}
        aria-label={`${name} Minute`}
        value={m}
        disabled={deaktiviert}
        onChange={(ev) => onAendern(`${h || '00'}:${ev.target.value}`)}
      >
        {!m && <option value="" />}
        {minuten.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </>
  );
}

interface Props {
  e: Eintrag;
  kalenderId: number | null;
  kalender: readonly KalenderEintrag[];
  kalenderLaedt: boolean;
  tags: readonly TagEintrag[];
  /** Darf neue Tags anlegen. */
  tagsVerwalten: boolean;
  deaktiviert: boolean;
  /** Den ganzen Eintrag ersetzen – das Beginn-Datum und der Kalender gehen über `onTag` und `onKalender`. */
  onAendern: (neu: Eintrag) => void;
  onKalender: (id: number) => void;
  onTag: (tag: string) => void;
}

/**
 * **Der Reiter „Kalender“ des ChurchTools-Dialogs „Termin erstellen“** (W15-1), Feld für Feld in der Reihenfolge und mit dem
 * Wortlaut von ChurchTools: Kalender · Titel · Untertitel · intern · Ganztägig · Beginn · Ende · Wiederholungen (mit
 * Wochentag-Auswahl, Bis, Alle x, Weitere Termine, Ausnahmen) · Beschreibung · Link · Ort · Tags. „Im Auftrag von“ fehlt
 * (keine Personensuche zum Wiederverwenden), „Bild“ kommt später. Die Regeln stehen in `@shared/protokolle`.
 */
export function TerminFormular(p: Props) {
  const { e, deaktiviert: aus } = p;
  const set = <K extends keyof Eintrag>(k: K, v: Eintrag[K]) => p.onAendern({ ...e, [k]: v });
  const [ortAuf, setOrtAuf] = useState(false);
  const [tagsAuf, setTagsAuf] = useState(false);
  const ortZeigen = ortAuf || hatOrt(e);
  const automatisch = istAutomatisch(e.art);
  const wiederholt = e.art !== WIEDERHOLUNG.keine;
  const tagName = (t: number | string) =>
    typeof t === 'string' ? t : (p.tags.find((x) => x.id === t)?.name ?? `Tag ${t}`);
  const freieTags = p.tags.filter((t) => !e.tags.includes(t.id));
  const [neuerTag, setNeuerTag] = useState('');

  return (
    <div className={styles.formular}>
      <label className={styles.reihe}>
        <span className={styles.beschriftung}>Kalender</span>
        <div className={styles.feld}>
          <select
            className={styles.eingabe}
            value={p.kalenderId ?? ''}
            disabled={aus || !p.kalender.length}
            onChange={(ev) => p.onKalender(Number(ev.target.value))}
          >
            {p.kalenderLaedt && <option value="">wird geladen …</option>}
            {p.kalender.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
      </label>
      <Reihe label="Titel *">
        <input
          className={styles.eingabe}
          value={e.titel}
          disabled={aus}
          onChange={(ev) => set('titel', ev.target.value)}
        />
      </Reihe>
      <Reihe label="Untertitel">
        <input
          className={styles.eingabe}
          value={e.untertitel}
          disabled={aus}
          onChange={(ev) => set('untertitel', ev.target.value)}
        />
      </Reihe>
      <div className={styles.reihe}>
        <span className={styles.beschriftung} aria-hidden="true" />
        <div className={styles.haken}>
          <label>
            <input
              type="checkbox"
              checked={e.intern}
              disabled={aus}
              onChange={(ev) => set('intern', ev.target.checked)}
            />
            <span>Nur für eingeloggte Personen sichtbar</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={e.ganztaegig}
              disabled={aus}
              onChange={(ev) => set('ganztaegig', ev.target.checked)}
            />
            <span>Ganztägig</span>
          </label>
        </div>
      </div>
      <Reihe label="Beginn" gruppe>
        <input
          type="date"
          className={styles.eingabe}
          aria-label="Beginn Datum"
          value={e.tag}
          disabled={aus}
          onChange={(ev) => p.onTag(ev.target.value)}
        />
        {!e.ganztaegig && (
          <Uhrzeit name="Beginn" wert={e.von} deaktiviert={aus} onAendern={(v) => set('von', v)} />
        )}
      </Reihe>
      <Reihe label="Ende" gruppe>
        <input
          type="date"
          className={styles.eingabe}
          aria-label="Ende Datum"
          value={e.endTag}
          min={e.tag}
          disabled={aus}
          onChange={(ev) => set('endTag', ev.target.value)}
        />
        {!e.ganztaegig && (
          <Uhrzeit name="Ende" wert={e.bis} deaktiviert={aus} onAendern={(v) => set('bis', v)} />
        )}
      </Reihe>
      <Reihe label="Wiederholungen">
        <select
          className={styles.eingabe}
          value={e.art}
          disabled={aus}
          onChange={(ev) => p.onAendern(artWechseln(e, Number(ev.target.value)))}
        >
          {WIEDERHOLUNGS_ARTEN.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {e.art === WIEDERHOLUNG.monatlichWochentag && (
          <select
            className={styles.eingabe}
            aria-label="Welcher Wochentag im Monat"
            value={e.option}
            disabled={aus}
            onChange={(ev) => set('option', Number(ev.target.value))}
          >
            {optionsAuswahl(e.tag).map((o) => (
              <option key={o.wert} value={o.wert}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Reihe>
      {automatisch && (
        <Reihe label="Bis" gruppe>
          <input
            type="date"
            className={styles.eingabe}
            aria-label="Wiederholen bis"
            value={e.wiederBis}
            min={e.tag}
            disabled={aus}
            onChange={(ev) => set('wiederBis', ev.target.value)}
          />
          <span className={styles.alle}>
            Alle
            <input
              type="number"
              min={1}
              className={`${styles.eingabe} ${styles.zahl}`}
              aria-label="Alle x"
              value={e.frequenz}
              disabled={aus}
              onChange={(ev) =>
                set('frequenz', Math.max(1, Math.floor(Number(ev.target.value)) || 1))
              }
            />
            {frequenzEinheit(e.art)}
          </span>
        </Reihe>
      )}
      {wiederholt && (
        <>
          <Reihe label="Weitere Termine" gruppe>
            <DatumMarken
              titel="Weitere Termine"
              tage={e.weitere}
              deaktiviert={aus}
              onAendern={(t) => set('weitere', t)}
            />
          </Reihe>
          <Reihe label="Ausnahmen" gruppe>
            <DatumMarken
              titel="Ausnahmen"
              tage={e.ausnahmen}
              deaktiviert={aus}
              onAendern={(t) => set('ausnahmen', t)}
            />
          </Reihe>
        </>
      )}
      <Reihe label="Beschreibung">
        <textarea
          className={`${styles.eingabe} ${styles.mehrzeilig}`}
          rows={3}
          value={e.beschreibung}
          disabled={aus}
          onChange={(ev) => set('beschreibung', ev.target.value)}
        />
      </Reihe>
      <Reihe label="Link">
        <input
          type="url"
          className={styles.eingabe}
          inputMode="url"
          value={e.link}
          disabled={aus}
          onChange={(ev) => set('link', ev.target.value)}
        />
      </Reihe>
      <Reihe label="Ort" gruppe>
        {ortZeigen ? (
          <div className={styles.ortFelder}>
            <input
              className={styles.eingabe}
              aria-label="Ort Name"
              placeholder="Name, z. B. Gemeindehaus"
              value={e.ort}
              disabled={aus}
              onChange={(ev) => set('ort', ev.target.value)}
            />
            <input
              className={styles.eingabe}
              aria-label="Ort Straße"
              placeholder="Straße"
              value={e.ortStrasse}
              disabled={aus}
              onChange={(ev) => set('ortStrasse', ev.target.value)}
            />
            <div className={styles.zeile}>
              <input
                className={`${styles.eingabe} ${styles.plz}`}
                aria-label="Ort PLZ"
                placeholder="PLZ"
                value={e.ortPlz}
                disabled={aus}
                onChange={(ev) => set('ortPlz', ev.target.value)}
              />
              <input
                className={styles.eingabe}
                aria-label="Ort Ort"
                placeholder="Ort"
                value={e.ortStadt}
                disabled={aus}
                onChange={(ev) => set('ortStadt', ev.target.value)}
              />
            </div>
            <input
              className={styles.eingabe}
              aria-label="Ort Zusatz"
              placeholder="Zusatz"
              value={e.ortZusatz}
              disabled={aus}
              onChange={(ev) => set('ortZusatz', ev.target.value)}
            />
          </div>
        ) : (
          <TextKnopf disabled={aus} onClick={() => setOrtAuf(true)}>
            + Hinzufügen
          </TextKnopf>
        )}
      </Reihe>
      <Reihe label="Tags" gruppe>
        <div className={styles.marken}>
          {e.tags.map((t) => (
            <span key={String(t)} className={styles.marke}>
              {tagName(t)}
              <ZeilenKnopf
                label={`Tag ${tagName(t)} entfernen`}
                disabled={aus}
                onClick={() =>
                  set(
                    'tags',
                    e.tags.filter((x) => x !== t),
                  )
                }
              >
                <Icon name="x" size={14} stroke={2.4} />
              </ZeilenKnopf>
            </span>
          ))}
          {tagsAuf || e.tags.length ? (
            <>
              {freieTags.length > 0 && (
                <select
                  className={`${styles.eingabe} ${styles.tagWahl}`}
                  aria-label="Tag hinzufügen"
                  value=""
                  disabled={aus}
                  onChange={(ev) => {
                    if (ev.target.value) set('tags', [...e.tags, Number(ev.target.value)]);
                  }}
                >
                  <option value="">Tag wählen …</option>
                  {freieTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {p.tagsVerwalten && (
                <input
                  className={`${styles.eingabe} ${styles.tagWahl}`}
                  aria-label="Neuer Tag"
                  placeholder="Neuer Tag – mit Enter"
                  value={neuerTag}
                  disabled={aus}
                  onChange={(ev) => setNeuerTag(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key !== 'Enter') return;
                    ev.preventDefault();
                    const t = neuerTag.trim();
                    if (t && !e.tags.includes(t)) set('tags', [...e.tags, t]);
                    setNeuerTag('');
                  }}
                />
              )}
            </>
          ) : (
            <TextKnopf disabled={aus} onClick={() => setTagsAuf(true)}>
              + Hinzufügen
            </TextKnopf>
          )}
        </div>
      </Reihe>
    </div>
  );
}
