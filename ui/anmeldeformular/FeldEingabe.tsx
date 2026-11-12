import { type ReactNode } from 'react';
import { nurText, type Antwort, type Feld } from '@shared/anmeldung/formular';
import { wahlAntworten, type AntwortZustand } from '@shared/anmeldung/bedingungen';
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
}) {
  const f = feld;
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

  if (f.typ === 'info')
    return (
      <div className={`${s.pf} ${s.infofield}`}>
        <b>{f.frage}</b>
        {f.hilfe && <span>{f.hilfe}</span>}
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
        {antworten.map((a) => (
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
              onChange={() => onWert(a)}
            />
            <span>
              {a}
              {grund(a) && <small> ({grund(a)})</small>}
            </span>
          </label>
        ))}
      </div>
    );
  } else if (f.typ === 'select') {
    eingabe = (
      <select
        id={id}
        value={typeof wert === 'string' ? wert : ''}
        disabled={gesperrt}
        onChange={(e) => onWert(e.target.value)}
      >
        <option value="">Bitte wählen …</option>
        {sichtbareAntworten(f.antworten).map((a) => (
          <option key={a} value={a} disabled={zustand(a).art === 'grau'}>
            {a}
            {grund(a) ? ` (${grund(a)})` : ''}
          </option>
        ))}
      </select>
    );
  } else if (f.typ === 'multi') {
    const gewaehlt = Array.isArray(wert) ? wert : [];
    eingabe = (
      <div className={s.choices} role="group" aria-labelledby={`${id}-l`}>
        {sichtbareAntworten(f.antworten).map((a) => (
          <label key={a} className={`${s.choice} ${zustand(a).art === 'grau' ? s.gesperrt : ''}`}>
            <input
              type="checkbox"
              checked={gewaehlt.includes(a)}
              disabled={gesperrt || zustand(a).art === 'grau'}
              onChange={(e) =>
                onWert(e.target.checked ? [...gewaehlt, a] : gewaehlt.filter((x) => x !== a))
              }
            />
            <span>
              {a}
              {grund(a) && <small> ({grund(a)})</small>}
            </span>
          </label>
        ))}
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
