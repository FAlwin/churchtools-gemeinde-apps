import { useId, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  berechnePreis,
  euroText,
  pruefeRegeln,
  type Altersregel,
  type Anpassung,
  type Extra,
  type Geltung,
  type Grundpreis,
  type PreisRegeln,
} from '@shared/anmeldung/preis';
import { aenderePreise } from './einrichten';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import { JE, alterText, anpassungText, centAus, euroEingabe, grundpreisText } from './anzeige';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import f from './Formular.module.scss';

/**
 * **Preise einer Veranstaltung** (A4) – die Karte „Preise“ mit ihren Bausteinen, je ein Fenster zum
 * Bearbeiten und „Probe rechnen“. Gerechnet wird überall mit `berechnePreis` aus `shared/anmeldung/preis.ts`,
 * derselben Funktion, die das öffentliche Formular nutzt – was „Probe rechnen“ zeigt, bekommt eine Familie.
 * Geprüft wird mit `pruefeRegeln`, im Fenster (sofort sichtbar) und beim Speichern (`aenderePreise`).
 */

/** Welches Preis-Fenster offen ist. `index: null` = neuer Baustein. */
export type PreisFenster =
  | { art: 'grund' }
  | { art: 'alter' }
  | { art: 'anpassung'; index: number | null }
  | { art: 'extra'; index: number | null }
  | { art: 'neu' };

function Baustein({
  nr,
  titel,
  text,
  onClick,
}: {
  nr: number;
  titel: string;
  text: string;
  onClick?: () => void;
}) {
  const inhalt = (
    <>
      <span className={v.nummer}>{nr}</span>
      <span className={v.bausteinText}>
        <b>{titel}</b>
        <small>{text}</small>
      </span>
      {onClick && <Icon name="chev-right" size={16} />}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" className={`${v.baustein} ${v.klickbar}`} onClick={onClick}>
          {inhalt}
        </button>
      ) : (
        <div className={v.baustein}>{inhalt}</div>
      )}
    </li>
  );
}

/**
 * **Die Karte „Preise“.** Ohne Recht zum Bearbeiten sind die Bausteine nur zu lesen. Gibt es Preise nach
 * Alter, wird aber kein Geburtsdatum abgefragt, sagt die Karte das – das Formular kennt dann kein Alter.
 */
export function PreiseKarte({
  preis,
  geburtsdatum,
  darf,
  onOeffnen,
  onGeburtsdatum,
}: {
  preis: PreisRegeln;
  geburtsdatum: boolean;
  darf: boolean;
  onOeffnen: (w: PreisFenster) => void;
  /** Zum Fenster „Wer meldet sich an?“, wo das Geburtsdatum eingeschaltet wird. */
  onGeburtsdatum: () => void;
}) {
  const auf = (w: PreisFenster) => (darf ? () => onOeffnen(w) : undefined);
  let nr = 0;
  const kindRabatt = preis.anpassungen.some((a) => a.bedingung === 'abKind');
  return (
    <section className={s.karte} aria-label="Preise">
      <div className={s.kopf}>
        <h2>Preise</h2>
      </div>
      <p className={v.reihenfolge}>
        Gerechnet wird in dieser Reihenfolge: Grundpreis → Alter → Rabatte und Zuschläge → Extras
      </p>
      {(preis.alter.length > 0 || kindRabatt) && !geburtsdatum && (
        <div className={v.warnung} role="alert">
          <p>
            {preis.alter.length > 0
              ? 'Es gibt Preise nach Alter'
              : 'Es gibt einen Geschwister-Rabatt'}
            , aber das Geburtsdatum wird nicht abgefragt. Ohne Alter zahlt jede Person den
            Grundpreis.
          </p>
          {darf && (
            <button type="button" className={v.bearbeiten} onClick={onGeburtsdatum}>
              Geburtsdatum abfragen
            </button>
          )}
        </div>
      )}
      <ul className={v.bausteine}>
        <Baustein
          nr={++nr}
          titel="Grundpreis"
          text={grundpreisText(preis.grundpreis)}
          onClick={auf({ art: 'grund' })}
        />
        {preis.alter.length > 0 && (
          <Baustein
            nr={++nr}
            titel="Nach Alter"
            text={alterText(preis.alter)}
            onClick={auf({ art: 'alter' })}
          />
        )}
        {preis.anpassungen.map((a, i) => (
          <Baustein
            key={`a${i}`}
            nr={++nr}
            titel={`${a.art === 'rabatt' ? 'Rabatt' : 'Zuschlag'}: ${a.bezeichnung}`}
            text={anpassungText(a)}
            onClick={auf({ art: 'anpassung', index: i })}
          />
        ))}
        {preis.extras.map((x, i) => (
          <Baustein
            key={`x${i}`}
            nr={++nr}
            titel={`Extra: ${x.bezeichnung}`}
            text={`+${euroText(x.preisCent)} ${JE[x.gilt]}, zum Ankreuzen im Formular`}
            onClick={auf({ art: 'extra', index: i })}
          />
        ))}
      </ul>
      {darf && (
        <div className={v.kartenFuss}>
          <button type="button" className={v.bearbeiten} onClick={() => onOeffnen({ art: 'neu' })}>
            + Baustein hinzufügen
          </button>
        </div>
      )}
    </section>
  );
}

// ── Fenster ─────────────────────────────────────────────────────────────────────────────────────

interface FensterProps {
  id: number;
  preis: PreisRegeln;
  geburtsdatum: boolean;
  /** Wie viele schon angemeldet sind (`null` = nicht bekannt). */
  anmeldungen: number | null;
  onClose: () => void;
  onGespeichert: () => void;
}

/** Alwin, 13.10.2026: Preise dürfen sich ändern – wer schon angemeldet ist, behält seinen Betrag. */
function AnmeldungenHinweis({ anzahl }: { anzahl: number | null }) {
  if (!anzahl) return null;
  return (
    <p className={f.hinweis} role="note">
      Es gibt schon {anzahl === 1 ? 'eine Anmeldung' : `${anzahl} Anmeldungen`}. Ihr Betrag bleibt,
      wie er ist – der neue Preis gilt nur für neue Anmeldungen.
    </p>
  );
}

/** Speichern und, wo es den Baustein schon gibt, „Baustein entfernen“ – mit den Prüf-Meldungen darüber. */
function Knoepfe({
  neu,
  fehler,
  speicherFehler,
  arbeitet,
  onSpeichern,
  onEntfernen,
}: {
  neu: PreisRegeln | null;
  fehler: string[];
  speicherFehler: string | null;
  arbeitet: boolean;
  onSpeichern: () => void;
  onEntfernen?: () => void;
}) {
  return (
    <>
      {fehler.map((t) => (
        <p key={t} className={f.fehler}>
          {t}
        </p>
      ))}
      <Fehler text={speicherFehler} />
      <button
        type="button"
        className={f.knopf}
        disabled={!neu || fehler.length > 0 || arbeitet}
        onClick={onSpeichern}
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
      {onEntfernen && (
        <button type="button" className={f.entfernen} disabled={arbeitet} onClick={onEntfernen}>
          Baustein entfernen
        </button>
      )}
    </>
  );
}

/**
 * Gemeinsamer Ablauf der Preis-Fenster: `aendern` baut aus den Preisen die neuen (oder `null`, solange
 * eine Eingabe kein Betrag ist). Geprüft wird an der Vorschau mit den Preisen dieser Seite; gespeichert
 * wird auf die frisch gelesenen (`aenderePreise`).
 */
function usePreisSpeichern(props: FensterProps, aendern: ((p: PreisRegeln) => PreisRegeln) | null) {
  const { arbeitet, fehler: speicherFehler, speichern } = useSpeichern(props.onGespeichert);
  const neu = aendern ? aendern(props.preis) : null;
  const fehler = neu ? pruefeRegeln(neu) : [];
  return {
    neu,
    fehler,
    speicherFehler,
    arbeitet,
    onSpeichern: () => aendern && speichern(() => aenderePreise(props.id, aendern)),
    entfernen: (weg: (p: PreisRegeln) => PreisRegeln) =>
      speichern(() => aenderePreise(props.id, weg)),
  };
}

/** Ein Euro-Feld: Text rein, Cent raus – mit Hinweis, wenn es kein Betrag ist. */
function EuroFeld({
  label,
  wert,
  onChange,
}: {
  label: string;
  wert: string;
  onChange: (t: string) => void;
}) {
  const ungueltig = centAus(wert) === null;
  const hinweisId = useId();
  return (
    <label className={f.feld}>
      <span>{label}</span>
      <input
        className={f.eingabe}
        inputMode="decimal"
        value={wert}
        aria-label={label}
        aria-invalid={ungueltig}
        aria-describedby={ungueltig ? hinweisId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {ungueltig && (
        <small id={hinweisId} className={f.fehler}>
          Bitte einen Betrag eintragen, z. B. 12,50.
        </small>
      )}
    </label>
  );
}

/** Ganze Prozent aus einem Eingabefeld; `null`, wenn es keine ist. */
const prozentAus = (t: string) => (/^\d{1,4}$/.test(t.trim()) ? Number(t.trim()) : null);

/** Ein Prozent-Feld – wie `EuroFeld` mit Hinweis, wenn es keine ganze Zahl ist (z. B. nach dem Wechsel von €). */
function ProzentFeld({
  label,
  wert,
  onChange,
}: {
  label: string;
  wert: string;
  onChange: (t: string) => void;
}) {
  const ungueltig = prozentAus(wert) === null;
  const hinweisId = useId();
  return (
    <label className={f.feld}>
      <span>{label}</span>
      <input
        className={f.eingabe}
        inputMode="numeric"
        value={wert}
        aria-label={label}
        aria-invalid={ungueltig}
        aria-describedby={ungueltig ? hinweisId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {ungueltig && (
        <small id={hinweisId} className={f.fehler}>
          Bitte eine ganze Zahl eintragen, z. B. 50.
        </small>
      )}
    </label>
  );
}

function GeltungWahl({
  wert,
  onChange,
  label = 'Gilt',
}: {
  wert: Geltung;
  onChange: (g: Geltung) => void;
  label?: string;
}) {
  return (
    <div className={f.feld}>
      <span>{label}</span>
      <Segment
        ariaLabel={label}
        value={wert}
        onChange={onChange}
        options={[
          { value: 'person', label: 'pro Person' },
          { value: 'anmeldung', label: 'pro Anmeldung' },
        ]}
      />
    </div>
  );
}

interface OptionEntwurf {
  name: string;
  preis: string;
  kontingent: string;
  belegt: number;
}

function GrundpreisFenster(props: FensterProps) {
  const g = props.preis.grundpreis;
  const [art, setArt] = useState(g.art);
  const [betrag, setBetrag] = useState(euroEingabe(g.betragCent));
  const [gilt, setGilt] = useState(g.gilt);
  const [auswahlName, setAuswahlName] = useState(g.auswahlName);
  const [optionen, setOptionen] = useState<OptionEntwurf[]>(
    g.optionen.length
      ? g.optionen.map((o) => ({
          name: o.name,
          preis: euroEingabe(o.preisCent),
          kontingent: o.kontingent ? String(o.kontingent) : '',
          belegt: o.belegt,
        }))
      : [{ name: '', preis: '0', kontingent: '', belegt: 0 }],
  );

  const setOption = (i: number, o: Partial<OptionEntwurf>) =>
    setOptionen(optionen.map((x, j) => (i === j ? { ...x, ...o } : x)));

  const betragCent = centAus(betrag);
  const optionenCent = optionen.map((o) => centAus(o.preis));
  const lesbar = art === 'fest' ? betragCent !== null : optionenCent.every((c) => c !== null);
  const grund: Grundpreis = {
    art,
    betragCent: art === 'fest' ? (betragCent ?? 0) : 0,
    gilt: art === 'fest' ? gilt : 'person',
    auswahlName: art === 'auswahl' ? auswahlName.trim() : '',
    optionen:
      art === 'auswahl'
        ? optionen.map((o, i) => ({
            name: o.name.trim(),
            preisCent: optionenCent[i] ?? 0,
            kontingent: Number(o.kontingent) || 0,
            belegt: o.belegt,
          }))
        : [],
  };
  const sp = usePreisSpeichern(props, lesbar ? (p) => ({ ...p, grundpreis: grund }) : null);

  return (
    <Sheet title="Grundpreis" onClose={props.onClose}>
      <AnmeldungenHinweis anzahl={props.anmeldungen} />
      <div className={f.feld}>
        <span>Art</span>
        <Segment
          ariaLabel="Art des Grundpreises"
          value={art}
          onChange={setArt}
          options={[
            { value: 'fest', label: 'Fester Preis' },
            { value: 'auswahl', label: 'Nach Auswahl' },
          ]}
        />
      </div>
      {art === 'fest' ? (
        <>
          <EuroFeld label="Betrag in Euro (0 = kostenlos)" wert={betrag} onChange={setBetrag} />
          <GeltungWahl wert={gilt} onChange={setGilt} />
        </>
      ) : (
        <>
          <label className={f.feld}>
            <span>Was wird ausgewählt?</span>
            <input
              className={f.eingabe}
              value={auswahlName}
              maxLength={60}
              placeholder="z. B. Zimmertyp"
              onChange={(e) => setAuswahlName(e.target.value)}
            />
          </label>
          <div className={f.feld}>
            <span>Optionen (Preis pro Person)</span>
            <ul className={f.optionen}>
              {optionen.map((o, i) => (
                <li key={i} className={f.optionKasten}>
                  <div className={f.zeile}>
                    <input
                      className={f.eingabe}
                      value={o.name}
                      maxLength={80}
                      placeholder="z. B. 4-Bett-Zimmer"
                      aria-label={`Name der Option ${i + 1}`}
                      onChange={(e) => setOption(i, { name: e.target.value })}
                    />
                    {optionen.length > 1 && (
                      <button
                        type="button"
                        className={f.klein}
                        aria-label={`Option ${i + 1} entfernen`}
                        onClick={() => setOptionen(optionen.filter((_, j) => j !== i))}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    )}
                  </div>
                  <div className={f.zeile}>
                    <EuroFeld
                      label="Preis €"
                      wert={o.preis}
                      onChange={(t) => setOption(i, { preis: t })}
                    />
                    <label className={f.feld}>
                      <span>Kontingent</span>
                      <input
                        className={f.eingabe}
                        inputMode="numeric"
                        placeholder="unbegrenzt"
                        value={o.kontingent}
                        onChange={(e) =>
                          setOption(i, { kontingent: e.target.value.replace(/\D/g, '') })
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={v.bearbeiten}
              onClick={() =>
                setOptionen([...optionen, { name: '', preis: '0', kontingent: '', belegt: 0 }])
              }
            >
              + Option
            </button>
          </div>
          <p className={f.hinweis}>
            Kontingent: wie oft die Option gebucht werden kann, z. B. 6 Zweibettzimmer. Ist es
            aufgebraucht, geht die Anmeldung auf die Warteliste.
          </p>
        </>
      )}
      <Knoepfe {...sp} />
    </Sheet>
  );
}

interface AlterEntwurf {
  von: string;
  bis: string;
  art: Altersregel['art'];
  wert: string;
}

function AlterFenster(props: FensterProps) {
  const [regeln, setRegeln] = useState<AlterEntwurf[]>(
    props.preis.alter.length
      ? props.preis.alter.map((r) => ({
          von: String(r.von),
          bis: r.bis === null ? '' : String(r.bis),
          art: r.art,
          wert: r.art === 'fest' ? euroEingabe(r.wert) : String(r.wert),
        }))
      : [{ von: '0', bis: '2', art: 'frei', wert: '0' }],
  );
  const setRegel = (i: number, r: Partial<AlterEntwurf>) =>
    setRegeln(regeln.map((x, j) => (i === j ? { ...x, ...r } : x)));

  const gebaut = regeln.map((r) => {
    const wert = r.art === 'fest' ? centAus(r.wert) : r.art === 'prozent' ? prozentAus(r.wert) : 0;
    return { von: Number(r.von) || 0, bis: r.bis === '' ? null : Number(r.bis), art: r.art, wert };
  });
  const lesbar = gebaut.every((r) => r.wert !== null);
  const alter = gebaut.map((r) => ({ ...r, wert: r.wert ?? 0 })).sort((a, b) => a.von - b.von);
  const sp = usePreisSpeichern(props, lesbar ? (p) => ({ ...p, alter }) : null);

  return (
    <Sheet title="Preis nach Alter" onClose={props.onClose}>
      <AnmeldungenHinweis anzahl={props.anmeldungen} />
      <p className={f.hinweis}>
        Gezählt wird das Alter am ersten Tag der Veranstaltung. Wer in keine Altersgruppe fällt,
        zahlt den Grundpreis.
      </p>
      {!props.geburtsdatum && (
        <p className={f.fehler}>
          Das Geburtsdatum wird noch nicht abgefragt – einschalten unter „Wer meldet sich an?“.
        </p>
      )}
      <ul className={f.optionen}>
        {regeln.map((r, i) => (
          <li key={i} className={f.optionKasten}>
            <div className={f.zeile}>
              <label className={f.feld}>
                <span>von Jahren</span>
                <input
                  className={f.eingabe}
                  inputMode="numeric"
                  value={r.von}
                  onChange={(e) => setRegel(i, { von: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <label className={f.feld}>
                <span>bis Jahren</span>
                <input
                  className={f.eingabe}
                  inputMode="numeric"
                  placeholder="und älter"
                  value={r.bis}
                  onChange={(e) => setRegel(i, { bis: e.target.value.replace(/\D/g, '') })}
                />
              </label>
            </div>
            <div className={f.zeile}>
              <label className={f.feld}>
                <span>Preis</span>
                <select
                  className={f.eingabe}
                  value={r.art}
                  onChange={(e) => setRegel(i, { art: e.target.value as Altersregel['art'] })}
                >
                  <option value="frei">frei</option>
                  <option value="prozent">Prozent vom Grundpreis</option>
                  <option value="fest">fester Preis</option>
                </select>
              </label>
              {r.art === 'prozent' && (
                <ProzentFeld
                  label="Prozent"
                  wert={r.wert}
                  onChange={(t) => setRegel(i, { wert: t })}
                />
              )}
              {r.art === 'fest' && (
                <EuroFeld label="Euro" wert={r.wert} onChange={(t) => setRegel(i, { wert: t })} />
              )}
            </div>
            {regeln.length > 1 && (
              <button
                type="button"
                className={f.textKnopf}
                onClick={() => setRegeln(regeln.filter((_, j) => j !== i))}
              >
                Altersgruppe entfernen
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={v.bearbeiten}
        style={{ marginBottom: 14 }}
        onClick={() => setRegeln([...regeln, { von: '', bis: '', art: 'prozent', wert: '50' }])}
      >
        + Altersgruppe
      </button>
      <Knoepfe
        {...sp}
        onEntfernen={
          props.preis.alter.length ? () => sp.entfernen((p) => ({ ...p, alter: [] })) : undefined
        }
      />
    </Sheet>
  );
}

const NEUE_ANPASSUNG: Anpassung = {
  art: 'rabatt',
  bezeichnung: '',
  bedingung: 'immer',
  bis: '',
  abKind: 2,
  einheit: 'euro',
  wert: 0,
  gilt: 'person',
};

function AnpassungFenster(props: FensterProps & { index: number | null }) {
  const alt = props.index === null ? NEUE_ANPASSUNG : props.preis.anpassungen[props.index];
  const [a, setA] = useState(alt);
  const [wert, setWert] = useState(
    alt.einheit === 'euro' ? euroEingabe(alt.wert) : String(alt.wert),
  );
  const zahl = a.einheit === 'euro' ? centAus(wert) : prozentAus(wert);
  const neu: Anpassung = { ...a, bezeichnung: a.bezeichnung.trim(), wert: zahl ?? 0 };
  const sp = usePreisSpeichern(
    props,
    zahl === null
      ? null
      : (p) => ({
          ...p,
          anpassungen:
            props.index === null
              ? [...p.anpassungen, neu]
              : p.anpassungen.map((x, i) => (i === props.index ? neu : x)),
        }),
  );
  const titel = a.art === 'rabatt' ? 'Rabatt' : 'Zuschlag';
  return (
    <Sheet title={titel} onClose={props.onClose}>
      <AnmeldungenHinweis anzahl={props.anmeldungen} />
      <div className={f.feld}>
        <Segment
          ariaLabel="Rabatt oder Zuschlag"
          value={a.art}
          onChange={(art) => setA({ ...a, art })}
          options={[
            { value: 'rabatt', label: 'Rabatt' },
            { value: 'zuschlag', label: 'Zuschlag' },
          ]}
        />
      </div>
      <label className={f.feld}>
        <span>Bezeichnung (steht so in der Mail)</span>
        <input
          className={f.eingabe}
          value={a.bezeichnung}
          maxLength={80}
          placeholder={a.art === 'rabatt' ? 'z. B. Frühbucher' : 'z. B. Einzelzimmer'}
          onChange={(e) => setA({ ...a, bezeichnung: e.target.value })}
        />
      </label>
      <label className={f.feld}>
        <span>Wann gilt er?</span>
        <select
          className={f.eingabe}
          value={a.bedingung}
          onChange={(e) => setA({ ...a, bedingung: e.target.value as Anpassung['bedingung'] })}
        >
          <option value="immer">immer</option>
          <option value="fruehbucher">bei Anmeldung bis zu einem Datum</option>
          <option value="abKind">ab einem bestimmten Kind (Geschwister)</option>
        </select>
      </label>
      {a.bedingung === 'fruehbucher' && (
        <label className={f.feld}>
          <span>Anmeldung bis (einschließlich)</span>
          <input
            type="date"
            className={f.eingabe}
            value={a.bis}
            onChange={(e) => setA({ ...a, bis: e.target.value })}
          />
        </label>
      )}
      {a.bedingung === 'abKind' && (
        <>
          <label className={f.feld}>
            <span>Ab dem wievielten Kind? (gezählt vom ältesten)</span>
            <input
              className={f.eingabe}
              inputMode="numeric"
              value={String(a.abKind)}
              onChange={(e) => setA({ ...a, abKind: Number(e.target.value.replace(/\D/g, '')) })}
            />
          </label>
          {!props.geburtsdatum && (
            <p className={f.fehler}>
              Kinder erkennt das Formular am Geburtsdatum – das wird noch nicht abgefragt.
            </p>
          )}
        </>
      )}
      <div className={f.zeile}>
        {a.einheit === 'euro' ? (
          <EuroFeld label="Höhe" wert={wert} onChange={setWert} />
        ) : (
          <ProzentFeld label="Höhe" wert={wert} onChange={setWert} />
        )}
        <div className={f.feld}>
          <span>in</span>
          <Segment
            ariaLabel="Einheit"
            value={a.einheit}
            onChange={(einheit) => setA({ ...a, einheit })}
            options={[
              { value: 'euro', label: '€' },
              { value: 'prozent', label: '%' },
            ]}
          />
        </div>
      </div>
      <GeltungWahl wert={a.gilt} onChange={(gilt) => setA({ ...a, gilt })} />
      <Knoepfe
        {...sp}
        onEntfernen={
          props.index === null
            ? undefined
            : () =>
                sp.entfernen((p) => ({
                  ...p,
                  anpassungen: p.anpassungen.filter((_, i) => i !== props.index),
                }))
        }
      />
    </Sheet>
  );
}

function ExtraFenster(props: FensterProps & { index: number | null }) {
  const alt: Extra =
    props.index === null
      ? { bezeichnung: '', preisCent: 0, gilt: 'person' }
      : props.preis.extras[props.index];
  const [bezeichnung, setBezeichnung] = useState(alt.bezeichnung);
  const [preis, setPreis] = useState(euroEingabe(alt.preisCent));
  const [gilt, setGilt] = useState(alt.gilt);
  const cent = centAus(preis);
  const neu: Extra = { bezeichnung: bezeichnung.trim(), preisCent: cent ?? 0, gilt };
  const sp = usePreisSpeichern(
    props,
    cent === null
      ? null
      : (p) => ({
          ...p,
          extras:
            props.index === null
              ? [...p.extras, neu]
              : p.extras.map((x, i) => (i === props.index ? neu : x)),
        }),
  );
  return (
    <Sheet title="Extra zum Ankreuzen" onClose={props.onClose}>
      <AnmeldungenHinweis anzahl={props.anmeldungen} />
      <p className={f.hinweis}>Die Teilnehmenden kreuzen es im Formular selbst an.</p>
      <label className={f.feld}>
        <span>Bezeichnung</span>
        <input
          className={f.eingabe}
          value={bezeichnung}
          maxLength={80}
          placeholder="z. B. Bettwäsche leihen"
          onChange={(e) => setBezeichnung(e.target.value)}
        />
      </label>
      <EuroFeld label="Preis in Euro" wert={preis} onChange={setPreis} />
      <GeltungWahl wert={gilt} onChange={setGilt} />
      <Knoepfe
        {...sp}
        onEntfernen={
          props.index === null
            ? undefined
            : () =>
                sp.entfernen((p) => ({
                  ...p,
                  extras: p.extras.filter((_, i) => i !== props.index),
                }))
        }
      />
    </Sheet>
  );
}

function NeuerBaustein({
  preis,
  onClose,
  onWahl,
}: {
  preis: PreisRegeln;
  onClose: () => void;
  onWahl: (w: PreisFenster) => void;
}) {
  const hatAlter = preis.alter.length > 0;
  return (
    <Sheet title="Baustein hinzufügen" onClose={onClose}>
      <div className={f.optionen} style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={f.option}
          disabled={hatAlter}
          onClick={() => onWahl({ art: 'alter' })}
        >
          Nach Alter
          <small>
            {hatAlter
              ? 'Gibt es schon – in der Karte bearbeiten.'
              : 'z. B. unter 3 frei, 3–11 Jahre die Hälfte'}
          </small>
        </button>
        <button
          type="button"
          className={f.option}
          onClick={() => onWahl({ art: 'anpassung', index: null })}
        >
          Rabatt oder Zuschlag
          <small>Frühbucher, Geschwister, Einzelzimmer …</small>
        </button>
        <button
          type="button"
          className={f.option}
          onClick={() => onWahl({ art: 'extra', index: null })}
        >
          Extra zum Ankreuzen
          <small>z. B. Bettwäsche, Kanu, T-Shirt</small>
        </button>
      </div>
      <p className={f.hinweis}>
        Den Grundpreis gibt es immer genau einmal. Ob fest oder nach Auswahl, stellst du dort ein.
      </p>
    </Sheet>
  );
}

/** Das offene Preis-Fenster. */
export function PreisFensterZeigen(
  props: FensterProps & { fenster: PreisFenster; onWechsel: (w: PreisFenster) => void },
) {
  const w = props.fenster;
  if (w.art === 'grund') return <GrundpreisFenster {...props} />;
  if (w.art === 'alter') return <AlterFenster {...props} />;
  if (w.art === 'anpassung') return <AnpassungFenster {...props} index={w.index} />;
  if (w.art === 'extra') return <ExtraFenster {...props} index={w.index} />;
  return <NeuerBaustein preis={props.preis} onClose={props.onClose} onWahl={props.onWechsel} />;
}

// ── Probe rechnen ───────────────────────────────────────────────────────────────────────────────

const BEISPIEL: Record<OeffentlicheEinstellungen['wer'], string[]> = {
  familie: ['38', '36', '9', '6'],
  einzeln: ['30'],
  kinder: ['9', '6'],
};

/**
 * **Probe rechnen** – eine Beispiel-Anmeldung durch `berechnePreis`. Nur zum Ausprobieren, nichts wird
 * gespeichert; alle dürfen es. Ohne Geburtsdatum rechnet es wie das Formular: ohne Alter.
 */
export function ProbeRechnen({
  preis,
  wer,
  geburtsdatum,
  heute,
}: {
  preis: PreisRegeln;
  wer: OeffentlicheEinstellungen['wer'];
  geburtsdatum: boolean;
  heute: string;
}) {
  const [alter, setAlter] = useState<string[]>(BEISPIEL[wer]);
  const [option, setOption] = useState(0);
  const [am, setAm] = useState(heute);
  const [extras, setExtras] = useState<boolean[]>([]);

  const g = preis.grundpreis;
  const gewaehlt = Math.min(option, Math.max(0, g.optionen.length - 1));
  const angekreuzt = preis.extras.map((_, i) => extras[i] ?? true);
  const ergebnis = berechnePreis(preis, {
    alter: alter.map((a) => (geburtsdatum && a !== '' ? Number(a) : null)),
    option: gewaehlt,
    angemeldetAm: am || heute,
    extras: angekreuzt,
  });
  const fruehbucher = preis.anpassungen.some((a) => a.bedingung === 'fruehbucher');
  const mehrere = wer !== 'einzeln';

  return (
    <section className={s.karte} aria-label="Probe rechnen">
      <div className={s.kopf}>
        <h2>Probe rechnen</h2>
      </div>
      <div className={v.probe}>
        <p className={f.hinweis}>
          So rechnet das Formular für eine Beispiel-Anmeldung. Gespeichert wird hier nichts.
        </p>
        <div className={f.feld}>
          <span>{geburtsdatum ? 'Personen und Alter' : 'Personen'}</span>
          {geburtsdatum ? (
            <div className={v.personen}>
              {alter.map((a, i) => (
                <span key={i} className={v.person}>
                  <input
                    className={f.eingabe}
                    inputMode="numeric"
                    aria-label={`Alter Person ${i + 1}`}
                    value={a}
                    onChange={(e) =>
                      setAlter(
                        alter.map((x, j) => (i === j ? e.target.value.replace(/\D/g, '') : x)),
                      )
                    }
                  />
                  J.
                  {alter.length > 1 && (
                    <button
                      type="button"
                      className={f.klein}
                      aria-label={`Person ${i + 1} entfernen`}
                      onClick={() => setAlter(alter.filter((_, j) => j !== i))}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </span>
              ))}
              {mehrere && (
                <button
                  type="button"
                  className={v.bearbeiten}
                  onClick={() => setAlter([...alter, '10'])}
                >
                  + Person
                </button>
              )}
            </div>
          ) : (
            <div className={v.personen}>
              <span>{alter.length === 1 ? '1 Person' : `${alter.length} Personen`}</span>
              {mehrere && (
                <>
                  <button
                    type="button"
                    className={v.bearbeiten}
                    disabled={alter.length <= 1}
                    onClick={() => setAlter(alter.slice(0, -1))}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={v.bearbeiten}
                    onClick={() => setAlter([...alter, ''])}
                  >
                    +
                  </button>
                </>
              )}
            </div>
          )}
          {!geburtsdatum && (
            <small className={f.hinweis}>
              Ohne Geburtsdatum kennt das Formular kein Alter – jede Person zahlt den Grundpreis.
            </small>
          )}
        </div>
        {g.art === 'auswahl' && g.optionen.length > 0 && (
          <label className={f.feld}>
            <span>{g.auswahlName}</span>
            <select
              className={f.eingabe}
              value={gewaehlt}
              onChange={(e) => setOption(Number(e.target.value))}
            >
              {g.optionen.map((o, i) => (
                <option key={i} value={i}>
                  {o.name} · {euroText(o.preisCent)}
                </option>
              ))}
            </select>
          </label>
        )}
        {fruehbucher && (
          <label className={f.feld}>
            <span>Angemeldet am</span>
            <input
              type="date"
              className={f.eingabe}
              value={am}
              onChange={(e) => setAm(e.target.value)}
            />
          </label>
        )}
        {preis.extras.map((x, i) => (
          <label key={i} className={v.ankreuzen}>
            <input
              type="checkbox"
              checked={angekreuzt[i]}
              onChange={(e) =>
                setExtras(angekreuzt.map((c, j) => (i === j ? e.target.checked : c)))
              }
            />
            {x.bezeichnung} (+{euroText(x.preisCent)}
            {x.gilt === 'person' ? ' pro Person' : ''})
          </label>
        ))}
      </div>
      <ul className={v.posten} aria-label="Aufschlüsselung">
        {ergebnis.posten.map((p, i) => (
          <li key={i} className={p.betragCent === null ? v.postenAus : undefined}>
            <span>
              <b>{p.text}</b>
              {p.hinweis && <small>{p.hinweis}</small>}
            </span>
            <span>
              {p.betragCent === null
                ? '–'
                : p.betragCent < 0
                  ? `−${euroText(-p.betragCent)}`
                  : euroText(p.betragCent)}
            </span>
          </li>
        ))}
        <li className={v.gesamt}>
          <span>Gesamt</span>
          <span>{euroText(ergebnis.gesamtCent)}</span>
        </li>
      </ul>
      {ergebnis.ausgebucht && (
        <p className={v.warnung} role="alert">
          Diese Auswahl ist ausgebucht – die Anmeldung käme auf die Warteliste.
        </p>
      )}
    </section>
  );
}
