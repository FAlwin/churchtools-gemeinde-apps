import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import { tagAusIso } from '@shared/ct/zeit';
import { geburtsdatumAn, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { anmeldeLink, ortszeitAus } from '@shared/anmeldung/termin';
import { kannEtwasKosten, wozuGeburtsdatum } from '@shared/anmeldung/preis';
import { ibanText, verwendungszweck } from '@shared/anmeldung/bezahlung';
import type { MeineGruppe } from '@shared/ct/gruppen';
import {
  anmeldungVon,
  anmeldungenZahl,
  istGruppenAdmin,
  teamVon,
  wiederherstellen,
  darfVeranstaltungEinrichten,
  einstellungenVon,
  belegungNachziehen,
  kopfVon,
  type AnmeldeEinstellungen,
} from './einrichten';
import {
  AnmeldungFenster,
  BezahlungFenster,
  LoeschfristFenster,
  TerminFenster,
  WerFenster,
} from './Bearbeiten';
import { PreisFensterZeigen, PreiseKarte, ProbeRechnen, type PreisFenster } from './Preise';
import { VerwaltenFenster } from './Verwalten';
import { FreigebenFenster } from './FreigebenFenster';
import { AnmeldeLinkKarte } from './AnmeldeLink';
import { NachpruefungKarte, type NachpruefungStand } from './NachpruefungKarte';
import { nachpruefungAus } from './nachpruefung';
import { ladeMitglieder } from './mitglieder';
import { AnmeldungenReiter, type MitgliederZustand } from './AnmeldungenReiter';
import { Baukasten } from './Baukasten';
import { Segment } from '@ui/bedienung/Segment';
import type { Aenderung } from './Rueckgaengig';
import { WER_TEXT, datumText } from './anzeige';
import { fehlerMeldung, type Fehlermeldung } from './zustand';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import f from './Formular.module.scss';

/**
 * **Eine Veranstaltung einrichten** (A3, #486) – der Reiter „Veranstaltung“ aus dem Entwurf: Termin,
 * Anmeldung, wer sich anmeldet, Preise und Bezahlung (A4), Löschfrist; dazu Freigeben und „Probe rechnen“.
 * Bearbeiten darf, wem ChurchTools es erlaubt (Leitung und Organisatoren des Teams) – alle anderen sehen
 * die Karten ohne „Bearbeiten“ und dürfen probeweise rechnen.
 * Daneben der Reiter „Formular“ (A5): der Baukasten mit Bausteinen und Design, und der Reiter „Anmeldungen“ (A7).
 */

/**
 * Die Reiter einer Veranstaltung (A5). „Gestaltung“ war bis zum Umbau am 13.10.2026 ein eigener Reiter – jetzt
 * steckt sie im Baukasten (Leiste „Design“). Seit A7-1 dazu die Liste der Anmeldungen.
 */
export type Reiter = 'veranstaltung' | 'formular' | 'anmeldungen';

interface Daten {
  name: string;
  statusId: number;
  /** Titelbild (Gruppenbild), `null` = Bild der Vorlage. */
  bildUrl: string | null;
  einstellungen: OeffentlicheEinstellungen;
  anmeldung: AnmeldeEinstellungen;
  darf: boolean;
  /** Angemeldet und Warteliste (A4: Hinweis beim Ändern der Preise); `null` = nicht bekannt. */
  anmeldungen: number | null;
  /** Das Team, zu dem die Veranstaltung gehört (Verwalten). */
  team: { id: number; name: string } | null;
  /** Gruppen-Admin: darf verschieben (Verwalten). */
  admin: boolean;
}

type Fenster =
  | 'termin'
  | 'anmeldung'
  | 'wer'
  | 'bezahlung'
  | 'loeschfrist'
  | 'freigeben'
  | 'verwalten'
  | { preis: PreisFenster }
  | null;

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
  reiter = 'veranstaltung',
  onReiter = () => {},
  gemeinde = null,
  formularAdresse = null,
  zeitzone,
  teams = [],
  onZurueck,
  onGeaendert = () => {},
}: {
  id: number;
  reiter?: Reiter;
  onReiter?: (r: Reiter) => void;
  /** Gemeindename für den Kopf des Formulars (Vorschau). */
  gemeinde?: string | null;
  /** Adresse der Formular-Seite der Gemeinde (Einstellungen) – ohne sie gibt es keinen Link (A6-2). */
  formularAdresse?: string | null;
  zeitzone: string;
  /** Die eigenen Gruppen – Ziele für „In ein anderes Team“. */
  teams?: MeineGruppe[];
  onZurueck: () => void;
  /**
   * Nach jeder Änderung: was geändert wurde und wie es zurückgeht (Leiste „Rückgängig“ der App).
   * `zurUebersicht`: Die Veranstaltung ist archiviert und hier nicht mehr zu sehen.
   */
  onGeaendert?: (a: Aenderung, zurUebersicht: boolean) => void;
}) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [fenster, setFenster] = useState<Fenster>(null);
  // A7-1: Mitglieder einmal laden – für die Liste und die Nachprüfung (A6-5c). `null` = Entwurf, nichts geladen.
  const [mitglieder, setMitglieder] = useState<MitgliederZustand | null>(null);
  const ladeLauf = useRef(0);
  // Wo die Nachprüfung zuletzt stand – beim „Neu prüfen“ bleibt sie dort, statt nach unten und zurück zu springen.
  const [pruefWarOben, setPruefWarOben] = useState(false);

  const mitgliederLaden = useCallback(
    (einstellungen: OeffentlicheEinstellungen, maxPlaetze: number | null) => {
      const lauf = ++ladeLauf.current;
      setMitglieder({ art: 'laedt' });
      ladeMitglieder(id).then(
        (stand) => {
          if (lauf !== ladeLauf.current) return;
          setMitglieder(stand ? { art: 'fertig', stand } : { art: 'verboten' });
          setPruefWarOben(
            !!stand && nachpruefungAus(einstellungen, stand, maxPlaetze).hinweise > 0,
          );
        },
        (x: unknown) =>
          lauf === ladeLauf.current &&
          setMitglieder({ art: 'fehler', text: fehlerMeldung(x).text }),
      );
    },
    [id],
  );

  const laden = useCallback(() => {
    setFehler(null);
    Promise.all([
      kopfVon(id),
      einstellungenVon(id),
      anmeldungVon(id),
      darfVeranstaltungEinrichten(id),
      anmeldungenZahl(id),
      teamVon(id),
      istGruppenAdmin(),
    ]).then(
      ([kopf, einstellungen, anmeldung, darf, anmeldungen, team, admin]) => {
        setDaten({ ...kopf, einstellungen, anmeldung, darf, anmeldungen, team, admin });
        // A6-5b: Belegung der Auswahl für das Formular nachziehen – nebenher, ohne die Seite aufzuhalten. Scheitert
        // es (z. B. vorübergehend), bleibt der alte Stand; beim nächsten Öffnen wird wieder gezählt.
        if (darf)
          belegungNachziehen(id).catch((x: unknown) =>
            console.warn('Belegung der Auswahl nicht nachgezogen', x),
          );
        // A6-5c: In einem Entwurf hat sich noch niemand angemeldet.
        if (kopf.statusId !== 2) mitgliederLaden(einstellungen, anmeldung.maxPlaetze);
        else setMitglieder(null);
      },
      (e: unknown) => setFehler(fehlerMeldung(e)),
    );
  }, [id, mitgliederLaden]);

  useEffect(laden, [laden]);

  /**
   * Nach dem Speichern eines Fensters: neu laden und „Rückgängig“ anbieten. Der Stand VOR der Änderung ist
   * der, den die Seite gerade zeigt – `wiederherstellen` schreibt ihn zurück (eine Stelle für alle Fenster).
   */
  const gespeichert = (was: string) => () => {
    setFenster(null);
    if (daten) {
      const vorher = {
        name: daten.name,
        statusId: daten.statusId,
        einstellungen: daten.einstellungen,
        anmeldung: daten.anmeldung,
      };
      onGeaendert({ text: was, rueckgaengig: () => wiederherstellen(id, vorher) }, false);
    }
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
        <FehlerKasten fehler={fehler} onNochmal={laden} />
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
  const pruef: NachpruefungStand | null =
    !mitglieder || mitglieder.art === 'verboten'
      ? null
      : mitglieder.art === 'laedt'
        ? { art: 'laedt' }
        : mitglieder.art === 'fehler'
          ? { art: 'fehler', text: `Ließ sich gerade nicht prüfen. ${mitglieder.text}` }
          : { art: 'fertig', n: nachpruefungAus(e, mitglieder.stand, a.maxPlaetze) };
  const neuLaden = () => mitgliederLaden(e, a.maxPlaetze);
  const pruefOben = pruef?.art === 'fertig' ? pruef.n.hinweise > 0 : pruefWarOben;
  const pruefKarte = pruef && <NachpruefungKarte stand={pruef} onNeu={neuLaden} />;
  const heute = tagAusIso(new Date().toISOString(), zeitzone);
  const t = e.termin;
  const geburt = geburtsdatumAn(e.formular);
  const kostet = kannEtwasKosten(e.preis);
  const b = e.bezahlung;

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
          {darf && (
            <button type="button" className={v.bearbeiten} onClick={() => setFenster('verwalten')}>
              Verwalten
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
      {/* Erst freigegeben nimmt das Formular etwas an – vorher gibt es keinen Link (14.10.2026). */}
      {!entwurf && formularAdresse && (
        <AnmeldeLinkKarte
          id={id}
          link={anmeldeLink(formularAdresse, ctBasis(), id)}
          titel={daten.name}
          stand={daten}
          onEinrichten={darf ? () => setFenster('freigeben') : undefined}
        />
      )}
      {/* Mit Hinweisen oben, sonst klein unten (Entwurf a6-5c). */}
      {pruefOben && pruefKarte}

      <Segment<Reiter>
        className={v.reiter}
        ariaLabel="Bereich"
        value={reiter}
        onChange={onReiter}
        options={[
          { value: 'veranstaltung', label: 'Veranstaltung' },
          { value: 'formular', label: 'Formular' },
          { value: 'anmeldungen', label: 'Anmeldungen' },
        ]}
      />

      {reiter === 'formular' && (
        <Baukasten
          id={id}
          name={daten.name}
          gemeinde={gemeinde}
          einstellungen={e}
          bildUrl={daten.bildUrl}
          darf={darf}
          heute={heute}
          onGespeichert={(text, umkehrbar) =>
            umkehrbar
              ? gespeichert(text)()
              : (onGeaendert({ text, rueckgaengig: null }, false), laden())
          }
        />
      )}

      {reiter === 'anmeldungen' && (
        <AnmeldungenReiter
          e={e}
          maxPlaetze={a.maxPlaetze}
          entwurf={entwurf}
          zustand={mitglieder}
          stichtag={t?.beginn.slice(0, 10) ?? heute}
          onNeuLaden={neuLaden}
        />
      )}

      {reiter === 'veranstaltung' && (
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
              <Zeile titel="Kontakt">{e.kontakt || '–'}</Zeile>
            </Karte>
            <Karte titel="Wer meldet sich an?" onBearbeiten={bearbeiten('wer')}>
              <Zeile titel="Anmeldung">{WER_TEXT[e.wer][0]}</Zeile>
              <Zeile titel="Geburtsdatum">
                {geburt ? 'wird abgefragt (Pflicht)' : 'wird nicht abgefragt'}
              </Zeile>
            </Karte>
            <PreiseKarte
              preis={e.preis}
              geburtsdatum={geburt}
              darf={darf}
              onOeffnen={(w) => setFenster({ preis: w })}
              onGeburtsdatum={() => setFenster('wer')}
            />
            <Karte titel="Bezahlung" onBearbeiten={bearbeiten('bezahlung')}>
              <Zeile titel="Bankverbindung">
                {b.iban ? (
                  <>
                    {b.kontoinhaber}
                    <br />
                    {ibanText(b.iban)}
                    {b.bic && ` · ${b.bic}`}
                  </>
                ) : kostet ? (
                  <span className={v.fehlt}>fehlt noch</span>
                ) : (
                  'keine (kostenlos)'
                )}
              </Zeile>
              <Zeile titel="Zahlungsfrist">
                {b.fristTage === 0 ? 'keine' : `${b.fristTage} Tage nach der Anmeldung`}
              </Zeile>
              <Zeile titel="Verwendungszweck">
                {b.zweck || '–'}
                {b.zweck.includes('[') && (
                  <small className={v.klein}>z. B. „{verwendungszweck(b.zweck, 'Müller')}“</small>
                )}
              </Zeile>
            </Karte>
            <Karte titel="Datenschutz" onBearbeiten={bearbeiten('loeschfrist')}>
              <Zeile titel="Daten löschen">{e.loeschfristMonate} Monate nach dem Ende</Zeile>
            </Karte>
            {!pruefOben && pruefKarte}
          </div>
          <div className={`${s.spalte} ${v.klebt}`}>
            <ProbeRechnen preis={e.preis} wer={e.wer} geburtsdatum={geburt} heute={heute} />
          </div>
        </div>
      )}

      {fenster === 'termin' && (
        <TerminFenster
          id={id}
          name={daten.name}
          termin={e.termin}
          zeitzone={zeitzone}
          formularAdresse={formularAdresse}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('Termin gespeichert.')}
        />
      )}
      {fenster === 'anmeldung' && (
        <AnmeldungFenster
          id={id}
          anmeldung={a}
          plaetze={e.plaetze}
          kontakt={e.kontakt}
          zeitzone={zeitzone}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('Anmeldung gespeichert.')}
        />
      )}
      {fenster === 'wer' && (
        <WerFenster
          id={id}
          wer={e.wer}
          geburtsdatum={geburt}
          wozu={wozuGeburtsdatum(e.preis)}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('„Wer meldet sich an?“ gespeichert.')}
        />
      )}
      {fenster === 'bezahlung' && (
        <BezahlungFenster
          id={id}
          bezahlung={b}
          kostet={kostet}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('Bezahlung gespeichert.')}
        />
      )}
      {fenster !== null && typeof fenster === 'object' && (
        <PreisFensterZeigen
          key={JSON.stringify(fenster.preis)}
          id={id}
          fenster={fenster.preis}
          preis={e.preis}
          geburtsdatum={geburt}
          anmeldungen={daten.anmeldungen}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('Preise gespeichert.')}
          onWechsel={(w) => setFenster({ preis: w })}
        />
      )}
      {fenster === 'verwalten' && (
        <VerwaltenFenster
          id={id}
          name={daten.name}
          statusId={daten.statusId}
          team={daten.team}
          teams={teams}
          admin={daten.admin}
          anmeldungen={daten.anmeldungen}
          onClose={() => setFenster(null)}
          onGeaendert={(aenderung, weg) => {
            setFenster(null);
            onGeaendert(aenderung, weg);
            if (!weg) laden();
          }}
        />
      )}
      {fenster === 'loeschfrist' && (
        <LoeschfristFenster
          id={id}
          monate={e.loeschfristMonate}
          onClose={() => setFenster(null)}
          onGespeichert={gespeichert('Löschfrist gespeichert.')}
        />
      )}
      {fenster === 'freigeben' && (
        <FreigebenFenster
          id={id}
          formularAdresse={formularAdresse}
          hinweis={
            <p className={f.hinweis}>
              Danach können sich Gäste anmelden – sobald der Anmeldezeitraum begonnen hat
              {a.ab ? ` (${zeit(a.ab)})` : ''}.{!t && ' Es ist noch kein Termin gewählt.'}
              {!a.ab &&
                ' Es ist noch kein Anmeldebeginn gesetzt – ohne ihn nimmt ChurchTools nichts an.'}
              {kostet && !b.iban && ' Es gibt Preise, aber noch keine Bankverbindung.'}
            </p>
          }
          onClose={() => setFenster(null)}
          onFreigegeben={(text) => gespeichert(text)()}
        />
      )}
    </div>
  );
}
