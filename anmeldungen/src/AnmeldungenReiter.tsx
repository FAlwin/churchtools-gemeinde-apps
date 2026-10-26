import { useMemo, useRef, useState } from 'react';
import {
  absagePlan,
  bescheidMail,
  nachrueckPlan,
  type AbsagePlan,
  type Mail,
  type NachrueckPlan,
} from '@shared/anmeldung/bewegung';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import { Sheet } from '@ui/fenster/Sheet';
import { UnterschriftBild } from '@ui/anmeldeformular/Bausteine';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { euroText } from '@shared/anmeldung/preis';
import { zahlungTitel } from '@shared/anmeldung/zahlung';
import { unterschriftLesen } from '@shared/anmeldung/unterschrift';
import { wartenTrotzPlatz } from '@shared/anmeldung/nachpruefung';
import {
  anmeldungenAus,
  antwortZeilen,
  listenZahlen,
  type Absage,
  type AntwortZeile,
  type ListenAnmeldung,
  type ListenPerson,
} from '@shared/anmeldung/liste';
import type { GeladenerStand } from './mitglieder';
import { tagPunkt as lang } from '@shared/ct/datum';
import { anzahlText } from './anzeige';
import { AnmeldungZahlung } from './AnmeldungZahlung';
import {
  AbsagenFrage,
  FrageKnoepfe,
  MailAnsicht,
  MailKnoepfe,
  NachrueckenFrage,
  type Kopiert,
} from './AnmeldungAktion';
import { absagenLassen, nachrueckenLassen } from './bewegung';
import { VonHandFenster, type VonHandFertig } from './VonHandFenster';
import { ZurueckFenster } from './ZurueckFenster';
import { RundmailFenster } from './RundmailFenster';
import { DrucklisteFenster } from './DrucklisteFenster';
import { useSpeichern } from './useSpeichern';
import { RueckgaengigImFenster, type Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import a from './AnmeldungenReiter.module.scss';

/** Stand der Mitglieder einer Veranstaltung – für Liste und Nachprüfung (A7-1). */
export type MitgliederZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'verboten' }
  | { art: 'fertig'; stand: GeladenerStand };

type Filter = 'alle' | 'offen' | 'warte' | 'abgesagt';

/** `TT.MM.` */
const kurz = (tag: string | null) => (tag ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.` : '');
const ganzerName = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();
const personLink = (id: number) => `${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${id}/`;

function Antworten({ zeilen }: { zeilen: AntwortZeile[] }) {
  if (zeilen.length === 0) return null;
  return (
    <dl className={a.antworten}>
      {zeilen.map((z) => {
        const striche = z.striche ? unterschriftLesen(z.striche) : null;
        return (
          <div key={z.frage} className={a.antwort}>
            <dt>{z.frage}</dt>
            <dd>
              {striche && (
                <span className={a.unterschrift}>
                  <UnterschriftBild striche={striche} />
                </span>
              )}
              {z.text && <span className={a.mehrzeilig}>{z.text}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PersonPille({ p }: { p: ListenPerson }) {
  return p.status === 'wartet' ? (
    <span className={`${a.pille} ${a.pilleWarte}`}>
      Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}
    </span>
  ) : (
    <span className={`${a.pille} ${a.pilleOk}`}>hat einen Platz</span>
  );
}

function ZahlungPille({ x, kostet }: { x: ListenAnmeldung; kostet: boolean }) {
  if (!kostet || x.betragCent === null || x.betragCent <= 0) return null;
  if (x.bezahlt)
    return (
      <span className={`${a.pille} ${a.pilleOk}`}>
        ✓ {x.zahlart ?? 'bezahlt'}
        {x.bezahltAm ? ` ${kurz(x.bezahltAm)}` : ''}
      </span>
    );
  return x.zahlungOffen ? <span className={`${a.pille} ${a.pilleOffen}`}>offen</span> : null;
}

/** Was das Fenster gerade zeigt: die Anmeldung, eine Rückfrage oder die fertige Mail (A7-3). */
export type FensterModus =
  | { art: 'nach'; personId: number }
  | { art: 'ab'; personId: number }
  | { art: 'mail'; mail: Mail }
  | null;

/** Was zuletzt im Fenster geschah – mit „Rückgängig“ (falls möglich) und der Mail an die Familie. */
export interface FensterMeldung {
  aenderung: Aenderung;
  mail: Mail | null;
  /** Ein Satz unter der Zeile (A7-4: „Die neu angelegte Person bleibt in ChurchTools“). */
  hinweis?: string;
}

/** Plätze und Warteliste – für Nachrücken und Absagen. */
export interface PlatzLage {
  belegt: number;
  max: number | null;
  wartende: { personId: number; name: string }[];
}

/**
 * **Das Fenster einer Anmeldung** – alle Antworten (A7-1), Zahlungen (A7-2), Nachrücken und Absagen mit Rückfrage und
 * fertiger Mail (A7-3). Was geändert wurde, steht oben mit „Rückgängig“ (Alwin, 19.10.2026: im Fenster).
 */
function AnmeldungAnsehen({
  x,
  e,
  kostet,
  onClose,
  id,
  veranstaltung,
  zahlarten,
  heute,
  darf,
  lage,
  start,
  meldung,
  onGemeldet,
  onRueckgaengig,
  onPersonDazu,
  onZurueckholen,
}: {
  x: ListenAnmeldung;
  e: OeffentlicheEinstellungen;
  kostet: boolean;
  onClose: () => void;
  id: number;
  veranstaltung: string;
  zahlarten: string[];
  heute: string;
  darf: boolean;
  lage: PlatzLage;
  /** Gleich mit einer Rückfrage öffnen (Knopf im Hinweis oben). */
  start: FensterModus;
  meldung: FensterMeldung | null;
  onGemeldet: (m: FensterMeldung) => void;
  onRueckgaengig: () => void;
  /** „＋ Person dazu“ (A7-4b) – nur mit Anmelde-Nr., sonst gäbe es nichts, das die Person zur Anmeldung zählt. */
  onPersonDazu?: () => void;
  /** „Zurückholen“ an einer Abgesagten (A7-4c). */
  onZurueckholen?: (b: Absage) => void;
}) {
  const [modus, setModus] = useState<FensterModus>(start);
  const [kopiert, setKopiert] = useState<Kopiert>(null);
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  const einmal = antwortZeilen(e.formular.anmeldung, x.einmal, e.ctFelder);
  const kontakt = e.ctFelder.kontakt === undefined ? undefined : x.einmal[e.ctFelder.kontakt];
  const fuerAlle =
    x.personen.length === 1
      ? 'Für die Anmeldung'
      : `Für die ganze Anmeldung · gilt für ${x.personen.map((p) => p.vor).join(', ')}`;
  const person = (pid: number) => x.personen.find((p) => p.personId === pid);
  const mailFuer = (
    art: 'nachgerueckt' | 'abgesagt',
    p: ListenPerson,
    betragCent: number,
    rueckzahlungCent: number,
  ) => bescheidMail(e, { art, veranstaltung, x, person: p, betragCent, rueckzahlungCent, heute });

  const nachPlan =
    modus?.art === 'nach' && person(modus.personId)?.status === 'wartet'
      ? nachrueckPlan(e, x, modus.personId, lage, heute)
      : null;
  const abPlan =
    modus?.art === 'ab' && person(modus.personId) ? absagePlan(e, x, modus.personId, heute) : null;

  const titel = nachPlan
    ? `${nachPlan.name} nachrücken lassen?`
    : abPlan
      ? `${abPlan.name} absagen?`
      : modus?.art === 'mail'
        ? 'Mail schreiben'
        : x.wer;

  const nachJa = (plan: NachrueckPlan) => {
    const p = person(plan.personId)!;
    void speichern(
      () => nachrueckenLassen(id, e, plan),
      () => {
        setModus(null);
        onGemeldet({
          aenderung: { text: `${plan.name} ist nachgerückt.`, rueckgaengig: null },
          mail: mailFuer('nachgerueckt', p, plan.zahlung?.betragCent ?? 0, 0),
        });
      },
    );
  };
  const abJa = (plan: AbsagePlan) => {
    const p = person(plan.personId)!;
    let zurueck: () => Promise<void> = async () => {};
    void speichern(
      async () => {
        zurueck = await absagenLassen(id, e, plan);
      },
      () => {
        setModus(null);
        onGemeldet({
          aenderung: { text: `${plan.name} ist abgesagt.`, rueckgaengig: () => zurueck() },
          mail: mailFuer(
            'abgesagt',
            p,
            0,
            plan.haupt?.rueckzahlungCent ?? plan.rueckzahlungOhneRestCent,
          ),
        });
      },
    );
  };
  const zurAnmeldung = () => {
    setKopiert(null);
    setModus(null);
  };

  // Eine Rückfrage oder die Mail ersetzt den Inhalt – mit ihren Knöpfen unten (E6-O F4); sonst nur „Schließen“.
  const inhalt = nachPlan ? (
    <NachrueckenFrage plan={nachPlan} vor={person(nachPlan.personId)!.vor} fehler={fehler} />
  ) : abPlan ? (
    <AbsagenFrage
      plan={abPlan}
      vor={person(abPlan.personId)!.vor}
      uebergabeAn={abPlan.uebergabeAn === null ? null : (person(abPlan.uebergabeAn)?.vor ?? null)}
      belegt={lage.belegt}
      max={lage.max}
      fehler={fehler}
    />
  ) : modus?.art === 'mail' ? (
    <MailAnsicht mail={modus.mail} kopiert={kopiert} />
  ) : null;
  const knoepfe = nachPlan ? (
    <FrageKnoepfe
      arbeitet={arbeitet}
      ja={nachPlan.neuesMax !== null ? 'Plätze erhöhen und nachrücken' : 'Nachrücken lassen'}
      onJa={() => nachJa(nachPlan)}
      onAbbrechen={zurAnmeldung}
    />
  ) : abPlan ? (
    <FrageKnoepfe
      arbeitet={arbeitet}
      ja="Ja, absagen"
      gefahr
      onJa={() => abJa(abPlan)}
      onAbbrechen={zurAnmeldung}
    />
  ) : modus?.art === 'mail' ? (
    <MailKnoepfe mail={modus.mail} onZurueck={zurAnmeldung} onKopiert={setKopiert} />
  ) : null;

  return (
    <Sheet
      title={titel}
      onClose={onClose}
      beschaeftigt={arbeitet}
      cancelLabel={inhalt ? null : 'Schließen'}
      knoepfe={knoepfe}
    >
      {inhalt ?? (
        <>
          <p className={a.unterTitel}>
            {x.nr && (
              <>
                Anmelde-Nr. <span className={v.nr}>{x.nr}</span> ·{' '}
              </>
            )}
            {x.angemeldetAm && <>angemeldet am {lang(x.angemeldetAm)}</>}
            {x.vonHand && <> · von Hand</>}
            {x.email && <> · {x.email}</>}
          </p>

          {meldung && (
            <>
              <RueckgaengigImFenster
                key={meldung.aenderung.text}
                aenderung={meldung.aenderung}
                onRueckgaengig={onRueckgaengig}
                zusatz={
                  meldung.mail && (
                    <button
                      type="button"
                      className={a.nachKnopf}
                      onClick={() => setModus({ art: 'mail', mail: meldung.mail! })}
                    >
                      Mail schreiben
                    </button>
                  )
                }
              />
              {meldung.hinweis && <p className={a.leise}>{meldung.hinweis}</p>}
            </>
          )}

          {(einmal.length > 0 || kontakt) && (
            <section className={a.teil}>
              <h3>{fuerAlle}</h3>
              {x.einmalAusVerlauf && (
                <p className={a.leise}>
                  Aus dem Verlauf von ChurchTools – die Person, bei der es stand, hat abgesagt.
                </p>
              )}
              <Antworten
                zeilen={[
                  ...(kontakt ? [{ frage: 'Angemeldet von', text: kontakt }] : []),
                  ...einmal,
                ]}
              />
            </section>
          )}

          <section className={a.teil}>
            <h3>{x.personen.length === 1 ? 'Person' : 'Personen'}</h3>
            {x.personen.map((p) => (
              <div key={p.personId} className={a.person}>
                <div className={a.personOben}>
                  <b>
                    {ganzerName(p)}
                    {p.alter !== null && `, ${p.alter}`}
                  </b>
                  <PersonPille p={p} />
                </div>
                <Antworten
                  zeilen={[
                    ...(p.geburtstag ? [{ frage: 'Geburtsdatum', text: lang(p.geburtstag) }] : []),
                    ...antwortZeilen(e.formular.person, p.werte, e.ctFelder),
                  ]}
                />
                <div className={a.personAktionen}>
                  {darf && p.status === 'wartet' && (
                    <button
                      type="button"
                      className={a.nachKnopf}
                      onClick={() => setModus({ art: 'nach', personId: p.personId })}
                    >
                      Nachrücken lassen
                    </button>
                  )}
                  <a className={s.link} href={personLink(p.personId)}>
                    In ChurchTools
                    <Icon name="external" size={13} />
                  </a>
                  {darf && (
                    <button
                      type="button"
                      className={a.absagenLink}
                      onClick={() => setModus({ art: 'ab', personId: p.personId })}
                    >
                      Absagen
                    </button>
                  )}
                </div>
              </div>
            ))}
            {onPersonDazu && (
              <button type="button" className={a.linkKnopf} onClick={onPersonDazu}>
                ＋ Person dazu
              </button>
            )}
          </section>

          {kostet &&
            (x.zahlungen.length > 1 ? (
              <section className={a.teil}>
                <h3>Zahlungen</h3>
                {x.zahlungen.map((z) => (
                  <AnmeldungZahlung
                    key={`${z.personId}-${z.betragCent}-${z.bezahlt}`}
                    id={id}
                    zahlung={z}
                    wer={x.wer}
                    titel={zahlungTitel(z)}
                    zahlarten={zahlarten}
                    heute={heute}
                    darf={darf}
                    onGeaendert={(aenderung) => onGemeldet({ aenderung, mail: null })}
                  />
                ))}
                <p className={a.summe}>
                  <span>Zusammen</span>
                  <b>{euroText(x.betragCent ?? 0)}</b>
                </p>
              </section>
            ) : (
              x.zahlungen[0] && (
                <AnmeldungZahlung
                  key={`${x.zahlungen[0].personId}-${x.zahlungen[0].betragCent}-${x.zahlungen[0].bezahlt}`}
                  id={id}
                  zahlung={x.zahlungen[0]}
                  wer={x.wer}
                  zahlarten={zahlarten}
                  heute={heute}
                  darf={darf}
                  onGeaendert={(aenderung) => onGemeldet({ aenderung, mail: null })}
                />
              )
            ))}

          {x.abgesagt.length > 0 && (
            <section className={a.teil}>
              <h3>Abgesagt</h3>
              {x.abgesagt.map((b) => (
                <p key={b.personId} className={a.leise}>
                  {b.name} – {absageText(b)}
                  {onZurueckholen && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className={a.linkKnopf}
                        onClick={() => onZurueckholen(b)}
                      >
                        Zurückholen
                      </button>
                    </>
                  )}
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </Sheet>
  );
}

const absageText = (b: Absage) =>
  `am ${kurz(b.am)} ${b.selbst ? 'selbst abgesagt (Link in der Mail)' : 'vom Team entfernt'}`;

/**
 * **Reiter „Anmeldungen“** (A7-1, Entwurf `a7-anmeldungen-v2`) – eine Zeile je Anmeldung, Zahlen, Hinweis „frei, aber
 * jemand wartet“ (mit „Nachrücken lassen“, A7-3), Filter und Suche; Klick öffnet das Fenster der Anmeldung.
 */
export function AnmeldungenReiter({
  id,
  veranstaltung,
  e,
  maxPlaetze,
  warteliste,
  anmeldeschluss,
  entwurf,
  zustand,
  stichtag,
  heute,
  darf,
  zahlarten,
  gemeinde = null,
  onNeuLaden,
  onGespeichert,
}: {
  id: number;
  /** Name der Veranstaltung – für die Mail an die Familie (A7-3). */
  veranstaltung: string;
  e: OeffentlicheEinstellungen;
  maxPlaetze: number | null;
  /** Gibt es eine Warteliste? (Anmeldung von Hand, A7-4) */
  warteliste: boolean;
  /** Ende des Anmeldezeitraums (ISO) – von Hand geht es auch danach. */
  anmeldeschluss: string | null;
  entwurf: boolean;
  zustand: MitgliederZustand | null;
  /** Erster Tag der Veranstaltung (Alter), sonst heute. */
  stichtag: string;
  heute: string;
  /** Darf ändern (bezahlt, Betrag) – ChurchTools prüft es beim Schreiben ohnehin. */
  darf: boolean;
  /** Die Zahlarten dieser Veranstaltung (A7-2). */
  zahlarten: string[];
  /** Name der Gemeinde aus ChurchTools – oben auf der Druckliste (A8). */
  gemeinde?: string | null;
  onNeuLaden: () => void;
  /** Nach einer Änderung (und nach „Rückgängig“): Die Seite lädt neu – „Rückgängig“ selbst steht im Fenster. */
  onGespeichert: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  // Die letzte Änderung im offenen Fenster – mit dem Fenster weg.
  const [meldung, setMeldung] = useState<FensterMeldung | null>(null);
  const [startModus, setStartModus] = useState<FensterModus>(null);
  // „Von Hand“ (A7-4a) – mit `dazu` zu einer bestehenden Anmeldung (A7-4b). Das Fenster der Anmeldung ist so lange zu
  // (kein Fenster im Fenster).
  const [vonHand, setVonHand] = useState<{ dazu: ListenAnmeldung | null } | null>(null);
  // Zurückholen (A7-4c) – `von`: die Anmeldung, in die „Abbrechen“ zurückführt.
  const [zurueck, setZurueck] = useState<{ b: Absage; von: string | null } | null>(null);
  const [rundmail, setRundmail] = useState(false);
  const [druck, setDruck] = useState(false);
  const oeffnen = (k: string | null, modus: FensterModus = null) => {
    setOffen(k);
    setStartModus(modus);
    setMeldung(null);
  };
  // Hat die letzte Person einer Anmeldung abgesagt, ist sie aus der Liste weg – das Fenster bleibt für „Rückgängig“.
  const zuletztOffen = useRef<ListenAnmeldung | null>(null);
  // Beim Neuladen (nach einer Änderung) bleibt der letzte Stand stehen – sonst ginge das offene Fenster zu.
  const letzter = useRef<GeladenerStand | null>(null);
  if (zustand?.art === 'fertig') letzter.current = zustand.stand;
  const stand =
    zustand?.art === 'fertig' ? zustand.stand : zustand?.art === 'laedt' ? letzter.current : null;
  const liste = useMemo(
    () => (stand ? anmeldungenAus(e, stand, stichtag) : []),
    [e, stand, stichtag],
  );

  if (entwurf || !zustand)
    return (
      <section className={`${s.karte} ${a.leer}`}>
        <b>Noch keine Anmeldungen.</b>
        <span>
          Die Veranstaltung ist noch ein Entwurf. Nach dem Freigeben steht hier, wer sich anmeldet.
        </span>
      </section>
    );
  if (zustand.art === 'laedt' && !stand)
    return <p className={s.leise}>Anmeldungen werden geladen …</p>;
  if (zustand.art === 'verboten')
    return (
      <p className={v.hinweis}>
        Die Anmeldungen sieht, wer in ChurchTools die Mitglieder dieser Gruppe sehen darf.
      </p>
    );
  if (zustand.art === 'fehler')
    return (
      <div className={v.warnung}>
        {zustand.text}{' '}
        <button type="button" className={v.bearbeiten} onClick={onNeuLaden}>
          Nochmal
        </button>
      </div>
    );

  const z = listenZahlen(e, liste);
  const plaetze = { belegt: z.belegt, wartend: z.wartend, max: maxPlaetze };
  const wartende = liste
    .flatMap((x) => x.personen.filter((p) => p.status === 'wartet').map((p) => ({ p, x })))
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const absagen = [...stand!.absagen].sort((u, w) => w.am.localeCompare(u.am));
  const frei = maxPlaetze === null ? null : maxPlaetze - z.belegt;
  const q = suche.trim().toLowerCase();
  const passt = (...texte: (string | null)[]) =>
    !q || texte.some((t) => t?.toLowerCase().includes(q));
  const zuX = (x: ListenAnmeldung) => passt(x.wer, x.nr, ...x.personen.map(ganzerName));
  const zeilen =
    filter === 'offen' ? liste.filter((x) => x.zahlungOffen && zuX(x)) : liste.filter(zuX);
  const ausgewaehlt = offen ? liste.find((x) => x.schluessel === offen) : undefined;
  if (ausgewaehlt) zuletztOffen.current = ausgewaehlt;
  // Weg aus der Liste (letzte Person abgesagt), aber eben geändert → das Fenster bleibt mit „Rückgängig“ stehen.
  const fensterX =
    ausgewaehlt ??
    (offen && meldung && zuletztOffen.current?.schluessel === offen ? zuletztOffen.current : null);
  const lage: PlatzLage = {
    belegt: z.belegt,
    max: maxPlaetze,
    wartende: wartende.map(({ p }) => ({ personId: p.personId, name: ganzerName(p) })),
  };
  const nrFeld = e.ctFelder.nr;
  const gehoertZu = (b: Absage) => {
    const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
    return nr ? liste.find((x) => x.nr === nr) : undefined;
  };

  /** Nach „Von Hand“, „Person dazu“ und „Zurückholen“: Die Anmeldung öffnet sich, sobald sie geladen ist. */
  const fertig = (x: VonHandFertig) => {
    setOffen(x.nr);
    setStartModus(null);
    setMeldung({ aenderung: x.aenderung, mail: x.mail, hinweis: x.hinweis });
    onGespeichert();
  };

  const filterKnopf = (f: Filter, text: string, n: number) => (
    <button
      type="button"
      className={s.filterChip}
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
    >
      {text}
      <span className={s.zaehler}>{n}</span>
    </button>
  );

  return (
    <div className={a.reiter}>
      <div className={a.zahlen}>
        <div className={a.zahl}>
          <span>Plätze</span>
          <b>{maxPlaetze === null ? z.belegt : `${z.belegt} von ${maxPlaetze}`}</b>
          <small>{anzahlText(z.anmeldungen, 'Anmeldung', 'Anmeldungen')}</small>
        </div>
        <div className={a.zahl}>
          <span>Warteliste</span>
          <b className={z.wartend ? v.pruefInfo : undefined}>{z.wartend}</b>
          <small>
            {frei === null
              ? 'unbegrenzt'
              : frei > 0
                ? `${anzahlText(frei, 'Platz', 'Plätze')} frei`
                : 'kein Platz frei'}
          </small>
        </div>
        {z.kostet && (
          <div className={a.zahl}>
            <span>Zahlung offen</span>
            <b>{euroText(z.offenCent)}</b>
            <small>
              {anzahlText(z.offen, 'Anmeldung', 'Anmeldungen')} · {euroText(z.eingegangenCent)} da
            </small>
          </div>
        )}
      </div>

      {wartenTrotzPlatz(plaetze) && wartende[0] && (
        <p className={v.pruefHinweis}>
          <b>
            {frei === null ? 'Es ist Platz frei' : `${anzahlText(frei, 'Platz', 'Plätze')} frei`} –{' '}
            {z.wartend === 1 ? '1 wartet' : `${z.wartend} warten`}.
          </b>{' '}
          ChurchTools lässt niemanden von selbst nachrücken. Als Nächste wartet{' '}
          {ganzerName(wartende[0].p)}
          {wartende[0].x.angemeldetAm && ` (seit ${kurz(wartende[0].x.angemeldetAm)})`}.
          {darf && (
            <>
              {' '}
              <button
                type="button"
                className={a.nachKnopf}
                onClick={() =>
                  oeffnen(wartende[0].x.schluessel, {
                    art: 'nach',
                    personId: wartende[0].p.personId,
                  })
                }
              >
                {wartende[0].p.vor} nachrücken lassen
              </button>
            </>
          )}
        </p>
      )}

      <section className={s.karte} aria-label="Anmeldungen">
        <div className={s.filter}>
          {filterKnopf('alle', 'Alle', liste.length)}
          {z.kostet && filterKnopf('offen', 'Zahlung offen', z.offen)}
          {filterKnopf('warte', 'Warteliste', z.wartend)}
          {filterKnopf('abgesagt', 'Abgesagt', absagen.length)}
          <input
            type="search"
            className={a.suche}
            placeholder="Name suchen"
            aria-label="Name suchen"
            value={suche}
            onChange={(ev) => setSuche(ev.target.value)}
          />
          {liste.length > 0 && (
            <button type="button" className={a.nachKnopf} onClick={() => setDruck(true)}>
              ⎙ Druckliste
            </button>
          )}
          {darf && liste.length > 0 && (
            <button type="button" className={a.nachKnopf} onClick={() => setRundmail(true)}>
              ✉ Rundmail
            </button>
          )}
          {darf && (
            <button
              type="button"
              className={a.nachKnopf}
              onClick={() => setVonHand({ dazu: null })}
            >
              ＋ Von Hand
            </button>
          )}
        </div>

        {(filter === 'alle' || filter === 'offen') && (
          <ul className={s.liste}>
            {zeilen.map((x) => (
              <li key={x.schluessel} className={a.eintrag}>
                <button type="button" className={a.zeile} onClick={() => oeffnen(x.schluessel)}>
                  <span className={a.links}>
                    <b>
                      {x.wer}{' '}
                      {x.nr ? (
                        <span className={v.nr}>{x.nr}</span>
                      ) : (
                        <span className={s.chip}>ohne Nr.</span>
                      )}
                    </b>
                    <span className={a.personen}>
                      {x.personen.map((p) => (
                        <span key={p.personId} className={a.p}>
                          {p.vor}
                          {p.alter !== null && ` ${p.alter}`}
                          {p.status === 'wartet' && (
                            <span className={`${a.pille} ${a.pilleWarte}`}>
                              Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={a.geld}>
                    {/* Alle warten: Das Formular schreibt „0,00 €“ – gezahlt wird erst beim Nachrücken (22.10.2026). */}
                    {!z.kostet ? null : x.personen.every((p) => p.status === 'wartet') &&
                      !x.betragCent ? (
                      <small>Betrag beim Nachrücken</small>
                    ) : x.betragCent !== null ? (
                      <b>{euroText(x.betragCent)}</b>
                    ) : null}
                    <ZahlungPille x={x} kostet={z.kostet} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {filter === 'warte' && (
          <ul className={s.liste}>
            {wartende
              .filter(({ p, x }) => passt(ganzerName(p), x.wer, x.nr))
              .map(({ p, x }) => (
                <li key={p.personId} className={a.eintrag}>
                  <button type="button" className={a.zeile} onClick={() => oeffnen(x.schluessel)}>
                    <span className={a.links}>
                      <b>
                        {p.warteplatz ? `${p.warteplatz} · ` : ''}
                        {ganzerName(p)} {x.nr && <span className={v.nr}>{x.nr}</span>}
                      </b>
                      <small className={a.leise}>
                        {x.angemeldetAm && `wartet seit ${kurz(x.angemeldetAm)} · `}
                        angemeldet von {x.wer}
                        {x.personen.some((o) => o.status === 'aktiv') &&
                          ` (${x.personen
                            .filter((o) => o.status === 'aktiv')
                            .map((o) => o.vor)
                            .join(', ')} hat einen Platz)`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {filter === 'abgesagt' && (
          <ul className={s.liste}>
            {absagen
              .filter((b) => passt(b.name))
              .map((b) => {
                const x = gehoertZu(b);
                const inhalt = (
                  <span className={a.links}>
                    <b>
                      {b.name}{' '}
                      {nrFeld !== undefined && b.werte[nrFeld] && (
                        <span className={v.nr}>{b.werte[nrFeld]}</span>
                      )}
                    </b>
                    <small className={a.leise}>
                      {absageText(b)}
                      {b.warVorher === 'wartet' && ' · stand auf der Warteliste'}
                      {x && ` · gehörte zu ${x.wer}`}
                    </small>
                  </span>
                );
                // Wer ändern darf, holt mit einem Klick zurück (A7-4c).
                return darf ? (
                  <li key={b.personId} className={a.eintrag}>
                    <button
                      type="button"
                      className={a.zeile}
                      onClick={() => setZurueck({ b, von: null })}
                    >
                      {inhalt}
                      <span className={a.geld}>
                        <small>Zurückholen</small>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={b.personId} className={`${a.eintrag} ${a.zeileStill}`}>
                    {inhalt}
                  </li>
                );
              })}
          </ul>
        )}

        {((filter === 'alle' && zeilen.length === 0) ||
          (filter === 'offen' && zeilen.length === 0) ||
          (filter === 'warte' && wartende.length === 0) ||
          (filter === 'abgesagt' && absagen.length === 0)) && (
          <p className={a.leerZeile}>
            {q
              ? `Niemand mit „${suche.trim()}“ gefunden.`
              : filter === 'offen'
                ? 'Alle haben bezahlt.'
                : filter === 'warte'
                  ? 'Niemand auf der Warteliste.'
                  : filter === 'abgesagt'
                    ? 'Niemand hat abgesagt.'
                    : 'Noch keine Anmeldungen.'}
          </p>
        )}

        <p className={v.pruefFuss}>
          Sortiert nach Anmeldetag. Eine Zeile je Anmeldung; ältere Anmeldungen ohne Nr. stehen je
          Person einzeln. Die Leitung steht nicht in der Liste.
          {stand!.verlaufGekuerzt &&
            ' Der Verlauf in ChurchTools ist sehr lang – die ältesten Absagen fehlen hier.'}{' '}
          <button type="button" className={a.linkKnopf} onClick={onNeuLaden}>
            Neu laden
          </button>
        </p>
      </section>

      {vonHand && (
        <VonHandFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          anmeldeschluss={anmeldeschluss}
          dabei={new Set(stand!.mitglieder.map((m) => m.personId))}
          abgesagt={new Set(stand!.absagen.map((b) => b.personId))}
          dazu={vonHand.dazu}
          onZurueckholen={(personId) => {
            const b = stand!.absagen.find((y) => y.personId === personId);
            if (!b) return;
            setVonHand(null);
            setZurueck({ b, von: null });
          }}
          onClose={() => {
            // Abbrechen bei „Person dazu“ führt zurück in die Anmeldung.
            if (vonHand.dazu) oeffnen(vonHand.dazu.schluessel);
            setVonHand(null);
          }}
          onFertig={(x) => {
            setVonHand(null);
            fertig(x);
          }}
        />
      )}

      {rundmail && (
        <RundmailFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          liste={liste}
          // Wie der Filter der Liste – „Zahlung offen“ beginnt mit der Zahlungserinnerung.
          startFilter={filter === 'offen' ? 'offen' : filter === 'warte' ? 'warte' : 'alle'}
          onClose={() => setRundmail(false)}
        />
      )}

      {druck && (
        <DrucklisteFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          gemeinde={gemeinde}
          liste={liste}
          darf={darf}
          onGemerkt={onGespeichert}
          onClose={() => setDruck(false)}
        />
      )}

      {zurueck && (
        <ZurueckFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          b={zurueck.b}
          liste={liste}
          onClose={() => {
            if (zurueck.von) oeffnen(zurueck.von);
            setZurueck(null);
          }}
          onFertig={(x) => {
            setZurueck(null);
            fertig(x);
          }}
        />
      )}

      {fensterX && (
        <AnmeldungAnsehen
          key={fensterX.schluessel}
          x={fensterX}
          e={e}
          kostet={z.kostet}
          onClose={() => oeffnen(null)}
          id={id}
          veranstaltung={veranstaltung}
          zahlarten={zahlarten}
          heute={heute}
          darf={darf && !!ausgewaehlt}
          lage={lage}
          start={startModus}
          meldung={meldung}
          onGemeldet={(neu) => {
            setMeldung(neu);
            setStartModus(null);
            onGespeichert();
          }}
          onRueckgaengig={onGespeichert}
          onZurueckholen={
            darf && ausgewaehlt
              ? (b) => {
                  setZurueck({ b, von: ausgewaehlt.schluessel });
                  oeffnen(null);
                }
              : undefined
          }
          onPersonDazu={
            darf && ausgewaehlt?.nr
              ? () => {
                  setVonHand({ dazu: ausgewaehlt });
                  oeffnen(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
