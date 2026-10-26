import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { Schalter } from '@ui/bedienung/Schalter';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { ListenAnmeldung } from '@shared/anmeldung/liste';
import {
  RUNDMAIL_PLATZHALTER,
  mitCtPlatzhaltern,
  rundmailEmpfaenger,
  rundmailVorlage,
  textZuHtml,
  type RundmailFilter,
  type RundmailVorlage,
} from '@shared/anmeldung/rundmail';
import { meineId } from './einrichten';
import { UnklarObVerschickt, platzhalterLaden, rundmailSenden, vorschauLaden } from './rundmail';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import k from './Baukasten.module.scss';

/**
 * **Rundmail** (A7-5, Entwurf `a7-5-rundmail-v1`) – an die Anmeldungen (alle, Zahlung offen, Warteliste), je Anmeldung
 * eine Mail an den Kontakt; ChurchTools verschickt und füllt die Platzhalter. Schreiben → Vorschau → Rückfrage →
 * verschickt (im Protokoll nachgelesen). Kein Rückgängig – verschickte Mails sind raus.
 */
type Schritt = 'schreiben' | 'vorschau' | 'frage' | 'fertig';

export function RundmailFenster({
  id,
  e,
  veranstaltung,
  liste,
  startFilter,
  onClose,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  veranstaltung: string;
  liste: ListenAnmeldung[];
  startFilter: RundmailFilter;
  onClose: () => void;
}) {
  const [schritt, setSchritt] = useState<Schritt>('schreiben');
  const [filter, setFilter] = useState<RundmailFilter>(startFilter);
  const [vorlage, setVorlage] = useState<RundmailVorlage>(
    startFilter === 'offen' ? 'zahlung' : 'leer',
  );
  const start = rundmailVorlage(vorlage, e, veranstaltung);
  const [betreff, setBetreff] = useState(start.betreff);
  const [text, setText] = useState(start.text);
  const [ersetzen, setErsetzen] = useState<RundmailVorlage | null>(null);
  const [kopie, setKopie] = useState(false);
  const [ct, setCt] = useState<ReadonlyMap<string, string> | null>(null);
  const [nr, setNr] = useState(0);
  const [vorschau, setVorschau] = useState<{ betreff: string; html: string } | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [unklar, setUnklar] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ bestaetigt: number | null } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    platzhalterLaden(id).then(setCt, (x: unknown) => setFehler(fehlerMeldung(x).text));
  }, [id]);

  const zahl = (x: RundmailFilter) => rundmailEmpfaenger(liste, x).an.length;
  const { an, ohneAdresse } = useMemo(() => rundmailEmpfaenger(liste, filter), [liste, filter]);
  const ctBetreff = ct ? mitCtPlatzhaltern(betreff, ct) : null;
  const ctText = ct ? mitCtPlatzhaltern(text, ct) : null;
  const unbekannt = [...new Set([...(ctBetreff?.unbekannt ?? []), ...(ctText?.unbekannt ?? [])])];
  const bereit =
    !!ct && an.length > 0 && betreff.trim() !== '' && text.trim() !== '' && unbekannt.length === 0;

  const vorlageWaehlen = (v: RundmailVorlage) => {
    const jetzt = rundmailVorlage(vorlage, e, veranstaltung);
    // Eigener Text wird nicht still überschrieben.
    if (text.trim() && (text !== jetzt.text || betreff !== jetzt.betreff)) return setErsetzen(v);
    uebernehmen(v);
  };
  const uebernehmen = (v: RundmailVorlage) => {
    const neu = rundmailVorlage(v, e, veranstaltung);
    setVorlage(v);
    setBetreff(neu.betreff);
    setText(neu.text);
    setErsetzen(null);
  };

  const einfuegen = (name: string) => {
    const t = textRef.current;
    const token = `[${name}]`;
    const von = t?.selectionStart ?? text.length;
    const bis = t?.selectionEnd ?? text.length;
    setText(text.slice(0, von) + token + text.slice(bis));
    requestAnimationFrame(() => {
      t?.focus();
      t?.setSelectionRange(von + token.length, von + token.length);
    });
  };

  async function zeigeVorschau(i: number) {
    if (!ctBetreff || !ctText || !an[i]) return;
    setArbeitet(true);
    setFehler(null);
    try {
      setVorschau(await vorschauLaden(id, an[i].personId, ctBetreff.text, textZuHtml(ctText.text)));
      setNr(i);
      setSchritt('vorschau');
    } catch (x) {
      setFehler(fehlerMeldung(x).text);
    } finally {
      setArbeitet(false);
    }
  }

  async function senden() {
    if (!ctBetreff || !ctText) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const ich = kopie ? [{ personId: await meineId(), email: '' }] : [];
      const r = await rundmailSenden(
        id,
        [...an.map((x) => ({ personId: x.personId, email: x.email })), ...ich],
        ctBetreff.text,
        textZuHtml(ctText.text),
      );
      setErgebnis(r);
      setSchritt('fertig');
    } catch (x) {
      if (x instanceof UnklarObVerschickt) {
        setUnklar(true);
        setFehler(x.message);
      } else setFehler(fehlerMeldung(x).text);
    } finally {
      setArbeitet(false);
    }
  }

  const fehlerZeile = fehler && (
    <p className={f.fehler} role="alert">
      {fehler}
    </p>
  );

  if (schritt === 'vorschau' && vorschau)
    return (
      <Sheet
        title="Vorschau"
        onClose={onClose}
        cancelLabel={null}
        knoepfe={
          <>
            <FensterKnopf art="zweit" onClick={() => setSchritt('schreiben')}>
              Zurück
            </FensterKnopf>
            <FensterKnopf onClick={() => setSchritt('frage')}>Senden …</FensterKnopf>
          </>
        }
      >
        <p className={a.unterTitel}>
          So kommt die Mail bei <b>{an[nr]?.wer}</b> an · {nr + 1} von {an.length}{' '}
          <button
            type="button"
            className={a.linkKnopf}
            disabled={arbeitet || nr === 0}
            onClick={() => void zeigeVorschau(nr - 1)}
          >
            ‹
          </button>{' '}
          <button
            type="button"
            className={a.linkKnopf}
            disabled={arbeitet || nr >= an.length - 1}
            onClick={() => void zeigeVorschau(nr + 1)}
          >
            ›
          </button>
        </p>
        <div className={a.mail}>
          <div className={a.mailKopf}>
            An <b>{an[nr]?.email}</b>
            <br />
            Betreff <b>{vorschau.betreff}</b>
          </div>
          {/* Gerendert von ChurchTools – in einem abgeschotteten Rahmen, ohne Skripte. */}
          <iframe
            className={a.vorschauRahmen}
            title="Vorschau der Mail"
            sandbox=""
            srcDoc={vorschau.html}
          />
        </div>
        {fehlerZeile}
      </Sheet>
    );

  if (schritt === 'frage')
    return (
      <Sheet
        title={`${an.length} ${an.length === 1 ? 'Mail' : 'Mails'} jetzt senden?`}
        onClose={onClose}
        beschaeftigt={arbeitet}
        cancelLabel={null}
        knoepfe={
          <>
            <FensterKnopf art="zweit" disabled={arbeitet} onClick={() => setSchritt('schreiben')}>
              Zurück
            </FensterKnopf>
            <FensterKnopf
              // Unklar, ob verschickt: nicht noch einmal – das gäbe doppelte Mails.
              disabled={arbeitet || unklar}
              onClick={() => void senden()}
            >
              {arbeitet
                ? 'Wird gesendet …'
                : `Ja, ${an.length} ${an.length === 1 ? 'Mail' : 'Mails'} senden`}
            </FensterKnopf>
          </>
        }
      >
        <p className={a.hinweisRot}>
          Verschickte Mails lassen sich nicht zurückholen. ChurchTools schickt jeder Familie ihre
          eigene Mail – Absender ist dein Name, Antworten gehen an dich.
        </p>
        <p className={a.summe}>
          <span>Betreff</span>
          <b>{betreff}</b>
        </p>
        <p className={a.summe}>
          <span>An</span>
          <span>{an.map((x) => x.wer).join(', ')}</span>
        </p>
        {ohneAdresse.length > 0 && (
          <p className={a.summe}>
            <span>Übersprungen (keine Adresse)</span>
            <span>{ohneAdresse.join(', ')}</span>
          </p>
        )}
        {kopie && <p className={a.leise}>Dazu eine Kopie an dich.</p>}
        {fehlerZeile}
      </Sheet>
    );

  // Geschwister in getrennten Anmeldungen können dieselbe Adresse haben – das Protokoll zählt Adressen.
  const adressen = new Set(an.map((x) => x.email.toLowerCase())).size;
  if (schritt === 'fertig' && ergebnis)
    return (
      <Sheet title="Rundmail verschickt" onClose={onClose} cancelLabel="Schließen" knoepfe={null}>
        <p className={a.hinweisBlau}>
          {ergebnis.bestaetigt === null
            ? `${an.length} ${an.length === 1 ? 'Mail' : 'Mails'} an ChurchTools übergeben. Das Protokoll von ChurchTools kann ich mit deinen Rechten nicht lesen – nachgeprüft ist es deshalb nicht.`
            : ergebnis.bestaetigt >= adressen
              ? `${an.length} ${an.length === 1 ? 'Mail' : 'Mails'} verschickt – laut Protokoll von ChurchTools übernommen.`
              : `Im Protokoll von ChurchTools stehen ${ergebnis.bestaetigt} von ${adressen} Adressen – bitte in ChurchTools nachsehen.`}
        </p>
        <p className={a.summe}>
          <span>Betreff</span>
          <b>{betreff}</b>
        </p>
        <p className={a.summe}>
          <span>An</span>
          <span>{an.map((x) => x.wer).join(', ')}</span>
        </p>
        {ohneAdresse.length > 0 && (
          <p className={a.summe}>
            <span>Nicht verschickt (keine Adresse)</span>
            <span>{ohneAdresse.join(', ')}</span>
          </p>
        )}
      </Sheet>
    );

  return (
    <Sheet
      title="Rundmail"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <>
          <FensterKnopf
            art="hell"
            disabled={!bereit || arbeitet}
            onClick={() => void zeigeVorschau(0)}
          >
            {arbeitet ? 'Einen Moment …' : 'Vorschau'}
          </FensterKnopf>
          <FensterKnopf disabled={!bereit || arbeitet} onClick={() => setSchritt('frage')}>
            Senden …
          </FensterKnopf>
        </>
      }
    >
      <p className={a.unterTitel}>
        {veranstaltung} · ChurchTools verschickt, Antworten gehen an dich
      </p>
      <section className={a.teil}>
        <h3>An</h3>
        <Segment
          value={filter}
          options={[
            { value: 'alle', label: `Alle Anmeldungen ${zahl('alle')}` },
            { value: 'offen', label: `Zahlung offen ${zahl('offen')}` },
            { value: 'warte', label: `Warteliste ${zahl('warte')}` },
          ]}
          onChange={setFilter}
          ariaLabel="An"
        />
        <p className={a.leise}>
          <b>
            {an.length} {an.length === 1 ? 'Mail' : 'Mails'}
          </b>{' '}
          – je Anmeldung eine an den Kontakt.
          {ohneAdresse.length > 0 &&
            ` Ohne E-Mail-Adresse, wird übersprungen: ${ohneAdresse.join(', ')}.`}
        </p>
      </section>
      <section className={a.teil}>
        <h3>Mail</h3>
        <div className={f.feld}>
          <span>Vorlage</span>
          <Segment
            value={vorlage}
            options={[
              { value: 'leer', label: 'Leer' },
              { value: 'zahlung', label: 'Zahlungserinnerung' },
              { value: 'vorab', label: 'Infos vorab' },
            ]}
            onChange={vorlageWaehlen}
            ariaLabel="Vorlage"
          />
        </div>
        {ersetzen && (
          <p className={a.hinweisBlau}>
            Deinen Text durch die Vorlage ersetzen?{' '}
            <button type="button" className={a.linkKnopf} onClick={() => uebernehmen(ersetzen)}>
              Ja, ersetzen
            </button>{' '}
            <button type="button" className={a.linkKnopf} onClick={() => setErsetzen(null)}>
              Nein
            </button>
          </p>
        )}
        <label className={f.feld}>
          <span>Betreff</span>
          <input
            className={f.eingabe}
            value={betreff}
            onChange={(ev) => setBetreff(ev.target.value)}
          />
        </label>
        <label className={f.feld}>
          <span>Text</span>
          <textarea
            ref={textRef}
            className={`${f.eingabe} ${a.rundmailText}`}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
          />
        </label>
        <p className={a.leise}>
          Platzhalter einfügen – ChurchTools füllt sie je Familie:{' '}
          {RUNDMAIL_PLATZHALTER.map((p) => (
            <button
              key={p}
              type="button"
              className={`${a.pille} ${a.platzhalterKnopf}`}
              onClick={() => einfuegen(p)}
            >
              {p}
            </button>
          ))}
        </p>
        <p className={a.leise}>
          [Vorname], [Nachname] und [Wartelistenplatz] gelten für die Person, an die die Mail geht –
          die erste der Anmeldung. Wartet nur ein Geschwisterkind, bleibt [Wartelistenplatz] leer
          (die Vorschau zeigt es).
        </p>
        {unbekannt.length > 0 && (
          <p className={f.fehler}>
            Diese Platzhalter kennt ChurchTools hier nicht:{' '}
            {unbekannt.map((u) => `[${u}]`).join(', ')}.
          </p>
        )}
        <button
          type="button"
          className={k.schalterZeile}
          aria-pressed={kopie}
          onClick={() => setKopie(!kopie)}
        >
          <Schalter an={kopie} />
          Eine Kopie an mich
        </button>
      </section>
      {!ct && !fehler && <p className={a.leise}>Platzhalter werden geladen …</p>}
      {fehlerZeile}
    </Sheet>
  );
}
