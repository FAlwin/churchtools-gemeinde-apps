import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { monatName, tagKurz } from '@shared/ct/datum';
import {
  gruppenName,
  planAusschnitt,
  type Plan,
  type PlanGruppe,
  type PlanPlatz,
  type PlanSpalte,
  type PlanZeile,
} from '@shared/dienstplan/plan';
import { artVon, veranstaltungsArten, WEITERE } from '@shared/dienstplan/termine';
import {
  passendeAnzahl,
  schritt,
  sichtbar,
  type Breite,
  type Fenster,
  type FensterSchritt,
} from '@shared/dienstplan/fenster';
import {
  entwurfVeraltet,
  ortSchluessel,
  zielText,
  type Besetzung,
  type Entwurf,
  type EntwurfErgebnis,
  type EntwurfZiel,
} from '@shared/dienstplan/entwuerfe';
import type { Belegung, PlatzOrt } from '@shared/dienstplan/einteilen';
import {
  ladeGrenzen,
  mitDazu,
  zeitraumDazu,
  zeitraumGrenzen,
  spanneText,
  zeitraumText,
  zeitraumVerschieben,
  type Zeitraum,
} from '@shared/ct/zeitraum';
import type { TermineZustand } from './Termine';
import type { TermineDaten } from './ladeTermine';
import { ZeitraumKnopf } from '@ui/bedienung/ZeitraumKnopf';
import { leseAnsicht, merkeAnsicht, type PlanenAnsicht } from './planenAnsicht';
import { useBreite } from './useBreite';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { WerKann, type Eintragen, type FreierPlatz } from './WerKann';
import { EntwurfFach } from './EntwurfFach';
import { BelegtFach } from './BelegtFach';
import { PlaetzeFach, type PlaetzeZeile } from './PlaetzeFach';
import { ZauberstabFach, type Wahl, type ZauberZeile } from './ZauberstabFach';
import type { Eingeplant } from '@shared/dienstplan/zauberstab';
import { AlteEntwuerfeFach, type AlterEntwurf } from './AlteEntwuerfeFach';
import type { TerminStand } from './terminStand';
import { SendenFach, type SendeZeile } from './SendenFach';
import { grundText, type EntwuerfeDaten, type EntwurfAnschluss } from './ladeEntwuerfe';
import { ALLE_REITER } from './reiter';
import { AblaufBearbeitenKnopf } from './MatrixAblauf';
import { useMatrixAblauf } from './useMatrixAblauf';
import { useMatrixInfos } from './useMatrixInfos';
import type { Start } from './start';
import {
  type EntwurfAmPlatz,
  schluessel,
  type Sicht,
  darfPlanen,
  freierPlatz,
  zauberUnter,
  stehtInChurchTools,
} from './planSicht';
import { Terminleiste } from './Terminleiste';
import { TabellenPlan, HandyPlan } from './PlanAnsicht';
import { WerWieOft } from './WerWieOft';
import styles from './Planen.module.scss';

/** Der Name des Reiters mit den eigenen Diensten – aus der Reiterliste, damit der Hilfetext eine Umbenennung mitmacht. */
const DIENSTE_REITER = ALLE_REITER.find((r) => r.id === 'termine')?.label ?? 'Dienste';

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
  /** Einen gewählten Zeitraum laden (Monat, von–bis) – nur für die Matrix, Start und Dienste (Reiter `termine`) bleiben. */
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  /** Heute (`YYYY-MM-DD`, Ortszeit der Gemeinde). */
  heute: string;
  /** Eintragen als Entwurf (E4-3) – ohne Anschluss bleibt „Wer kann?“ nur zum Ansehen. */
  entwuerfe?: EntwurfAnschluss;
  /** Termin öffnen → Termin-Ansicht mit Ablauf und Diensten (E6-1b). */
  onTermin?: (id: number) => void;
  /** Der Ablauf in der Matrix (E6-6a) – ohne steht die Matrix ohne die Gruppe „Ablauf“ da. */
  ablauf?: { start: Start; zeitzone: string };
}

type EntwuerfeZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; daten: EntwuerfeDaten };

/**
 * „Plan teilen“ (E8-2) erst beim Antippen laden – es bringt pdf.js mit; beim Start legte das sonst einen Worker an (wie
 * „Termin teilen“ in der Termin-Ansicht).
 */
const PlanTeilenFenster = lazy(() =>
  import('./PlanTeilenFenster').then((m) => ({ default: m.PlanTeilenFenster })),
);

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
  onTermin,
  ablauf,
}: Props) {
  const [ansicht, setAnsichtRoh] = useState<PlanenAnsicht>(leseAnsicht);
  const setAnsicht = (a: PlanenAnsicht) => {
    setAnsichtRoh(a);
    merkeAnsicht(a);
  };
  const matrixAblauf = useMatrixAblauf(ablauf, ansicht.ablaufZu, (ablaufZu) =>
    setAnsicht({ ...ansicht, ablaufZu }),
  );
  const matrixInfos = useMatrixInfos(ablauf, ansicht.infosZu, (infosZu) =>
    setAnsicht({ ...ansicht, infosZu }),
  );
  const [fenster, setFenster] = useState<Fenster>({ start: 0, anzahl: null });
  const [zu, setZu] = useState<Set<string> | null>(null);
  const [frei, setFrei] = useState<FreierPlatz | null>(null);
  // Das Fenster am belegten Platz (E4-5): zurückziehen oder ersetzen.
  const [belegt, setBelegt] = useState<FreierPlatz | null>(null);
  // Das Plätze-Fach (E4-5-3): Termin und Gruppe.
  const [plaetzeFach, setPlaetzeFach] = useState<{ spalte: number; gruppe: PlanGruppe } | null>(
    null,
  );
  // Das Zauberstab-Fenster (E5-2): Gruppe und Termine (Indizes in `plan.spalten`).
  // Beim Öffnen festgehalten – sonst verschwänden Zeilen, sobald ein Vorschlag als Entwurf dasteht.
  const [zauber, setZauber] = useState<{
    titel: string;
    unter: string;
    zeilen: ZauberZeile[];
    mitEntwurf: number;
    eingeplant: Eingeplant[];
    gruppe: { id: number; name: string };
  } | null>(null);
  // Ein angetippter Entwurf (E4-3-3) – und ob „Andere Person wählen“ einen Entwurf ersetzt (seine Version).
  const [fach, setFach] = useState<{
    platz: FreierPlatz;
    entwurf: Entwurf;
    inChurchTools: string | null;
  } | null>(null);
  const [ersetzt, setErsetzt] = useState<number | null>(null);
  /**
   * Aus welchem Fenster „Wer kann?“ aufging (Alwin, 02.11.2026: „Wechselt ein Screen im Fenster, soll es einen
   * Zurück-Pfeil geben“) – „‹“ öffnet genau dieses wieder. `null`: vom freien Platz aus, dann gibt es keinen Pfeil.
   */
  const [werKannVon, setWerKannVon] = useState<
    | { art: 'entwurf'; fach: NonNullable<typeof fach> }
    | { art: 'belegt'; platz: FreierPlatz }
    | null
  >(null);
  // Das offene Senden-Fach mit seiner Liste (beim Öffnen festgehalten).
  const [sendenListe, setSendenListe] = useState<SendeZeile[] | null>(null);
  const [rahmen, platz] = useBreite();
  const { toast, showToast } = useToast();

  // Entwürfe (E4-3): geladen beim Öffnen, neu nach dem Einrichten einer Schublade oder „Erneut versuchen“.
  const {
    stand: ewStand,
    neu: ewNeu,
    setze: ewSetzeDaten,
  } = useLaden(() => (entwuerfe ? entwuerfe.laden() : null), [entwuerfe]);
  const ew: EntwuerfeZustand =
    ewStand.art === 'fertig'
      ? { art: 'fertig', daten: ewStand.daten }
      : ewStand.art === 'fehler'
        ? { art: 'fehler', text: ewStand.fehler.text }
        : { art: 'laedt' };
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
    ewSetzeDaten((alt) => {
      const map = new Map(alt.entwuerfe);
      if (e) map.set(k, e);
      else map.delete(k);
      return { ...alt, entwuerfe: map };
    });
  /**
   * Einen Entwurf speichern und das Ergebnis gleich in die geladenen Daten übernehmen – bei einem Konflikt das, was
   * jetzt dasteht. **Eine Stelle** für „Wer kann?“, Zurückziehen und Zauberstab (E5-2): Wer die Eingabe ändert
   * (etwa „direkt zuteilen“ als Vorgabe je Dienst), ändert sie für alle.
   */
  const entwurfSpeichern = async (
    daten: EntwuerfeDaten,
    gruppeId: number,
    e: { ort: PlatzOrt; ziel: EntwurfZiel; gesehen: Belegung; modus?: Entwurf['modus'] },
    erwartet: number | null,
  ): Promise<EntwurfErgebnis> => {
    if (!entwuerfe) return { ok: false, grund: 'voruebergehend' };
    const r = await entwuerfe.speichern(
      daten,
      gruppeId,
      {
        ort: e.ort,
        ziel: e.ziel,
        modus: e.modus ?? 'anfrage',
        gesehen: e.gesehen,
        von: entwuerfe.ich,
      },
      erwartet,
    );
    const k = ortSchluessel(e.ort);
    if (r.ok) ewSetzen(k, r.entwurf);
    else if (r.grund === 'konflikt') ewSetzen(k, r.jetzt ?? null);
    return r;
  };

  // Jede Unteransicht hat ihren eigenen Zeitraum (E9-3, Alwin 05.11.2026): die Matrix z. B. den Dezember, „Wer wie
  // oft?“ die letzten 3 Monate. Alles Weitere richtet sich nach dem der gezeigten Ansicht.
  const personen = ansicht.unteransicht === 'personen';
  const z = personen ? ansicht.zeitraumWer : ansicht.zeitraum;
  const setzeZeitraum = (neu: Zeitraum) =>
    setAnsicht(personen ? { ...ansicht, zeitraumWer: neu } : { ...ansicht, zeitraum: neu });

  // Gewählter Zeitraum: eigene Abfrage, gemerkt mit ihrem Bereich – eine späte Antwort für einen alten Bereich zählt
  // nicht mehr (`useLaden`). Geladen wird mit dem Vorlauf für ＋ (`ladeGrenzen`).
  const grenzen = zeitraumGrenzen(z, heute);
  const laden = ladeGrenzen(z, heute);
  const bereich = laden ? `${laden.von}|${laden.bis}` : null;
  // ＋ bei gewähltem Zeitraum lädt weiter aus – bis das da ist, bleibt der bisherige Stand stehen (für diesen Bereich).
  const [leiseFuer, setLeiseFuer] = useState<string | null>(null);
  const { stand: zeitraum, neu: zeitraumNeu } = useLaden(
    () =>
      laden && bereich ? ladeZeitraum(laden.von, laden.bis).then((d) => ({ bereich, ...d })) : null,
    // `laden` steckt vollständig in `bereich`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bereich, ladeZeitraum],
    // Leise (das Bisherige bleibt stehen, bis das Neue da ist): derselbe Bereich noch einmal (nach dem Senden, „Erneut
    // versuchen“) und ＋. Scheitert es, steht der Fehler über der Tabelle wie bei „ab heute“ (Alwin, 06.11.2026).
    { behalten: (alt) => alt.bereich === bereich || leiseFuer === bereich },
  );
  const quelle: TermineZustand = !bereich
    ? zustand
    : zeitraum.art === 'fertig' && (zeitraum.daten.bereich === bereich || leiseFuer === bereich)
      ? {
          art: 'fertig',
          zeilen: zeitraum.daten.zeilen,
          plan: zeitraum.daten.plan,
          wochen: 0,
          nachladeFehler: zeitraum.neuFehler,
        }
      : zeitraum.art === 'fehler'
        ? { art: 'fehler', fehler: zeitraum.fehler }
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
  // Ist das Nachladen gescheitert, lädt nichts mehr – schon in dem Bild, in dem der Fehler erscheint. `nachLaden` räumt
  // der Effekt oben erst danach weg; bis dahin stand ＋ gesperrt neben „Erneut versuchen“ und die Leiste sagte „werden
  // geladen …“ (ein Bild lang – genug, dass der Test unter Last daran scheiterte).
  const laedtNach = nachLaden !== null && !(zustand.art === 'fertig' && zustand.nachladeFehler);
  const kannNachladen = !bereich && mehrMoeglich && !laedtNach;

  const waehleZeitraum = (neu: Zeitraum) => {
    if (neu.art === 'abHeute') setFenster((f) => schritt(f, 'passend', 0, 0));
    setzeZeitraum(neu);
  };
  /** ＋ bei gewähltem Zeitraum (E9-3): eine Veranstaltung mehr davor bzw. danach – leise, ohne „wird geladen“. */
  const nimmDazu = (richtung: 1 | -1) => {
    const neu = zeitraumDazu(z, richtung);
    const l = ladeGrenzen(neu, heute);
    if (l) setLeiseFuer(`${l.von}|${l.bis}`);
    setzeZeitraum(neu);
  };

  // Was geladen ist – bei ＋ mit ein paar Wochen Vorlauf. Die Matrix bekommt davon nur den Zeitraum und die Termine,
  // die ＋ dazunahm (gezählt nach dem Filter „Veranstaltungen“, wie ＋ bei „ab heute“).
  const geladen = quelle.art === 'fertig' ? quelle.plan : null;
  const dazu = z.art === 'abHeute' ? undefined : z.dazu;
  const rand = useMemo(() => {
    if (!grenzen) return null;
    const arten = geladen ? veranstaltungsArten(geladen.spalten) : [];
    const tage = (geladen?.spalten ?? []).map((sp) => ({
      tag: sp.tag,
      sichtbar: !ansicht.ausgeblendeteArten.includes(artVon(sp, arten)),
    }));
    return mitDazu(tage, grenzen, dazu);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `grenzen` und `dazu` stecken in `bereich` und `z`
  }, [geladen, bereich, JSON.stringify(z), ansicht.ausgeblendeteArten]);
  const plan = useMemo(
    () => (geladen && rand && dazu ? planAusschnitt(geladen, rand.von, rand.bis) : geladen),
    [geladen, rand, dazu],
  );

  // Entwürfe ohne Platz (#582): Am geladenen Termin passt die Platznummer nicht mehr (Platzzahl in ChurchTools
  // geändert – gemessen: dann wird neu nummeriert) → Schild beim Dienst. Gehört der Dienst nicht mehr zum Termin,
  // oder ist der Termin vorbei bzw. gelöscht → „alte Entwürfe“ zum Aufräumen. Termine außerhalb des Zeitraums werden
  // einmal nachgefragt; ein künftiger Termin dort ist normal.
  const [staende, setStaende] = useState<Map<number, TerminStand>>(new Map());
  const lage = entwurfsLage();
  const fremdSchluessel = lage.fremd.join(',');
  // Gesammelt, nicht ersetzt: Mit jeder Antwort werden weniger Termine „fremd“ – die bekannten bleiben bekannt.
  // Scheitert es, bleibt der Stand „unbekannt“: nichts als alt melden (vorübergehend ist nicht gelöscht).
  const nachgefragt = useLaden(
    () =>
      entwuerfe && fremdSchluessel
        ? entwuerfe.termine(fremdSchluessel.split(',').map(Number))
        : null,
    [entwuerfe, fremdSchluessel],
  ).stand;
  useEffect(() => {
    if (nachgefragt.art === 'fertig') setStaende((alt) => new Map([...alt, ...nachgefragt.daten]));
  }, [nachgefragt]);
  function entwurfsLage() {
    const schilder = new Map<string, Entwurf[]>();
    const alte: AlterEntwurf[] = [];
    const fremd = new Set<number>();
    if (!plan || ew.art !== 'fertig') return { schilder, alte, fremd: [] as number[] };
    const spalteJe = new Map(plan.spalten.map((sp, i) => [sp.id, i]));
    const zeileJe = new Map(plan.gruppen.flatMap((g) => g.zeilen).map((zl) => [zl.dienst.id, zl]));
    const aendern = (gruppeId: number) => ew.daten.schubladen.get(gruppeId)?.stand === 'bereit';
    for (const [k, e] of ew.daten.entwuerfe) {
      const gruppeId = ew.daten.gruppeJe.get(k);
      if (gruppeId === undefined) continue;
      const i = spalteJe.get(e.ort.eventId);
      const dienst = zeileJe.get(e.ort.serviceId)?.dienst.name;
      if (i === undefined) {
        const st = staende.get(e.ort.eventId);
        if (!st) fremd.add(e.ort.eventId);
        else if (aendern(gruppeId) && st.art === 'weg') {
          alte.push({ entwurf: e, gruppeId, grund: 'termin-weg', dienst });
        } else if (aendern(gruppeId) && st.art === 'da' && st.tag < heute) {
          alte.push({ entwurf: e, gruppeId, grund: 'vorbei', termin: st, dienst });
        }
        continue;
      }
      const sp = plan.spalten[i];
      const zl = zeileJe.get(e.ort.serviceId);
      // Dienst gar nicht in der Matrix (z. B. Gruppe nicht ganz sichtbar) – dann nichts behaupten.
      if (!zl) continue;
      const zelle = zl.zellen[i];
      if (zelle === null) {
        if (aendern(gruppeId)) {
          alte.push({
            entwurf: e,
            gruppeId,
            grund: 'dienst-weg',
            termin: { name: sp.name, tag: sp.tag },
            dienst,
          });
        }
        continue;
      }
      if (zelle.some((p) => p.index === e.ort.index)) continue;
      const sk = `${sp.id}|${zl.dienst.id}`;
      schilder.set(sk, [...(schilder.get(sk) ?? []), e]);
    }
    return { schilder, alte, fremd: [...fremd].sort((a, b) => a - b) };
  }
  // Das Fach „Alte Entwürfe“ (offen mit der Liste, beim Öffnen festgehalten).
  const [alteListe, setAlteListe] = useState<AlterEntwurf[] | null>(null);
  // „Plan teilen“ (E8-2): geteilt werden die Termine, die gerade zählen – dieselben wie in der Aufschrift des
  // Zeitraum-Knopfs – und die eingeblendeten Gruppen.
  const [teilenOffen, setTeilenOffen] = useState(false);
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

  // Aufschrift des Zeitraum-Knopfs – und dieselben Termine teilt „Plan teilen“.
  const teilenSpalten = handy || bereich ? (d?.gefiltert ?? []) : imFenster;
  const anzahl = teilenSpalten.length;
  const terminText = `${anzahl} ${anzahl === 1 ? 'Termin' : 'Termine'}`;
  // Mit ＋ (oder bei „Letzte N Monate“) steht oben die echte Spanne, darunter, woraus sie besteht:
  // „Dezember 2026 + 1 Termin · 10 Termine“.
  const extra = rand ? rand.davor + rand.danach : 0;
  const mitSpanne = z.art === 'letzte' || extra > 0;
  const zeile1 =
    z.art !== 'abHeute'
      ? mitSpanne && rand
        ? spanneText(rand.von, rand.bis)
        : zeitraumText(z)
      : handy || !plan || imFenster.length === 0
        ? 'Ab heute'
        : spanneText(
            plan.spalten[imFenster[0]].tag,
            plan.spalten[imFenster[imFenster.length - 1]].tag,
          );
  const zeile2 =
    quelle.art === 'laedt'
      ? 'wird geladen …'
      : laedtNach
        ? 'weitere Termine werden geladen …'
        : z.art === 'abHeute' && !handy && fenster.anzahl === null
          ? `${terminText} · passend zur Fensterbreite`
          : z.art !== 'abHeute' && mitSpanne
            ? `${zeitraumText(z)}${extra > 0 ? ` + ${extra} ${extra === 1 ? 'Termin' : 'Termine'}` : ''} · ${terminText}`
            : terminText;

  const knopf = (
    <ZeitraumKnopf
      zeitraum={z}
      zeile1={zeile1}
      zeile2={zeile2}
      heute={heute}
      abHeuteZusatz={handy ? 'die nächsten Termine' : 'passend zur Fensterbreite'}
      vergangenheit={personen}
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
      onVerschieben={(r) => setzeZeitraum(zeitraumVerschieben(z, r, heute))}
      onDazu={nimmDazu}
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
        {/* „Ablauf bearbeiten“ hier statt neben „Ablauf“ – dort passte er nicht in die Dienst-Spalte (E6-6c). */}
        {!handy && ansicht.unteransicht === 'matrix' && matrixAblauf && plan && (
          <AblaufBearbeitenKnopf ma={matrixAblauf} plan={plan} spalten={imFenster} />
        )}
        {!handy && ansicht.unteransicht === 'matrix' && (
          <Segment<Breite>
            value={ansicht.breite}
            // Zwei Breiten als Symbole statt S/M/L (Alwin, 29.10.2026, Entwurf `e6-6-breiten-plus.html`).
            options={[
              {
                value: 'schmal',
                label: <Icon name="spalten-schmal" size={18} />,
                name: 'Schmale Spalten',
              },
              {
                value: 'breit',
                label: <Icon name="spalten-breit" size={18} />,
                name: 'Breite Spalten',
              },
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
        <KopfKnopf
          onClick={() => setTeilenOffen(true)}
          label="Teilen"
          title="Plan als PDF teilen"
          symbol={<Icon name="share" size={16} />}
          disabled={!plan || teilenSpalten.length === 0}
        />
        {teilenOffen && plan && (
          <Suspense fallback={null}>
            <PlanTeilenFenster
              quelle={{
                plan,
                spalten: teilenSpalten,
                gruppen: plan.gruppen.filter(
                  (g) => !ansicht.ausgeblendeteGruppen.includes(schluessel(g)),
                ),
                gemeinde: ablauf?.start.gemeinde ?? null,
                app: 'Dienstplaner',
              }}
              onClose={() => setTeilenOffen(false)}
            />
          </Suspense>
        )}
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
    inhalt = <FehlerKasten fehler={quelle.fehler} onNochmal={bereich ? zeitraumNeu : onNochmal} />;
  else if (!plan || !d || plan.spalten.length === 0)
    inhalt = hinweis(
      z.art === 'abHeute'
        ? `In den nächsten ${quelle.wochen} Wochen stehen keine Termine an.`
        : z.art === 'letzte'
          ? `In den letzten ${z.monate} Monaten gab es keine Termine.`
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
      onZauberstab: (idx, g) => {
        const z = entwuerfe ? zauberZeilen(idx, g) : null;
        if (!z || z.zeilen.length === 0) return undefined;
        return () =>
          setZauber({
            titel: `Automatische Planung · ${gruppenName(g)}`,
            unter: zauberUnter(plan, idx),
            ...z,
            eingeplant: zauberEingeplant(g),
            gruppe: { id: g.gruppe?.id ?? 0, name: gruppenName(g) },
          });
      },
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
      ohnePlatz: (i, zl) => lage.schilder.get(`${plan.spalten[i].id}|${zl.dienst.id}`) ?? [],
      onOhnePlatz: (i, zl, e) =>
        setFach({
          platz: {
            ...freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], 1),
            nr: e.ort.index ?? 1,
            index: e.ort.index,
            bisher: undefined,
          },
          entwurf: e,
          inChurchTools:
            'Diesen Platz gibt es so nicht mehr – die Platzzahl wurde in ChurchTools geändert.',
        }),
      ichId: entwuerfe?.ich.personId ?? null,
      onTermin,
      ablauf: matrixAblauf,
      infos: matrixInfos,
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
        <TabellenPlan sicht={sicht} breite={ansicht.breite} />
      );
  }

  /** ChurchTools hat sich geändert (gesendet, Plätze): die Termine neu – leise, ohne „wird geladen“. */
  const leiseNeuLaden = () => {
    if (bereich) zeitraumNeu();
    else onAktualisieren?.();
  };

  /**
   * Die freien Plätze für den Zauberstab (E5-2): nicht abgesagt, nicht vorbei, wo man den Dienst planen und die
   * Entwürfe der Gruppe ändern darf – **ohne Entwurf** (die bleiben, wie sie sind; gezählt in `mitEntwurf`).
   * Der Reihe nach: Termin, Dienst, Platz – so rechnet auch der Kern.
   */
  function zauberZeilen(
    idx: number[],
    g: PlanGruppe,
  ): { zeilen: ZauberZeile[]; mitEntwurf: number } {
    const zeilen: ZauberZeile[] = [];
    let mitEntwurf = 0;
    if (!plan || ew.art !== 'fertig') return { zeilen, mitEntwurf };
    for (const i of [...idx].sort((a, b) => a - b)) {
      const s = plan.spalten[i];
      if (s.abgesagt || s.tag < heute) continue;
      for (const zl of g.zeilen) {
        if (!darfPlanen(zl, s) || !darfAendern(zl)) continue;
        const zelle = zl.zellen[i] ?? [];
        zelle.forEach((p, n) => {
          if (p.art !== 'frei') return;
          if (entwurfAmPlatz(s, zl, p)) {
            mitEntwurf++;
            return;
          }
          zeilen.push({
            schluessel: ortSchluessel({ eventId: s.id, serviceId: zl.dienst.id, index: p.index }),
            terminId: s.id,
            serviceId: zl.dienst.id,
            tag: s.tag,
            schonDa: zelle.flatMap((x) => (x.personId !== null ? [x.personId] : [])),
            dienst: zl.dienst.name,
            nr: n + 1,
            von: zelle.length,
            kopf: `${tagKurz(s.tag)} · ${s.name} · ${s.uhrzeit} Uhr`,
            monatName: monatName(s.tag),
            index: p.index,
            gruppeId: zl.dienst.dienstgruppeId ?? 0,
            gesehen: p.belegung,
            stift: zl.planbar,
          });
        });
      }
    }
    return { zeilen, mitEntwurf };
  }

  /**
   * Was im Lauf schon feststeht (Alwin, 16.10.: „mitzählen“): Entwürfe mit Person in der Schublade dieser Gruppe,
   * an Terminen der Matrix (dort kennen wir den Tag).
   */
  function zauberEingeplant(g: PlanGruppe): Eingeplant[] {
    if (!plan || ew.art !== 'fertig' || !g.gruppe) return [];
    const tagJe = new Map(plan.spalten.map((s) => [s.id, s.tag]));
    const out: Eingeplant[] = [];
    for (const [k, e] of ew.daten.entwuerfe) {
      const tag = tagJe.get(e.ort.eventId);
      if (ew.daten.gruppeJe.get(k) !== g.gruppe.id || !tag || e.ziel.art !== 'person') continue;
      out.push({ personId: e.ziel.personId, tag });
    }
    return out;
  }

  /** Übernehmen (E5-2): je Vorschlag ein Entwurf, einer nach dem anderen – wie „Wer kann?“ ihn anlegt. */
  async function zauberUebernehmen(
    wahlen: Wahl[],
    melde: (index: number, ergebnis: EntwurfErgebnis) => void,
  ): Promise<void> {
    if (!entwuerfe || ew.art !== 'fertig') return;
    const daten = ew.daten;
    for (const [i, w] of wahlen.entries()) {
      const ort = { eventId: w.zeile.terminId, serviceId: w.zeile.serviceId, index: w.zeile.index };
      const r = await entwurfSpeichern(
        daten,
        w.zeile.gruppeId,
        {
          ort,
          ziel: { art: 'person', personId: w.personId, name: w.name },
          gesehen: w.zeile.gesehen,
        },
        null,
      );
      melde(i, r);
    }
  }

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
      // Was jetzt dasteht, zeigt die Matrix sofort – und das offene Fach auch (sonst zeigte es die alte Fassung,
      // Prüfung mit zwei Planern 16.10.2026). Ist der Entwurf weg, bleibt das Fach mit seinem Hinweis stehen.
      ewSetzen(k, r.jetzt ?? null);
      const jetzt = r.jetzt;
      if (jetzt) setFach((f) => (f ? { ...f, entwurf: jetzt } : f));
    }
  };

  /** Der Stift in „Wer kann?“ (E5-3) – nur, wo man die Dienstgruppe plant (nicht nur als Termin-Admin). */
  const stiftFuer = (f: FreierPlatz) => {
    const g = plan?.gruppen.find((x) => x.gruppe?.id === f.gruppeId);
    return entwuerfe && f.stift && g
      ? { vorlieben: entwuerfe.vorlieben, gruppe: { id: f.gruppeId, name: gruppenName(g) } }
      : undefined;
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
        const r = await entwurfSpeichern(
          daten,
          f.gruppeId,
          { ort, ziel, modus: alt?.modus, gesehen: f.bisher?.belegung ?? { art: 'frei' } },
          erwartet,
        );
        if (r.ok) {
          setFrei(null);
          setErsetzt(null);
          setWerKannVon(null);
          showToast(
            f.bisher
              ? `${ziel.name} statt ${f.bisher.name} eingetragen – noch nicht gesendet.`
              : `${ziel.name} eingetragen – noch nicht gesendet.`,
          );
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

  // Nachladen gescheitert, der bisherige Stand steht: bei „ab heute“ wie beim gewählten Zeitraum (Alwin, 06.11.2026).
  const nachladeFehler = quelle.art === 'fertig' ? quelle.nachladeFehler : undefined;
  return (
    <div className={styles.planen}>
      {werkzeug}
      {nachladeFehler && (
        <FehlerKasten
          fehler={nachladeFehler}
          onNochmal={bereich ? zeitraumNeu : () => nachladen('weiter')}
        />
      )}
      {lage.alte.length > 0 && entwuerfe && ew.art === 'fertig' && (
        <div className={styles.alteHinweis} role="status" aria-label="Alte Entwürfe">
          <span>
            <b>
              {lage.alte.length} {lage.alte.length === 1 ? 'alter Entwurf' : 'alte Entwürfe'}
            </b>{' '}
            – Termin vorbei oder gelöscht, oder der Dienst gehört nicht mehr dazu.
          </span>
          <button
            type="button"
            className={styles.alteKnopf}
            onClick={() => setAlteListe(lage.alte)}
          >
            Ansehen
          </button>
        </div>
      )}
      <div ref={rahmen}>{inhalt}</div>
      <p className={styles.hinweis}>
        Welche Dienste du siehst, entscheidet ChurchTools. Hier stehen nur Dienstgruppen, die du
        ganz sehen darfst – deine eigenen Dienste findest du immer unter Start und {DIENSTE_REITER}.
        Planen darfst du, wo du die Dienstgruppe bearbeiten darfst, die Gruppe eines Dienstes
        leitest oder Admin des Termins bist. Einen freien Platz antippen zeigt, wer kann – dort
        trägst du jemanden als Entwurf ein. Einen belegten Platz antippen: zurückziehen oder durch
        jemand anderen ersetzen, ebenfalls als Entwurf. Der Regler in der Gruppenzeile ändert die
        Anzahl der Plätze – sofort. Der Zauberstab schlägt für die freien Plätze Personen vor – nach
        der Rangfolge von ChurchTools, ebenfalls als Entwurf. Der Stift neben einem Namen ändert
        dessen Vorlieben – sofort in ChurchTools. Gesendet wird erst mit „Ansehen und senden“ – dann
        bekommen die Angefragten eine Mitteilung von ChurchTools.
      </p>
      {fach && entwuerfe && ew.art === 'fertig' && (
        <EntwurfFach
          platz={fach.platz}
          entwurf={fach.entwurf}
          inChurchTools={fach.inChurchTools}
          onClose={() => setFach(null)}
          onModus={async (modus, erwartet) => {
            const e = fach.entwurf;
            const r = await entwurfSpeichern(
              ew.daten,
              fach.platz.gruppeId,
              { ort: e.ort, ziel: e.ziel, modus, gesehen: e.gesehen },
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
            setWerKannVon({ art: 'entwurf', fach });
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
            setWerKannVon(null);
          }}
          zurueck={
            werKannVon
              ? () => {
                  setFrei(null);
                  setErsetzt(null);
                  setWerKannVon(null);
                  if (werKannVon.art === 'entwurf') setFach(werKannVon.fach);
                  else setBelegt(werKannVon.platz);
                }
              : undefined
          }
          eintragen={eintragenFuer(frei)}
          stift={stiftFuer(frei)}
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
            setWerKannVon({ art: 'belegt', platz: belegt });
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
            const r = await entwurfSpeichern(
              ew.daten,
              belegt.gruppeId,
              { ort, ziel: { art: 'frei' }, gesehen: b.belegung },
              null,
            );
            if (r.ok) {
              setBelegt(null);
              showToast(`${b.name} wird beim Senden zurückgezogen – noch nicht gesendet.`);
            }
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
          onClose={(geaendert) => {
            setSendenListe(null);
            if (geaendert) {
              ewNeu();
              leiseNeuLaden();
            }
          }}
        />
      )}
      {alteListe && entwuerfe && ew.art === 'fertig' && (
        <AlteEntwuerfeFach
          zeilen={alteListe}
          ichId={entwuerfe.ich.personId}
          verwerfen={(a) =>
            entwuerfe.entfernen(ew.daten, a.gruppeId, a.entwurf.ort, a.entwurf.version)
          }
          onClose={(geaendert) => {
            setAlteListe(null);
            if (geaendert) ewNeu();
          }}
        />
      )}
      {zauber && (
        <ZauberstabFach
          {...zauber}
          vorlieben={entwuerfe?.vorlieben}
          uebernehmen={zauberUebernehmen}
          onClose={(n) => {
            setZauber(null);
            if (n > 0)
              showToast(
                n === 1
                  ? '1 Vorschlag als Entwurf eingetragen – noch nicht gesendet.'
                  : `${n} Vorschläge als Entwurf eingetragen – noch nicht gesendet.`,
              );
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
