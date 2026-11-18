import { useRef } from 'react';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import {
  ZWEITE_TAGE_MAX,
  ZWEITE_TAGE_MIN,
  standardBetreff,
  type ZweiteWann,
} from '@shared/anmeldung/ablaeufe';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import type { ZweiteEntwurf } from './zweiteEntwurf';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import bk from './Baukasten.module.scss';

const HINWEIS: Record<ZweiteWann['art'], string> = {
  sofort: 'Kommt direkt nach der Bestätigung.',
  tage: 'Zählt ab der Bestätigung (wer nachrückt: ab dann). Erinnerungen, die in diese Tage fallen, kommen erst nach der zweiten Mail.',
  datum:
    'Ist der Tag schon da, kommt sie gleich nach der Bestätigung. Muss die Erweiterung schon Angemeldete neu durch den Ablauf schicken (selten), bekommen auch sie die Mail an diesem Tag.',
};

/**
 * **Reiter „Zweite Mail“ im Fenster „Mails“** (F7b, Entwurf `f7-mails-v1`, Alwin 18.11.2026): Schalter, wann (gleich,
 * X Tage, Datum), Betreff und Text mit „Antwort einfügen“. Geht an jede Person mit Platz; schon Angemeldete bekommen sie
 * nicht (dafür die Rundmail).
 */
export function ZweiteMailWahl({
  wert,
  onWert,
  veranstaltung,
  bausteine,
}: {
  wert: ZweiteEntwurf;
  onWert: (teil: Partial<ZweiteEntwurf>) => void;
  veranstaltung: string;
  bausteine: readonly string[];
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <button
        type="button"
        className={bk.schalterZeile}
        aria-pressed={wert.an}
        onClick={() => onWert({ an: !wert.an })}
      >
        <Schalter an={wert.an} />
        Zweite Mail verschicken
      </button>
      {!wert.an ? (
        <p className={a.leise}>Aus – es gibt nur die Bestätigung.</p>
      ) : (
        <>
          <Segment<ZweiteWann['art']>
            value={wert.art}
            ariaLabel="Wann"
            options={[
              { value: 'sofort', label: 'Gleich danach' },
              { value: 'tage', label: 'Nach Tagen' },
              { value: 'datum', label: 'An einem Tag' },
            ]}
            onChange={(x) => onWert({ art: x })}
          />
          {wert.art === 'tage' && (
            <label className={f.feld}>
              <span>Tage nach der Anmeldung</span>
              <input
                className={f.eingabe}
                type="number"
                inputMode="numeric"
                min={ZWEITE_TAGE_MIN}
                max={ZWEITE_TAGE_MAX}
                value={wert.tage ?? ''}
                onChange={(ev) =>
                  onWert({ tage: ev.target.value === '' ? null : Number(ev.target.value) })
                }
              />
            </label>
          )}
          {wert.art === 'datum' && (
            <label className={f.feld}>
              <span>Tag</span>
              <input
                className={f.eingabe}
                type="date"
                value={wert.datum}
                onChange={(ev) => onWert({ datum: ev.target.value })}
              />
            </label>
          )}
          <p className={a.leise}>{HINWEIS[wert.art]}</p>
          <label className={f.feld}>
            <span>Betreff</span>
            <input
              className={f.eingabe}
              value={wert.betreff}
              placeholder={standardBetreff('zweite', veranstaltung)}
              onChange={(ev) => onWert({ betreff: ev.target.value })}
            />
          </label>
          <label className={f.feld}>
            <span>Text</span>
            <textarea
              ref={textRef}
              className={`${f.eingabe} ${a.rundmailText}`}
              value={wert.text}
              placeholder="z. B. Hallo [Vorname], wir laden dich herzlich zum Mitarbeiter-Wochenende ein …"
              onChange={(ev) => onWert({ text: ev.target.value })}
            />
          </label>
          <AntwortKnoepfe
            namen={bausteine}
            feld={textRef}
            wert={wert.text}
            onWert={(text) => onWert({ text })}
          />
          <p className={a.leise}>
            Geht an jede Person mit Platz – wer von der Warteliste nachrückt, bekommt sie dann. Wer
            schon angemeldet ist, bekommt sie nicht; für sie gibt es die Rundmail.
          </p>
        </>
      )}
    </>
  );
}
