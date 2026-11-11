import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import type { OeffentlicheEinstellungen, TabellenWahl } from '@shared/anmeldung/formular';
import { euroText } from '@shared/anmeldung/preis';
import { wartenTrotzPlatz } from '@shared/anmeldung/nachpruefung';
import {
  anmeldungenAus,
  listenZahlen,
  type Absage,
  type ListenAnmeldung,
} from '@shared/anmeldung/liste';
import type { GeladenerStand } from './mitglieder';
import {
  gezeigteSpalten,
  mitSpaltenWahl,
  personSchluessel,
  personZeilen,
  personZellText,
  personSumme,
  type PersonZeile,
  spaltenWahl,
  summe,
  wahlGeaendert,
  zellText,
  type Sortierung,
  type TabellenModus,
  type TabellenSpalte,
} from '@shared/anmeldung/tabelle';
import { AnmeldungenTabelle } from './AnmeldungenTabelle';
import { SpaltenFenster } from './SpaltenFenster';
import { leseZeilenOben, zeileUmschalten } from './zeilenOben';
import { aendereEinstellungen } from './einrichten';
import { fehlerMeldung } from './zustand';
import { anzahlText } from './anzeige';
import { VonHandFenster } from './VonHandFenster';
import { ZurueckFenster } from './ZurueckFenster';
import { RundmailFenster } from './RundmailFenster';
import { DrucklisteFenster } from './DrucklisteFenster';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import a from './AnmeldungenReiter.module.scss';
import { listenAnsicht, type ListenFilter } from './listenAnsicht';
import { useFenster } from './useFenster';

export type { ListenFilter };
import { absageText, ganzerName, kurz } from './anmeldungText';
import { AnmeldungAnsehen, type PlatzLage } from './AnmeldungAnsehen';

/** Stand der Mitglieder einer Veranstaltung – für Liste und Nachprüfung (A7-1). */
export type MitgliederZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'verboten' }
  | { art: 'fertig'; stand: GeladenerStand };

function ZahlungPille({ x, kostet }: { x: ListenAnmeldung; kostet: boolean }) {
  if (!kostet || x.betragCent === null || x.betragCent <= 0) return null;
  if (x.bezahlt)
    return (
      <span className={`${a.pille} ${a.pilleOk}`}>
        ✓ {x.zahlart ?? 'bezahlt'}
        {x.bezahltAm ? ` ${kurz(x.bezahltAm)}` : ''}
      </span>
    );
  return x.zahlungOffen ? <span className={`${a.pille} ${a.pilleOffen}`}>offen</span> : null;
}

/**
 * **Bereich „Anmeldungen“** (A7-1, seit U2-1 als Tabelle, Entwurf `u2-tabelle-v1`) – Reiter Alle / Zahlung offen /
 * Warteliste / Abgesagt, eine Zeile je Anmeldung, Suche, Sortieren, Summenzeile; im Reiter Warteliste der Hinweis
 * „frei, aber jemand wartet“ (mit „Nachrücken lassen“, A7-3). Klick in eine Zeile öffnet das Fenster der Anmeldung.
 */
export function AnmeldungenReiter({
  id,
  veranstaltung,
  e,
  maxPlaetze,
  warteliste,
  anmeldeschluss,
  entwurf,
  zustand,
  stichtag,
  heute,
  darf,
  zahlarten,
  gemeinde = null,
  onNeuLaden,
  onGespeichert,
  mitBestaetigung = false,
  startFilter = 'alle',
  startRundmail = false,
}: {
  id: number;
  /** Name der Veranstaltung – für die Mail an die Familie (A7-3). */
  veranstaltung: string;
  e: OeffentlicheEinstellungen;
  maxPlaetze: number | null;
  /** Gibt es eine Warteliste? (Anmeldung von Hand, A7-4) */
  warteliste: boolean;
  /** Ende des Anmeldezeitraums (ISO) – von Hand geht es auch danach. */
  anmeldeschluss: string | null;
  entwurf: boolean;
  zustand: MitgliederZustand | null;
  /** Erster Tag der Veranstaltung (Alter), sonst heute. */
  stichtag: string;
  heute: string;
  /** Darf ändern (bezahlt, Betrag) – ChurchTools prüft es beim Schreiben ohnehin. */
  darf: boolean;
  /** Die Zahlarten dieser Veranstaltung (A7-2). */
  zahlarten: string[];
  /** Name der Gemeinde aus ChurchTools – oben auf der Druckliste (A8). */
  gemeinde?: string | null;
  onNeuLaden: () => void;
  /** Nach einer Änderung (und nach „Rückgängig“): Die Seite lädt neu – „Rückgängig“ selbst steht im Fenster. */
  onGespeichert: () => void;
  /** Bestätigungsmails eingerichtet (A9-1). */
  mitBestaetigung?: boolean;
  /** Womit die Liste beginnt – die Kennzahl-Kacheln oben auf der Seite springen so in die passende Ansicht (U1). */
  startFilter?: ListenFilter;
  /** „Rundmail schreiben“ aus dem Hinweis „im Kalender verschoben“ (K1, V6): öffnet sie, sobald die Liste da ist. */
  startRundmail?: boolean;
}) {
  const [filter, setFilter] = useState<ListenFilter>(startFilter);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>(null);
  // Eine Zeile je Anmeldung oder je Person (U2-2) – gilt in allen Reitern außer „Abgesagt“ (Absagen sind je Person).
  const [jePerson, setJePerson] = useState(false);
  // Die Spaltenwahl (U2-3) kommt aus den Einstellungen; hier steht nur, was man eben übernommen hat – damit die Tabelle
  // sofort umspringt und es auch ohne Recht zum Speichern bis zum Neuladen gilt.
  const [eigeneWahl, setEigeneWahl] = useState<Partial<Record<TabellenModus, TabellenWahl>>>({});
  const [spaltenOffen, setSpaltenOffen] = useState(false);
  const [spaltenFehler, setSpaltenFehler] = useState<string | null>(null);
  // Angeheftete Zeilen (U2-4) – nur auf diesem Gerät.
  const [oben, setOben] = useState(() => leseZeilenOben(id));
  // Beim Neuladen (nach einer Änderung) bleibt der letzte Stand stehen – sonst ginge das offene Fenster zu.
  const letzter = useRef<GeladenerStand | null>(null);
  if (zustand?.art === 'fertig') letzter.current = zustand.stand;
  const stand =
    zustand?.art === 'fertig' ? zustand.stand : zustand?.art === 'laedt' ? letzter.current : null;
  const liste = useMemo(
    () => (stand ? anmeldungenAus(e, stand, stichtag) : []),
    [e, stand, stichtag],
  );
  // ── Die Fenster (`useFenster`) ──
  const {
    meldung,
    setMeldung,
    startModus,
    setStartModus,
    vonHand,
    setVonHand,
    zurueck,
    setZurueck,
    rundmail,
    setRundmail,
    druck,
    setDruck,
    oeffnen,
    zurDazuAnmeldung,
    fertig,
    ausgewaehlt,
    fensterX,
  } = useFenster({ liste, darf, mitBestaetigung, startRundmail, onGespeichert });

  if (entwurf || !zustand)
    return (
      <section className={`${s.karte} ${a.leer}`}>
        <b>Noch keine Anmeldungen.</b>
        <span>
          Die Veranstaltung ist noch ein Entwurf. Nach dem Freigeben steht hier, wer sich anmeldet.
        </span>
      </section>
    );
  if (zustand.art === 'laedt' && !stand)
    return <p className={s.leise}>Anmeldungen werden geladen …</p>;
  if (zustand.art === 'verboten')
    return (
      <p className={v.hinweis}>
        Die Anmeldungen sieht, wer in ChurchTools die Mitglieder dieser Gruppe sehen darf.
      </p>
    );
  if (zustand.art === 'fehler')
    return (
      <div className={v.warnung}>
        {zustand.text}{' '}
        <FensterKnopf art="zweit" onClick={onNeuLaden}>
          Nochmal
        </FensterKnopf>
      </div>
    );

  const z = listenZahlen(e, liste);
  const plaetze = { belegt: z.belegt, wartend: z.wartend, max: maxPlaetze };
  const { wartende, absagen, zeilen, personenGezeigt, absageZeilen, zahlen } = listenAnsicht(
    e,
    liste,
    stand!.absagen,
    { filter, suche, sortierung, jePerson, oben },
  );
  const frei = maxPlaetze === null ? null : maxPlaetze - z.belegt;
  /** Eine Zeile an- oder abheften – was es nicht mehr gibt, fällt dabei aus dem Gerätespeicher. */
  const anheftenUm = (k: string) =>
    setOben(
      zeileUmschalten(
        id,
        oben,
        k,
        new Set([...liste.map((x) => x.schluessel), ...personZeilen(liste).map(personSchluessel)]),
      ),
    );
  const lage: PlatzLage = {
    belegt: z.belegt,
    max: maxPlaetze,
    wartende: wartende.map(({ p }) => ({ personId: p.personId, name: ganzerName(p) })),
  };
  const nrFeld = e.ctFelder.nr;
  const gehoertZu = (b: Absage) => {
    const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
    return nr ? liste.find((x) => x.nr === nr) : undefined;
  };

  const modus: TabellenModus = jePerson ? 'person' : 'anmeldung';
  const wahl = eigeneWahl[modus] ?? spaltenWahl(e, modus);
  const spalten = gezeigteSpalten(e, modus, wahl, { warteliste: filter === 'warte' });
  /** Übernehmen: gilt sofort; gemerkt fürs Team, wenn man darf und sich etwas geändert hat (wie die Druckliste). */
  const spaltenUebernehmen = (w: TabellenWahl) => {
    setSpaltenOffen(false);
    setEigeneWahl((alt) => ({ ...alt, [modus]: w }));
    // Die Sortierung nach einer ausgeblendeten Spalte wäre unsichtbar.
    if (sortierung && w.aus.includes(sortierung.schluessel)) setSortierung(null);
    if (!darf || !wahlGeaendert(e, modus, w)) return;
    setSpaltenFehler(null);
    aendereEinstellungen(id, (x) => mitSpaltenWahl(x, modus, w)).then(onGespeichert, (x: unknown) =>
      setSpaltenFehler(
        `Die Spalten sind nur hier umgestellt, nicht für das Team gemerkt: ${fehlerMeldung(x).text}`,
      ),
    );
  };

  const wechseln = (f: ListenFilter) => {
    setFilter(f);
    setSortierung(null);
  };
  const reiter: Reiter<ListenFilter>[] = [
    { id: 'alle', label: 'Alle', icon: 'people', zahl: zahlen.alle },
    ...(z.kostet
      ? [
          {
            id: 'offen' as const,
            label: 'Zahlung offen',
            icon: 'check' as const,
            zahl: zahlen.offen,
          },
        ]
      : []),
    { id: 'warte', label: 'Warteliste', icon: 'clock', zahl: zahlen.warte },
    { id: 'abgesagt', label: 'Abgesagt', icon: 'user-slash', zahl: absagen.length },
  ];
  const strich = <span className={a.strich}>–</span>;

  /** Was in einer Zelle steht – Personen, Nr., Betrag und Bezahlt wie bisher in der Liste, Fragen als Text. */
  const zelle = (k: string, x: ListenAnmeldung): ReactNode => {
    switch (k) {
      case 'name':
        return x.wer;
      case 'nr':
        return x.nr ? (
          <span className={v.nr}>{x.nr}</span>
        ) : (
          <span className={s.chip}>ohne Nr.</span>
        );
      case 'personen':
        return (
          <span className={a.personen}>
            {x.personen.map((p) => (
              <span key={p.personId} className={a.p}>
                {p.vor}
                {p.alter !== null && ` ${p.alter}`}
                {p.status === 'wartet' && (
                  <span className={`${a.pille} ${a.pilleWarte}`}>
                    Warteliste{p.warteplatz ? ` ${p.warteplatz}` : ''}
                  </span>
                )}
              </span>
            ))}
          </span>
        );
      case 'betrag':
        // Alle warten: Das Formular schreibt „0,00 €“ – gezahlt wird erst beim Nachrücken (22.10.2026).
        return x.personen.every((p) => p.status === 'wartet') && !x.betragCent ? (
          <small className={a.leise}>beim Nachrücken</small>
        ) : x.betragCent !== null ? (
          euroText(x.betragCent)
        ) : (
          strich
        );
      case 'bezahlt':
        return <ZahlungPille x={x} kostet={z.kostet} />;
    }
    const text = zellText(e, k, x);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  /** Je Person (U2-2): Status als Pille wie in der Spalte „Personen“, Nr., Betrag und Bezahlt der Anmeldung wie dort. */
  const personZelle = (k: string, y: PersonZeile): ReactNode => {
    switch (k) {
      case 'status':
        return y.p.status === 'wartet' ? (
          <span className={`${a.pille} ${a.pilleWarte}`}>
            Warteliste{y.p.warteplatz ? ` ${y.p.warteplatz}` : ''}
          </span>
        ) : (
          'Platz'
        );
      case 'nr':
      case 'betrag':
      case 'bezahlt':
        return zelle(k, y.x);
    }
    const text = personZellText(e, k, y);
    return text ? (
      <span className={a.kurzText} title={text}>
        {text}
      </span>
    ) : (
      strich
    );
  };

  const absageSpalten: TabellenSpalte[] = [
    { schluessel: 'name', titel: 'Name', zahl: false },
    ...(nrFeld !== undefined ? [{ schluessel: 'nr', titel: 'Nr.', zahl: false }] : []),
    { schluessel: 'abgesagt', titel: 'Abgesagt', zahl: false },
    { schluessel: 'gehoert', titel: 'Gehörte zu', zahl: false },
    // Wer ändern darf, sieht wie bisher, was ein Klick tut.
    ...(darf ? [{ schluessel: 'zurueck', titel: '', zahl: true }] : []),
  ];
  const absageZelle = (k: string, b: Absage): ReactNode => {
    switch (k) {
      case 'name':
        return b.name;
      case 'nr': {
        const nr = nrFeld === undefined ? undefined : b.werte[nrFeld];
        return nr ? <span className={v.nr}>{nr}</span> : strich;
      }
      case 'abgesagt':
        return `${absageText(b)}${b.warVorher === 'wartet' ? ' · stand auf der Warteliste' : ''}`;
      case 'zurueck':
        return <small className={a.leise}>Zurückholen</small>;
      default:
        return gehoertZu(b)?.wer ?? strich;
    }
  };

  const leer = (text: string) => (
    <p className={a.leerZeile}>{suche.trim() ? `Niemand mit „${suche.trim()}“ gefunden.` : text}</p>
  );

  return (
    <div className={a.reiter}>
      {/* Plätze, Warteliste und Zahlung offen stehen seit U1 oben auf der Seite (Kennzahlen, `Einstieg.tsx`). */}
      <section className={s.karte} aria-label="Anmeldungen">
        <ReiterLeiste oben name="Ansichten" reiter={reiter} aktiv={filter} onWechsel={wechseln} />

        {/* „Platz frei – jemand wartet“ steht seit U2-1 nur noch hier und in der Kachel (Alwin, 29.10.2026). */}
        {filter === 'warte' && wartenTrotzPlatz(plaetze) && wartende[0] && (
          <p className={a.warteHinweis}>
            <span>
              <b>
                {frei === null
                  ? 'Es ist Platz frei'
                  : `${anzahlText(frei, 'Platz', 'Plätze')} frei`}{' '}
                – {z.wartend === 1 ? '1 wartet' : `${z.wartend} warten`}.
              </b>{' '}
              ChurchTools lässt niemanden von selbst nachrücken. Als Nächste wartet{' '}
              {ganzerName(wartende[0].p)}
              {wartende[0].x.angemeldetAm && ` (seit ${kurz(wartende[0].x.angemeldetAm)})`}.
            </span>
            {darf && (
              <FensterKnopf
                art="hell"
                onClick={() =>
                  oeffnen(wartende[0].x.schluessel, {
                    art: 'nach',
                    personId: wartende[0].p.personId,
                  })
                }
              >
                {wartende[0].p.vor} nachrücken lassen
              </FensterKnopf>
            )}
          </p>
        )}

        <div className={a.leiste}>
          <label className={a.suche}>
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Name oder Nr. suchen"
              aria-label="Name suchen"
              value={suche}
              onChange={(ev) => setSuche(ev.target.value)}
            />
          </label>
          {filter !== 'abgesagt' && (
            <Segment
              verbunden
              ariaLabel="Zeilen"
              value={jePerson ? 'person' : 'anmeldung'}
              options={[
                { value: 'anmeldung', label: 'Je Anmeldung' },
                { value: 'person', label: 'Je Person' },
              ]}
              onChange={(w) => {
                setJePerson(w === 'person');
                setSortierung(null);
              }}
            />
          )}
          <span className={a.rechts}>
            {filter !== 'abgesagt' && liste.length > 0 && (
              <FensterKnopf art="zweit" aria-label="Spalten" onClick={() => setSpaltenOffen(true)}>
                <Icon name="columns" size={18} />
                <span className={a.breit}>Spalten</span>
              </FensterKnopf>
            )}
            {liste.length > 0 && (
              <FensterKnopf art="zweit" aria-label="Druckliste" onClick={() => setDruck(true)}>
                <Icon name="drucker" size={18} />
                <span className={a.breit}>Druckliste</span>
              </FensterKnopf>
            )}
            {darf && liste.length > 0 && (
              <FensterKnopf art="zweit" aria-label="Rundmail" onClick={() => setRundmail(true)}>
                <Icon name="brief" size={18} />
                <span className={a.breit}>Rundmail</span>
              </FensterKnopf>
            )}
            {darf && (
              <FensterKnopf onClick={() => setVonHand({ dazu: null })}>＋ Von Hand</FensterKnopf>
            )}
          </span>
        </div>

        {spaltenFehler && (
          <p className={a.hinweisRot} role="alert">
            {spaltenFehler}
          </p>
        )}

        {filter === 'abgesagt' ? (
          absageZeilen.length === 0 ? (
            leer('Niemand hat abgesagt.')
          ) : (
            <AnmeldungenTabelle
              name="Absagen"
              spalten={absageSpalten}
              zeilen={absageZeilen}
              schluessel={(b) => String(b.personId)}
              zelle={absageZelle}
              summe={(k) =>
                k === 'name' ? { text: anzahlText(absageZeilen.length, 'Absage', 'Absagen') } : null
              }
              // Wer ändern darf, holt mit einem Klick zurück (A7-4c).
              onZeile={darf ? (b) => setZurueck({ b, von: null }) : undefined}
            />
          )
        ) : (jePerson ? personenGezeigt.length : zeilen.length) === 0 ? (
          leer(
            filter === 'offen'
              ? 'Alle haben bezahlt.'
              : filter === 'warte'
                ? 'Niemand auf der Warteliste.'
                : 'Noch keine Anmeldungen.',
          )
        ) : jePerson ? (
          <AnmeldungenTabelle
            name="Personen"
            spalten={spalten}
            zeilen={personenGezeigt}
            schluessel={personSchluessel}
            zelle={personZelle}
            summe={(k) => personSumme(e, k, personenGezeigt)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(y) => oeffnen(y.x.schluessel)}
            anheften={{
              an: (y) => oben.has(personSchluessel(y)),
              umschalten: (y) => anheftenUm(personSchluessel(y)),
            }}
          />
        ) : (
          <AnmeldungenTabelle
            name="Anmeldungen"
            spalten={spalten}
            zeilen={zeilen}
            schluessel={(x) => x.schluessel}
            zelle={zelle}
            summe={(k) => summe(e, k, zeilen)}
            sortierung={sortierung}
            onSortieren={setSortierung}
            onZeile={(x) => oeffnen(x.schluessel)}
            anheften={{
              an: (x) => oben.has(x.schluessel),
              umschalten: (x) => anheftenUm(x.schluessel),
            }}
          />
        )}

        <p className={v.pruefFuss}>
          {jePerson
            ? 'Eine Zeile je Person, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert. Die Summen zählen Personen mit Platz; Betrag und Bezahlt gehören der Anmeldung und zählen sie einmal.'
            : 'Eine Zeile je Anmeldung, ohne Wahl nach Anmeldetag – ein Tipp auf die Überschrift einer Spalte sortiert. Die Summen zählen Anmeldungen mit Platz. Ältere Anmeldungen ohne Nr. stehen je Person einzeln.'}{' '}
          Die Nadel am Zeilenanfang heftet eine Zeile oben an – nur auf diesem Gerät. Die Leitung
          steht nicht in der Liste.
          {stand!.verlaufGekuerzt &&
            ' Der Verlauf in ChurchTools ist sehr lang – die ältesten Absagen fehlen hier.'}{' '}
          <button type="button" className={a.linkKnopf} onClick={onNeuLaden}>
            Neu laden
          </button>
        </p>
      </section>

      {vonHand && (
        <VonHandFenster
          mitBestaetigung={mitBestaetigung}
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          anmeldeschluss={anmeldeschluss}
          dabei={new Set(stand!.mitglieder.map((m) => m.personId))}
          abgesagt={new Set(stand!.absagen.map((b) => b.personId))}
          dazu={vonHand.dazu}
          onZurueckholen={(personId) => {
            const b = stand!.absagen.find((y) => y.personId === personId);
            if (!b) return;
            setZurueck({ b, von: null, vonHand: { dazu: vonHand.dazu } });
            setVonHand(null);
          }}
          // X schließt alles; „‹“ (im ersten Schritt) und „Abbrechen“ führen bei „Person dazu“ zurück in die Anmeldung
          // (02.11.2026).
          onClose={() => setVonHand(null)}
          zurueck={vonHand.dazu ? () => zurDazuAnmeldung(vonHand.dazu) : undefined}
          onAbbrechen={() => zurDazuAnmeldung(vonHand.dazu)}
          onFertig={(x) => {
            setVonHand(null);
            fertig(x);
          }}
        />
      )}

      {rundmail && (
        <RundmailFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          liste={liste}
          // Wie der Filter der Liste – „Zahlung offen“ beginnt mit der Zahlungserinnerung.
          startFilter={filter === 'offen' ? 'offen' : filter === 'warte' ? 'warte' : 'alle'}
          onClose={() => setRundmail(false)}
        />
      )}

      {spaltenOffen && (
        <SpaltenFenster
          e={e}
          modus={modus}
          wahl={wahl}
          darf={darf}
          onUebernehmen={spaltenUebernehmen}
          onClose={() => setSpaltenOffen(false)}
        />
      )}

      {druck && (
        <DrucklisteFenster
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          gemeinde={gemeinde}
          liste={liste}
          darf={darf}
          onGemerkt={onGespeichert}
          onClose={() => setDruck(false)}
        />
      )}

      {zurueck && (
        <ZurueckFenster
          mitBestaetigung={mitBestaetigung}
          id={id}
          e={e}
          veranstaltung={veranstaltung}
          heute={heute}
          lage={{ belegt: z.belegt, max: maxPlaetze, wartende: z.wartend, warteliste }}
          b={zurueck.b}
          liste={liste}
          onClose={() => setZurueck(null)}
          zurueck={
            zurueck.von !== null || zurueck.vonHand
              ? () => {
                  if (zurueck.von !== null) oeffnen(zurueck.von);
                  else if (zurueck.vonHand) setVonHand(zurueck.vonHand);
                  setZurueck(null);
                }
              : undefined
          }
          onFertig={(x) => {
            setZurueck(null);
            fertig(x);
          }}
        />
      )}

      {fensterX && (
        <AnmeldungAnsehen
          key={fensterX.schluessel}
          x={fensterX}
          e={e}
          kostet={z.kostet}
          onClose={() => oeffnen(null)}
          id={id}
          veranstaltung={veranstaltung}
          zahlarten={zahlarten}
          heute={heute}
          darf={darf && !!ausgewaehlt}
          lage={lage}
          start={startModus}
          meldung={meldung}
          onGemeldet={(neu) => {
            setMeldung(neu);
            setStartModus(null);
            onGespeichert();
          }}
          onRueckgaengig={() => {
            // Nach dem Rückgängigmachen ist „… schickt dabei noch einmal“ erledigt (echte Prüfung 24.10.2026).
            setMeldung((m) => (m?.hinweisBisRueckgaengig ? { ...m, hinweis: undefined } : m));
            onGespeichert();
          }}
          mitBestaetigung={mitBestaetigung}
          onZurueckholen={
            darf && ausgewaehlt
              ? (b) => {
                  setZurueck({ b, von: ausgewaehlt.schluessel });
                  oeffnen(null);
                }
              : undefined
          }
          onPersonDazu={
            darf && ausgewaehlt?.nr
              ? () => {
                  setVonHand({ dazu: ausgewaehlt });
                  oeffnen(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
