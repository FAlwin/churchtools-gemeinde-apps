import { useState } from 'react';
import { AnkerFenster } from '@ui/bedienung/SpaltenFilter';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { OeffentlicheEinstellungen, SpaltenFilter } from '@shared/anmeldung/formular';
import { zahlAus } from '@shared/anmeldung/tabelle';
import {
  filterAntworten,
  filterArt,
  filterName,
  filterVollstaendig,
} from '@shared/anmeldung/tabellenFilter';
import s from './SpaltenFilterFenster.module.scss';

/** Der leere Filter je Art – so beginnt das Fenster, wenn die Spalte noch keinen hat. */
function leer(e: OeffentlicheEinstellungen, spalte: string): SpaltenFilter {
  const art = filterArt(e, spalte);
  if (art === 'zahl') return { spalte, ab: null, bis: null };
  if (art === 'text') return { spalte, text: 'ausgefuellt' };
  return { spalte, werte: [] };
}

const zahlFeld = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

/**
 * **Das Filterfenster einer Spalte** (R2) – geht direkt am Trichter auf (am Handy als Fenster). Je nach Art der Spalte:
 * die Antworten mit Anzahl (mehrere = eine davon), eine Zahl ab/bis, ein Text ausgefüllt/leer/enthält. „Anwenden“
 * setzt den Filter, „Filter entfernen“ nimmt ihn weg.
 */
export function SpaltenFilterFenster({
  e,
  spalte,
  filter,
  anzahl,
  wer,
  anker,
  handy,
  onAnwenden,
  onClose,
}: {
  e: OeffentlicheEinstellungen;
  spalte: string;
  /** Der gesetzte Filter dieser Spalte – ohne: neu. */
  filter: SpaltenFilter | null;
  /** Wie viele Zeilen (mit den übrigen Filtern) zu einer Antwort passen. */
  anzahl: (f: SpaltenFilter) => number;
  /** „Anmeldungen“ oder „Personen“ – was gezählt wird. */
  wer: string;
  anker: HTMLElement | null;
  handy: boolean;
  onAnwenden: (f: SpaltenFilter | null) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<SpaltenFilter>(() => filter ?? leer(e, spalte));
  const name = filterName(e, spalte);
  const ok = filterVollstaendig(f);
  const anwenden = () => ok && onAnwenden(f);

  let rumpf;
  if ('werte' in f) {
    const werte = f.werte;
    const antworten = filterAntworten(e, spalte);
    rumpf = (
      <>
        <div className={s.liste} role="group" aria-label={`Antworten zu „${name}“`}>
          {antworten.map((a) => (
            <label key={a} className={s.wahl}>
              <input
                type="checkbox"
                aria-label={`${a} (${anzahl({ spalte, werte: [a] })})`}
                checked={werte.includes(a)}
                onChange={(ev) => {
                  const neu = new Set(werte);
                  if (ev.target.checked) neu.add(a);
                  else neu.delete(a);
                  setF({ spalte, werte: antworten.filter((x) => neu.has(x)) });
                }}
              />
              <span className={s.antwort}>{a}</span>
              <small className={s.zahl} aria-hidden>
                {anzahl({ spalte, werte: [a] })}
              </small>
            </label>
          ))}
        </div>
        <small className={s.hinweis}>Zahlen = {wer}. Mehrere angehakt: Es reicht eine davon.</small>
      </>
    );
  } else if ('text' in f) {
    const modi = [
      ['ausgefuellt', 'ist ausgefüllt'],
      ['leer', 'ist leer'],
      ['enthaelt', 'enthält …'],
    ] as const;
    rumpf = (
      <div className={s.liste} role="radiogroup" aria-label={`Filter „${name}“`}>
        {modi.map(([m, text]) => (
          <label key={m} className={s.wahl}>
            <input
              type="radio"
              name={`filter-${spalte}`}
              checked={f.text === m}
              onChange={() => setF({ spalte, text: m, ...(m === 'enthaelt' ? { suche: '' } : {}) })}
            />
            <span className={s.antwort}>{text}</span>
          </label>
        ))}
        {f.text === 'enthaelt' && (
          <input
            className={s.feld}
            type="text"
            aria-label="Enthält"
            placeholder="z. B. Nüsse"
            maxLength={40}
            autoFocus
            value={f.suche ?? ''}
            onChange={(ev) => setF({ spalte, text: 'enthaelt', suche: ev.target.value })}
            onKeyDown={(ev) => ev.key === 'Enter' && anwenden()}
          />
        )}
      </div>
    );
  } else {
    const g = f;
    const feld = (welche: 'ab' | 'bis') => (
      <label className={s.zahlFeld}>
        <span>{welche}</span>
        <input
          className={s.feld}
          type="text"
          inputMode="decimal"
          aria-label={welche === 'ab' ? 'ab' : 'bis'}
          defaultValue={zahlFeld(g[welche])}
          onChange={(ev) => setF({ ...g, [welche]: zahlAus(ev.target.value) })}
          onKeyDown={(ev) => ev.key === 'Enter' && anwenden()}
        />
      </label>
    );
    rumpf = (
      <div className={s.zwei}>
        {feld('ab')}
        {feld('bis')}
      </div>
    );
  }

  return (
    <AnkerFenster
      anker={anker}
      titel={name}
      handy={handy}
      onClose={onClose}
      links={
        filter ? (
          <FensterKnopf art="loeschen" onClick={() => onAnwenden(null)}>
            Filter entfernen
          </FensterKnopf>
        ) : undefined
      }
      knopf={
        <FensterKnopf disabled={!ok} onClick={anwenden}>
          Anwenden
        </FensterKnopf>
      }
    >
      {rumpf}
    </AnkerFenster>
  );
}
