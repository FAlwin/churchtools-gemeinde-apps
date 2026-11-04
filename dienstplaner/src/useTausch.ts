import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ausgangAus,
  eingangAus,
  einteilungenAus,
  einteilungSchluessel,
  kandidatenFuer,
  tauschAblehnen,
  tauschAnfragen,
  tauschAnnehmen,
  tauschZurueckziehen,
  type Ausgang,
  type Eingang,
  type Einteilung,
  type Kandidat,
  type TauschErgebnis,
  type TauschPort,
} from '@shared/dienstplan/tausch';
import { mapLimit } from '@shared/ct/mapLimit';
import { tagKurz } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { useToast } from '@ui/fenster/useToast';
import { tauschPort } from './tauschPort';
import { tauschFehlerText, TAUSCH_VORUEBERGEHEND } from './tauschTexte';

export type TauschVorgang = 'anfragen' | 'zurueckziehen' | 'annehmen' | 'ablehnen';

/** Was Startseite und „Dienste“ zum Tauschen brauchen – aus `useTausch`. */
export interface Tausch {
  /** Der Stand an einem eigenen Dienst: offen, abgelehnt, nichts (`null`) – `undefined`, solange unbekannt. */
  stand: (
    terminId: number,
    ort: { serviceId: number; index: number | null },
  ) => Ausgang | null | undefined;
  /** Tausch-Anfragen an mich (unbeantwortet). */
  eingang: Eingang[];
  /** Eben angenommen – „Getauscht – du hast jetzt …“, bis die Seite neu lädt. */
  getauscht: { id: number; text: string }[];
  /** Der Name meines Dienstes zu einer Tausch-Anfrage an mich (aus meinen Einteilungen). */
  dienstZu: (e: Eingang) => string;
  laeuft: (schluessel: string) => TauschVorgang | null;
  fehler: (schluessel: string) => string | null;
  kandidaten: (schluessel: string) => Promise<Kandidat[] | null>;
  /** `true`, wenn angefragt – dann schließt das Fenster. */
  anfragen: (schluessel: string, ziel: number) => Promise<boolean>;
  zurueckziehen: (schluessel: string, id: number) => Promise<void>;
  annehmen: (e: Eingang) => Promise<void>;
  ablehnen: (e: Eingang) => Promise<void>;
  meldung: string | null;
}

/** Schlüssel für Eingangs-Anfragen (Annehmen/Ablehnen), getrennt von den Einteilungen. */
export const eingangSchluessel = (e: Eingang) => `eingang:${e.id}`;

/**
 * **Dienste tauschen** (E7-3) – der Zustand für Startseite und „Dienste“, an einer Stelle in der App. Gelesen wird
 * einmal beim Start und nach jeder Änderung: meine Einteilungen, je Einteilung der Ausgang (ChurchTools führt ihn nur je
 * Einteilung), dazu der Eingang. Scheitert das Lesen, ist es Beiwerk: Der Knopf „Tauschen“ bleibt, der Kern prüft beim
 * Schreiben ohnehin frisch. Nach einem Tausch meldet `onGeaendert` – die App lädt die Termine leise neu.
 */
export function useTausch(
  ichId: number,
  zeitzone: string,
  onGeaendert: () => void,
  port: TauschPort = tauschPort,
): Tausch & { neuLaden: () => void } {
  const [einteilungen, setEinteilungen] = useState<Einteilung[] | null>(null);
  const [ausgaenge, setAusgaenge] = useState<ReadonlyMap<string, Ausgang | null>>(new Map());
  const [eingang, setEingang] = useState<Eingang[]>([]);
  const [getauscht, setGetauscht] = useState<{ id: number; text: string }[]>([]);
  const [laeuftKarte, setLaeuft] = useState<ReadonlyMap<string, TauschVorgang>>(new Map());
  const [fehlerKarte, setFehler] = useState<ReadonlyMap<string, string>>(new Map());
  const { toast, showToast } = useToast();
  const geaendert = useRef(onGeaendert);
  geaendert.current = onGeaendert;
  const stand = useRef(0);

  const neuLaden = useCallback(() => {
    if (!ichId) return;
    const meins = ++stand.current;
    void (async () => {
      try {
        const [e, ein] = await Promise.all([
          port.einteilungen(ichId).then(einteilungenAus),
          port.eingang(ichId).then(eingangAus),
        ]);
        // Der Ausgang je Einteilung – höchstens drei gleichzeitig (ChurchTools drosselt).
        const paare: [string, Ausgang | null][] = [];
        await mapLimit(e, 3, async (x) => {
          paare.push([
            einteilungSchluessel(x),
            ausgangAus(await port.ausgang(ichId, x.eventId, x.id)),
          ]);
        });
        if (meins !== stand.current) return;
        setEinteilungen(e);
        setEingang(ein);
        setAusgaenge(new Map(paare));
      } catch (err) {
        console.warn('[tausch] nicht geladen – „Tauschen“ prüft beim Schreiben selbst:', err);
      }
    })();
  }, [ichId, port]);

  useEffect(neuLaden, [neuLaden]);

  const setze = <T>(
    setter: (f: (m: ReadonlyMap<string, T>) => ReadonlyMap<string, T>) => void,
    k: string,
    wert: T | null,
  ) =>
    setter((m) => {
      const n = new Map(m);
      if (wert === null) n.delete(k);
      else n.set(k, wert);
      return n;
    });

  /** Einen Schreibvorgang ausführen: läuft-Anzeige, Fehler am Schlüssel, danach neu laden. */
  async function ausfuehren(
    k: string,
    vorgang: TauschVorgang,
    tun: () => Promise<TauschErgebnis>,
  ): Promise<boolean> {
    setze(setLaeuft, k, vorgang);
    setze(setFehler, k, null);
    try {
      const r = await tun();
      if (!r.ok) {
        setze(setFehler, k, tauschFehlerText(r.grund));
        if (r.grund !== 'schon-angefragt') showToast(tauschFehlerText(r.grund));
      }
      return r.ok;
    } catch (err) {
      console.warn('[tausch]', vorgang, err);
      setze(setFehler, k, TAUSCH_VORUEBERGEHEND);
      return false;
    } finally {
      setze(setLaeuft, k, null);
      neuLaden();
    }
  }

  const wann = (iso: string) => (iso ? tagKurz(tagAusIso(iso, zeitzone)) : '');
  const dienstZu = (e: Eingang) =>
    einteilungen?.find((x) => x.id === e.gebe.einteilung)?.dienst ?? 'Dienst';

  return {
    neuLaden,
    stand: (terminId, ort) =>
      einteilungen === null
        ? undefined
        : (ausgaenge.get(einteilungSchluessel({ eventId: terminId, ...ort })) ?? null),
    eingang,
    getauscht,
    dienstZu,
    laeuft: (k) => laeuftKarte.get(k) ?? null,
    fehler: (k) => fehlerKarte.get(k) ?? null,
    kandidaten: (k) => kandidatenFuer(port, ichId, k),
    anfragen: (k, ziel) => ausfuehren(k, 'anfragen', () => tauschAnfragen(port, ichId, k, ziel)),
    zurueckziehen: async (k, id) => {
      await ausfuehren(k, 'zurueckziehen', () => tauschZurueckziehen(port, ichId, k, id));
    },
    annehmen: async (e) => {
      const dienst = dienstZu(e);
      const ok = await ausfuehren(eingangSchluessel(e), 'annehmen', () =>
        tauschAnnehmen(port, ichId, e.id),
      );
      if (ok) {
        setGetauscht((g) => [
          ...g,
          {
            id: e.id, // `tagKurz` endet schon mit einem Punkt („So, 10.01.“).
            text: `Getauscht – du hast jetzt ${dienst} am ${wann(e.bekomme.beginn)}`,
          },
        ]);
        geaendert.current();
      }
    },
    ablehnen: async (e) => {
      if (
        await ausfuehren(eingangSchluessel(e), 'ablehnen', () => tauschAblehnen(port, ichId, e.id))
      )
        showToast(`Abgelehnt – ${e.von} bekommt Bescheid.`);
    },
    meldung: toast,
  };
}
