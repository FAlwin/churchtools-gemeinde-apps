import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Icon } from '@ui/icons/icons';
import { tagKurz, tagPunkt } from '@shared/ct/datum';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { standFuer, statusText, type AufgabenStatus } from '@shared/protokolle/aufgaben';
import { punktBeschriftung } from '@shared/protokolle/dokument';
import {
  begriffe,
  fundstellen,
  suchen,
  suchIndex,
  type SuchArt,
  type SuchEintrag,
} from '@shared/protokolle/suche';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { kachelVon } from './anzeige';
import { Etikett } from '@ui/bedienung/Etikett';
import { istLeitungIn } from '@shared/protokolle/zugang';
import styles from './Suche.module.scss';
import { gemeindeZeitzone } from '@shared/ct/zeit';

const ARTEN: { wert: SuchArt | 'alles'; text: string }[] = [
  { wert: 'alles', text: 'Alles' },
  { wert: 'beschluss', text: 'Beschlüsse' },
  { wert: 'aufgabe', text: 'To-Dos' },
  { wert: 'termin', text: 'Termine' },
  { wert: 'text', text: 'Protokolltext' },
];

const MARKE: Record<SuchArt, { text: string; ton: 'gruen' | 'blau' | 'neutral' }> = {
  beschluss: { text: 'Beschluss', ton: 'gruen' },
  aufgabe: { text: 'To-Do', ton: 'blau' },
  termin: { text: 'Termin', ton: 'neutral' },
  text: { text: 'Protokolltext', ton: 'neutral' },
};

/** So viele Treffer zeigt die Liste – mehr wird unübersichtlich und langsam; die Suche grenzt dann weiter ein. */
export const HOECHSTENS = 200;

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; uebersicht: GruppenUebersicht[] };

/** Text mit hervorgehobenen Fundstellen. */
function Markiert({ text, woerter }: { text: string; woerter: readonly string[] }) {
  const stellen = fundstellen(text, woerter);
  if (!stellen.length) return <>{text}</>;
  const teile: ReactNode[] = [];
  let i = 0;
  for (const s of stellen) {
    if (s.von > i) teile.push(text.slice(i, s.von));
    teile.push(<mark key={s.von}>{text.slice(s.von, s.bis)}</mark>);
    i = s.bis;
  }
  if (i < text.length) teile.push(text.slice(i));
  return <>{teile}</>;
}

/** Die zweite Zeile: Gruppe · Sitzung · Punkt (und beim To-Do der Stand – so, wie er für mich steht, W10). */
function wo(e: SuchEintrag, stand: AufgabenStatus | null): string {
  const teile = [e.gruppe.name];
  if (e.sitzung) teile.push(e.sitzung.titel);
  if (e.punkt) teile.push(punktBeschriftung(e.punkt));
  if (e.aufgabe) {
    teile.push(statusText(stand ?? e.aufgabe.status));
    if (e.aufgabe.bis) teile.push(`bis ${tagKurz(e.aufgabe.bis)}`);
  }
  return teile.join(' · ');
}

export interface SucheProps {
  modul: number;
  gruppen: ProtokollGruppe[];
  begriff: string;
  /** Wer sucht – und wo er Leitung ist (`schreibbar`): Danach richtet sich der Stand eines To-Dos („Jeder für sich“, W10). */
  ich: number;
  schreibbar: readonly number[];
  /** Ein Treffer öffnet seine Sitzung – und springt zum Tagesordnungspunkt, wenn er einen hat. */
  onTreffer: (gruppe: number, sitzung: string, punkt: string | null) => void;
}

/**
 * **Die Suche** (Bauplan S3-4b, Entwurf vom 23.10.2026): Filter nach Art und Gruppe, darunter die Treffer. Ohne
 * Suchbegriff sind „Beschlüsse“ gewählt – die Übersicht aller Beschlüsse. Mit Begriff ist „Alles“ gewählt, solange
 * man keine Art selbst wählt. Gesucht wird im gelesenen Stand (derselbe wie für die Startseite); was gilt, steht in
 * `shared/protokolle/suche.ts`.
 */
export function Suche({ modul, gruppen, begriff, ich, schreibbar, onTreffer }: SucheProps) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [gewaehlt, setGewaehlt] = useState<SuchArt | 'alles' | null>(null);
  const [gruppe, setGruppe] = useState<number | null>(null);

  const laden = useCallback(() => {
    if (!gruppen.length) return setZustand({ art: 'fertig', uebersicht: [] });
    setZustand({ art: 'laedt' });
    ladeUebersicht(modul, gruppen, gemeindeZeitzone()).then(
      (uebersicht) => setZustand({ art: 'fertig', uebersicht }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppen]);

  useEffect(laden, [laden]);

  const index = useMemo(
    () => (zustand.art === 'fertig' ? suchIndex(zustand.uebersicht) : []),
    [zustand],
  );
  // Wie ein To-Do für mich steht (`standFuer`): als Mitarbeiter bei „Jeder für sich“ nur mein Teil. Leitung wie überall
  // (`istLeitungIn`, W16) – „Schreibt mit“ sieht es wie ein Mitarbeiter.
  const standVon = (e: SuchEintrag): AufgabenStatus | null => {
    const g = gruppen.find((x) => x.id === e.gruppe.id);
    const stufen =
      zustand.art === 'fertig'
        ? zustand.uebersicht.find((u) => u.gruppe.id === e.gruppe.id)?.sitzungen.stufen
        : undefined;
    return e.aufgabe
      ? standFuer(e.aufgabe, { ich, leitung: !!g && istLeitungIn(g, schreibbar, stufen) })
      : null;
  };
  const woerter = begriffe(begriff);
  const art = gewaehlt ?? (woerter.length ? 'alles' : 'beschluss');
  const treffer = suchen(index, { begriff, art, gruppe });
  const kopf = woerter.length
    ? 'Treffer'
    : art === 'beschluss'
      ? 'Alle Beschlüsse'
      : 'Ohne Suchbegriff';

  const leer = (): string => {
    if (woerter.length) return 'Nichts gefunden.';
    if (art === 'text') return 'Gib oben einen Suchbegriff ein, um im Protokolltext zu suchen.';
    if (art === 'beschluss') return 'Noch keine Beschlüsse in freigegebenen Protokollen.';
    return 'Noch nichts da.';
  };

  return (
    <div className={styles.seite}>
      <div className={styles.filter} role="group" aria-label="Art">
        {ARTEN.map((a) => (
          <button
            key={a.wert}
            type="button"
            className={styles.chip}
            aria-pressed={art === a.wert}
            onClick={() => setGewaehlt(a.wert)}
          >
            {a.text}
          </button>
        ))}
      </div>
      {gruppen.length > 1 && (
        <div className={styles.filter} role="group" aria-label="Gruppe">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={gruppe === null}
            onClick={() => setGruppe(null)}
          >
            Alle Gruppen
          </button>
          {gruppen.map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.chip}
              aria-pressed={gruppe === g.id}
              onClick={() => setGruppe(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <section className={styles.karte} aria-labelledby="suche-kopf">
        <div className={styles.kartenkopf}>
          <h2 id="suche-kopf">{kopf}</h2>
          {zustand.art === 'fertig' && <span className={styles.anzahl}>{treffer.length}</span>}
        </div>
        {zustand.art === 'laedt' && <p className={styles.innen}>Wird geladen …</p>}
        {zustand.art === 'fehler' && (
          <div className={styles.innen}>
            <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />
          </div>
        )}
        {zustand.art === 'fertig' &&
          (treffer.length ? (
            <ul className={styles.liste}>
              {treffer.slice(0, HOECHSTENS).map((e) => {
                const inhalt = (
                  <>
                    {e.sitzung ? (
                      <DatumKachel
                        {...kachelVon(e.sitzung.beginn, gemeindeZeitzone())}
                        gedimmt={e.art === 'aufgabe' && standVon(e) === 'erledigt'}
                      />
                    ) : (
                      <span className={styles.ohneKachel} aria-hidden>
                        <Icon name="clock" size={18} />
                      </span>
                    )}
                    <span className={styles.text}>
                      <b>
                        {e.datum ? `${tagPunkt(e.datum)} – ` : ''}
                        <Markiert text={e.text} woerter={woerter} />
                      </b>
                      {/* Schild in der zweiten Zeile: am Handy bleibt so die Breite für den Text. */}
                      <span className={styles.unter}>
                        <Etikett ton={MARKE[e.art].ton}>{MARKE[e.art].text}</Etikett>
                        <small>
                          <Markiert text={wo(e, standVon(e))} woerter={woerter} />
                        </small>
                      </span>
                    </span>
                    {e.sitzung && <Icon name="chev-right" size={18} />}
                  </>
                );
                const s = e.sitzung;
                return (
                  <li key={e.schluessel}>
                    {s ? (
                      <button
                        type="button"
                        className={styles.zeile}
                        onClick={() =>
                          onTreffer(e.gruppe.id, s.schluessel, e.punkt?.blockId ?? null)
                        }
                      >
                        {inhalt}
                      </button>
                    ) : (
                      <div className={`${styles.zeile} ${styles.still}`}>{inhalt}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.innen}>{leer()}</p>
          ))}
        {zustand.art === 'fertig' && treffer.length > HOECHSTENS && (
          <p className={styles.fuss}>
            Die ersten {HOECHSTENS} von {treffer.length} Treffern – grenze die Suche mit einem
            weiteren Wort oder einem Filter ein.
          </p>
        )}
      </section>
    </div>
  );
}
