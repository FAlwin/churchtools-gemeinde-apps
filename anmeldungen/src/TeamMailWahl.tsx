import { useRef } from 'react';
import { Schalter } from '@ui/bedienung/Schalter';
import { kurzname } from '@shared/anmeldung/bedingungen';
import {
  TEAM_TEXT_MAX,
  type OeffentlicheEinstellungen,
  type TeamMailEinstellung,
} from '@shared/anmeldung/formular';
import { teamBausteinNamen, teamFragen } from '@shared/anmeldung/teamMail';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import bk from './Baukasten.module.scss';
import sp from './SpaltenFenster.module.scss';

/**
 * **Reiter „Team-Mail“ im Fenster „Mails“** (F7c, Entwurf `f7-mails-v1`, Klick-Runden 11 und 12): Schalter (Standard an),
 * an wen sie geht, eigener Text mit „Antwort einfügen“ (das Formular füllt ihn selbst) und Häkchen, welche Antworten
 * mitkommen (alle an, die Leitung wählt ab). Gespeichert in den Einstellungen der Veranstaltung – das Formular schickt sie.
 */
export function TeamMailWahl({
  wert,
  onWert,
  e,
  veranstaltung,
  leitung,
}: {
  wert: TeamMailEinstellung;
  onWert: (teil: Partial<TeamMailEinstellung>) => void;
  e: OeffentlicheEinstellungen;
  veranstaltung: string;
  /** Namen der Leitung – `null`: wird noch geladen. */
  leitung: string[] | null;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fragen = teamFragen(e);
  return (
    <>
      <button
        type="button"
        className={bk.schalterZeile}
        aria-pressed={wert.an}
        onClick={() => onWert({ an: !wert.an })}
      >
        <Schalter an={wert.an} />
        Team-Mail bei jeder Anmeldung
      </button>
      {!wert.an ? (
        <p className={a.leise}>Aus – neue Anmeldungen seht ihr nur in der Erweiterung.</p>
      ) : (
        <>
          <p className={a.hinweisBlau}>
            Geht an <b>alle Leiter</b> der Veranstaltung mit Mail-Adresse
            {leitung === null
              ? ' …'
              : leitung.length
                ? `: ${leitung.join(', ')}`
                : ' – im Moment niemand'}
            . Den Betreff legt ChurchTools fest: „Formularanfrage zur Gruppe {veranstaltung}“.
            Antworten gehen an die Person, die angemeldet hat.
          </p>
          <label className={f.feld}>
            <span>Eigener Text (freiwillig)</span>
            <textarea
              ref={textRef}
              className={`${f.eingabe} ${a.rundmailText}`}
              value={wert.text}
              maxLength={TEAM_TEXT_MAX}
              placeholder="z. B. Neue Anmeldung [Anmelde-Nr.] – bitte bis Freitag im Bereich [Bereich] melden."
              onChange={(ev) => onWert({ text: ev.target.value })}
            />
          </label>
          <AntwortKnoepfe
            namen={teamBausteinNamen(e)}
            wer="das Formular füllt sie aus der Anmeldung"
            feld={textRef}
            wert={wert.text}
            onWert={(text) => onWert({ text })}
          />
          {fragen.length > 0 && (
            <fieldset className={a.teamFragen}>
              <legend>Diese Antworten kommen mit</legend>
              {fragen.map((x) => (
                <label key={x.id} className={sp.wahl}>
                  <input
                    type="checkbox"
                    checked={!wert.ohne.includes(x.id)}
                    onChange={(ev) =>
                      onWert({
                        ohne: ev.target.checked
                          ? wert.ohne.filter((id) => id !== x.id)
                          : [...wert.ohne, x.id],
                      })
                    }
                  />
                  <span>{kurzname(x)}</span>
                </label>
              ))}
            </fieldset>
          )}
          <p className={a.leise}>
            Gesundheitsangaben besser abwählen – die Mail geht an alle Leiter. Eine Mail je
            Anmeldung (alle Personen darin, je mit Platz oder Warteliste), gleich nach dem Absenden
            – auch, wenn jemand noch per Mail bestätigen muss. Bei „Von Hand“ gibt es keine.
            Zeilenumbrüche übernimmt ChurchTools nicht – alles steht in einem Absatz.
          </p>
        </>
      )}
    </>
  );
}
