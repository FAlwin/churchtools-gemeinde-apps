import { useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useLaden } from '@ui/ct/useLaden';
import {
  faelligeEmpfaenger,
  faelligeMailFehler,
  faelligeVorgabe,
  istFaellig,
  vermerkText,
  type FaelligeBilanz,
  type FaelligerEmpfaenger,
} from '@shared/anmeldung/nachweisFaellige';
import type { NachweisArt, Vertrauensperson } from './nachweisArten';
import type { PersonMitStand } from './nachweisPersonen';
import { faelligeLaden, faelligeSenden } from './nachweisFaellige';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { UnklarObVerschickt } from './rundmail';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import n from './Nachweise.module.scss';

/** „2 Mails“ / „1 Mail“. */
const mails = (zahl: number) => `${zahl} ${zahl === 1 ? 'Mail' : 'Mails'}`;

/**
 * **„Fällige anschreiben“** (N2c, Entwurf `n2-stand-v1`, Ansicht 4). Die Personen, deren Nachweis in den nächsten 8 Wochen
 * abläuft oder schon abgelaufen ist, mit Häkchen (alle vorausgewählt, abwählbar; ohne Mailadresse grau und nicht wählbar),
 * darunter Betreff und Text (vorgegeben, änderbar; nur `[Vorname]`) und das Häkchen „Vermerk“. Das Senden steht in
 * `nachweisFaellige.ts`. Verschickt ist nicht zurückzuholen: Bei unklarem Ausgang bleibt das Fenster offen und sperrt
 * „Senden“ – ein zweiter Versuch gäbe doppelte Mails.
 */
export function FaelligeFenster({
  art,
  personen,
  heute,
  onClose,
  onFertig,
}: {
  art: Pick<NachweisArt, 'id' | 'name' | 'einstellungen'>;
  /** Alle Personen der Art mit Stand – fällig sind nur „läuft ab“ und „abgelaufen“. */
  personen: PersonMitStand[];
  heute: string;
  onClose: () => void;
  /** Nach dem Senden: die Meldung. Das Fenster schließt die Seite. */
  onFertig: (text: string, bilanz: FaelligeBilanz) => void;
}) {
  // Nur die Nummern der fälligen Personen – als Text, damit ein Neuzeichnen der Seite nicht neu lädt.
  const schluessel = personen
    .filter((p) => istFaellig(p.stand))
    .map((p) => p.personId)
    .join(',');
  const { stand, neu } = useLaden(
    () => faelligeLaden(schluessel ? schluessel.split(',').map(Number) : []),
    [schluessel],
  );
  if (stand.art !== 'fertig')
    return (
      <Sheet title={`Fällige anschreiben · ${art.name}`} onClose={onClose} mittel knoepfe={null}>
        {stand.art === 'fehler' ? (
          <>
            <p className={f.fehler} role="alert">
              {stand.fehler.text}
            </p>
            {stand.fehler.nochmal && (
              <FensterKnopf art="hell" onClick={neu}>
                Erneut versuchen
              </FensterKnopf>
            )}
          </>
        ) : (
          <p className={a.leise}>Wird geladen …</p>
        )}
      </Sheet>
    );
  return (
    <Inhalt
      art={art}
      personen={personen}
      heute={heute}
      emails={stand.daten.emails}
      ich={stand.daten.ich}
      onClose={onClose}
      onFertig={onFertig}
    />
  );
}

function Inhalt({
  art,
  personen,
  heute,
  emails,
  ich,
  onClose,
  onFertig,
}: {
  art: Pick<NachweisArt, 'id' | 'name' | 'einstellungen'>;
  personen: PersonMitStand[];
  heute: string;
  emails: ReadonlyMap<number, string | null>;
  ich: Vertrauensperson;
  onClose: () => void;
  onFertig: (text: string, bilanz: FaelligeBilanz) => void;
}) {
  const liste = useMemo(() => faelligeEmpfaenger(personen, emails), [personen, emails]);
  const vorgabe = useMemo(
    () =>
      faelligeVorgabe(
        { name: art.name, mitAntrag: Boolean(art.einstellungen?.antrag?.an) },
        ich.name.split(/\s+/)[0] ?? '',
      ),
    [art.name, art.einstellungen, ich.name],
  );
  const [gewaehlt, setGewaehlt] = useState<ReadonlySet<number>>(
    () => new Set(liste.filter((x) => x.email).map((x) => x.personId)),
  );
  const [betreff, setBetreff] = useState(vorgabe.betreff);
  const [text, setText] = useState(vorgabe.text);
  const [vermerk, setVermerk] = useState(true);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [unklar, setUnklar] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const an = liste.filter(
    (x): x is FaelligerEmpfaenger & { email: string } =>
      x.email !== null && gewaehlt.has(x.personId),
  );
  const ohneAdresse = liste.some((x) => !x.email);
  const pruef = faelligeMailFehler({ betreff, text });
  const knopfText = an.length === 0 ? 'Keine Mails zu senden' : `${mails(an.length)} senden`;

  const umschalten = (id: number) => {
    const neu = new Set(gewaehlt);
    if (!neu.delete(id)) neu.add(id);
    setGewaehlt(neu);
  };

  const senden = async () => {
    if (pruef || an.length === 0) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const erg = await faelligeSenden({
        gruppeId: art.id,
        an,
        betreff,
        text,
        vermerk,
        absenderName: ich.name,
        heute,
      });
      onFertig(erg.text, erg);
    } catch (x) {
      if (x instanceof UnklarObVerschickt) setUnklar(true);
      setFehler(x instanceof UnklarObVerschickt ? x.message : fehlerMeldung(x).text);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Sheet
      title={`Fällige anschreiben · ${art.name}`}
      onClose={onClose}
      beschaeftigt={arbeitet}
      mittel
      knoepfe={
        <FensterKnopf
          // Unklar, ob verschickt: nicht noch einmal – das gäbe doppelte Mails.
          disabled={arbeitet || unklar || an.length === 0 || !!pruef}
          onClick={() => void senden()}
        >
          {arbeitet ? 'Wird gesendet …' : knopfText}
        </FensterKnopf>
      }
    >
      <div className={f.feld}>
        <span>An</span>
        <div className={n.empfaenger}>
          {liste.map((x) => (
            <label key={x.personId} className={x.email ? undefined : n.empfaengerGrau}>
              <input
                type="checkbox"
                checked={x.email !== null && gewaehlt.has(x.personId)}
                disabled={x.email === null || arbeitet || unklar}
                onChange={() => umschalten(x.personId)}
              />
              <span className={n.empfaengerText}>
                <b>{x.name}</b>
                <small>
                  {x.wann}
                  {x.luecke ? ` · ${x.luecke}` : ''}
                  {x.email === null ? ' · keine Mailadresse in ChurchTools' : ''}
                </small>
              </span>
            </label>
          ))}
        </div>
        <small className={f.hinweis}>
          Alle, deren Nachweis in den nächsten 8 Wochen abläuft oder schon abgelaufen ist.
          {ohneAdresse ? ' Wer keine Mailadresse hat, steht grau da und bekommt keine Mail.' : ''}
        </small>
      </div>
      <label className={f.feld}>
        <span>Betreff</span>
        <input
          className={f.eingabe}
          value={betreff}
          disabled={unklar}
          onChange={(ev) => setBetreff(ev.target.value)}
        />
      </label>
      <label className={f.feld}>
        <span>Text</span>
        <textarea
          ref={textRef}
          className={`${f.eingabe} ${a.rundmailText}`}
          value={text}
          disabled={unklar}
          onChange={(ev) => setText(ev.target.value)}
        />
      </label>
      <AntwortKnoepfe
        namen={['Vorname']}
        beschriftung="Einfügen"
        wer="ChurchTools setzt den Namen je Person ein"
        streng
        feld={textRef}
        wert={text}
        onWert={setText}
      />
      <p className={a.leise}>
        Absender: {ich.name} (du), Antworten gehen an dich. Das Ablaufdatum steht nicht im Text –
        die Mail ist für alle gleich.
      </p>
      <label className={n.vermerkZeile}>
        <input
          type="checkbox"
          checked={vermerk}
          disabled={arbeitet || unklar}
          onChange={(ev) => setVermerk(ev.target.checked)}
        />
        <span>
          An der offenen Aufgabe vermerken: <b>„{vermerkText(heute, ich.name)}“</b>
          <small>
            So sehen die anderen Vertrauenspersonen, wer schon eine Mail hat (Notiz an der
            Folgeaufgabe in ChurchTools).
          </small>
        </span>
      </label>
      {pruef && <p className={f.hinweis}>{pruef}</p>}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
