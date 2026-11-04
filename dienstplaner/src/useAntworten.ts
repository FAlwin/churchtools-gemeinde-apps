import { useEffect, useRef, useState } from 'react';
import {
  absagen as absagenKern,
  antwortSchluessel,
  letzteAus,
  rueckgaengig as rueckgaengigKern,
  zusagen as zusagenKern,
  type Antwort,
  type AntwortErgebnis,
} from '@shared/dienstplan/antworten';
import type { DienstPort } from '@shared/dienstplan/einteilen';
import type { MeinDienst } from '@shared/dienstplan/termine';
import { dienstPort } from './dienstPort';
import { antwortFehlerText } from './antwortTexte';
import { useToast } from '@ui/fenster/useToast';

export type Vorgang = 'zusagen' | 'absagen' | 'rueckgaengig';

/** Was Startseite und „Dienste“ zum Beantworten brauchen – aus `useAntworten`. */
export interface Antworten {
  /** Die eben gegebenen Antworten (Schlüssel `antwortSchluessel`) – für `mitAntworten`. */
  karte: ReadonlyMap<string, Antwort>;
  /** Jetzt (ms) – läuft alle 15 s weiter, solange es Antworten gibt; damit fällt „Rückgängig“ nach zehn Minuten weg. */
  jetzt: number;
  /** Was an diesem Platz gerade läuft – damit nur der Knopf „… läuft“ zeigt, der gedrückt wurde. */
  laeuft: (terminId: number, d: MeinDienst) => Vorgang | null;
  fehler: (terminId: number, d: MeinDienst) => string | null;
  zusagen: (terminId: number, d: MeinDienst) => Promise<void>;
  /** `true`, wenn abgesagt – dann schließt das Fenster. */
  absagen: (terminId: number, d: MeinDienst, grund: string) => Promise<boolean>;
  rueckgaengig: (terminId: number, d: MeinDienst) => Promise<void>;
  /**
   * Ein kurzer Hinweis unten (`Toast`) – wenn sich eine Anfrage inzwischen geändert hat: Die Liste lädt dann neu, die
   * Zeile mit der Meldung kann dabei verschwinden.
   */
  meldung: string | null;
  /** Mehrere Anfragen nacheinander zusagen (eine Anfrage je Schreiben, wie ChurchTools es will). */
  alleZusagen: (liste: { terminId: number; d: MeinDienst }[]) => Promise<void>;
}

/**
 * **Anfragen beantworten** (E7-1) – der Zustand für Startseite und „Dienste“, an einer Stelle in der App, damit beide
 * dasselbe zeigen. Nach jeder Änderung meldet `onGeaendert`: Die App lädt die Termine dann leise neu (wie nach Infos
 * und Dateien, T2b). Die Regeln stehen im Kern (`@shared/dienstplan/antworten`).
 */
export function useAntworten(
  ichId: number,
  onGeaendert: () => void,
  port: DienstPort = dienstPort,
): Antworten {
  const [karte, setKarte] = useState<ReadonlyMap<string, Antwort>>(new Map());
  const [laeuftKarte, setLaeuft] = useState<ReadonlyMap<string, Vorgang>>(new Map());
  const [fehlerKarte, setFehler] = useState<ReadonlyMap<string, string>>(new Map());
  const [jetzt, setJetzt] = useState(() => Date.now());
  const { toast, showToast } = useToast();
  const geaendert = useRef(onGeaendert);
  geaendert.current = onGeaendert;

  // Die Uhr läuft nur, solange es etwas zurückzunehmen gibt.
  useEffect(() => {
    if (karte.size === 0) return;
    const uhr = setInterval(() => setJetzt(Date.now()), 15_000);
    return () => clearInterval(uhr);
  }, [karte.size]);

  const schluessel = (terminId: number, d: MeinDienst) =>
    d.ort ? antwortSchluessel(terminId, d.ort) : null;

  async function ausfuehren(
    vorgang: Vorgang,
    terminId: number,
    d: MeinDienst,
    tun: (ort: {
      eventId: number;
      serviceId: number;
      index: number | null;
    }) => Promise<AntwortErgebnis>,
    danach: (r: AntwortErgebnis, k: string) => void,
  ): Promise<boolean> {
    const k = schluessel(terminId, d);
    if (!k || !d.ort) return false;
    setLaeuft((m) => new Map(m).set(k, vorgang));
    setFehler((m) => {
      const n = new Map(m);
      n.delete(k);
      return n;
    });
    try {
      const r = await tun({ eventId: terminId, ...d.ort });
      if (r.ok) {
        danach(r, k);
        geaendert.current();
        return true;
      }
      setFehler((m) => new Map(m).set(k, antwortFehlerText(r.grund)));
      // Hat sich die Anfrage geändert, stimmt auch die Liste nicht mehr – sie lädt neu, die Zeile kann verschwinden.
      if (r.grund === 'konflikt' || r.grund === 'weg') {
        showToast(antwortFehlerText(r.grund));
        geaendert.current();
      }
      if (r.grund === 'zu-spaet') {
        setKarte((m) => {
          const a = m.get(k);
          return a ? new Map(m).set(k, { ...a, letzte: null }) : m;
        });
      }
      return false;
    } finally {
      setLaeuft((m) => {
        const n = new Map(m);
        n.delete(k);
        return n;
      });
    }
  }

  const merken = (art: Antwort['art'], d: MeinDienst) => (r: AntwortErgebnis, k: string) => {
    const seit = Date.now();
    setJetzt(seit);
    // Der Dienst, wie er vor der Antwort war – ohne eine frühere Antwort daran.
    const mein: MeinDienst = { ...d, antwort: undefined };
    setKarte((m) => new Map(m).set(k, { art, seit, letzte: letzteAus(art, r), mein }));
  };

  async function zusagen(terminId: number, d: MeinDienst): Promise<void> {
    await ausfuehren(
      'zusagen',
      terminId,
      d,
      (ort) => zusagenKern(port, ort, ichId),
      merken('zugesagt', d),
    );
  }

  return {
    karte,
    jetzt,
    meldung: toast,
    laeuft: (t, d) => {
      const k = schluessel(t, d);
      return (k && laeuftKarte.get(k)) || null;
    },
    fehler: (t, d) => {
      const k = schluessel(t, d);
      return (k && fehlerKarte.get(k)) || null;
    },
    zusagen,
    absagen: (terminId, d, grund) =>
      ausfuehren(
        'absagen',
        terminId,
        d,
        (ort) => absagenKern(port, ort, ichId, grund),
        merken('abgesagt', d),
      ),
    rueckgaengig: async (terminId, d) => {
      const letzte = d.antwort?.letzte;
      if (!letzte) return;
      await ausfuehren(
        'rueckgaengig',
        terminId,
        d,
        (ort) => rueckgaengigKern(port, ort, ichId, letzte),
        (_r, k) =>
          setKarte((m) => {
            const n = new Map(m);
            n.delete(k);
            return n;
          }),
      );
    },
    alleZusagen: async (liste) => {
      for (const { terminId, d } of liste) await zusagen(terminId, d);
    },
  };
}
