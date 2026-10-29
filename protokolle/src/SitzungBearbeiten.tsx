import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Person } from '@shared/organigramm/mitglieder';
import {
  aenderungVon,
  istLeer,
  mailsVon,
  planungVon,
  terminSperre,
} from '@shared/protokolle/bearbeiten';
import { planungFehler, schonBelegt, zeitraum, type Planung } from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { ladeGruppenMitglieder } from './mitglieder';
import { ANMELDUNG, SERIE, sitzungAbsagen, sitzungAendern, terminStand } from './bearbeiten';
import { wannLang } from './anzeige';
import { Einladeliste, Planungsfelder } from './Planungsfelder';
import felder from './Fensterfelder.module.scss';
import styles from './SitzungFestlegen.module.scss';

type Laden<T> =
  | { art: 'laedt' }
  | { art: 'fertig'; wert: T }
  | { art: 'fehler'; fehler: Fehlermeldung };

const personen = (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`;

/**
 * **Fenster „Sitzung bearbeiten“** (Bauplan K2b, entschieden 29.10.2026) – für die Leitung: Titel, Datum, Uhrzeit, Dauer
 * und wer eingeladen ist; dazu „Sitzung absagen“. Termin, Gruppentreffen und Protokoll ziehen mit. Das Fenster sagt vor
 * dem Speichern, wer welche Mail bekommt (gemessen 29.10.2026):
 * - Zeit geändert: **„Alle neu einladen“** (vorgewählt) – eine Mail „Termin geändert“, Zusagen zurück; abgewählt still.
 * - Titel ändern: still. Einladen: „Neue Besprechungsanfrage“. Ausladen und Absagen: „Termin gelöscht“.
 * Serientermine (K2b-2) und Termine mit Anmeldung ändert es noch nicht – es sagt das.
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
  const [stand, setStand] = useState<Laden<{ sperre: string | null; sitzung: Sitzung }>>(
    termin ? { art: 'laedt' } : { art: 'fertig', wert: { sperre: null, sitzung } },
  );
  const aktuell = stand.art === 'fertig' ? stand.wert.sitzung : sitzung;
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
      ({ roh, eingeladen: da }) => {
        if (!aktiv) return;
        const s = terminSperre(roh);
        const frisch: Sitzung = {
          ...sitzung,
          ...(typeof roh.startDate === 'string' ? { beginn: roh.startDate } : {}),
          ...(typeof roh.endDate === 'string' ? { ende: roh.endDate } : {}),
          anfragen: da.map((person) => ({
            person,
            antwort: sitzung.anfragen.find((x) => x.person === person)?.antwort ?? 'offen',
          })),
        };
        setStand({
          art: 'fertig',
          wert: { sperre: s === 'serie' ? SERIE : s ? ANMELDUNG : null, sitzung: frisch },
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
  }, [termin, gruppe.id, sitzung, zeitzone]);

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
  const fragen = !!termin && !!a?.zeit && vorher.some((x) => x !== ich.person);
  const mails = a
    ? mailsVon(a, { nachher, neuEinladen: fragen && neuEinladen, ich: ich.person })
    : { geaendert: 0, eingeladen: 0, ausgeladen: 0 };
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
    sitzungAbsagen({ modul, kategorie, gruppe: gruppe.id, sitzung: aktuell }).then(
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
        <div className={styles.passiert}>
          <span className={styles.titel}>Das passiert in ChurchTools</span>
          <div className={styles.punkt}>
            <Icon name="calendar" size={18} />
            <span>
              <b>Der Termin wird gelöscht</b>
              <small>Er verschwindet aus dem Kalender der Gruppe.</small>
            </span>
          </div>
          {sitzung.treffen !== null && (
            <div className={styles.punkt}>
              <Icon name="people" size={18} />
              <span>
                <b>Das Gruppentreffen wird gelöscht</b>
                <small>Ohne Mail.</small>
              </span>
            </div>
          )}
          {sitzung.kopf && (
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
        {andere > 0 && (
          <p className={styles.mail} role="note">
            <Icon name="warnung" size={18} />
            <span>
              ChurchTools schickt <b>sofort</b> die Mail „Termin gelöscht“ an {personen(andere)}.
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
