import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
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
import {
  anmeldungsSpalten,
  personZeilen,
  personZellText,
  personenSortiert,
  personenSpalten,
  personSumme,
  type PersonZeile,
  passtZurSuche,
  sortiert,
  summe,
  zellText,
  type Sortierung,
  type TabellenSpalte,
} from '@shared/anmeldung/tabelle';
import { AnmeldungenTabelle } from './AnmeldungenTabelle';
import { tagPunkt as lang } from '@shared/ct/datum';
import { anzahlText, mailAnbieten } from './anzeige';
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

/** Was die Liste zeigt – auch das Ziel der Kennzahl-Kacheln oben auf der Seite (U1). */
export type ListenFilter = 'alle' | 'offen' | 'warte' | 'abgesagt';

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
  /** Der Satz gilt nur, solange „Rückgängig“ noch aussteht (A9-1: „… schickt dabei die Bestätigung noch einmal“). */
  hinweisBisRueckgaengig?: boolean;
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
  mitBestaetigung = false,
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
  /** Schickt ChurchTools beim Eintragen die Bestätigung (A9-1)? Dann sagt „Rückgängig“ nach dem Absagen das vorher. */
  mitBestaetigung?: boolean;
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
          mail: mailAnbieten(
            'nachruecken',
            mitBestaetigung,
            mailFuer('nachgerueckt', p, plan.zahlung?.betragCent ?? 0, 0),
          ),
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
          // A9-1 (Alwin, 24.10.2026): Rückgängig trägt neu ein – die Routine schickt die Bestätigung noch einmal.
          ...(mitBestaetigung
            ? {
                hinweis: `„Rückgängig“ trägt ${p.vor} wieder ein – ChurchTools schickt dabei die Bestätigung noch einmal.`,
                hinweisBisRueckgaengig: true,
              }
            : {}),
          mail: mailAnbieten(
            'absage',
            mitBestaetigung,
            mailFuer(
              'abgesagt',
              p,
              0,
              plan.haupt?.rueckzahlungCent ?? plan.rueckzahlungOhneRestCent,
            ),
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
    <NachrueckenFrage
      plan={nachPlan}
      vor={person(nachPlan.personId)!.vor}
      mitBestaetigung={mitBestaetigung}
      fehler={fehler}
    />
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
                    <FensterKnopf
                      art="zweit"
                      onClick={() => setModus({ art: 'mail', mail: meldung.mail! })}
                    >
                      Mail schreiben
                    </FensterKnopf>
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
                    <FensterKnopf
                      art="hell"
                      onClick={() => setModus({ art: 'nach', personId: p.personId })}
                    >
                      Nachrücken lassen
                    </FensterKnopf>
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
 * **Bereich „Anmeldungen“** (A7-1, seit U2-1 als Tabelle, Entwurf `u2-tabelle-v1`) – Reiter Alle / Zahlung offen /
 * Warteliste / Abgesagt, eine Zeile je Anmeldung, Suche, Sortieren, Summenzeile; im Reiter Warteliste der Hinweis
 * „frei, aber jemand wartet“ (mit „Nachrücken lassen“, A7-3). Klick in eine Zeile öffnet das Fenster der Anmeldung.
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
  mitBestaetigung = false,
  startFilter = 'alle',
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
  /** Bestätigungsmails eingerichtet (A9-1). */
  mitBestaetigung?: boolean;
  /** Womit die Liste beginnt – die Kennzahl-Kacheln oben auf der Seite springen so in die passende Ansicht (U1). */
  startFilter?: ListenFilter;
}) {
  const [filter, setFilter] = useState<ListenFilter>(startFilter);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>(null);
  // Eine Zeile je Anmeldung oder je Person (U2-2) – gilt in allen Reitern außer „Abgesagt“ (Absagen sind je Person).
  const [jePerson, setJePerson] = useState(false);
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
        <FensterKnopf art="zweit" onClick={onNeuLaden}>
          Nochmal
        </FensterKnopf>
      </div>
    );

  const z = listenZahlen(e, liste);
  const plaetze = { belegt: z.belegt, wartend: z.wartend, max: maxPlaetze };
  const wartende = liste
    .flatMap((x) => x.personen.filter((p) => p.status === 'wartet').map((p) => ({ p, x })))
    .sort((u, w) => (u.p.warteplatz ?? 999) - (w.p.warteplatz ?? 999));
  const absagen = [...stand!.absagen].sort((u, w) => w.am.localeCompare(u.am));
  const frei = maxPlaetze === null ? null : maxPlaetze - z.belegt;
  // Je Reiter die Anmeldungen (U2-1) – die Anzahl am Reiter ist die Zahl der Zeilen.
  const imReiter = {
    alle: liste,
    offen: liste.filter((x) => x.zahlungOffen),
    warte: liste.filter((x) => x.personen.some((p) => p.status === 'wartet')),
  };
  const zeilen =
    filter === 'abgesagt'
      ? []
      : sortiert(
          e,
          imReiter[filter].filter((x) => passtZurSuche(x, suche)),
          sortierung,
          filter === 'warte',
        );
  // Dieselben Reiter je Person: Zahlung offen = die Personen einer Anmeldung mit offener Zahlung.
  const personenImReiter = {
    alle: personZeilen(liste),
    offen: personZeilen(imReiter.offen),
    warte: personZeilen(liste).filter((y) => y.p.status === 'wartet'),
  };
  const personenGezeigt =
    filter === 'abgesagt' || !jePerson
      ? []
      : personenSortiert(
          e,
          personenImReiter[filter].filter((y) =>
            passtZurSuche({ wer: y.x.wer, nr: y.x.nr, personen: [y.p] }, suche),
          ),
          sortierung,
          filter === 'warte',
        );
  const absageZeilen = absagen.filter((b) =>
    passtZurSuche({ wer: b.name, nr: null, personen: [] }, suche),
  );
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
    setMeldung({
      aenderung: x.aenderung,
      mail: mailAnbieten('eintragen', mitBestaetigung, x.mail),
      hinweis: x.hinweis,
    });
    onGespeichert();
  };

  const wechseln = (f: ListenFilter) => {
    setFilter(f);
    setSortierung(null);
  };
  const zahlen = jePerson
    ? {
        alle: personenImReiter.alle.length,
        offen: personenImReiter.offen.length,
        warte: personenImReiter.warte.length,
      }
    : { alle: liste.length, offen: imReiter.offen.length, warte: imReiter.warte.length };
  const reiter: Reiter<ListenFilter>[] = [
    { id: 'alle', label: 'Alle', icon: 'people', zahl: zahlen.alle },
    ...(z.kostet
      ? [
          {
            id: 'offen' as const,
            label: 'Zahlung offen',
            icon: 'check' as const,
            zahl: zahlen.offen,
          },
        ]
      : []),
    { id: 'warte', label: 'Warteliste', icon: 'clock', zahl: zahlen.warte },
    { id: 'abgesagt', label: 'Abgesagt', icon: 'user-slash', zahl: absagen.length },
  ];
  const strich = <span className={a.strich}>–</span>;

  /** Was in einer Zelle steht – Personen, Nr., Betrag und Bezahlt wie bisher in der Liste, Fragen als Text. */
  const zelle = (k: string, x: ListenAnmeldung): ReactNode => {
    switch (k) {
      case 'name':
        return x.wer;
      case 'nr':
        return x.nr ? (
          <span className={v.nr}>{x.nr}</span>
        ) : (
          <span className={s.chip}>ohne Nr.</span>
        );
      case 'personen':
        return (
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
        );
      case 'betrag':
        // Alle warten: Das Formular schreibt „0,00 €“ – gezahlt wird erst beim Nachrücken (22.10.2026).
        return x.personen.every((p) => p.status === 'wartet') && !x.betragCent ? (
          <small className={a.leise}>beim Nachrücken</small>
        ) : x.betragCent !== null ? (
          euroText(x.betragCent)
        ) : (
          strich
        );
      case 'bezahlt':
        return <ZahlungPille x={x} kostet={z.kostet} />;
    }
    const text = zellText(e, k, x);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  /** Je Person (U2-2): Status als Pille wie in der Spalte „Personen“, Nr., Betrag und Bezahlt der Anmeldung wie dort. */
  const personZelle = (k: string, y: PersonZeile): ReactNode => {
    switch (k) {
      case 'status':
        return y.p.status === 'wartet' ? (
          <span className={`${a.pille} ${a.pilleWarte}`}>
            Warteliste{y.p.warteplatz ? ` ${y.p.warteplatz}` : ''}
          </span>
        ) : (
          'Platz'
        );
      case 'nr':
      case 'betrag':
      case 'bezahlt':
        return zelle(k, y.x);
    }
    const text = personZellText(e, k, y);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  const absageSpalten: TabellenSpalte[] = [
    { schluessel: 'name', titel: 'Name', zahl: false },
    ...(nrFeld !== undefined ? [{ schluessel: 'nr', titel: 'Nr.', zahl: false }] : []),
    { schluessel: 'abgesagt', titel: 'Abgesagt', zahl: false },
    { schluessel: 'gehoert', titel: 'Gehörte zu', zahl: false },
    // Wer ändern darf, sieht wie bisher, was ein Klick tut.
    ...(darf ? [{ schluessel: 'zurueck', titel: '', zahl: true }] : []),
  ];
  const absageZelle = (k: string, b: Absage): ReactNode => {
    switch (k) {
      case 'name':
        return b.name;
      case 'nr': {
        const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
        return nr ? <span className={v.nr}>{nr}</span> : strich;
      }
      case 'abgesagt':
        return `${absageText(b)}${b.warVorher === 'wartet' ? ' · stand auf der Warteliste' : ''}`;
      case 'zurueck':
        return <small className={a.leise}>Zurückholen</small>;
      default:
        return gehoertZu(b)?.wer ?? strich;
    }
  };

  const leer = (text: string) => (
    <p className={a.leerZeile}>{suche.trim() ? `Niemand mit „${suche.trim()}“ gefunden.` : text}</p>
  );

  return (
    <div className={a.reiter}>
      {/* Plätze, Warteliste und Zahlung offen stehen seit U1 oben auf der Seite (Kennzahlen, `Einstieg.tsx`). */}
      <section className={s.karte} aria-label="Anmeldungen">
        <ReiterLeiste oben name="Ansichten" reiter={reiter} aktiv={filter} onWechsel={wechseln} />

        {/* „Platz frei – jemand wartet“ steht seit U2-1 nur noch hier und in der Kachel (Alwin, 29.10.2026). */}
        {filter === 'warte' && wartenTrotzPlatz(plaetze) && wartende[0] && (
          <p className={a.warteHinweis}>
            <span>
              <b>
                {frei === null
                  ? 'Es ist Platz frei'
                  : `${anzahlText(frei, 'Platz', 'Plätze')} frei`}{' '}
                – {z.wartend === 1 ? '1 wartet' : `${z.wartend} warten`}.
              </b>{' '}
              ChurchTools lässt niemanden von selbst nachrücken. Als Nächste wartet{' '}
              {ganzerName(wartende[0].p)}
              {wartende[0].x.angemeldetAm && ` (seit ${kurz(wartende[0].x.angemeldetAm)})`}.
            </span>
            {darf && (
              <FensterKnopf
                art="hell"
                onClick={() =>
                  oeffnen(wartende[0].x.schluessel, {
                    art: 'nach',
                    personId: wartende[0].p.personId,
                  })
                }
              >
                {wartende[0].p.vor} nachrücken lassen
              </FensterKnopf>
            )}
          </p>
        )}

        <div className={a.leiste}>
          <label className={a.suche}>
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Name oder Nr. suchen"
              aria-label="Name suchen"
              value={suche}
              onChange={(ev) => setSuche(ev.target.value)}
            />
          </label>
          {filter !== 'abgesagt' && (
            <Segment
              verbunden
              ariaLabel="Zeilen"
              value={jePerson ? 'person' : 'anmeldung'}
              options={[
                { value: 'anmeldung', label: 'Je Anmeldung' },
                { value: 'person', label: 'Je Person' },
              ]}
              onChange={(w) => {
                setJePerson(w === 'person');
                setSortierung(null);
              }}
            />
          )}
          <span className={a.rechts}>
            {liste.length > 0 && (
              <FensterKnopf art="zweit" aria-label="Druckliste" onClick={() => setDruck(true)}>
                <Icon name="drucker" size={18} />
                <span className={a.breit}>Druckliste</span>
              </FensterKnopf>
            )}
            {darf && liste.length > 0 && (
              <FensterKnopf art="zweit" aria-label="Rundmail" onClick={() => setRundmail(true)}>
                <Icon name="brief" size={18} />
                <span className={a.breit}>Rundmail</span>
              </FensterKnopf>
            )}
            {darf && (
              <FensterKnopf onClick={() => setVonHand({ dazu: null })}>＋ Von Hand</FensterKnopf>
            )}
          </span>
        </div>

        {filter === 'abgesagt' ? (
          absageZeilen.length === 0 ? (
            leer('Niemand hat abgesagt.')
          ) : (
            <AnmeldungenTabelle
              name="Absagen"
              spalten={absageSpalten}
              zeilen={absageZeilen}
              schluessel={(b) => String(b.personId)}
              zelle={absageZelle}
              summe={(k) =>
                k === 'name' ? { text: anzahlText(absageZeilen.length, 'Absage', 'Absagen') } : null
              }
              // Wer ändern darf, holt mit einem Klick zurück (A7-4c).
              onZeile={darf ? (b) => setZurueck({ b, von: null }) : undefined}
            />
          )
        ) : (jePerson ? personenGezeigt.length : zeilen.length) === 0 ? (
          leer(
            filter === 'offen'
              ? 'Alle haben bezahlt.'
              : filter === 'warte'
                ? 'Niemand auf der Warteliste.'
                : 'Noch keine Anmeldungen.',
          )
        ) : jePerson ? (
          <AnmeldungenTabelle
            name="Personen"
            spalten={personenSpalten(e, { kostet: z.kostet, warteliste: filter === 'warte' })}
            zeilen={personenGezeigt}
            schluessel={(y) => `${y.x.schluessel}-${y.p.personId}`}
            zelle={personZelle}
            summe={(k) => personSumme(e, k, personenGezeigt)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(y) => oeffnen(y.x.schluessel)}
          />
        ) : (
          <AnmeldungenTabelle
            name="Anmeldungen"
            spalten={anmeldungsSpalten(e, { kostet: z.kostet, warteliste: filter === 'warte' })}
            zeilen={zeilen}
            schluessel={(x) => x.schluessel}
            zelle={zelle}
            summe={(k) => summe(e, k, zeilen)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(x) => oeffnen(x.schluessel)}
          />
        )}

        <p className={v.pruefFuss}>
          {jePerson
            ? 'Eine Zeile je Person, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert. Die Summen zählen Personen mit Platz; Betrag und Bezahlt gehören der Anmeldung und zählen sie einmal.'
            : 'Eine Zeile je Anmeldung, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert. Die Summen zählen Anmeldungen mit Platz. Ältere Anmeldungen ohne Nr. stehen je Person einzeln.'}{' '}
          Die Leitung steht nicht in der Liste.
          {stand!.verlaufGekuerzt &&
            ' Der Verlauf in ChurchTools ist sehr lang – die ältesten Absagen fehlen hier.'}{' '}
          <button type="button" className={a.linkKnopf} onClick={onNeuLaden}>
            Neu laden
          </button>
        </p>
      </section>

      {vonHand && (
        <VonHandFenster
          mitBestaetigung={mitBestaetigung}
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
          mitBestaetigung={mitBestaetigung}
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
          onRueckgaengig={() => {
            // Nach dem Rückgängigmachen ist „… schickt dabei noch einmal“ erledigt (echte Prüfung 24.10.2026).
            setMeldung((m) => (m?.hinweisBisRueckgaengig ? { ...m, hinweis: undefined } : m));
            onGespeichert();
          }}
          mitBestaetigung={mitBestaetigung}
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
