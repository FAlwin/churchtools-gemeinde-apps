import { useState, type ReactNode } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import { Schalter } from '@ui/bedienung/Schalter';
import { SCHRIFT } from '@ui/anmeldeformular/daten';
import type { Gestaltung, GestaltungWerte, Schrift } from '@shared/anmeldung/formular';
import {
  FARBEN,
  VORLAGEN_GESTALTUNG,
  geaendertSeitVorlage,
  titelbildGross,
  vorlageVon,
  vorlageWechseln,
} from '@shared/anmeldung/gestaltung';
import { LogoAuswahl } from './LogoAuswahl';
import k from './Baukasten.module.scss';

/**
 * **Die Leiste „Design“** (A5, Entwurf v3 vom 13.10.2026 – Alwin: „gefällt mir sehr gut, gerne so umsetzen“).
 * Eine Vorlage ist nur der Startpunkt; darunter ist jede Einstellung einzeln änderbar. Oben steht, was seit
 * dem Startpunkt geändert wurde.
 */

const NAMEN: Record<keyof GestaltungWerte, string> = {
  aufbau: 'Aufbau',
  kopfHoehe: 'Kopfhöhe',
  kopfAusrichtung: 'Ausrichtung',
  hintergrund: 'Hintergrund',
  muster: 'Muster',
  musterfarbe: 'Musterfarbe',
  farbe: 'Hauptfarbe',
  seitenfarbe: 'Seitenfarbe',
  kartenfarbe: 'Formularfarbe',
  schriftfarbe: 'Schriftfarbe',
  kopfSchrift: 'Überschriften',
  textSchrift: 'Text',
  gross: 'Schriftgröße',
  ecken: 'Ecken',
  schatten: 'Schatten',
  rahmen: 'Rahmen',
  bunt: 'bunte Abschnitte',
  feldstil: 'Eingabefelder',
  knoepfe: 'Knopf',
  knopfVoll: 'Knopfbreite',
};

const SCHRIFTEN: [Schrift, string][] = [
  ['standard', 'Standard'],
  ['rund', 'Rund'],
  ['serif', 'Serifen'],
  ['klassisch', 'Klassisch'],
  ['lesbar', 'Lesbar'],
];

const MUSTER: [Gestaltung['muster'], string][] = [
  ['punkte', 'Punkte'],
  ['konfetti', 'Konfetti'],
  ['sterne', 'Sterne'],
  ['wellen', 'Wellen'],
  ['raster', 'Raster'],
];

const AUFBAU: [Gestaltung['aufbau'], string, string][] = [
  ['kopfband', 'Kopfband', 'Farbe oder Bild oben'],
  ['seite', 'Bild über alles', 'Formular schwebt darauf'],
  ['geteilt', 'Zweigeteilt', 'Kopf links'],
  ['karte', 'Karte', 'Einladung in der Mitte'],
];

/** Kleines Vorschaubild eines Aufbaus – nur Andeutungen, das Formular links zeigt die Wahl sofort. */
function Mini({
  w,
}: {
  w: Pick<GestaltungWerte, 'aufbau' | 'farbe' | 'seitenfarbe' | 'kartenfarbe'>;
}) {
  const karte = { background: w.kartenfarbe, borderRadius: 3 };
  return (
    <span className={k.mini} style={{ background: w.seitenfarbe }}>
      {w.aufbau === 'kopfband' && (
        <>
          <i style={{ left: 0, right: 0, top: 0, height: 20, background: w.farbe }} />
          <i style={{ left: '18%', right: '18%', top: 14, bottom: 5, ...karte }} />
        </>
      )}
      {w.aufbau === 'seite' && (
        <>
          <i
            style={{
              inset: 0,
              background: 'linear-gradient(#4c6fa3,#f3c58a 58%,#3f5a64 59%,#1e3328)',
            }}
          />
          <i style={{ left: '22%', right: '22%', top: 10, bottom: 5, ...karte, opacity: 0.9 }} />
        </>
      )}
      {w.aufbau === 'geteilt' && (
        <>
          <i style={{ left: 0, top: 0, bottom: 0, width: '38%', background: w.farbe }} />
          <i style={{ left: '46%', right: '8%', top: 8, bottom: 5, ...karte }} />
        </>
      )}
      {w.aufbau === 'karte' && (
        <i
          style={{
            left: '26%',
            right: '26%',
            top: 6,
            bottom: 6,
            ...karte,
            outline: `1px solid ${w.farbe}`,
            outlineOffset: -3,
          }}
        />
      )}
    </span>
  );
}

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <>
      <h3 className={k.gruppe}>{titel}</h3>
      {children}
    </>
  );
}

function SchalterZeile({ name, an, onKlick }: { name: string; an: boolean; onKlick: () => void }) {
  return (
    <button type="button" className={k.schalterZeile} aria-pressed={an} onClick={onKlick}>
      {name}
      <Schalter an={an} />
    </button>
  );
}

export function DesignTafel({
  gestaltung: g,
  onGestaltung,
  ctLogo,
  veranstaltungId,
}: {
  gestaltung: Gestaltung;
  onGestaltung: (g: Gestaltung) => void;
  veranstaltungId: number;
  /** Das Gemeindelogo aus ChurchTools (`undefined` = wird noch geladen, `null` = keins hinterlegt). */
  ctLogo: string | null | undefined;
}) {
  const setze = <K extends keyof Gestaltung>(feld: K, wert: Gestaltung[K]) =>
    onGestaltung({ ...g, [feld]: wert });
  const geaendert = geaendertSeitVorlage(g);
  // „Eigenes“ angetippt, aber noch keins gewählt: Auswahl zeigen, das Formular bleibt, wie es ist.
  const [eigenOffen, setEigenOffen] = useState(false);
  const eigenesZeigen = g.logo === 'eigen' || eigenOffen;
  const farbe = (feld: 'farbe' | 'seitenfarbe' | 'kartenfarbe' | 'schriftfarbe', name: string) => (
    <label className={k.farbPaar}>
      <input
        type="color"
        value={g[feld]}
        aria-label={`Farbe: ${name}`}
        onChange={(e) => setze(feld, e.target.value)}
      />
      <span>{name}</span>
    </label>
  );

  return (
    <div className={k.tafel}>
      <Gruppe titel="Startpunkt">
        <div className={k.vorlagen}>
          {VORLAGEN_GESTALTUNG.map((x) => (
            <button
              key={x.id}
              type="button"
              className={k.vorlage}
              aria-pressed={x.id === g.vorlage}
              onClick={() => onGestaltung(vorlageWechseln(g, x.id))}
            >
              <Mini w={x.werte} />
              <b>{x.name}</b>
              <small>{x.hinweis}</small>
            </button>
          ))}
        </div>
        <p className={k.startpunkt}>
          Start: {vorlageVon(g.vorlage).name} · seitdem geändert:{' '}
          {geaendert.length ? geaendert.map((x) => NAMEN[x]).join(', ') : 'nichts'}
        </p>
      </Gruppe>

      <Gruppe titel="Aufbau">
        <div className={k.vorlagen}>
          {AUFBAU.map(([id, name, hinweis]) => (
            <button
              key={id}
              type="button"
              className={k.vorlage}
              aria-pressed={g.aufbau === id}
              onClick={() => setze('aufbau', id)}
            >
              <Mini w={{ ...g, aufbau: id }} />
              <b>{name}</b>
              <small>{hinweis}</small>
            </button>
          ))}
        </div>
      </Gruppe>

      <Gruppe titel="Kopf">
        <Segment
          ariaLabel="Kopfhöhe"
          value={g.kopfHoehe}
          onChange={(v) => setze('kopfHoehe', v)}
          options={[
            { value: 'klein', label: 'Klein' },
            { value: 'mittel', label: 'Mittel' },
            { value: 'gross', label: 'Groß' },
          ]}
        />
        <Segment
          ariaLabel="Ausrichtung im Kopf"
          value={g.kopfAusrichtung}
          onChange={(v) => setze('kopfAusrichtung', v)}
          options={[
            { value: 'links', label: 'Links' },
            { value: 'mitte', label: 'Mitte' },
          ]}
        />
      </Gruppe>

      <Gruppe titel="Logo">
        <div className={k.logoWahl}>
          <button
            type="button"
            className={k.vorlage}
            aria-pressed={g.logo === 'ct'}
            disabled={ctLogo === null}
            onClick={() => {
              setEigenOffen(false);
              onGestaltung({ ...g, logo: 'ct', logoUrl: ctLogo ?? g.logoUrl });
            }}
          >
            {ctLogo ? (
              <img src={titelbildGross(ctLogo, 120)} alt="" />
            ) : (
              <span className={k.leerLogo}>?</span>
            )}
            <b>Gemeindelogo</b>
            <small>{ctLogo === null ? 'in ChurchTools keins' : 'aus ChurchTools'}</small>
          </button>
          <button
            type="button"
            className={k.vorlage}
            aria-pressed={eigenesZeigen}
            onClick={() => setEigenOffen(true)}
          >
            {g.logo === 'eigen' && g.logoUrl ? (
              <img src={titelbildGross(g.logoUrl, 120)} alt="" />
            ) : (
              <span className={k.leerLogo}>+</span>
            )}
            <b>Eigenes</b>
            <small>hochladen</small>
          </button>
          <button
            type="button"
            className={k.vorlage}
            aria-pressed={g.logo === 'keins'}
            onClick={() => {
              setEigenOffen(false);
              setze('logo', 'keins');
            }}
          >
            <span className={k.leerLogo}>–</span>
            <b>Kein Logo</b>
            <small>&nbsp;</small>
          </button>
        </div>
        {eigenesZeigen && (
          <LogoAuswahl
            veranstaltungId={veranstaltungId}
            gewaehlt={g.logo === 'eigen' ? g.logoUrl : null}
            onWaehlen={(url) => onGestaltung({ ...g, logo: 'eigen', logoUrl: url })}
            onEntfernt={(url) => {
              if (g.logoUrl === url) onGestaltung({ ...g, logo: 'keins', logoUrl: null });
            }}
          />
        )}
        {g.logo !== 'keins' && (
          <Segment
            ariaLabel="Platz des Logos"
            value={g.logoOrt}
            onChange={(v) => setze('logoOrt', v)}
            options={[
              { value: 'oben', label: 'Oben in der Mitte' },
              { value: 'links', label: 'Links neben dem Titel' },
            ]}
          />
        )}
      </Gruppe>

      <Gruppe titel="Hintergrund der Seite">
        <Segment
          ariaLabel="Hintergrund der Seite"
          value={g.hintergrund}
          onChange={(v) => setze('hintergrund', v)}
          options={[
            { value: 'farbe', label: 'Farbe' },
            { value: 'muster', label: 'Muster' },
            { value: 'bild', label: 'Titelbild' },
          ]}
        />
        {g.hintergrund === 'muster' && (
          <>
            <div className={k.musterWahl}>
              {MUSTER.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className={k.vorlage}
                  aria-pressed={g.muster === id}
                  onClick={() => setze('muster', id)}
                >
                  <span className={`${k.mini} ${k[`muster-${id}`]}`} />
                  <b>{name}</b>
                </button>
              ))}
            </div>
            <label className={k.farbZeile}>
              Musterfarbe
              <input
                type="color"
                value={g.musterfarbe}
                aria-label="Musterfarbe"
                onChange={(e) => setze('musterfarbe', e.target.value)}
              />
            </label>
          </>
        )}
        {g.hintergrund === 'bild' && (
          <p className={k.klein}>
            Das Titelbild liegt hinter dem ganzen Formular (oben im Bild änderbar).
          </p>
        )}
      </Gruppe>

      <Gruppe titel="Farben">
        <div className={k.farben} role="group" aria-label="Hauptfarbe">
          {FARBEN.map(([hex, name]) => (
            <button
              key={hex}
              type="button"
              className={k.farbe}
              aria-label={name}
              aria-pressed={g.farbe.toLowerCase() === hex}
              style={{ background: hex }}
              onClick={() => setze('farbe', hex)}
            />
          ))}
        </div>
        <div className={k.farbPaare}>
          {farbe('farbe', 'Haupt')}
          {farbe('seitenfarbe', 'Seite')}
          {farbe('kartenfarbe', 'Formular')}
          {farbe('schriftfarbe', 'Schrift')}
        </div>
      </Gruppe>

      <Gruppe titel="Schrift">
        {(
          [
            ['kopfSchrift', 'Überschriften'],
            ['textSchrift', 'Text'],
          ] as const
        ).map(([feld, name]) => (
          <div key={feld} className={k.schriftZeile}>
            <span>{name}</span>
            <div className={k.schriften} role="group" aria-label={`Schrift: ${name}`}>
              {SCHRIFTEN.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={k.schrift}
                  aria-pressed={g[feld] === id}
                  style={{ fontFamily: SCHRIFT[id] }}
                  onClick={() => setze(feld, id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <SchalterZeile
          name="Größere Schrift"
          an={g.gross}
          onKlick={() => setze('gross', !g.gross)}
        />
        <p className={k.klein}>
          Nur Schriften, die jedes Gerät schon hat – nichts wird von Google geladen.
        </p>
      </Gruppe>

      <Gruppe titel="Abschnitte">
        <Segment
          ariaLabel="Ecken"
          value={g.ecken}
          onChange={(v) => setze('ecken', v)}
          options={[
            { value: 'eckig', label: 'Eckig' },
            { value: 'rund', label: 'Rund' },
            { value: 'sehrrund', label: 'Sehr rund' },
          ]}
        />
        <SchalterZeile
          name="Schatten"
          an={g.schatten}
          onKlick={() => setze('schatten', !g.schatten)}
        />
        <SchalterZeile name="Rahmen" an={g.rahmen} onKlick={() => setze('rahmen', !g.rahmen)} />
        <SchalterZeile
          name="Abschnitte bunt (je eine Farbe)"
          an={g.bunt}
          onKlick={() => setze('bunt', !g.bunt)}
        />
      </Gruppe>

      <Gruppe titel="Eingabefelder">
        <Segment
          ariaLabel="Eingabefelder"
          value={g.feldstil}
          onChange={(v) => setze('feldstil', v)}
          options={[
            { value: 'kasten', label: 'Kasten' },
            { value: 'linie', label: 'Linie' },
            { value: 'gefuellt', label: 'Gefüllt' },
          ]}
        />
      </Gruppe>

      <Gruppe titel="Knopf „Anmelden“">
        <Segment
          ariaLabel="Knopf"
          value={g.knoepfe}
          onChange={(v) => setze('knoepfe', v)}
          options={[
            { value: 'eckig', label: 'Eckig' },
            { value: 'leicht', label: 'Leicht rund' },
            { value: 'rund', label: 'Rund' },
          ]}
        />
        <SchalterZeile
          name="Volle Breite"
          an={g.knopfVoll}
          onKlick={() => setze('knopfVoll', !g.knopfVoll)}
        />
      </Gruppe>

      <Gruppe titel="Breite des Formulars">
        <Segment
          ariaLabel="Breite des Formulars"
          value={g.breite}
          onChange={(v) => setze('breite', v)}
          options={[
            { value: 'schmal', label: 'Schmal' },
            { value: 'normal', label: 'Normal' },
            { value: 'breit', label: 'Breit' },
          ]}
        />
      </Gruppe>
    </div>
  );
}
