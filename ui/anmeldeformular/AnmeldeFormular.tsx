import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { mailGueltig, type Antwort, type Antworten, type Feld } from '@shared/anmeldung/formular';
import { amEnde } from '@shared/anmeldung/baukasten';
import { datumText } from '@shared/ct/datum';
import { loeschDatum } from '@shared/anmeldung/termin';
import { betragAus, personenNamen, wartelistenZeile } from '@shared/anmeldung/senden';
import { platzPlan, type PlatzStand } from '@shared/anmeldung/oeffentlich';
import { mehrAlsVorgesehen, optionRest } from '@shared/anmeldung/kontingent';
import { euroText, kannEtwasKosten, preisKurz } from '@shared/anmeldung/preis';
import { leereAntworten } from './daten';
import { HONIGTOPF_NAME } from '@shared/anmeldung/spamschutz';
import s from './AnmeldeFormular.module.scss';
import { FeldEingabe } from './FeldEingabe';
import { FormularRahmen, Symbol, type Ansicht } from './FormularRahmen';
import { Ergebnis } from './FormularErgebnis';
import { useAbsenden, usePlaetze, type Abschicken } from './useAbsenden';
import { useBedingungen } from './useBedingungen';
import { useSchritte } from './useSchritte';
import { SchrittFortschritt } from './SchrittFortschritt';
import { freiEingabe } from '@shared/anmeldung/freieAntwort';

/**
 * **Das Anmeldeformular, wie Gäste es sehen** (A5) – EINE Darstellung für den Baukasten in der Erweiterung
 * (dort mit `baukasten`: Felder auswählen, ziehen, direkt bearbeiten), die Vorschau und das öffentliche
 * Formular (A6). Rechnet mit `berechnePreis` und prüft mit
 * `pruefeAntworten` – dieselben Regeln wie die Nachprüfung. Aussehen nach Vorlage, Farbe, Feldstil, Knöpfen
 * (`AnmeldeFormular.module.scss`, aus dem Entwurf vom 09.10.2026).
 */

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
  /** F2c: der feste Balken „Schritt 1“ ganz oben – nur, wenn das Formular Schritte hat. */
  schrittEins?: ReactNode;
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
  // F1b: Bedingungen (ausblenden, Antworten sperren, Wahl lösen) – im Baukasten aus, dort sieht man alles.
  const { antworten, setAntworten, zeigen, bedingt } = useBedingungen(
    e.formular,
    () => start ?? leereAntworten(),
    !baukasten,
  );
  // F2b: das Formular in Schritten (Entwurf f2-schritte-v1) – im Baukasten nicht, dort steht alles auf einer Bühne.
  const schritt = useSchritte({ e, antworten, aktiv: !baukasten });
  const formular = useRef<HTMLFormElement>(null);
  // A6-5b: Eine ausgebuchte Option ist nicht wählbar – vorausgewählt ist die erste freie.
  const [option, setOption] = useState(() =>
    Math.max(
      0,
      e.preis.grundpreis.optionen.findIndex((o) => optionRest(o) !== 0),
    ),
  );
  const [extras, setExtras] = useState<boolean[]>(e.preis.extras.map(() => false));
  // ── Freie Plätze (`usePlaetze`) ──
  const { platz, fragtNach, hinzufuegen } = usePlaetze({
    ansicht,
    baukasten: !!baukasten,
    plaetzeNachfragen,
    antworten,
    setAntworten,
  });
  const echt = !!onAbsenden && !vorschau && !probe && !baukasten;

  const sichtbar = (f: Feld) => f.zustand !== 'aus';
  // In der gespeicherten Reihenfolge – im Baukasten lässt sich jedes Feld verschieben, auch Name, E-Mail und
  // Bemerkungen. Nur der Datenschutz steht immer am Ende, direkt vor dem Absenden.
  const kopf = e.formular.anmeldung.filter((f) => sichtbar(f) && zeigen(f) && !amEnde(f));
  const ende = e.formular.anmeldung.filter((f) => sichtbar(f) && zeigen(f) && f.typ === 'privacy');
  const preisFeld = e.formular.anmeldung.find((f) => f.typ === 'price' && sichtbar(f));
  const personFelder = e.formular.person.filter(sichtbar);
  // Derselbe Tag, an dem ChurchTools löscht – die eine Regel aus `termin.ts`.
  const loeschtag = loeschDatum(e);
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
  const gewaehlt =
    e.preis.grundpreis.art === 'auswahl' ? e.preis.grundpreis.optionen[option] : undefined;
  const personenMitPlatz = antworten.personen.length - betrag.warten.length;
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

  // ── Absenden (`useAbsenden`) ──
  const {
    fehler,
    setFehler,
    fertig,
    setFertig,
    sendet,
    sendeFehler,
    nochmalFehler,
    honigtopf,
    nochmal,
    absenden,
  } = useAbsenden({
    e,
    antworten,
    option,
    extras,
    preis,
    echt,
    baukasten: !!baukasten,
    onAbsenden,
  });

  const zeilen = betrag.posten.filter((p) => p.betragCent !== null);

  // F2b: blättern – nach oben ins Formular, damit die neue Seite von vorn beginnt.
  const nachOben = () => formular.current?.scrollIntoView?.({ block: 'start' });
  function weiter() {
    const fehlt = schritt.weiter();
    setFehler(fehlt);
    if (!fehlt.length) nachOben();
  }
  function zurueck() {
    setFehler([]);
    schritt.zurueck();
    nachOben();
  }
  const kopfHier = kopf.filter(schritt.zeigtKontakt);
  // F2b: Auf späteren Seiten steht der Name nicht mehr dabei – dort heißt die Person wie eingetragen (Entwurf).
  const namen = personenNamen(e, antworten);
  const mitNamen = schritt.mit && !schritt.personenAnlegen;
  const zurueckKnopf = schritt.mit && !schritt.erste && (
    <button type="button" className={s.zurueck} onClick={zurueck}>
      Zurück
    </button>
  );

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
                {frei === 0 ? (
                  <>
                    <b>ausgebucht</b>
                    {platz?.warteliste ? ' – Warteliste' : ''}
                  </>
                ) : (
                  <>
                    noch <b>{frei === 1 ? '1 Platz' : `${frei} Plätze`}</b> frei
                  </>
                )}
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
          ref={formular}
          className={s.formstack}
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void absenden();
          }}
        >
          {schritt.mit && (
            <SchrittFortschritt
              alle={schritt.alle}
              gezeigt={schritt.gezeigt}
              nr={schritt.nr}
              name={schritt.name}
            />
          )}
          {baukasten?.schrittEins}
          {kopfHier.length > 0 && (
            <section className={s.sec}>
              <h2>
                {mitHinweis(
                  // Nach Schritt 1 stehen hier die übrigen Fragen einmal je Anmeldung (Entwurf f2-schritte-v1).
                  schritt.mit && !schritt.erste
                    ? 'Für die ganze Anmeldung'
                    : kinder
                      ? 'Kontakt der Eltern'
                      : 'Deine Kontaktdaten',
                  baukasten?.hinweis?.('kontakt'),
                )}
              </h2>
              {baukasten?.hinweisText?.('kontakt')}
              {kopfHier.map((f) =>
                huelle(
                  f,
                  'anmeldung',
                  <FeldEingabe
                    key={f.id}
                    feld={f}
                    pfad={`anmeldung.${f.id}`}
                    wert={antworten.anmeldung[f.id]}
                    onWert={(w) => setAnmeldung(f.id, w)}
                    {...freiEingabe(antworten.anmeldung, f.id, setAnmeldung)}
                    fehler={fehler}
                    zusatz={baukasten?.hinweis?.(f.id)}
                    {...bedingt(f, `anmeldung.${f.id}`)}
                  />,
                ),
              )}
            </section>
          )}
          {schritt.mitPersonen && (
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
                      {mitNamen && namen[i] !== `${wer} ${i + 1}` ? (
                        <>
                          {namen[i]}{' '}
                          <small className={s.personNr}>
                            {wer} {i + 1}
                          </small>
                        </>
                      ) : (
                        <>
                          {wer} {i + 1}
                        </>
                      )}
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
                    {!baukasten && schritt.personenAnlegen && antworten.personen.length > 1 && (
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
                      Für {wer} {i + 1} ist kein Platz mehr frei – es kommt auf die{' '}
                      <b>Warteliste</b> und rückt nach, wenn ein Platz frei wird. Wenn du das nicht
                      möchtest: „Entfernen“.
                    </p>
                  )}
                  {plan?.[i] === 'kein' && (
                    <p className={`${s.platzHinweis} ${s.platzHinweisRot}`}>
                      Für {wer} {i + 1} ist kein Platz mehr frei, und es gibt keine Warteliste –
                      bitte „Entfernen“.
                    </p>
                  )}
                  {personFelder
                    .filter((f) => zeigen(f, i) && schritt.zeigtPerson(f))
                    .map((f) =>
                      huelle(
                        f,
                        'person',
                        <FeldEingabe
                          key={f.id}
                          feld={f}
                          pfad={`personen.${i}.${f.id}`}
                          wert={p[f.id]}
                          onWert={(w) => setPerson(i, f.id, w)}
                          {...freiEingabe(p, f.id, (k, w) => setPerson(i, k, w))}
                          fehler={fehler}
                          zusatz={baukasten?.hinweis?.(f.id)}
                          {...bedingt(f, `personen.${i}.${f.id}`, i)}
                        />,
                      ),
                    )}
                </div>
              ))}
              {e.wer !== 'einzeln' && schritt.personenAnlegen && naechster === 'kein' && (
                <p className={`${s.platzHinweis} ${s.platzHinweisRot}`} role="status">
                  <b>Kein Platz mehr frei</b> –{' '}
                  {kinder ? 'ein weiteres Kind' : 'eine weitere Person'} kann nicht angemeldet
                  werden (es gibt keine Warteliste).
                </p>
              )}
              {e.wer !== 'einzeln' && schritt.personenAnlegen && (
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
          )}
          {!schritt.letzte && (
            // F2b: Seiten vor der letzten enden mit „Weiter“ – Preis, Datenschutz und Anmelden kommen am Schluss.
            <section className={s.sec}>
              {fehler.length > 0 && (
                <p className={s.warnline} role="alert">
                  Bitte die markierten Angaben ergänzen.
                </p>
              )}
              <div className={s.schrittKnoepfe}>
                {zurueckKnopf}
                <button type="button" className={s.go} onClick={weiter}>
                  Weiter
                </button>
              </div>
            </section>
          )}
          {schritt.letzte &&
            preisFeld &&
            (e.preis.grundpreis.art === 'auswahl' || e.preis.extras.length > 0) && (
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
                        <option key={o.name} value={i} disabled={optionRest(o) === 0}>
                          {o.name} · {euroText(o.preisCent)} pro Person
                          {optionRest(o) === 0 ? ' – ausgebucht' : ''}
                        </option>
                      ))}
                    </select>
                    {gewaehlt && mehrAlsVorgesehen(gewaehlt, personenMitPlatz) && (
                      <p className={s.platzHinweis}>
                        „{gewaehlt.name}“ ist für {gewaehlt.personenJe}{' '}
                        {gewaehlt.personenJe === 1 ? 'Person' : 'Personen'} gedacht – ihr meldet{' '}
                        {personenMitPlatz} an. Passt das? Anmelden geht trotzdem.
                      </p>
                    )}
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
          {schritt.letzte && (
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
                    {...freiEingabe(antworten.anmeldung, f.id, setAnmeldung)}
                    fehler={fehler}
                    zusatz={baukasten?.hinweis?.(f.id)}
                    loeschtag={loeschtag}
                    {...bedingt(f, `anmeldung.${f.id}`)}
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
                  {e.preis.grundpreis.optionen.every((o) => optionRest(o) === 0)
                    ? 'Alle Möglichkeiten sind ausgebucht – eine Anmeldung ist gerade nicht möglich.'
                    : 'Diese Auswahl ist ausgebucht – bitte eine andere wählen.'}
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
              {/* Ohne Schritte steht „Anmelden“ wie bisher allein; mit Schritten neben „Zurück“. */}
              {schritt.mit ? (
                <div className={s.schrittKnoepfe}>
                  {zurueckKnopf}
                  <button type="submit" className={s.go} disabled={sendet} aria-busy={sendet}>
                    {sendet
                      ? 'Wird gesendet …'
                      : alleWarten
                        ? 'Auf die Warteliste'
                        : 'Verbindlich anmelden'}
                  </button>
                </div>
              ) : (
                <button type="submit" className={s.go} disabled={sendet} aria-busy={sendet}>
                  {sendet
                    ? 'Wird gesendet …'
                    : alleWarten
                      ? 'Auf die Warteliste'
                      : 'Verbindlich anmelden'}
                </button>
              )}
              {vorschau && !baukasten && (
                <p className={s.hintline}>
                  Vorschau mit Musterdaten – abgeschickt wird hier nichts.
                </p>
              )}
              {probe && <p className={s.hintline}>Probelauf – abgeschickt wird hier nichts.</p>}
            </section>
          )}
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
