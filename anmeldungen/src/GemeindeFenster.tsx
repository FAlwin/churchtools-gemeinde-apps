import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { formularAdresseAus } from '@shared/anmeldung/oeffentlich';
import {
  stammName,
  vorgabenVollstaendig,
  type NeuePersonVorgaben,
  type Stammdaten,
} from '@shared/anmeldung/vorbereiten';
import { stammdaten } from './einrichten';
import {
  gemeindeEinstellungen,
  gemeindeVorgaben,
  pruefeFormularSeite,
  speichereGemeindeEinstellungen,
  type SeitenPruefung,
} from './gemeinde';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **Einstellungen der Gemeinde** (A6-2, #548) – nur für Gruppen-Admins:
 * - die **Adresse der Formular-Seite** (Alwin, 14.10.2026: jede Gemeinde ihre eigene, „Voraussetzung für diese
 *   Extension“) – geprüft, ob sie antwortet und in ChurchTools als erlaubte Herkunft steht;
 * - welchen Status, Standort und Bereich neue Personen bekommen („einmal je Gemeinde“; ohne nimmt ChurchTools keine
 *   Anmeldung an – gemessen).
 */
export function GemeindeFenster({
  onClose,
  onGespeichert,
}: {
  onClose: () => void;
  onGespeichert: (text: string) => void;
}) {
  const [daten, setDaten] = useState<Stammdaten | null>(null);
  const [wahl, setWahl] = useState<Partial<NeuePersonVorgaben>>({});
  const [vorschlag, setVorschlag] = useState(false);
  const [adresse, setAdresse] = useState('');
  const [pruefung, setPruefung] = useState<SeitenPruefung | null>(null);
  const [prueft, setPrueft] = useState(false);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    stammdaten()
      .then(async (s) => {
        const [v, gespeichert] = await Promise.all([gemeindeVorgaben(s), gemeindeEinstellungen()]);
        if (!aktuell) return;
        setDaten(s);
        setWahl(v);
        setVorschlag(!gespeichert.neuePersonen);
        setAdresse(gespeichert.formularAdresse ?? '');
      })
      .catch((e: unknown) => aktuell && setFehler(fehlerMeldung(e).text));
    return () => {
      aktuell = false;
    };
  }, []);

  const gueltig = formularAdresseAus(adresse);

  async function pruefen() {
    if (!gueltig) return;
    setPrueft(true);
    setPruefung(await pruefeFormularSeite(gueltig));
    setPrueft(false);
  }

  const auswahl = (
    titel: string,
    feld: keyof NeuePersonVorgaben,
    liste: { id: number; name: string; nameTranslated?: string | null }[],
  ) => (
    <label className={f.feld}>
      <span>{titel}</span>
      <select
        className={f.eingabe}
        value={wahl[feld] ?? ''}
        onChange={(e) =>
          setWahl({ ...wahl, [feld]: e.target.value === '' ? undefined : Number(e.target.value) })
        }
      >
        <option value="">Bitte wählen …</option>
        {liste.map((x) => (
          <option key={x.id} value={x.id}>
            {stammName(x)}
          </option>
        ))}
      </select>
    </label>
  );

  async function speichern() {
    if (!vorgabenVollstaendig(wahl) || !gueltig) return;
    setArbeitet(true);
    setFehler(null);
    try {
      await speichereGemeindeEinstellungen({ neuePersonen: wahl, formularAdresse: gueltig });
      onGespeichert('Einstellungen der Gemeinde gespeichert.');
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }

  return (
    <Sheet title="Einstellungen der Gemeinde" onClose={onClose}>
      <label className={f.feld}>
        <span>Adresse des Anmeldeformulars</span>
        <input
          className={f.eingabe}
          value={adresse}
          placeholder="anmeldung.eure-gemeinde.de"
          onChange={(e) => {
            setAdresse(e.target.value);
            setPruefung(null);
          }}
          onBlur={() => void pruefen()}
        />
      </label>
      <p className={f.hinweis}>
        Die Seite, auf der sich Gäste anmelden – das Formular-Paket vom Release, auf eurem Webspace.
        Jeder Link zu einer Anmeldung beginnt mit dieser Adresse.
      </p>
      {adresse.trim() && !gueltig && (
        <p className={f.fehler}>Bitte eine https-Adresse ohne „?“ und „#“ eintragen.</p>
      )}
      {prueft && <p className={f.hinweis}>Wird geprüft …</p>}
      {pruefung && (
        <ul className={f.liste} aria-label="Prüfung der Formular-Seite">
          <li>
            {pruefung.erreichbar
              ? '✓ Die Seite antwortet.'
              : '✗ Die Seite antwortet nicht – ist das Formular dort hochgeladen?'}
          </li>
          <li>
            {pruefung.erlaubt === true
              ? `✓ ${pruefung.herkunft} ist in ChurchTools als erlaubte Herkunft eingetragen.`
              : pruefung.erlaubt === false
                ? `✗ ${pruefung.herkunft} fehlt in ChurchTools bei den erlaubten Herkünften – ohne den Eintrag blockt der Browser das Formular.`
                : '? Ob die Herkunft in ChurchTools erlaubt ist, ließ sich nicht lesen.'}
          </li>
        </ul>
      )}

      <p className={f.hinweis}>
        Wer sich anmeldet und in ChurchTools noch nicht bekannt ist, wird dort neu angelegt – mit
        diesen Angaben. Ohne sie nimmt ChurchTools keine Anmeldung an. Gilt für alle
        Veranstaltungen.
      </p>
      {daten ? (
        <>
          {auswahl(
            'Status',
            'statusId',
            daten.status.filter((x) => !x.isMember),
          )}
          {auswahl('Standort', 'campusId', daten.standorte)}
          {auswahl('Bereich', 'departmentId', daten.bereiche)}
          {vorschlag && (
            <p className={f.hinweis}>
              Noch nicht gespeichert – das ist der Vorschlag. Bis jemand speichert, gilt er so.
            </p>
          )}
        </>
      ) : (
        !fehler && <p className={f.hinweis}>Wird geladen …</p>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <button
        type="button"
        className={f.knopf}
        disabled={arbeitet || !vorgabenVollstaendig(wahl) || !gueltig}
        onClick={() => void speichern()}
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
    </Sheet>
  );
}
