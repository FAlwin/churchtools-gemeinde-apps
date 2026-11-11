import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  pruefeAntworten,
  type Antworten,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  neueAnmeldeNr,
  personenNamen,
  type Abgeschickt,
  type PreisWahl,
} from '@shared/anmeldung/senden';
import { platzPlan, type PlatzStand } from '@shared/anmeldung/oeffentlich';
import { SPAM_TEXT, spamGrund } from '@shared/anmeldung/spamschutz';
import type { Ansicht } from './FormularRahmen';

/**
 * **Echt abschicken** (öffentliches Formular, A6-2). Wirft bei einem Fehler einen `Error`, dessen Text die Person
 * liest – die Eingaben bleiben stehen. Kommt nur ein Teil durch (#602: jede Person einzeln), sagt das Ergebnis es je
 * Person; `nur` schickt dann die offen gebliebenen noch einmal.
 */
export type Abschicken = (a: {
  antworten: Antworten;
  wahl: PreisWahl;
  nur?: number[];
  /** Anmelde-Nr. (A6-5a) – einmal je Formular, bei „noch einmal“ dieselbe. */
  nr: string;
}) => Promise<Abgeschickt>;

/**
 * **Freie Plätze im Formular** (#602; #845, Scheibe 4d-2: aus `AnmeldeFormular` herausgezogen, unverändert) – der Stand
 * beim Laden und, beim Hinzufügen einer Person, frisch von ChurchTools nachgefragt. Kein Platz mehr und keine
 * Warteliste → keine weitere Person.
 */
export function usePlaetze({
  ansicht,
  baukasten,
  plaetzeNachfragen,
  antworten,
  setAntworten,
}: {
  ansicht: Ansicht;
  baukasten: boolean;
  plaetzeNachfragen?: () => Promise<PlatzStand>;
  antworten: Antworten;
  setAntworten: Dispatch<SetStateAction<Antworten>>;
}) {
  // Freie Plätze (#602): beim Laden, beim Hinzufügen frisch nachgefragt. Ohne Angabe (Vorschau) kein Hinweis.
  const [platz, setPlatz] = useState<PlatzStand | null>(() =>
    ansicht.freiePlaetze === undefined
      ? null
      : { freiePlaetze: ansicht.freiePlaetze, warteliste: ansicht.warteliste === true },
  );
  const [fragtNach, setFragtNach] = useState(false);

  async function hinzufuegen() {
    if (baukasten || fragtNach) return;
    let stand = platz;
    if (plaetzeNachfragen) {
      setFragtNach(true);
      try {
        stand = await plaetzeNachfragen();
        setPlatz(stand);
      } catch {
        // Vorübergehend ist nicht ungültig: mit dem letzten Stand weiter, ChurchTools entscheidet beim Absenden.
      } finally {
        setFragtNach(false);
      }
    }
    if (stand && platzPlan(stand, antworten.personen.length + 1).at(-1) === 'kein') return;
    setAntworten((a) => ({ ...a, personen: [...a.personen, {}] }));
  }

  return { platz, fragtNach, hinzufuegen };
}

/**
 * **Absenden** (A6-2; #845, Scheibe 4d-2: aus `AnmeldeFormular` herausgezogen, unverändert) – prüfen, gegen Spam
 * schützen (A6-3: Honigtopf, Mindest-Ausfüllzeit), echt abschicken oder nur zeigen, was herauskäme (Vorschau,
 * Probelauf); „Noch einmal“ schickt nur die offen gebliebenen Personen, mit derselben Anmelde-Nr.
 */
export function useAbsenden({
  e,
  antworten,
  option,
  extras,
  preis,
  echt,
  baukasten,
  onAbsenden,
}: {
  e: OeffentlicheEinstellungen;
  antworten: Antworten;
  option: number;
  extras: boolean[];
  preis: { ausgebucht: boolean };
  echt: boolean;
  baukasten: boolean;
  onAbsenden?: Abschicken;
}) {
  const [fehler, setFehler] = useState<string[]>([]);
  const [fertig, setFertig] = useState<Abgeschickt | null>(null);
  const [sendet, setSendet] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  const [nochmalFehler, setNochmalFehler] = useState<string | null>(null);
  const [nr] = useState(neueAnmeldeNr);
  // A6-3 Spam-Schutz (`spamschutz.ts`): Honigtopf und Mindest-Ausfüllzeit seit dem Laden. Doppel-Absenden verhindert
  // schon `sendet` – React zeichnet nach jedem Klick neu (gegengeprüft 16.10.2026).
  const honigtopf = useRef<HTMLInputElement>(null);
  const [geladen] = useState(() => Date.now());

  async function nochmal(offen: number[]) {
    if (!onAbsenden || sendet) return;
    setSendet(true);
    setNochmalFehler(null);
    try {
      const neu = await onAbsenden({ antworten, wahl: { option, extras }, nur: offen, nr });
      setFertig((alt) =>
        alt
          ? {
              ...alt,
              personen: alt.personen.map((x) => neu.personen.find((y) => y.index === x.index) ?? x),
              meldung: neu.meldung,
            }
          : neu,
      );
    } catch (fehler) {
      setNochmalFehler(fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.');
    } finally {
      setSendet(false);
    }
  }

  async function absenden() {
    if (baukasten || sendet) return;
    const offen = pruefeAntworten(e.formular, antworten);
    setFehler(offen);
    if (offen.length > 0) return;
    // A6-5b: ausgebuchte Option – nichts schicken (der Hinweis steht schon über dem Knopf).
    if (preis.ausgebucht && e.preis.grundpreis.art === 'auswahl') return;
    if (!echt || !onAbsenden) {
      setFertig({
        personen: personenNamen(e, antworten).map((name, index) => ({
          index,
          name,
          ergebnis: 'angemeldet',
        })),
        mail: typeof antworten.anmeldung.mail === 'string' ? antworten.anmeldung.mail : '',
      });
      return;
    }
    const spam = spamGrund({
      honigtopf: honigtopf.current?.value ?? '',
      seitDemLadenMs: Date.now() - geladen,
    });
    if (spam) {
      setSendeFehler(SPAM_TEXT[spam]);
      return;
    }
    setSendet(true);
    setSendeFehler(null);
    try {
      setFertig(await onAbsenden({ antworten, wahl: { option, extras }, nr }));
    } catch (fehler) {
      // Vorübergehend ist nicht endgültig: Die Eingaben bleiben stehen, ein zweiter Klick versucht es noch einmal.
      setSendeFehler(fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.');
    } finally {
      setSendet(false);
    }
  }

  return {
    fehler,
    fertig,
    setFertig,
    sendet,
    sendeFehler,
    nochmalFehler,
    honigtopf,
    nochmal,
    absenden,
  };
}
