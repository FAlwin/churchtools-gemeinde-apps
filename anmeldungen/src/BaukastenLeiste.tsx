import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { BAUSTEINE, type Feld, type Feldtyp, type Formular } from '@shared/anmeldung/formular';
import {
  EMPFOHLEN,
  bausteinFeld,
  neueFeldKennung,
  type Bereich,
} from '@shared/anmeldung/baukasten';
import { BausteinSymbol, type BausteinIcon } from './bausteinIcons';
import { WER_TEXT, geburtsdatumNoetigText } from './anzeige';
import k from './Baukasten.module.scss';

/**
 * **Die Leiste rechts im Baukasten** (A5): „Bausteine“ wie bei Campflow (Kacheln zum Ziehen oder Antippen, mit
 * Suche); „Design“ steht in `DesignTafel.tsx`. Sie ändert nichts selbst – sie meldet dem Baukasten, was gezogen
 * oder angetippt wurde.
 */

/** Ein Baustein, der ins Formular kommt: das fertige Feld und wohin es beim Antippen gehört. */
export interface NeuerBaustein {
  name: string;
  feld: Feld;
  bereich: Bereich;
}

const SYMBOL_EMPFOHLEN: Record<string, BausteinIcon> = {
  birth: 'geburt',
  tel: 'telefon',
  addr: 'anschrift',
  notfall: 'notfall',
  allergy: 'essen',
  health: 'gesund',
  foto: 'foto',
  note: 'notiz',
};

const SYMBOL_TYP: Partial<Record<Feldtyp, BausteinIcon>> = {
  text: 'text',
  textarea: 'textarea',
  janein: 'janein',
  check: 'check',
  radio: 'radio',
  select: 'select',
  multi: 'multi',
  date: 'date',
  number: 'number',
  ueberschrift: 'ueberschrift',
  info: 'info',
  trenner: 'trenner',
};

type Wer = 'familie' | 'einzeln' | 'kinder';

/**
 * **„Wer meldet sich an?“ oben in der Leiste** (Alwin, 14.10.2026: „ja, auch im Baukasten“) – dieselbe
 * Einstellung wie im Reiter Veranstaltung; bestimmt den Bereich „Wer nimmt teil?“ und „+ Weitere Person“.
 */
function WerWahl({
  wer,
  geburtsdatum,
  wozuGeburtsdatum: wozu,
  onWer,
}: {
  wer: Wer;
  geburtsdatum: boolean;
  wozuGeburtsdatum: 'alter' | 'geschwister' | null;
  onWer: (wer: Wer, geburtsdatum: boolean) => void;
}) {
  return (
    <div className={k.werWahl}>
      <h3 className={k.gruppe}>Wer meldet sich an?</h3>
      {(Object.keys(WER_TEXT) as Wer[]).map((x) => (
        <button
          key={x}
          type="button"
          className={k.vorlage}
          aria-pressed={x === wer}
          onClick={() => x !== wer && onWer(x, geburtsdatum)}
        >
          <b>{WER_TEXT[x][0]}</b>
          <small>{WER_TEXT[x][1]}</small>
        </button>
      ))}
      <button
        type="button"
        className={k.schalterZeile}
        aria-pressed={geburtsdatum}
        onClick={() => onWer(wer, !geburtsdatum)}
      >
        <Schalter an={geburtsdatum} />
        Geburtsdatum abfragen (Pflicht)
      </button>
      {wozu && !geburtsdatum && (
        <p className={k.fehler} role="alert">
          {geburtsdatumNoetigText(wozu)}
        </p>
      )}
    </div>
  );
}

function alleFelder(f: Formular): Feld[] {
  return [...f.anmeldung, ...f.person];
}

function Kachel({
  name,
  symbol,
  benutzt,
  ziehbar,
  onNeu,
  onZiehen,
}: {
  name: string;
  symbol: BausteinIcon;
  benutzt: boolean;
  ziehbar: boolean;
  onNeu: () => void;
  onZiehen: () => void;
}) {
  // Ein <div> statt <button>: In Firefox lassen sich Knöpfe nicht ziehen. Bedienbar bleibt es per Tastatur.
  return (
    <div
      role="button"
      tabIndex={benutzt ? -1 : 0}
      className={k.kachel}
      draggable={!benutzt && ziehbar}
      aria-disabled={benutzt}
      title={
        benutzt
          ? 'Ist schon im Formular'
          : ziehbar
            ? 'Ins Formular ziehen oder antippen'
            : 'Antippen'
      }
      onClick={() => !benutzt && onNeu()}
      onKeyDown={(e) => {
        if (benutzt || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onNeu();
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', name);
        onZiehen();
      }}
    >
      {benutzt && (
        <span className={k.haken} aria-hidden="true">
          <Icon name="check" size={14} stroke={2.6} />
        </span>
      )}
      <BausteinSymbol name={symbol} />
      {name}
    </div>
  );
}

/** Kopf einer Kachel-Gruppe – zum Ein- und Ausklappen, mit Zahl. */
function GruppenKopf({
  name,
  zahl,
  offen,
  onKlick,
}: {
  name: string;
  zahl: string;
  offen: boolean;
  onKlick: () => void;
}) {
  return (
    <button type="button" className={k.gruppenKopf} aria-expanded={offen} onClick={onKlick}>
      <Icon name="chev-down" size={14} stroke={2.4} />
      {name}
      <span className={k.zahl}>{zahl}</span>
    </button>
  );
}

export function BausteineTafel({
  formular,
  wer,
  geburtsdatum,
  wozuGeburtsdatum,
  onWer,
  ziehbar,
  onNeu,
  onZiehen,
  ausgeblendet,
  onWiederZeigen,
  platz,
}: {
  formular: Formular;
  wer: Wer;
  geburtsdatum: boolean;
  wozuGeburtsdatum: 'alter' | 'geschwister' | null;
  onWer: (wer: Wer, geburtsdatum: boolean) => void;
  /** Mit Maus: Kacheln lassen sich ziehen; am Handy nur antippen (landet unter dem gewählten Feld). */
  ziehbar: boolean;
  onNeu: (b: NeuerBaustein) => void;
  onZiehen: (b: NeuerBaustein) => void;
  /** Eigene Felder, die ausgeblendet sind (Antworten bleiben) – lassen sich zurückholen. */
  ausgeblendet: Feld[];
  onWiederZeigen: (f: Feld) => void;
  /** Wie voll die Beschreibung in ChurchTools ist (0–1). */
  platz: number;
}) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState({ empfohlen: true, frage: true, gestaltung: true });
  const umschalten = (g: keyof typeof offen) => setOffen({ ...offen, [g]: !offen[g] });
  const passt = (name: string) => name.toLowerCase().includes(suche.trim().toLowerCase());
  const da = new Map(alleFelder(formular).map((f) => [f.id, f]));

  const empfohlen = EMPFOHLEN.filter((x) => passt(x.name)).map((x) => {
    const vorhanden = da.get(x.id);
    const b: NeuerBaustein = {
      name: x.name,
      // Ein ausgeschaltetes Feld wird wieder eingeschaltet – mit seiner Spalte und seinen Antworten.
      feld: vorhanden ? { ...vorhanden, zustand: x.feld.zustand } : x.feld,
      bereich: x.bereich,
    };
    return { b, benutzt: !!vorhanden && vorhanden.zustand !== 'aus', id: x.id };
  });
  // Eigene Fragen gelten meist pro Person; bei „einzeln“ gibt es ohnehin nur eine.
  const eigenerBereich: Bereich = wer === 'einzeln' ? 'anmeldung' : 'person';
  const eigene = (gruppe: 'frage' | 'gestaltung') =>
    BAUSTEINE.filter((x) => x.gruppe === gruppe && passt(x.name)).map((x) => ({
      typ: x.typ,
      b: {
        name: x.name,
        feld: bausteinFeld(x.typ, neueFeldKennung(formular)),
        bereich: eigenerBereich,
      },
    }));
  const prozent = Math.min(100, Math.round(platz * 100));

  return (
    <div className={k.tafel}>
      <input
        className={k.suche}
        type="search"
        value={suche}
        placeholder="Bausteine durchsuchen"
        aria-label="Bausteine durchsuchen"
        onChange={(e) => setSuche(e.target.value)}
      />
      {!suche.trim() && (
        <WerWahl
          wer={wer}
          geburtsdatum={geburtsdatum}
          wozuGeburtsdatum={wozuGeburtsdatum}
          onWer={onWer}
        />
      )}
      {empfohlen.length > 0 && (
        <>
          <GruppenKopf
            name="Empfohlen"
            zahl={`${empfohlen.filter((x) => x.benutzt).length} von ${empfohlen.length} im Formular`}
            offen={offen.empfohlen}
            onKlick={() => umschalten('empfohlen')}
          />
          <div className={k.kacheln} hidden={!offen.empfohlen}>
            {empfohlen.map(({ b, benutzt, id }) => (
              <Kachel
                key={id}
                name={b.name}
                symbol={SYMBOL_EMPFOHLEN[id]}
                benutzt={benutzt}
                ziehbar={ziehbar}
                onNeu={() => onNeu(b)}
                onZiehen={() => onZiehen(b)}
              />
            ))}
          </div>
        </>
      )}
      {(['frage', 'gestaltung'] as const).map((gruppe) => {
        const liste = eigene(gruppe);
        if (!liste.length) return null;
        return (
          <div key={gruppe}>
            <GruppenKopf
              name={gruppe === 'frage' ? 'Eigene Fragen' : 'Gestaltung'}
              zahl={String(liste.length)}
              offen={offen[gruppe]}
              onKlick={() => umschalten(gruppe)}
            />
            <div className={k.kacheln} hidden={!offen[gruppe]}>
              {liste.map(({ typ, b }) => (
                <Kachel
                  key={typ}
                  name={b.name}
                  symbol={SYMBOL_TYP[typ] ?? 'text'}
                  benutzt={false}
                  ziehbar={ziehbar}
                  onNeu={() => onNeu(b)}
                  onZiehen={() => onZiehen(b)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {ausgeblendet.length > 0 && (
        <>
          <h3 className={k.gruppe}>Ausgeblendet</h3>
          <ul className={k.ausgeblendet}>
            {ausgeblendet.map((f) => (
              <li key={f.id}>
                <span>{f.frage}</span>
                <button type="button" onClick={() => onWiederZeigen(f)}>
                  Wieder zeigen
                </button>
              </li>
            ))}
          </ul>
          <p className={k.klein}>Hier haben schon Leute geantwortet – die Antworten bleiben.</p>
        </>
      )}
      <div className={k.platz}>
        <div>
          <span>Platz in ChurchTools</span>
          <b>{prozent} % belegt</b>
        </div>
        <div className={`${k.balken} ${prozent >= 85 ? k.knapp : ''}`}>
          <i style={{ width: `${prozent}%` }} />
        </div>
        {prozent >= 85 && (
          <small>Es wird knapp – lange Hilfetexte oder der Begrüßungstext kürzen hilft.</small>
        )}
      </div>
    </div>
  );
}
