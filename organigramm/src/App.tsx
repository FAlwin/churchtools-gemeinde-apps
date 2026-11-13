import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ApiError } from '@ui/ct/fehler';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { baumOhneTypen, knotenNachId, type Knoten } from '@shared/organigramm/gruppen';
import { bereicheSortiert, praesentationAus } from '@shared/organigramm/praesentation';
import {
  alleAuf,
  alleZu,
  anfangsOffen,
  knotenAmPfad,
  pfadVon,
  sichtbarerBaum,
} from '@shared/organigramm/ansichten';
import { hatBereich, personenImBereich, sichtbereich } from '@shared/organigramm/sichtbereich';
import { hinweiseAus } from '@shared/organigramm/hinweise';
import type { Mitglied } from '@shared/organigramm/mitglieder';
import { rollenZurWahl, type PersonenWahl } from '@shared/organigramm/personen';
import { ladeStart, type Start } from './start';
import {
  fehlendeNachladen,
  gruppenNachladen,
  ladeMitglieder,
  neueGruppenNachladen,
  type MitgliederDaten,
} from './ladeMitglieder';
import { ladeEinsaetze, type EinsaetzeStand } from './ladeEinsaetze';
import { Organigramm } from './Organigramm';
import { GruppenFenster } from './GruppenFenster';
import { Personen } from './Personen';
import { PersonFenster } from './PersonFenster';
import { Hinweise } from './Hinweise';
import { Praesentation, type Stand } from './Praesentation';
import { ladePlan } from './plan';
import { planAlsBaum, planBaum, planGruppen, type PlanAenderungen } from '@shared/organigramm/plan';
import { NeueGliederung } from './NeueGliederung';
import { ladeSichtbarkeit } from './sichtbarkeitSpeicher';
import { EinstellungenFenster } from './EinstellungenFenster';
import { ALLES_SICHTBAR, type Sichtbarkeit } from '@shared/organigramm/sichtbarkeit';
import type { Versioniert } from '@shared/ct/versionierterWert';
import { PdfFenster } from './PdfFenster';
import { KinderJugend } from './KinderJugend';
import { ladeEinrichtung } from './gruppenwechselSpeicher';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { kjZugang } from '@shared/organigramm/gruppenwechselSicht';
import type { RollenFilter } from './kastenPersonen';
import {
  leseAnsicht,
  lesePersonen,
  leseRollenAus,
  merkeAnsicht,
  merkePersonen,
  merkeRollenAus,
  type BaumAnsicht,
} from './auswahl';

type Ansicht = 'organigramm' | 'personen' | 'hinweise' | 'kinder' | 'gliederung';
/**
 * Die Reiter: „Kinder & Jugend“ (O9-2) nur für Leitungen der Stufen, Bereichsleitung und Admins; der Plan „neue
 * Gliederung“ (O7) nur für Gruppen-Admins (Alwin, 24.10.2026). Personen und Hinweise nur mit eigenem Bereich.
 */
function reiterFuer(bereich: boolean, kinder: boolean, admin: boolean): Reiter<Ansicht>[] {
  const r: Reiter<Ansicht>[] = [{ id: 'organigramm', label: 'Organigramm', icon: 'grid' }];
  if (bereich) {
    r.push({ id: 'personen', label: 'Personen', icon: 'people' });
    r.push({ id: 'hinweise', label: 'Hinweise', icon: 'info' });
  }
  if (kinder) r.push({ id: 'kinder', label: 'Kinder & Jugend', icon: 'people' });
  if (admin) r.push({ id: 'gliederung', label: 'Neue Gliederung', icon: 'pencil' });
  return r;
}
/** Die Ansicht aus der Adresse – nur eine, die es für diese Person als Reiter gibt. */
const ansichtAusAdresse = (hash: string, reiter: readonly Reiter<Ansicht>[]): Ansicht =>
  reiter.find((r) => r.id !== 'organigramm' && hash === `#${r.id}`)?.id ?? 'organigramm';

/** Was für alle ausgeblendet ist – bis es geladen ist, und wenn es sich gerade nicht lesen lässt. */
type ZentralStand =
  | { art: 'laedt' }
  | { art: 'da'; stand: Versioniert<Sichtbarkeit> | null }
  | { art: 'fehler' };

/** Ein offenes Fenster des Organigramms – Gruppe oder Person (für den Verlauf von „‹“). */
type OffenesFenster = { art: 'gruppe' | 'person'; id: number };

/**
 * Das Organigramm in ChurchTools (Bauplan O2/O3): erst Gruppen und Baum (schnell), dann – nebeneinander – die
 * Mitglieder aller Gruppen (gedrosselt) und die Termine mit den Einsätzen. Der Baum steht schon, während beides lädt.
 * Personen und Hinweise gibt es nur für den eigenen Bereich (`sichtbereich`); wer nichts leitet und kein Admin ist,
 * sieht nur das Organigramm – ohne Reiter. Die Präsentation (O4) gibt es für alle; sie blendet dieselben
 * Gruppentypen aus wie der Baum (Alwin, 22.10.2026) – deshalb liegt diese Wahl hier und nicht im Baum. Gruppen-Admins
 * mit einem Plan präsentieren auch die „Neue Gliederung“ (O7-4). Was Gruppen-Admins für alle ausgeblendet haben (O7b-7),
 * kommt zusammen mit dem Start – der Baum erscheint erst, wenn auch das feststeht.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [mitglieder, setMitglieder] = useState<MitgliederDaten | null>(null);
  const [einsaetze, setEinsaetze] = useState<EinsaetzeStand>({ art: 'laedt' });
  const [offeneGruppe, setOffeneGruppe] = useState<number | null>(null);
  const [offenePerson, setOffenePerson] = useState<number | null>(null);
  /** Die Fenster davor, für „‹“ (02.11.2026, siehe `ausFensterGruppe`). */
  const [verlauf, setVerlauf] = useState<OffenesFenster[]>([]);
  // Was das Organigramm für alle zeigt (O7b-7) – von Gruppen-Admins eingestellt, im Speicher der Erweiterung.
  const [zentral, setZentral] = useState<ZentralStand>({ art: 'laedt' });
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [praesentiert, setPraesentiert] = useState(false);
  // Präsentation „Neue Gliederung | Heute“ (O7-4): der Plan, frisch beim Öffnen gelesen – nur für Gruppen-Admins.
  const [praesPlan, setPraesPlan] = useState<PlanAenderungen | null>(null);
  const [praesStand, setPraesStand] = useState<Stand>('heute');
  const [hash, setHash] = useState(() => window.location.hash);
  const handy = useMedienAbfrage(HANDY_BREITE);
  // Ansichten des Baums (O7b): gewählt und im Gerät gemerkt – ohne Wahl am Handy die Liste, sonst von oben (Alwin,
  // 26.10.2026).
  const [gewaehlt, setGewaehlt] = useState(leseAnsicht);
  // Personen in Diagramm und Liste (O7b-6): ohne Wahl „Aus“, je Gerät gemerkt.
  const [personenWahl, setPersonenWahl] = useState(lesePersonen);
  // „Welche Rollen“ (#915): die abgewählten Rollennamen, je Gerät gemerkt – für Reiter und Präsentation dieselben.
  const [rollenAus, setRollenAus] = useState(leseRollenAus);
  const baumAnsicht: BaumAnsicht = gewaehlt ?? (handy ? 'liste' : 'oben');
  const [spitze, setSpitze] = useState<string | null>(null);
  // `null`, solange niemand etwas auf- oder zugeklappt hat: dann gilt der Anfang (Gemeinde und Bereiche offen) – auch
  // für Bereiche, die erst wieder auftauchen, wenn Gruppen-Admins sie einblenden.
  const [offenWahl, setOffenWahl] = useState<Set<string> | null>(null);
  // Organigramm als PDF (O7b-4) – übernimmt Ansicht, Spitze und Aufgeklapptes vom Reiter.
  const [pdfOffen, setPdfOffen] = useState(false);
  // Gruppenwechsel der Kinder (O9-2): die Einrichtung aus dem Speicher. Ohne sie – nicht eingerichtet, kein Leserecht
  // oder gerade nicht lesbar – gibt es den Reiter „Kinder & Jugend“ nicht; nichts geht dabei verloren.
  const [einrichtung, setEinrichtung] = useState<Einrichtung | null>(null);

  const abgemeldetOderFehler = useCallback(
    (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    [],
  );

  const einsaetzeLaden = useCallback(() => {
    setEinsaetze({ art: 'laedt' });
    ladeEinsaetze().then(
      (x) => setEinsaetze({ art: 'fertig', einsaetze: x }),
      (e: unknown) => {
        // Abgemeldet gilt für alles; jeder andere Fehler ist vorübergehend und betrifft nur die Einsätze.
        if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
        else setEinsaetze({ art: 'fehler' });
      },
    );
  }, [abgemeldetOderFehler]);

  const zentralLaden = useCallback(
    () =>
      ladeSichtbarkeit()
        .catch(() => ({ ok: false as const, grund: 'voruebergehend' as const }))
        .then((r) =>
          setZentral(
            r.ok
              ? { art: 'da', stand: r.daten }
              : // Ohne Leserecht gilt für diese Person nichts davon – kein Hinweis, der bei allen ohne Recht leuchtet.
                r.grund === 'kein-recht'
                ? { art: 'da', stand: null }
                : { art: 'fehler' },
          ),
        ),
    [],
  );

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    // Beides zugleich – und erst zeigen, wenn auch feststeht, was für alle ausgeblendet ist: sonst blitzten diese
    // Gruppen kurz auf. Lässt es sich gerade nicht lesen, gilt „alles sichtbar“ mit Hinweis (vorübergehend ist nicht
    // „nichts ausgeblendet“ – es wird nichts gespeichert, und „Erneut versuchen“ holt es nach).
    Promise.all([ladeStart(), zentralLaden()]).then(([s]) => {
      setStart(s);
      setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      setMitglieder(null);
      ladeMitglieder(s.gruppen.map((g) => g.id)).then(setMitglieder, abgemeldetOderFehler);
      einsaetzeLaden();
      ladeEinrichtung().then(
        (r) => setEinrichtung(r.ok ? (r.daten?.inhalt ?? null) : null),
        () => setEinrichtung(null),
      );
    }, abgemeldetOderFehler);
  }, [abgemeldetOderFehler, einsaetzeLaden, zentralLaden]);

  useEffect(laden, [laden]);

  useEffect(() => {
    const folgen = () => setHash(window.location.hash);
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const nachladen = useCallback(() => {
    if (!mitglieder) return;
    fehlendeNachladen(mitglieder).then(setMitglieder, abgemeldetOderFehler);
  }, [mitglieder, abgemeldetOderFehler]);

  // Nach einer Änderung an der Struktur (O5): Gruppen und Hierarchie neu, Mitglieder nur für neue Gruppen. Ein
  // vorübergehender Fehler lässt den bisherigen Stand stehen („vorübergehend ist nicht ungültig“) – nur „abgemeldet“
  // gilt für die ganze Seite.
  const strukturNeu = useCallback(async (): Promise<boolean> => {
    try {
      const s = await ladeStart();
      setStart(s);
      if (mitglieder) {
        setMitglieder(
          await neueGruppenNachladen(
            mitglieder,
            s.gruppen.map((g) => g.id),
          ),
        );
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
      return false;
    }
  }, [mitglieder, abgemeldetOderFehler]);

  // Nach einer Änderung an den Mitgliedern einer Gruppe (O6): nur diese Gruppe neu – über dieselbe Stelle wie das
  // Nachladen gescheiterter Gruppen. Vorübergehende Fehler landen als „nicht ladbar“ bei der Gruppe (wie in O2).
  const mitgliederNeu = useCallback(
    async (gruppeId: number): Promise<boolean> => {
      if (!mitglieder) return false;
      try {
        setMitglieder(await gruppenNachladen(mitglieder, [gruppeId]));
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
        return false;
      }
    },
    [mitglieder, abgemeldetOderFehler],
  );

  const knoten = useMemo(
    () => (start ? knotenNachId(start.baum) : new Map<number, Knoten>()),
    [start],
  );
  const bereich = useMemo(
    () =>
      start
        ? sichtbereich(start.baum, start.geleitet, start.rechte.gruppenVerwalten)
        : new Set<number>(),
    [start],
  );
  const zeigtMehr = !!start && hatBereich(bereich);
  // Der Baum, wie Karten, Liste und „Hier anfangen“ ihn sehen: ohne ausgeblendete Typen, große Bereiche zuerst –
  // dieselbe Reihenfolge wie in der Präsentation.
  const fuerAlle =
    zentral.art === 'da' ? (zentral.stand?.inhalt ?? ALLES_SICHTBAR) : ALLES_SICHTBAR;
  // Ausgeblendet ist, was Gruppen-Admins für alle ausgeblendet haben (O7b-7). Eigene Typ-Schildchen je Gerät gibt es
  // nicht mehr (30.10.2026): Ein Typ ging samt allem darunter – oben stehen meist Dienstbereiche, dann war alles weg.
  const typenAus = useMemo(() => new Set(fuerAlle.typen), [fuerAlle]);
  const gruppenAus = useMemo(() => new Set(fuerAlle.gruppen), [fuerAlle]);
  const sichtBaum = useMemo(
    () => (start ? bereicheSortiert(baumOhneTypen(start.baum, typenAus, gruppenAus)) : []),
    [start, typenAus, gruppenAus],
  );
  // Eine Spitze, die es nicht mehr gibt (für alle ausgeblendet, Änderung in ChurchTools), wird vergessen – sonst spränge
  // die Ansicht zurück, sobald die Gruppe wieder auftaucht. Das geschieht noch beim Zeichnen, nicht in einem Effekt
  // danach: Ein zweiter Klick (damals Doppelklick auf ein Typ-Schildchen) kam sonst vor dem Effekt, und die Spitze blieb
  // (Test-Instanz 26.10.2026). React zeichnet dann gleich noch einmal, ohne das Bild mit der ungültigen Spitze zu zeigen.
  if (spitze !== null && !knotenAmPfad(sichtBaum, spitze)) setSpitze(null);
  const offen = useMemo(() => offenWahl ?? anfangsOffen(sichtBaum), [offenWahl, sichtBaum]);
  // Die Spitze der Diagramme ist die Gemeinde – ohne Namen aus ChurchTools heißt sie so.
  const gemeindeName = start?.gemeinde ?? 'Gemeinde';
  const sicht = useMemo(
    () => sichtbarerBaum(sichtBaum, gemeindeName, spitze, offen),
    [sichtBaum, gemeindeName, spitze, offen],
  );
  const umklappen = (schluessel: string) => {
    const neu = new Set(offen);
    if (neu.has(schluessel)) neu.delete(schluessel);
    else neu.add(schluessel);
    setOffenWahl(neu);
  };
  // Eine neue Spitze steht offen da – sonst sähe man nach der Wahl nur ein Kästchen.
  const spitzeSetzen = (pfad: string | null) => {
    setSpitze(pfad);
    if (pfad !== null && !offen.has(pfad)) setOffenWahl(new Set([...offen, pfad]));
  };
  const ansichtWaehlen = (a: BaumAnsicht) => {
    merkeAnsicht(a);
    setGewaehlt(a);
  };
  const personenWaehlen = (w: PersonenWahl) => {
    merkePersonen(w);
    setPersonenWahl(w);
  };
  const rollenWaehlen = (aus: Set<string>) => {
    merkeRollenAus(aus);
    setRollenAus(aus);
  };
  const admin = !!start?.rechte.gruppenVerwalten;
  const kinderZugang = useMemo(
    () => (start && einrichtung ? kjZugang(einrichtung, start.geleitet, admin) : null),
    [start, einrichtung, admin],
  );
  const reiter = reiterFuer(zeigtMehr, !!kinderZugang, admin);
  const zeigtReiter = reiter.length > 1;
  const ansicht: Ansicht = zeigtReiter ? ansichtAusAdresse(hash, reiter) : 'organigramm';

  // Lesbare Mitglieder und Anfragen – Grundlage für Personen, Hinweise und das Personenfenster.
  const lesbar = useMemo(() => {
    const m = new Map<number, Mitglied[]>();
    const a = new Map<number, Mitglied[]>();
    for (const [id, s] of mitglieder?.je ?? []) {
      if (s.art !== 'sichtbar') continue;
      m.set(id, s.mitglieder);
      a.set(id, s.angefragt);
    }
    return { mitglieder: m, angefragt: a };
  }, [mitglieder]);
  const rollenZumAnhaken = useMemo(
    () => (start ? rollenZurWahl(lesbar.mitglieder.values(), start.rollen) : []),
    [start, lesbar],
  );
  const rollenFilter: RollenFilter = {
    rollen: rollenZumAnhaken,
    aus: rollenAus,
    onAus: rollenWaehlen,
  };
  const personen = useMemo(() => personenImBereich(lesbar.mitglieder, bereich), [lesbar, bereich]);
  const praesentation = useMemo(() => {
    if (!praesentiert || !start || !mitglieder) return null;
    let baum = start.baum;
    let personen: ReadonlyMap<number, readonly Mitglied[]> = lesbar.mitglieder;
    if (praesStand === 'neu' && praesPlan) {
      const plan = planAlsBaum(
        planBaum(planGruppen({ gruppen: start.gruppen, eltern: start.eltern }, praesPlan)),
        start.gruppen,
      );
      baum = plan.baum;
      // Neue Gruppen haben (noch) niemanden – sichtbar leer, nicht „nicht sichtbar“.
      personen = new Map<number, readonly Mitglied[]>([
        ...lesbar.mitglieder,
        ...plan.neueIds.map((id): [number, readonly Mitglied[]] => [id, []]),
      ]);
    }
    return praesentationAus(
      baumOhneTypen(baum, typenAus, gruppenAus),
      personen,
      start.rollen,
      (id) => mitglieder.personen.get(id)?.name ?? '',
      rollenAus,
    );
  }, [
    praesentiert,
    start,
    mitglieder,
    lesbar,
    typenAus,
    gruppenAus,
    praesStand,
    praesPlan,
    rollenAus,
  ]);

  const praesentieren = () => {
    if (!start?.rechte.gruppenVerwalten) {
      setPraesPlan(null);
      setPraesStand('heute');
      setPraesentiert(true);
      return;
    }
    // Gibt es einen Plan, beginnt die Präsentation mit ihm (Entwurf 19.10.2026). Ist er gerade nicht lesbar, eben mit
    // „Heute“ – die Präsentation darf daran nicht scheitern.
    ladePlan().then(
      (r) => {
        const plan = r.ok ? (r.daten?.inhalt ?? null) : null;
        setPraesPlan(plan);
        setPraesStand(plan ? 'neu' : 'heute');
        setPraesentiert(true);
      },
      () => {
        setPraesPlan(null);
        setPraesStand('heute');
        setPraesentiert(true);
      },
    );
  };
  const hinweise = useMemo(
    () =>
      start && mitglieder
        ? hinweiseAus({
            ...lesbar,
            rollen: start.rollen,
            einsaetze: einsaetze.art === 'fertig' ? einsaetze.einsaetze : null,
            dienste: start.dienste,
            bereich,
          })
        : [],
    [start, mitglieder, lesbar, einsaetze, bereich],
  );

  const wechseln = (id: Ansicht) => {
    window.location.hash = id === 'organigramm' ? '' : id;
    setHash(window.location.hash);
  };
  const fertig = zustand.art === 'fertig';
  const oben =
    fertig && zeigtReiter && !handy ? (
      <Segment
        value={ansicht}
        options={reiter.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
        verbunden
      />
    ) : undefined;
  const unten =
    fertig && zeigtReiter && handy ? (
      <ReiterLeiste reiter={reiter} aktiv={ansicht} onWechsel={wechseln} />
    ) : undefined;

  const offenerKnoten = offeneGruppe === null ? undefined : knoten.get(offeneGruppe);
  // „Hier anfangen“ (O7b-2): nur für eine Gruppe mit Untergruppen, die im gefilterten Baum steht.
  const offenerPfad = offeneGruppe === null ? null : pfadVon(sichtBaum, offeneGruppe);
  const hierAnfangen =
    offenerPfad !== null && (knotenAmPfad(sichtBaum, offenerPfad)?.kinder.length ?? 0) > 0
      ? () => {
          spitzeSetzen(offenerPfad);
          setOffeneGruppe(null);
          wechseln('organigramm');
        }
      : undefined;
  // Personen gibt es nur im eigenen Bereich – eine Person außerhalb öffnet kein Fenster.
  const offenePersonImBereich = offenePerson === null ? undefined : personen.get(offenePerson);
  /**
   * **Ein Verlauf der Fenster** (Alwin, 02.11.2026: „Wechselt ein Screen im Fenster, soll es einen Zurück-Pfeil
   * geben“): Aus einer Person geht es in eine Gruppe, von dort in die Obergruppe, eine Untergruppe … „‹“ führt jeweils
   * einen Schritt zurück, das X schließt. Wer ein Fenster aus der Seite heraus öffnet (Baum, Liste, Hinweise), fängt
   * neu an.
   */
  const zeigen = (o: OffenesFenster | null) => {
    setOffeneGruppe(o?.art === 'gruppe' ? o.id : null);
    setOffenePerson(o?.art === 'person' ? o.id : null);
  };
  const jetzt: OffenesFenster | null =
    offeneGruppe !== null
      ? { art: 'gruppe', id: offeneGruppe }
      : offenePerson !== null
        ? { art: 'person', id: offenePerson }
        : null;
  const gruppeOeffnen = (id: number) => {
    setVerlauf([]);
    zeigen({ art: 'gruppe', id });
  };
  const personOeffnen = (id: number) => {
    setVerlauf([]);
    zeigen({ art: 'person', id });
  };
  /** Aus einem offenen Fenster heraus: Das jetzige kommt in den Verlauf. */
  const ausFensterGruppe = (id: number) => {
    if (jetzt) setVerlauf((v) => [...v, jetzt]);
    zeigen({ art: 'gruppe', id });
  };
  const fensterZurueck =
    verlauf.length > 0
      ? () => {
          zeigen(verlauf[verlauf.length - 1]);
          setVerlauf(verlauf.slice(0, -1));
        }
      : undefined;
  // Den Verlauf muss das X nicht leeren: Ein neues Fenster aus der Seite fängt ohnehin neu an.
  const fensterZu = () => zeigen(null);

  return (
    <ErweiterungsSeite
      app="Organigramm"
      zustand={zustand}
      reiter={oben}
      kopfAktion={
        // Rechts neben „Hallo …“ wie „+ Gruppe erstellen“ in ChurchTools (Alwin, 28.10.2026: Variante B). Bis die
        // Mitglieder geladen sind, gesperrt – ohne sie gibt es keine Präsentation.
        start && ansicht === 'organigramm' ? (
          <>
            {start.rechte.gruppenVerwalten && (
              <KopfKnopf
                label="Einstellungen"
                title="Was das Organigramm für alle zeigt"
                symbol={<Icon name="zahnrad" size={16} />}
                onClick={() => setEinstellungenOffen(true)}
              />
            )}
            <KopfKnopf
              label="PDF / Drucken"
              title="Als PDF speichern oder drucken"
              symbol={<Icon name="dokument" size={16} />}
              onClick={() => setPdfOffen(true)}
            />
            <KopfKnopf
              label="Präsentieren"
              symbol={<Icon name="play" size={16} />}
              disabled={!mitglieder}
              onClick={praesentieren}
            />
          </>
        ) : undefined
      }
      unten={unten}
      onNochmal={laden}
    >
      {start && ansicht === 'organigramm' && (
        <Organigramm
          start={start}
          mitglieder={mitglieder}
          einsaetze={einsaetze.art === 'fertig' ? einsaetze.einsaetze : null}
          lesbar={lesbar.mitglieder}
          fuerAlle={fuerAlle}
          fuerAlleFehler={zentral.art === 'fehler'}
          onFuerAlleNochmal={() => void zentralLaden()}
          baum={sichtBaum}
          ansicht={baumAnsicht}
          onAnsicht={ansichtWaehlen}
          personen={personenWahl}
          onPersonen={personenWaehlen}
          rollenFilter={rollenFilter}
          spitze={spitze}
          onSpitze={spitzeSetzen}
          sicht={sicht}
          onUmklappen={umklappen}
          onAlleAuf={() => setOffenWahl(alleAuf(sichtBaum, spitze, offen))}
          onAlleZu={() => setOffenWahl(alleZu(sichtBaum, spitze, offen))}
          onNachladen={nachladen}
          onGruppe={gruppeOeffnen}
        />
      )}
      {start && ansicht === 'personen' && (
        <Personen
          start={start}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          bereich={bereich}
          onPerson={personOeffnen}
          onEinsaetzeNachladen={einsaetzeLaden}
        />
      )}
      {start && ansicht === 'hinweise' && (
        <Hinweise
          start={start}
          hinweise={hinweise}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          onGruppe={gruppeOeffnen}
          onPerson={personOeffnen}
          onEinsaetzeNachladen={einsaetzeLaden}
        />
      )}
      {start && einrichtung && kinderZugang && ansicht === 'kinder' && (
        <KinderJugend
          start={start}
          einrichtung={einrichtung}
          zugang={kinderZugang}
          onAbgemeldet={abgemeldetOderFehler}
        />
      )}
      {start && ansicht === 'gliederung' && (
        <NeueGliederung start={start} onStruktur={strukturNeu} />
      )}
      {start && offenerKnoten && (
        <GruppenFenster
          key={offenerKnoten.gruppe.id}
          start={start}
          knoten={offenerKnoten}
          mitglieder={mitglieder}
          onGruppe={ausFensterGruppe}
          onNachladen={nachladen}
          onSchliessen={fensterZu}
          zurueck={fensterZurueck}
          onHierAnfangen={hierAnfangen}
          onStruktur={strukturNeu}
          onMitgliederNeu={() => mitgliederNeu(offenerKnoten.gruppe.id)}
        />
      )}
      {start && offenePersonImBereich && (
        <PersonFenster
          start={start}
          person={offenePersonImBereich}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          onGruppe={ausFensterGruppe}
          onSchliessen={fensterZu}
          zurueck={fensterZurueck}
        />
      )}
      {start && einstellungenOffen && (
        <EinstellungenFenster
          start={start}
          stand={zentral.art === 'da' ? zentral.stand : null}
          onStand={(stand) => setZentral({ art: 'da', stand })}
          onSchliessen={() => setEinstellungenOffen(false)}
        />
      )}
      {start && pdfOffen && (
        <PdfFenster
          baum={sichtBaum}
          gemeinde={gemeindeName}
          offen={offen}
          spitze={spitze}
          ansicht={baumAnsicht}
          typFarben={start.typFarben}
          personen={{ wahl: personenWahl, mitglieder, rollen: start.rollen }}
          rollenFilter={rollenFilter}
          onSchliessen={() => setPdfOffen(false)}
        />
      )}
      {start && mitglieder && praesentation && (
        <Praesentation
          start={start}
          daten={praesentation}
          mitglieder={mitglieder}
          stand={praesPlan ? { wert: praesStand, onWechsel: setPraesStand } : undefined}
          personen={{ wahl: personenWahl, onWahl: personenWaehlen }}
          rollenFilter={rollenFilter}
          onSchliessen={() => setPraesentiert(false)}
        />
      )}
    </ErweiterungsSeite>
  );
}
