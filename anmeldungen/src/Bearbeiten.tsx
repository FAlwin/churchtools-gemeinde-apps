import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useLinkKopieren } from './useLinkKopieren';
import { Segment } from '@ui/bedienung/Segment';
import { ctBasis } from '@ui/ct/basis';
import { tagAusIso } from '@shared/ct/zeit';
import { mailGueltig, mitWer, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  NACHNAME,
  ZWECK_MAX,
  ibanGueltig,
  ibanNormal,
  ibanText,
  pruefeBezahlung,
  verwendungszweck,
  type Bezahlung,
} from '@shared/anmeldung/bezahlung';
import { zahlartenFuer } from '@shared/anmeldung/zahlung';
import {
  anmeldeLink,
  ortszeitAus,
  terminAusCt,
  utcAus,
  type CtTermin,
} from '@shared/anmeldung/termin';
import {
  aendereEinstellungen,
  kalenderListe,
  legeTerminAn,
  speichereAnmeldung,
  speichereBezahlung,
  termineIn,
  type AnmeldeEinstellungen,
  type Kalender,
} from './einrichten';
import { WER_TEXT, datumText, geburtsdatumNoetigText, schlussVorLoeschenText } from './anzeige';
import { ablaeufeEinrichten, type AblaufStand } from './ablaeufe';
import { anmeldeschlussAm, letzterAnmeldetag, loeschDatum } from '@shared/anmeldung/ablaeufe';
import { fehlerMeldung } from './zustand';
import { useSpeichern } from './useSpeichern';
import f from './Formular.module.scss';
import s from './Startseite.module.scss';

/**
 * **Die Fenster zum Einrichten einer Veranstaltung** (A3, #486). Jedes speichert über `einrichten.ts`
 * – dort wird nachgelesen –, meldet Fehler im Fenster und schließt erst, wenn ChurchTools übernommen hat.
 */

export function Fehler({ text }: { text: string | null }) {
  return text ? (
    <p className={f.fehler} role="alert">
      {text}
    </p>
  ) : null;
}

/**
 * Der Link zur Anmeldung – **als Text zu sehen und mit einem Knopf zu kopieren** (Abnahme A3, Alwin
 * 13.10.2026: „ein Link als Text“). Lässt der Browser das Kopieren nicht zu, ist der Link markiert und
 * kann von Hand kopiert werden.
 */
function LinkKopieren({ link }: { link: string }) {
  const feld = useRef<HTMLTextAreaElement>(null);
  const { stand, kopieren } = useLinkKopieren(link, feld);
  return (
    <div className={f.feld}>
      <span>Link zur Anmeldung</span>
      <div className={f.linkZeile}>
        <textarea
          ref={feld}
          className={f.linkText}
          readOnly
          rows={2}
          value={link}
          aria-label="Link zur Anmeldung"
          onFocus={(e) => e.target.select()}
        />
        <FensterKnopf art={stand === 'kopiert' ? 'hell' : 'zweit'} onClick={() => void kopieren()}>
          {stand === 'kopiert' ? 'Link kopiert' : 'Link kopieren'}
        </FensterKnopf>
      </div>
      {stand === 'vonHand' && (
        <small className={f.hinweis}>
          Der Browser lässt das Kopieren nicht zu – der Link ist markiert, kopiere ihn von Hand.
        </small>
      )}
    </div>
  );
}

const plusTage = (tag: string, n: number) =>
  new Date(Date.parse(`${tag}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ── Termin ──────────────────────────────────────────────────────────────────────────────────────

/**
 * **Termin**: einen vorhandenen aus dem Kalender wählen oder einen neuen anlegen (Alwin, 12.10.2026:
 * „immer aus dem Kalender“). Datum und Ort werden kopiert, nicht verknüpft. Den Link zur Anmeldung trägt
 * die Erweiterung nur in Termine ein, die sie selbst anlegt – an fremden würde `PUT` alles andere
 * überschreiben (gemessen); dort steht der Link zum Kopieren da.
 */
export function TerminFenster({
  id,
  name,
  termin,
  zeitzone,
  formularAdresse,
  onClose,
  onGespeichert,
}: {
  id: number;
  name: string;
  /** Der bisherige Termin – „Neu anlegen“ beginnt mit seinen Angaben. */
  termin: OeffentlicheEinstellungen['termin'];
  zeitzone: string;
  /** Formular-Seite der Gemeinde – ohne sie gibt es keinen Link (A6-2). */
  formularAdresse: string | null;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const heute = tagAusIso(new Date().toISOString(), zeitzone);
  const [art, setArt] = useState<'vorhanden' | 'neu'>('vorhanden');
  const [kalender, setKalender] = useState<Kalender[] | null>(null);
  // Beim Kalender des gewählten Termins beginnen (A3-Abnahme: es begann beim ersten, z. B. „Bandproben“).
  const [kalenderId, setKalenderId] = useState<number | null>(termin?.kalenderId ?? null);
  const [termine, setTermine] = useState<CtTermin[] | null>(null);
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState({
    titel: name,
    tag: termin?.beginn.slice(0, 10) ?? heute,
    von: termin?.beginn.slice(11) ?? '10:00',
    bis: termin?.ende?.slice(11) ?? '12:00',
    bisTag:
      termin?.ende && termin.ende.slice(0, 10) !== termin.beginn.slice(0, 10)
        ? termin.ende.slice(0, 10)
        : '',
    ort: termin?.ort ?? '',
  });
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);

  useEffect(() => {
    kalenderListe().then(setKalender, (e: unknown) => setLadeFehler(fehlerMeldung(e).text));
  }, []);

  const auswahl = useMemo(
    () => (kalender ?? []).filter((k) => art === 'vorhanden' || k.schreiben),
    [kalender, art],
  );
  // Gewählter Kalender muss zur Auswahl passen (beim Wechsel auf „neu“ fallen nicht beschreibbare weg).
  useEffect(() => {
    if (auswahl.length && !auswahl.some((k) => k.id === kalenderId)) setKalenderId(auswahl[0].id);
  }, [auswahl, kalenderId]);

  useEffect(() => {
    if (art !== 'vorhanden' || kalenderId === null) return;
    let aktuell = true;
    setTermine(null);
    termineIn(kalenderId, heute, plusTage(heute, 400)).then(
      (t) => aktuell && setTermine(t.sort((a, b) => a.startDate.localeCompare(b.startDate))),
      (e: unknown) => aktuell && setLadeFehler(fehlerMeldung(e).text),
    );
    return () => {
      aktuell = false;
    };
  }, [art, kalenderId, heute]);

  const gefiltert = (termine ?? []).filter((t) =>
    (t.title ?? '').toLowerCase().includes(suche.trim().toLowerCase()),
  );

  const endeNachBeginn = `${neu.bisTag || neu.tag}T${neu.bis}` > `${neu.tag}T${neu.von}`;
  const neuBereit =
    kalenderId !== null &&
    neu.titel.trim() !== '' &&
    neu.tag !== '' &&
    neu.von !== '' &&
    neu.bis !== '' &&
    endeNachBeginn;

  return (
    <Sheet
      title="Termin"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        // „Aus dem Kalender“: Ein Tipp auf den Termin übernimmt ihn – unten steht dann nur „Abbrechen“.
        art === 'neu' && kalenderId !== null ? (
          <FensterKnopf
            disabled={!neuBereit || arbeitet}
            onClick={() =>
              speichern(async () => {
                const termin = await legeTerminAn({
                  kalenderId: kalenderId,
                  titel: neu.titel.trim(),
                  beginn: `${neu.tag}T${neu.von}`,
                  ende: `${neu.bisTag || neu.tag}T${neu.bis}`,
                  ort: neu.ort.trim(),
                  link: formularAdresse ? anmeldeLink(formularAdresse, ctBasis(), id) : null,
                  zeitzone,
                });
                await aendereEinstellungen(id, (e) => ({
                  ...e,
                  termin: terminAusCt(termin, zeitzone, kalenderId),
                }));
              })
            }
          >
            {arbeitet ? 'Wird angelegt …' : 'Termin anlegen und übernehmen'}
          </FensterKnopf>
        ) : null
      }
    >
      <div className={f.feld}>
        <Segment
          ariaLabel="Termin"
          value={art}
          onChange={setArt}
          options={[
            { value: 'vorhanden', label: 'Aus dem Kalender' },
            { value: 'neu', label: 'Neu anlegen' },
          ]}
        />
      </div>
      <Fehler text={ladeFehler} />
      {kalender === null && !ladeFehler ? (
        <p className={f.hinweis}>Kalender werden geladen …</p>
      ) : auswahl.length === 0 ? (
        <p className={f.hinweis}>
          {art === 'neu'
            ? 'Du darfst in keinem Kalender Termine anlegen. Frag die Verantwortlichen deiner Gemeinde nach dem Recht für den passenden Kalender.'
            : 'Du siehst keinen Kalender.'}
        </p>
      ) : (
        <label className={f.feld}>
          <span>Kalender</span>
          <select
            className={f.eingabe}
            value={kalenderId ?? ''}
            onChange={(e) => setKalenderId(Number(e.target.value))}
          >
            {auswahl.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {art === 'vorhanden' && kalenderId !== null && (
        <>
          <label className={f.feld}>
            <span>Suchen</span>
            <input className={f.eingabe} value={suche} onChange={(e) => setSuche(e.target.value)} />
          </label>
          {termine === null ? (
            <p className={f.hinweis}>Termine werden geladen …</p>
          ) : gefiltert.length === 0 ? (
            <p className={f.hinweis}>Keine Termine in den nächsten Monaten.</p>
          ) : (
            <ul className={f.optionen} aria-label="Termine">
              {gefiltert.slice(0, 30).map((t) => {
                const k = terminAusCt(t, zeitzone, kalenderId);
                return (
                  <li key={`${t.id}-${t.startDate}`} className={f.listenEintrag}>
                    <button
                      type="button"
                      className={f.option}
                      disabled={arbeitet}
                      onClick={() =>
                        speichern(() => aendereEinstellungen(id, (e) => ({ ...e, termin: k })))
                      }
                    >
                      {t.title}
                      <small>
                        {datumText(k.beginn.slice(0, 10))}, {k.beginn.slice(11)} Uhr
                        {k.ort ? ` · ${k.ort}` : ''}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={f.hinweis} style={{ marginTop: 12 }}>
            In einen vorhandenen Termin trägt die Erweiterung nichts ein (sie würde sonst Räume,
            Dienste oder Bild darin überschreiben). Den Link zur Anmeldung kannst du dort selbst ins
            Feld „Link“ einfügen.
          </p>
          {formularAdresse && <LinkKopieren link={anmeldeLink(formularAdresse, ctBasis(), id)} />}
        </>
      )}

      {art === 'neu' && kalenderId !== null && (
        <>
          <label className={f.feld}>
            <span>Titel im Kalender</span>
            <input
              className={f.eingabe}
              value={neu.titel}
              onChange={(e) => setNeu({ ...neu, titel: e.target.value })}
            />
          </label>
          <div className={f.zeile}>
            <label className={f.feld}>
              <span>Datum</span>
              <input
                type="date"
                className={f.eingabe}
                value={neu.tag}
                onChange={(e) => setNeu({ ...neu, tag: e.target.value })}
              />
            </label>
            <label className={f.feld}>
              <span>bis (mehrtägig)</span>
              <input
                type="date"
                className={f.eingabe}
                value={neu.bisTag}
                min={neu.tag}
                onChange={(e) => setNeu({ ...neu, bisTag: e.target.value })}
              />
            </label>
          </div>
          <div className={f.zeile}>
            <label className={f.feld}>
              <span>Beginn</span>
              <input
                type="time"
                className={f.eingabe}
                value={neu.von}
                onChange={(e) => setNeu({ ...neu, von: e.target.value })}
              />
            </label>
            <label className={f.feld}>
              <span>Ende</span>
              <input
                type="time"
                className={f.eingabe}
                value={neu.bis}
                onChange={(e) => setNeu({ ...neu, bis: e.target.value })}
              />
            </label>
          </div>
          <label className={f.feld}>
            <span>Ort</span>
            <input
              className={f.eingabe}
              value={neu.ort}
              onChange={(e) => setNeu({ ...neu, ort: e.target.value })}
              placeholder="Gemeindesaal"
            />
          </label>
          {!endeNachBeginn && <p className={f.hinweis}>Das Ende muss nach dem Beginn liegen.</p>}
          <Fehler text={fehler} />
        </>
      )}
      {art === 'vorhanden' && <Fehler text={fehler} />}
    </Sheet>
  );
}

// ── Anmeldung ───────────────────────────────────────────────────────────────────────────────────

/** **Anmeldung**: Zeitraum, Plätze, Warteliste (ChurchTools) und wann die freien Plätze zu sehen sind (unsere Einstellung). */
export function AnmeldungFenster({
  id,
  anmeldung,
  plaetze,
  kontakt,
  zeitzone,
  loeschDatum: geloeschtAm,
  onClose,
  onGespeichert,
}: {
  id: number;
  anmeldung: AnmeldeEinstellungen;
  plaetze: OeffentlicheEinstellungen['plaetze'];
  /** Kontakt für Rückfragen (A6-4) – steht auf „Deine Anmeldung“. */
  kontakt: string;
  zeitzone: string;
  /**
   * Löschdatum, wie es in ChurchTools steht (A9-3a) – dann schließt die Anmeldung spätestens am Tag davor; kein oder ein
   * späterer Anmeldeschluss lässt sich nicht speichern.
   */
  loeschDatum: string | null;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const tagVon = (iso: string | null) => (iso ? ortszeitAus(iso, zeitzone).slice(0, 10) : '');
  const [ab, setAb] = useState(tagVon(anmeldung.ab));
  const [bis, setBis] = useState(tagVon(anmeldung.bis));
  const spaetestens = geloeschtAm ? letzterAnmeldetag(geloeschtAm) : null;
  const bisPasst = spaetestens === null || (!!bis && bis <= spaetestens);
  const [max, setMax] = useState(anmeldung.maxPlaetze === null ? '' : String(anmeldung.maxPlaetze));
  const [warteliste, setWarteliste] = useState(anmeldung.warteliste);
  const [zeigen, setZeigen] = useState(plaetze.zeigen);
  const [knapp, setKnapp] = useState(String(plaetze.knappUnter));
  const [mail, setMail] = useState(kontakt);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);
  const mailOk = !mail.trim() || mailGueltig(mail);

  const maxZahl = max.trim() === '' ? null : Number(max);
  const gueltig =
    (maxZahl === null || (Number.isInteger(maxZahl) && maxZahl > 0)) &&
    (!ab || !bis || ab <= bis) &&
    bisPasst &&
    Number.isInteger(Number(knapp)) &&
    Number(knapp) > 0 &&
    mailOk;

  return (
    <Sheet
      title="Anmeldung"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={!gueltig || arbeitet}
          onClick={() =>
            speichern(async () => {
              await speichereAnmeldung(id, {
                maxPlaetze: maxZahl,
                warteliste,
                ab: ab ? utcAus(`${ab}T00:00`, zeitzone) : null,
                bis: bis ? anmeldeschlussAm(bis, zeitzone) : null,
              });
              await aendereEinstellungen(id, (e) => ({
                ...e,
                plaetze: { zeigen, knappUnter: Number(knapp) },
                kontakt: mail.trim(),
              }));
            })
          }
        >
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <div className={f.zeile}>
        <label className={f.feld}>
          <span>Anmeldung ab</span>
          <input
            type="date"
            className={f.eingabe}
            value={ab}
            onChange={(e) => setAb(e.target.value)}
          />
        </label>
        <label className={f.feld}>
          <span>Anmeldeschluss</span>
          <input
            type="date"
            className={f.eingabe}
            value={bis}
            max={spaetestens ?? undefined}
            onChange={(e) => setBis(e.target.value)}
          />
        </label>
      </div>
      {geloeschtAm && (
        <p className={bisPasst ? f.hinweis : f.fehler}>
          Am {datumText(geloeschtAm)} entfernt ChurchTools alle Anmeldungen (Datenschutz).{' '}
          {schlussVorLoeschenText(geloeschtAm)}
        </p>
      )}
      {!ab && <p className={f.hinweis}>Ohne Beginn nimmt ChurchTools keine Anmeldungen an.</p>}
      <label className={f.feld}>
        <span>Plätze (leer = unbegrenzt)</span>
        <input
          className={f.eingabe}
          inputMode="numeric"
          value={max}
          onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <div className={f.feld}>
        <span>Wenn alles belegt ist</span>
        <Segment
          ariaLabel="Wenn alles belegt ist"
          value={warteliste ? 'ja' : 'nein'}
          onChange={(v) => setWarteliste(v === 'ja')}
          options={[
            { value: 'ja', label: 'Warteliste' },
            { value: 'nein', label: 'Anmeldung zu' },
          ]}
        />
      </div>
      <div className={f.feld}>
        <span>Freie Plätze im Formular zeigen</span>
        <Segment
          ariaLabel="Freie Plätze zeigen"
          value={zeigen}
          onChange={setZeigen}
          options={[
            { value: 'immer', label: 'Immer' },
            { value: 'knapp', label: 'Wenn knapp' },
            { value: 'nie', label: 'Nie' },
          ]}
        />
      </div>
      {zeigen === 'knapp' && (
        <label className={f.feld}>
          <span>Knapp heißt: weniger als … frei</span>
          <input
            className={f.eingabe}
            inputMode="numeric"
            value={knapp}
            onChange={(e) => setKnapp(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      )}
      <label className={f.feld}>
        <span>Kontakt für Rückfragen (E-Mail)</span>
        <input
          type="email"
          className={f.eingabe}
          maxLength={120}
          placeholder="z. B. kinder@gemeinde.de"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
        />
      </label>
      {mailOk ? (
        <p className={f.hinweis}>
          Steht auf „Deine Anmeldung“ – dorthin führt der Link in der Bestätigungsmail.
        </p>
      ) : (
        <p className={f.fehler}>Bitte eine gültige E-Mail-Adresse eintragen.</p>
      )}
      <Fehler text={fehler} />
    </Sheet>
  );
}

// ── Wer meldet sich an, Löschfrist ──────────────────────────────────────────────────────────────

/**
 * **Wer meldet sich an?** – und ob das Geburtsdatum abgefragt wird (A4: Preise nach Alter und der
 * Geschwister-Rabatt brauchen es; im Entwurf steht der Schalter hier). Geschaltet wird über
 * `mitWer`, die eine Stelle, die auch die Leiste im Formular-Baukasten nutzt.
 */
export function WerFenster({
  id,
  wer,
  geburtsdatum,
  wozu,
  onClose,
  onGespeichert,
}: {
  id: number;
  wer: OeffentlicheEinstellungen['wer'];
  geburtsdatum: boolean;
  /** Wozu die Preise das Geburtsdatum brauchen (`wozuGeburtsdatum`). */
  wozu: 'alter' | 'geschwister' | null;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const [wahl, setWahl] = useState(wer);
  const [geburt, setGeburt] = useState(geburtsdatum);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);
  return (
    <Sheet
      title="Wer meldet sich an?"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={arbeitet}
          onClick={() => speichern(() => aendereEinstellungen(id, (e) => mitWer(e, wahl, geburt)))}
        >
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <div className={f.optionen} style={{ marginBottom: 14 }}>
        {(Object.keys(WER_TEXT) as OeffentlicheEinstellungen['wer'][]).map((k) => (
          <button
            key={k}
            type="button"
            className={f.option}
            aria-pressed={wahl === k}
            onClick={() => setWahl(k)}
          >
            {WER_TEXT[k][0]}
            <small>{WER_TEXT[k][1]}</small>
          </button>
        ))}
      </div>
      <div className={f.feld}>
        <span>Geburtsdatum</span>
        <Segment
          ariaLabel="Geburtsdatum"
          value={geburt ? 'ja' : 'nein'}
          onChange={(x) => setGeburt(x === 'ja')}
          options={[
            { value: 'ja', label: 'Pflicht' },
            { value: 'nein', label: 'Nicht abfragen' },
          ]}
        />
      </div>
      {wozu && !geburt && <p className={f.fehler}>{geburtsdatumNoetigText(wozu)}</p>}
      <Fehler text={fehler} />
    </Sheet>
  );
}

// ── Bezahlung ───────────────────────────────────────────────────────────────────────────────────

/**
 * **Bezahlung** (A4): Konto, Zahlungsfrist, Verwendungszweck. Die IBAN wird beim Tippen geprüft
 * (`ibanGueltig`); gespeichert wird nur, was `pruefeBezahlung` durchlässt.
 */
export function BezahlungFenster({
  id,
  bezahlung,
  kostet,
  zahlarten,
  onClose,
  onGespeichert,
}: {
  id: number;
  bezahlung: Bezahlung;
  /** Kann die Anmeldung etwas kosten (`kannEtwasKosten`)? */
  kostet: boolean;
  /** Die Zahlarten der Gemeinde (A7-2) – hier nur an- und abwählen. */
  zahlarten: string[];
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const [inhaber, setInhaber] = useState(bezahlung.kontoinhaber);
  const [iban, setIban] = useState(ibanText(bezahlung.iban));
  const [bic, setBic] = useState(bezahlung.bic);
  const [frist, setFrist] = useState(String(bezahlung.fristTage));
  const [zweck, setZweck] = useState(bezahlung.zweck);
  const [ohne, setOhne] = useState(bezahlung.ohneZahlarten ?? []);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);

  const neu: Bezahlung = {
    kontoinhaber: inhaber.trim(),
    iban: ibanNormal(iban),
    bic: ibanNormal(bic),
    fristTage: frist === '' ? -1 : Number(frist),
    zweck: zweck.trim(),
    // Nur, was es bei der Gemeinde (noch) gibt – eine entfernte Zahlart der Gemeinde fällt hier mit weg.
    ohneZahlarten: ohne.filter((z) => zahlarten.includes(z)),
  };
  const gewaehlt = zahlartenFuer(zahlarten, neu.ohneZahlarten ?? []);
  const probleme = [
    ...pruefeBezahlung(neu),
    ...(zahlarten.length > 0 && gewaehlt.length === 0
      ? ['Bitte mindestens eine Zahlart wählen.']
      : []),
  ];

  return (
    <Sheet
      title="Bezahlung"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={probleme.length > 0 || arbeitet}
          onClick={() => speichern(() => speichereBezahlung(id, neu))}
        >
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={f.hinweis}>
        Die Bankverbindung steht im Anmeldeformular und in der Bestätigung – sie ist öffentlich
        lesbar. Bitte nur das Konto der Gemeinde eintragen.
      </p>
      {kostet && !neu.iban && (
        <p className={f.fehler}>Es gibt Preise, aber noch keine Bankverbindung.</p>
      )}
      <label className={f.feld}>
        <span>Kontoinhaber</span>
        <input
          className={f.eingabe}
          value={inhaber}
          maxLength={70}
          autoComplete="off"
          placeholder="z. B. Evangeliumschristen-Gemeinde e.V."
          onChange={(e) => setInhaber(e.target.value)}
        />
      </label>
      <label className={f.feld}>
        <span>IBAN</span>
        <input
          className={f.eingabe}
          value={iban}
          maxLength={42}
          autoComplete="off"
          spellCheck={false}
          placeholder="DE00 0000 0000 0000 0000 00"
          aria-label="IBAN"
          onChange={(e) => setIban(e.target.value)}
        />
        {neu.iban &&
          (ibanGueltig(neu.iban) ? (
            <small className={f.gut}>IBAN stimmt (Prüfziffer passt).</small>
          ) : (
            <small className={f.fehler}>
              Die IBAN stimmt nicht. Bitte Ziffer für Ziffer prüfen.
            </small>
          ))}
      </label>
      <label className={f.feld}>
        <span>BIC (freiwillig)</span>
        <input
          className={f.eingabe}
          value={bic}
          maxLength={11}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setBic(e.target.value)}
        />
      </label>
      <label className={f.feld}>
        <span>Zahlungsfrist in Tagen nach der Anmeldung (0 = keine)</span>
        <input
          className={f.eingabe}
          inputMode="numeric"
          value={frist}
          onChange={(e) => setFrist(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className={f.feld}>
        <span>Verwendungszweck</span>
        <input
          className={f.eingabe}
          value={zweck}
          maxLength={ZWECK_MAX}
          aria-label="Verwendungszweck"
          onChange={(e) => setZweck(e.target.value)}
        />
        <small className={f.hinweis}>
          {NACHNAME} wird durch den Nachnamen ersetzt, z. B. „{verwendungszweck(zweck, 'Müller')}“.
        </small>
      </label>
      <div className={f.feld}>
        <span>Zahlarten bei dieser Veranstaltung</span>
        <div className={s.chips}>
          {zahlarten.map((z) => (
            <button
              key={z}
              type="button"
              className={s.filterChip}
              aria-pressed={!ohne.includes(z)}
              onClick={() => setOhne(ohne.includes(z) ? ohne.filter((x) => x !== z) : [...ohne, z])}
            >
              {ohne.includes(z) ? z : `✓ ${z}`}
            </button>
          ))}
        </div>
        <small className={f.hinweis}>
          Die Liste legt die Gemeinde fest („Einstellungen“). Beim Abhaken von „bezahlt“ stehen nur
          die gewählten zur Wahl.
        </small>
      </div>
      {probleme
        .filter((p) => !p.startsWith('Die IBAN'))
        .map((p) => (
          <p key={p} className={f.fehler}>
            {p}
          </p>
        ))}
      <Fehler text={fehler} />
    </Sheet>
  );
}

/**
 * **Fenster „Daten löschen“** (A4, Löschen seit A9-3a): Frist in Monaten nach dem Ende. Sind die Abläufe eingerichtet,
 * schreibt das Speichern das neue Löschdatum gleich in die Routinen. Liegt es heute oder früher, entfernte ChurchTools
 * dabei sofort alle Anmeldungen (gemessen) – darum erst die Rückfrage mit der Zahl. `abläufe`: der Stand aus der Karte
 * „Mails“; ohne ihn (Entwurf, ohne Recht) wird nur die Frist gespeichert, das Datum zieht der Abgleich nach.
 */
export function LoeschfristFenster({
  id,
  e,
  ablauf,
  anzahl,
  heute,
  onClose,
  onGespeichert,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  ablauf: AblaufStand | null;
  /** Wie viele angemeldet sind (mit Platz und wartend) – für die Rückfrage. */
  anzahl: number | null;
  heute: string;
  onClose: () => void;
  /** `geloescht`: ChurchTools hat dabei alle Anmeldungen entfernt – dann gibt es kein „Rückgängig“. */
  onGespeichert: (geloescht: boolean) => void;
}) {
  const [wert, setWert] = useState(String(e.loeschfristMonate));
  const [frage, setFrage] = useState(false);
  const zahl = Number(wert);
  const gueltig = Number.isInteger(zahl) && zahl >= 1 && zahl <= 36;
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  const datum = gueltig ? loeschDatum({ termin: e.termin, loeschfristMonate: zahl }) : null;
  const absender = ablauf?.platz && ablauf.warte ? ablauf.absenderId : null;
  const sofort =
    absender !== null && datum !== null && datum <= heute && datum !== ablauf?.loeschDatum;

  const sichern = () =>
    speichern(
      async () => {
        await aendereEinstellungen(id, (x) => ({ ...x, loeschfristMonate: zahl }));
        if (absender !== null)
          await ablaeufeEinrichten(id, absender, undefined, undefined, {
            loeschenBestaetigt: frage,
            heute,
          });
      },
      () => onGespeichert(sofort),
    );

  if (frage)
    return (
      <Sheet
        title="Sofort löschen?"
        onClose={onClose}
        beschaeftigt={arbeitet}
        cancelLabel={null}
        knoepfe={
          <>
            <FensterKnopf art="zweit" disabled={arbeitet} onClick={() => setFrage(false)}>
              Zurück
            </FensterKnopf>
            <FensterKnopf art="gefahr" disabled={arbeitet} onClick={sichern}>
              {arbeitet
                ? 'Wird gelöscht …'
                : anzahl
                  ? `Jetzt ${anzahl === 1 ? 'eine Anmeldung' : `${anzahl} Anmeldungen`} löschen`
                  : 'Jetzt löschen'}
            </FensterKnopf>
          </>
        }
      >
        <p>
          Mit {zahl} {zahl === 1 ? 'Monat' : 'Monaten'} nach dem Ende liegt das Löschdatum (
          {datumText(datum!)}) <b>nicht in der Zukunft</b>. Beim Speichern entfernt ChurchTools{' '}
          <b>
            sofort{' '}
            {anzahl === 1
              ? 'die eine Anmeldung'
              : anzahl
                ? `alle ${anzahl} Anmeldungen`
                : 'alle Anmeldungen'}
          </b>{' '}
          mit allen Antworten, und die Anmeldung wird geschlossen. Das lässt sich nicht rückgängig
          machen.
        </p>
        <Fehler text={fehler} />
      </Sheet>
    );

  return (
    <Sheet
      title="Daten löschen"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={!gueltig || arbeitet}
          onClick={() => (sofort ? setFrage(true) : sichern())}
        >
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <label className={f.feld}>
        <span>Monate nach dem Ende (1–36)</span>
        <input
          className={f.eingabe}
          inputMode="numeric"
          value={wert}
          onChange={(ev) => setWert(ev.target.value.replace(/\D/g, ''))}
        />
      </label>
      <p className={f.hinweis}>
        {datum
          ? `Am ${datumText(datum)} entfernt ChurchTools alle Anmeldungen mit allen Angaben (auch Allergien). ${schlussVorLoeschenText(datum)}`
          : e.termin
            ? 'Danach entfernt ChurchTools alle Anmeldungen mit allen Angaben (auch Allergien).'
            : 'Ohne Termin gibt es kein Löschdatum – erst einen Termin wählen.'}
      </p>
      <Fehler text={fehler} />
    </Sheet>
  );
}
