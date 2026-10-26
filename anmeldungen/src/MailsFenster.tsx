import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextFehler,
  standardBetreff,
  BESCHREIBUNG_MAX,
  type EigenerText,
  type RoutinenArt,
} from '@shared/anmeldung/ablaeufe';
import { ablaeufeEinrichten, vorschauPerson, type AblaufStand } from './ablaeufe';
import { leitungsKandidaten, type LeitungsKandidat } from './einrichten';
import { platzhalterLaden, vorschauLaden } from './rundmail';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';

/**
 * **Fenster „Mails“** (A9-2a, Entwurf `a9-ablaeufe-v1`, Alwin 26.10.2026) – Betreff, eigener Absatz und Gruß je Mail
 * (Bestätigung, Warteliste) und der Absender. Termin, Betrag, Bankdaten, Link und Kontakt setzt die Erweiterung selbst
 * ein (`ablaufMails`) – so kann niemand den Link zu „Deine Anmeldung“ versehentlich löschen. Gespeichert wird in den
 * Routinen von ChurchTools (der eigene Text in deren Beschreibung), danach nachgelesen. Die Vorschau rechnet ChurchTools
 * – mit dem Text, der gerade im Fenster steht, auch vor dem Speichern.
 */
export function MailsFenster({
  id,
  veranstaltung,
  e,
  stand,
  onClose,
  onGespeichert,
}: {
  id: number;
  veranstaltung: string;
  e: OeffentlicheEinstellungen;
  stand: AblaufStand;
  onClose: () => void;
  onGespeichert: (text: string) => void;
}) {
  const [art, setArt] = useState<RoutinenArt>('platz');
  const [texte, setTexte] = useState<Record<RoutinenArt, EigenerText>>(stand.eigen);
  const [absender, setAbsender] = useState<number | null>(stand.absenderId);
  const [leitung, setLeitung] = useState<LeitungsKandidat[] | null>(null);
  const [vorschau, setVorschau] = useState<{
    betreff: string;
    html: string;
    echt: boolean;
  } | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    leitungsKandidaten(id).then(
      (k) => aktuell && setLeitung(k.filter((x) => x.leitung)),
      (x: unknown) => aktuell && setFehler(fehlerMeldung(x).text),
    );
    return () => {
      aktuell = false;
    };
  }, [id]);

  const t = texte[art];
  const aendern = (teil: Partial<EigenerText>) => {
    setTexte((alt) => ({ ...alt, [art]: { ...alt[art], ...teil } }));
    setVorschau(null);
  };
  const pruefung = useMemo(
    () => eigenerTextFehler(texte.platz) ?? eigenerTextFehler(texte.warte),
    [texte],
  );
  const belegt = eigenerTextAlsBeschreibung(t)?.length ?? 0;
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
        vorschauPerson(id, art, absender),
      ]);
      const mails = ablaufMails(e, veranstaltung, platzhalter, texte);
      const m = art === 'platz' ? mails.platz : mails.warte;
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
      await ablaeufeEinrichten(id, absender, texte);
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
      <Segment<RoutinenArt>
        value={art}
        ariaLabel="Welche Mail"
        options={[
          { value: 'platz', label: 'Bestätigung' },
          { value: 'warte', label: 'Warteliste' },
        ]}
        onChange={(x) => {
          setArt(x);
          setVorschau(null);
        }}
      />
      <p className={a.leise}>
        {art === 'platz'
          ? 'Kommt nach dem Anmelden und beim Nachrücken – an jede Person mit Platz.'
          : 'Kommt, wenn jemand auf die Warteliste kommt – mit dem Platz auf der Warteliste.'}
      </p>
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
              : 'z. B. Wir melden uns spätestens eine Woche vorher.'
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
        {pruefung ?? `${belegt} von ${BESCHREIBUNG_MAX} Zeichen für diese Mail belegt.`}
      </p>
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
        <button
          type="button"
          className={a.linkKnopf}
          disabled={arbeitet || absender === null}
          onClick={() => void zeigeVorschau()}
        >
          Vorschau
        </button>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
