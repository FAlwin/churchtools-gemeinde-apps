import { useMemo, useRef, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextFehler,
  erinnerungTageFehler,
  fehltInChurchTools,
  standardBetreff,
  warteBeschreibung,
  warteFehler,
  BESCHREIBUNG_MAX,
  type EigenerText,
  type MailArt,
} from '@shared/anmeldung/ablaeufe';
import { mailBausteinNamen } from '@shared/anmeldung/mailAntworten';
import {
  ablaeufeEinrichten,
  mailPlatzhalterLaden,
  vorschauPerson,
  type AblaufStand,
} from './ablaeufe';
import { aendereEinstellungen, leitungsKandidaten } from './einrichten';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { ErinnerungWahl } from './ErinnerungWahl';
import { ZweiteMailWahl } from './ZweiteMailWahl';
import { TeamMailWahl } from './TeamMailWahl';
import { TEAM_STANDARD, teamMailText, teamMailVon } from '@shared/anmeldung/teamMail';
import { htmlSicher } from '@shared/anmeldung/rundmail';
import type { TeamMailEinstellung } from '@shared/anmeldung/formular';
import { entwurfAus, zweiteAusEntwurf, type ZweiteEntwurf } from './zweiteEntwurf';
import { loeschDatum } from '@shared/anmeldung/termin';
import { vorschauLaden } from './rundmail';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import bk from './Baukasten.module.scss';

/**
 * **Fenster „Mails“** (A9-2a, Entwurf `a9-ablaeufe-v1`, Alwin 26.10.2026) – Betreff, eigener Absatz und Gruß je Mail
 * (Bestätigung, Warteliste), der Absender und der Check-in-Code in der Bestätigung (A9-2b). Termin, Betrag, Bankdaten, Link und Kontakt setzt die Erweiterung selbst
 * ein (`ablaufMails`) – so kann niemand den Link zu „Deine Anmeldung“ versehentlich löschen. Gespeichert wird in den
 * Routinen von ChurchTools (der eigene Text in deren Beschreibung), danach nachgelesen. Die Vorschau rechnet ChurchTools
 * – mit dem Text, der gerade im Fenster steht, auch vor dem Speichern. Reiter „Erinnerung“ (A9-3b): die Tage stehen in
 * den Einstellungen der Veranstaltung (R1), ihr Text in der Beschreibung der Routine „Platz“ – mit der Bestätigung
 * zusammen höchstens 1.000 Zeichen (E4). F7a (Entwurf `f7-mails-v1`): In der Bestätigung setzen „Antwort einfügen“ die
 * Antworten der Person ein, „Alle Angaben mitschicken“ hängt sie alle an (`mailAntworten.ts`).
 */
export function MailsFenster({
  id,
  veranstaltung,
  e,
  stand,
  heute,
  onClose,
  onGespeichert,
}: {
  id: number;
  veranstaltung: string;
  e: OeffentlicheEinstellungen;
  stand: AblaufStand;
  /** Heute im Kalender der Gemeinde – für den Tag jeder Erinnerung und ob sie schon vorbei ist. */
  heute: string;
  onClose: () => void;
  onGespeichert: (text: string) => void;
}) {
  const [art, setArt] = useState<MailArt | 'zweite' | 'team'>('platz');
  const [texte, setTexte] = useState<Record<MailArt, EigenerText>>(stand.eigen);
  const [tage, setTage] = useState<(number | null)[]>(e.erinnerungTage ?? []);
  const [absender, setAbsender] = useState<number | null>(stand.absenderId);
  const [qr, setQr] = useState(stand.qr);
  const [zweiteEntwurf, setZweiteEntwurf] = useState<ZweiteEntwurf>(() => entwurfAus(stand.zweite));
  const zweite = zweiteAusEntwurf(zweiteEntwurf);
  const [team, setTeam] = useState<TeamMailEinstellung>(() => teamMailVon(e));
  const leitungStand = useLaden(
    () => leitungsKandidaten(id).then((k) => k.filter((x) => x.leitung)),
    [id],
  ).stand;
  const leitung = leitungStand.art === 'fertig' ? leitungStand.daten : null;
  const [vorschau, setVorschau] = useState<{
    betreff: string;
    html: string;
    echt: boolean;
  } | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [eigenerFehler, setFehler] = useState<string | null>(null);
  // Lässt sich die Leitung nicht laden, steht es unten – wie ein Fehler beim Speichern.
  const fehler = eigenerFehler ?? (leitungStand.art === 'fehler' ? leitungStand.fehler.text : null);

  // In den Reitern „Zweite Mail“ und „Team-Mail“ gibt es keinen eigenen Absatz – `t` ist dort nur ein Platzhalter.
  const t = art === 'zweite' || art === 'team' ? texte.platz : texte[art];
  const aendern = (teil: Partial<EigenerText>) => {
    if (art === 'zweite' || art === 'team') return;
    setTexte((alt) => ({ ...alt, [art]: { ...alt[art], ...teil } }));
    setVorschau(null);
  };
  const aendernTeam = (teil: Partial<TeamMailEinstellung>) => {
    setTeam((alt) => ({ ...alt, ...teil }));
    setVorschau(null);
  };
  const aendernZweite = (teil: Partial<ZweiteEntwurf>) => {
    setZweiteEntwurf((alt) => ({ ...alt, ...teil }));
    setVorschau(null);
  };
  const absatzRef = useRef<HTMLTextAreaElement>(null);
  const bausteine = useMemo(() => mailBausteinNamen(e), [e]);
  const pruefung = useMemo(
    () =>
      eigenerTextFehler(texte.platz, texte.erinnerung, zweite) ??
      warteFehler(texte.warte, zweite, loeschDatum(e)) ??
      erinnerungTageFehler(tage),
    [texte, tage, zweite, e],
  );
  // Bestätigung und Erinnerung teilen sich die Beschreibung der Routine „Platz“ (E4), Warteliste und zweite Mail die
  // von „Warteliste“ (F7b).
  const mitWarte = art === 'warte' || art === 'zweite';
  const belegt =
    (mitWarte
      ? warteBeschreibung(texte.warte, zweite)
      : eigenerTextAlsBeschreibung(texte.platz, texte.erinnerung, zweite)
    )?.length ?? 0;
  const tageGeaendert =
    JSON.stringify([...tage].sort()) !== JSON.stringify([...(e.erinnerungTage ?? [])].sort());
  // F7c: Die Team-Mail steht in den Einstellungen (das Formular schickt sie) – der Standard wird nicht hineingeschrieben.
  const teamGeaendert = JSON.stringify(team) !== JSON.stringify(teamMailVon(e));
  // Wer nicht (mehr) zur Leitung gehört, bleibt wählbar, bis jemand anderes gewählt ist.
  const auswahl = useMemo(() => {
    const l = leitung ?? [];
    return absender === null || l.some((x) => x.personId === absender)
      ? l
      : [{ personId: absender, name: stand.absender ?? `Person ${absender}`, leitung: true }, ...l];
  }, [leitung, absender, stand.absender]);

  async function zeigeVorschau() {
    // F7c: Die Team-Mail baut das Formular selbst – die Vorschau zeigt ihren Text mit „…“ statt Antworten.
    if (art === 'team') {
      const text = teamMailText(
        { ...e, teamMail: team },
        { anmeldung: {}, personen: [{}] },
        [{ index: 0, name: 'Vorname Nachname', ergebnis: 'angemeldet' }],
        'ABC234',
        () => '…',
      );
      setVorschau({
        betreff: `Formularanfrage zur Gruppe ${veranstaltung}`,
        html: `<p style="font-family:sans-serif">${htmlSicher(text)}</p>`,
        echt: true,
      });
      return;
    }
    if (absender === null) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const [{ platzhalter, spalten }, person] = await Promise.all([
        mailPlatzhalterLaden(id),
        vorschauPerson(id, art === 'warte' ? 'warte' : 'platz', absender),
      ]);
      const mails = ablaufMails(e, veranstaltung, platzhalter, { ...texte, zweite }, qr, spalten);
      // Die zweite Mail gibt es nur eingeschaltet – ausgeschaltet hat der Reiter keinen Knopf „Vorschau“.
      const m = art === 'zweite' ? mails.zweite : mails[art];
      if (m) {
        const r = await vorschauLaden(id, person.personId, m.betreff, m.html);
        setVorschau({ ...r, echt: person.echt });
      }
      // Wie beim Speichern (dort bricht es ab): Fehlt eine Spalte, sagt es auch die Vorschau – sonst fehlte die Antwort
      // darin einfach.
      if (mails.unbekannt.length) setFehler(fehltInChurchTools(mails.unbekannt));
    } catch (x) {
      setFehler(fehlerMeldung(x).text);
    }
    setArbeitet(false);
  }

  async function speichern() {
    if (absender === null || pruefung) return;
    setArbeitet(true);
    setFehler(null);
    try {
      // Erst die Tage (die Routine liest sie aus den Einstellungen), dann die Routinen. Scheitert das Zweite, zieht der
      // Abgleich beim nächsten Öffnen nach.
      if (tageGeaendert || teamGeaendert)
        await aendereEinstellungen(id, (x) => {
          const { erinnerungTage: _alt, teamMail: _team, ...rest } = x;
          const neu = tage.filter((n): n is number => n !== null);
          const teamMail = teamGeaendert ? team : x.teamMail;
          return {
            ...rest,
            ...(neu.length ? { erinnerungTage: neu } : {}),
            ...(teamMail && JSON.stringify(teamMail) !== JSON.stringify(TEAM_STANDARD)
              ? { teamMail }
              : {}),
          };
        });
      await ablaeufeEinrichten(id, absender, { ...texte, zweite }, qr);
      onGespeichert('Mails gespeichert.');
      return;
    } catch (x) {
      setFehler(fehlerMeldung(x).text);
    }
    setArbeitet(false);
  }

  return (
    <Sheet
      title="Mails"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={arbeitet || absender === null || !!pruefung}
          onClick={() => void speichern()}
        >
          {arbeitet ? 'Einen Moment …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={a.leise}>
        ChurchTools verschickt sie von selbst. Termin, Betrag, Bankdaten, der Link zu „Deine
        Anmeldung“ und der Kontakt kommen aus den Karten – hier steht, was ihr dazuschreibt.
      </p>
      <Segment<MailArt | 'zweite' | 'team'>
        value={art}
        className={a.mailReiter}
        ariaLabel="Welche Mail"
        options={[
          { value: 'platz', label: 'Bestätigung' },
          { value: 'warte', label: 'Warteliste' },
          { value: 'erinnerung', label: 'Erinnerung' },
          { value: 'zweite', label: 'Zweite Mail' },
          { value: 'team', label: 'Team-Mail' },
        ]}
        onChange={(x) => {
          setArt(x);
          setVorschau(null);
        }}
      />
      <p className={a.leise}>
        {art === 'platz'
          ? 'Kommt nach dem Anmelden und beim Nachrücken – an jede Person mit Platz.'
          : art === 'warte'
            ? 'Kommt, wenn jemand auf die Warteliste kommt – mit dem Platz auf der Warteliste.'
            : art === 'zweite'
              ? 'Eine weitere Mail mit eigenem Betreff und Text – gleich nach der Bestätigung, ein paar Tage später oder an einem bestimmten Tag.'
              : art === 'team'
                ? 'Sagt dem Team Bescheid, sobald sich jemand anmeldet – mit den Antworten. Das Formular schickt sie selbst.'
                : 'Kommt vor dem Termin an jede Person mit Platz – nicht an Wartende. Mit Datum, Ort und Link.'}
      </p>
      {art === 'team' && (
        <TeamMailWahl
          wert={team}
          onWert={aendernTeam}
          e={e}
          veranstaltung={veranstaltung}
          leitung={leitung && leitung.map((x) => x.name)}
        />
      )}
      {art === 'zweite' && (
        <>
          <ZweiteMailWahl
            wert={zweiteEntwurf}
            onWert={aendernZweite}
            veranstaltung={veranstaltung}
            bausteine={bausteine}
          />
          {zweiteEntwurf.an && (
            <p className={pruefung ? f.fehler : a.leise}>
              {pruefung ??
                `${belegt} von ${BESCHREIBUNG_MAX} Zeichen belegt – Warteliste und zweite Mail zusammen.`}
            </p>
          )}
        </>
      )}
      {art === 'erinnerung' && (
        <ErinnerungWahl
          tage={tage}
          onTage={(x) => {
            setTage(x);
            setVorschau(null);
          }}
          e={e}
          heute={heute}
        />
      )}
      {art !== 'zweite' && art !== 'team' && (art !== 'erinnerung' || tage.length > 0) && (
        <>
          <label className={f.feld}>
            <span>Betreff</span>
            <input
              className={f.eingabe}
              value={t.betreff}
              placeholder={standardBetreff(art, veranstaltung)}
              onChange={(ev) => aendern({ betreff: ev.target.value })}
            />
          </label>
          <label className={f.feld}>
            <span>Eigener Absatz (freiwillig)</span>
            <textarea
              ref={absatzRef}
              className={`${f.eingabe} ${a.rundmailText}`}
              value={t.absatz}
              placeholder={
                art === 'platz'
                  ? 'z. B. Bitte mitbringen: Schlafsack, Bibel, Taschenlampe.'
                  : art === 'warte'
                    ? 'z. B. Wir melden uns spätestens eine Woche vorher.'
                    : 'z. B. Abfahrt 16 Uhr am Gemeindehaus.'
              }
              onChange={(ev) => aendern({ absatz: ev.target.value })}
            />
          </label>
          {art === 'platz' && (
            <>
              <AntwortKnoepfe
                namen={bausteine}
                feld={absatzRef}
                wert={t.absatz}
                onWert={(absatz) => aendern({ absatz })}
              />
              <button
                type="button"
                className={bk.schalterZeile}
                aria-pressed={!!t.alle}
                onClick={() => aendern({ alle: !t.alle })}
              >
                <Schalter an={!!t.alle} />
                Alle Angaben mitschicken
              </button>
              <p className={a.leise}>
                {t.alle
                  ? 'Unter deinem Absatz steht eine Liste aller Antworten der Person – leere fallen weg.'
                  : 'Nur das, was du oben einfügst.'}{' '}
                Fragen zur Anmeldung (z. B. Telefon) stehen nur in der Mail der ersten Person.
              </p>
            </>
          )}
          <label className={f.feld}>
            <span>Gruß</span>
            <textarea
              className={f.eingabe}
              rows={2}
              value={t.gruss}
              placeholder="Viele Grüße"
              onChange={(ev) => aendern({ gruss: ev.target.value })}
            />
          </label>
          <p className={pruefung ? f.fehler : a.leise}>
            {pruefung ??
              (art === 'warte'
                ? zweite
                  ? `${belegt} von ${BESCHREIBUNG_MAX} Zeichen belegt – Warteliste und zweite Mail zusammen.`
                  : `${belegt} von ${BESCHREIBUNG_MAX} Zeichen für diese Mail belegt.`
                : `${belegt} von ${BESCHREIBUNG_MAX} Zeichen belegt – Bestätigung und Erinnerung zusammen.`)}
          </p>
        </>
      )}
      {art === 'platz' && (
        <>
          <button
            type="button"
            className={bk.schalterZeile}
            aria-pressed={qr}
            onClick={() => {
              setQr(!qr);
              setVorschau(null);
            }}
          >
            <Schalter an={qr} />
            Check-in-Code (QR) mitschicken
          </button>
          <p className={a.leise}>
            {qr
              ? 'Jede Person bekommt ihren Code mit der Bestätigung – zum Einchecken in ChurchTools. Wer schon angemeldet ist, bekommt ihn nicht nachgeschickt.'
              : 'Für Veranstaltungen mit Einlass oder Check-in. Schaltet den Check-in in ChurchTools mit ein.'}
          </p>
        </>
      )}
      {/* Die Team-Mail hat keinen Absender – sie kommt von der Person, die anmeldet. */}
      {art !== 'team' && (
        <>
          <label className={f.feld}>
            <span>Absender</span>
            <select
              className={f.eingabe}
              value={absender ?? ''}
              disabled={leitung === null}
              onChange={(ev) => setAbsender(Number(ev.target.value))}
            >
              {leitung === null && <option value={absender ?? ''}>Wird geladen …</option>}
              {auswahl.map((x) => (
                <option key={x.personId} value={x.personId}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <p className={a.leise}>
            Erscheint als „Name &lt;noreply@churchtools.de&gt;“ – Antworten gehen an diese Person.
            Zur Wahl steht die Leitung der Veranstaltung.
          </p>
        </>
      )}
      {vorschau ? (
        <div className={a.mail}>
          <div className={a.mailKopf}>
            Betreff <b>{vorschau.betreff}</b>
            {!vorschau.echt && (
              <>
                <br />
                Noch niemand so angemeldet – Betrag, Nr. und Link fehlen in der Vorschau.
              </>
            )}
            {art === 'platz' && qr && !stand.qr && (
              <>
                <br />
                Den Check-in-Code legt ChurchTools erst beim Speichern an – bis dahin fehlt er in
                der Vorschau.
              </>
            )}
          </div>
          {/* Gerendert von ChurchTools – in einem abgeschotteten Rahmen, ohne Skripte. */}
          <iframe
            className={a.vorschauRahmen}
            title="Vorschau der Mail"
            sandbox=""
            srcDoc={vorschau.html}
          />
        </div>
      ) : (
        (art === 'zweite'
          ? zweiteEntwurf.an
          : art === 'team'
            ? team.an
            : art !== 'erinnerung' || tage.length > 0) && (
          <button
            type="button"
            className={a.linkKnopf}
            disabled={arbeitet || absender === null}
            onClick={() => void zeigeVorschau()}
          >
            Vorschau
          </button>
        )
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
