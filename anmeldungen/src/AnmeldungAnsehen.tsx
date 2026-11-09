import { useState } from 'react';
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
import {
  antwortZeilen,
  type Absage,
  type AntwortZeile,
  type ListenAnmeldung,
  type ListenPerson,
} from '@shared/anmeldung/liste';
import { tagPunkt as lang } from '@shared/ct/datum';
import { mailAnbieten } from './anzeige';
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
import { useSpeichern } from './useSpeichern';
import { RueckgaengigImFenster, type Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import a from './AnmeldungenReiter.module.scss';
import { absageText, ganzerName } from './anmeldungText';

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
export function AnmeldungAnsehen({
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

  // Eine Rückfrage oder die Mail ersetzt den Inhalt – mit ihren Knöpfen unten (E6-O F4) und „‹“ oben zurück zur
  // Anmeldung (02.11.2026); sonst nur das X.
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
    <MailKnoepfe mail={modus.mail} onKopiert={setKopiert} />
  ) : null;

  return (
    <Sheet
      title={titel}
      onClose={onClose}
      zurueck={inhalt ? zurAnmeldung : undefined}
      beschaeftigt={arbeitet}
      cancelLabel={null}
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
