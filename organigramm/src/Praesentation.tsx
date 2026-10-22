import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Icon } from '@ui/icons/icons';
import { BEREICH_ATTRIBUT } from '@ui/erweiterung/cssBereich';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import { istLeitung, type Mitglied } from '@shared/organigramm/mitglieder';
import type { PBereich, PSpalte, Praesentation as Daten } from '@shared/organigramm/praesentation';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import styles from './Praesentation.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/** „12 Personen“ – bei null nur dann „gesucht“, wenn man alles sehen darf; sonst ehrlich „nicht sichtbar“. */
const personenText = (n: number, vollstaendig: boolean) =>
  n
    ? anzahl(n, 'Person', 'Personen')
    : vollstaendig
      ? 'Mitarbeitende gesucht'
      : 'Mitglieder nicht sichtbar';

interface Props {
  start: Start;
  daten: Daten;
  mitglieder: MitgliederDaten;
  onSchliessen: () => void;
}

/**
 * **Die Präsentation** (Bauplan O4, Entwurf 19.10.2026) – z. B. für die Mitgliederversammlung. Liegt über der
 * Leiste von ChurchTools (Portal an `body`, wie `Toast`); „Vollbild“ nimmt zusätzlich das Vollbild des Browsers,
 * wo es das gibt (Laptop am Beamer) – am iPad gibt es den Knopf nicht.
 *
 * Bedienung: Weiter/Zurück, Pfeiltasten, Bild auf/ab, Leertaste · Pos1 = Übersicht · Esc = zurück zur Übersicht,
 * dort schließen · F = Vollbild. Nur „Heute“ – „Neue Gliederung“ kommt mit dem Plan in O7.
 */
export function Praesentation({ start, daten, mitglieder, onSchliessen }: Props) {
  const [seite, setSeite] = useState(-1); // -1 = Übersicht
  const wurzel = useRef<HTMLDivElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const kannVollbild = document.fullscreenEnabled === true;
  const [vollbild, setVollbild] = useState(false);
  const zahl = daten.bereiche.length;
  const bereich = seite >= 0 ? daten.bereiche[seite] : undefined;

  const gehe = useCallback(
    (ziel: number) => setSeite(Math.max(-1, Math.min(zahl - 1, ziel))),
    [zahl],
  );
  const vollbildUmschalten = useCallback(() => {
    if (!kannVollbild) return;
    const aus = document.fullscreenElement
      ? document.exitFullscreen()
      : wurzel.current?.requestFullscreen();
    // Ein abgelehntes Vollbild (z. B. ohne Klick ausgelöst) ändert nichts – die Präsentation läuft weiter.
    aus?.catch(() => undefined);
  }, [kannVollbild]);
  const schliessen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    onSchliessen();
  }, [onSchliessen]);

  useEffect(() => {
    wurzel.current?.focus();
    const folgen = () => setVollbild(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', folgen);
    return () => document.removeEventListener('fullscreenchange', folgen);
  }, []);

  useEffect(() => {
    buehne.current?.scrollTo?.({ top: 0 });
  }, [seite]);

  useEffect(() => {
    const taste = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
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

  const uebersicht = (
    <>
      <div className={styles.titel}>
        <div>
          <h1>Unsere Bereiche</h1>
          <div className={styles.meta}>
            {anzahl(zahl, 'Bereich', 'Bereiche')} · {anzahl(daten.gruppen, 'Gruppe', 'Gruppen')} ·{' '}
            {anzahl(daten.personen, 'Person', 'Personen')}
          </div>
        </div>
      </div>
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

  const bereichSeite = (b: PBereich) => (
    <>
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
        {bereich ? bereichSeite(bereich) : uebersicht}
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
