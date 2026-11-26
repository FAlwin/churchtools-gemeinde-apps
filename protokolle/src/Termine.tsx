import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { ctBasis } from '@ui/ct/basis';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Etikett } from '@ui/bedienung/Etikett';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { eineWahl } from '@ui/bedienung/filterAbschnitt';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { Icon } from '@ui/icons/icons';
import { datumText, kachel } from '@shared/ct/datum';
import { gemeindeZeitzone, tagAusIso } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { punktBeschriftung } from '@shared/protokolle/dokument';
import { termineSammeln, terminLink, type TerminZeile } from '@shared/protokolle/termine';
import { standNachId, type TerminStand } from '@shared/protokolle/terminStand';
import { geloeschteTermineSuchen } from './geloeschteTermine';
import { einmalLesen, ladeUebersicht } from './lesen';
import { terminPfad } from './termin';
import { TerminFenster } from './TerminFenster';
import { terminMarkieren } from './terminStandSchreiben';
import type { AufgabenStand } from './useFaellige';
import styles from './Termine.module.scss';

/** Was die Liste zu einem Termin-Baustein wissen muss. */
interface Reihe {
  z: TerminZeile;
  stand: TerminStand | null;
  /** Der eingetragene Termin ist in ChurchTools gelöscht (404) – die Zeile gilt wieder als offen. */
  geloescht: boolean;
}

/** Dieselbe leere Liste bei jedem Render – ein neues `[]` ließe das Fenster die Ressourcen endlos neu laden. */
const KEINE_RESSOURCEN: readonly number[] = [];

/**
 * **Reiter „Termine“** (W14, entschieden 21.11.2026; Entwurf `termine-reiter-w14-v1`): die Termin-Bausteine **aller Sitzungen**
 * der Gruppen (Entwurf und freigegeben) – oben „Noch nicht im Kalender“, darunter einklappbar „Im Kalender“ und „Nicht
 * eintragen“. „Eintragen“ öffnet das Fenster (`TerminFenster`); „Nicht eintragen“ blendet einen Baustein aus („Wieder
 * anzeigen“ holt ihn zurück). Im Protokoll ändert sich nichts: Was aus einem Baustein wurde, steht in „Mitarbeit“
 * (`terminStand.ts`).
 *
 * **Rechte:** Wer in keinem Kalender Termine anlegen darf (`kalenderSchreiben`), sieht die Liste ohne „Eintragen“ und
 * ohne „Nicht eintragen“, dazu einen Satz. Dieselbe Übersicht wie Suche und To-Dos (`ladeUebersicht`).
 */
export function Termine({
  modul,
  ich,
  gruppen,
  kalenderSchreiben,
  vorlagenSchreiben = [],
  tagsVerwalten = false,
  ressourcenBuchen = KEINE_RESSOURCEN,
  ressourcenVerwalten = KEINE_RESSOURCEN,
  eventsAnlegen = KEINE_RESSOURCEN,
  gruppentypenAnlegen = KEINE_RESSOURCEN,
  onZeigen,
  onAufgaben,
}: {
  modul: number;
  ich: { person: number; name: string };
  gruppen: ProtokollGruppe[];
  kalenderSchreiben: readonly number[];
  /** Kalender, in die man Termin-Vorlagen speichern darf (W15-1). */
  vorlagenSchreiben?: readonly number[];
  /** Darf neue Tags anlegen (W15-1). */
  tagsVerwalten?: boolean;
  /** Ressourcen, die man buchen bzw. verwalten darf (W15-2) – Reiter „Ressourcen“ im Fenster. */
  ressourcenBuchen?: readonly number[];
  ressourcenVerwalten?: readonly number[];
  /** Kalender, in denen man Events anlegen darf (W15-3) – Reiter „Events“ im Fenster. */
  eventsAnlegen?: readonly number[];
  /** Gruppentypen, in denen man Gruppen anlegen darf (W15-5) – Reiter „Anmeldung“ im Fenster. */
  gruppentypenAnlegen?: readonly number[];
  /** „Im Protokoll zeigen“: die Sitzung öffnen und zum Tagesordnungspunkt springen. */
  onZeigen: (gruppe: number, sitzung: string, punkt: string | null) => void;
  /**
   * Die To-Dos, die mit der Übersicht ohnehin kamen – für den Hinweis auf fällige To-Dos (`useFaellige`), wie bei Start
   * und To-Dos. So liest die App sie beim Öffnen direkt auf „Termine“ nicht ein zweites Mal.
   */
  onAufgaben?: (stand: readonly AufgabenStand[]) => void;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const zeitzone = gemeindeZeitzone();
  const geladen = useLaden(
    () => (gruppen.length ? ladeUebersicht(modul, gruppen, zeitzone) : Promise.resolve([])),
    [modul, gruppen, zeitzone],
    { behalten: true },
  );
  const [auswahl, setAuswahl] = useState('alle');
  const [fenster, setFenster] = useState<TerminZeile | null>(null);
  // Was hier gerade geschrieben wurde, gilt sofort – ohne das Neuladen abzuwarten.
  const [lokal, setLokal] = useState<ReadonlyMap<string, TerminStand>>(new Map());
  const [fehler, setFehler] = useState<string | null>(null);

  const uebersicht = geladen.stand.art === 'fertig' ? geladen.stand.daten : null;
  useEffect(() => {
    if (uebersicht)
      onAufgaben?.(uebersicht.map((u) => ({ gruppe: u.gruppe.id, aufgaben: u.aufgaben })));
  }, [uebersicht, onAufgaben]);
  // Eingetragene Termine, die es in ChurchTools nicht mehr gibt (404) – nur Anzeige, geschrieben wird nichts.
  const [weg, setWeg] = useState<ReadonlySet<string>>(new Set());
  const gespeichert = useMemo(
    () => (uebersicht ? standNachId(uebersicht.flatMap((u) => u.termine ?? [])) : null),
    [uebersicht],
  );
  useEffect(() => {
    setWeg(new Set());
    if (!uebersicht || !gespeichert) return;
    const termine = termineSammeln(uebersicht).flatMap((z) => {
      const k = gespeichert.get(z.schluessel);
      return k?.stand === 'imKalender' && k.kalender ? [k.kalender] : [];
    });
    if (!termine.length) return;
    let vorbei = false;
    // Je Ladevorgang ein Leser: jede Adresse wird nur einmal gefragt. Die Anzeige wartet nicht darauf.
    void geloeschteTermineSuchen(
      termine,
      einmalLesen(),
      (pfad) => setWeg((m) => new Set(m).add(pfad)),
      () => vorbei,
    );
    return () => {
      vorbei = true;
    };
  }, [uebersicht, gespeichert]);
  const reihen = useMemo<Reihe[]>(() => {
    if (!uebersicht || !gespeichert) return [];
    const stand = new Map(gespeichert);
    for (const [id, s] of lokal) stand.set(id, s);
    const mitGruppe =
      auswahl === 'alle' ? uebersicht : uebersicht.filter((u) => String(u.gruppe.id) === auswahl);
    return termineSammeln(mitGruppe).map((z) => {
      const s = stand.get(z.schluessel) ?? null;
      // Der Vermerk gilt für genau diesen Kalendertermin: ein neuer Vermerk (Eintragen) hat eine andere Adresse.
      const geloescht =
        s?.stand === 'imKalender' && !!s.kalender && weg.has(terminPfad(s.kalender));
      return { z, stand: s, geloescht };
    });
  }, [uebersicht, gespeichert, auswahl, lokal, weg]);

  const offen = reihen.filter((r) => !r.stand || r.stand.stand === 'offen' || r.geloescht);
  const drin = reihen.filter((r) => r.stand?.stand === 'imKalender' && !r.geloescht);
  const nicht = reihen.filter((r) => r.stand?.stand === 'nichtEintragen');

  const gruppeVon = (id: number) => uebersicht?.find((u) => u.gruppe.id === id) ?? null;
  const darfSchreiben = kalenderSchreiben.length > 0;
  /** Eintragen und Vermerken brauchen die Mitarbeit-Kategorie der Gruppe (dort liegt der Stand). */
  const darfHier = (z: TerminZeile) =>
    darfSchreiben && gruppeVon(z.gruppe.id)?.gruppe.mitarbeit != null;
  const mehrereGruppen = gruppen.length > 1;

  const setzeStand = (s: TerminStand) => setLokal((m) => new Map(m).set(s.id, s));
  const markieren = (z: TerminZeile, was: 'nichtEintragen' | 'offen') => {
    const mit = gruppeVon(z.gruppe.id)?.gruppe.mitarbeit;
    if (mit == null) return;
    setFehler(null);
    terminMarkieren(
      { modul, kategorie: mit },
      { gruppe: z.gruppe.id, sitzung: z.sitzung.id, block: z.blockId },
      was,
      ich.person,
      new Date().toISOString(),
    ).then(setzeStand, (e: unknown) => setFehler(fehlerMeldung(e).text));
  };

  const wo = (z: TerminZeile): string =>
    [
      mehrereGruppen ? z.gruppe.name : null,
      `${z.sitzung.titel} · ${datumText(tagAusIso(z.sitzung.beginn, zeitzone))}`,
      z.punkt ? punktBeschriftung(z.punkt) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const kachelVon = (z: TerminZeile) => {
    const k = kachel(z.datum);
    return <DatumKachel tag={k.tag} monat={k.monat} />;
  };

  const zeigen = (z: TerminZeile) =>
    onZeigen(z.gruppe.id, z.sitzung.schluessel, z.punkt?.blockId ?? null);

  const offeneZeile = ({ z, geloescht }: Reihe) => (
    <li key={z.schluessel} className={styles.zeile}>
      {kachelVon(z)}
      <span className={styles.inhalt}>
        <b>{z.text}</b>
        <small className={geloescht ? styles.imKalender : undefined}>
          {geloescht && <Etikett ton="rot">in ChurchTools gelöscht</Etikett>}
          <span>
            {datumText(z.datum)} · aus {wo(z)}
          </span>
        </small>
      </span>
      <span className={styles.aktionen}>
        {darfHier(z) && <TextKnopf onClick={() => setFenster(z)}>Eintragen</TextKnopf>}
        <MehrMenue
          handy={handy}
          titel="Mehr"
          optionen={[
            {
              label: 'Im Protokoll zeigen',
              symbol: <Icon name="dokument" size={18} />,
              onClick: () => zeigen(z),
            },
            // Ein Eintrag im Kalender wird von „Nicht eintragen“ nie überschrieben (`wennNochOffen`) – der Klick täte nichts.
            ...(darfHier(z) && !geloescht
              ? [
                  {
                    label: 'Nicht eintragen',
                    symbol: <Icon name="eye-off" size={18} />,
                    onClick: () => markieren(z, 'nichtEintragen'),
                  },
                ]
              : []),
          ]}
        />
      </span>
    </li>
  );

  const kalenderLink = terminLink(ctBasis());
  const dringeZeile = ({ z, stand }: Reihe) => (
    <li key={z.schluessel} className={styles.zeile}>
      {kachelVon(z)}
      <span className={styles.inhalt}>
        <b>{z.text}</b>
        <small className={styles.imKalender}>
          <Etikett ton="gruen">Im Kalender</Etikett>
          <span>
            {stand?.kalender?.name} · {stand?.kalender?.zeit}
          </span>
          <a href={kalenderLink} target="_blank" rel="noreferrer">
            In ChurchTools öffnen
          </a>
        </small>
      </span>
    </li>
  );

  const nichtZeile = ({ z }: Reihe) => (
    <li key={z.schluessel} className={styles.zeile}>
      {kachelVon(z)}
      <span className={styles.inhalt}>
        <b>{z.text}</b>
        <small>
          {datumText(z.datum)} · aus {wo(z)}
        </small>
      </span>
      <span className={styles.aktionen}>
        {darfHier(z) && (
          <TextKnopf onClick={() => markieren(z, 'offen')}>Wieder anzeigen</TextKnopf>
        )}
      </span>
    </li>
  );

  const klapp = (titel: string, n: number, inhalt: ReactNode) => (
    <Klappe titel={titel} n={n}>
      {inhalt}
    </Klappe>
  );

  if (geladen.stand.art === 'laedt' || geladen.stand.art === 'aus')
    return <p className={styles.leer}>Termine werden geladen …</p>;
  if (geladen.stand.art === 'fehler')
    return <FehlerKasten fehler={geladen.stand.fehler} onNochmal={geladen.neu} />;

  const mitMitarbeit = fenster ? gruppeVon(fenster.gruppe.id) : null;
  return (
    <div className={styles.seite}>
      {mehrereGruppen && (
        <Werkzeugzeile
          handy={handy}
          ariaLabel="Termine"
          rechts={
            <FilterKnopf
              still
              abschnitte={[
                eineWahl(
                  'Gruppe',
                  [
                    { wert: 'alle', text: 'Alle Gruppen' },
                    ...gruppen.map((g) => ({ wert: String(g.id), text: g.name })),
                  ],
                  auswahl,
                  setAuswahl,
                ),
              ]}
            />
          }
        />
      )}
      {!gruppen.length ? (
        <p className={styles.leer}>Du bist in keiner Gruppe, die hier Protokolle führt.</p>
      ) : !reihen.length ? (
        <p className={styles.leer}>
          In den Protokollen stehen noch keine Termine. Du fügst sie im Protokoll als Baustein
          „Termin“ ein.
        </p>
      ) : (
        <section className={styles.karte} aria-label="Termine aus den Protokollen">
          <div className={styles.bereich}>
            Noch nicht im Kalender <span className={styles.anzahl}>{offen.length}</span>
          </div>
          {offen.length ? (
            <ul className={styles.liste}>{offen.map(offeneZeile)}</ul>
          ) : (
            <p className={styles.leer}>Alles eingetragen.</p>
          )}
          {drin.length > 0 &&
            klapp(
              'Im Kalender',
              drin.length,
              <ul className={styles.liste}>{drin.map(dringeZeile)}</ul>,
            )}
          {nicht.length > 0 &&
            klapp(
              'Nicht eintragen',
              nicht.length,
              <ul className={styles.liste}>{nicht.map(nichtZeile)}</ul>,
            )}
        </section>
      )}
      {!darfSchreiben && reihen.length > 0 && (
        <p className={styles.satz}>
          Eintragen kann, wer im Kalender Termine anlegen darf – meist die Leitung.
        </p>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {fenster && mitMitarbeit && mitMitarbeit.gruppe.mitarbeit !== null && (
        <TerminFenster
          zeile={fenster}
          gruppenKalender={mitMitarbeit.sitzungen.kalender}
          schreibbar={kalenderSchreiben}
          vorlagenSchreiben={vorlagenSchreiben}
          tagsVerwalten={tagsVerwalten}
          ressourcenBuchen={ressourcenBuchen}
          ressourcenVerwalten={ressourcenVerwalten}
          eventsAnlegen={eventsAnlegen}
          gruppentypenAnlegen={gruppentypenAnlegen}
          ort={{ modul, kategorie: mitMitarbeit.gruppe.mitarbeit }}
          ich={ich.person}
          zeitzone={zeitzone}
          onFertig={(s) => {
            setzeStand(s);
            setFenster(null);
          }}
          onClose={() => setFenster(null)}
        />
      )}
    </div>
  );
}

/** Ein einklappbarer Abschnitt der Karte – zu, bis man ihn öffnet. */
function Klappe({ titel, n, children }: { titel: string; n: number; children: ReactNode }) {
  const [auf, setAuf] = useState(false);
  return (
    <div className={styles.klapp}>
      <KlickZeile
        className={styles.klappKopf}
        pfeil={auf ? 'auf' : 'zu'}
        ariaExpanded={auf}
        onClick={() => setAuf(!auf)}
      >
        <span>
          {titel} <span className={styles.anzahl}>{n}</span>
        </span>
      </KlickZeile>
      {auf && children}
    </div>
  );
}
