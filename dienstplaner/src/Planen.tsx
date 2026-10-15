import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Segment } from '@ui/bedienung/Segment';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { kachel, monatName, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte, PlanZeile } from '@shared/dienstplan/plan';
import { artVon, veranstaltungsArten, WEITERE } from '@shared/dienstplan/termine';
import {
  DIENST_SPALTE,
  passendeAnzahl,
  schritt,
  sichtbar,
  SPALTENBREITE,
  type Breite,
  type Fenster,
  type FensterSchritt,
} from '@shared/dienstplan/fenster';
import { werWieOft } from '@shared/dienstplan/werWieOft';
import {
  entwurfVeraltet,
  ortSchluessel,
  zielText,
  type Besetzung,
  type Entwurf,
  type EntwurfErgebnis,
} from '@shared/dienstplan/entwuerfe';
import {
  zeitraumGrenzen,
  spanneText,
  zeitraumText,
  zeitraumVerschieben,
  type Zeitraum,
} from '@shared/dienstplan/zeitraum';
import type { TermineZustand } from './Termine';
import type { TermineDaten } from './ladeTermine';
import { ZeitraumKnopf } from './ZeitraumKnopf';
import { leseAnsicht, merkeAnsicht, type PlanenAnsicht } from './planenAnsicht';
import { useBreite } from './useBreite';
import { FilterKnopf } from './FilterKnopf';
import { WerKann, type Eintragen, type FreierPlatz } from './WerKann';
import { EntwurfFach } from './EntwurfFach';
import { BelegtFach } from './BelegtFach';
import { PlaetzeFach, type PlaetzeZeile } from './PlaetzeFach';
import { SendenFach, type SendeZeile } from './SendenFach';
import { grundText, type EntwuerfeDaten, type EntwurfAnschluss } from './ladeEntwuerfe';
import styles from './Planen.module.scss';

interface Props {
  zustand: TermineZustand;
  /** Schmaler Bildschirm: ein Termin auf einmal statt der Tabelle (Entwurf v17). */
  handy: boolean;
  onNochmal: () => void;
  /** Nach dem Senden leise neu laden (ohne „wird geladen“) – die Matrix zeigt dann, was in ChurchTools steht. */
  onAktualisieren?: () => void;
  /** Weitere Wochen „ab heute“ nachladen – die Terminleiste ruft das am Ende selbst auf. */
  onMehr: () => void;
  /** Lassen sich „ab heute“ noch weitere Wochen nachladen? */
  mehrMoeglich: boolean;
  /** Einen gewählten Zeitraum laden (Monat, von–bis) – nur für die Matrix, Start und Termine bleiben. */
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  /** Heute (`YYYY-MM-DD`, Ortszeit der Gemeinde). */
  heute: string;
  /** Eintragen als Entwurf (E4-3) – ohne Anschluss bleibt „Wer kann?“ nur zum Ansehen. */
  entwuerfe?: EntwurfAnschluss;
}

/** Ein Entwurf an einem Platz – und ob er veraltet ist (in ChurchTools steht inzwischen etwas anderes). */
type EntwurfAmPlatz = { entwurf: Entwurf; veraltet: boolean };

type EntwuerfeZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; daten: EntwuerfeDaten };

/** Schlüssel einer Gruppe – `null` (ohne Dienstgruppe) bekommt einen eigenen. */
const schluessel = (g: PlanGruppe) => (g.gruppe ? String(g.gruppe.id) : 'ohne');
const gruppenName = (g: PlanGruppe) => g.gruppe?.name ?? 'Weitere Dienste';

/** Was die Matrix gerade zeigt – aus Plan, Filtern und Fenster. */
interface Sicht {
  plan: Plan;
  /** Indizes der sichtbaren Spalten in `plan.spalten`. */
  spalten: number[];
  gruppen: PlanGruppe[];
  zugeklappt: Set<string>;
  /** Spalten einer anderen Veranstaltung als der häufigsten – abgesetzt (Entwurf: Gebetsabende). */
  neben: (s: PlanSpalte) => boolean;
  onUmschalten: (k: string) => void;
  /** Freien Platz antippen → „Wer kann?“ (nur wo man den Dienst planen darf). */
  onFrei: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Der Entwurf an einem Platz – mit „veraltet“, wenn in ChurchTools inzwischen etwas anderes steht. */
  entwurf: (spalte: number, zeile: PlanZeile, p: PlanPlatz) => EntwurfAmPlatz | null;
  /** Einen Entwurf antippen → Entwurfs-Fach (E4-3-3; nur wo man planen und die Schublade ändern darf). */
  onEntwurf: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Einen belegten Platz antippen → zurückziehen oder ersetzen (E4-5; nur wo man den Dienst planen darf). */
  onBelegt: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Regler in der Gruppenzeile → Plätze-Fach (E4-5-3); `undefined`, wo man keinen Dienst der Gruppe plant. */
  onPlaetze: (spalte: number, gruppe: PlanGruppe) => (() => void) | undefined;
  darfAendern: (zeile: PlanZeile) => boolean;
  /** Die eigene Person – eigene Entwürfe stehen ohne „von …“. */
  ichId: number | null;
}

/** Darf man an diesem Termin diesen Dienst planen – über Recht, Leitung oder als Admin des Termins? */
const darfPlanen = (z: PlanZeile, s: PlanSpalte) => z.planbar || s.admin;

/** Was das Fach „Wer kann?“ über den angetippten Platz wissen muss. */
function freierPlatz(s: PlanSpalte, z: PlanZeile, plaetze: PlanPlatz[], nr: number): FreierPlatz {
  return {
    eventId: s.id,
    serviceId: z.dienst.id,
    dienst: z.dienst.name,
    termin: s.name,
    tag: tagKurz(s.tag),
    uhrzeit: s.uhrzeit,
    monat: s.tag.slice(0, 7),
    monatName: monatName(s.tag),
    nr,
    von: plaetze.length,
    schonDa: plaetze.flatMap((p) => (p.personId !== null ? [p.personId] : [])),
    index: plaetze[nr - 1]?.index ?? null,
    gruppeId: z.dienst.dienstgruppeId ?? 0,
    ...bisherAus(plaetze[nr - 1]),
  };
}

/** Wer jetzt dort steht (E4-5) – nur bei belegten Plätzen mit sichtbarem Namen (verborgene haben keinen). */
function bisherAus(p: PlanPlatz | undefined): Pick<FreierPlatz, 'bisher'> {
  if (!p || p.art === 'frei' || p.name === null) return {};
  return { bisher: { belegung: p.belegung, name: p.name, gast: p.gast } };
}

/**
 * **Planen** (Bauplan E3-4/E3-5, Entwurf v17): Termine als Spalten, Dienstgruppen und Dienste als Zeilen,
 * in jeder Zelle die Plätze. Darüber die Terminleiste mit dem **Zeitraum-Knopf** (Alwin, 14.10.2026): ab heute
 * (passend zur Fensterbreite, ‹ ＋ ＋ › blättern und laden am Ende selbst nach), ein Monat oder ein eigener
 * Zeitraum – dann stehen alle Termine des Bereichs da, und ‹ › springen um den ganzen Bereich. Dazu Filter,
 * Spaltenbreite und „Wer wie oft?“. Eingeteilt wird über Entwürfe (E4): freien Platz antippen → „Wer kann?“,
 * belegten Platz → zurückziehen oder ersetzen (E4-5), gesendet über die Leiste unten; der Regler in der Gruppenzeile
 * ändert die Anzahl der Plätze (E4-5-3, sofort). Am Handy: eine Datumsleiste
 * und darunter ein Termin.
 */
export function Planen({
  zustand,
  handy,
  onNochmal,
  onAktualisieren,
  onMehr,
  mehrMoeglich,
  ladeZeitraum,
  heute,
  entwuerfe,
}: Props) {
  const [ansicht, setAnsichtRoh] = useState<PlanenAnsicht>(leseAnsicht);
  const setAnsicht = (a: PlanenAnsicht) => {
    setAnsichtRoh(a);
    merkeAnsicht(a);
  };
  const [fenster, setFenster] = useState<Fenster>({ start: 0, anzahl: null });
  const [zu, setZu] = useState<Set<string> | null>(null);
  const [frei, setFrei] = useState<FreierPlatz | null>(null);
  // Das Fenster am belegten Platz (E4-5): zurückziehen oder ersetzen.
  const [belegt, setBelegt] = useState<FreierPlatz | null>(null);
  // Das Plätze-Fach (E4-5-3): Termin und Gruppe.
  const [plaetzeFach, setPlaetzeFach] = useState<{ spalte: number; gruppe: PlanGruppe } | null>(
    null,
  );
  // Ein angetippter Entwurf (E4-3-3) – und ob „Andere Person wählen“ einen Entwurf ersetzt (seine Version).
  const [fach, setFach] = useState<{
    platz: FreierPlatz;
    entwurf: Entwurf;
    inChurchTools: string | null;
  } | null>(null);
  const [ersetzt, setErsetzt] = useState<number | null>(null);
  // Das offene Senden-Fach mit seiner Liste (beim Öffnen festgehalten).
  const [sendenListe, setSendenListe] = useState<SendeZeile[] | null>(null);
  const [rahmen, platz] = useBreite();
  const { toast, showToast } = useToast();

  // Entwürfe (E4-3): geladen beim Öffnen, neu nach dem Einrichten einer Schublade oder „Erneut versuchen“.
  const [ew, setEw] = useState<EntwuerfeZustand>({ art: 'laedt' });
  const [ewVersuch, setEwVersuch] = useState(0);
  useEffect(() => {
    if (!entwuerfe) return;
    let aktuell = true;
    setEw({ art: 'laedt' });
    entwuerfe.laden().then(
      (daten) => aktuell && setEw({ art: 'fertig', daten }),
      (e: unknown) => aktuell && setEw({ art: 'fehler', text: fehlerMeldung(e).text }),
    );
    return () => {
      aktuell = false;
    };
  }, [entwuerfe, ewVersuch]);
  const ewNeu = useCallback(() => setEwVersuch((v) => v + 1), []);
  /**
   * Der Entwurf an einem Platz. Gültig ist er nur, wenn am Platz in ChurchTools noch dasselbe steht wie beim
   * Eintragen – sonst ist er **veraltet**: Es gilt ChurchTools, und am Platz steht nur ein Schild (Alwin,
   * 14.10.2026). Verglichen wird mit derselben Regel wie beim Senden (`p.belegung`, `gleicherStand` – auch eine
   * inzwischen gegebene Zusage zählt als Änderung, Alwin 15.10.2026).
   */
  const entwurfAmPlatz = (s: PlanSpalte, zl: PlanZeile, p: PlanPlatz): EntwurfAmPlatz | null => {
    if (ew.art !== 'fertig') return null;
    const e = ew.daten.entwuerfe.get(
      ortSchluessel({ eventId: s.id, serviceId: zl.dienst.id, index: p.index }),
    );
    if (!e) return null;
    return { entwurf: e, veraltet: entwurfVeraltet(e, p.belegung) };
  };
  /** Darf man die Entwürfe dieser Gruppe ändern? (Schublade bereit) */
  const darfAendern = (zl: PlanZeile) =>
    ew.art === 'fertig' &&
    ew.daten.schubladen.get(zl.dienst.dienstgruppeId ?? 0)?.stand === 'bereit';
  /** Einen Entwurf (oder sein Fehlen) in die geladenen Daten übernehmen – ohne alles neu zu laden. */
  const ewSetzen = (k: string, e: Entwurf | null) =>
    setEw((alt) => {
      if (alt.art !== 'fertig') return alt;
      const map = new Map(alt.daten.entwuerfe);
      if (e) map.set(k, e);
      else map.delete(k);
      return { art: 'fertig', daten: { ...alt.daten, entwuerfe: map } };
    });

  // Gewählter Zeitraum: eigene Abfrage, gemerkt mit ihrem Bereich – eine späte Antwort für einen alten
  // Bereich zählt nicht mehr.
  const grenzen = zeitraumGrenzen(ansicht.zeitraum);
  const bereich = grenzen ? `${grenzen.von}|${grenzen.bis}` : null;
  const [eigen, setEigen] = useState<{ bereich: string; zustand: TermineZustand } | null>(null);
  const [versuch, setVersuch] = useState(0);
  // Nach dem Senden leise neu laden: Das Bisherige bleibt stehen, bis das Neue da ist (wie „ab heute“).
  const leiseNeu = useRef(false);
  useEffect(() => {
    if (!grenzen || !bereich) return;
    let aktuell = true;
    if (!leiseNeu.current) setEigen({ bereich, zustand: { art: 'laedt' } });
    leiseNeu.current = false;
    ladeZeitraum(grenzen.von, grenzen.bis).then(
      (d) =>
        aktuell &&
        setEigen({
          bereich,
          zustand: { art: 'fertig', zeilen: d.zeilen, plan: d.plan, wochen: 0 },
        }),
      (e: unknown) =>
        aktuell && setEigen({ bereich, zustand: { art: 'fehler', fehler: fehlerMeldung(e) } }),
    );
    return () => {
      aktuell = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `grenzen` steckt vollständig in `bereich`
  }, [bereich, ladeZeitraum, versuch]);
  const quelle: TermineZustand = !bereich
    ? zustand
    : eigen?.bereich === bereich
      ? eigen.zustand
      : { art: 'laedt' };

  // „Ab heute“ am Ende: erst nachladen, dann den Schritt tun (Alwin: „Weitere Termine laden“ machte dasselbe
  // wie ＋). Kommt nichts Neues, wird weitergeladen – eine lange Lücke (Sommerpause, oder ein Filter auf eine
  // selten eingesetzte Gruppe) ist kein Ende. Schluss ist erst an der Ladegrenze (`mehrMoeglich`).
  const [nachLaden, setNachLaden] = useState<{ was: FensterSchritt; laenge: number } | null>(null);
  useEffect(() => {
    if (!nachLaden || zustand.art !== 'fertig') return;
    if (zustand.nachladeFehler) {
      setNachLaden(null); // nicht als „Ende“ werten – ein Aussetzer ist kein Ende
      return;
    }
    const d = fensterDaten(zustand.plan, ansicht, platz);
    if (d.gefiltert.length > nachLaden.laenge) {
      setFenster((f) => schritt(f, nachLaden.was, d.gefiltert.length, d.passend));
    } else if (mehrMoeglich) {
      onMehr(); // `nachLaden` bleibt stehen – der nächste Stand landet wieder hier
      return;
    }
    setNachLaden(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn neue Termine angekommen sind
  }, [zustand]);
  const kannNachladen = !bereich && mehrMoeglich && !nachLaden;

  const waehleZeitraum = (z: Zeitraum) => {
    if (z.art === 'abHeute') setFenster((f) => schritt(f, 'passend', 0, 0));
    setAnsicht({ ...ansicht, zeitraum: z });
  };

  const plan = quelle.art === 'fertig' ? quelle.plan : null;
  const d = plan ? fensterDaten(plan, ansicht, platz) : null;
  const gesamt = d?.gefiltert.length ?? 0;
  const f = sichtbar(fenster, gesamt, d?.passend ?? 0);
  const imFenster = d ? (bereich ? d.gefiltert : d.gefiltert.slice(f.von, f.bis)) : [];
  const nachladen = (was: FensterSchritt) => {
    setNachLaden({ was, laenge: gesamt });
    onMehr();
  };
  const gehe = (was: FensterSchritt) => {
    const amEnde = (was === 'weiter' || was === 'spaeterDazu') && !f.danach;
    if (amEnde && kannNachladen) {
      nachladen(was);
      return;
    }
    setFenster(schritt(fenster, was, gesamt, d?.passend ?? 0));
  };

  // Aufschrift des Zeitraum-Knopfs.
  const anzahl = handy || bereich ? (d?.gefiltert.length ?? 0) : imFenster.length;
  const terminText = `${anzahl} ${anzahl === 1 ? 'Termin' : 'Termine'}`;
  const z = ansicht.zeitraum;
  const zeile1 =
    z.art !== 'abHeute'
      ? zeitraumText(z)
      : handy || !plan || imFenster.length === 0
        ? 'Ab heute'
        : spanneText(
            plan.spalten[imFenster[0]].tag,
            plan.spalten[imFenster[imFenster.length - 1]].tag,
          );
  const zeile2 =
    quelle.art === 'laedt'
      ? 'wird geladen …'
      : nachLaden
        ? 'weitere Termine werden geladen …'
        : z.art === 'abHeute' && !handy && fenster.anzahl === null
          ? `${terminText} · passend zur Fensterbreite`
          : terminText;

  const knopf = (
    <ZeitraumKnopf
      zeitraum={z}
      zeile1={zeile1}
      zeile2={zeile2}
      heute={heute}
      handy={handy}
      onWahl={waehleZeitraum}
    />
  );
  const leiste = (
    <Terminleiste
      knopf={knopf}
      bereich={!!bereich}
      handy={handy}
      davor={bereich ? true : f.davor}
      danach={bereich ? true : f.danach || kannNachladen}
      onSchritt={gehe}
      onVerschieben={(r) => setAnsicht({ ...ansicht, zeitraum: zeitraumVerschieben(z, r) })}
    />
  );

  const arten = plan ? veranstaltungsArten(plan.spalten) : [];
  const werkzeug = (
    <div className={styles.werkzeug}>
      <Segment
        value={ansicht.unteransicht}
        options={[
          { value: 'matrix', label: 'Matrix' },
          { value: 'personen', label: 'Wer wie oft?' },
        ]}
        onChange={(v) => setAnsicht({ ...ansicht, unteransicht: v })}
        ariaLabel="Ansicht"
        className={styles.ansicht}
        verbunden
      />
      {!handy && leiste}
      <div className={styles.rechts}>
        {!handy && ansicht.unteransicht === 'matrix' && (
          <Segment<Breite>
            value={ansicht.breite}
            options={[
              { value: 's', label: 'S' },
              { value: 'm', label: 'M' },
              { value: 'l', label: 'L' },
            ]}
            onChange={(b) => setAnsicht({ ...ansicht, breite: b })}
            ariaLabel="Spaltenbreite"
            verbunden
          />
        )}
        <FilterKnopf
          abschnitte={[
            {
              titel: 'Veranstaltungen',
              optionen: arten.map((art) => ({
                wert: art,
                text: art === WEITERE ? 'Weitere' : art,
              })),
              aus: ansicht.ausgeblendeteArten,
              onAus: (ausgeblendeteArten) => setAnsicht({ ...ansicht, ausgeblendeteArten }),
            },
            {
              titel: 'Gruppen',
              optionen: (plan?.gruppen ?? []).map((g) => ({
                wert: schluessel(g),
                text: gruppenName(g),
              })),
              aus: ansicht.ausgeblendeteGruppen,
              onAus: (ausgeblendeteGruppen) => setAnsicht({ ...ansicht, ausgeblendeteGruppen }),
            },
          ]}
        />
      </div>
      {handy && leiste}
    </div>
  );

  const hinweis = (text: string) => (
    <section className={styles.karte}>
      <p className={styles.hinweis} style={{ padding: 14 }}>
        {text}
      </p>
    </section>
  );

  let inhalt: ReactNode;
  if (quelle.art === 'laedt') inhalt = <p className={styles.hinweis}>Termine werden geladen …</p>;
  else if (quelle.art === 'fehler')
    inhalt = (
      <FehlerKasten
        fehler={quelle.fehler}
        onNochmal={bereich ? () => setVersuch((v) => v + 1) : onNochmal}
      />
    );
  else if (!plan || !d || plan.spalten.length === 0)
    inhalt = hinweis(
      z.art === 'abHeute'
        ? `In den nächsten ${quelle.wochen} Wochen stehen keine Termine an.`
        : z.art === 'monat'
          ? `Im ${zeitraumText(z)} stehen keine Termine an.`
          : `Vom ${zeitraumText(z).replace(' – ', ' bis ')} stehen keine Termine an.`,
    );
  else {
    const gruppen = plan.gruppen.filter(
      (g) => !ansicht.ausgeblendeteGruppen.includes(schluessel(g)),
    );
    // Vorgabe beim ersten Anzeigen: was man nicht plant, ist zugeklappt.
    const zugeklappt = zu ?? new Set(plan.gruppen.filter((g) => !g.planbar).map(schluessel));
    const umschalten = (k: string) => {
      const neu = new Set(zugeklappt);
      if (neu.has(k)) neu.delete(k);
      else neu.add(k);
      setZu(neu);
    };
    const haupt = arten[0] !== undefined && arten[0] !== WEITERE ? arten[0] : null;
    const sicht: Sicht = {
      plan,
      spalten: handy ? d.gefiltert : imFenster,
      gruppen,
      zugeklappt,
      neben: (s) => haupt !== null && s.name !== haupt,
      onUmschalten: umschalten,
      onFrei: (i, zl, nr) => setFrei(freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], nr)),
      onBelegt: (i, zl, nr) => setBelegt(freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], nr)),
      onPlaetze: (i, g) =>
        entwuerfe &&
        !plan.spalten[i].abgesagt &&
        g.zeilen.some((z) => darfPlanen(z, plan.spalten[i]))
          ? () => setPlaetzeFach({ spalte: i, gruppe: g })
          : undefined,
      entwurf: (i, zl, p) => entwurfAmPlatz(plan.spalten[i], zl, p),
      darfAendern,
      onEntwurf: (i, zl, nr) => {
        const plaetze = zl.zellen[i] ?? [];
        const p = plaetze[nr - 1];
        const a = p ? entwurfAmPlatz(plan.spalten[i], zl, p) : null;
        if (!p || !a) return;
        setFach({
          platz: freierPlatz(plan.spalten[i], zl, plaetze, nr),
          entwurf: a.entwurf,
          inChurchTools: a.veraltet ? stehtInChurchTools(p) : null,
        });
      },
      ichId: entwuerfe?.ich.personId ?? null,
    };
    inhalt =
      d.gefiltert.length === 0 || gruppen.length === 0 ? (
        hinweis(
          'Nichts eingeblendet – über „Filter“ eine Veranstaltung oder Gruppe wieder anhaken.',
        )
      ) : ansicht.unteransicht === 'personen' ? (
        <WerWieOft sicht={sicht} />
      ) : handy ? (
        <HandyPlan sicht={sicht} amEnde={kannNachladen ? () => nachladen('passend') : undefined} />
      ) : (
        <TabellenPlan sicht={sicht} breite={ansicht.breite} platz={platz} />
      );
  }

  /** ChurchTools hat sich geändert (gesendet, Plätze): die Termine neu – leise, ohne „wird geladen“. */
  const leiseNeuLaden = () => {
    if (bereich) {
      leiseNeu.current = true;
      setVersuch((v) => v + 1);
    } else onAktualisieren?.();
  };

  /**
   * Die Dienste einer Gruppe an einem Termin fürs Plätze-Fach – nur, wo man plant. Nicht unter „belegt“; liegen dort
   * Entwürfe, bleibt die Zahl, wie sie ist (ChurchTools nummeriert die Plätze dabei neu – gemessen 15.10.2026).
   */
  const plaetzeZeilen = (s: PlanSpalte, i: number, g: PlanGruppe): PlaetzeZeile[] =>
    g.zeilen
      .filter((zl) => darfPlanen(zl, s))
      .map((zl) => {
        const zelle = zl.zellen[i] ?? [];
        const belegtZahl = zelle.filter((p) => p.art !== 'frei').length;
        const entwuerfeHier = zelle.filter((p) => entwurfAmPlatz(s, zl, p) !== null).length;
        return {
          serviceId: zl.dienst.id,
          name: zl.dienst.name,
          anzahl: zelle.length,
          belegt: belegtZahl,
          entwuerfe: entwuerfeHier,
        };
      });

  /** Nach einer Änderung im Entwurfs-Fach: Ergebnis übernehmen, bei Erfolg schließen und Bescheid geben. */
  const nachFach = (r: EntwurfErgebnis, k: string, text: () => string) => {
    if (r.ok) {
      ewSetzen(k, r.entwurf);
      setFach(null);
      showToast(text());
    } else if (r.grund === 'konflikt') {
      // Was jetzt dasteht, zeigt auch die Matrix sofort.
      ewSetzen(k, r.jetzt ?? null);
    }
  };

  /** Ob und wie man an diesem Platz eintragen kann – aus Anschluss, Schublade und Rechten. */
  const eintragenFuer = (f: FreierPlatz): Eintragen | undefined => {
    if (!entwuerfe) return undefined;
    if (ew.art === 'laedt') return { art: 'laedt' };
    if (ew.art === 'fehler') return { art: 'gesperrt', text: ew.text, onNochmal: ewNeu };
    const daten = ew.daten;
    const s = daten.schubladen.get(f.gruppeId);
    if (!s) {
      return { art: 'gesperrt', text: 'Für diesen Dienst kannst du hier keine Entwürfe anlegen.' };
    }
    if (s.fehler) return { art: 'gesperrt', text: grundText(s.fehler), onNochmal: ewNeu };
    if (s.stand === 'einrichtbar') {
      return {
        art: 'einrichten',
        gruppe: s.gruppe.name,
        onEinrichten: async () => {
          await entwuerfe.einrichten(s.gruppe);
          ewNeu();
        },
      };
    }
    if (s.stand === 'fehlt') {
      return {
        art: 'gesperrt',
        text: `Für „${s.gruppe.name}“ gibt es noch keinen Platz für Entwürfe – oder dir fehlt das Recht, ihn zu sehen. Bitte die Gemeinde-Verwaltung fragen.`,
      };
    }
    if (s.stand === 'nur-lesen') {
      return {
        art: 'gesperrt',
        text: `Du darfst die Entwürfe von „${s.gruppe.name}“ ansehen, aber nicht ändern. Bitte die Gemeinde-Verwaltung nach dem Recht fragen.`,
      };
    }
    const ort = { eventId: f.eventId, serviceId: f.serviceId, index: f.index };
    return {
      art: 'bereit',
      erwartet: ersetzt,
      onWahl: async (ziel: Besetzung, erwartet: number | null): Promise<EntwurfErgebnis> => {
        // Ersetzt man einen Entwurf („Andere Person wählen“), bleibt „Beim Senden“ wie es war. „Gesehen“ ist, was
        // jetzt in ChurchTools steht – frei, oder die Person, die ersetzt wird (E4-5); bei einem gültigen Entwurf
        // ist das genau, was er gesehen hat (`gleicherStand`).
        const alt = erwartet !== null ? daten.entwuerfe.get(ortSchluessel(ort)) : undefined;
        const r = await entwuerfe.speichern(
          daten,
          f.gruppeId,
          {
            ort,
            ziel,
            modus: alt?.modus ?? 'anfrage',
            gesehen: f.bisher?.belegung ?? { art: 'frei' },
            von: entwuerfe.ich,
          },
          erwartet,
        );
        const k = ortSchluessel(ort);
        if (r.ok) {
          ewSetzen(k, r.entwurf);
          setFrei(null);
          setErsetzt(null);
          showToast(
            f.bisher
              ? `${ziel.name} statt ${f.bisher.name} eingetragen – noch nicht gesendet.`
              : `${ziel.name} eingetragen – noch nicht gesendet.`,
          );
        } else if (r.grund === 'konflikt') {
          // Was jetzt dasteht, zeigt auch die Matrix sofort.
          ewSetzen(k, r.jetzt ?? null);
        }
        return r;
      },
    };
  };

  // Die Leiste unten (E4-3-3): gültige Entwürfe im geladenen Zeitraum – veraltete werden nie gesendet.
  // Die Leiste unten und das Senden-Fach (E4-4): **eine** Regel für Zählen und Senden (Bauplan: „Zählen und
  // Senden aus derselben Regel“) – gültige Entwürfe im geladenen Zeitraum, wo man planen und die Schublade ändern
  // darf; nach Terminen geordnet.
  const sendbareZeilen = (): SendeZeile[] => {
    if (!plan || ew.art !== 'fertig') return [];
    const zeilen: SendeZeile[] = [];
    plan.spalten.forEach((spalte, i) => {
      for (const g of plan.gruppen) {
        for (const zl of g.zeilen) {
          if (!darfPlanen(zl, spalte) || !darfAendern(zl)) continue;
          const kategorie = ew.daten.schubladen.get(zl.dienst.dienstgruppeId ?? 0)?.kategorie;
          if (kategorie == null) continue;
          for (const p of zl.zellen[i] ?? []) {
            const a = entwurfAmPlatz(spalte, zl, p);
            if (!a || a.veraltet) continue;
            zeilen.push({
              entwurf: a.entwurf,
              kategorie,
              tag: spalte.tag,
              termin: spalte.name,
              dienst: zl.dienst.name,
              bisher: p.art === 'frei' || p.verborgen ? null : p.name,
            });
          }
        }
      }
    });
    return zeilen;
  };
  const offen = sendbareZeilen().length;

  const nachladeFehler = !bereich && zustand.art === 'fertig' ? zustand.nachladeFehler : undefined;
  return (
    <div className={styles.planen}>
      {werkzeug}
      {nachladeFehler && (
        <FehlerKasten fehler={nachladeFehler} onNochmal={() => nachladen('weiter')} />
      )}
      <div ref={rahmen}>{inhalt}</div>
      <p className={styles.hinweis}>
        Welche Dienste du siehst, entscheidet ChurchTools. Hier stehen nur Dienstgruppen, die du
        ganz sehen darfst – deine eigenen Dienste findest du immer unter Start und Termine. Planen
        darfst du, wo du die Dienstgruppe bearbeiten darfst, die Gruppe eines Dienstes leitest oder
        Admin des Termins bist. Einen freien Platz antippen zeigt, wer kann – dort trägst du
        jemanden als Entwurf ein. Einen belegten Platz antippen: zurückziehen oder durch jemand
        anderen ersetzen, ebenfalls als Entwurf. Der Regler in der Gruppenzeile ändert die Anzahl
        der Plätze – sofort. Gesendet wird erst mit „Ansehen und senden“ – dann bekommen die
        Angefragten eine Mitteilung von ChurchTools.
      </p>
      {fach && entwuerfe && ew.art === 'fertig' && (
        <EntwurfFach
          platz={fach.platz}
          entwurf={fach.entwurf}
          inChurchTools={fach.inChurchTools}
          onClose={() => setFach(null)}
          onModus={async (modus, erwartet) => {
            const e = fach.entwurf;
            const r = await entwuerfe.speichern(
              ew.daten,
              fach.platz.gruppeId,
              { ort: e.ort, ziel: e.ziel, modus, gesehen: e.gesehen, von: entwuerfe.ich },
              erwartet,
            );
            nachFach(r, ortSchluessel(e.ort), () =>
              modus === 'direkt'
                ? `${zielText(e.ziel)} wird beim Senden direkt zugeteilt.`
                : `${zielText(e.ziel)} bekommt beim Senden eine Anfrage.`,
            );
            return r;
          }}
          onEntfernen={async (erwartet) => {
            const e = fach.entwurf;
            const r = await entwuerfe.entfernen(ew.daten, fach.platz.gruppeId, e.ort, erwartet);
            nachFach(r, ortSchluessel(e.ort), () =>
              fach.inChurchTools !== null ? 'Entwurf verworfen.' : 'Entwurf entfernt.',
            );
            return r;
          }}
          onAnderePerson={() => {
            // „Wer kann?“ für denselben Platz – es ersetzt den Entwurf (mit seiner Version).
            setErsetzt(fach.entwurf.version);
            setFrei(fach.platz);
            setFach(null);
          }}
        />
      )}
      {frei && (
        <WerKann
          platz={frei}
          onClose={() => {
            setFrei(null);
            setErsetzt(null);
          }}
          eintragen={eintragenFuer(frei)}
        />
      )}
      {belegt?.bisher && entwuerfe && (
        <BelegtFach
          platz={{ ...belegt, bisher: belegt.bisher }}
          eintragen={eintragenFuer(belegt)}
          onClose={() => setBelegt(null)}
          onAnderePerson={() => {
            // „Wer kann?“ für denselben Platz – die Wahl ersetzt die Person, die dort steht.
            setFrei(belegt);
            setBelegt(null);
          }}
          onZurueckziehen={async () => {
            const b = belegt.bisher;
            if (!b) return { ok: false, grund: 'voruebergehend' };
            const ort = {
              eventId: belegt.eventId,
              serviceId: belegt.serviceId,
              index: belegt.index,
            };
            if (ew.art !== 'fertig') return { ok: false, grund: 'voruebergehend' };
            const r = await entwuerfe.speichern(
              ew.daten,
              belegt.gruppeId,
              {
                ort,
                ziel: { art: 'frei' },
                modus: 'anfrage',
                gesehen: b.belegung,
                von: entwuerfe.ich,
              },
              null,
            );
            const k = ortSchluessel(ort);
            if (r.ok) {
              ewSetzen(k, r.entwurf);
              setBelegt(null);
              showToast(`${b.name} wird beim Senden zurückgezogen – noch nicht gesendet.`);
            } else if (r.grund === 'konflikt') ewSetzen(k, r.jetzt ?? null);
            return r;
          }}
        />
      )}
      {offen > 0 && (
        <div className={styles.sendeLeiste} role="status" aria-label="Noch nicht gesendet">
          {/* Am Handy kürzer, wie im Entwurf (Abschnitt 6) – sonst bricht alles um. */}
          <span>
            {offen} {offen === 1 ? 'Entwurf' : 'Entwürfe'}
            {handy ? '' : ' noch nicht gesendet'}
          </span>
          <button
            type="button"
            className={styles.sendenKnopf}
            onClick={() => setSendenListe(sendbareZeilen())}
          >
            {handy ? 'Ansehen & senden' : 'Ansehen und senden'}
          </button>
        </div>
      )}
      {sendenListe && entwuerfe && ew.art === 'fertig' && (
        <SendenFach
          zeilen={sendenListe}
          ichId={entwuerfe.ich.personId}
          hinweise={(z) => entwuerfe.hinweise(z)}
          senden={(eintraege, melde) => entwuerfe.senden(ew.daten, eintraege, melde)}
          onClose={(gesendet) => {
            setSendenListe(null);
            if (gesendet) {
              ewNeu();
              leiseNeuLaden();
            }
          }}
        />
      )}
      {plaetzeFach && entwuerfe && plan && (
        <PlaetzeFach
          titel={`${gruppenName(plaetzeFach.gruppe)} · Plätze`}
          unter={`${plan.spalten[plaetzeFach.spalte].name} · ${tagKurz(plan.spalten[plaetzeFach.spalte].tag)}`}
          zeilen={plaetzeZeilen(
            plan.spalten[plaetzeFach.spalte],
            plaetzeFach.spalte,
            plaetzeFach.gruppe,
          )}
          aendern={(z, gesehen, neu) =>
            entwuerfe.anzahl(plan.spalten[plaetzeFach.spalte].id, z.serviceId, gesehen, neu)
          }
          onGespeichert={showToast}
          onClose={(geaendert) => {
            setPlaetzeFach(null);
            if (geaendert) leiseNeuLaden();
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

/** Gefilterte Spalten und wie viele „passend“ ins Fenster gehen – für Anzeige und Nachladen gleich. */
function fensterDaten(plan: Plan, ansicht: PlanenAnsicht, platz: number) {
  const arten = veranstaltungsArten(plan.spalten);
  const gefiltert = plan.spalten
    .map((_, i) => i)
    .filter((i) => !ansicht.ausgeblendeteArten.includes(artVon(plan.spalten[i], arten)));
  return { gefiltert, passend: passendeAnzahl(platz, ansicht.breite, gefiltert.length) };
}

/**
 * Die Terminleiste: ‹ ＋ [Zeitraum] ＋ › bei „ab heute“, ‹ [Zeitraum] › bei gewähltem Bereich. Am Handy nur
 * Knopf und ‹ › für einen gewählten Bereich – geblättert wird dort in der Datumsleiste.
 */
function Terminleiste({
  knopf,
  bereich,
  handy,
  davor,
  danach,
  onSchritt,
  onVerschieben,
}: {
  knopf: ReactNode;
  bereich: boolean;
  handy: boolean;
  davor: boolean;
  danach: boolean;
  onSchritt: (was: FensterSchritt) => void;
  onVerschieben: (richtung: 1 | -1) => void;
}) {
  const pfeil = (richtung: 1 | -1, aktiv: boolean) => (
    <button
      type="button"
      className={styles.leistenKnopf}
      disabled={!aktiv}
      aria-label={
        bereich
          ? richtung < 0
            ? 'Zeitraum davor'
            : 'Zeitraum danach'
          : richtung < 0
            ? 'Einen Termin zurück'
            : 'Einen Termin weiter'
      }
      onClick={() =>
        bereich ? onVerschieben(richtung) : onSchritt(richtung < 0 ? 'zurueck' : 'weiter')
      }
    >
      <Icon name={richtung < 0 ? 'chev-left' : 'chev-right'} size={16} />
    </button>
  );
  const dazu = (was: 'frueherDazu' | 'spaeterDazu', aktiv: boolean) => (
    <button
      type="button"
      className={styles.leistenKnopf}
      disabled={!aktiv}
      aria-label={
        was === 'frueherDazu' ? 'Früheren Termin dazunehmen' : 'Späteren Termin dazunehmen'
      }
      onClick={() => onSchritt(was)}
    >
      <Icon name="plus" size={16} />
    </button>
  );
  const blaettern = !handy || bereich;
  return (
    <div
      className={`${styles.leiste}${handy ? ' ' + styles.leisteHandy : ''}`}
      role="group"
      aria-label="Zeitraum"
    >
      {blaettern && pfeil(-1, davor)}
      {!bereich && !handy && dazu('frueherDazu', davor)}
      {knopf}
      {!bereich && !handy && dazu('spaeterDazu', danach)}
      {blaettern && pfeil(1, danach)}
    </div>
  );
}

function standText(s: PlanSpalte): { text: string; offen: boolean } {
  if (s.abgesagt) return { text: 'abgesagt', offen: false };
  const frei = s.plaetze - s.besetzt;
  return frei > 0 ? { text: `${frei} frei`, offen: true } : { text: 'alles besetzt', offen: false };
}

function GruppenStand({ frei }: { frei: number | null }) {
  if (frei === null) return <span className={`${styles.gruppenStand} ${styles.nichts}`}>—</span>;
  return frei > 0 ? (
    <span className={styles.gruppenStand}>{frei} frei</span>
  ) : (
    <span className={`${styles.gruppenStand} ${styles.besetzt}`} aria-label="alles besetzt">
      <Icon name="check" size={14} />
    </span>
  );
}

/** Regler in der Gruppenzeile (E4-5-3, wie im Gesamtentwurf) – nur, wo man einen Dienst der Gruppe plant. */
function ReglerKnopf({ onKlick, text }: { onKlick?: () => void; text: string }) {
  if (!onKlick) return null;
  return (
    <button
      type="button"
      className={styles.regler}
      onClick={onKlick}
      aria-label={text}
      title={text}
    >
      <Icon name="regler" size={14} />
    </button>
  );
}

function GruppenKnopf({
  g,
  offen,
  onUmschalten,
}: {
  g: PlanGruppe;
  offen: boolean;
  onUmschalten: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.gruppenKnopf}
      aria-expanded={offen}
      onClick={onUmschalten}
    >
      <span className={styles.chev}>
        <Icon name="chev-down" size={16} />
      </span>
      {gruppenName(g)}
      {g.planbar && <span className={styles.duPlanst}>du planst</span>}
    </button>
  );
}

function TabellenPlan({ sicht, breite, platz }: { sicht: Sicht; breite: Breite; platz: number }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  // Wenige Spalten füllen die Breite (wie im Entwurf), sonst gilt die gewählte Spaltenbreite.
  const cw = Math.max(
    SPALTENBREITE[breite],
    platz > 0 ? Math.floor((platz - DIENST_SPALTE - 2) / Math.max(1, spalten.length)) : 0,
  );
  const zelleKlasse = (s: PlanSpalte) =>
    `${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}${neben(s) ? ' ' + styles.neben : ''}`;
  return (
    <div className={styles.rahmen}>
      {/* Feste Breiten: Sonst dehnt der Inhalt die Spalten, und „passend“ passt nicht mehr – dann rutscht
          der erste Termin beim Wischen unter die Dienst-Spalte (Alwin, 14.10.2026). */}
      <table
        className={styles.plan}
        style={{ ['--cw' as string]: `${cw}px`, width: DIENST_SPALTE + spalten.length * cw }}
      >
        <thead>
          <tr>
            <th className={`${styles.svc} ${styles.svcKopf}`} scope="col">
              Dienst
            </th>
            {spalten.map((i) => {
              const s = plan.spalten[i];
              const k = kachel(s.tag);
              const st = standText(s);
              return (
                <th
                  key={s.id}
                  scope="col"
                  className={`${styles.kopf}${zelleKlasse(s)}`}
                  data-neben={neben(s) || undefined}
                >
                  <div className={styles.kopfDatum}>
                    <DatumKachel tag={k.tag} monat={k.monat} />
                    <small>
                      {tagKurz(s.tag).slice(0, 2)} · {s.uhrzeit}
                    </small>
                  </div>
                  <span className={styles.kopfName} title={s.name}>
                    {s.name}
                  </span>
                  <div className={styles.fuellung} aria-hidden="true">
                    <i
                      style={{
                        width: `${s.plaetze ? Math.round((s.besetzt / s.plaetze) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className={`${styles.stand}${st.offen ? ' ' + styles.offen : ''}`}>
                    {st.text}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {gruppen.map((g) => {
            const k = schluessel(g);
            const offen = !zugeklappt.has(k);
            return [
              <tr key={`g-${k}`} className={styles.gruppe}>
                <th className={styles.svc} style={{ padding: 0 }} scope="row">
                  <GruppenKnopf g={g} offen={offen} onUmschalten={() => onUmschalten(k)} />
                </th>
                {spalten.map((i) => (
                  <td key={i}>
                    <div className={styles.gruppenZelle}>
                      <GruppenStand frei={g.frei[i]} />
                      <ReglerKnopf
                        onKlick={sicht.onPlaetze(i, g)}
                        text={`Plätze ${gruppenName(g)} am ${tagKurz(plan.spalten[i].tag)} ändern`}
                      />
                    </div>
                  </td>
                ))}
              </tr>,
              ...(offen
                ? g.zeilen.map((z) => (
                    <tr key={`d-${z.dienst.id}`}>
                      <th className={styles.svc} scope="row">
                        <b>{z.dienst.name}</b>
                      </th>
                      {spalten.map((i) => {
                        const zelle = z.zellen[i];
                        return (
                          <td key={i} className={`${styles.zelle}${zelleKlasse(plan.spalten[i])}`}>
                            {zelle === null ? (
                              <span className={styles.na} aria-label="nicht vorgesehen">
                                –
                              </span>
                            ) : (
                              <Plaetze
                                plaetze={zelle}
                                onFrei={
                                  darfPlanen(z, plan.spalten[i])
                                    ? (nr) => sicht.onFrei(i, z, nr)
                                    : undefined
                                }
                                entwurf={(p) => sicht.entwurf(i, z, p)}
                                onBelegt={
                                  darfPlanen(z, plan.spalten[i])
                                    ? (nr) => sicht.onBelegt(i, z, nr)
                                    : undefined
                                }
                                onEntwurf={
                                  darfPlanen(z, plan.spalten[i]) && sicht.darfAendern(z)
                                    ? (nr) => sicht.onEntwurf(i, z, nr)
                                    : undefined
                                }
                                ichId={sicht.ichId}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function HandyPlan({ sicht, amEnde }: { sicht: Sicht; amEnde?: () => void }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const id =
    gewaehlt !== null && spalten.some((i) => plan.spalten[i].id === gewaehlt) ? gewaehlt : null;
  const i = id === null ? spalten[0] : spalten.find((x) => plan.spalten[x].id === id)!;
  // Letzten Termin der Datumsleiste gewählt → weitere Wochen im Hintergrund nachladen (statt „Weitere
  // Termine laden“, 14.10.2026).
  const amLetzten = spalten.length > 1 && i === spalten[spalten.length - 1];
  useEffect(() => {
    if (amLetzten && amEnde) amEnde();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Erreichen des letzten Termins
  }, [amLetzten]);
  const s = plan.spalten[i];
  const k = kachel(s.tag);
  const st = standText(s);

  return (
    <div>
      <div className={styles.datumsleiste} role="group" aria-label="Termine">
        {spalten.map((x) => {
          const sx = plan.spalten[x];
          const stx = standText(sx);
          return (
            <button
              key={sx.id}
              type="button"
              className={`${styles.datumChip}${neben(sx) ? ' ' + styles.neben : ''}`}
              aria-pressed={sx.id === s.id}
              onClick={() => setGewaehlt(sx.id)}
            >
              <b>{tagKurz(sx.tag)}</b>
              <small>{sx.name}</small>
              <span className={stx.offen ? styles.chipStand : styles.chipBesetzt}>{stx.text}</span>
            </button>
          );
        })}
      </div>
      <section className={styles.karte} aria-label={`${s.name}, ${tagKurz(s.tag)}`}>
        <div className={styles.handyKopf}>
          <DatumKachel tag={k.tag} monat={k.monat} />
          <div>
            <b>{s.name}</b>
            <small>
              {tagKurz(s.tag)} · {s.uhrzeit} Uhr ·{' '}
              <span className={st.offen ? styles.offen : styles.besetzt}>{st.text}</span>
            </small>
          </div>
        </div>
        {gruppen.map((g) => {
          const dienste = g.zeilen.filter((z) => z.zellen[i] !== null);
          if (dienste.length === 0) return null;
          const gk = schluessel(g);
          const offen = !zugeklappt.has(gk);
          return (
            <div key={gk} className={styles.handyGruppe}>
              <div className={styles.handyGruppenKopf}>
                <GruppenKnopf g={g} offen={offen} onUmschalten={() => onUmschalten(gk)} />
                <GruppenStand frei={g.frei[i]} />
                <ReglerKnopf
                  onKlick={sicht.onPlaetze(i, g)}
                  text={`Plätze ${gruppenName(g)} am ${tagKurz(s.tag)} ändern`}
                />
              </div>
              {offen &&
                dienste.map((z) => (
                  <div key={z.dienst.id} className={styles.handyDienst}>
                    <span>{z.dienst.name}</span>
                    <Plaetze
                      plaetze={z.zellen[i]!}
                      onFrei={darfPlanen(z, s) ? (nr) => sicht.onFrei(i, z, nr) : undefined}
                      entwurf={(p) => sicht.entwurf(i, z, p)}
                      onBelegt={darfPlanen(z, s) ? (nr) => sicht.onBelegt(i, z, nr) : undefined}
                      onEntwurf={
                        darfPlanen(z, s) && sicht.darfAendern(z)
                          ? (nr) => sicht.onEntwurf(i, z, nr)
                          : undefined
                      }
                      ichId={sicht.ichId}
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/** „Wer wie oft?“ – Einsätze je Person im sichtbaren Zeitraum und in den sichtbaren Gruppen. */
function WerWieOft({ sicht }: { sicht: Sicht }) {
  const sichtbar = new Set(sicht.gruppen.map((g) => g.gruppe?.id ?? null));
  const { personen, schnitt } = werWieOft(sicht.plan, {
    spalten: sicht.spalten,
    gruppeSichtbar: (id) => sichtbar.has(id),
  });
  const meiste = Math.max(1, ...personen.map((p) => p.einsaetze.length));
  if (personen.length === 0) {
    return (
      <section className={styles.karte}>
        <p className={styles.hinweis} style={{ padding: 14 }}>
          In diesem Zeitraum ist noch niemand eingeteilt.
        </p>
      </section>
    );
  }
  return (
    <div className={styles.rahmen}>
      <table className={styles.personen}>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Dienste</th>
            <th scope="col">Einsätze (Ø {schnitt.toFixed(1).replace('.', ',')})</th>
            <th scope="col">Wann</th>
          </tr>
        </thead>
        <tbody>
          {personen.map((p) => (
            <tr key={`${p.gast ? 'g' : 'p'}${p.name}`}>
              <th scope="row">
                {p.name}
                {p.gast && <span className={styles.gast}>Gast</span>}
              </th>
              <td>
                {p.dienste.map((d) => (
                  <span key={d} className={styles.etikett}>
                    {d}
                  </span>
                ))}
              </td>
              <td>
                <span className={styles.anzahl}>
                  {p.einsaetze.length}
                  <i style={{ width: `${Math.round((p.einsaetze.length / meiste) * 120)}px` }} />
                </span>
              </td>
              <td>
                {p.einsaetze.map((e, i) => (
                  <span key={i} className={styles.etikett}>
                    {tagKurz(e.spalte.tag)} {e.dienst}
                    {!e.zugesagt && ' ?'}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Plaetze({
  plaetze,
  onFrei,
  entwurf,
  onEntwurf,
  onBelegt,
  ichId = null,
}: {
  plaetze: PlanPlatz[];
  /** Nur wo man planen darf: freier Platz wird ein Knopf (Platz 1 … n). */
  onFrei?: (nr: number) => void;
  /** Nur wo man planen darf: ein belegter Platz (ohne Entwurf, Name sichtbar) wird ein Knopf (E4-5). */
  onBelegt?: (nr: number) => void;
  /** Der Entwurf an einem Platz (E4-3) – gültig steht er statt „frei“ da, veraltet als Schild darunter. */
  entwurf?: (p: PlanPlatz) => EntwurfAmPlatz | null;
  /** Entwurf bzw. Schild antippen → Entwurfs-Fach (nur wo man planen und ändern darf). */
  onEntwurf?: (nr: number) => void;
  ichId?: number | null;
}) {
  return (
    <div className={styles.plaetze}>
      {plaetze.map((p, i) => {
        const a = entwurf?.(p) ?? null;
        const oeffnen = onEntwurf ? () => onEntwurf(i + 1) : undefined;
        if (a && !a.veraltet) {
          return (
            <EntwurfPlatz
              key={i}
              e={a.entwurf}
              bisher={p.art === 'frei' || p.verborgen ? null : p.name}
              eigener={a.entwurf.von.personId === ichId}
              onOeffnen={oeffnen}
            />
          );
        }
        const platz =
          p.art === 'frei' && onFrei ? (
            <button
              type="button"
              className={`${styles.platz} ${styles.frei} ${styles.freiKnopf}`}
              onClick={() => onFrei(i + 1)}
              aria-label={`frei – Wer kann? (Platz ${i + 1} von ${plaetze.length})`}
            >
              frei
            </button>
          ) : p.art !== 'frei' && !p.verborgen && !a && onBelegt ? (
            <Platz p={p} onAntippen={() => onBelegt(i + 1)} />
          ) : (
            <Platz p={p} />
          );
        if (!a) return <Fragment key={i}>{platz}</Fragment>;
        // Veraltet: ChurchTools gilt – darunter ein Schild, das zum Entwurf führt (Alwin, 14.10.2026).
        const text = `Entwurf veraltet: „${zielText(a.entwurf.ziel)}“ von ${a.entwurf.von.name}`;
        return (
          <Fragment key={i}>
            {platz}
            {oeffnen ? (
              <button
                type="button"
                className={`${styles.veraltet} ${styles.veraltetKnopf}`}
                onClick={oeffnen}
                aria-label={text}
              >
                <Icon name="pencil" size={10} /> Entwurf veraltet
              </button>
            ) : (
              <span className={styles.veraltet} title={text}>
                <Icon name="pencil" size={10} /> Entwurf veraltet
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Was jetzt in ChurchTools am Platz steht – für das Fach eines veralteten Entwurfs. */
function stehtInChurchTools(p: PlanPlatz): string {
  if (p.art === 'frei') return 'Der Platz ist dort wieder frei.';
  if (p.verborgen) return 'Dort ist jemand eingetragen (Name nicht sichtbar).';
  if (p.gast) return `${p.name} steht dort als Gast.`;
  return p.art === 'zugesagt' ? `${p.name} hat dort zugesagt.` : `${p.name} ist dort angefragt.`;
}

/** Ein Entwurf – noch nicht gesendet: gestrichelt mit Stift, „von …“ wenn von jemand anderem (E4-3). */
function EntwurfPlatz({
  e,
  bisher,
  eigener,
  onOeffnen,
}: {
  e: Entwurf;
  /** Wer in ChurchTools dort steht (E4-5): wird zurückgezogen bzw. ersetzt. */
  bisher: string | null;
  eigener: boolean;
  /** Antippen öffnet das Entwurfs-Fach (E4-3-3) – nur wo man ändern darf. */
  onOeffnen?: () => void;
}) {
  const gast = e.ziel.art === 'gast';
  // Zurückziehen (rot, der Name durchgestrichen) oder Ersetzen („Neu statt Alt“) – Entwurf Abschnitt 2.
  const zurueck = e.ziel.art === 'frei';
  const statt = !zurueck && e.gesehen.art !== 'frei' ? bisher : null;
  const was = zurueck
    ? `${bisher ?? 'Einteilung'} zurückziehen`
    : `${zielText(e.ziel)}${gast ? ' (Gast)' : ''}${statt ? ` statt ${statt}` : ''}`;
  const Tag = onOeffnen ? 'button' : 'span';
  return (
    <Tag
      {...(onOeffnen
        ? {
            type: 'button' as const,
            onClick: onOeffnen,
            'aria-label': `Entwurf von ${e.von.name}: ${was}`,
          }
        : {})}
      className={`${styles.platz} ${zurueck ? styles.zurueck : styles.entwurf}${onOeffnen ? ' ' + styles.entwurfKnopf : ''}`}
      title={
        zurueck
          ? `Wird zurückgezogen – Entwurf von ${e.von.name}, noch nicht gesendet`
          : `Entwurf von ${e.von.name} – noch nicht gesendet`
      }
    >
      <span className={styles.ic} aria-label="Entwurf, noch nicht gesendet">
        {zurueck ? '−' : <Icon name="pencil" size={11} />}
      </span>
      {zurueck ? (
        // Kein Textschild: In schmalen Spalten bliebe vom Namen sonst nur ein Buchstabe (Browser-Check 15.10.) –
        // rot, „−“ und durchgestrichen sagen „kommt weg“, der Vorleser sagt es über `aria-label`.
        <span className={`${styles.name} ${styles.durch}`}>{bisher ?? 'Einteilung'}</span>
      ) : (
        <span className={styles.name}>
          {zielText(e.ziel)}
          {statt && <span className={styles.statt}> statt {statt}</span>}
        </span>
      )}
      {gast && <span className={styles.gast}>Gast</span>}
      {!gast && e.modus === 'direkt' && <span className={styles.direkt}>direkt</span>}
      {!eigener && <span className={styles.von}>{e.von.name}</span>}
    </Tag>
  );
}

/** Ein Platz – zugesagt (Haken), angefragt („?“), frei, verborgen oder Gast. */
function Platz({ p, onAntippen }: { p: PlanPlatz; onAntippen?: () => void }) {
  if (p.art === 'frei') return <span className={`${styles.platz} ${styles.frei}`}>frei</span>;
  const stand = p.art === 'zugesagt' ? 'zugesagt' : 'angefragt';
  // Antippbar (E4-5): zurückziehen oder ersetzen – ein Knopf mit demselben Aussehen.
  const Tag = onAntippen ? 'button' : 'span';
  return (
    <Tag
      {...(onAntippen
        ? {
            type: 'button' as const,
            onClick: onAntippen,
            'aria-label': `${p.name ?? ''}${p.gast ? ' (Gast)' : ''} – ${stand}: zurückziehen oder ersetzen`,
          }
        : {})}
      className={`${styles.platz} ${styles[p.art]}${p.ich ? ' ' + styles.ich : ''}${onAntippen ? ' ' + styles.belegtKnopf : ''}`}
      title={stand}
    >
      <span className={styles.ic} aria-label={p.art}>
        {p.art === 'zugesagt' ? <Icon name="check" size={11} /> : '?'}
      </span>
      {p.verborgen ? (
        <span className={`${styles.name} ${styles.leise}`}>Nicht sichtbar</span>
      ) : (
        <span className={styles.name}>{p.name}</span>
      )}
      {p.gast && <span className={styles.gast}>Gast</span>}
    </Tag>
  );
}
