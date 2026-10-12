import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { ctBasis } from '@ui/ct/basis';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { ortszeitAus } from '@shared/anmeldung/termin';
import {
  anmeldungVon,
  darfVeranstaltungEinrichten,
  einstellungenVon,
  freigeben,
  kopfVon,
  type AnmeldeEinstellungen,
} from './einrichten';
import { AnmeldungFenster, LoeschfristFenster, TerminFenster, WerFenster } from './Bearbeiten';
import { WER_TEXT, datumText } from './anzeige';
import { fehlerMeldung, type Fehlermeldung } from './zustand';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import f from './Formular.module.scss';

/**
 * **Eine Veranstaltung einrichten** (A3, #486) – der Reiter „Veranstaltung“ aus dem Entwurf: Termin,
 * Anmeldung, wer sich anmeldet, Löschfrist; dazu Freigeben. Bearbeiten darf, wem ChurchTools es erlaubt
 * (Leitung und Organisatoren des Teams) – alle anderen sehen die Karten ohne „Bearbeiten“.
 * Preise (A4), Formular und Gestaltung (A5) und die Anmeldungsliste (A7) folgen.
 */

interface Daten {
  name: string;
  statusId: number;
  einstellungen: OeffentlicheEinstellungen;
  anmeldung: AnmeldeEinstellungen;
  darf: boolean;
}

type Fenster = 'termin' | 'anmeldung' | 'wer' | 'loeschfrist' | 'freigeben' | null;

function Karte({
  titel,
  onBearbeiten,
  children,
}: {
  titel: string;
  onBearbeiten?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={s.karte} aria-label={titel}>
      <div className={s.kopf}>
        <h2>{titel}</h2>
        {onBearbeiten && (
          <button type="button" className={v.bearbeiten} onClick={onBearbeiten}>
            Bearbeiten
          </button>
        )}
      </div>
      <dl className={v.kv}>{children}</dl>
    </section>
  );
}

function Zeile({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{titel}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function VeranstaltungSeite({
  id,
  zeitzone,
  onZurueck,
}: {
  id: number;
  zeitzone: string;
  onZurueck: () => void;
}) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [fenster, setFenster] = useState<Fenster>(null);
  const [freigabeFehler, setFreigabeFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const laden = useCallback(() => {
    setFehler(null);
    Promise.all([
      kopfVon(id),
      einstellungenVon(id),
      anmeldungVon(id),
      darfVeranstaltungEinrichten(id),
    ]).then(
      ([kopf, einstellungen, anmeldung, darf]) =>
        setDaten({ ...kopf, einstellungen, anmeldung, darf }),
      (e: unknown) => setFehler(fehlerMeldung(e)),
    );
  }, [id]);

  useEffect(laden, [laden]);

  const gespeichert = () => {
    setFenster(null);
    laden();
  };

  const zurueck = (
    <button type="button" className={v.zurueck} onClick={onZurueck}>
      <Icon name="chev-left" size={18} />
      Übersicht
    </button>
  );

  if (fehler) {
    return (
      <div className={v.seite}>
        {zurueck}
        <div className={s.karte} role="alert" style={{ padding: 16 }}>
          <p>{fehler.text}</p>
          {fehler.nochmal && (
            <button type="button" className={f.knopf} style={{ marginTop: 12 }} onClick={laden}>
              Erneut versuchen
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!daten) {
    return (
      <div className={v.seite}>
        {zurueck}
        <p className={s.leise}>Wird geladen …</p>
      </div>
    );
  }

  const { einstellungen: e, anmeldung: a, darf } = daten;
  const entwurf = daten.statusId === 2;
  const bearbeiten = (w: Fenster) => (darf ? () => setFenster(w) : undefined);
  const zeit = (iso: string) => {
    const lokal = ortszeitAus(iso, zeitzone);
    return `${datumText(lokal.slice(0, 10))}`;
  };
  const t = e.termin;

  return (
    <div className={v.seite}>
      {zurueck}
      <header className={v.kopf}>
        <div>
          <h1>{daten.name}</h1>
          <span className={entwurf ? s.chip : `${s.chip} ${s.chipGruen}`}>
            {entwurf ? 'Entwurf' : 'Freigegeben'}
          </span>
        </div>
        <div className={v.aktionen}>
          {entwurf && darf && (
            <button type="button" className={v.freigeben} onClick={() => setFenster('freigeben')}>
              Freigeben
            </button>
          )}
          <a className={s.link} href={`${ctBasis()}/groups/${id}`}>
            In ChurchTools
            <Icon name="external" size={14} />
          </a>
        </div>
      </header>
      {!darf && (
        <p className={v.hinweis}>
          Einrichten und freigeben kann die Leitung der Gruppe. Du kannst alles ansehen.
        </p>
      )}

      <div className={s.raster}>
        <div className={s.spalte}>
          <Karte titel="Termin" onBearbeiten={bearbeiten('termin')}>
            {t ? (
              <>
                <Zeile titel="Wann">
                  {datumText(t.beginn.slice(0, 10))}, {t.beginn.slice(11)} Uhr
                  {t.ende &&
                    (t.ende.slice(0, 10) === t.beginn.slice(0, 10)
                      ? ` bis ${t.ende.slice(11)} Uhr`
                      : ` bis ${datumText(t.ende.slice(0, 10))}, ${t.ende.slice(11)} Uhr`)}
                </Zeile>
                <Zeile titel="Ort">{t.ort || '–'}</Zeile>
                <Zeile titel="Kalender">{t.terminId ? `Termin Nr. ${t.terminId}` : '–'}</Zeile>
              </>
            ) : (
              <Zeile titel="Wann">noch kein Termin gewählt</Zeile>
            )}
          </Karte>
          <Karte titel="Anmeldung" onBearbeiten={bearbeiten('anmeldung')}>
            <Zeile titel="Zeitraum">
              {a.ab ? `ab ${zeit(a.ab)}` : 'noch nicht geöffnet'}
              {a.bis ? ` bis ${zeit(a.bis)}` : ''}
            </Zeile>
            <Zeile titel="Plätze">
              {a.maxPlaetze ?? 'unbegrenzt'}
              {a.maxPlaetze !== null &&
                (a.warteliste ? ' · danach Warteliste' : ' · ohne Warteliste')}
            </Zeile>
            <Zeile titel="Freie Plätze zeigen">
              {e.plaetze.zeigen === 'immer'
                ? 'immer'
                : e.plaetze.zeigen === 'nie'
                  ? 'nie'
                  : `wenn weniger als ${e.plaetze.knappUnter} frei sind`}
            </Zeile>
          </Karte>
        </div>
        <div className={s.spalte}>
          <Karte titel="Wer meldet sich an?" onBearbeiten={bearbeiten('wer')}>
            <Zeile titel="Anmeldung">{WER_TEXT[e.wer][0]}</Zeile>
          </Karte>
          <Karte titel="Datenschutz" onBearbeiten={bearbeiten('loeschfrist')}>
            <Zeile titel="Daten löschen">{e.loeschfristMonate} Monate nach dem Ende</Zeile>
          </Karte>
          <p className={v.hinweis}>
            Preise, Formular und Gestaltung kommen in den nächsten Schritten dazu, die Liste der
            Anmeldungen danach. Bis dahin: „In ChurchTools“.
          </p>
        </div>
      </div>

      {fenster === 'termin' && (
        <TerminFenster
          id={id}
          name={daten.name}
          termin={e.termin}
          zeitzone={zeitzone}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert}
        />
      )}
      {fenster === 'anmeldung' && (
        <AnmeldungFenster
          id={id}
          anmeldung={a}
          plaetze={e.plaetze}
          zeitzone={zeitzone}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert}
        />
      )}
      {fenster === 'wer' && (
        <WerFenster
          id={id}
          wer={e.wer}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert}
        />
      )}
      {fenster === 'loeschfrist' && (
        <LoeschfristFenster
          id={id}
          monate={e.loeschfristMonate}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert}
        />
      )}
      {fenster === 'freigeben' && (
        <Sheet title="Freigeben?" onClose={() => setFenster(null)}>
          <p className={f.hinweis}>
            Danach können sich Gäste anmelden – sobald der Anmeldezeitraum begonnen hat
            {a.ab ? ` (${zeit(a.ab)})` : ''}.{!t && ' Es ist noch kein Termin gewählt.'}
            {!a.ab &&
              ' Es ist noch kein Anmeldebeginn gesetzt – ohne ihn nimmt ChurchTools nichts an.'}
          </p>
          {freigabeFehler && (
            <p className={f.fehler} role="alert">
              {freigabeFehler}
            </p>
          )}
          <button
            type="button"
            className={f.knopf}
            disabled={arbeitet}
            onClick={async () => {
              setArbeitet(true);
              setFreigabeFehler(null);
              try {
                await freigeben(id);
                setArbeitet(false);
                gespeichert();
              } catch (err) {
                setFreigabeFehler(fehlerMeldung(err).text);
                setArbeitet(false);
              }
            }}
          >
            {arbeitet ? 'Wird freigegeben …' : 'Jetzt freigeben'}
          </button>
        </Sheet>
      )}
    </div>
  );
}
