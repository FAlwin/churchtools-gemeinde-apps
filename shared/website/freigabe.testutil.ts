import type { ModulPort, Wert } from '../ct/modulDaten';
import { fehlerMit, type FehlerStatus } from './speicher.testutil';

/**
 * Ein Erweiterungs-Speicher mit **zwei Kategorien** („Entwürfe“ und „Veröffentlicht“) im Arbeitsspeicher – für die Tests der
 * Freigabe (W3b-2). Gebaut wie der echte Anschluss (`ModulPort`): Die Kategorie steckt im Pfad, jeder Zugriff steht im `log`
 * (mit Kategorie), `ausfall` darf je Zugriff einen Fehler werfen (Netz, 5xx, kein Recht …). `istKeinRecht` kennt – wie
 * ChurchTools – `401` und `403`.
 */
export const ENTWUERFE = 1;
export const ONLINE = 2;
/**
 * W3b-4b: „Veröffentlicht“ der Untergruppe Jugend – Kategorie 117 der Gruppe 347 (Messung W3b-4-0). Gruppen- und Kategorie-ID
 * bewusst verschieden, damit eine Verwechslung auffällt.
 */
export const JUGEND = 347;
export const JUGEND_ONLINE = 117;

export type Zugriff2 = {
  art: 'LESEN' | 'POST' | 'PUT' | 'DELETE';
  kategorie: number;
  id: number | null;
  wert?: string;
};

export function fakeFreigabeSpeicher() {
  const werte: Record<number, Wert[]> = { [ENTWUERFE]: [], [ONLINE]: [], [JUGEND_ONLINE]: [] };
  let naechste = 1;
  const log: Zugriff2[] = [];
  const steuerung: { ausfall: (z: Zugriff2, nr: number) => Error | undefined } = {
    ausfall: () => undefined,
  };
  let zaehler = 0;
  const pruefe = (z: Zugriff2) => {
    log.push(z);
    const e = steuerung.ausfall(z, zaehler++);
    if (e) throw e;
  };
  const kategorieAus = (pfad: string) => Number(/customdatacategories\/(\d+)/.exec(pfad)![1]);

  const port: ModulPort = {
    kuerzel: () => 'website',
    daten: ((pfad: string) => {
      const kategorie = kategorieAus(pfad);
      try {
        pruefe({ art: 'LESEN', kategorie, id: null });
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
      return Promise.resolve(werte[kategorie].map((w) => ({ ...w })));
    }) as ModulPort['daten'],
    schreibe: (pfad, auftrag) => {
      const kategorie = kategorieAus(pfad);
      const id = /\/(\d+)$/.exec(pfad)?.[1];
      const z: Zugriff2 = {
        art: auftrag.method,
        kategorie,
        id: id ? Number(id) : null,
        wert: (auftrag.json as { value?: string } | undefined)?.value,
      };
      try {
        pruefe(z);
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
      const liste = werte[kategorie];
      if (auftrag.method === 'POST') {
        liste.push({
          id: naechste++,
          dataCategoryId: kategorie,
          value: (auftrag.json as { value: string }).value,
        });
      } else if (auftrag.method === 'PUT') {
        const w = liste.find((x) => x.id === Number(id));
        if (!w) return Promise.reject(fehlerMit(404));
        w.value = (auftrag.json as { value: string }).value;
      } else {
        const i = liste.findIndex((x) => x.id === Number(id));
        if (i < 0) return Promise.reject(fehlerMit(404));
        liste.splice(i, 1);
      }
      return Promise.resolve();
    },
    fehler: (status, meldung) => fehlerMit(status, meldung),
    istKeinRecht: (e) => [401, 403].includes((e as { status?: number })?.status ?? 0),
    istNichtGefunden: (e) => (e as { status?: number })?.status === 404,
  };

  return {
    port,
    werte,
    log,
    steuerung,
    /** Die Orte, wie die Speicher-Funktionen sie nehmen. */
    entwurfsOrt: { p: port, modul: 7, kategorie: ENTWUERFE },
    onlineOrt: { p: port, modul: 7, kategorie: ONLINE },
    freigabeOrt: { p: port, modul: 7, entwuerfe: ENTWUERFE, veroeffentlicht: ONLINE },
    /** Mit der eingerichteten Untergruppe Jugend (W3b-4b). */
    bereichsOrt: {
      p: port,
      modul: 7,
      entwuerfe: ENTWUERFE,
      veroeffentlicht: ONLINE,
      untergruppen: [{ gruppe: JUGEND, kategorie: JUGEND_ONLINE }],
    },
    jugendOrt: { p: port, modul: 7, kategorie: JUGEND_ONLINE },
    /** Die Schreibzugriffe, als „1:POST“, „2:PUT 3“, „2:DELETE 5“ (Kategorie vorn). */
    schreibzugriffe: (kategorie?: number) =>
      log
        .filter((z) => z.art !== 'LESEN' && (kategorie === undefined || z.kategorie === kategorie))
        .map((z) => `${z.kategorie}:${z.id ? `${z.art} ${z.id}` : z.art}`),
    lege: (kategorie: number, value: string) => {
      const w = { id: naechste++, dataCategoryId: kategorie, value };
      werte[kategorie].push(w);
      return w.id;
    },
    neuesLog: () => {
      log.length = 0;
      zaehler = 0;
    },
  };
}

export type { FehlerStatus };
export { fehlerMit };
