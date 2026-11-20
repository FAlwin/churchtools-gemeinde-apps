import { useEffect, useId, useMemo, useState } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import { useEntprellt } from '@ui/bedienung/useEntprellt';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import {
  FARBFELDER,
  type FarbSchluessel,
  type SchriftRolle,
  farbeGesetzt,
  farbeGilt,
  farbeSetzen,
  hexAusEingabe,
  hexVoll,
  kontrastHinweise,
  schriftSetzen,
  verhaeltnisText,
} from '@shared/website/aussehen';
import type { Einstellungen, Seite } from '@shared/website/modell';
import { SCHRIFTEN, type SchriftKategorie, findeSchrift } from '@shared/website/schriften';
import { seitenAuswahlText } from '@shared/website/seitenListe';
import { Hinweis, Leise } from './Hinweis';
import { SperrBaender, SpeicherZustand } from './SperrBaender';
import { Vorschau, type Ansicht } from './Vorschau';
import { useEinstellungen, type EinstellungenBereit } from './einstellungenKontext';
import { AUSSEHEN_TEXTE } from './sperrTexte';
import styles from './Aussehen.module.scss';

/** So lange nach dem letzten Tastendruck zeichnet sich die Vorschau mit dem eigenen CSS neu. */
export const CSS_VORSCHAU_MS = 400;

const KATEGORIEN: { art: SchriftKategorie; titel: string }[] = [
  { art: 'serifenlos', titel: 'Ohne Serifen' },
  { art: 'serif', titel: 'Mit Serifen' },
  { art: 'display', titel: 'Auffällig' },
  { art: 'hand', titel: 'Handschrift' },
];

const EIGENE = '__eigene';
const VORHANDEN = '__vorhanden';

/**
 * **Der Reiter „Aussehen“** (Bauplan Website W3a-3a): Farben, Schriften, Logo und eigenes CSS der Website – links das
 * Formular, rechts die Vorschau (die Startseite, eine andere Seite ist wählbar); am Handy untereinander.
 *
 * **Der Arbeitsstand gehört nicht diesem Reiter**, sondern dem `EinstellungenProvider` darüber (`EinstellungenQuelle`): Das
 * Fenster „Einstellungen“ schreibt dieselbe Einheit, beide teilen sich Arbeitsstand, Sperre und Schlange. Speichern und Sperre
 * sind dieselben wie bei den Seiten (`useSperrarbeit`): eine Person zur Zeit, „Hier weiterbearbeiten“/„Bearbeitung übernehmen“,
 * „Erneut versuchen“. Eine Änderung zeichnet die Vorschau sofort (das eigene CSS etwas verzögert) und wird nach kurzer Wartezeit
 * gespeichert – **nur, wenn sie das Schema besteht**; sonst steht der Grund da, und es wird nichts geschrieben. Ein schwacher
 * Kontrast ist ein Hinweis, kein Hindernis (E-W18).
 */
export function Aussehen() {
  const q = useEinstellungen();
  return (
    <div className={styles.seite}>
      {q.art === 'laedt' && <Leise>Das Aussehen wird geladen …</Leise>}
      {q.art === 'fehler' && <FehlerKasten fehler={q.fehler} onNochmal={q.neu} />}
      {q.art === 'unlesbar' && (
        <Hinweis titel="Die gespeicherten Einstellungen lassen sich nicht lesen">
          <Leise>
            Sie bleiben unberührt – niemand löscht sie automatisch. Solange das so ist, lässt sich
            das Aussehen hier nicht ändern, damit nichts davon überschrieben wird.
          </Leise>
          <ul className={styles.probleme}>
            {q.probleme.map((p, i) => (
              <li key={`${p.wert ?? 'x'}-${i}`}>{p.text}</li>
            ))}
          </ul>
        </Hinweis>
      )}
      {q.art === 'bereit' && q.neuFehler && <FehlerKasten fehler={q.neuFehler} onNochmal={q.neu} />}
      {q.art === 'bereit' && <AussehenArbeit q={q} />}
    </div>
  );
}

function AussehenArbeit({ q }: { q: EinstellungenBereit }) {
  const { stand, gemeinde, ich, arbeit, meldung, sperre, aendern, abschicken } = q;
  const [ansicht, setAnsicht] = useState<Ansicht>('computer');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const gesperrt = sperre.fremd !== null;

  // Vorschau: alles sofort, nur das eigene CSS verzögert (jeder Tastendruck zeichnete sonst die ganze Seite neu).
  const cssVerzoegert = useEntprellt(arbeit.eigenesCss, CSS_VORSCHAU_MS);
  const vorschauStand = useMemo(
    () => ({
      seiten: stand.seiten,
      menue: stand.menue,
      einstellungen: { ...arbeit, eigenesCss: cssVerzoegert },
    }),
    [stand.seiten, stand.menue, arbeit, cssVerzoegert],
  );
  const seite: Seite | null =
    stand.seiten.find((s) => s.id === gewaehlt) ??
    stand.seiten.find((s) => s.startseite) ??
    stand.seiten[0] ??
    null;

  const hinweise = kontrastHinweise(arbeit);

  return (
    <>
      <SperrBaender a={sperre} ich={ich} texte={AUSSEHEN_TEXTE} />
      {meldung && (
        <div role="alert" className={styles.kontrast}>
          Noch nicht gespeichert: {meldung}
        </div>
      )}
      <div className={styles.raster}>
        <fieldset className={styles.formular} disabled={gesperrt} aria-label="Aussehen einstellen">
          <section className={styles.karte} aria-label="Farben">
            <h3>Farben</h3>
            <p className={styles.unter}>
              Gelten für die ganze Website. Andere Gemeinden stellen hier ihre eigenen ein.
            </p>
            {FARBFELDER.map((f) => (
              <FarbZeile
                key={f.schluessel}
                schluessel={f.schluessel}
                label={f.label}
                hinweis={f.hinweis}
                gilt={farbeGilt(arbeit, f.schluessel)}
                gesetzt={farbeGesetzt(arbeit, f.schluessel)}
                // Jeder Hinweis genau EINMAL, gesammelt unter „Text“ (Ruhige Bedienung): an beiden beteiligten Farben
                // stand derselbe Satz doppelt – bei zwei Problemen vier Kästen. „Text“ ist die Farbe, an der man es behebt.
                kontrast={f.schluessel === 'text' ? hinweise : []}
                onAendern={(hex) => void aendern((e) => farbeSetzen(e, f.schluessel, hex))}
                onFertig={() => abschicken()}
              />
            ))}
          </section>

          <section className={styles.karte} aria-label="Schriften">
            <h3>Schriften</h3>
            <p className={styles.unter}>
              Eine feste Auswahl freier Schriften. Die erste Wahl gilt für Text und Überschriften;
              danach kannst du sie getrennt wählen.
            </p>
            <SchriftWahlFeld
              rolle="text"
              label="Text"
              arbeit={arbeit}
              onWahl={(w) => void aendern((e) => schriftSetzen(e, 'text', w))}
            />
            <SchriftWahlFeld
              rolle="ueberschrift"
              label="Überschriften"
              arbeit={arbeit}
              onWahl={(w) => void aendern((e) => schriftSetzen(e, 'ueberschrift', w))}
            />
            <SchriftWahlFeld
              rolle="akzent"
              label="Handschrift-Zeile"
              arbeit={arbeit}
              onWahl={(w) => void aendern((e) => schriftSetzen(e, 'akzent', w))}
            />
          </section>

          <section className={styles.karte} aria-label="Logo">
            <h3>Logo</h3>
            <div className={styles.logo}>
              <span>{arbeit.logo ? 'Ein Logo ist hinterlegt.' : 'Noch kein Logo.'}</span>
            </div>
            <p className={styles.unter}>
              Das Logo ändern geht mit dem Hochladen der Bilder – das kommt in einem der nächsten
              Schritte.
            </p>
          </section>

          <section className={styles.karte} aria-label="Eigenes CSS">
            <h3>Eigenes CSS</h3>
            <p className={styles.unter}>Für Feinheiten, die die Einstellungen nicht abdecken.</p>
            <textarea
              aria-label="Eigenes CSS"
              className={styles.code}
              spellCheck={false}
              placeholder={'/* z. B. */\n.w-fuss { font-size: 0.9rem; }'}
              value={arbeit.eigenesCss ?? ''}
              onChange={(ev) => {
                const text = ev.target.value;
                void aendern((e) => ({ ...e, eigenesCss: text === '' ? undefined : text }));
              }}
              onBlur={() => abschicken()}
            />
            <p className={styles.zaehler}>
              {(arbeit.eigenesCss ?? '').length.toLocaleString('de-DE')} von 20.000 Zeichen
            </p>
          </section>
        </fieldset>

        <section className={styles.rechts} aria-label="Vorschau der Startseite">
          <div className={styles.werkzeug}>
            <SeitenWahl seiten={stand.seiten} gewaehlt={seite?.id ?? null} onWahl={setGewaehlt} />
            <SpeicherZustand stand={sperre.speicher} />
            <Segment
              value={ansicht}
              options={[
                { value: 'computer', label: 'Computer' },
                { value: 'handy', label: 'Handy' },
              ]}
              onChange={setAnsicht}
              ariaLabel="Vorschau-Ansicht"
              verbunden
            />
          </div>
          {seite ? (
            <Vorschau seite={seite} stand={vorschauStand} gemeinde={gemeinde} ansicht={ansicht} />
          ) : (
            <Leise>Noch keine Seite – lege im Reiter „Seiten“ die erste an.</Leise>
          )}
        </section>
      </div>
    </>
  );
}

function SeitenWahl({
  seiten,
  gewaehlt,
  onWahl,
}: {
  seiten: readonly Seite[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className={styles.seitenwahl}>
      <label htmlFor={id}>Seite in der Vorschau</label>
      <select
        id={id}
        value={gewaehlt ?? ''}
        disabled={seiten.length === 0}
        onChange={(e) => onWahl(e.target.value)}
      >
        {seiten.map((s) => (
          <option key={s.id} value={s.id}>
            {seitenAuswahlText(s)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Eine Farbe: Farbwähler und Hex-Feld. Das Hex-Feld behält beim Tippen, was getippt ist – **übernommen wird nur ein
 * gültiger Wert**; beim Verlassen springt ein ungültiger auf die geltende Farbe zurück. Bei der dunklen Hauptfarbe heißt
 * ein leeres Feld „aus der Hauptfarbe ableiten“.
 */
function FarbZeile({
  schluessel,
  label,
  hinweis,
  gilt,
  gesetzt,
  kontrast,
  onAendern,
  onFertig,
}: {
  schluessel: FarbSchluessel;
  label: string;
  hinweis: string;
  gilt: string;
  gesetzt: string | undefined;
  kontrast: { auf: 'grund' | 'sanft'; verhaeltnis: number }[];
  onAendern: (hex: string | null) => void;
  onFertig: () => void;
}) {
  const [text, setText] = useState(gesetzt ?? '');
  // Kommt der Wert von außen (anderes Fenster übernommen, Neu laden), zeigt das Feld ihn.
  useEffect(() => {
    setText(gesetzt ?? '');
  }, [gesetzt]);
  const hexId = useId();
  const AUF = { grund: 'Hintergrund', sanft: 'Sanft' } as const;
  return (
    <div className={styles.farbzeile}>
      <input
        type="color"
        className={styles.waehler}
        aria-label={label}
        value={hexVoll(gilt)}
        onChange={(e) => onAendern(e.target.value.toLowerCase())}
        onBlur={onFertig}
      />
      <label htmlFor={hexId} className={styles.farbname}>
        {label}
        <small>
          {hinweis}
          {/* Der Platzhalter zeigt nur die Farbe (das schmale Feld schnitte mehr ab) – dass sie abgeleitet ist, steht hier. */}
          {schluessel === 'hauptTief' && gesetzt === undefined && (
            <> · wird aus der Hauptfarbe abgeleitet</>
          )}
        </small>
      </label>
      <input
        id={hexId}
        className={styles.hex}
        value={text}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        // Die geltende Farbe als Platzhalter: sichtbar, ohne dass dadurch etwas gespeichert wird.
        placeholder={gilt}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const hex = hexAusEingabe(t);
          if (hex !== null) onAendern(hex);
          else if (schluessel === 'hauptTief' && t.trim() === '') onAendern(null);
        }}
        onBlur={() => {
          // Ein ungültiger Wert wird nicht übernommen: Das Feld zeigt wieder, was gilt.
          if (hexAusEingabe(text) === null && !(schluessel === 'hauptTief' && text.trim() === ''))
            setText(gesetzt ?? '');
          onFertig();
        }}
      />
      {kontrast.map((k) => (
        <p key={k.auf} role="note" className={styles.kontrast}>
          Text auf {AUF[k.auf]}: Kontrast {verhaeltnisText(k.verhaeltnis)}. Unter 4,5 : 1 kann Text
          schwer lesbar sein – du kannst trotzdem speichern.
        </p>
      ))}
    </div>
  );
}

/** Auswahl einer Schrift, nach Art gruppiert. „Eigene Schrift“ zeigt bis zum Hochladen der Bilder nur den Hinweis. */
function SchriftWahlFeld({
  rolle,
  label,
  arbeit,
  onWahl,
}: {
  rolle: SchriftRolle;
  label: string;
  arbeit: Einstellungen;
  onWahl: (wahl: { art: 'auswahl'; name: string } | null) => void;
}) {
  const id = useId();
  const [eigeneHinweis, setEigeneHinweis] = useState(false);
  const wahl = arbeit.schriften?.[rolle];
  const wert =
    wahl === undefined
      ? ''
      : wahl.art === 'auswahl' && findeSchrift(wahl.name)
        ? wahl.name
        : VORHANDEN;
  return (
    <div className={styles.feld}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className={styles.auswahl}
        value={wert}
        onChange={(e) => {
          const v = e.target.value;
          if (v === EIGENE) return setEigeneHinweis(true);
          if (v === VORHANDEN) return;
          setEigeneHinweis(false);
          onWahl(v === '' ? null : { art: 'auswahl', name: v });
        }}
      >
        {(rolle === 'akzent' || wahl === undefined) && (
          <option value="" disabled={rolle !== 'akzent'}>
            {rolle === 'akzent' ? 'Wie die Überschriften' : 'Systemschrift'}
          </option>
        )}
        {wert === VORHANDEN && wahl && (
          <option value={VORHANDEN}>{wahl.name} (eigene Schrift)</option>
        )}
        {KATEGORIEN.map((k) => (
          <optgroup key={k.art} label={k.titel}>
            {SCHRIFTEN.filter((s) => s.kategorie === k.art).map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Eigene">
          <option value={EIGENE}>Eigene Schrift …</option>
        </optgroup>
      </select>
      {eigeneHinweis && (
        <p className={styles.unter} role="note">
          Eigene Schriften lädst du mit dem Hochladen der Bilder hoch – das kommt in einem der
          nächsten Schritte.
        </p>
      )}
    </div>
  );
}
