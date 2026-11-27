import type { CSSProperties, ReactNode } from 'react';
import type { Antwort, Feld } from '@shared/anmeldung/formular';
import { zahlText } from '@shared/anmeldung/feldwert';
import {
  ZELLE_MAX,
  listeAus,
  listeFehlerTexte,
  listenSumme,
  summenSpalte,
  type ListenSpalte,
} from '@shared/anmeldung/zeilenListe';
import { Icon } from '../icons/icons';
import s from './AnmeldeFormular.module.scss';

/**
 * **Liste mit Zeilen im Formular** (F6a, Entwurf `f6-liste-v1`): am Computer eine Zeilen-Tabelle (Kopfzeile, je Zeile die
 * Zellen und ein Kreuz), am Handy eine Karte je Eintrag mit beschrifteten Feldern – dieselbe Darstellung, die Breite des
 * Formulars entscheidet (Container-Abfrage `pv`). Unten „Zeile hinzufügen“, „n von max“ und die Summe über die
 * vollständigen Zeilen. Welche Zeile angefangen ist und was fehlt, sagt `pruefeAntworten` (`listePruefen`) – die Sätze
 * darunter kommen aus `listeFehlerTexte`. Ohne Eintrag steht eine leere Zeile da; sie zählt erst, wenn jemand tippt.
 */
export function ListeEingabe({
  feld: f,
  wert,
  onWert,
  pfad,
  fehler,
  gesperrt,
  zusatz,
}: {
  feld: Feld;
  wert: Antwort;
  onWert: (w: Antwort) => void;
  pfad: string;
  fehler: string[];
  gesperrt: boolean;
  zusatz: ReactNode;
}) {
  const l = f.liste;
  if (!l) return null;
  const a = listeAus(wert);
  const zeilen = a.zeilen.length ? a.zeilen : [{}];
  const voll = a.zeilen.length >= l.max;
  const summe = summenSpalte(l);
  const id = `af-${pfad}`;
  // Fehler dieses Felds: `pfad` selbst (Pflicht) und `pfad.<Zeile>.<Spalte>`, `pfad.lang`, `pfad.max`.
  const teile = fehler.flatMap((x) =>
    x === pfad ? [''] : x.startsWith(`${pfad}.`) ? [x.slice(pfad.length + 1)] : [],
  );
  const texte = listeFehlerTexte(l, teile);
  const setzeZelle = (i: number, spalte: string, v: string) =>
    onWert({ zeilen: zeilen.map((z, j) => (j === i ? { ...z, [spalte]: v } : z)) });
  const weg = (i: number) => onWert({ zeilen: zeilen.filter((_, j) => j !== i) });
  const dazu = () => onWert({ zeilen: [...zeilen, {}] });
  const breiten = l.spalten
    .map((sp) =>
      sp.art === 'text'
        ? 'minmax(0, 2.2fr)'
        : sp.art === 'zahl'
          ? 'minmax(4.5em, 0.8fr)'
          : 'minmax(7em, 1.1fr)',
    )
    .join(' ');

  const zelle = (sp: ListenSpalte, i: number, z: Record<string, string>) => {
    const zid = `${id}-${i}-${sp.id}`;
    const bad = teile.includes(`${i}.${sp.id}`);
    const w = z[sp.id] ?? '';
    return (
      <div key={sp.id} className={`${s.pf} ${s.listeZelle} ${bad ? s.bad : ''}`} data-art={sp.art}>
        <label htmlFor={zid}>
          {sp.name}
          {sp.art === 'zahl' && sp.einheit?.trim() && (
            <span className={s.opt}> in {sp.einheit.trim()}</span>
          )}
        </label>
        {sp.art === 'auswahl' ? (
          <select
            id={zid}
            value={w}
            disabled={gesperrt}
            aria-invalid={bad || undefined}
            onChange={(e) => setzeZelle(i, sp.id, e.target.value)}
          >
            <option value="">– wählen –</option>
            {(sp.antworten ?? []).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        ) : (
          <input
            id={zid}
            value={w}
            maxLength={ZELLE_MAX}
            inputMode={sp.art === 'zahl' ? 'decimal' : undefined}
            disabled={gesperrt}
            aria-invalid={bad || undefined}
            onChange={(e) => setzeZelle(i, sp.id, e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <div className={s.baustein}>
      <div className={s.bausteinKopf}>
        <b>
          {f.frage}
          {f.zustand === 'pflicht' ? (
            <span className={s.req} aria-hidden="true">
              *
            </span>
          ) : (
            <span className={s.opt}> (freiwillig)</span>
          )}
          {zusatz}
        </b>
        {f.hilfe && <span className={s.help}>{f.hilfe}</span>}
      </div>
      <div className={s.liste} style={{ '--liste-spalten': breiten } as CSSProperties}>
        <div className={s.listeKopf} aria-hidden="true">
          <span />
          {l.spalten.map((sp) => (
            <span key={sp.id}>
              {sp.name}
              {sp.art === 'zahl' && sp.einheit?.trim() && (
                <span className={s.opt}> ({sp.einheit.trim()})</span>
              )}
            </span>
          ))}
          <span />
        </div>
        {zeilen.map((z, i) => (
          <div key={i} className={s.listeZeile} role="group" aria-label={`Eintrag ${i + 1}`}>
            <span className={s.listeNr}>
              <span className={s.nurBreit}>{i + 1}.</span>
              <span className={s.nurSchmal}>Eintrag {i + 1}</span>
            </span>
            {l.spalten.map((sp) => zelle(sp, i, z))}
            {!gesperrt && (
              <button
                type="button"
                className={s.listeWeg}
                aria-label={`Eintrag ${i + 1} entfernen`}
                onClick={() => weg(i)}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        ))}
        <div className={s.listeFuss}>
          {!gesperrt && (
            <button type="button" className={s.addbtn} disabled={voll} onClick={dazu}>
              {voll ? (
                `höchstens ${l.max} Zeilen`
              ) : (
                <>
                  <Icon name="plus" size={16} />
                  <span className={s.nurBreit}>Zeile hinzufügen</span>
                  <span className={s.nurSchmal}>Eintrag hinzufügen</span>
                </>
              )}
            </button>
          )}
          {!voll && (
            <span className={s.help}>
              {a.zeilen.length} von {l.max}
            </span>
          )}
          {summe && (
            <span className={s.listeSumme}>
              Summe {summe.name}: {zahlText(listenSumme(l, a) ?? 0)}
              {summe.einheit?.trim() ? ` ${summe.einheit.trim()}` : ''}
            </span>
          )}
        </div>
      </div>
      {texte.length > 0 && (
        <span className={s.err} role="alert">
          {texte.map((t) => (
            <span key={t} className={s.listeFehler}>
              {t}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
