import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { NachbarKnopf } from '@ui/ablauf/NachbarKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { useVollbild } from '@ui/bedienung/useVollbild';
import { useWakeLock } from '@ui/bedienung/useWakeLock';
import { itemLabel, zustaendigeText, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { tagKurz } from '@shared/ct/datum';
import {
  endeStelle,
  kontoText,
  kontoWort,
  liveLage,
  liveListe,
  restText,
  stelleNachziehen,
  weiterZiel,
  zurueckZiel,
  zusatzZiel,
  type LiveGrund,
  type LivePunkt,
  type LiveStand,
  type LiveZiel,
} from '@shared/ct/liveAgenda';
import {
  abweichungen,
  laeufeAus,
  prognose,
  warumPunkte,
  wechselBeiKlick,
  wirksamerStand,
} from '@shared/ct/liveVerlauf';
import { ortszeitAus } from '@shared/ct/zeit';
import type { CtAgenda, CtAgendaItem } from '@shared/ct/typen';
import type { InfoGruppe } from '@shared/types/index';
import { ladeAblauf } from './ladeBeiwerk';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import { ladeLive, schreibeLive } from './ladeLive';
import { ladeVerlauf, schreibeVerlauf } from './ladeVerlauf';
import { useMeineAnzeige } from './meineAnzeige';
import { useBetriebsart } from './useBetriebsart';
import { useLive } from './useLive';
import { useVerlauf } from './useVerlauf';
import styles from './LiveAnsicht.module.scss';

/** Uhrzeit eines Zeitpunkts (ms) in der Zeitzone der Gemeinde: „10:08“. */
const uhrzeit = (ms: number, zeitzone: string) =>
  ortszeitAus(new Date(ms).toISOString(), zeitzone).slice(11, 16);

/** Was über der Ansicht steht, wenn ChurchTools nicht wie erwartet antwortet. */
function fehlerText(grund: LiveGrund, standVon: string | null): string {
  switch (grund) {
    case 'voruebergehend':
      return standVon
        ? `Keine Verbindung – Stand von ${standVon} Uhr. Wird wieder versucht.`
        : 'ChurchTools antwortet gerade nicht – „Jetzt“ folgt bis dahin der Uhr. Wird wieder versucht.';
    case 'abgemeldet':
      return 'Du bist bei ChurchTools abgemeldet. Bitte neu anmelden und „Live“ wieder öffnen.';
    case 'kein-recht':
      return 'ChurchTools lässt dich die Live-Agenda dieses Termins nicht sehen.';
    case 'unlesbar':
    case 'nicht-angekommen':
      return 'ChurchTools antwortet anders als erwartet – „Live“ geht gerade nicht.';
  }
}

/** Was neben den Steuerknöpfen steht, wenn das Schalten nicht geklappt hat. */
function steuerFehlerText(grund: LiveGrund): string {
  switch (grund) {
    case 'nicht-angekommen':
      return 'Nicht übernommen – vermutlich hat gerade jemand anderes geschaltet. Der aktuelle Stand wird geladen.';
    case 'voruebergehend':
      return 'Nicht gespeichert – ChurchTools antwortet gerade nicht. Bitte noch einmal tippen.';
    case 'abgemeldet':
      return 'Du bist bei ChurchTools abgemeldet. Bitte neu anmelden und „Live“ wieder öffnen.';
    case 'kein-recht':
      return 'ChurchTools hat das Schalten abgelehnt.';
    case 'unlesbar':
      return 'ChurchTools antwortet anders als erwartet – Schalten geht gerade nicht.';
  }
}

type Schalten = 'weiter' | 'zurueck' | 'plus' | 'minus';

/** Wie lange der Hinweis „Fehlklick nicht gezählt“ unten steht (A19). */
export const FEHLKLICK_HINWEIS_MS = 5_000;

/**
 * **„Live“ zum Folgen** (Bauplan E6b-2 L2, Entwurf `e6b-2-live.html` Variante A, Alwin 02.11.2026): der Live-Stand von
 * ChurchTools – derselbe wie in dessen „Live-Agenda“ – im Aufbau der Live-Agenda, aber im Look der App: **Jetzt** mit
 * Zuständigen und den Infos der unter „Spalten“ gewählten Gruppen, **Dann**, der Kreis mit der Restzeit, die
 * Abweichung in Worten und darunter der ganze Ablauf mit erledigten Punkten. Nachgefragt wird alle 2,5 s
 * (`useLive`); die Regeln stehen in `shared/ct/liveAgenda.ts`. Solange niemand gestartet hat, folgt „Jetzt“ der Uhr.
 * Bildschirm bleibt an; Vollbild, wo der Browser es kann.
 *
 * **Live-Ansicht 2, Anzeige** (L4-1, Alwin 23.11.2026): Titel haben in der Liste Vorrang vor den Namen (die brechen um, am
 * Handy stehen sie unter dem Titel); Überschriften als leise Bänder und die Linie „Beginn“ an der Grenze `isBeforeEvent` –
 * nur in der Anzeige, gezählt wird weiter exakt wie in ChurchTools (`liveListe`, T6); die Steuerknöpfe stehen als Leiste
 * unten wie „Davor / Danach“ der Punkt-Ansicht (A11); `infoGruppen` sind schon die richtigen (A16, `liveInfoGruppen`).
 *
 * **Betriebsart + Zeitkonto** (L4-2, Alwin 23.11.2026): Wie lange „Jetzt“ ohne Klick der Uhr folgt, stellen die Planer unter
 * „Einstellungen“ ein (`useBetriebsart`, Standard: bis Beginn nach der Uhr, ab Beginn klicken); das **Zeitkonto** (+ grün =
 * gespart, − rot = Rückstand) ersetzt das alte „Gesamt“. Beides rechnet `liveLage` – diese Datei zeigt nur an.
 *
 * **Live-Verlauf** (L4-3, Alwin 23.11.2026): Die Wechsel der Live-Agenda hält `useVerlauf` je Termin fest (klickendes Gerät schreibt, ein
 * offenes Gerät mit Steuer-Recht trägt nach, gleicher `switchdate` = kein Doppel); daraus rechnet `shared/ct/liveVerlauf.ts` das ± je
 * erledigtem Punkt, „Ende voraussichtlich“, „Warum“ und den **Fehlklick** (A19: zurück auf einen Punkt, alles dazwischen unter 30 s →
 * der Punkt läuft mit seiner alten Zeit weiter; unten ca. 5 s der Hinweis mit „Neu starten“). Die Anzeige rechnet nichts nach – mit dem
 * wirksamen Stand (`wirksamerStand`) rechnet `liveLage`, geschrieben wird der rohe Stand von ChurchTools.
 *
 * **Steuern** (L3, Alwin 02.11.2026: „genau wie ChurchTools“): Wer an diesem Termin in einem Dienst mit „Live-Agenda
 * steuern“ eingeteilt ist (`steuern`), bekommt ‹ Zurück, Weiter ›, −1/+1 Min bzw. „Starten“ – ChurchTools selbst prüft
 * beim Speichern nichts. Vor jedem Schalten wird der Ablauf frisch gelesen: Hat er sich geändert, wird die Stelle
 * erst nachgezogen (`stelleNachziehen`), sonst schaltete man vom falschen Punkt aus weiter. Geschrieben wird über den
 * Kern (nachlesen inklusive); der neue Stand steht sofort da.
 */
export function LiveAnsicht({
  titel,
  tag,
  beginn,
  terminId,
  agendaId,
  items,
  zeilen,
  infoGruppen,
  zeitzone,
  onSchliessen,
  steuern = false,
  onAblauf,
  lesen = ladeLive,
  schreiben = schreibeLive,
  ablaufLesen = ladeAblauf,
  betriebsartLesen,
  verlaufLesen = ladeVerlauf,
  verlaufSchreiben = schreibeVerlauf,
}: {
  titel: string;
  /** Tag des Termins (`JJJJ-MM-TT`, Gemeinde-Zeit). */
  tag: string;
  /** „10:00“. */
  beginn: string;
  terminId: number;
  /** Die ID des Ablaufs – ChurchTools will sie beim Lesen (`agenda_id`). */
  agendaId: number;
  /** Die Punkte wie von ChurchTools – daraus die Liste mit derselben Zählung wie dort (`liveListe`). */
  items: readonly CtAgendaItem[];
  /** Dieselben Punkte als Zeilen – für Zuständige, Lied und Infos. */
  zeilen: readonly AblaufZeile[];
  infoGruppen: readonly InfoGruppe[];
  zeitzone: string;
  onSchliessen: () => void;
  /** Darf ich die Live-Agenda dieses Termins steuern (`darfLiveSteuern`)? */
  steuern?: boolean;
  /** Ein frisch gelesener, geänderter Ablauf (vor dem Schalten) – damit Liste und Termin-Ansicht ihn zeigen. */
  onAblauf?: (neu: CtAgenda) => void;
  /** Nur für Tests: woher der Stand kommt, wohin geschrieben wird, woher der Ablauf kommt. */
  lesen?: typeof ladeLive;
  schreiben?: typeof schreibeLive;
  ablaufLesen?: (terminId: number) => Promise<CtAgenda | null>;
  betriebsartLesen?: () => Promise<EinstellungenStand>;
  verlaufLesen?: typeof ladeVerlauf;
  verlaufSchreiben?: typeof schreibeVerlauf;
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const aktuell = useRef<HTMLLIElement>(null);
  const vollbild = useVollbild(wurzel);
  const { umschalten: vollbildUmschalten } = vollbild;
  useWakeLock(true);
  const live = useLive(terminId, agendaId, lesen);
  const betriebsart = useBetriebsart(betriebsartLesen);
  const anzeige = useMeineAnzeige();

  const liste = useMemo(() => liveListe(items, terminId), [items, terminId]);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [steuerFehler, setSteuerFehler] = useState<LiveGrund | null>(null);
  /** Der Fehlklick, der gerade als „nicht gezählt“ gemeldet ist: der Wechsel (Zeit + Stelle), den „Neu starten“ zurücknimmt. */
  const [fehlklick, setFehlklick] = useState<{ zeit: number; stelle: number } | null>(null);
  // Wer steuern darf, hält die Wechsel fest (T4); alle anderen lesen nur.
  const verlauf = useVerlauf({
    terminId,
    liste,
    stand: live.stand,
    schreibenErlaubt: steuern,
    lesen: verlaufLesen,
    schreiben: verlaufSchreiben,
  });
  const { laeufe } = useMemo(() => laeufeAus(verlauf.verlauf), [verlauf.verlauf]);
  // Der Stand mit wirksamem Beginn und Zusatzzeit (Fehlklick, A19) – mit ihm rechnet alles; geschrieben wird der rohe Stand.
  const wirksam = useMemo(() => wirksamerStand(live.stand, laeufe), [live.stand, laeufe]);
  const zeileVon = useMemo(() => new Map(zeilen.map((z) => [z.id, z])), [zeilen]);
  const indexVon = useMemo(() => new Map(liste.map((p, i) => [p.id, i])), [liste]);
  // Gerechnet wird in der Uhr von ChurchTools, damit Restzeit und Abweichung auf allen Geräten gleich sind.
  const jetzt = live.jetzt - live.versatz;
  const lage = liveLage(liste, wirksam, jetzt, betriebsart);

  /**
   * Schalten: Ablauf frisch lesen und die Stelle nachziehen, wenn er sich geändert hat; dann schreiben. Scheitert das
   * Lesen des Ablaufs, wird mit dem gezeigten weitergemacht – ein Aussetzer soll das Steuern nicht blockieren.
   */
  async function schalten(art: Schalten): Promise<void> {
    // Gegen doppeltes Tippen sperren die Knöpfe selbst (`disabled`) – eine Abfrage hier sähe noch den alten Zustand.
    setBeschaeftigt(true);
    setSteuerFehler(null);
    try {
      let punkte = liste;
      let lageSchalten = lage;
      let stand: LiveStand | null = live.stand;
      const wechselt = art === 'weiter' || art === 'zurueck';
      // Beim Wechsel zugleich den Verlauf frisch lesen: Die Fehlklick-Regel braucht ALLE bisherigen Wechsel (ein anderes
      // Gerät kann dazugeschrieben haben). Scheitert das Lesen, gilt der bekannte Verlauf.
      const [frisch, verlaufJetzt] = await Promise.all([
        ablaufLesen(terminId).catch(() => null),
        wechselt ? verlauf.frisch().catch(() => verlauf.verlauf) : Promise.resolve(verlauf.verlauf),
      ]);
      if (frisch) {
        const neu = liveListe(frisch.items, terminId);
        if (neu.map((p) => p.id).join() !== liste.map((p) => p.id).join()) {
          if (stand?.stelle)
            stand = { ...stand, stelle: stelleNachziehen(liste, neu, stand.stelle) };
          punkte = neu;
          // „Weiter“ nach der Uhr rechnet von der gezeigten Stelle aus – die gehört zur neuen Liste.
          lageSchalten = liveLage(neu, stand, Date.now() - live.versatz, betriebsart);
          onAblauf?.(frisch);
        }
      }
      const ziel: LiveZiel =
        art === 'weiter'
          ? weiterZiel(punkte, stand, lageSchalten)
          : art === 'zurueck'
            ? zurueckZiel(punkte, stand, lageSchalten)
            : stand
              ? zusatzZiel(stand, art === 'plus' ? 1 : -1)
              : { stelle: 0, zusatzSek: 0 };
      const r = await schreiben(terminId, agendaId, ziel);
      if (!r.ok) {
        setSteuerFehler(r.grund);
        return;
      }
      let neuerStand = r.stand;
      if (wechselt) {
        // Festhalten, was geschaltet wurde (T4). Wird daraus nach der Regel (A19) ein Fehlklick, gleicht CT die Restzeit per
        // `addseconds` aus (T9) – erst danach kommt der Wechsel samt Ausgleich in den Verlauf.
        const k = wechselBeiKlick(
          verlaufJetzt,
          punkte,
          live.stand,
          wirksam?.zusatzSek ?? 0,
          r.stand,
        );
        let neue = k.neue;
        const f = k.fortsetzung;
        if (f && r.stand.stelle !== null && r.stand.seit !== null) {
          const { stelle, seit } = r.stand;
          let ausgeglichen = f.ausgleich === r.stand.zusatzSek;
          if (!ausgeglichen) {
            const r2 = await schreiben(terminId, agendaId, { stelle, zusatzSek: f.ausgleich });
            if (r2.ok) {
              neuerStand = r2.stand;
              ausgeglichen = true;
            }
          }
          // Ohne gelungenen Ausgleich steht der Wechsel ohne ihn da: Unsere Anzeige rechnet trotzdem richtig, nur die
          // Restzeit in CT-App und CT-Web bleibt vorerst bei der vollen Dauer.
          if (ausgeglichen) {
            neue = neue.map((w) =>
              w.zeit === seit && w.stelle === stelle ? { ...w, ausgleich: f.ausgleich } : w,
            );
          }
          setFehlklick({ zeit: seit, stelle });
        } else {
          setFehlklick(null);
        }
        verlauf.notieren(neue);
      }
      live.uebernehmen(neuerStand, Date.now());
    } finally {
      setBeschaeftigt(false);
    }
  }

  /**
   * **„Neu starten“** (A19): Der Punkt beginnt doch von vorn – ein normaler Wechsel. CT bekommt die Zusatzzeit 0 zurück (der
   * Ausgleich fällt weg), der Verlauf den Vermerk „neu“ am Wechsel; ohne gelungenes Schreiben in CT bleibt alles, wie es war.
   */
  async function neuStarten(): Promise<void> {
    if (!fehlklick) return;
    setBeschaeftigt(true);
    setSteuerFehler(null);
    try {
      const r = await schreiben(terminId, agendaId, { stelle: fehlklick.stelle, zusatzSek: 0 });
      if (!r.ok) {
        setSteuerFehler(r.grund);
        return;
      }
      const w = verlauf.verlauf.find(
        (x) => x.zeit === fehlklick.zeit && x.stelle === fehlklick.stelle,
      );
      if (w) verlauf.notieren([{ ...w, neu: true }]);
      live.uebernehmen(r.stand, Date.now());
      setFehlklick(null);
    } finally {
      setBeschaeftigt(false);
    }
  }

  // Der Hinweis steht nur kurz da – und gilt nur, solange der Stand noch der des Fehlklicks ist.
  useEffect(() => {
    if (!fehlklick) return;
    const id = window.setTimeout(() => setFehlklick(null), FEHLKLICK_HINWEIS_MS);
    return () => window.clearTimeout(id);
  }, [fehlklick]);
  const standSeit = live.stand?.seit ?? null;
  const standStelle = live.stand?.stelle ?? null;
  useEffect(() => {
    if (!fehlklick || standSeit === null) return;
    if (standSeit !== fehlklick.zeit || standStelle !== fehlklick.stelle) setFehlklick(null);
  }, [fehlklick, standSeit, standStelle]);

  function schliessen(): void {
    vollbild.beenden();
    onSchliessen();
  }

  useEffect(() => {
    wurzel.current?.focus();
    const taste = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'f' || ev.key === 'F') vollbildUmschalten();
      else if (ev.key === 'Escape') {
        // Im Vollbild beendet der Browser selbst das Vollbild – nicht zusätzlich schließen.
        if (document.fullscreenElement) return;
        onSchliessen();
      } else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [vollbildUmschalten, onSchliessen]);

  const jetztPunkt = lage.art === 'ende' ? null : lage.jetzt;
  const index = jetztPunkt ? liste.indexOf(jetztPunkt) : -1;
  // Der aktuelle Punkt bleibt in der Liste zu sehen.
  useEffect(() => {
    aktuell.current?.scrollIntoView?.({ block: 'nearest' });
  }, [index]);

  /** Titel mit Lied („Lied – Treu“) und Zuständige – aus der Zeile, die auch der Ablauf zeigt. */
  const teile = (p: LivePunkt) => {
    const z = zeileVon.get(p.id);
    if (!z) return { titel: p.title, wer: '', zeile: null };
    return {
      titel: itemLabel(z),
      wer: zustaendigeText(z),
      zeile: z,
    };
  };

  /**
   * Die Infos der Zeile in den Dienstgruppen, die gezeigt werden (`infoGruppen`) – mit Text, in Reihenfolge der Gruppen.
   * „Meine Anzeige“ (L4-5): Wer die Infos ausgeschaltet hat, sieht keine.
   */
  const infosVon = (z: AblaufZeile | null) =>
    (anzeige.infosMeinerGruppen ? infoGruppen : []).flatMap((g) => {
      const text = z?.infos?.find((i) => i.gruppeId === g.id)?.text;
      return text ? [{ gruppe: g.name, text }] : [];
    });

  const jetztTeile = jetztPunkt ? teile(jetztPunkt) : null;
  const dann = lage.art === 'ende' ? null : lage.dann;
  const mit = lage.art === 'ende' ? [] : lage.mit;

  // Restzeit: im Lauf aus dem Stand, nach Plan aus der Uhr.
  const rest =
    lage.art === 'laeuft'
      ? { sek: lage.restSek, dauer: lage.dauerSek }
      : lage.art === 'nach-plan' && lage.jetzt && lage.restSek !== null
        ? { sek: lage.restSek, dauer: lage.jetzt.dauerSek }
        : null;
  const ueber = rest !== null && rest.sek < 0;
  const anteil = rest && rest.dauer > 0 ? Math.min(1, Math.max(0, rest.sek / rest.dauer)) : 0;
  const konto = lage.konto;
  // ± je Punkt, „Warum“ und „Ende voraussichtlich“ – gerechnet in `shared/ct/liveVerlauf.ts` (T8), hier nur gezeigt.
  const abw = abweichungen(liste, laeufe, jetzt, wirksam?.stelle ?? null);
  const warum = warumPunkte(liste, abw);
  const prog = lage.art === 'ende' ? null : prognose(liste, konto);

  const label =
    lage.art === 'ende'
      ? 'Ende'
      : lage.art === 'nach-plan'
        ? lage.wartet
          ? `Wartet auf „${lage.jetzt ? 'Weiter' : 'Starten'}“`
          : 'Jetzt · nach Plan'
        : 'Jetzt';
  /** Der Satz unter „Jetzt“, solange niemand gestartet hat – je nach Betriebsart. */
  const nachPlanHinweis = (l: Extract<typeof lage, { art: 'nach-plan' }>): string => {
    const knopf = l.jetzt ? 'Weiter' : 'Starten';
    if (l.betriebsart === 'klicken')
      return `Nichts läuft von selbst – ${steuern ? `drück „${knopf}“` : `jemand drückt „${knopf}“`}, wenn es losgeht.`;
    if (l.betriebsart === 'bis-beginn' && l.weiterAbJetzt)
      return l.wartet
        ? `Beginn war um ${beginn}. ${steuern ? `Drück „${knopf}“, wenn es losgeht.` : `Es geht weiter, sobald jemand „${knopf}“ drückt.`}`
        : `Bis Beginn folgt „Jetzt“ der Uhr. Ab ${beginn} geht es weiter, wenn jemand „Weiter“ drückt.`;
    return 'Noch nicht gestartet – „Jetzt“ folgt der Uhr.';
  };
  const grossTitel =
    lage.art === 'ende'
      ? 'Ablauf vorbei'
      : (jetztTeile?.titel ??
        (lage.art === 'nach-plan' && lage.vorbei ? 'Laut Plan vorbei' : 'Noch nicht begonnen'));

  // Die Leiste unten nennt den vorigen und den nächsten Punkt – genau die, zu denen `zurueckZiel`/`weiterZiel` führen.
  const naechste = weiterZiel(liste, live.stand, lage).stelle;
  const vorige = zurueckZiel(liste, live.stand, lage).stelle;
  const weiterTitel =
    lage.art === 'ende'
      ? ''
      : naechste >= endeStelle(liste)
        ? 'Ende'
        : teile(liste[naechste - 1]).titel;
  const zurueckTitel = vorige <= 0 ? 'Noch nicht gestartet' : teile(liste[vorige - 1]).titel;
  // Nach der Uhr gibt es nur „Starten“ – außer die Betriebsart „bis Beginn“ zeigt schon einen Punkt: dann ‹ Zurück / Weiter ›.
  const nurStarten = lage.art === 'nach-plan' && !(lage.weiterAbJetzt && lage.jetzt !== null);

  const standVon =
    live.gelesenUm !== null ? uhrzeit(live.gelesenUm - live.versatz, zeitzone) : null;

  return (
    <BodyPortal>
      <div
        ref={wurzel}
        className={styles.live}
        role="dialog"
        aria-modal="true"
        aria-label={`Live: ${titel}`}
        tabIndex={-1}
      >
        <div className={styles.leiste}>
          <div className={styles.was}>
            <span
              className={`${styles.marke}${lage.art === 'laeuft' ? ` ${styles.laeuft}` : ''}`}
              data-laeuft={lage.art === 'laeuft'}
            >
              Live
            </span>
            <b>{titel}</b>
            <span className={styles.wann}>
              {tagKurz(tag)} · Beginn {beginn}
            </span>
          </div>
          <div className={styles.knoepfe}>
            <span className={styles.uhr} aria-label="Uhrzeit">
              {uhrzeit(jetzt, zeitzone)}
            </span>
            {vollbild.kann && (
              <KopfKnopf
                onClick={vollbildUmschalten}
                label={vollbild.an ? 'Vollbild beenden' : 'Vollbild'}
                symbol={<Icon name={vollbild.an ? 'vollbild-aus' : 'vollbild'} size={16} />}
              />
            )}
            <KopfKnopf
              onClick={schliessen}
              label="Schließen"
              symbol={<Icon name="x" size={16} />}
            />
          </div>
        </div>

        {live.fehler && (
          <p className={styles.fehler} role="status">
            {fehlerText(live.fehler, standVon)}
          </p>
        )}

        <div className={styles.rumpf}>
          <div className={styles.links}>
            <section className={styles.jetzt} aria-label="Jetzt">
              <span className={styles.etikett}>{label}</span>
              <h2>{grossTitel}</h2>
              {lage.art === 'nach-plan' && !lage.jetzt && !lage.vorbei && (
                <p className={styles.unter}>Beginn {beginn}</p>
              )}
              {lage.art === 'ende' && lage.seit !== null && (
                <p className={styles.unter}>Fertig um {uhrzeit(lage.seit, zeitzone)}</p>
              )}
              {/* Die Notiz wie in der Live-Agenda von ChurchTools („Thema folgt“, Test-Instanz 02.11.2026). */}
              {jetztTeile?.zeile?.note && <p className={styles.notiz}>{jetztTeile.zeile.note}</p>}
              {jetztTeile?.wer && <p className={styles.wer}>{jetztTeile.wer}</p>}
              {infosVon(jetztTeile?.zeile ?? null).map((x) => (
                <p key={x.gruppe} className={styles.info}>
                  <i>{x.gruppe}:</i> {x.text}
                </p>
              ))}
              {mit.length > 0 && (
                <p className={styles.unter}>mit {mit.map((p) => teile(p).titel).join(', ')}</p>
              )}
              {lage.art === 'nach-plan' && (
                <p className={styles.hinweis}>{nachPlanHinweis(lage)}</p>
              )}
            </section>

            {dann && (
              <section className={styles.dann} aria-label="Dann">
                <span className={styles.etikett}>Dann</span>
                {dann === 'ende' ? (
                  <b>Ende</b>
                ) : (
                  <>
                    <b>{teile(dann).titel}</b>
                    {teile(dann).wer && <span className={styles.wer}>{teile(dann).wer}</span>}
                  </>
                )}
              </section>
            )}

            <ol className={styles.liste} aria-label="Ablauf">
              {items.map((item, n) => {
                // Die Grenze „Beginn“: vor der ersten Zeile nach dem Vorlauf (`isBeforeEvent` wechselt von ja auf nein).
                const grenze =
                  n > 0 && items[n - 1].isBeforeEvent === true && item.isBeforeEvent !== true ? (
                    <li key={`beginn-${item.id}`} className={styles.beginn} role="presentation">
                      <span>Beginn</span>
                      <span>{beginn}</span>
                    </li>
                  ) : null;
                // Überschriften nur anzeigen – dieselbe Prüfung wie in `liveListe`, damit beides zusammenpasst.
                if (item.type === 'header')
                  return (
                    <Fragment key={item.id}>
                      {grenze}
                      <li className={styles.band} role="presentation">
                        <span role="heading" aria-level={3}>
                          {item.title}
                        </span>
                      </li>
                    </Fragment>
                  );
                const i = indexVon.get(item.id) ?? -1;
                const p = liste[i];
                if (!p) return null;
                const t = teile(p);
                const erledigt =
                  lage.art === 'ende' || (lage.art === 'laeuft' && i < lage.stelle - 1);
                const klasse = [
                  styles.punkt,
                  p.weggelassen ? styles.weggelassen : erledigt ? styles.erledigt : '',
                  i === index ? styles.aktuell : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                // Infos der eigenen Dienstgruppen klein darunter – auch beim laufenden Punkt, nicht bei erledigten (A16).
                const infos = erledigt || p.weggelassen ? [] : infosVon(t.zeile);
                const a = abw.get(p.id);
                const delta =
                  erledigt && !p.weggelassen && i !== index && a && !a.laeuft ? a.sek : null;
                return (
                  <Fragment key={p.id}>
                    {grenze}
                    <li
                      ref={i === index ? aktuell : undefined}
                      className={klasse}
                      aria-current={i === index ? 'step' : undefined}
                    >
                      <span className={styles.zeit}>{t.zeile?.time ?? ''}</span>
                      <span className={styles.titel}>
                        {erledigt && !p.weggelassen && (
                          <Icon name="check" size={14} className={styles.haken} />
                        )}
                        {t.titel}
                      </span>
                      <span className={styles.werKlein}>{t.wer}</span>
                      {delta !== null && (
                        <span
                          className={`${styles.delta}${delta > 0 ? ` ${styles.deltaPlus}` : delta < 0 ? ` ${styles.deltaMinus}` : ''}`}
                          aria-label={`Plus/Minus ${kontoText(delta)}`}
                        >
                          {kontoText(delta)}
                        </span>
                      )}
                      {infos.map((x) => (
                        <span key={x.gruppe} className={styles.infoKlein}>
                          <i>{x.gruppe}:</i> {x.text}
                        </span>
                      ))}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </div>

          <div className={styles.rechts}>
            {rest && (
              <div
                className={`${styles.ring}${ueber ? ` ${styles.ueber}` : ''}`}
                aria-label="Restzeit"
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className={styles.spur} cx="50" cy="50" r="44" />
                  {/* Ohne Rest kein Bogen – die runde Kappe ließe sonst einen Punkt oben stehen. */}
                  {anteil > 0 && (
                    <circle
                      className={styles.fortschritt}
                      cx="50"
                      cy="50"
                      r="44"
                      style={{ strokeDasharray: `${(anteil * 276.5).toFixed(1)} 276.5` }}
                    />
                  )}
                </svg>
                <div className={styles.zahl}>
                  <b>{restText(rest.sek)}</b>
                  <span>
                    {ueber ? (
                      'über der Zeit'
                    ) : (
                      <>
                        noch
                        <span className={styles.vonDauer}>
                          , von {Math.round(rest.dauer / 60)} Min
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
            {konto !== null && (
              <div
                className={`${styles.konto}${konto > 0 ? ` ${styles.plus}` : konto < 0 ? ` ${styles.minus}` : ''}`}
                aria-label="Zeitkonto"
              >
                Zeitkonto
                <b>{kontoText(konto)}</b>
                <span>{kontoWort(konto)}</span>
              </div>
            )}
            {prog && (
              <div className={styles.prog} aria-label="Voraussichtliches Ende">
                <div className={styles.progEnde}>
                  <span>Ende voraussichtlich</span>
                  <b className={Math.round(prog.konto) < 0 ? styles.progSpaeter : undefined}>
                    {uhrzeit(prog.ende, zeitzone)}
                  </b>
                </div>
                <div className={styles.progPlan}>
                  Plan {uhrzeit(prog.plan, zeitzone)} · wenn der Rest nach Plan läuft
                </div>
                {warum.length > 0 && (
                  <ul className={styles.warum} aria-label="Warum">
                    {warum.map((x) => (
                      <li key={x.punkt.id}>
                        <span>{teile(x.punkt).titel}</span>
                        <i className={x.sek > 0 ? styles.deltaPlus : styles.deltaMinus}>
                          {kontoText(x.sek)}
                        </i>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {steuern && (
          <div
            className={`${styles.fuss}${nurStarten ? ` ${styles.nurStarten}` : ''}`}
            role="group"
            aria-label="Live-Agenda steuern"
          >
            {nurStarten ? (
              <KopfKnopf
                onClick={() => void schalten('weiter')}
                label="Starten"
                title="Live-Agenda starten"
                symbol={<Icon name="play" size={16} />}
                haupt
                disabled={beschaeftigt}
              />
            ) : (
              <>
                <NachbarKnopf
                  richtung="davor"
                  label="ZURÜCK"
                  titel={zurueckTitel}
                  onClick={() => void schalten('zurueck')}
                  disabled={beschaeftigt}
                  ariaLabel="Zum vorigen Punkt"
                  hinweis={`Zum vorigen Punkt: ${zurueckTitel}`}
                />
                <div className={styles.mitte}>
                  {lage.art === 'laeuft' && anzeige.minutenKnoepfe && (
                    <>
                      <KopfKnopf
                        onClick={() => void schalten('minus')}
                        label="1 Min"
                        title="Eine Minute weniger"
                        symbol={<Icon name="minus" size={16} />}
                        disabled={beschaeftigt}
                      />
                      <KopfKnopf
                        onClick={() => void schalten('plus')}
                        label="1 Min"
                        title="Eine Minute mehr"
                        symbol={<Icon name="plus" size={16} />}
                        disabled={beschaeftigt}
                      />
                    </>
                  )}
                </div>
                <NachbarKnopf
                  richtung="danach"
                  label="WEITER"
                  titel={weiterTitel}
                  onClick={() => void schalten('weiter')}
                  disabled={beschaeftigt || lage.art === 'ende'}
                  haupt
                  ariaLabel="Zum nächsten Punkt"
                  hinweis={`Zum nächsten Punkt: ${weiterTitel}`}
                />
              </>
            )}
            {fehlklick && (
              <p className={styles.fehlklick} role="status">
                <span>Zeit läuft weiter – Fehlklick nicht gezählt ·</span>
                <TextKnopf onClick={() => void neuStarten()} disabled={beschaeftigt}>
                  Neu starten
                </TextKnopf>
              </p>
            )}
            {steuerFehler && (
              <p className={styles.steuerFehler} role="alert">
                {steuerFehlerText(steuerFehler)}
              </p>
            )}
          </div>
        )}
      </div>
    </BodyPortal>
  );
}
