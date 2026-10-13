import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import {
  BAUSTEINE,
  type Feld,
  type Feldtyp,
  type Formular,
  type Gestaltung,
} from '@shared/anmeldung/formular';
import {
  EMPFOHLEN,
  bausteinFeld,
  neueFeldKennung,
  type Bereich,
} from '@shared/anmeldung/baukasten';
import { FARBEN, VORLAGEN_GESTALTUNG, vorlageWechseln } from '@shared/anmeldung/gestaltung';
import { BausteinSymbol, type BausteinIcon } from './bausteinIcons';
import k from './Baukasten.module.scss';

/**
 * **Die Leiste rechts im Baukasten** (A5): „Bausteine“ wie bei Campflow (Kacheln zum Ziehen oder Antippen, mit
 * Suche) und „Design“ wie bei Jotform (Vorlagen-Galerie, Farben, Feldstil, Knöpfe, Titelbild). Sie ändert nichts
 * selbst – sie meldet dem Baukasten, was gezogen, angetippt oder gewählt wurde.
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

function alleFelder(f: Formular): Feld[] {
  return [...f.anmeldung, ...f.person];
}

function Kachel({
  name,
  symbol,
  benutzt,
  onNeu,
  onZiehen,
}: {
  name: string;
  symbol: BausteinIcon;
  benutzt: boolean;
  onNeu: () => void;
  onZiehen: () => void;
}) {
  // Ein <div> statt <button>: In Firefox lassen sich Knöpfe nicht ziehen. Bedienbar bleibt es per Tastatur.
  return (
    <div
      role="button"
      tabIndex={benutzt ? -1 : 0}
      className={k.kachel}
      draggable={!benutzt}
      aria-disabled={benutzt}
      title={benutzt ? 'Ist schon im Formular' : 'Ins Formular ziehen oder antippen'}
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
  onNeu,
  onZiehen,
  ausgeblendet,
  onWiederZeigen,
  platz,
}: {
  formular: Formular;
  wer: 'familie' | 'einzeln' | 'kinder';
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

/** Die Schriften zur Wahl – nur Systemschriften (Datenschutz). `standard` = die der Vorlage. */
const SCHRIFTEN: [Gestaltung['schrift'], string, string][] = [
  ['standard', 'Wie Vorlage', ''],
  ['rund', 'Rund', 'für Kinder'],
  ['serif', 'Mit Serifen', 'festlich'],
  ['klassisch', 'Klassisch', 'Einladung'],
  ['lesbar', 'Gut lesbar', 'Senioren'],
];

/** Was der Farbwähler zeigt, solange die Vorlage die Farbe bestimmt. */
const STANDARD_FARBE = { seitenfarbe: '#f3f6f6', kartenfarbe: '#ffffff', schriftfarbe: '#17242a' };

export function DesignTafel({
  gestaltung: g,
  onGestaltung,
}: {
  gestaltung: Gestaltung;
  onGestaltung: (g: Gestaltung) => void;
}) {
  return (
    <div className={k.tafel}>
      <h3 className={k.gruppe}>Vorlagen</h3>
      <div className={k.vorlagen}>
        {VORLAGEN_GESTALTUNG.map((x) => (
          <button
            key={x.id}
            type="button"
            className={k.vorlage}
            aria-pressed={x.id === g.vorlage}
            onClick={() => onGestaltung(vorlageWechseln(g, x.id))}
          >
            <span
              className={`${k.mini} ${k[`mini-${x.id}`]}`}
              style={{ '--m': x.farbe } as React.CSSProperties}
            />
            <b>{x.name}</b>
            <small>{x.hinweis}</small>
          </button>
        ))}
      </div>

      <h3 className={k.gruppe}>Farbe</h3>
      <div className={k.farben} role="group" aria-label="Farbe">
        {FARBEN.map(([hex, name]) => (
          <button
            key={hex}
            type="button"
            className={k.farbe}
            aria-label={name}
            aria-pressed={g.farbe.toLowerCase() === hex}
            style={{ background: hex }}
            onClick={() => onGestaltung({ ...g, farbe: hex })}
          />
        ))}
        <label className={k.eigeneFarbe}>
          <input
            type="color"
            value={g.farbe}
            aria-label="Eigene Farbe"
            onChange={(e) => onGestaltung({ ...g, farbe: e.target.value })}
          />
          eigene
        </label>
      </div>

      <h3 className={k.gruppe}>Eigene Farben</h3>
      <div className={k.farbPaare}>
        {(
          [
            ['seitenfarbe', 'Seite'],
            ['kartenfarbe', 'Formular'],
            ['schriftfarbe', 'Schrift'],
          ] as const
        ).map(([feld, name]) => (
          <div key={feld} className={k.farbPaar}>
            <label>
              <input
                type="color"
                value={g[feld] ?? STANDARD_FARBE[feld]}
                aria-label={`Farbe: ${name}`}
                onChange={(e) => onGestaltung({ ...g, [feld]: e.target.value })}
              />
              <span>{name}</span>
            </label>
            {g[feld] ? (
              <button
                type="button"
                className={k.textKnopf}
                onClick={() => onGestaltung({ ...g, [feld]: null })}
              >
                wie Vorlage
              </button>
            ) : (
              <small>wie Vorlage</small>
            )}
          </div>
        ))}
      </div>

      <h3 className={k.gruppe}>Schrift</h3>
      <div className={k.schriften}>
        {SCHRIFTEN.map(([id, name, hinweis]) => (
          <button
            key={id}
            type="button"
            className={`${k.schrift} ${k[`schrift-${id}`] ?? ''}`}
            aria-pressed={g.schrift === id}
            onClick={() => onGestaltung({ ...g, schrift: id })}
          >
            <b>Aa</b>
            <small>
              {name}
              {hinweis && ` · ${hinweis}`}
            </small>
          </button>
        ))}
      </div>
      <p className={k.klein}>
        Nur Schriften, die jedes Gerät schon hat – nichts wird von Google geladen.
      </p>

      <h3 className={k.gruppe}>Breite des Formulars</h3>
      <Segment
        ariaLabel="Breite des Formulars"
        value={g.breite}
        onChange={(breite) => onGestaltung({ ...g, breite })}
        options={[
          { value: 'schmal', label: 'Schmal' },
          { value: 'normal', label: 'Normal' },
          { value: 'breit', label: 'Breit' },
        ]}
      />

      <h3 className={k.gruppe}>Eingabefelder</h3>
      <Segment
        ariaLabel="Eingabefelder"
        value={g.feldstil}
        onChange={(feldstil) => onGestaltung({ ...g, feldstil })}
        options={[
          { value: 'kasten', label: 'Kasten' },
          { value: 'linie', label: 'Linie' },
          { value: 'gefuellt', label: 'Gefüllt' },
        ]}
      />

      <h3 className={k.gruppe}>Knöpfe</h3>
      <Segment
        ariaLabel="Knöpfe"
        value={g.knoepfe}
        onChange={(knoepfe) => onGestaltung({ ...g, knoepfe })}
        options={[
          { value: 'eckig', label: 'Eckig' },
          { value: 'rund', label: 'Rund' },
        ]}
      />
    </div>
  );
}
