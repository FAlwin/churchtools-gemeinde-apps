import { useMemo, useState } from 'react';
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
  standardBetreff,
  BESCHREIBUNG_MAX,
  type EigenerText,
  type MailArt,
} from '@shared/anmeldung/ablaeufe';
import { ablaeufeEinrichten, vorschauPerson, type AblaufStand } from './ablaeufe';
import { aendereEinstellungen, leitungsKandidaten } from './einrichten';
import { ErinnerungWahl } from './ErinnerungWahl';
import { platzhalterLaden, vorschauLaden } from './rundmail';
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
 * zusammen höchstens 1.000 Zeichen (E4).
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
  const [art, setArt] = useState<MailArt>('platz');
  const [texte, setTexte] = useState<Record<MailArt, EigenerText>>(stand.eigen);
  const [tage, setTage] = useState<(number | null)[]>(e.erinnerungTage ?? []);
  const [absender, setAbsender] = useState<number | null>(stand.absenderId);
  const [qr, setQr] = useState(stand.qr);
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

  const t = texte[art];
  const aendern = (teil: Partial<EigenerText>) => {
    setTexte((alt) => ({ ...alt, [art]: { ...alt[art], ...teil } }));
    setVorschau(null);
  };
  const pruefung = useMemo(
    () =>
      eigenerTextFehler(texte.platz, texte.erinnerung) ??
      eigenerTextFehler(texte.warte) ??
      erinnerungTageFehler(tage),
    [texte, tage],
  );
  // Bestätigung und Erinnerung teilen sich die Beschreibung der Routine „Platz“ (E4).
  const belegt =
    (art === 'warte'
      ? eigenerTextAlsBeschreibung(texte.warte)
      : eigenerTextAlsBeschreibung(texte.platz, texte.erinnerung)
    )?.length ?? 0;
  const tageGeaendert =
    JSON.stringify([...tage].sort()) !== JSON.stringify([...(e.erinnerungTage ?? [])].sort());
  // Wer nicht (mehr) zur Leitung gehört, bleibt wählbar, bis jemand anderes gewählt ist.
  const auswahl = useMemo(() => {
    const l = leitung ?? [];
    return absender === null || l.some((x) => x.personId === absender)
      ? l
      : [{ personId: absender, name: stand.absender ?? `Person ${absender}`, leitung: true }, ...l];
  }, [leitung, absender, stand.absender]);

  async function zeigeVorschau() {
    if (absender === null) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const [platzhalter, person] = await Promise.all([
        platzhalterLaden(id),
        vorschauPerson(id, art === 'warte' ? 'warte' : 'platz', absender),
      ]);
      const mails = ablaufMails(e, veranstaltung, platzhalter, texte, qr);
      const m = mails[art];
      const r = await vorschauLaden(id, person.personId, m.betreff, m.html);
      setVorschau({ ...r, echt: person.echt });
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
      if (tageGeaendert)
        await aendereEinstellungen(id, (x) => {
          const { erinnerungTage: _alt, ...rest } = x;
          const neu = tage.filter((n): n is number => n !== null);
          return neu.length ? { ...rest, erinnerungTage: neu } : rest;
        });
      await ablaeufeEinrichten(id, absender, texte, qr);
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
      <Segment<MailArt>
        value={art}
        ariaLabel="Welche Mail"
        options={[
          { value: 'platz', label: 'Bestätigung' },
          { value: 'warte', label: 'Warteliste' },
          { value: 'erinnerung', label: 'Erinnerung' },
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
            : 'Kommt vor dem Termin an jede Person mit Platz – nicht an Wartende. Mit Datum, Ort und Link.'}
      </p>
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
      {(art !== 'erinnerung' || tage.length > 0) && (
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
                ? `${belegt} von ${BESCHREIBUNG_MAX} Zeichen für diese Mail belegt.`
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
        Erscheint als „Name &lt;noreply@churchtools.de&gt;“ – Antworten gehen an diese Person. Zur
        Wahl steht die Leitung der Veranstaltung.
      </p>
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
        (art !== 'erinnerung' || tage.length > 0) && (
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
