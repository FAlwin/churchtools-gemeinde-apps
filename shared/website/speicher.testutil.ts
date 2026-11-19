import type { ModulPort, Wert } from '../ct/modulDaten';

/**
 * Ein Erweiterungs-Speicher im Arbeitsspeicher für die Tests der Website: eine Kategorie, Werte mit fortlaufenden IDs,
 * jeder Schreibzugriff im `log`. `ausfall` darf je Zugriff einen Fehler werfen (Netz, 5xx, kein Recht …) – so lassen sich
 * Teilfehler mitten im Schreiben nachstellen. Gebaut wie der echte Anschluss (`ModulPort`), damit getestet wird, was
 * `speicher.ts` wirklich aufruft.
 */
export interface FehlerStatus extends Error {
  status: number;
}

export const fehlerMit = (status: number, text = `Fehler ${status}`): FehlerStatus =>
  Object.assign(new Error(text), { status });

export type Zugriff = {
  art: 'LESEN' | 'POST' | 'PUT' | 'DELETE';
  id: number | null;
  wert?: string;
};

export function fakeSpeicher() {
  const werte: Wert[] = [];
  let naechste = 1;
  const log: Zugriff[] = [];
  /** Wird vor jedem Zugriff gefragt; ein zurückgegebener Fehler wird geworfen. */
  const steuerung: { ausfall: (z: Zugriff, nr: number) => Error | undefined } = {
    ausfall: () => undefined,
  };
  let zaehler = 0;

  const pruefe = (z: Zugriff) => {
    log.push(z);
    const e = steuerung.ausfall(z, zaehler++);
    if (e) throw e;
  };

  const port: ModulPort = {
    kuerzel: () => 'website',
    daten: ((pfad: string) => {
      pruefe({ art: 'LESEN', id: null });
      void pfad;
      return Promise.resolve(werte.map((w) => ({ ...w })));
    }) as ModulPort['daten'],
    schreibe: (pfad, auftrag) => {
      const id = /\/(\d+)$/.exec(pfad)?.[1];
      const z: Zugriff = {
        art: auftrag.method,
        id: id ? Number(id) : null,
        wert: (auftrag.json as { value?: string } | undefined)?.value,
      };
      try {
        pruefe(z);
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
      if (auftrag.method === 'POST') {
        const value = (auftrag.json as { value: string }).value;
        werte.push({ id: naechste++, dataCategoryId: 1, value });
      } else if (auftrag.method === 'PUT') {
        const w = werte.find((x) => x.id === Number(id));
        if (!w) return Promise.reject(fehlerMit(404));
        w.value = (auftrag.json as { value: string }).value;
      } else {
        const i = werte.findIndex((x) => x.id === Number(id));
        if (i < 0) return Promise.reject(fehlerMit(404));
        werte.splice(i, 1);
      }
      return Promise.resolve();
    },
    fehler: (status, meldung) => fehlerMit(status, meldung),
    istKeinRecht: (e) => (e as { status?: number })?.status === 403,
    istNichtGefunden: (e) => (e as { status?: number })?.status === 404,
  };

  // `werteLesen` schreibt nichts, aber das Log soll es als LESEN zeigen – siehe `daten` oben. Der Ort für die Aufrufe:
  const ort = { p: port, modul: 7, kategorie: 1 };
  return {
    port,
    ort,
    werte,
    log,
    steuerung,
    /** Nur die Schreibzugriffe, als „POST“, „PUT 3“, „DELETE 5“. */
    schreibzugriffe: () =>
      log.filter((z) => z.art !== 'LESEN').map((z) => (z.id ? `${z.art} ${z.id}` : z.art)),
    /** Einen Wert von außen hinlegen (fremd, kaputt …). */
    lege: (value: string) => {
      const w = { id: naechste++, dataCategoryId: 1, value };
      werte.push(w);
      return w.id;
    },
    /** Von jetzt an zählen (Aufrufe davor – etwa die Vorbereitung – nicht mitrechnen). */
    neuesLog: () => {
      log.length = 0;
      zaehler = 0;
    },
  };
}
