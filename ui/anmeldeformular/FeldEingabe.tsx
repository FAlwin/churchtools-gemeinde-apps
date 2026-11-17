import { useState, type ReactNode } from 'react';
import { nurText, type Antwort, type Feld } from '@shared/anmeldung/formular';
import { wahlAntworten, type AntwortZustand } from '@shared/anmeldung/bedingungen';
import { freiGewaehlt, freiMitText, freiName } from '@shared/anmeldung/freieAntwort';
import { hinweisTeile } from '@shared/anmeldung/hinweisLinks';
import { datumText } from '@shared/ct/datum';
import { ErziehungsEingabe, UnterschriftEingabe } from './Bausteine';
import s from './AnmeldeFormular.module.scss';

function Pflicht({ f }: { f: Feld }) {
  if (f.zustand === 'pflicht')
    return (
      <span className={s.req} aria-hidden="true">
        *
      </span>
    );
  if (f.zustand === 'freiwillig' && !nurText(f.typ))
    return <span className={s.opt}> (freiwillig)</span>;
  return null;
}

/**
 * **Ein Feld, wie Gäste es sehen.** Auch einzeln nutzbar (der Baukasten zeigt jedes Feld so, gesperrt).
 * `fehler`: Schlüssel aus `pruefeAntworten`, die zu diesem Feld gehören.
 */
export function FeldEingabe({
  feld,
  wert,
  onWert,
  pfad,
  fehler = [],
  gesperrt = false,
  loeschtag = null,
  zusatz = null,
  antwortZu,
  geloest,
  freiText = '',
  onFreiText,
}: {
  feld: Feld;
  wert: Antwort;
  onWert: (w: Antwort) => void;
  /** Eindeutige Kennung für `id`/`name` (z. B. `p1-birth`). */
  pfad: string;
  fehler?: string[];
  gesperrt?: boolean;
  loeschtag?: string | null;
  /** Steht hinter der (ersten) Beschriftung – im Baukasten das ⓘ. */
  zusatz?: ReactNode;
  /** F1b: Wie eine Antwort gerade erscheint (Bedingung an der Antwort) – ohne: alle wählbar (`useBedingungen`). */
  antwortZu?: (antwort: string) => AntwortZustand;
  /** F1b: „„Gruppenleiter“ ist nur für Getaufte möglich – bitte neu wählen.“ – die Wahl wurde gerade gelöst. */
  geloest?: string;
  /** F3: der Text der freien Antwort und sein Setter (`freiEingabe`). */
  freiText?: string;
  onFreiText?: (t: string) => void;
}) {
  const f = feld;
  // F3: Wer die freie Antwort gerade gewählt hat, tippt gleich los – das Feld, das aufklappt, bekommt den Fokus.
  const [freiFokus, setFreiFokus] = useState(false);
  const hatFehler = (unter = '') => fehler.includes(unter ? `${pfad}.${unter}` : pfad);
  const fehlerText = (text: string, unter = '') =>
    hatFehler(unter) ? <span className={s.err}>{text}</span> : null;
  const hilfe = f.hilfe ? <span className={s.help}>{f.hilfe}</span> : null;
  const id = `af-${pfad}`;
  // F1b: Antworten mit Bedingung – „weg“ fehlt ganz, „grau“ ist gesperrt und sagt warum.
  const zustand = (a: string): AntwortZustand => antwortZu?.(a) ?? { art: 'frei' };
  const sichtbareAntworten = (liste: string[]) => liste.filter((a) => zustand(a).art !== 'weg');
  const grund = (a: string) => {
    const z = zustand(a);
    return z.art === 'grau' && z.grund ? z.grund : null;
  };

  if (f.typ === 'ueberschrift')
    return (
      <div className={`${s.pf} ${s.zwischen}`}>
        <h3>{f.frage}</h3>
        {f.hilfe && <span className={s.help}>{f.hilfe}</span>}
      </div>
    );
  if (f.typ === 'trenner') return <hr className={s.trenner} />;
  // F2: Wo nicht geblättert wird (im Baukasten; Formular und „von Hand“ blättern seit F2b/F2d), steht ein Schritt als
  // Trennzeile da.
  if (f.typ === 'schritt') return <div className={s.schrittMarke}>Schritt · {f.frage}</div>;

  if (f.typ === 'info')
    return (
      <div className={`${s.pf} ${s.infofield}`}>
        <b>{f.frage}</b>
        {/* F5b: Links im Hinweistext (`[Text](https://…)`) – öffnen in einem neuen Tab. */}
        {f.hilfe && (
          <span className={s.hinweisText}>
            {hinweisTeile(f.hilfe).map((t, i) =>
              t.art === 'text' ? (
                t.text
              ) : (
                <a key={i} href={t.adresse} target="_blank" rel="noopener noreferrer">
                  {t.text}
                </a>
              ),
            )}
          </span>
        )}
      </div>
    );

  // A6-2b: zusammengesetzte Bausteine (`Bausteine.tsx`).
  if (f.typ === 'erziehungsberechtigte' || f.typ === 'unterschrift') {
    const Eingabe = f.typ === 'erziehungsberechtigte' ? ErziehungsEingabe : UnterschriftEingabe;
    return (
      <Eingabe
        feld={f}
        wert={wert}
        onWert={onWert}
        pfad={pfad}
        fehler={fehler}
        gesperrt={gesperrt}
        zusatz={zusatz}
      />
    );
  }

  if (f.typ === 'name') {
    const n = (wert ?? {}) as { vor?: string; nach?: string };
    return (
      <div className={s.g2}>
        {(['vor', 'nach'] as const).map((teil) => (
          <div key={teil} className={`${s.pf} ${hatFehler(teil) ? s.bad : ''}`}>
            <label htmlFor={`${id}-${teil}`}>
              {teil === 'vor' ? 'Vorname' : 'Nachname'}
              <span className={s.req} aria-hidden="true">
                *
              </span>
              {teil === 'vor' && zusatz}
            </label>
            <input
              id={`${id}-${teil}`}
              value={n[teil] ?? ''}
              disabled={gesperrt}
              autoComplete={teil === 'vor' ? 'given-name' : 'family-name'}
              onChange={(e) =>
                onWert({ vor: n.vor ?? '', nach: n.nach ?? '', [teil]: e.target.value })
              }
            />
            {fehlerText(
              teil === 'vor' ? 'Bitte Vornamen eintragen.' : 'Bitte Nachnamen eintragen.',
              teil,
            )}
          </div>
        ))}
      </div>
    );
  }

  if (f.typ === 'check' || f.typ === 'privacy') {
    const text =
      f.typ === 'privacy'
        ? `Ich bin einverstanden, dass die Gemeinde die Angaben für diese Veranstaltung speichert.${
            loeschtag ? ` Sie werden am ${datumText(loeschtag)} gelöscht.` : ''
          }`
        : f.frage;
    return (
      <div className={`${s.pf} ${hatFehler() ? s.bad : ''}`}>
        <label className={`${s.check} ${hatFehler() ? s.bad : ''}`}>
          <input
            type="checkbox"
            checked={wert === true}
            disabled={gesperrt}
            onChange={(e) => onWert(e.target.checked)}
          />
          <span>
            {text}
            {f.zustand === 'pflicht' && (
              <span className={s.req} aria-hidden="true">
                *
              </span>
            )}
            {zusatz}
          </span>
        </label>
        {hilfe}
        {fehlerText('Bitte ankreuzen.')}
      </div>
    );
  }

  // ── F3: die freie Antwort (Entwurf f3-freie-antwort-v1) ──
  const frei = freiMitText(f) ? f.frei! : null;
  const freiGew = freiGewaehlt(f, wert);
  /** Die freie Antwort mitwählen – beim Tippen in ein Feld, das „immer da“ steht. */
  const freiWaehlen = () =>
    onWert(f.typ === 'multi' ? [...(Array.isArray(wert) ? wert : []), frei!.name] : frei!.name);
  /** Gewählt wurde etwas – war es die freie Antwort mit aufklappendem Feld, bekommt dieses den Fokus. */
  const gewaehlt = (a: string) =>
    setFreiFokus(!!frei && frei.textfeld === 'auf' && a === frei.name);
  const freiFeld =
    frei && (frei.textfeld === 'immer' || freiGew) ? (
      <div className={`${s.freiText} ${hatFehler('frei') ? s.bad : ''}`}>
        <input
          id={`${id}-frei`}
          aria-label={frei.name}
          placeholder={frei.textfeld === 'immer' ? frei.name : 'Bitte eintragen'}
          value={freiText}
          disabled={gesperrt}
          autoFocus={freiFokus}
          onChange={(e) => {
            onFreiText?.(e.target.value);
            if (e.target.value.trim() && !freiGew) freiWaehlen();
          }}
        />
        {fehlerText(`Bitte „${frei.name}“ eintragen.`, 'frei')}
      </div>
    ) : null;
  /** Bei „steht immer da“ steht das Feld in der Zeile der freien Antwort (Eine Antwort, Mehrere Antworten). */
  const inZeile = (a: string) =>
    frei?.textfeld === 'immer' && a === freiName(f) && f.typ !== 'janein';

  let eingabe: React.ReactNode;
  if (f.typ === 'textarea') {
    eingabe = (
      <textarea
        id={id}
        rows={3}
        value={typeof wert === 'string' ? wert : ''}
        disabled={gesperrt}
        onChange={(e) => onWert(e.target.value)}
      />
    );
  } else if (f.typ === 'janein' || f.typ === 'radio') {
    const antworten = sichtbareAntworten(wahlAntworten(f));
    eingabe = (
      <div
        className={f.typ === 'janein' ? s.yn : s.choices}
        role="radiogroup"
        aria-labelledby={`${id}-l`}
      >
        {antworten.map((a) => {
          const knopf = (
            <label
              key={a}
              className={`${f.typ === 'janein' ? s.ynb : s.choice} ${zustand(a).art === 'grau' ? s.gesperrt : ''}`}
            >
              <input
                type="radio"
                name={id}
                value={a}
                checked={wert === a}
                disabled={gesperrt || zustand(a).art === 'grau'}
                onChange={() => {
                  onWert(a);
                  gewaehlt(a);
                }}
              />
              <span>
                {a}
                {inZeile(a) && ':'}
                {grund(a) && <small> ({grund(a)})</small>}
              </span>
            </label>
          );
          return inZeile(a) ? (
            <div key={a} className={s.freiZeile}>
              {knopf}
              {freiFeld}
            </div>
          ) : (
            knopf
          );
        })}
      </div>
    );
  } else if (f.typ === 'select') {
    eingabe = (
      <select
        id={id}
        value={typeof wert === 'string' ? wert : ''}
        disabled={gesperrt}
        onChange={(e) => {
          onWert(e.target.value);
          gewaehlt(e.target.value);
        }}
      >
        <option value="">Bitte wählen …</option>
        {sichtbareAntworten(wahlAntworten(f)).map((a) => (
          <option key={a} value={a} disabled={zustand(a).art === 'grau'}>
            {a}
            {grund(a) ? ` (${grund(a)})` : ''}
          </option>
        ))}
      </select>
    );
  } else if (f.typ === 'multi') {
    const liste = Array.isArray(wert) ? wert : [];
    eingabe = (
      <div className={s.choices} role="group" aria-labelledby={`${id}-l`}>
        {sichtbareAntworten(wahlAntworten(f)).map((a) => {
          const kaestchen = (
            <label key={a} className={`${s.choice} ${zustand(a).art === 'grau' ? s.gesperrt : ''}`}>
              <input
                type="checkbox"
                checked={liste.includes(a)}
                disabled={gesperrt || zustand(a).art === 'grau'}
                onChange={(e) => {
                  onWert(e.target.checked ? [...liste, a] : liste.filter((x) => x !== a));
                  if (e.target.checked) gewaehlt(a);
                }}
              />
              <span>
                {a}
                {inZeile(a) && ':'}
                {grund(a) && <small> ({grund(a)})</small>}
              </span>
            </label>
          );
          return inZeile(a) ? (
            <div key={a} className={s.freiZeile}>
              {kaestchen}
              {freiFeld}
            </div>
          ) : (
            kaestchen
          );
        })}
      </div>
    );
  } else {
    const typ =
      { email: 'email', tel: 'tel', date: 'date', number: 'number' }[f.typ as string] ?? 'text';
    eingabe = (
      <input
        id={id}
        type={typ}
        value={typeof wert === 'string' ? wert : ''}
        placeholder={f.typ === 'text' && f.hilfe ? f.hilfe : undefined}
        disabled={gesperrt}
        autoComplete={f.typ === 'email' ? 'email' : f.typ === 'tel' ? 'tel' : 'off'}
        onChange={(e) => onWert(e.target.value)}
      />
    );
  }
  return (
    <div className={`${s.pf} ${hatFehler() ? s.bad : ''}`}>
      <label id={`${id}-l`} htmlFor={id}>
        {f.frage}
        <Pflicht f={f} />
        {zusatz}
      </label>
      {eingabe}
      {!(frei && inZeile(frei.name)) && freiFeld}
      {!(f.typ === 'text' && f.hilfe) && hilfe}
      {geloest && (
        <span className={s.err} role="status">
          {geloest}
        </span>
      )}
      {!geloest &&
        fehlerText(
          f.typ === 'email' && typeof wert === 'string' && wert.trim()
            ? 'Bitte eine gültige E-Mail-Adresse eintragen.'
            : 'Bitte ausfüllen.',
        )}
    </div>
  );
}
