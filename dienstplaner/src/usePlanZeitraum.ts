import { useEffect, useMemo, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { planAusschnitt, type Plan } from '@shared/dienstplan/plan';
import { terminFilter } from '@shared/dienstplan/termine';
import {
  passendeAnzahl,
  schritt,
  sichtbar,
  type Fenster,
  type FensterSchritt,
} from '@shared/dienstplan/fenster';
import {
  ladeGrenzen,
  mitDazu,
  zeitraumDazu,
  zeitraumGrenzen,
  spanneText,
  zeitraumText,
  type Zeitraum,
} from '@shared/ct/zeitraum';
import type { TermineZustand } from './Termine';
import type { TermineDaten } from './ladeTermine';
import { ansichtAus, type PlanenAnsicht } from './planenAnsicht';

/**
 * **Zeitraum und Fenster in „Planen“** (E3-4, E9-3; #845, Scheibe 4a-3: aus der Komponente herausgezogen,
 * unverändert): welcher Zeitraum gilt (je Unteransicht ein eigener), was dafür geladen ist (`quelle` – „ab heute“ von
 * der App, ein gewählter Zeitraum hier, leise bei ＋ und nach dem Senden), welcher Ausschnitt davon zu sehen ist
 * (Fenster, ‹ ›, Nachladen am Ende) und was der Zeitraum-Knopf dazu sagt.
 */
export function usePlanZeitraum({
  ansicht,
  setAnsicht,
  zustand,
  heute,
  ladeZeitraum,
  platz,
  handy,
  mehrMoeglich,
  onMehr,
  onAktualisieren,
}: {
  ansicht: PlanenAnsicht;
  setAnsicht: (a: PlanenAnsicht) => void;
  /** „Ab heute“ – lädt die App (Reiter `termine`). */
  zustand: TermineZustand;
  heute: string;
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  /** Platz für Spalten (`useBreite`). */
  platz: number;
  handy: boolean;
  mehrMoeglich: boolean;
  onMehr: () => void;
  onAktualisieren?: () => void;
}) {
  const [fenster, setFenster] = useState<Fenster>({ start: 0, anzahl: null });

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
  const zSchluessel = JSON.stringify(z);
  const rand = useMemo(() => {
    if (!grenzen) return null;
    const { zeigt } = terminFilter(geladen?.spalten ?? [], ansichtAus(ansicht));
    const tage = (geladen?.spalten ?? []).map((sp) => ({ tag: sp.tag, sichtbar: zeigt(sp) }));
    return mitDazu(tage, grenzen, dazu);
    // `grenzen` und `dazu` stecken in `bereich` und `z`, vom Filter zählen nur die ausgeblendeten Listen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geladen, bereich, zSchluessel, ansicht.ausgeblendeteArten, ansicht.ausgeblendeteKalender]);
  const plan = useMemo(
    () => (geladen && rand && dazu ? planAusschnitt(geladen, rand.von, rand.bis) : geladen),
    [geladen, rand, dazu],
  );

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

  /** ChurchTools hat sich geändert (gesendet, Plätze): die Termine neu – leise, ohne „wird geladen“. */
  const leiseNeuLaden = () => {
    if (bereich) zeitraumNeu();
    else onAktualisieren?.();
  };

  return {
    personen,
    z,
    setzeZeitraum,
    bereich,
    quelle,
    zeitraumNeu,
    plan,
    d,
    f,
    imFenster,
    kannNachladen,
    nachladen,
    gehe,
    waehleZeitraum,
    nimmDazu,
    teilenSpalten,
    zeile1,
    zeile2,
    leiseNeuLaden,
  };
}

/** Gefilterte Spalten und wie viele „passend“ ins Fenster gehen – für Anzeige und Nachladen gleich. */
function fensterDaten(plan: Plan, ansicht: PlanenAnsicht, platz: number) {
  const { zeigt } = terminFilter(plan.spalten, ansichtAus(ansicht));
  const gefiltert = plan.spalten.map((_, i) => i).filter((i) => zeigt(plan.spalten[i]));
  return { gefiltert, passend: passendeAnzahl(platz, ansicht.breite, gefiltert.length) };
}
