import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { ANSICHT_NAME_MAX } from '@shared/anmeldung/ansichten';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';

/** Was das Fenster tut: den Filter von jetzt speichern, eine leere Ansicht anlegen oder eine umbenennen. */
export type AnsichtFensterArt = 'speichern' | 'neu' | 'umbenennen';

/**
 * **„Als Ansicht speichern“ / „Neue Ansicht“ / „Ansicht umbenennen“** (U3, Entwurf `r2-u3-filter-ansichten-v1`) – ein
 * Name, darunter, was gespeichert wird (Filter, Spalten, Sortierung), und der Hinweis, dass es fürs ganze Team gilt.
 * Prüfen (`fehler`) und Speichern macht der Aufrufer; ein Fehler steht rot unter dem Namen, das Fenster bleibt offen.
 */
export function AnsichtFenster({
  art,
  startName = '',
  was,
  fehler,
  onSpeichern,
  onClose,
}: {
  art: AnsichtFensterArt;
  startName?: string;
  /** Beim Anlegen: was mitgespeichert wird – je Zeile Überschrift und Text. */
  was?: { titel: string; text: string }[];
  /** Prüft den Namen (und den Platz) – `null` = in Ordnung. */
  fehler: (name: string) => string | null;
  onSpeichern: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(startName);
  const [meldung, setMeldung] = useState<string | null>(null);
  const titel =
    art === 'umbenennen'
      ? 'Ansicht umbenennen'
      : art === 'neu'
        ? 'Neue Ansicht'
        : 'Als Ansicht speichern';
  const speichern = () => {
    const x = fehler(name);
    if (x) return setMeldung(x);
    onSpeichern(name.trim());
  };
  return (
    <Sheet
      title={titel}
      onClose={onClose}
      knoepfe={<FensterKnopf onClick={speichern}>Speichern</FensterKnopf>}
    >
      <label className={f.feld}>
        <span>Name der Ansicht</span>
        <input
          className={f.eingabe}
          value={name}
          maxLength={ANSICHT_NAME_MAX}
          placeholder="z. B. Küchenteam"
          autoFocus
          onChange={(ev) => {
            setName(ev.target.value);
            setMeldung(null);
          }}
          onKeyDown={(ev) => ev.key === 'Enter' && speichern()}
        />
      </label>
      {meldung && (
        <p className={a.hinweisRot} role="alert">
          {meldung}
        </p>
      )}
      {was && (
        <dl className={a.ansichtWas}>
          {was.map((w) => (
            <div key={w.titel}>
              <dt>{w.titel}</dt>
              <dd>{w.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {art !== 'umbenennen' && (
        <p className={a.hinweisBlau}>
          Gilt für das <b>ganze Team</b> dieser Veranstaltung und erscheint als Reiter hinter
          „Abgesagt“. Bei „wie eine frühere Veranstaltung“ wird sie mitkopiert. Gespeichert werden
          nur Filter, Spalten und Sortierung – keine Namen.
        </p>
      )}
    </Sheet>
  );
}
