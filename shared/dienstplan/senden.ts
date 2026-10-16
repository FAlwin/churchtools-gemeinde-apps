/**
 * **Entwürfe senden** (Bauplan E4-4, erste Scheibe: der Kern ohne Oberfläche). Aus Entwürfen werden echte
 * Einteilungen in ChurchTools – mit dem Schreibkern (`einteilen.ts`) und dem Entwurfs-Speicher (`entwuerfe.ts`).
 * Nur Regeln; die Anschlüsse reicht der Aufrufer herein.
 *
 * Je Eintrag, **einer nach dem anderen** (ChurchTools bremst sonst – Lehre aus #300):
 * 1. Liegt der Entwurf noch in derselben Fassung in der Schublade? Sonst hat ein anderer Planer ihn geändert –
 *    nicht senden (sonst ginge seine Änderung verloren).
 * 2. Einteilen: frisch lesen → schreiben → nachlesen (`platzEinteilen`). `gesehen` ist, was beim Eintragen am
 *    Platz stand – steht dort inzwischen etwas anderes, ist das ein Konflikt, und nichts wird überschrieben.
 * 3. **Erst wenn das Einteilen bestätigt ist**, den Entwurf entfernen (Ergebnis in der Hand, dann aufräumen –
 *    Lehre vom 11.08.2026). Klappt das Entfernen nicht, bleibt der Entwurf stehen; er ist dann veraltet und lässt
 *    sich in der Matrix verwerfen. Gesendet ist trotzdem.
 *
 * Bei „abgemeldet“ und bei vorübergehenden Fehlern (Netz, Drosselung, 5xx) wird **angehalten**: Die übrigen
 * Einträge werden gar nicht erst versucht und bleiben Entwürfe. Kein Schreibvorgang wird automatisch wiederholt,
 * und nichts wird verworfen – „Erneut senden“ ist eine bewusste zweite Entscheidung.
 *
 * Gemessen (14./15.10.2026): Anfrage und direktes Zuteilen lösen die Push-Mitteilung der ChurchTools-App aus.
 * E4-5 (Ziel „frei“ = zurückziehen, `decline`): **keine** Mitteilung. Ersetzen (eine andere Person auf einen
 * belegten Platz): die bisherige Person bekommt „Dienstaustragung – Du wurdest aus dem Dienst … ausgetragen“.
 */
import { platzEinteilen, type Belegung, type DienstPort, type Grund } from './einteilen';
import {
  entwurfEntfernen,
  ortSchluessel,
  schubladeLesen,
  type Entwurf,
  type EntwurfGrund,
  type EntwurfPort,
} from './entwuerfe';

/** Ein Eintrag der Liste: der Entwurf und die Schublade (Kategorie), in der er liegt. */
export interface SendeEintrag {
  entwurf: Entwurf;
  kategorie: number;
}

export type SendeErgebnis =
  /** Eingeteilt und nachgelesen. `entwurfBlieb`: Der Entwurf ließ sich danach nicht entfernen (veraltet). */
  | { art: 'gesendet'; entwurfBlieb?: EntwurfGrund }
  /** Nicht eingeteilt – der Entwurf bleibt. `jetzt`: was in ChurchTools am Platz steht (bei Konflikt). */
  | { art: 'nicht-gesendet'; grund: Grund | 'entwurf-geaendert' | 'entwurf-weg'; jetzt?: Belegung }
  /** Nach „abgemeldet“ oder einem vorübergehenden Fehler gar nicht erst versucht – der Entwurf bleibt. */
  | { art: 'nicht-versucht' };

export interface SendeAnschluss {
  dienst: DienstPort;
  entwurf: EntwurfPort;
  modul: number;
}

/** Was in ChurchTools am Platz stehen soll. */
export function zielAus(e: Entwurf): Belegung {
  if (e.ziel.art === 'frei') return { art: 'frei' };
  if (e.ziel.art === 'gast') return { art: 'gast', name: e.ziel.name };
  return e.modus === 'direkt'
    ? { art: 'zusage', personId: e.ziel.personId }
    : { art: 'anfrage', personId: e.ziel.personId };
}

/** Nach diesen Gründen hört das Senden auf – die nächsten Einträge würden genauso scheitern. */
const ANHALTEN: ReadonlySet<string> = new Set(['abgemeldet', 'voruebergehend']);

/**
 * **Die Einträge senden**, in der gegebenen Reihenfolge. `melde` erfährt nach jedem Eintrag dessen Ergebnis
 * (Fortschritt im Fach). Liefert je Eintrag ein Ergebnis, in derselben Reihenfolge.
 */
export async function sende(
  eintraege: readonly SendeEintrag[],
  a: SendeAnschluss,
  melde: (index: number, ergebnis: SendeErgebnis) => void = () => {},
): Promise<SendeErgebnis[]> {
  const ergebnisse: SendeErgebnis[] = eintraege.map(() => ({ art: 'nicht-versucht' }));
  // Die Fassungen der Entwürfe frisch – je Schublade einmal, nicht je Eintrag.
  const fassungen = new Map<number, Map<string, number> | EntwurfGrund>();
  const fassungIn = async (kategorie: number) => {
    let f = fassungen.get(kategorie);
    if (f === undefined) {
      const l = await schubladeLesen(a.entwurf, a.modul, kategorie);
      f = l.ok
        ? new Map([...l.inhalt.je].map(([k, { entwurf }]) => [k, entwurf.version]))
        : l.grund;
      fassungen.set(kategorie, f);
    }
    return f;
  };

  for (const [i, { entwurf, kategorie }] of eintraege.entries()) {
    const ergebnis = await einen(entwurf, kategorie, a, fassungIn);
    ergebnisse[i] = ergebnis;
    melde(i, ergebnis);
    if (ergebnis.art === 'nicht-gesendet' && ANHALTEN.has(ergebnis.grund)) break;
  }
  return ergebnisse;
}

async function einen(
  entwurf: Entwurf,
  kategorie: number,
  a: SendeAnschluss,
  fassungIn: (kategorie: number) => Promise<Map<string, number> | EntwurfGrund>,
): Promise<SendeErgebnis> {
  // 1. Noch dieselbe Fassung? (Die Schublade nicht lesbar: so wie beim Einteilen behandeln.)
  const f = await fassungIn(kategorie);
  if (typeof f === 'string') {
    return {
      art: 'nicht-gesendet',
      grund: f === 'kein-recht' || f === 'abgemeldet' ? f : 'voruebergehend',
    };
  }
  // Weg: ein anderer Planer hat ihn eben gesendet oder entfernt; andere Version: geändert (zwei Planer, 16.10.2026).
  const version = f.get(ortSchluessel(entwurf.ort));
  if (version === undefined) return { art: 'nicht-gesendet', grund: 'entwurf-weg' };
  if (version !== entwurf.version) return { art: 'nicht-gesendet', grund: 'entwurf-geaendert' };

  // 2. Einteilen – frisch lesen, schreiben, nachlesen (im Schreibkern).
  const r = await platzEinteilen(a.dienst, entwurf.ort, entwurf.gesehen, zielAus(entwurf));
  if (!r.ok)
    return { art: 'nicht-gesendet', grund: r.grund, ...(r.jetzt ? { jetzt: r.jetzt } : {}) };

  // 3. Erst jetzt aufräumen. Scheitert das, ist trotzdem gesendet.
  const weg = await entwurfEntfernen(a.entwurf, a.modul, kategorie, entwurf.ort, entwurf.version);
  return weg.ok ? { art: 'gesendet' } : { art: 'gesendet', entwurfBlieb: weg.grund };
}
