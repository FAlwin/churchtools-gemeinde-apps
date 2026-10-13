import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import { ctBasis } from '@ui/ct/basis';
import { tagAusIso } from '@shared/ct/zeit';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
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
  termineIn,
  type AnmeldeEinstellungen,
  type Kalender,
} from './einrichten';
import { WER_TEXT, datumText } from './anzeige';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **Die Fenster zum Einrichten einer Veranstaltung** (A3, #486). Jedes speichert über `einrichten.ts`
 * – dort wird nachgelesen –, meldet Fehler im Fenster und schließt erst, wenn ChurchTools übernommen hat.
 */

/** Gemeinsamer Ablauf: speichern, bei Erfolg schließen, sonst die Meldung zeigen. */
function useSpeichern(onGespeichert: () => void) {
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  async function speichern(tun: () => Promise<unknown>) {
    setArbeitet(true);
    setFehler(null);
    try {
      await tun();
      onGespeichert();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }
  return { arbeitet, fehler, speichern };
}

function Fehler({ text }: { text: string | null }) {
  return text ? (
    <p className={f.fehler} role="alert">
      {text}
    </p>
  ) : null;
}

/** Den Link zur Anmeldung in die Zwischenablage – geht das nicht (alter Browser), steht er zum Markieren da. */
function LinkKopieren({ link }: { link: string }) {
  const [stand, setStand] = useState<'bereit' | 'kopiert' | 'zeigen'>('bereit');
  if (stand === 'zeigen') {
    return <input className={f.eingabe} readOnly value={link} onFocus={(e) => e.target.select()} />;
  }
  return (
    <button
      type="button"
      className={f.option}
      onClick={() =>
        navigator.clipboard.writeText(link).then(
          () => setStand('kopiert'),
          () => setStand('zeigen'),
        )
      }
    >
      {stand === 'kopiert' ? 'Link kopiert' : 'Link zur Anmeldung kopieren'}
    </button>
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
  onClose,
  onGespeichert,
}: {
  id: number;
  name: string;
  /** Der bisherige Termin – „Neu anlegen“ beginnt mit seinen Angaben. */
  termin: OeffentlicheEinstellungen['termin'];
  zeitzone: string;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const heute = tagAusIso(new Date().toISOString(), zeitzone);
  const [art, setArt] = useState<'vorhanden' | 'neu'>('vorhanden');
  const [kalender, setKalender] = useState<Kalender[] | null>(null);
  const [kalenderId, setKalenderId] = useState<number | null>(null);
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
    <Sheet title="Termin" onClose={onClose}>
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
                const k = terminAusCt(t, zeitzone);
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
          <LinkKopieren link={anmeldeLink(ctBasis(), id)} />
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
          <button
            type="button"
            className={f.knopf}
            disabled={!neuBereit || arbeitet}
            onClick={() =>
              speichern(async () => {
                const termin = await legeTerminAn({
                  kalenderId: kalenderId,
                  titel: neu.titel.trim(),
                  beginn: `${neu.tag}T${neu.von}`,
                  ende: `${neu.bisTag || neu.tag}T${neu.bis}`,
                  ort: neu.ort.trim(),
                  gruppeId: id,
                  zeitzone,
                });
                await aendereEinstellungen(id, (e) => ({
                  ...e,
                  termin: terminAusCt(termin, zeitzone),
                }));
              })
            }
          >
            {arbeitet ? 'Wird angelegt …' : 'Termin anlegen und übernehmen'}
          </button>
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
  zeitzone,
  onClose,
  onGespeichert,
}: {
  id: number;
  anmeldung: AnmeldeEinstellungen;
  plaetze: OeffentlicheEinstellungen['plaetze'];
  zeitzone: string;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const tagVon = (iso: string | null) => (iso ? ortszeitAus(iso, zeitzone).slice(0, 10) : '');
  const [ab, setAb] = useState(tagVon(anmeldung.ab));
  const [bis, setBis] = useState(tagVon(anmeldung.bis));
  const [max, setMax] = useState(anmeldung.maxPlaetze === null ? '' : String(anmeldung.maxPlaetze));
  const [warteliste, setWarteliste] = useState(anmeldung.warteliste);
  const [zeigen, setZeigen] = useState(plaetze.zeigen);
  const [knapp, setKnapp] = useState(String(plaetze.knappUnter));
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);

  const maxZahl = max.trim() === '' ? null : Number(max);
  const gueltig =
    (maxZahl === null || (Number.isInteger(maxZahl) && maxZahl > 0)) &&
    (!ab || !bis || ab <= bis) &&
    Number.isInteger(Number(knapp)) &&
    Number(knapp) > 0;

  return (
    <Sheet title="Anmeldung" onClose={onClose}>
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
            onChange={(e) => setBis(e.target.value)}
          />
        </label>
      </div>
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
      <Fehler text={fehler} />
      <button
        type="button"
        className={f.knopf}
        disabled={!gueltig || arbeitet}
        onClick={() =>
          speichern(async () => {
            await speichereAnmeldung(id, {
              maxPlaetze: maxZahl,
              warteliste,
              ab: ab ? utcAus(`${ab}T00:00`, zeitzone) : null,
              bis: bis ? utcAus(`${bis}T23:59`, zeitzone) : null,
            });
            await aendereEinstellungen(id, (e) => ({
              ...e,
              plaetze: { zeigen, knappUnter: Number(knapp) },
            }));
          })
        }
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
    </Sheet>
  );
}

// ── Wer meldet sich an, Löschfrist ──────────────────────────────────────────────────────────────

export function WerFenster({
  id,
  wer,
  onClose,
  onGespeichert,
}: {
  id: number;
  wer: OeffentlicheEinstellungen['wer'];
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const [wahl, setWahl] = useState(wer);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);
  return (
    <Sheet title="Wer meldet sich an?" onClose={onClose}>
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
      <Fehler text={fehler} />
      <button
        type="button"
        className={f.knopf}
        disabled={arbeitet}
        onClick={() => speichern(() => aendereEinstellungen(id, (e) => ({ ...e, wer: wahl })))}
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
    </Sheet>
  );
}

export function LoeschfristFenster({
  id,
  monate,
  onClose,
  onGespeichert,
}: {
  id: number;
  monate: number;
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const [wert, setWert] = useState(String(monate));
  const zahl = Number(wert);
  const gueltig = Number.isInteger(zahl) && zahl >= 1 && zahl <= 36;
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);
  return (
    <Sheet title="Daten löschen" onClose={onClose}>
      <label className={f.feld}>
        <span>Monate nach dem Ende (1–36)</span>
        <input
          className={f.eingabe}
          inputMode="numeric"
          value={wert}
          onChange={(e) => setWert(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <p className={f.hinweis}>
        Danach werden die Anmeldungen mit allen Angaben (auch Allergien) aus ChurchTools entfernt.
        Das Löschen selbst richtet ein späterer Schritt als ChurchTools-Routine ein.
      </p>
      <Fehler text={fehler} />
      <button
        type="button"
        className={f.knopf}
        disabled={!gueltig || arbeitet}
        onClick={() =>
          speichern(() => aendereEinstellungen(id, (e) => ({ ...e, loeschfristMonate: zahl })))
        }
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
    </Sheet>
  );
}
