import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { ListeEingabe } from '@ui/anmeldeformular/ListeEingabe';
import type { Feld } from '@shared/anmeldung/formular';
import { GRUPPENFELD_MAX, zahlText } from '@shared/anmeldung/feldwert';
import {
  EINHEIT_MAX,
  SPALTEN_MAX,
  SPALTEN_NAME_MAX,
  ZEILEN_MAX,
  ZELLE_MAX,
  listeKoennteZuLangWerden,
  neueSpalte,
  type ListeAntwort,
  type ListeEinstellung,
  type ListenSpalte,
  type SpaltenArt,
} from '@shared/anmeldung/zeilenListe';
import k from './Baukasten.module.scss';

/**
 * **Liste mit Zeilen im Baukasten bearbeiten** (F6a, Entwurf `f6-liste-v1`, Ansicht „Baukasten“): je Spalte eine Zeile
 * mit Name, Art (Text, Zahl, Auswahl), Einheit und „Summe zeigen“ (Zahl) bzw. Antworten (Auswahl), verschieben und
 * löschen; darunter „Spalte hinzufügen“ (höchstens 5), „Höchstens n Zeilen“ und die Vorschau, wie Gäste die Liste sehen.
 * Ob alles stimmt, sagt `listeEinstellungFehler` (über `feldFehler` am Feld).
 */
export function ListeBearbeiten({
  feld: f,
  onListe,
}: {
  feld: Feld;
  onListe: (l: ListeEinstellung) => void;
}) {
  const l = f.liste;
  if (!l) return null;
  const setze = (spalten: ListenSpalte[]) => onListe({ ...l, spalten });
  const aendern = (i: number, neu: ListenSpalte) =>
    setze(l.spalten.map((x, j) => (j === i ? neu : x)));
  const artWechsel = (i: number, art: SpaltenArt) => {
    const { id, name } = l.spalten[i];
    aendern(
      i,
      art === 'auswahl'
        ? { id, name, art, antworten: ['Antwort 1', 'Antwort 2'] }
        : { id, name, art },
    );
  };
  // Nur eine Spalte zählt zusammen – ein neuer Haken nimmt den alten weg.
  const summeSetzen = (i: number, an: boolean) =>
    setze(
      l.spalten.map((x, j) => {
        if (x.art !== 'zahl') return x;
        const neu = { ...x };
        if (j === i && an) neu.summe = true;
        else delete neu.summe;
        return neu;
      }),
    );
  const schieben = (i: number, um: -1 | 1) => {
    const neu = [...l.spalten];
    [neu[i], neu[i + um]] = [neu[i + um], neu[i]];
    setze(neu);
  };
  const n = l.spalten.length;

  return (
    <div className={k.listeBearb}>
      <h5 className={k.listeTitel}>Spalten</h5>
      {l.spalten.map((sp, i) => (
        <div key={sp.id} className={k.listeSpalte}>
          <input
            value={sp.name}
            maxLength={SPALTEN_NAME_MAX}
            aria-label={`Name der Spalte ${i + 1}`}
            onChange={(e) => aendern(i, { ...sp, name: e.target.value })}
          />
          <select
            value={sp.art}
            aria-label={`Art der Spalte ${i + 1}`}
            onChange={(e) => artWechsel(i, e.target.value as SpaltenArt)}
          >
            <option value="text">Text</option>
            <option value="zahl">Zahl</option>
            <option value="auswahl">Auswahl</option>
          </select>
          <span className={k.listeZusatz}>
            {sp.art === 'zahl' && (
              <>
                <input
                  className={k.listeEinheit}
                  value={sp.einheit ?? ''}
                  maxLength={EINHEIT_MAX}
                  placeholder="Einheit"
                  aria-label={`Einheit der Spalte ${i + 1}`}
                  onChange={(e) => {
                    const neu: ListenSpalte = { ...sp, einheit: e.target.value };
                    if (!e.target.value) delete neu.einheit;
                    aendern(i, neu);
                  }}
                />
                <label className={k.listeSumme}>
                  <input
                    type="checkbox"
                    checked={!!sp.summe}
                    onChange={(e) => summeSetzen(i, e.target.checked)}
                  />
                  Summe zeigen
                </label>
              </>
            )}
            {sp.art === 'auswahl' && (
              <AntwortenText
                antworten={sp.antworten ?? []}
                label={`Antworten der Spalte ${i + 1}`}
                onAntworten={(antworten) => aendern(i, { ...sp, antworten })}
              />
            )}
            {sp.art === 'text' && <span className={k.notiz}>bis {ZELLE_MAX} Zeichen</span>}
          </span>
          <span className={k.listeWerkzeug}>
            <ZeilenKnopf
              label={`Spalte „${sp.name}“ weiter nach vorn`}
              disabled={i === 0}
              onClick={() => schieben(i, -1)}
            >
              <Icon name="chev-up" size={16} />
            </ZeilenKnopf>
            <ZeilenKnopf
              label={`Spalte „${sp.name}“ weiter nach hinten`}
              disabled={i === n - 1}
              onClick={() => schieben(i, 1)}
            >
              <Icon name="chev-down" size={16} />
            </ZeilenKnopf>
            <ZeilenKnopf
              label={`Spalte „${sp.name}“ löschen`}
              disabled={n === 1}
              onClick={() => setze(l.spalten.filter((_, j) => j !== i))}
            >
              <Icon name="trash" size={16} />
            </ZeilenKnopf>
          </span>
        </div>
      ))}
      <span>
        <TextKnopf
          disabled={n >= SPALTEN_MAX}
          onClick={() => setze([...l.spalten, neueSpalte(l.spalten)])}
        >
          {n >= SPALTEN_MAX ? `höchstens ${SPALTEN_MAX} Spalten` : '+ Spalte hinzufügen'}
        </TextKnopf>
      </span>
      <HoechstZahl max={l.max} onMax={(max) => onListe({ ...l, max })} />
      {listeKoennteZuLangWerden(l) && (
        <p className={k.notiz} role="note">
          Achtung: So viele Zeilen und Spalten passen mit längeren Einträgen nicht in ChurchTools
          (höchstens {zahlText(GRUPPENFELD_MAX)} Zeichen). Das Formular sagt es dann beim Absenden.
          Weniger Zeilen oder Spalten schaffen Luft.
        </p>
      )}
      {f.zustand === 'pflicht' && (
        <p className={k.notiz} role="note">
          Pflicht: Es muss mindestens eine Zeile vollständig ausgefüllt sein.
        </p>
      )}
      <p className={k.listeVorschauTitel}>Vorschau – so sieht es im Formular aus:</p>
      <div className={k.listeVorschau}>
        <ListeEingabe
          feld={f}
          wert={beispiel(l)}
          onWert={() => {}}
          pfad={`vorschau-${f.id}`}
          fehler={[]}
          gesperrt
          zusatz={null}
        />
      </div>
    </div>
  );
}

/** Zwei ausgefüllte Beispielzeilen für die Vorschau – aus den Spalten, wie sie gerade sind. */
function beispiel(l: ListeEinstellung): ListeAntwort {
  return {
    zeilen: [1, 2].map((nr) =>
      Object.fromEntries(
        l.spalten.map((sp) => [
          sp.id,
          sp.art === 'zahl'
            ? String(nr * 10)
            : sp.art === 'auswahl'
              ? (sp.antworten?.[nr - 1] ?? sp.antworten?.[0] ?? '')
              : `Beispiel ${nr}`,
        ]),
      ),
    ),
  };
}

/**
 * Die Antworten einer Auswahl-Spalte, mit Komma getrennt (Entwurf). Der getippte Text bleibt stehen, solange man
 * schreibt – sonst verschwände ein Komma am Ende sofort wieder.
 */
function AntwortenText({
  antworten,
  label,
  onAntworten,
}: {
  antworten: string[];
  label: string;
  onAntworten: (a: string[]) => void;
}) {
  const [text, setText] = useState(antworten.join(', '));
  return (
    <input
      className={k.listeAntworten}
      value={text}
      placeholder="Antworten, mit Komma getrennt"
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        onAntworten(
          e.target.value
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        );
      }}
      onBlur={() => setText(antworten.join(', '))}
    />
  );
}

/** „Höchstens [n] Zeilen“ – 1 bis 50; was dazwischen getippt wird (leer, „0“), bleibt stehen, bis es passt. */
function HoechstZahl({ max, onMax }: { max: number; onMax: (n: number) => void }) {
  const [text, setText] = useState(String(max));
  const n = Number(text);
  const passt = Number.isInteger(n) && n >= 1 && n <= ZEILEN_MAX;
  return (
    <label className={k.listeMax}>
      Höchstens
      <input
        type="number"
        min={1}
        max={ZEILEN_MAX}
        value={text}
        aria-label="Höchstzahl Zeilen"
        aria-invalid={!passt || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const neu = Number(e.target.value);
          if (Number.isInteger(neu) && neu >= 1 && neu <= ZEILEN_MAX) onMax(neu);
        }}
        onBlur={() => !passt && setText(String(max))}
      />
      Zeilen {!passt && <span className={k.fehler}>(1 bis {ZEILEN_MAX})</span>}
    </label>
  );
}
