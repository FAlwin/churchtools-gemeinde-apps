import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { BAUSTEINE, nurText, type Feld, type Feldtyp } from '@shared/anmeldung/formular';
import {
  entwurfFehler,
  mitAntworten,
  type AntwortEntwurf,
  type FeldEntwurf,
} from './baukastenEntwurf';
import { geburtsdatumNoetigText } from './anzeige';
import k from './Baukasten.module.scss';

/**
 * **Ein Feld direkt im Formular bearbeiten** (A5, wie bei Google Forms): Frage, Hilfetext, Antworten und „Pflicht“
 * stehen genau dort, wo das Feld im Formular steht. Gespeichert wird vom Baukasten (beim Verlassen des Felds oder
 * nach einer Pause) – diese Komponente meldet nur Änderungen.
 */

const FRAGETYPEN = BAUSTEINE.filter((x) => x.gruppe === 'frage');

/** Wie die Eingabe aussieht – damit man beim Bearbeiten sieht, was Gäste ausfüllen (Google Forms: „Kurzantwort“). */
function Muster({ f }: { f: Feld }) {
  switch (f.typ) {
    case 'text':
    case 'tel':
      return <div className={k.muster}>Kurze Antwort</div>;
    case 'textarea':
      return <div className={`${k.muster} ${k.musterLang}`}>Längere Antwort</div>;
    case 'date':
      return <div className={`${k.muster} ${k.musterKurz}`}>TT.MM.JJJJ</div>;
    case 'number':
      return <div className={`${k.muster} ${k.musterKurz}`}>Zahl</div>;
    case 'janein':
      return (
        <div className={k.musterReihe}>
          <span className={k.muster}>Ja</span>
          <span className={k.muster}>Nein</span>
        </div>
      );
    case 'trenner':
      return <hr className={k.musterLinie} />;
    default:
      return null;
  }
}

export function FeldBearbeiten({
  entwurf: d,
  onAendern,
  beantwortet,
  entferntGewaehlt,
  wozuGeburtsdatum: wozu,
  werkzeug,
  onTyp,
}: {
  entwurf: FeldEntwurf;
  onAendern: (d: FeldEntwurf) => void;
  /** Wie viele Anmeldungen das Feld schon beantwortet haben (`null` = nicht bekannt). */
  beantwortet: number | null;
  /** Entfernte Antworten, die schon jemand gewählt hat – bleiben in ChurchTools, im Formular ausgeblendet. */
  entferntGewaehlt: string[];
  /** Wozu die Preise das Geburtsdatum brauchen (`wozuGeburtsdatum`) – dann ist es unverzichtbar. */
  wozuGeburtsdatum: 'alter' | 'geschwister' | null;
  /** Verschieben, kopieren, entfernen – unten im Feld wie bei Google Forms, nicht über dem Text. */
  werkzeug?: ReactNode;
  /** Fragetyp ändern (nur eigene Fragen, solange niemand geantwortet hat – ChurchTools ändert den Typ nicht). */
  onTyp?: (typ: Feldtyp) => void;
}) {
  const f = d.feld;
  const setFeld = (neu: Partial<Feld>) => onAendern({ ...d, feld: { ...f, ...neu } });
  const setAntworten = (antworten: AntwortEntwurf[]) => onAendern({ ...d, antworten });
  const eigen = f.art === 'eigen';
  const text = nurText(f.typ);
  const fehler = entwurfFehler(d);
  const zeichen = f.typ === 'radio' ? k.punkt : f.typ === 'multi' ? k.kaestchen : null;

  return (
    <div className={k.bearbeiten}>
      {beantwortet !== null && beantwortet > 0 && (
        <p className={k.notiz} role="note">
          {beantwortet === 1 ? 'Eine Anmeldung hat' : `${beantwortet} Anmeldungen haben`} hier schon
          geantwortet. Umbenennen lässt die Antworten stehen.
        </p>
      )}
      {f.typ !== 'trenner' && (
        <input
          className={k.frage}
          value={f.frage}
          maxLength={200}
          disabled={!eigen}
          aria-label={text ? 'Text' : f.typ === 'check' ? 'Text neben dem Kästchen' : 'Frage'}
          placeholder={text ? 'Text' : 'Frage'}
          // Neu aus dem Baukasten: gleich lostippen.
          autoFocus={eigen}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setFeld({ frage: e.target.value })}
        />
      )}
      {f.typ !== 'trenner' && (
        <input
          className={k.hilfe}
          value={f.hilfe}
          maxLength={400}
          aria-label={f.typ === 'info' ? 'Hinweistext' : 'Hilfetext'}
          placeholder={f.typ === 'info' ? 'Hinweistext' : 'Hilfetext darunter (freiwillig)'}
          onChange={(e) => setFeld({ hilfe: e.target.value })}
        />
      )}
      <Muster f={f} />
      {mitAntworten(f) && (
        <div className={k.antworten}>
          {d.antworten.map((a, i) => (
            <div key={i} className={k.antwort}>
              {zeichen ? (
                <span className={zeichen} aria-hidden="true" />
              ) : (
                <span className={k.nummer}>{i + 1}.</span>
              )}
              <input
                value={a.text}
                maxLength={80}
                aria-label={`Antwort ${i + 1}`}
                onChange={(e) =>
                  setAntworten(
                    d.antworten.map((x, j) => (i === j ? { ...x, text: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                aria-label={`Antwort ${i + 1} entfernen`}
                disabled={d.antworten.length <= 2}
                onClick={() => setAntworten(d.antworten.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={k.antwortNeu}
            onClick={() =>
              setAntworten([...d.antworten, { text: `Antwort ${d.antworten.length + 1}` }])
            }
          >
            + Antwort hinzufügen
          </button>
          {entferntGewaehlt.length > 0 && (
            <p className={k.notiz} role="note">
              {entferntGewaehlt.map((t) => `„${t}“`).join(', ')}{' '}
              {entferntGewaehlt.length === 1 ? 'hat' : 'haben'} schon jemand gewählt – bleibt in
              ChurchTools stehen und wird im Formular nur ausgeblendet.
            </p>
          )}
        </div>
      )}
      <div className={k.fuss}>
        {eigen && !text && onTyp ? (
          <select
            className={k.typ}
            value={f.typ}
            aria-label="Fragetyp"
            disabled={!!beantwortet}
            title={
              beantwortet
                ? 'Hier wurde schon geantwortet – der Fragetyp lässt sich nicht mehr ändern.'
                : 'Fragetyp ändern'
            }
            onChange={(e) => onTyp(e.target.value as Feldtyp)}
          >
            {FRAGETYPEN.map((x) => (
              <option key={x.typ} value={x.typ}>
                {x.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{text ? 'Nur Text, keine Frage' : 'Empfohlener Baustein'}</span>
        )}
        {werkzeug && <span className={k.werkzeugUnten}>{werkzeug}</span>}
        {!text && (
          <button
            type="button"
            className={k.pflicht}
            aria-pressed={f.zustand === 'pflicht'}
            // Das Geburtsdatum gibt es nur als Pflicht (Preise nach Alter, Check-in).
            disabled={f.id === 'birth'}
            onClick={() => setFeld({ zustand: f.zustand === 'pflicht' ? 'freiwillig' : 'pflicht' })}
          >
            {f.typ === 'check' ? 'Muss angekreuzt werden' : 'Pflicht'}
            <Schalter an={f.zustand === 'pflicht'} />
          </button>
        )}
      </div>
      {f.id === 'birth' && wozu && (
        <p className={k.notiz} role="note">
          {geburtsdatumNoetigText(wozu)}
        </p>
      )}
      {fehler && (
        <p className={k.fehler} role="alert">
          {fehler}
        </p>
      )}
    </div>
  );
}
