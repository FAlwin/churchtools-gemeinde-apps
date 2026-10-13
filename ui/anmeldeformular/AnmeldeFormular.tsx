import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  alterAm,
  geburtsdatumAn,
  nurText,
  pruefeAntworten,
  type Antwort,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { amEnde } from '@shared/anmeldung/baukasten';
import { berechnePreis, euroText, kannEtwasKosten, preisKurz } from '@shared/anmeldung/preis';
import { leereAntworten, textAufFarbe } from './daten';
import s from './AnmeldeFormular.module.scss';

/**
 * **Das Anmeldeformular, wie Gäste es sehen** (A5) – EINE Darstellung für den Baukasten in der Erweiterung
 * (dort mit `baukasten`: Felder auswählen, ziehen, direkt bearbeiten), die Vorschau und das öffentliche
 * Formular (A6). Rechnet mit `berechnePreis` und prüft mit
 * `pruefeAntworten` – dieselben Regeln wie die Nachprüfung. Aussehen nach Vorlage, Farbe, Feldstil, Knöpfen
 * (`AnmeldeFormular.module.scss`, aus dem Entwurf vom 09.10.2026).
 */

export interface Ansicht {
  name: string;
  gemeinde: string | null;
  einstellungen: OeffentlicheEinstellungen;
  /** Titelbild (Gruppenbild in ChurchTools), sonst das Bild der Vorlage. */
  bildUrl?: string | null;
  /** Freie Plätze, falls bekannt – angezeigt nach `plaetze.zeigen`. */
  freiePlaetze?: number | null;
  /** Letzter Anmeldetag, `YYYY-MM-DD`. */
  anmeldeschluss?: string | null;
}

/**
 * **Haken für den Baukasten** – damit der Baukasten genau dieses Formular zeigt und nur drumherum eingreift:
 * eine Hülle um jedes Feld (auswählen, ziehen, direkt bearbeiten) und Titel, Begrüßung und Titelbild zum
 * Bearbeiten im Kopf. Mit Haken zeigt das Formular nur eine Person und schickt nichts ab. (Eigene
 * Ablegestellen am Ende der Bereiche gab es kurz – sie erschienen erst beim Ziehen und schoben das Formular
 * unter dem Mauszeiger weg; abgelegt wird deshalb nur auf den Feldern selbst, obere oder untere Hälfte.)
 */
export interface BaukastenHaken {
  feld: (f: Feld, bereich: 'anmeldung' | 'person', inhalt: ReactNode) => ReactNode;
  titel?: ReactNode;
  einleitung?: ReactNode;
  bild?: ReactNode;
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function datumText(tag: string): string {
  const d = new Date(`${tag}T00:00:00Z`);
  return `${WOCHENTAG[d.getUTCDay()]}, ${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;
}

/** Löschdatum: Ende (sonst Beginn) der Veranstaltung plus Löschfrist. */
function loeschTag(e: OeffentlicheEinstellungen): string | null {
  const t = e.termin;
  if (!t) return null;
  const ende = (t.ende ?? t.beginn).slice(0, 10);
  const d = new Date(`${ende}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + e.loeschfristMonate);
  return d.toISOString().slice(0, 10);
}

function Pflicht({ f }: { f: Feld }) {
  if (f.zustand === 'pflicht')
    return (
      <span className={s.req} aria-hidden="true">
        *
      </span>
    );
  if (f.zustand === 'freiwillig' && !nurText(f.typ))
    return <span className={s.opt}> (freiwillig)</span>;
  return null;
}

/**
 * **Ein Feld, wie Gäste es sehen.** Auch einzeln nutzbar (der Baukasten zeigt jedes Feld so, gesperrt).
 * `fehler`: Schlüssel aus `pruefeAntworten`, die zu diesem Feld gehören.
 */
export function FeldEingabe({
  feld,
  wert,
  onWert,
  pfad,
  fehler = [],
  gesperrt = false,
  loeschtag = null,
}: {
  feld: Feld;
  wert: Antwort;
  onWert: (w: Antwort) => void;
  /** Eindeutige Kennung für `id`/`name` (z. B. `p1-birth`). */
  pfad: string;
  fehler?: string[];
  gesperrt?: boolean;
  loeschtag?: string | null;
}) {
  const f = feld;
  const hatFehler = (unter = '') => fehler.includes(unter ? `${pfad}.${unter}` : pfad);
  const fehlerText = (text: string, unter = '') =>
    hatFehler(unter) ? <span className={s.err}>{text}</span> : null;
  const hilfe = f.hilfe ? <span className={s.help}>{f.hilfe}</span> : null;
  const id = `af-${pfad}`;

  if (f.typ === 'ueberschrift')
    return (
      <div className={`${s.pf} ${s.zwischen}`}>
        <h3>{f.frage}</h3>
        {f.hilfe && <span className={s.help}>{f.hilfe}</span>}
      </div>
    );
  if (f.typ === 'trenner') return <hr className={s.trenner} />;

  if (f.typ === 'info')
    return (
      <div className={`${s.pf} ${s.infofield}`}>
        <b>{f.frage}</b>
        {f.hilfe && <span>{f.hilfe}</span>}
      </div>
    );

  if (f.typ === 'name') {
    const n = (wert ?? {}) as { vor?: string; nach?: string };
    return (
      <div className={s.g2}>
        {(['vor', 'nach'] as const).map((teil) => (
          <div key={teil} className={`${s.pf} ${hatFehler(teil) ? s.bad : ''}`}>
            <label htmlFor={`${id}-${teil}`}>
              {teil === 'vor' ? 'Vorname' : 'Nachname'}
              <span className={s.req} aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={`${id}-${teil}`}
              value={n[teil] ?? ''}
              disabled={gesperrt}
              autoComplete={teil === 'vor' ? 'given-name' : 'family-name'}
              onChange={(e) =>
                onWert({ vor: n.vor ?? '', nach: n.nach ?? '', [teil]: e.target.value })
              }
            />
            {fehlerText(
              teil === 'vor' ? 'Bitte Vornamen eintragen.' : 'Bitte Nachnamen eintragen.',
              teil,
            )}
          </div>
        ))}
      </div>
    );
  }

  if (f.typ === 'check' || f.typ === 'privacy') {
    const text =
      f.typ === 'privacy'
        ? `Ich bin einverstanden, dass die Gemeinde die Angaben für diese Veranstaltung speichert.${
            loeschtag ? ` Sie werden am ${datumText(loeschtag)} gelöscht.` : ''
          }`
        : f.frage;
    return (
      <div className={`${s.pf} ${hatFehler() ? s.bad : ''}`}>
        <label className={`${s.check} ${hatFehler() ? s.bad : ''}`}>
          <input
            type="checkbox"
            checked={wert === true}
            disabled={gesperrt}
            onChange={(e) => onWert(e.target.checked)}
          />
          <span>
            {text}
            {f.zustand === 'pflicht' && (
              <span className={s.req} aria-hidden="true">
                *
              </span>
            )}
          </span>
        </label>
        {hilfe}
        {fehlerText('Bitte ankreuzen.')}
      </div>
    );
  }

  let eingabe: React.ReactNode;
  if (f.typ === 'textarea') {
    eingabe = (
      <textarea
        id={id}
        rows={3}
        value={typeof wert === 'string' ? wert : ''}
        disabled={gesperrt}
        onChange={(e) => onWert(e.target.value)}
      />
    );
  } else if (f.typ === 'janein' || f.typ === 'radio') {
    const antworten = f.typ === 'janein' ? ['Ja', 'Nein'] : f.antworten;
    eingabe = (
      <div
        className={f.typ === 'janein' ? s.yn : s.choices}
        role="radiogroup"
        aria-labelledby={`${id}-l`}
      >
        {antworten.map((a) => (
          <label key={a} className={f.typ === 'janein' ? s.ynb : s.choice}>
            <input
              type="radio"
              name={id}
              value={a}
              checked={wert === a}
              disabled={gesperrt}
              onChange={() => onWert(a)}
            />
            <span>{a}</span>
          </label>
        ))}
      </div>
    );
  } else if (f.typ === 'select') {
    eingabe = (
      <select
        id={id}
        value={typeof wert === 'string' ? wert : ''}
        disabled={gesperrt}
        onChange={(e) => onWert(e.target.value)}
      >
        <option value="">Bitte wählen …</option>
        {f.antworten.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    );
  } else if (f.typ === 'multi') {
    const gewaehlt = Array.isArray(wert) ? wert : [];
    eingabe = (
      <div className={s.choices} role="group" aria-labelledby={`${id}-l`}>
        {f.antworten.map((a) => (
          <label key={a} className={s.choice}>
            <input
              type="checkbox"
              checked={gewaehlt.includes(a)}
              disabled={gesperrt}
              onChange={(e) =>
                onWert(e.target.checked ? [...gewaehlt, a] : gewaehlt.filter((x) => x !== a))
              }
            />
            <span>{a}</span>
          </label>
        ))}
      </div>
    );
  } else {
    const typ =
      { email: 'email', tel: 'tel', date: 'date', number: 'number' }[f.typ as string] ?? 'text';
    eingabe = (
      <input
        id={id}
        type={typ}
        value={typeof wert === 'string' ? wert : ''}
        placeholder={f.typ === 'text' && f.hilfe ? f.hilfe : undefined}
        disabled={gesperrt}
        autoComplete={f.typ === 'email' ? 'email' : f.typ === 'tel' ? 'tel' : 'off'}
        onChange={(e) => onWert(e.target.value)}
      />
    );
  }
  return (
    <div className={`${s.pf} ${hatFehler() ? s.bad : ''}`}>
      <label id={`${id}-l`} htmlFor={id}>
        {f.frage}
        <Pflicht f={f} />
      </label>
      {eingabe}
      {!(f.typ === 'text' && f.hilfe) && hilfe}
      {fehlerText(
        f.typ === 'email' && typeof wert === 'string' && wert.trim()
          ? 'Bitte eine gültige E-Mail-Adresse eintragen.'
          : 'Bitte ausfüllen.',
      )}
    </div>
  );
}

/**
 * **Der Stil-Rahmen** – Vorlage, Farbe, Feldstil, Knöpfe – ohne Kopf und Abschnitte. Für einzelne Felder
 * außerhalb des Formulars (Baukasten, Feld-Fenster), damit sie genauso aussehen wie für Gäste.
 */
export function FeldRahmen({
  gestaltung: g,
  children,
}: {
  gestaltung: OeffentlicheEinstellungen['gestaltung'];
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        s.pv,
        s.rahmen,
        s[`t-${g.vorlage}`],
        s[`fs-${g.feldstil}`],
        s[`bt-${g.knoepfe}`],
      ].join(' ')}
      style={
        { '--p-accent': g.farbe, '--p-on-accent': textAufFarbe(g.farbe) } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/** Das ganze Formular. `vorschau`: mit Musterdaten, „Absenden“ zeigt nur, wie die Bestätigung aussähe. */
export function AnmeldeFormular({
  ansicht,
  heute,
  vorschau = false,
  start,
  baukasten,
}: {
  ansicht: Ansicht;
  heute: string;
  vorschau?: boolean;
  /** Anfangswerte (Vorschau: `musterAntworten`). */
  start?: Antworten;
  /** Im Baukasten: Felder auswählen, ziehen, bearbeiten (siehe `BaukastenHaken`). */
  baukasten?: BaukastenHaken;
}) {
  const e = ansicht.einstellungen;
  const g = e.gestaltung;
  const kinder = e.wer === 'kinder';
  const [antworten, setAntworten] = useState<Antworten>(start ?? leereAntworten());
  const [option, setOption] = useState(0);
  const [extras, setExtras] = useState<boolean[]>(e.preis.extras.map(() => false));
  const [fehler, setFehler] = useState<string[]>([]);
  const [fertig, setFertig] = useState(false);

  const sichtbar = (f: Feld) => f.zustand !== 'aus';
  // In der gespeicherten Reihenfolge – im Baukasten lässt sich jedes Feld verschieben, auch Name, E-Mail und
  // Bemerkungen. Nur der Datenschutz steht immer am Ende, direkt vor dem Absenden.
  const kopf = e.formular.anmeldung.filter((f) => sichtbar(f) && !amEnde(f));
  const ende = e.formular.anmeldung.filter((f) => sichtbar(f) && f.typ === 'privacy');
  const preisFeld = e.formular.anmeldung.find((f) => f.typ === 'price' && sichtbar(f));
  const personFelder = e.formular.person.filter(sichtbar);
  const loeschtag = loeschTag(e);
  const stichtag = (e.termin?.beginn ?? heute).slice(0, 10);
  const mitGeburt = geburtsdatumAn(e.formular);

  const preis = useMemo(
    () =>
      berechnePreis(e.preis, {
        alter: antworten.personen.map((p) =>
          mitGeburt && typeof p.birth === 'string' ? alterAm(p.birth, stichtag) : null,
        ),
        option,
        angemeldetAm: heute,
        extras,
      }),
    [e.preis, antworten.personen, option, extras, heute, stichtag, mitGeburt],
  );
  const kostet = kannEtwasKosten(e.preis);

  const setAnmeldung = (id: string, w: Antwort) =>
    setAntworten((a) => ({ ...a, anmeldung: { ...a.anmeldung, [id]: w } }));
  const setPerson = (i: number, id: string, w: Antwort) =>
    setAntworten((a) => ({
      ...a,
      personen: a.personen.map((p, j) => (i === j ? { ...p, [id]: w } : p)),
    }));

  const t = e.termin;
  const unter = t
    ? `${datumText(t.beginn.slice(0, 10))}${t.ende && t.ende.slice(0, 10) !== t.beginn.slice(0, 10) ? ` – ${datumText(t.ende.slice(0, 10))}` : ''}${t.ort ? ` · ${t.ort}` : ''}`
    : 'Termin folgt';
  const frei = ansicht.freiePlaetze ?? null;
  const freiZeigen =
    frei !== null &&
    (e.plaetze.zeigen === 'immer' || (e.plaetze.zeigen === 'knapp' && frei < e.plaetze.knappUnter));

  const klassen = [
    s.pv,
    s[`t-${g.vorlage}`],
    s[`fs-${g.feldstil}`],
    s[`bt-${g.knoepfe}`],
    ansicht.bildUrl ? s['has-img'] : '',
  ].join(' ');
  const stil = {
    '--p-accent': g.farbe,
    '--p-on-accent': textAufFarbe(g.farbe),
    ...(ansicht.bildUrl ? { '--user-img': `url("${ansicht.bildUrl}")` } : {}),
  } as React.CSSProperties;

  const huelle = (f: Feld, bereich: 'anmeldung' | 'person', inhalt: ReactNode) =>
    baukasten ? <Fragment key={f.id}>{baukasten.feld(f, bereich, inhalt)}</Fragment> : inhalt;
  const personen = baukasten ? antworten.personen.slice(0, 1) : antworten.personen;

  function absenden() {
    if (baukasten) return;
    const offen = pruefeAntworten(e.formular, antworten);
    setFehler(offen);
    if (offen.length === 0) setFertig(true);
  }

  const zeilen = preis.posten.filter((p) => p.betragCent !== null);

  return (
    <div className={klassen} style={stil}>
      <div className={s['pv-shell']}>
        <aside className={s.side}>
          <header className={s.hero}>
            <div className={s['hero-in']}>
              {g.gemeindename && ansicht.gemeinde && <p className={s.org}>{ansicht.gemeinde}</p>}
              <h1>{baukasten?.titel ?? ansicht.name}</h1>
              <p className={s.sub}>{unter}</p>
              <div className={s.orn} aria-hidden="true" />
            </div>
            {baukasten?.bild}
          </header>
          <div className={s.info}>
            <div className={s.facts}>
              {freiZeigen && (
                <span className={`${s.fact} ${s.hot}`}>
                  noch <b>{frei === 1 ? '1 Platz' : `${frei} Plätze`}</b> frei
                </span>
              )}
              {ansicht.anmeldeschluss && (
                <span className={s.fact}>
                  Anmeldeschluss <b>{datumText(ansicht.anmeldeschluss)}</b>
                </span>
              )}
              <span className={s.fact}>
                <b>{preisKurz(e.preis)}</b>
              </span>
            </div>
            {baukasten?.einleitung ?? (g.text && <p className={s.intro}>{g.text}</p>)}
          </div>
        </aside>
        <div className={s.main}>
          {fertig ? (
            <div className={`${s.sec} ${s.done}`}>
              <h2>Danke für die Anmeldung!</h2>
              <p>
                Die Bestätigung kommt per E-Mail
                {typeof antworten.anmeldung.mail === 'string'
                  ? ` an ${antworten.anmeldung.mail}`
                  : ''}
                .
              </p>
              {vorschau && (
                <p className={s.vorschauhinweis}>Vorschau – abgeschickt wurde nichts.</p>
              )}
              <button type="button" className={s.addbtn} onClick={() => setFertig(false)}>
                Zurück zum Formular
              </button>
            </div>
          ) : (
            <form
              className={s.formstack}
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                absenden();
              }}
            >
              <section className={s.sec}>
                <h2>{kinder ? 'Kontakt der Eltern' : 'Deine Kontaktdaten'}</h2>
                {kopf.map((f) =>
                  huelle(
                    f,
                    'anmeldung',
                    <FeldEingabe
                      key={f.id}
                      feld={f}
                      pfad={`anmeldung.${f.id}`}
                      wert={antworten.anmeldung[f.id]}
                      onWert={(w) => setAnmeldung(f.id, w)}
                      fehler={fehler}
                    />,
                  ),
                )}
              </section>
              <section className={s.sec}>
                <h2>
                  {kinder
                    ? 'Welche Kinder meldest du an?'
                    : e.wer === 'einzeln'
                      ? 'Wer nimmt teil?'
                      : 'Wer nimmt teil?'}
                </h2>
                {personen.map((p, i) => (
                  <div key={i} className={s.person}>
                    <div className={s['person-top']}>
                      <strong>
                        {kinder ? 'Kind' : 'Person'} {i + 1}
                      </strong>
                      {!baukasten && antworten.personen.length > 1 && (
                        <button
                          type="button"
                          className={s.xbtn}
                          onClick={() =>
                            setAntworten((a) => ({
                              ...a,
                              personen: a.personen.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                    {personFelder.map((f) =>
                      huelle(
                        f,
                        'person',
                        <FeldEingabe
                          key={f.id}
                          feld={f}
                          pfad={`personen.${i}.${f.id}`}
                          wert={p[f.id]}
                          onWert={(w) => setPerson(i, f.id, w)}
                          fehler={fehler}
                        />,
                      ),
                    )}
                  </div>
                ))}
                {e.wer !== 'einzeln' && (
                  <button
                    type="button"
                    className={s.addbtn}
                    onClick={() =>
                      !baukasten && setAntworten((a) => ({ ...a, personen: [...a.personen, {}] }))
                    }
                  >
                    + {kinder ? 'Weiteres Kind' : 'Weitere Person'}
                  </button>
                )}
                {fehler.includes('personen') && (
                  <p className={s.warnline}>Bitte mindestens eine Person eintragen.</p>
                )}
              </section>
              {preisFeld && (e.preis.grundpreis.art === 'auswahl' || e.preis.extras.length > 0) && (
                <section className={s.sec}>
                  <h2>{preisFeld.frage}</h2>
                  {e.preis.grundpreis.art === 'auswahl' && (
                    <div className={s.pf}>
                      <label htmlFor="af-option">
                        {e.preis.grundpreis.auswahlName}
                        <span className={s.req} aria-hidden="true">
                          *
                        </span>
                      </label>
                      <select
                        id="af-option"
                        value={option}
                        onChange={(ev) => setOption(Number(ev.target.value))}
                      >
                        {e.preis.grundpreis.optionen.map((o, i) => (
                          <option key={o.name} value={i}>
                            {o.name} · {euroText(o.preisCent)} pro Person
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {e.preis.extras.length > 0 && (
                    <div className={s.pf}>
                      <span className={s.lab}>Extras</span>
                      <div className={s.choices}>
                        {e.preis.extras.map((x, i) => (
                          <label key={x.bezeichnung} className={s.choice}>
                            <input
                              type="checkbox"
                              checked={extras[i] ?? false}
                              onChange={(ev) =>
                                setExtras(extras.map((c, j) => (i === j ? ev.target.checked : c)))
                              }
                            />
                            <span>
                              {x.bezeichnung} (+{euroText(x.preisCent)}
                              {x.gilt === 'person' ? ' pro Person' : ''})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
              <section className={s.sec}>
                {ende.map((f) =>
                  huelle(
                    f,
                    'anmeldung',
                    <FeldEingabe
                      key={f.id}
                      feld={f}
                      pfad={`anmeldung.${f.id}`}
                      wert={antworten.anmeldung[f.id]}
                      onWert={(w) => setAnmeldung(f.id, w)}
                      fehler={fehler}
                      loeschtag={loeschtag}
                    />,
                  ),
                )}
                {kostet && (
                  <div className={s.sumbox} aria-label="Preis">
                    {zeilen.map((p, i) => (
                      <div key={i} className={s.sl}>
                        <span>
                          {p.text} <small>{p.hinweis}</small>
                        </span>
                        <span>
                          {p.betragCent! < 0
                            ? `−${euroText(-p.betragCent!)}`
                            : euroText(p.betragCent!)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className={s.sum}>
                  <div>
                    {antworten.personen.length === 1
                      ? '1 Person'
                      : `${antworten.personen.length} Personen`}
                    <small>
                      {kostet
                        ? 'Die Bankverbindung kommt mit der Bestätigung per E-Mail.'
                        : 'Die Teilnahme ist kostenlos.'}
                    </small>
                  </div>
                  <div className={s.big}>{kostet ? euroText(preis.gesamtCent) : 'kostenlos'}</div>
                </div>
                {preis.ausgebucht && (
                  <p className={s.warnline}>
                    Diese Auswahl ist ausgebucht – die Anmeldung kommt auf die Warteliste.
                  </p>
                )}
                {fehler.length > 0 && (
                  <p className={s.warnline} role="alert">
                    Bitte die markierten Angaben ergänzen.
                  </p>
                )}
                <button type="submit" className={s.go}>
                  Verbindlich anmelden
                </button>
                {vorschau && !baukasten && (
                  <p className={s.hintline}>
                    Vorschau mit Musterdaten – abgeschickt wird hier nichts.
                  </p>
                )}
              </section>
            </form>
          )}
          <footer className={s.foot}>
            {ansicht.gemeinde ?? 'Gemeinde'} · Fragen beantwortet das Team als Antwort auf die
            Bestätigungsmail.
          </footer>
        </div>
      </div>
    </div>
  );
}
