import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import type { Schreiber } from '@shared/ct/sperre';
import { einstellungenGleich } from '@shared/website/aussehen';
import { einstellungenMeldung } from '@shared/website/einstellungen';
import type { Einstellungen } from '@shared/website/modell';
import { vorlaeufigeEinstellungen } from '@shared/website/seitenListe';
import type { WebsiteStand } from '@shared/website/speicher';
import {
  beendeEinstellungen,
  beginneEinstellungen,
  ladeWebsite,
  speichereEinstellungen,
  uebernimmEinstellungen,
  type EinstellungenBeginn,
  type EntwurfsOrt,
} from './daten';
import {
  Kontext,
  SPEICHER_VERZOEGERUNG_MS,
  type EinstellungenBereit,
  type EinstellungenQuelle,
  type EinstellungenWert,
  type JetztErgebnis,
} from './einstellungenKontext';
import { AUSSEHEN_TEXTE } from './sperrTexte';
import { useSperrarbeit, type Beginn } from './useSperrarbeit';

/**
 * **EIN Zustand, EIN Schreiber für die Einheit `einstellungen`** (Bauplan Website W3a-3b). Der Reiter „Aussehen“ und das
 * Fenster „Einstellungen“ ändern dieselbe gespeicherte Einheit. Hätte jedes seinen eigenen Arbeitsstand samt Sperre,
 * überschriebe das eine beim Speichern, was das andere geändert hat (der Speicher kennt keine Versionen – die spätere
 * Schreibung gewinnt). Darum liegt der Arbeitsstand **hier**, über beiden: Beide lesen und ändern ihn über denselben
 * `aendern`/`speichereJetzt`, eine Sperre, eine Schlange, ein Lebenszeichen.
 *
 * Der Provider steht nur, solange einer der beiden offen ist (die App hängt ihn um beide): Wer das Aussehen verlässt und kein
 * Fenster offen hat, gibt die Sperre frei – wie bisher. Gelesen wird die ganze Kategorie mit einem Aufruf, wie bei den Seiten.
 * Lassen sich gespeicherte Einstellungen nicht lesen, wird nichts angeboten: Sonst überschriebe der erste Handgriff etwas,
 * das sich vielleicht noch retten lässt.
 */
export function EinstellungenProvider({
  ort,
  gemeinde,
  ich,
  children,
}: {
  ort: EntwurfsOrt;
  gemeinde: string | null;
  /** Wer bearbeitet – für die Sperre. */
  ich: Schreiber;
  children: ReactNode;
}) {
  const { modul, kategorie } = ort;
  const geladen = useLaden(() => ladeWebsite({ modul, kategorie }), [modul, kategorie], {
    behalten: true,
  });
  const stand = geladen.stand.art === 'fertig' ? geladen.stand.daten : null;
  const unlesbar = stand?.probleme.filter((p) => p.einheit === 'einstellungen') ?? [];

  if (stand && unlesbar.length === 0) {
    return (
      <Arbeit
        stand={stand}
        ort={ort}
        gemeinde={gemeinde}
        ich={ich}
        neuFehler={geladen.stand.art === 'fertig' ? geladen.stand.neuFehler : undefined}
        neu={geladen.neu}
      >
        {children}
      </Arbeit>
    );
  }
  const quelle: EinstellungenQuelle = stand
    ? { art: 'unlesbar', probleme: unlesbar }
    : geladen.stand.art === 'fehler'
      ? { art: 'fehler', fehler: geladen.stand.fehler, neu: geladen.neu }
      : { art: 'laedt' };
  return <Kontext.Provider value={quelle}>{children}</Kontext.Provider>;
}

function alsBeginn(b: EinstellungenBeginn): Beginn<EinstellungenWert> {
  if (b.art === 'gesperrt') return b;
  return { art: 'ok', frisch: { wert: b.einstellungen } };
}

function Arbeit({
  stand,
  ort,
  gemeinde,
  ich,
  neuFehler,
  neu,
  children,
}: {
  stand: WebsiteStand;
  ort: EntwurfsOrt;
  gemeinde: string | null;
  ich: Schreiber;
  neuFehler: Fehlermeldung | undefined;
  neu: () => void;
  children: ReactNode;
}) {
  const anfang = (e: EinstellungenWert): Einstellungen => e ?? vorlaeufigeEinstellungen(gemeinde);
  const [arbeit, setArbeit] = useState<Einstellungen>(() => anfang(stand.einstellungen));
  const arbeitRef = useRef(arbeit);
  const [meldung, setMeldung] = useState<string | null>(null);

  const aktuell = useRef({ ort, ich });
  aktuell.current = { ort, ich };

  // Was zu speichern ansteht, aber noch wartet (Verzögerung) – und wie es abgeschickt wird.
  const ausstehend = useRef<Einstellungen | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abschickenRef = useRef<() => void>(() => {});
  // **Vor dem Ablauf (`useSperrarbeit`) angelegt**: Beim Verlassen räumt React in dieser Reihenfolge auf – erst wird abgeschickt,
  // dann gibt der Ablauf die Sperre frei (und wartet dafür das laufende Speichern ab).
  useEffect(() => {
    const beiPagehide = () => abschickenRef.current();
    window.addEventListener('pagehide', beiPagehide);
    return () => {
      window.removeEventListener('pagehide', beiPagehide);
      abschickenRef.current();
    };
  }, []);

  const sperre = useSperrarbeit<EinstellungenWert>({
    ich,
    anfangFremd: stand.einstellungenSperre,
    anfang: stand.einstellungen,
    texte: AUSSEHEN_TEXTE,
    beginne: async () =>
      alsBeginn(await beginneEinstellungen(aktuell.current.ort, aktuell.current.ich)),
    uebernimm: async () =>
      alsBeginn(await uebernimmEinstellungen(aktuell.current.ort, aktuell.current.ich)),
    beende: () => beendeEinstellungen(aktuell.current.ort, aktuell.current.ich),
    gleich: einstellungenGleich,
    schreibe: async (wert) => {
      // Gespeichert wird nur etwas Fertiges: `null` („nichts gespeichert“) kommt aus dem Lesen, nie aus der Warteschlange.
      if (wert) await speichereEinstellungen(aktuell.current.ort, wert);
    },
    anwenden: (wert) => {
      const e = anfang(wert);
      arbeitRef.current = e;
      setArbeit(e);
      ausstehend.current = null;
      if (timer.current) clearTimeout(timer.current);
      setMeldung(null);
    },
    nachSpeichern: () => {},
    onOffen: () => {},
  });
  const { schlange, sicherstellen, setHinweis } = sperre;

  abschickenRef.current = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const wert = ausstehend.current;
    ausstehend.current = null;
    if (wert) schlange.anfordern(wert);
  };

  /** Prüfen und – nach kurzer Wartezeit – speichern. Ungültiges wird nie geschrieben, die Meldung bleibt stehen. */
  const planen = (neuerStand: Einstellungen) => {
    const m = einstellungenMeldung(neuerStand);
    if (m) {
      ausstehend.current = null;
      if (timer.current) clearTimeout(timer.current);
      setMeldung(m);
      return;
    }
    setMeldung(null);
    ausstehend.current = neuerStand;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => abschickenRef.current(), SPEICHER_VERZOEGERUNG_MS);
  };

  /** Eine Änderung: erst die Sperre (wie bei den Seiten vor dem ersten Handgriff), dann übernehmen und speichern. */
  const aendern = async (f: (e: Einstellungen) => Einstellungen) => {
    setHinweis(null);
    if (!(await sicherstellen())) return;
    const neuerStand = f(arbeitRef.current);
    if (neuerStand === arbeitRef.current) return;
    arbeitRef.current = neuerStand;
    setArbeit(neuerStand);
    planen(neuerStand);
  };

  const speichereJetzt = async (f: (e: Einstellungen) => Einstellungen): Promise<JetztErgebnis> => {
    setHinweis(null);
    if (!(await sicherstellen())) return { art: 'abgelehnt' };
    // `arbeitRef` ist der neueste Stand – auch eine Änderung im Aussehen, die noch auf ihre Verzögerung wartet, steckt darin.
    const neuerStand = f(arbeitRef.current);
    const m = einstellungenMeldung(neuerStand);
    if (m) return { art: 'ungueltig', meldung: m };
    arbeitRef.current = neuerStand;
    setArbeit(neuerStand);
    setMeldung(null);
    // Den Stand JETZT speichern und die wartende Verzögerung gegenstandslos machen (er enthält alles).
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ausstehend.current = null;
    schlange.anfordern(neuerStand);
    return { art: 'ok' };
  };

  const wert: EinstellungenBereit = {
    art: 'bereit',
    stand,
    gemeinde,
    ich,
    arbeit,
    meldung,
    sperre,
    aendern,
    abschicken: () => abschickenRef.current(),
    speichereJetzt,
    neuFehler,
    neu,
  };
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
