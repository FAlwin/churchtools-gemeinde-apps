import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { tagAusIso } from '@shared/ct/zeit';
import type { Person } from '@shared/organigramm/mitglieder';
import {
  planungFehler,
  schonBelegt,
  vorbelegung,
  zeitraum,
  type Planung,
} from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { ladeGruppenMitglieder } from './mitglieder';
import { sitzungFestlegen } from './planen';
import { Einladeliste, Planungsfelder } from './Planungsfelder';
import felder from './Fensterfelder.module.scss';
import styles from './SitzungFestlegen.module.scss';

type Mitglieder = { art: 'laedt' } | { art: 'fertig'; liste: Person[] } | { art: 'verborgen' };

/**
 * **Fenster „Nächste Sitzung festlegen“ / „Neue Sitzung“** (Bauplan S5-2, Entwurf 7) – für die Leitung: Titel, Datum,
 * Uhrzeit, Dauer (vorbelegt wie die letzte Sitzung) und wer eingeladen wird (alle aktiven Mitglieder, abwählbar). Legt
 * den Kalendertermin mit Besprechungsanfrage, das Gruppentreffen und die geplante Sitzung an. Das Fenster sagt vor dem
 * Festlegen, dass die Einladungen **sofort** per Mail rausgehen. „Neue Sitzung“ (außerordentlich) ist dasselbe Fenster.
 */
export function SitzungFestlegen({
  art,
  gruppe,
  modul,
  kategorie,
  kalender,
  sitzungen,
  bis = null,
  ich,
  zeitzone,
  jetzt,
  onFestgelegt,
  onClose,
}: {
  /** `naechste` aus einem Protokoll heraus, `neu` aus der Liste (außerordentlich). */
  art: 'naechste' | 'neu';
  gruppe: { id: number; name: string };
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  kalender: number;
  /** Alle Sitzungen der Gruppe (kommend und freigegeben) – für die Vorbelegung und „schon belegt“. */
  sitzungen: readonly Sitzung[];
  /** Die Sitzung, von der aus festgelegt wird – nur sie und frühere zählen für die Vorbelegung (bei `neu`: was schon war). */
  bis?: Sitzung | null;
  ich: { person: number };
  zeitzone: string;
  /** Für Tests; sonst die Uhr. */
  jetzt?: Date;
  /** Festgelegt – `sitzung` ist die ID der geplanten Sitzung (`null`, wenn sie nicht vermerkt werden konnte). */
  onFestgelegt: (sitzung: string | null) => void;
  onClose: () => void;
}) {
  const [heute] = useState(() => tagAusIso((jetzt ?? new Date()).toISOString(), zeitzone));
  // „Neue Sitzung“ (außerordentlich): wie die letzte, die schon war – nicht nach der schon geplanten nächsten
  // (beim Durchklicken 28.10.2026: sonst schlug das Fenster einen Tag Monate nach der März-Sitzung vor).
  const [p, setP] = useState<Planung>(() =>
    vorbelegung({
      sitzungen,
      bis: bis ?? (art === 'neu' ? { beginn: (jetzt ?? new Date()).toISOString() } : null),
      heute,
      zeitzone,
    }),
  );
  const geladen = useLaden(() => ladeGruppenMitglieder(gruppe.id), [gruppe.id]).stand;
  const mitglieder: Mitglieder =
    geladen.art !== 'fertig'
      ? { art: 'laedt' }
      : geladen.daten === 'verborgen'
        ? { art: 'verborgen' }
        : { art: 'fertig', liste: geladen.daten };
  /** Abgewählt oder dazugewählt – bis dahin alle aktiven Mitglieder (Alwin, 28.10.2026). */
  const [eigene, setEingeladen] = useState<ReadonlySet<number> | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [ende, setEnde] = useState<{ sitzung: string | null; texte: string[] } | null>(null);

  const liste = useMemo(
    () => (geladen.art === 'fertig' && geladen.daten !== 'verborgen' ? geladen.daten : []),
    [geladen],
  );
  const eingeladen = useMemo(() => eigene ?? new Set(liste.map((x) => x.id)), [eigene, liste]);
  // Scheitert das Laden der Mitglieder, steht der Fehler unten – Festlegen bleibt gesperrt.
  const meldung = fehler ?? (geladen.art === 'fehler' ? geladen.fehler : null);
  // Wer festlegt und sich einlädt, hat sofort zugesagt und bekommt keine Mail (gemessen 28.10.2026).
  const mails = liste.filter((x) => eingeladen.has(x.id) && x.id !== ich.person).length;
  const problem = planungFehler(p, zeitzone, jetzt ?? new Date());
  const belegt = useMemo(
    () => !problem && schonBelegt(sitzungen, zeitraum(p, zeitzone).beginn),
    [problem, sitzungen, p, zeitzone],
  );
  const bereit = mitglieder.art !== 'laedt' && !problem && !belegt && !laeuft;

  const festlegen = () => {
    if (!bereit) return;
    setLaeuft(true);
    setFehler(null);
    const z = zeitraum(p, zeitzone);
    sitzungFestlegen({
      modul,
      kategorie,
      gruppe: gruppe.id,
      kalender,
      titel: p.titel,
      beginn: z.beginn,
      ende: z.ende,
      eingeladen: liste.filter((x) => eingeladen.has(x.id)).map((x) => x.id),
      zeitzone,
    }).then(
      (r) => {
        setLaeuft(false);
        const name = new Map(liste.map((x) => [x.id, x.name]));
        const texte = [
          ...(r.fehlend.length
            ? [
                `Nicht eingeladen hat ChurchTools: ${r.fehlend.map((id) => name.get(id) ?? `Person ${id}`).join(', ')}. Das lässt sich am Termin in ChurchTools nachholen.`,
              ]
            : []),
          ...r.hinweise,
        ];
        if (texte.length) setEnde({ sitzung: r.sitzung, texte });
        else onFestgelegt(r.sitzung);
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  return (
    <Sheet
      title={art === 'neu' ? 'Neue Sitzung' : 'Nächste Sitzung festlegen'}
      // Festgelegt ist festgelegt: Danach schließt auch das X wie „Fertig“ (die Liste lädt neu), kein „Abbrechen“.
      onClose={ende ? () => onFestgelegt(ende.sitzung) : onClose}
      cancelLabel={ende ? null : undefined}
      beschaeftigt={laeuft}
      knoepfe={
        ende ? (
          <FensterKnopf onClick={() => onFestgelegt(ende.sitzung)}>Fertig</FensterKnopf>
        ) : (
          <FensterKnopf disabled={!bereit} onClick={festlegen}>
            {laeuft ? 'Wird angelegt …' : mails ? 'Festlegen und einladen' : 'Festlegen'}
          </FensterKnopf>
        )
      }
    >
      <p className={felder.unter}>
        {gruppe.name}
        {art === 'neu' ? ' · außerordentlich' : ''}
      </p>
      {ende ? (
        <div className={styles.ende} role="status">
          <p>Die Sitzung ist festgelegt.</p>
          {ende.texte.map((t) => (
            <p key={t} className={felder.hinweis}>
              {t}
            </p>
          ))}
        </div>
      ) : (
        <>
          <Planungsfelder p={p} onChange={setP} gesperrt={laeuft} fruehestens={heute} />

          <div className={felder.feld}>
            <span>
              Einladen
              {mitglieder.art === 'fertig' ? ` · ${eingeladen.size} von ${liste.length}` : ''}
            </span>
            {mitglieder.art === 'laedt' && !meldung && (
              <p className={felder.leise}>Mitglieder werden geladen …</p>
            )}
            {mitglieder.art === 'verborgen' && (
              <p className={felder.leise}>
                Die Mitglieder dieser Gruppe sind für dich in ChurchTools nicht sichtbar – der
                Termin wird ohne Einladung angelegt.
              </p>
            )}
            {mitglieder.art === 'fertig' && (
              <Einladeliste
                liste={liste}
                gewaehlt={eingeladen}
                onChange={setEingeladen}
                gesperrt={laeuft}
                ich={ich.person}
              />
            )}
          </div>

          <div className={styles.passiert}>
            <span className={styles.titel}>Das passiert in ChurchTools</span>
            <div className={styles.punkt}>
              <Icon name="calendar" size={18} />
              <span>
                <b>Termin im Kalender der Gruppe</b>
                <small>
                  {mails
                    ? 'Mit Besprechungsanfrage – jeder sagt zu oder ab und hat den Termin dann im eigenen Kalender.'
                    : 'Ohne Einladung.'}
                </small>
              </span>
            </div>
            <div className={styles.punkt}>
              <Icon name="people" size={18} />
              <span>
                <b>Gruppentreffen wird angelegt</b>
                <small>Dort wird später die Anwesenheit eingetragen.</small>
              </span>
            </div>
          </div>
          {mails > 0 && (
            <p className={styles.mail} role="note">
              <Icon name="warnung" size={18} />
              <span>
                Die Einladung geht <b>sofort</b> per Mail an {mails}{' '}
                {mails === 1 ? 'Person' : 'Personen'}.
              </span>
            </p>
          )}
          {problem && <p className={felder.leise}>{problem}</p>}
          {belegt && (
            <p className={felder.fehler} role="alert">
              Zu dieser Zeit gibt es schon eine Sitzung dieser Gruppe.
            </p>
          )}
        </>
      )}
      {meldung && (
        <p className={felder.fehler} role="alert">
          {meldung.text}
        </p>
      )}
    </Sheet>
  );
}
