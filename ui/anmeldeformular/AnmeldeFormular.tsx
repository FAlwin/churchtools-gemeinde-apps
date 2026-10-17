import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  mailGueltig,
  nurText,
  pruefeAntworten,
  type Antwort,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { amEnde } from '@shared/anmeldung/baukasten';
import {
  betragAus,
  neueAnmeldeNr,
  personenNamen,
  wartelistenZeile,
  type Abgeschickt,
  type PersonErgebnis,
  type PreisWahl,
} from '@shared/anmeldung/senden';
import { platzPlan, type PlatzStand } from '@shared/anmeldung/oeffentlich';
import { euroText, kannEtwasKosten, preisKurz } from '@shared/anmeldung/preis';
import { SCHRIFT, leereAntworten, textAufFarbe } from './daten';
import { titelbildGross } from '@shared/anmeldung/gestaltung';
import { HONIGTOPF_NAME, SPAM_TEXT, spamGrund } from '@shared/anmeldung/spamschutz';
import { ErziehungsEingabe, UnterschriftEingabe } from './Bausteine';
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
  /** Gibt es eine Warteliste? (#602: Hinweis an der Person, die keinen Platz mehr bekommt.) */
  warteliste?: boolean;
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
  /**
   * Das kleine ⓘ „Woher kommt das?“ (Alwin, 14.10.2026) – an Feldern (`f.id`) hinter der Beschriftung, an den
   * Bereichen „teil“ und „preis“ hinter der Überschrift. `null`, wo es nichts zu erklären gibt.
   */
  hinweis?: (wo: string) => ReactNode;
  /** Der aufgeklappte Hinweis zu einem Bereich (bei Feldern zeigt ihn die Hülle). */
  hinweisText?: (wo: string) => ReactNode;
}

/**
 * Überschrift mit ⓘ dahinter – das ⓘ hängt am letzten Wort, sonst rutscht es am Handy allein in eine neue Zeile
 * (Durchklicken 14.10.2026).
 */
function mitHinweis(text: string, knopf: ReactNode): ReactNode {
  if (!knopf) return text;
  const i = text.lastIndexOf(' ');
  return (
    <>
      {text.slice(0, i + 1)}
      <span className={s.zusammen}>
        {text.slice(i + 1)}
        {knopf}
      </span>
    </>
  );
}

/**
 * **Echt abschicken** (öffentliches Formular, A6-2). Wirft bei einem Fehler einen `Error`, dessen Text die Person
 * liest – die Eingaben bleiben stehen. Kommt nur ein Teil durch (#602: jede Person einzeln), sagt das Ergebnis es je
 * Person; `nur` schickt dann die offen gebliebenen noch einmal.
 */
export type Abschicken = (a: {
  antworten: Antworten;
  wahl: PreisWahl;
  nur?: number[];
  /** Anmelde-Nr. (A6-5a) – einmal je Formular, bei „noch einmal“ dieselbe. */
  nr: string;
}) => Promise<Abgeschickt>;

const ERGEBNIS_TEXT: Record<PersonErgebnis, string> = {
  angemeldet: '✓ angemeldet',
  warteliste: 'Warteliste',
  bestaetigen: 'per Mail bestätigen',
  ausgebucht: 'kein Platz mehr',
  offen: 'nicht angemeldet',
};

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
  zusatz = null,
}: {
  feld: Feld;
  wert: Antwort;
  onWert: (w: Antwort) => void;
  /** Eindeutige Kennung für `id`/`name` (z. B. `p1-birth`). */
  pfad: string;
  fehler?: string[];
  gesperrt?: boolean;
  loeschtag?: string | null;
  /** Steht hinter der (ersten) Beschriftung – im Baukasten das ⓘ. */
  zusatz?: ReactNode;
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

  // A6-2b: zusammengesetzte Bausteine (`Bausteine.tsx`).
  if (f.typ === 'erziehungsberechtigte' || f.typ === 'unterschrift') {
    const Eingabe = f.typ === 'erziehungsberechtigte' ? ErziehungsEingabe : UnterschriftEingabe;
    return (
      <Eingabe
        feld={f}
        wert={wert}
        onWert={onWert}
        pfad={pfad}
        fehler={fehler}
        gesperrt={gesperrt}
        zusatz={zusatz}
      />
    );
  }

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
              {teil === 'vor' && zusatz}
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
            {zusatz}
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
        {zusatz}
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

const SYMBOLE = {
  leute:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2.5-1.5-4.2-4-4.8',
  uhr: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  preis: 'M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7c-2-4-6-4-6-1s6 1 6 1Zm0 0c2-4 6-4 6-1s-6 1-6 1Z',
} as const;

function Symbol({ name }: { name: keyof typeof SYMBOLE }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={SYMBOLE[name]} />
    </svg>
  );
}

/** Termin in einer Zeile: „Sa, 21.11.2026 · Gemeindehaus“ (mehrtägig mit „–“), sonst „Termin folgt“. */
function terminZeile(e: OeffentlicheEinstellungen): string {
  const t = e.termin;
  return t
    ? `${datumText(t.beginn.slice(0, 10))}${t.ende && t.ende.slice(0, 10) !== t.beginn.slice(0, 10) ? ` – ${datumText(t.ende.slice(0, 10))}` : ''}${t.ort ? ` · ${t.ort}` : ''}`
    : 'Termin folgt';
}

/**
 * **Der Rahmen des Formulars** – Gestaltung (Farben, Schriften, Aufbau), Kopf mit Logo und Titelbild, Seitenleiste.
 * Die EINE Stelle dafür: das Anmeldeformular und „Deine Anmeldung“ (A6-4) sehen gleich aus, ohne die Regeln zu
 * kopieren. `info` steht unter dem Kopf (Fakten, Begrüßung), `children` im Hauptbereich.
 */
export function FormularRahmen({
  ansicht,
  titel,
  kopfZusatz,
  info,
  children,
}: {
  ansicht: Ansicht;
  titel: ReactNode;
  kopfZusatz?: ReactNode;
  info?: ReactNode;
  children: ReactNode;
}) {
  const e = ansicht.einstellungen;
  const g = e.gestaltung;
  const unter = terminZeile(e);
  // Jede Einstellung eine Klasse bzw. eine Variable (Entwurf v3) – keine starren Vorlagen mehr.
  const mitBild = !!ansicht.bildUrl;
  const logoOben = g.logo !== 'keins' && !!g.logoUrl && g.logoOrt === 'oben';
  const bildAlsSeite = mitBild && (g.hintergrund === 'bild' || g.aufbau === 'seite');
  const klassen = [
    s.pv,
    s[`a-${g.aufbau}`],
    s[`kh-${g.kopfHoehe}`],
    // Steht das Logo oben in der Mitte, steht auch der Titel mittig (Alwin, 14.10.2026) – sonst wirkt es schief.
    g.kopfAusrichtung === 'mitte' || logoOben ? s['kopf-mitte'] : '',
    s[`fs-${g.feldstil}`],
    s[`bt-${g.knoepfe}`],
    g.knopfVoll ? s['bt-voll'] : '',
    s[`br-${g.breite}`] ?? '',
    s[`ek-${g.ecken}`],
    g.schatten ? s.schatten : '',
    g.rahmen ? s.rahmen : '',
    g.bunt ? s.bunt : '',
    g.gross ? s.gross : '',
    g.hintergrund === 'muster' ? s[`m-${g.muster}`] : '',
    bildAlsSeite ? s['bild-seite'] : mitBild ? s['bild-kopf'] : '',
  ].join(' ');
  const stil = {
    '--p-accent': g.farbe,
    '--p-on-accent': textAufFarbe(g.farbe),
    '--p-page': g.seitenfarbe,
    // Text direkt auf der Seite (Hinweise, Begrüßung) muss auf der Seitenfarbe lesbar sein.
    '--p-auf-seite': bildAlsSeite ? '#ffffff' : textAufFarbe(g.seitenfarbe),
    '--p-card': g.kartenfarbe,
    '--p-text': g.schriftfarbe,
    '--p-muster': g.musterfarbe,
    '--p-head': SCHRIFT[g.kopfSchrift],
    '--p-body': SCHRIFT[g.textSchrift],
    ...(mitBild ? { '--user-img': `url("${titelbildGross(ansicht.bildUrl!)}")` } : {}),
  } as React.CSSProperties;
  const logo =
    g.logo !== 'keins' && g.logoUrl ? (
      <img
        className={`${s.logo} ${g.logoOrt === 'oben' ? s['logo-oben'] : ''}`}
        src={titelbildGross(g.logoUrl, 240)}
        alt=""
      />
    ) : null;

  return (
    <div className={klassen} style={stil}>
      <div className={s['pv-shell']}>
        <aside className={s.side}>
          <header className={s.hero}>
            <div
              className={`${s['hero-in']} ${g.logoOrt === 'links' && logo ? s['mit-logo-links'] : ''}`}
            >
              {logo}
              <div>
                <h1>{titel}</h1>
                <p className={s.sub}>{unter}</p>
              </div>
            </div>
            {kopfZusatz}
          </header>
          {info}
        </aside>
        <div className={s.main}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Das ganze Formular. `vorschau`: mit Musterdaten, „Absenden“ zeigt nur, wie die Bestätigung aussähe. `probe`:
 * das öffentliche Formular als Trockenlauf („Extern öffnen und testen“) – sonst wie für Gäste, schickt aber nichts.
 * Mit `onAbsenden` (öffentliches Formular, A6-2) wird wirklich angemeldet.
 */
export function AnmeldeFormular({
  ansicht,
  heute,
  vorschau = false,
  probe = false,
  start,
  baukasten,
  onAbsenden,
  plaetzeNachfragen,
}: {
  ansicht: Ansicht;
  heute: string;
  vorschau?: boolean;
  probe?: boolean;
  /** Nur im öffentlichen Formular: wirklich an ChurchTools schicken. Ohne → nur prüfen (Vorschau, Probelauf). */
  onAbsenden?: Abschicken;
  /** Nur im öffentlichen Formular: freie Plätze frisch von ChurchTools – beim Hinzufügen einer Person (#602). */
  plaetzeNachfragen?: () => Promise<PlatzStand>;
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
  const [fertig, setFertig] = useState<Abgeschickt | null>(null);
  const [sendet, setSendet] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  const [nochmalFehler, setNochmalFehler] = useState<string | null>(null);
  // Freie Plätze (#602): beim Laden, beim Hinzufügen frisch nachgefragt. Ohne Angabe (Vorschau) kein Hinweis.
  const [platz, setPlatz] = useState<PlatzStand | null>(() =>
    ansicht.freiePlaetze === undefined
      ? null
      : { freiePlaetze: ansicht.freiePlaetze, warteliste: ansicht.warteliste === true },
  );
  const [fragtNach, setFragtNach] = useState(false);
  const [nr] = useState(neueAnmeldeNr);
  const echt = !!onAbsenden && !vorschau && !probe && !baukasten;
  // A6-3 Spam-Schutz (`spamschutz.ts`): Honigtopf und Mindest-Ausfüllzeit seit dem Laden. Doppel-Absenden verhindert
  // schon `sendet` – React zeichnet nach jedem Klick neu (gegengeprüft 16.10.2026).
  const honigtopf = useRef<HTMLInputElement>(null);
  const [geladen] = useState(() => Date.now());

  const sichtbar = (f: Feld) => f.zustand !== 'aus';
  // In der gespeicherten Reihenfolge – im Baukasten lässt sich jedes Feld verschieben, auch Name, E-Mail und
  // Bemerkungen. Nur der Datenschutz steht immer am Ende, direkt vor dem Absenden.
  const kopf = e.formular.anmeldung.filter((f) => sichtbar(f) && !amEnde(f));
  const ende = e.formular.anmeldung.filter((f) => sichtbar(f) && f.typ === 'privacy');
  const preisFeld = e.formular.anmeldung.find((f) => f.typ === 'price' && sichtbar(f));
  const personFelder = e.formular.person.filter(sichtbar);
  const loeschtag = loeschTag(e);
  // Dieselbe Buchung wie beim Abschicken (`buchungAus`) – angezeigter und gespeicherter Betrag sind eine Regel.
  // A6-5a: Wer auf die Warteliste kommt, zählt nicht im Betrag – dieselbe Regel wie beim Abschicken (`betragAus`).
  const betrag = useMemo(
    () =>
      betragAus(
        e,
        antworten,
        { option, extras },
        heute,
        platz && !baukasten
          ? platzPlan(platz, antworten.personen.length).map((x) => x === 'platz')
          : undefined,
      ),
    [e, antworten, option, extras, heute, platz, baukasten],
  );
  const preis = betrag.preis;
  const kostet = kannEtwasKosten(e.preis);

  const setAnmeldung = (id: string, w: Antwort) =>
    setAntworten((a) => ({ ...a, anmeldung: { ...a.anmeldung, [id]: w } }));
  const setPerson = (i: number, id: string, w: Antwort) =>
    setAntworten((a) => ({
      ...a,
      personen: a.personen.map((p, j) => (i === j ? { ...p, [id]: w } : p)),
    }));

  const frei = platz ? platz.freiePlaetze : (ansicht.freiePlaetze ?? null);
  const freiZeigen =
    frei !== null &&
    (e.plaetze.zeigen === 'immer' || (e.plaetze.zeigen === 'knapp' && frei < e.plaetze.knappUnter));

  const huelle = (f: Feld, bereich: 'anmeldung' | 'person', inhalt: ReactNode) =>
    baukasten ? <Fragment key={f.id}>{baukasten.feld(f, bereich, inhalt)}</Fragment> : inhalt;
  const personen = baukasten ? antworten.personen.slice(0, 1) : antworten.personen;
  // Wer bekommt was – dieselbe Regel wie beim Abschicken (`platzPlan`).
  const plan = platz && !baukasten ? platzPlan(platz, antworten.personen.length) : null;
  const naechster =
    platz && !baukasten ? platzPlan(platz, antworten.personen.length + 1).at(-1) : 'platz';
  const nichtAlle = !!plan && plan.some((x) => x !== 'platz');
  const alleWarten = !!plan && plan.length > 0 && plan.every((x) => x === 'warteliste');
  const wer = kinder ? 'Kind' : 'Person';

  async function hinzufuegen() {
    if (baukasten || fragtNach) return;
    let stand = platz;
    if (plaetzeNachfragen) {
      setFragtNach(true);
      try {
        stand = await plaetzeNachfragen();
        setPlatz(stand);
      } catch {
        // Vorübergehend ist nicht ungültig: mit dem letzten Stand weiter, ChurchTools entscheidet beim Absenden.
      } finally {
        setFragtNach(false);
      }
    }
    if (stand && platzPlan(stand, antworten.personen.length + 1).at(-1) === 'kein') return;
    setAntworten((a) => ({ ...a, personen: [...a.personen, {}] }));
  }

  async function nochmal(offen: number[]) {
    if (!onAbsenden || sendet) return;
    setSendet(true);
    setNochmalFehler(null);
    try {
      const neu = await onAbsenden({ antworten, wahl: { option, extras }, nur: offen, nr });
      setFertig((alt) =>
        alt
          ? {
              ...alt,
              personen: alt.personen.map((x) => neu.personen.find((y) => y.index === x.index) ?? x),
              meldung: neu.meldung,
            }
          : neu,
      );
    } catch (fehler) {
      setNochmalFehler(fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.');
    } finally {
      setSendet(false);
    }
  }

  async function absenden() {
    if (baukasten || sendet) return;
    const offen = pruefeAntworten(e.formular, antworten);
    setFehler(offen);
    if (offen.length > 0) return;
    if (!echt || !onAbsenden) {
      setFertig({
        personen: personenNamen(e, antworten).map((name, index) => ({
          index,
          name,
          ergebnis: 'angemeldet',
        })),
        mail: typeof antworten.anmeldung.mail === 'string' ? antworten.anmeldung.mail : '',
      });
      return;
    }
    const spam = spamGrund({
      honigtopf: honigtopf.current?.value ?? '',
      seitDemLadenMs: Date.now() - geladen,
    });
    if (spam) {
      setSendeFehler(SPAM_TEXT[spam]);
      return;
    }
    setSendet(true);
    setSendeFehler(null);
    try {
      setFertig(await onAbsenden({ antworten, wahl: { option, extras }, nr }));
    } catch (fehler) {
      // Vorübergehend ist nicht endgültig: Die Eingaben bleiben stehen, ein zweiter Klick versucht es noch einmal.
      setSendeFehler(fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.');
    } finally {
      setSendet(false);
    }
  }

  const zeilen = betrag.posten.filter((p) => p.betragCent !== null);

  return (
    <FormularRahmen
      ansicht={ansicht}
      titel={baukasten?.titel ?? ansicht.name}
      kopfZusatz={baukasten?.bild}
      info={
        <div className={s.info}>
          <div className={s.facts}>
            {freiZeigen && (
              <span className={`${s.fact} ${s.hot}`}>
                <Symbol name="leute" />
                noch <b>{frei === 1 ? '1 Platz' : `${frei} Plätze`}</b> frei
              </span>
            )}
            {ansicht.anmeldeschluss && (
              <span className={s.fact}>
                <Symbol name="uhr" />
                Anmeldeschluss <b>{datumText(ansicht.anmeldeschluss)}</b>
              </span>
            )}
            <span className={s.fact}>
              <Symbol name="preis" />
              <b>{preisKurz(e.preis)}</b>
            </span>
          </div>
          {baukasten?.einleitung ?? (g.text && <p className={s.intro}>{g.text}</p>)}
        </div>
      }
    >
      {fertig ? (
        <Ergebnis
          fertig={fertig}
          echt={echt}
          hinweis={vorschau ? 'Vorschau' : probe ? 'Probelauf' : null}
          sendet={sendet}
          fehler={nochmalFehler}
          onNochmal={(offen) => void nochmal(offen)}
          onZurueck={() => setFertig(null)}
        />
      ) : (
        <form
          className={s.formstack}
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void absenden();
          }}
        >
          <section className={s.sec}>
            <h2>
              {mitHinweis(
                kinder ? 'Kontakt der Eltern' : 'Deine Kontaktdaten',
                baukasten?.hinweis?.('kontakt'),
              )}
            </h2>
            {baukasten?.hinweisText?.('kontakt')}
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
                  zusatz={baukasten?.hinweis?.(f.id)}
                />,
              ),
            )}
          </section>
          <section className={s.sec}>
            <h2>
              {mitHinweis(
                kinder ? 'Welche Kinder meldest du an?' : 'Wer nimmt teil?',
                baukasten?.hinweis?.('teil'),
              )}
            </h2>
            {baukasten?.hinweisText?.('teil')}
            {alleWarten && (
              <div className={s.platzBanner} role="status">
                <b>Alle Plätze sind belegt.</b> Anmeldungen kommen auf die Warteliste und rücken
                nach, wenn Plätze frei werden.
              </div>
            )}
            {personen.map((p, i) => (
              <div key={i} className={s.person}>
                <div className={s['person-top']}>
                  <strong>
                    {wer} {i + 1}
                    {baukasten && e.wer !== 'einzeln' && (
                      <small className={s.wiederholt}>
                        wiederholt sich für {kinder ? 'jedes Kind' : 'jede Person'}
                      </small>
                    )}
                    {nichtAlle && plan?.[i] === 'platz' && (
                      <small className={s.platzJa}>bekommt einen Platz</small>
                    )}
                    {plan?.[i] === 'warteliste' && (
                      <small className={s.platzWarte}>Warteliste</small>
                    )}
                    {plan?.[i] === 'kein' && <small className={s.platzNein}>kein Platz</small>}
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
                {plan?.[i] === 'warteliste' && !alleWarten && (
                  <p className={s.platzHinweis}>
                    Für {wer} {i + 1} ist kein Platz mehr frei – es kommt auf die <b>Warteliste</b>{' '}
                    und rückt nach, wenn ein Platz frei wird. Wenn du das nicht möchtest:
                    „Entfernen“.
                  </p>
                )}
                {plan?.[i] === 'kein' && (
                  <p className={`${s.platzHinweis} ${s.platzHinweisRot}`}>
                    Für {wer} {i + 1} ist kein Platz mehr frei, und es gibt keine Warteliste – bitte
                    „Entfernen“.
                  </p>
                )}
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
                      zusatz={baukasten?.hinweis?.(f.id)}
                    />,
                  ),
                )}
              </div>
            ))}
            {e.wer !== 'einzeln' && naechster === 'kein' && (
              <p className={`${s.platzHinweis} ${s.platzHinweisRot}`} role="status">
                <b>Kein Platz mehr frei</b> – {kinder ? 'ein weiteres Kind' : 'eine weitere Person'}{' '}
                kann nicht angemeldet werden (es gibt keine Warteliste).
              </p>
            )}
            {e.wer !== 'einzeln' && (
              <button
                type="button"
                className={s.addbtn}
                disabled={naechster === 'kein' || fragtNach}
                onClick={() => void hinzufuegen()}
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
              <h2>{mitHinweis(preisFeld.frage, baukasten?.hinweis?.('preis'))}</h2>
              {baukasten?.hinweisText?.('preis')}
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
                  zusatz={baukasten?.hinweis?.(f.id)}
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
                      {p.betragCent! < 0 ? `−${euroText(-p.betragCent!)}` : euroText(p.betragCent!)}
                    </span>
                  </div>
                ))}
                {betrag.warten.map((name) => (
                  <div key={name} className={s.sl}>
                    <span>{wartelistenZeile(name)}</span>
                    <span />
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
              <div className={s.big}>{kostet ? euroText(betrag.gesamtCent) : 'kostenlos'}</div>
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
            {sendeFehler && (
              <p className={s.warnline} role="alert">
                {sendeFehler}
              </p>
            )}
            {echt && (
              // Honigtopf (A6-3): für Menschen unsichtbar und nicht erreichbar, Bots füllen ihn aus.
              <div className={s.honigtopf} aria-hidden="true">
                <label>
                  Bitte leer lassen
                  <input
                    ref={honigtopf}
                    name={HONIGTOPF_NAME}
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    defaultValue=""
                  />
                </label>
              </div>
            )}
            <button type="submit" className={s.go} disabled={sendet} aria-busy={sendet}>
              {sendet
                ? 'Wird gesendet …'
                : alleWarten
                  ? 'Auf die Warteliste'
                  : 'Verbindlich anmelden'}
            </button>
            {vorschau && !baukasten && (
              <p className={s.hintline}>Vorschau mit Musterdaten – abgeschickt wird hier nichts.</p>
            )}
            {probe && <p className={s.hintline}>Probelauf – abgeschickt wird hier nichts.</p>}
          </section>
        </form>
      )}
      <footer className={s.foot}>
        {ansicht.gemeinde ?? 'Gemeinde'}
        {/* Nicht „Antwort auf die Bestätigungsmail“: Die Mail von ChurchTools kommt von noreply (A6-4). */}
        {mailGueltig(e.kontakt) && (
          <>
            {' · Fragen an '}
            <a href={`mailto:${e.kontakt}`}>{e.kontakt}</a>
          </>
        )}
      </footer>
    </FormularRahmen>
  );
}

/**
 * **Die Seite nach dem Abschicken** (#602): je Person, was herauskam. Alle angemeldet → „Danke“ wie bisher; sonst die
 * Liste. Offen gebliebene schickt „Noch einmal“ erneut – nur sie, keine Doppelanmeldung.
 */
function Ergebnis({
  fertig,
  echt,
  hinweis,
  sendet,
  fehler,
  onNochmal,
  onZurueck,
}: {
  fertig: Abgeschickt;
  echt: boolean;
  /** „Vorschau“ / „Probelauf“ – abgeschickt wurde nichts. */
  hinweis: string | null;
  sendet: boolean;
  fehler: string | null;
  onNochmal: (offen: number[]) => void;
  onZurueck: () => void;
}) {
  const p = fertig.personen;
  const hat = (x: PersonErgebnis) => p.some((y) => y.ergebnis === x);
  const offen = p.filter((x) => x.ergebnis === 'offen');
  const liste = p.length > 1 || p.some((x) => x.ergebnis !== 'angemeldet');
  const titel = offen.length
    ? 'Fast fertig'
    : hat('bestaetigen') && p.every((x) => x.ergebnis === 'bestaetigen')
      ? 'Fast geschafft!'
      : hat('angemeldet') || hat('bestaetigen')
        ? 'Danke für die Anmeldung!'
        : hat('warteliste')
          ? 'Auf der Warteliste'
          : 'Nicht angemeldet';
  const namen = (l: { name: string }[]) =>
    l.length === 1
      ? l[0].name
      : `${l
          .slice(0, -1)
          .map((x) => x.name)
          .join(', ')} und ${l[l.length - 1].name}`;
  return (
    <div className={`${s.sec} ${s.done}`} role="status">
      <h2>{titel}</h2>
      {liste && (
        <ul className={s.ergebnisListe}>
          {p.map((x) => (
            <li key={x.index}>
              <b>{x.name}</b>
              <span className={s[`ergebnis-${x.ergebnis}`]}>{ERGEBNIS_TEXT[x.ergebnis]}</span>
            </li>
          ))}
        </ul>
      )}
      {hat('bestaetigen') && (
        <p>
          {p.length > 1
            ? 'Wer schon bekannt ist, bestätigt'
            : 'Du bist bei der Gemeinde schon bekannt. Bitte bestätige'}{' '}
          die Anmeldung über den Link in der E-Mail{fertig.mail ? ` an ${fertig.mail}` : ''} – erst
          dann ist sie gültig.
        </p>
      )}
      {hat('warteliste') && <p>Auf der Warteliste rückt man nach, sobald ein Platz frei wird.</p>}
      {hat('ausgebucht') && <p>{fertig.meldung}</p>}
      {(hat('angemeldet') || hat('warteliste')) && (
        <p>
          Die Bestätigung kommt per E-Mail{fertig.mail ? ` an ${fertig.mail}` : ''}
          {p.length > 1 ? ' – für jede Person eine eigene' : ''}.
        </p>
      )}
      {offen.length > 0 && (
        <>
          <p>{fertig.meldung}</p>
          {fehler && (
            <p className={s.warnline} role="alert">
              {fehler}
            </p>
          )}
          <button
            type="button"
            className={s.go}
            disabled={sendet}
            aria-busy={sendet}
            onClick={() => onNochmal(offen.map((x) => x.index))}
          >
            {sendet ? 'Wird gesendet …' : `${namen(offen)} noch einmal anmelden`}
          </button>
        </>
      )}
      {hinweis && <p className={s.vorschauhinweis}>{hinweis} – abgeschickt wurde nichts.</p>}
      {/* Nach einer echten Anmeldung kein „Zurück“ – ein zweites Abschicken wäre eine zweite Anmeldung. */}
      {!echt && (
        <button type="button" className={s.addbtn} onClick={onZurueck}>
          Zurück zum Formular
        </button>
      )}
    </div>
  );
}
