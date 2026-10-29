import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Person } from '@shared/organigramm/mitglieder';
import {
  aenderungVon,
  ersterDerSerie,
  istLeer,
  mailsSerie,
  mailsVon,
  planungVon,
  serienWeg,
  terminSperre,
  type SerienAbsage,
  type Umfang,
} from '@shared/protokolle/bearbeiten';
import { planungFehler, schonBelegt, zeitraum, type Planung } from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { ladeGruppenMitglieder } from './mitglieder';
import { ANMELDUNG, sitzungAbsagen, sitzungAendern, terminStand } from './bearbeiten';
import { wannLang } from './anzeige';
import { Einladeliste, Planungsfelder } from './Planungsfelder';
import felder from './Fensterfelder.module.scss';
import styles from './SitzungFestlegen.module.scss';

type Laden<T> =
  | { art: 'laedt' }
  | { art: 'fertig'; wert: T }
  | { art: 'fehler'; fehler: Fehlermeldung };

const personen = (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`;

/** Bei einer Serie: ist das der erste Termin, und wie viele kommen noch (für „ganze Serie löschen“)? */
interface Serie {
  erster: boolean;
  kommende: number;
}

/**
 * **Fenster „Sitzung bearbeiten“** (Bauplan K2b, entschieden 29.10.2026) – für die Leitung: Titel, Datum, Uhrzeit, Dauer
 * und wer eingeladen ist; dazu „Sitzung absagen“. Termin, Gruppentreffen und Protokoll ziehen mit. Das Fenster sagt vor
 * dem Speichern, wer welche Mail bekommt (gemessen 29.10.2026):
 * - Zeit geändert: **„Alle neu einladen“** (vorgewählt) – eine Mail „Termin geändert“, Zusagen zurück; abgewählt still.
 * - Titel ändern: still. Einladen: „Neue Besprechungsanfrage“. Ausladen und Absagen: „Termin gelöscht“.
 * Bei einer **Serie** (K2b-2) gelten Einladungen für die ganze Serie; Titel oder Zeit fragt „Nur diese Sitzung“ / „Ab
 * dieser Sitzung“ (geteilt → alle bekommen „Neue Besprechungsanfrage“), Absagen bietet nur diese / Serie ab hier beenden /
 * ganze Serie löschen. Termine mit Anmeldung ändert es nicht – es sagt das.
 */
export function SitzungBearbeiten({
  gruppe,
  modul,
  kategorie,
  sitzung,
  sitzungen,
  ich,
  zeitzone,
  jetzt,
  onFertig,
  onClose,
}: {
  gruppe: { id: number; name: string };
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  sitzung: Sitzung;
  /** Alle Sitzungen der Gruppe – „zu dieser Zeit gibt es schon eine“. */
  sitzungen: readonly Sitzung[];
  ich: { person: number };
  zeitzone: string;
  /** Für Tests; sonst die Uhr. */
  jetzt?: Date;
  /** Gespeichert oder abgesagt – die Liste lädt neu. */
  onFertig: () => void;
  onClose: () => void;
}) {
  const termin = sitzung.termin;
  // Mit Termin gilt, was ChurchTools jetzt hat (Zeit, Eingeladene) – nicht die Liste (`terminStand`).
  const [stand, setStand] = useState<
    Laden<{ sperre: string | null; sitzung: Sitzung; serie: Serie | null }>
  >(termin ? { art: 'laedt' } : { art: 'fertig', wert: { sperre: null, sitzung, serie: null } });
  const aktuell = stand.art === 'fertig' ? stand.wert.sitzung : sitzung;
  const serie = stand.art === 'fertig' ? stand.wert.serie : null;
  const [umfang, setUmfang] = useState<Umfang>('diese');
  const [absageArt, setAbsageArt] = useState<SerienAbsage>('diese');
  const [p, setP] = useState<Planung>(() => planungVon(sitzung, zeitzone));
  const vorher = useMemo(() => aktuell.anfragen.map((a) => a.person), [aktuell]);
  const [eingeladen, setEingeladen] = useState<ReadonlySet<number>>(() => new Set(vorher));
  const [neuEinladen, setNeuEinladen] = useState(true);
  const [mitglieder, setMitglieder] = useState<Laden<Person[] | 'verborgen'>>(
    termin ? { art: 'laedt' } : { art: 'fertig', wert: [] },
  );
  const [absagen, setAbsagen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [ende, setEnde] = useState<{ titel: string; hinweise: string[] } | null>(null);

  // Der Termin (Serie? Anmeldung?) und die Mitglieder – nur, wenn es einen Termin gibt.
  useEffect(() => {
    if (!termin) return;
    let aktiv = true;
    terminStand(termin).then(
      ({ roh, eingeladen: da, termine }) => {
        if (!aktiv) return;
        const s = terminSperre(roh);
        const start = typeof roh.startDate === 'string' ? roh.startDate : null;
        const schluss = typeof roh.endDate === 'string' ? roh.endDate : null;
        // Bei einer Serie ist der gelesene Beginn der des ersten Termins – diese Sitzung behält ihren, die Dauer gilt.
        const zeit =
          s === 'serie'
            ? start && schluss
              ? {
                  ende: new Date(
                    Date.parse(sitzung.beginn) + Date.parse(schluss) - Date.parse(start),
                  ).toISOString(),
                }
              : {}
            : { ...(start ? { beginn: start } : {}), ...(schluss ? { ende: schluss } : {}) };
        const frisch: Sitzung = {
          ...sitzung,
          ...zeit,
          anfragen: da.map((person) => ({
            person,
            antwort: sitzung.anfragen.find((x) => x.person === person)?.antwort ?? 'offen',
          })),
        };
        const heute = (jetzt ?? new Date()).getTime();
        setStand({
          art: 'fertig',
          wert: {
            sperre: s === 'anmeldung' ? ANMELDUNG : null,
            sitzung: frisch,
            serie:
              s === 'serie'
                ? {
                    erster: ersterDerSerie(roh, sitzung.beginn, zeitzone),
                    kommende: termine.filter((x) => Date.parse(x) >= heute).length,
                  }
                : null,
          },
        });
        setP(planungVon(frisch, zeitzone));
        setEingeladen(new Set(da));
      },
      (e: unknown) => aktiv && setStand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    ladeGruppenMitglieder(gruppe.id).then(
      (r) => aktiv && setMitglieder({ art: 'fertig', wert: r }),
      (e: unknown) => aktiv && setMitglieder({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktiv = false;
    };
  }, [termin, gruppe.id, sitzung, zeitzone, jetzt]);

  const liste =
    mitglieder.art === 'fertig' && mitglieder.wert !== 'verborgen' ? mitglieder.wert : [];
  // Eingeladene, die keine (aktiven) Mitglieder sind, bleiben eingeladen – das Fenster kennt sie nicht.
  const bekannt = new Set(liste.map((x) => x.id));
  const weitere = vorher.filter((x) => !bekannt.has(x));
  const nachher = [...liste.filter((x) => eingeladen.has(x.id)).map((x) => x.id), ...weitere];

  const jetztZeit = jetzt ?? new Date();
  const problem = planungFehler(p, zeitzone, jetztZeit, { zukunft: false });
  const z = problem ? null : zeitraum(p, zeitzone);
  const a = z
    ? aenderungVon({
        alt: {
          titel: aktuell.titel,
          beginn: aktuell.beginn,
          ...(aktuell.ende ? { ende: aktuell.ende } : {}),
        },
        neu: { titel: p.titel, beginn: z.beginn, ende: z.ende },
        vorher,
        nachher,
      })
    : null;
  // Mit Einladung muss die neue Zeit in der Zukunft liegen; nur den Titel ändern geht auch hinterher.
  const zukunft =
    !!a?.zeit && !!termin && !!z && Date.parse(z.beginn) <= jetztZeit.getTime()
      ? 'Die Sitzung muss in der Zukunft liegen.'
      : null;
  const belegt =
    !!a?.zeit &&
    !!z &&
    schonBelegt(
      sitzungen.filter((s) => s.schluessel !== sitzung.schluessel),
      z.beginn,
    );
  const weg = serie && a ? serienWeg(a, umfang, serie.erster) : null;
  const geteilt = weg === 'teilen-diese' || weg === 'teilen-ab';
  // „Alle neu einladen“ nur, wo der Termin selbst verschoben wird – ein geteilter wird ohnehin neu eingeladen.
  const fragen = !!termin && !!a?.zeit && !geteilt && vorher.some((x) => x !== ich.person);
  const mailFrage = { nachher, neuEinladen: fragen && neuEinladen, ich: ich.person };
  const mails = !a
    ? { geaendert: 0, eingeladen: 0, ausgeladen: 0 }
    : serie
      ? mailsSerie(a, weg, mailFrage)
      : mailsVon(a, mailFrage);
  const anzahlMails = mails.geaendert + mails.eingeladen + mails.ausgeladen;
  const gesperrt = stand.art === 'fertig' && stand.wert.sperre !== null;
  const bereit =
    !!a &&
    !istLeer(a) &&
    !zukunft &&
    !belegt &&
    !laeuft &&
    stand.art === 'fertig' &&
    !gesperrt &&
    mitglieder.art !== 'laedt';

  const speichern = () => {
    if (!bereit || !z) return;
    setLaeuft(true);
    setFehler(null);
    sitzungAendern({
      modul,
      kategorie,
      gruppe: gruppe.id,
      sitzung: aktuell,
      neu: { titel: p.titel, beginn: z.beginn, ende: z.ende },
      nachher,
      neuEinladen: fragen && neuEinladen,
      zeitzone,
      umfang,
      sitzungen,
    }).then(
      (r) => {
        setLaeuft(false);
        if (r.hinweise.length)
          setEnde({ titel: 'Die Sitzung ist geändert.', hinweise: r.hinweise });
        else onFertig();
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  const absagenJetzt = () => {
    setLaeuft(true);
    setFehler(null);
    sitzungAbsagen({
      modul,
      kategorie,
      gruppe: gruppe.id,
      sitzung: aktuell,
      zeitzone,
      sitzungen,
      ...(serie ? { art: absageArt } : {}),
      ...(jetzt ? { jetzt } : {}),
    }).then(
      (r) => {
        setLaeuft(false);
        if (r.hinweise.length)
          setEnde({ titel: 'Die Sitzung ist abgesagt.', hinweise: r.hinweise });
        else onFertig();
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  const fehlerZeile = fehler && (
    <p className={felder.fehler} role="alert">
      {fehler.text}
    </p>
  );

  if (ende)
    return (
      <Sheet
        title="Sitzung bearbeiten"
        onClose={onFertig}
        cancelLabel={null}
        knoepfe={<FensterKnopf onClick={onFertig}>Fertig</FensterKnopf>}
      >
        <div className={styles.ende} role="status">
          <p>{ende.titel}</p>
          {ende.hinweise.map((t) => (
            <p key={t} className={felder.hinweis}>
              {t}
            </p>
          ))}
        </div>
      </Sheet>
    );

  if (absagen) {
    const andere = vorher.filter((x) => x !== ich.person).length;
    const art: SerienAbsage | null = serie ? absageArt : null;
    const mailt = art === null || art === 'serie';
    const wege: { art: SerienAbsage; titel: string; text: string }[] = serie
      ? [
          {
            art: 'diese',
            titel: 'Nur diese Sitzung',
            text: 'Fällt aus der Serie heraus, die anderen Termine bleiben. Ohne Mail.',
          },
          ...(serie.erster
            ? []
            : [
                {
                  art: 'ab' as const,
                  titel: 'Serie ab hier beenden',
                  text: 'Diese und alle späteren Termine fallen weg, die früheren bleiben. Ohne Mail.',
                },
              ]),
          {
            art: 'serie',
            titel: 'Ganze Serie löschen',
            text: `Alle Termine verschwinden aus dem Kalender – auch die vergangenen${serie.kommende ? ` (noch ${serie.kommende} kommende)` : ''}.`,
          },
        ]
      : [];
    return (
      <Sheet
        title="Sitzung absagen"
        onClose={onClose}
        cancelLabel={null}
        beschaeftigt={laeuft}
        knoepfe={
          <>
            <FensterKnopf art="zweit" disabled={laeuft} onClick={() => setAbsagen(false)}>
              Zurück
            </FensterKnopf>
            <FensterKnopf art="gefahr" disabled={laeuft} onClick={absagenJetzt}>
              {laeuft ? 'Wird abgesagt …' : 'Sitzung absagen'}
            </FensterKnopf>
          </>
        }
      >
        <p className={felder.unter}>
          {sitzung.titel} · {wannLang(sitzung.beginn, zeitzone)}
        </p>
        {serie && (
          <div className={felder.feld} role="radiogroup" aria-label="Was wird abgesagt?">
            <span>Diese Sitzung gehört zu einer Terminserie</span>
            {wege.map((w) => (
              <label key={w.art} className={felder.schalter}>
                <input
                  type="radio"
                  name="absage"
                  checked={absageArt === w.art}
                  disabled={laeuft}
                  onChange={() => setAbsageArt(w.art)}
                />
                <span>
                  {w.titel}
                  <small>{w.text}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        <div className={styles.passiert}>
          <span className={styles.titel}>Das passiert in ChurchTools</span>
          <div className={styles.punkt}>
            <Icon name="calendar" size={18} />
            <span>
              <b>
                {art === null
                  ? 'Der Termin wird gelöscht'
                  : art === 'diese'
                    ? 'Der Termin fällt aus der Serie'
                    : art === 'ab'
                      ? 'Die Serie endet vor diesem Termin'
                      : 'Die ganze Serie wird gelöscht'}
              </b>
              <small>
                {art === null
                  ? 'Er verschwindet aus dem Kalender der Gruppe.'
                  : art === 'serie'
                    ? 'Auch vergangene Termine verschwinden aus dem Kalender.'
                    : art === 'ab'
                      ? 'Die früheren Termine bleiben im Kalender.'
                      : 'Die anderen Termine bleiben im Kalender.'}
              </small>
            </span>
          </div>
          {art !== null && art !== 'diese' && (
            <div className={styles.punkt}>
              <Icon name="dokument" size={18} />
              <span>
                <b>{art === 'ab' ? 'Auch die späteren Sitzungen' : 'Alle Sitzungen der Serie'}</b>
                <small>
                  Geplante verschwinden, begonnene Protokolle bleiben als Entwurf, freigegebene
                  bleiben unberührt. Gruppentreffen {art === 'ab' ? 'ab hier' : 'kommender Termine'}{' '}
                  werden gelöscht.
                </small>
              </span>
            </div>
          )}
          {sitzung.treffen !== null && (art === null || art === 'diese') && (
            <div className={styles.punkt}>
              <Icon name="people" size={18} />
              <span>
                <b>Das Gruppentreffen wird gelöscht</b>
                <small>Ohne Mail.</small>
              </span>
            </div>
          )}
          {sitzung.kopf && (art === null || art === 'diese') && (
            <div className={styles.punkt}>
              <Icon name="dokument" size={18} />
              <span>
                <b>
                  {sitzung.kopf.status === 'geplant'
                    ? 'Die geplante Sitzung verschwindet'
                    : 'Das Protokoll bleibt'}
                </b>
                <small>
                  {sitzung.kopf.status === 'geplant'
                    ? 'Es war noch kein Protokoll begonnen.'
                    : 'Als Entwurf ohne Termin – nichts Geschriebenes geht verloren.'}
                </small>
              </span>
            </div>
          )}
        </div>
        {andere > 0 && mailt && (
          <p className={styles.mail} role="note">
            <Icon name="warnung" size={18} />
            <span>
              ChurchTools schickt <b>sofort</b> die Mail „
              {art === 'serie' ? 'Terminserie gelöscht' : 'Termin gelöscht'}“ an {personen(andere)}.
            </span>
          </p>
        )}
        {fehlerZeile}
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Sitzung bearbeiten"
      onClose={onClose}
      beschaeftigt={laeuft}
      links={
        termin && !gesperrt && stand.art === 'fertig' ? (
          <FensterKnopf art="loeschen" disabled={laeuft} onClick={() => setAbsagen(true)}>
            Sitzung absagen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={speichern}>
          {laeuft
            ? 'Wird gespeichert …'
            : anzahlMails
              ? 'Speichern und benachrichtigen'
              : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={felder.unter}>{gruppe.name}</p>
      {stand.art === 'laedt' && <p className={felder.leise}>Termin wird geladen …</p>}
      {stand.art === 'fehler' && (
        <p className={felder.fehler} role="alert">
          {stand.fehler.text}
        </p>
      )}
      {stand.art === 'fertig' && stand.wert.sperre && (
        <p className={felder.hinweis}>{stand.wert.sperre}</p>
      )}
      {stand.art === 'fertig' && !gesperrt && (
        <>
          <Planungsfelder p={p} onChange={setP} gesperrt={laeuft} mitDauer={!!termin} />

          {serie && a && (a.titel || a.zeit) && (
            <div className={felder.feld} role="radiogroup" aria-label="Gilt für">
              <span>Gilt für</span>
              {(
                [
                  ['diese', 'Nur diese Sitzung', 'Sie wird aus der Serie gelöst.'],
                  [
                    'ab',
                    'Ab dieser Sitzung',
                    serie.erster
                      ? 'Das ist der erste Termin – die ganze Serie ändert sich.'
                      : 'Die Serie wird hier geteilt, die Termine davor bleiben.',
                  ],
                ] as const
              ).map(([wert, titel, text]) => (
                <label key={wert} className={felder.schalter}>
                  <input
                    type="radio"
                    name="umfang"
                    checked={umfang === wert}
                    disabled={laeuft}
                    onChange={() => setUmfang(wert)}
                  />
                  <span>
                    {titel}
                    <small>{text}</small>
                  </span>
                </label>
              ))}
            </div>
          )}

          {termin && (
            <div className={felder.feld}>
              <span>
                Eingeladen
                {liste.length ? ` · ${nachher.length - weitere.length} von ${liste.length}` : ''}
              </span>
              {mitglieder.art === 'laedt' && (
                <p className={felder.leise}>Mitglieder werden geladen …</p>
              )}
              {mitglieder.art === 'fehler' && (
                <p className={felder.leise}>
                  Die Mitglieder ließen sich nicht laden – die Einladungen bleiben, wie sie sind.
                </p>
              )}
              {mitglieder.art === 'fertig' && mitglieder.wert === 'verborgen' && (
                <p className={felder.leise}>
                  Die Mitglieder dieser Gruppe sind für dich in ChurchTools nicht sichtbar – die
                  Einladungen bleiben, wie sie sind.
                </p>
              )}
              {liste.length > 0 && (
                <Einladeliste
                  liste={liste}
                  gewaehlt={eingeladen}
                  onChange={setEingeladen}
                  gesperrt={laeuft}
                  ich={ich.person}
                  zusatz={(id) =>
                    a?.dazu.includes(id)
                      ? 'wird eingeladen'
                      : a?.weg.includes(id)
                        ? 'wird ausgeladen'
                        : id === ich.person
                          ? 'du'
                          : null
                  }
                />
              )}
              {serie && <p className={felder.leise}>Einladungen gelten für die ganze Serie.</p>}
              {weitere.length > 0 && (
                <p className={felder.leise}>
                  Außerdem eingeladen: {personen(weitere.length)}, die keine Mitglieder der Gruppe
                  sind – das bleibt so.
                </p>
              )}
            </div>
          )}

          {fragen && (
            <label className={felder.schalter}>
              <input
                type="checkbox"
                className={felder.haken}
                checked={neuEinladen}
                disabled={laeuft}
                onChange={(e) => setNeuEinladen(e.target.checked)}
              />
              <span>
                Alle neu einladen
                <small>
                  {neuEinladen
                    ? 'Jeder bekommt die Mail „Termin geändert“ und sagt neu zu oder ab.'
                    : 'Niemand wird benachrichtigt – die Zusagen bleiben, obwohl die Zeit eine andere ist.'}
                </small>
              </span>
            </label>
          )}

          {anzahlMails > 0 && (
            <p className={styles.mail} role="note">
              <Icon name="warnung" size={18} />
              <span>
                {geteilt &&
                  'Der neue Termin hat noch keine Einladungen – alle werden neu eingeladen. '}
                ChurchTools schickt <b>sofort</b>
                {[
                  mails.geaendert ? ` „Termin geändert“ an ${personen(mails.geaendert)}` : '',
                  mails.eingeladen
                    ? ` „Neue Besprechungsanfrage“ an ${personen(mails.eingeladen)}`
                    : '',
                  mails.ausgeladen ? ` „Termin gelöscht“ an ${personen(mails.ausgeladen)}` : '',
                ]
                  .filter(Boolean)
                  .join(',')}
                .
              </span>
            </p>
          )}
          {(problem ?? zukunft) && <p className={felder.leise}>{problem ?? zukunft}</p>}
          {belegt && (
            <p className={felder.fehler} role="alert">
              Zu dieser Zeit gibt es schon eine Sitzung dieser Gruppe.
            </p>
          )}
        </>
      )}
      {fehlerZeile}
    </Sheet>
  );
}
