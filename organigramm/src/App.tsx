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
import type { PersonenWahl } from '@shared/organigramm/personen';
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
import {
  leseAnsicht,
  leseAusgeblendet,
  lesePersonen,
  merkeAnsicht,
  merkeAusgeblendet,
  merkePersonen,
  type BaumAnsicht,
} from './auswahl';

type Ansicht = 'organigramm' | 'personen' | 'hinweise' | 'gliederung';
const REITER: Reiter<Ansicht>[] = [
  { id: 'organigramm', label: 'Organigramm', icon: 'grid' },
  { id: 'personen', label: 'Personen', icon: 'people' },
  { id: 'hinweise', label: 'Hinweise', icon: 'info' },
];
// Der Plan „neue Gliederung“ (O7) – nur für Gruppen-Admins (Alwin, 24.10.2026).
const REITER_ADMIN: Reiter<Ansicht>[] = [
  ...REITER,
  { id: 'gliederung', label: 'Neue Gliederung', icon: 'pencil' },
];
const ansichtAusAdresse = (hash: string, admin: boolean): Ansicht =>
  hash === '#personen'
    ? 'personen'
    : hash === '#hinweise'
      ? 'hinweise'
      : hash === '#gliederung' && admin
        ? 'gliederung'
        : 'organigramm';

/** Was für alle ausgeblendet ist – bis es geladen ist, und wenn es sich gerade nicht lesen lässt. */
type ZentralStand =
  | { art: 'laedt' }
  | { art: 'da'; stand: Versioniert<Sichtbarkeit> | null }
  | { art: 'fehler' };

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
  const [ausgeblendet, setAusgeblendet] = useState(leseAusgeblendet);
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
  const baumAnsicht: BaumAnsicht = gewaehlt ?? (handy ? 'liste' : 'oben');
  const [spitze, setSpitze] = useState<string | null>(null);
  // `null`, solange niemand etwas auf- oder zugeklappt hat: dann gilt der Anfang (Gemeinde und Bereiche offen) – auch
  // für Bereiche, die erst durch den Typ-Filter wieder auftauchen.
  const [offenWahl, setOffenWahl] = useState<Set<string> | null>(null);
  // Organigramm als PDF (O7b-4) – übernimmt Ansicht, Spitze und Aufgeklapptes vom Reiter.
  const [pdfOffen, setPdfOffen] = useState(false);

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
  // Ausgeblendet ist, was das Gerät ausblendet, und was für alle ausgeblendet ist (O7b-7).
  const typenAus = useMemo(
    () => new Set([...ausgeblendet, ...fuerAlle.typen]),
    [ausgeblendet, fuerAlle],
  );
  const gruppenAus = useMemo(() => new Set(fuerAlle.gruppen), [fuerAlle]);
  const sichtBaum = useMemo(
    () => (start ? bereicheSortiert(baumOhneTypen(start.baum, typenAus, gruppenAus)) : []),
    [start, typenAus, gruppenAus],
  );
  // Eine Spitze, die es nicht mehr gibt (Typ-Filter, Änderung in ChurchTools), wird vergessen – sonst spränge die
  // Ansicht zurück, sobald die Gruppe wieder auftaucht. Das geschieht noch beim Zeichnen, nicht in einem Effekt danach:
  // Ein zweiter Klick (Doppelklick auf den Typ-Filter) kam sonst vor dem Effekt, und die Spitze blieb (Test-Instanz
  // 26.10.2026). React zeichnet dann gleich noch einmal, ohne das Bild mit der ungültigen Spitze zu zeigen.
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
  const admin = !!start?.rechte.gruppenVerwalten;
  const reiter = admin ? REITER_ADMIN : REITER;
  const ansicht: Ansicht = zeigtMehr ? ansichtAusAdresse(hash, admin) : 'organigramm';

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
    );
  }, [praesentiert, start, mitglieder, lesbar, typenAus, gruppenAus, praesStand, praesPlan]);

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
  const typUmschalten = (typ: number) => {
    const neu = new Set(ausgeblendet);
    if (neu.has(typ)) neu.delete(typ);
    else neu.add(typ);
    merkeAusgeblendet(neu);
    setAusgeblendet(neu);
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
    fertig && zeigtMehr && !handy ? (
      <Segment
        value={ansicht}
        options={reiter.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
        verbunden
      />
    ) : undefined;
  const unten =
    fertig && zeigtMehr && handy ? (
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
  const gruppeOeffnen = (id: number) => {
    setOffenePerson(null);
    setOffeneGruppe(id);
  };
  const personOeffnen = (id: number) => {
    setOffeneGruppe(null);
    setOffenePerson(id);
  };

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
          ausgeblendet={ausgeblendet}
          fuerAlle={fuerAlle}
          fuerAlleFehler={zentral.art === 'fehler'}
          onFuerAlleNochmal={() => void zentralLaden()}
          baum={sichtBaum}
          ansicht={baumAnsicht}
          onAnsicht={ansichtWaehlen}
          personen={personenWahl}
          onPersonen={personenWaehlen}
          spitze={spitze}
          onSpitze={spitzeSetzen}
          sicht={sicht}
          onUmklappen={umklappen}
          onAlleAuf={() => setOffenWahl(alleAuf(sichtBaum, spitze, offen))}
          onAlleZu={() => setOffenWahl(alleZu(sichtBaum, spitze, offen))}
          onTypUmschalten={typUmschalten}
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
      {start && ansicht === 'gliederung' && (
        <NeueGliederung start={start} onStruktur={strukturNeu} />
      )}
      {start && offenerKnoten && (
        <GruppenFenster
          key={offenerKnoten.gruppe.id}
          start={start}
          knoten={offenerKnoten}
          mitglieder={mitglieder}
          onGruppe={gruppeOeffnen}
          onNachladen={nachladen}
          onSchliessen={() => setOffeneGruppe(null)}
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
          onGruppe={gruppeOeffnen}
          onSchliessen={() => setOffenePerson(null)}
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
          onSchliessen={() => setPraesentiert(false)}
        />
      )}
    </ErweiterungsSeite>
  );
}
