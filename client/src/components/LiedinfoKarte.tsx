import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ARRANGEMENT_GRENZEN, LIED_GRENZEN } from '@shared/types/index';
import type { LiedinfoFeld, LiedinfoVergleich } from '@shared/ct/liedinfo';
import {
  liedinfoUebernehmen,
  liedinfoWert,
  type LiedinfoFormular,
} from '../utils/liedinfoFormular';
// Die Feld-Stile direkt aus dem Modul der Stammdaten-Felder: dieselbe Sorte Eingabe, dasselbe Aussehen.
import feld from './SongFields.module.scss';
import styles from './LiedinfoKarte.module.scss';

interface Props {
  formular: LiedinfoFormular;
  vergleich: LiedinfoVergleich[];
  darf: boolean;
  aendern: (f: LiedinfoFormular) => void;
  /**
   * Dieses Feld in den Fokus nehmen (Menü „Einfügen“ → Kopfangabe, L6). `n` zählt hoch, damit derselbe Wunsch ein
   * zweites Mal wirkt.
   */
  fokus?: { feld: string; n: number } | null;
}

/**
 * **Liedinfo im Editor** (Lied-Editor L4, Entwurf C): Titel, Autor, Tonart, Tempo, Takt, CCLI, Copyright – aus und
 * nach ChurchTools (gespeichert mit „Speichern“ oben). Stand in der Datei etwas anderes, steht es als Hinweis am Feld
 * mit „übernehmen“; war das Feld in ChurchTools leer, ist es aus der Datei vorbelegt (Alwin, 23.10.2026).
 */
export function LiedinfoKarte({ formular, vergleich, darf, aendern, fokus }: Props) {
  const id = useId();
  const karteRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!fokus) return;
    karteRef.current?.querySelector<HTMLInputElement>(`[data-feld="${fokus.feld}"]`)?.focus();
  }, [fokus]);
  const v = (f: LiedinfoFeld) => vergleich.find((x) => x.feld === f);

  /**
   * Hinweis unter einem Feld – nur, wo die Datei etwas sagt, das (noch) nicht im Feld steht. `feldname` für die
   * Dreierzeile: Dort stehen die Hinweise unter der ganzen Zeile, ohne Namen wäre offen, zu welchem Feld sie
   * gehören (Test-Instanz, 24.10.2026: zweimal „Aus dem Notenblatt übernommen“ untereinander).
   */
  function hinweis(f: LiedinfoFeld, feldname?: string): ReactNode {
    const x = v(f);
    if (!x || x.art === 'leer' || x.art === 'gleich') return null;
    const steht = liedinfoWert(formular, f).trim();
    if (x.art === 'vorbelegen' && steht === x.datei)
      return (
        <span className={styles.hinweis}>
          {feldname
            ? `${feldname}: aus dem Notenblatt übernommen`
            : 'Aus dem Notenblatt übernommen'}
        </span>
      );
    if (steht === x.datei) return null;
    return (
      <span className={styles.hinweis}>
        {feldname ? `${feldname} im Notenblatt:` : 'Im Notenblatt steht:'}{' '}
        <q className={styles.datei}>{x.datei}</q>
        {darf && (
          <button
            type="button"
            className={styles.uebernehmen}
            onClick={() => aendern(liedinfoUebernehmen(formular, x))}
          >
            übernehmen
          </button>
        )}
      </span>
    );
  }

  const lied = (k: 'name' | 'author' | 'ccli' | 'copyright', w: string) =>
    aendern({ ...formular, lied: { ...formular.lied, [k]: w } });
  const arr = (k: 'key' | 'tempo' | 'beat', w: string) =>
    aendern({ ...formular, arrangement: { ...formular.arrangement, [k]: w } });

  return (
    <section ref={karteRef} aria-label="Liedinfo" className={styles.karte}>
      {!darf && (
        <p className={styles.nurLesen}>
          Nur ansehen – ändern kann, wer in ChurchTools Lieder bearbeiten darf.
        </p>
      )}
      <div className={feld.field}>
        <label className={feld.label} htmlFor={`${id}-1`}>
          Titel
        </label>
        <input
          id={`${id}-1`}
          className={feld.input}
          value={formular.lied.name}
          maxLength={LIED_GRENZEN.name.max}
          readOnly={!darf}
          data-feld="name"
          onChange={(e) => lied('name', e.target.value)}
        />
        {hinweis('name')}
      </div>
      <div className={feld.field}>
        <label className={feld.label} htmlFor={`${id}-2`}>
          Interpret / Autor
        </label>
        <input
          id={`${id}-2`}
          className={feld.input}
          value={formular.lied.author}
          maxLength={LIED_GRENZEN.author}
          readOnly={!darf}
          data-feld="author"
          onChange={(e) => lied('author', e.target.value)}
        />
        {hinweis('author')}
      </div>
      <div className={styles.drei}>
        <div className={feld.field}>
          <label className={feld.label} htmlFor={`${id}-3`}>
            Tonart
          </label>
          <input
            id={`${id}-3`}
            className={feld.input}
            placeholder="z. B. E"
            value={formular.arrangement.key}
            maxLength={ARRANGEMENT_GRENZEN.key}
            readOnly={!darf}
            data-feld="key"
            onChange={(e) => arr('key', e.target.value)}
          />
        </div>
        <div className={feld.field}>
          <label className={feld.label} htmlFor={`${id}-4`}>
            Tempo
          </label>
          <input
            id={`${id}-4`}
            className={feld.input}
            inputMode="numeric"
            placeholder="BPM"
            value={formular.arrangement.tempo}
            readOnly={!darf}
            data-feld="tempo"
            onChange={(e) => arr('tempo', e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <div className={feld.field}>
          <label className={feld.label} htmlFor={`${id}-5`}>
            Takt
          </label>
          <input
            id={`${id}-5`}
            className={feld.input}
            placeholder="z. B. 4/4"
            value={formular.arrangement.beat}
            maxLength={ARRANGEMENT_GRENZEN.beat}
            readOnly={!darf}
            data-feld="beat"
            onChange={(e) => arr('beat', e.target.value)}
          />
        </div>
      </div>
      {hinweis('tempo', 'Tempo')}
      {hinweis('beat', 'Takt')}
      <div className={feld.field}>
        <label className={feld.label} htmlFor={`${id}-6`}>
          CCLI-Nummer
        </label>
        <input
          id={`${id}-6`}
          className={feld.input}
          inputMode="numeric"
          placeholder="gemeinfrei"
          value={formular.lied.ccli}
          maxLength={LIED_GRENZEN.ccli}
          readOnly={!darf}
          data-feld="ccli"
          onChange={(e) => lied('ccli', e.target.value)}
        />
        {hinweis('ccli')}
      </div>
      <div className={feld.field}>
        <label className={feld.label} htmlFor={`${id}-7`}>
          Copyright
        </label>
        <input
          id={`${id}-7`}
          className={feld.input}
          value={formular.lied.copyright}
          maxLength={LIED_GRENZEN.copyright}
          readOnly={!darf}
          data-feld="copyright"
          onChange={(e) => lied('copyright', e.target.value)}
        />
        {hinweis('copyright')}
      </div>
      <p className={styles.fuss}>
        Gilt für das Lied und dieses Arrangement in ChurchTools – für alle Fassungen. Gespeichert
        wird mit „Speichern“ oben.
      </p>
    </section>
  );
}
