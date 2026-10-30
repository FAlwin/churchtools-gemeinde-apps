import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVollbild } from '@ui/bedienung/useVollbild';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { BEREICH_ATTRIBUT } from '@ui/erweiterung/cssBereich';
import { gruppenFarbe, sichtFarbe } from '@shared/organigramm/farbe';
import { alleAuf, anfangsOffen, sichtbarerBaum } from '@shared/organigramm/ansichten';
import { istLeitung, type Mitglied } from '@shared/organigramm/mitglieder';
import type { PersonenWahl } from '@shared/organigramm/personen';
import type { PBereich, PSpalte, Praesentation as Daten } from '@shared/organigramm/praesentation';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import { Diagramm } from './Diagramm';
import { personenInhalt } from './kastenPersonen';
import {
  ANSICHT_NAMEN,
  lesePraesAnsicht,
  merkePraesAnsicht,
  PERSONEN_WAHL,
  PRAES_ANSICHTEN,
  type PraesAnsicht,
} from './auswahl';
import styles from './Praesentation.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/** „12 Personen“ – bei null nur dann „gesucht“, wenn man alles sehen darf; sonst ehrlich „nicht sichtbar“. */
const personenText = (n: number, vollstaendig: boolean) =>
  n
    ? anzahl(n, 'Person', 'Personen')
    : vollstaendig
      ? 'Mitarbeitende gesucht'
      : 'Mitglieder nicht sichtbar';

export type Stand = 'neu' | 'heute';

interface Props {
  start: Start;
  daten: Daten;
  mitglieder: MitgliederDaten;
  /** „Neue Gliederung | Heute“ (O7-4) – nur für Gruppen-Admins mit einem Plan; sonst fehlt der Umschalter. */
  stand?: { wert: Stand; onWechsel: (s: Stand) => void };
  /** Personen in den Diagrammen (O7b-6b) – dieselbe gemerkte Wahl wie im Reiter. */
  personen: { wahl: PersonenWahl; onWahl: (w: PersonenWahl) => void };
  onSchliessen: () => void;
}

/**
 * **Die Präsentation** (Bauplan O4, Entwurf 19.10.2026) – z. B. für die Mitgliederversammlung. Liegt über der
 * Leiste von ChurchTools (Portal an `body`, wie `Toast`); „Vollbild“ nimmt zusätzlich das Vollbild des Browsers,
 * wo es das gibt (Laptop am Beamer) – am iPad gibt es den Knopf nicht.
 *
 * Bedienung: Weiter/Zurück, Pfeiltasten, Bild auf/ab, Leertaste · Pos1 = Übersicht · Esc = zurück zur Übersicht,
 * dort schließen · F = Vollbild. Für Gruppen-Admins mit einem Plan oben „Neue Gliederung | Heute“ (O7-4, wie im Entwurf
 * vom 19.10.2026); der Wechsel führt zurück zur Übersicht.
 *
 * **Ansichten** (O7b-5, Alwin 28.10.2026: „Seiten bleiben“): Kacheln · Von oben · Von links · Mindmap. Die Seiten bleiben
 * dieselben – Übersicht, dann Bereich für Bereich –, der Umschalter ändert nur, wie eine Seite aussieht: als Kacheln
 * bzw. Personen in Spalten (O4) oder als Diagramm (die ganze Gemeinde, dann der Bereich). Im Diagramm der Übersicht
 * öffnet ein Klick auf einen Bereich seine Seite; auf der Seite eines Bereichs ist sein Baum anfangs ganz offen.
 *
 * **Personen** (O7b-6b): In den Diagrammen oben „Personen: Aus · Rollen · Alle“ wie im Reiter – dieselbe Wahl, im Gerät
 * gemerkt. Neue Gruppen der „Neuen Gliederung“ haben noch niemanden und zeigen nur den Namen.
 */
export function Praesentation({ start, daten, mitglieder, stand, personen, onSchliessen }: Props) {
  const [seite, setSeite] = useState(-1); // -1 = Übersicht
  const [ansicht, setAnsicht] = useState<PraesAnsicht>(lesePraesAnsicht);
  const baum = useMemo(() => daten.bereiche.map((b) => b.knoten), [daten]);
  const [offen, setOffen] = useState<ReadonlySet<string>>(() => anfangsOffen(baum));
  const wurzel = useRef<HTMLDivElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  // Vollbild des Browsers – der gemeinsame Baustein (seit E6b-1 auch für die Ablauf-Anzeige des Dienstplaners).
  const {
    kann: kannVollbild,
    an: vollbild,
    umschalten: vollbildUmschalten,
    beenden: vollbildBeenden,
  } = useVollbild(wurzel);
  const zahl = daten.bereiche.length;
  const bereich = seite >= 0 ? daten.bereiche[seite] : undefined;

  const gehe = useCallback(
    (ziel: number) => {
      const z = Math.max(-1, Math.min(zahl - 1, ziel));
      setSeite(z);
      // Auf der Seite eines Bereichs ist sein ganzer Baum offen – zuklappen geht am +/−.
      if (z >= 0) setOffen((o) => alleAuf(baum, String(baum[z].gruppe.id), o));
    },
    [zahl, baum],
  );
  const schliessen = useCallback(() => {
    vollbildBeenden();
    onSchliessen();
  }, [vollbildBeenden, onSchliessen]);

  useEffect(() => {
    wurzel.current?.focus();
  }, []);

  useEffect(() => {
    buehne.current?.scrollTo?.({ top: 0 });
  }, [seite]);

  useEffect(() => {
    const taste = (ev: KeyboardEvent) => {
      // Schon erledigt (Enter/Leertaste auf einem Kästchen oder +/− im Diagramm) – nicht zusätzlich blättern.
      if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const k = ev.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') gehe(seite + 1);
      else if (k === 'ArrowLeft' || k === 'PageUp') gehe(seite - 1);
      else if (k === 'Home') gehe(-1);
      else if (k === 'f' || k === 'F') vollbildUmschalten();
      else if (k === 'Escape') {
        // Im Vollbild beendet der Browser selbst das Vollbild – nicht zusätzlich die Seite wechseln.
        if (document.fullscreenElement) return;
        if (seite >= 0) gehe(-1);
        else schliessen();
      } else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [seite, gehe, vollbildUmschalten, schliessen]);

  const farbe = (k: PBereich | PSpalte) => gruppenFarbe(k.knoten.gruppe, start.typFarben);
  const person = (id: number) => mitglieder.personen.get(id);
  const wer = (m: Mitglied) => {
    const p = person(m.personId);
    return p ? (
      <span key={p.id} className={styles.wer}>
        <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} groesse={28} />
        {p.name}
      </span>
    ) : null;
  };
  const leitung = (b: PBereich) =>
    !b.sichtbar ? null : b.leitung.length ? (
      b.leitung.map(wer)
    ) : (
      <span className={styles.gesucht}>Leitung wird noch gesucht</span>
    );
  const liste = (personen: readonly Mitglied[]) => (
    <ul className={styles.liste}>
      {personen.map((m) => {
        const p = person(m.personId);
        if (!p) return null;
        const rolle = istLeitung(start.rollen, m.rolleId)
          ? start.rollen.get(m.rolleId!)
          : undefined;
        return (
          <li key={p.id}>
            <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} groesse={28} />
            <span>{p.name}</span>
            {rolle && <span className={styles.rolle}>{rolle.name}</span>}
          </li>
        );
      })}
    </ul>
  );

  const uebersichtTitel = (
    <div className={styles.titel}>
      <div>
        <h1>Unsere Bereiche</h1>
        <div className={styles.meta}>
          {stand && (stand.wert === 'neu' ? 'Neue Gliederung · ' : 'Heute · ')}
          {anzahl(zahl, 'Bereich', 'Bereiche')} · {anzahl(daten.gruppen, 'Gruppe', 'Gruppen')} ·{' '}
          {anzahl(daten.personen, 'Person', 'Personen')}
        </div>
      </div>
    </div>
  );

  const uebersicht = (
    <>
      {uebersichtTitel}
      <div className={styles.kacheln}>
        {daten.bereiche.map((b, i) => (
          <button
            key={b.knoten.gruppe.id}
            type="button"
            className={styles.kachel}
            onClick={() => gehe(i)}
          >
            <span className={styles.kachelKopf}>
              <GruppenKachel name={b.knoten.gruppe.name} farbe={farbe(b)} groesse={44} />
              <span>
                <h2>{b.knoten.gruppe.name}</h2>
                <span className={styles.meta}>
                  {b.knoten.kinder.length
                    ? anzahl(b.knoten.kinder.length, 'Gruppe', 'Gruppen') + ' · '
                    : ''}
                  {personenText(b.personen, b.vollstaendig)}
                </span>
              </span>
            </span>
            {b.sichtbar && (
              <span className={styles.abschnitt}>
                <span className={styles.label}>Leitung</span>
                {leitung(b)}
              </span>
            )}
            {b.knoten.kinder.length > 0 && (
              <span className={styles.abschnitt}>
                <span className={styles.label}>Gruppen</span>
                <span className={styles.gruppen}>
                  {b.knoten.kinder.map((c) => (
                    <span key={c.gruppe.id}>
                      <GruppenKachel
                        name={c.gruppe.name}
                        farbe={gruppenFarbe(c.gruppe, start.typFarben)}
                        groesse={20}
                      />
                      {c.gruppe.name}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );

  const bereichTitel = (b: PBereich) => (
    <div className={styles.titel}>
      <GruppenKachel name={b.knoten.gruppe.name} farbe={farbe(b)} groesse={56} />
      <div>
        <h1>{b.knoten.gruppe.name}</h1>
        <div className={styles.meta}>
          {b.knoten.kinder.length
            ? anzahl(b.knoten.kinder.length, 'Gruppe', 'Gruppen') + ' · '
            : ''}
          {personenText(b.personen, b.vollstaendig)}
        </div>
      </div>
      {b.knoten.kinder.length > 0 && b.sichtbar && (
        <div className={styles.leitungRechts}>
          <span className={styles.label}>Leitung</span>
          {leitung(b)}
        </div>
      )}
    </div>
  );

  const bereichSeite = (b: PBereich) => (
    <>
      {bereichTitel(b)}
      <div className={styles.spalten}>
        {b.spalten.map((s) => (
          <section
            key={s.knoten.gruppe.id}
            className={styles.spalte}
            aria-label={s.knoten.gruppe.name}
          >
            <div className={styles.spaltenKopf}>
              <GruppenKachel name={s.knoten.gruppe.name} farbe={farbe(s)} groesse={24} />
              <b>{s.knoten.gruppe.name}</b>
              {s.personen.length > 0 && <span className={styles.zahl}>{s.personen.length}</span>}
            </div>
            {s.personen.length ? (
              liste(s.personen)
            ) : (
              <div className={styles.gesucht}>
                {s.vollstaendig ? 'noch keine Mitglieder' : 'Mitglieder nicht sichtbar'}
              </div>
            )}
            {s.unter.length > 0 && (
              <details className={styles.auf}>
                <summary>{anzahl(s.unter.length, 'Untergruppe', 'Untergruppen')}</summary>
                {s.unter.map((u) => (
                  <div key={u.knoten.gruppe.id} className={styles.untergruppe}>
                    <div className={styles.untergruppeName}>
                      <GruppenKachel
                        name={u.knoten.gruppe.name}
                        farbe={gruppenFarbe(u.knoten.gruppe, start.typFarben)}
                        groesse={16}
                      />
                      <span>{[...u.pfad, u.knoten.gruppe.name].join(' › ')}</span>
                      {u.sichtbar && <span className={styles.zahl}>{u.personen.length}</span>}
                    </div>
                    {u.sichtbar ? (
                      liste(u.personen)
                    ) : (
                      <div className={styles.gesucht}>Mitglieder nicht sichtbar</div>
                    )}
                  </div>
                ))}
              </details>
            )}
          </section>
        ))}
      </div>
    </>
  );

  // Dieselbe Seite als Diagramm: die ganze Gemeinde oder der Bereich als Spitze.
  const sicht = useMemo(
    () =>
      sichtbarerBaum(
        baum,
        start.gemeinde ?? 'Gemeinde',
        bereich ? String(bereich.knoten.gruppe.id) : null,
        offen,
      ),
    [baum, start.gemeinde, bereich, offen],
  );
  const umklappen = (schluessel: string) =>
    setOffen((o) => {
      const neu = new Set(o);
      if (!neu.delete(schluessel)) neu.add(schluessel);
      return neu;
    });
  const bereichNr = (id: number) => baum.findIndex((k) => k.gruppe.id === id);
  const kachelFarbe = useMemo(() => sichtFarbe(start.typFarben), [start.typFarben]);
  const inhalt = useMemo(
    () => personenInhalt(mitglieder, start.rollen, personen.wahl),
    [mitglieder, start.rollen, personen.wahl],
  );
  const diagrammSeite = (art: Exclude<PraesAnsicht, 'kacheln'>) => (
    <div className={styles.diagrammSeite}>
      {bereich ? bereichTitel(bereich) : uebersichtTitel}
      <div className={styles.diagramm}>
        <Diagramm
          art={art}
          sicht={sicht}
          onUmklappen={umklappen}
          onGruppe={(id) => gehe(bereichNr(id))}
          klickbar={(id) => !bereich && bereichNr(id) >= 0}
          fuellen
          farbe={kachelFarbe}
          personen={{ wahl: personen.wahl, inhalt }}
        />
      </div>
    </div>
  );

  return createPortal(
    <div
      ref={wurzel}
      className={styles.praes}
      role="dialog"
      aria-modal="true"
      aria-label="Präsentation"
      tabIndex={-1}
      {...{ [BEREICH_ATTRIBUT]: '' }}
    >
      <div className={styles.kopf}>
        <span className={styles.gemeinde}>{start.gemeinde}</span>
        {stand && (
          <Segment
            value={stand.wert}
            options={[
              { value: 'neu', label: 'Neue Gliederung' },
              { value: 'heute', label: 'Heute' },
            ]}
            onChange={(w) => {
              setSeite(-1);
              stand.onWechsel(w);
            }}
            ariaLabel="Stand"
            verbunden
          />
        )}
        <Segment
          value={ansicht}
          options={PRAES_ANSICHTEN.map((a) => ({
            value: a,
            label: a === 'kacheln' ? 'Kacheln' : ANSICHT_NAMEN[a],
          }))}
          onChange={(a) => {
            setAnsicht(a);
            merkePraesAnsicht(a);
          }}
          ariaLabel="Ansicht"
          verbunden
        />
        {ansicht !== 'kacheln' && (
          <span className={styles.personen}>
            Personen
            <Segment
              value={personen.wahl}
              options={PERSONEN_WAHL}
              onChange={personen.onWahl}
              ariaLabel="Personen"
              verbunden
            />
          </span>
        )}
        {kannVollbild && (
          <button type="button" className={styles.knopf} onClick={vollbildUmschalten}>
            <Icon name={vollbild ? 'vollbild-aus' : 'vollbild'} size={16} />
            {vollbild ? 'Vollbild beenden' : 'Vollbild'}
          </button>
        )}
        <button type="button" className={styles.knopf} onClick={schliessen}>
          Schließen
        </button>
      </div>
      <div ref={buehne} className={styles.buehne}>
        {ansicht !== 'kacheln'
          ? diagrammSeite(ansicht)
          : bereich
            ? bereichSeite(bereich)
            : uebersicht}
      </div>
      <div className={styles.unten}>
        <button
          type="button"
          className={styles.knopf}
          disabled={seite < 0}
          onClick={() => gehe(seite - 1)}
        >
          ‹ Zurück
        </button>
        <div className={styles.wo} aria-live="polite">
          {bereich ? `${seite + 1} von ${zahl} · ${bereich.knoten.gruppe.name}` : 'Übersicht'}
        </div>
        <button
          type="button"
          className={`${styles.knopf} ${seite < 0 ? styles.primaer : ''}`}
          disabled={seite >= zahl - 1}
          onClick={() => gehe(seite + 1)}
        >
          Weiter ›
        </button>
      </div>
    </div>,
    document.body,
  );
}
