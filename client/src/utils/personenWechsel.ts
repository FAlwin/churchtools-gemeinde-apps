/**
 * **Wechselt an einem Gerät die Person, wird es zuerst geräumt – wie beim Abmelden** (30.10.2026).
 *
 * Die Server-App räumt beim Abmelden alles Konto-Bezogene vom Gerät (`clearDeviceData`). Die **Erweiterung** hat kein
 * Abmelden: Wer sich in ChurchTools ab- und als jemand anderes anmeldet (geteiltes iPad) oder eine Person simuliert,
 * findet im selben Browser alles von der vorigen Person vor. Nachgestellt, bevor es diese Datei gab:
 *  - Was A noch nicht hochgeladen hatte (Einstellung oder Strich, ohne Netz oder App gleich zu), lud der Start von B
 *    **auf Bs Konto** – die Warteschlangen (`pendingKeys`) kennen keine Person;
 *  - hatte das Gerät nie übertragen, lud B **As ganzen Bestand** hoch (`migrateLocal…`);
 *  - bis zum Abgleich (ohne Netz: dauerhaft) sah B As Tonarten, Striche und zwischengespeicherte Abläufe.
 * Dieselbe Lücke war in den Protokollen (S7-3, Fund 2) – dort je Person gelöst; hier gibt es mit `clearDeviceData`
 * schon die eine Regel fürs Räumen, also wird sie benutzt statt eine zweite gebaut.
 *
 * **Vorübergehend ist nicht ungültig:** Lässt sich nicht feststellen, wer angemeldet ist (Netz, ChurchTools), wird
 * nichts geräumt – aber auch nichts aus den Warteschlangen hochgeladen (`useChartSync` fragt hier vorher). Der nächste
 * Abgleich fragt erneut.
 *
 * Der Preis ist derselbe wie beim Abmelden der Server-App: Was A noch nicht hochgeladen hatte, ist weg, statt bei B zu
 * landen. Ohne gemerkte Person (erster Start nach dem Update) wird nur gemerkt, nicht geräumt.
 */
import { getMe } from '../services/churchtoolsApi';
import { queryClient } from '../queryClient';
import { schluessel } from '../hooks/abfrageSchluessel';
import { clearDeviceData } from './clearDeviceData';
import { getLetztePerson, setLetztePerson } from './devicePrefs';

let laufend: Promise<boolean> | null = null;

/**
 * `true`, sobald feststeht, dass das Gerät zur angemeldeten Person gehört (nötigenfalls nach dem Räumen). Einmal je
 * Seite – ein `false` (nicht feststellbar, nicht angemeldet) wird nicht gemerkt, der nächste Aufruf fragt neu.
 */
export function personGeprueft(): Promise<boolean> {
  laufend ??= pruefen().then((ok) => {
    if (!ok) laufend = null;
    return ok;
  });
  return laufend;
}

/** Nach An- oder Abmelden in derselben Seite (Server-App): beim nächsten Mal neu prüfen. */
export function personNeuPruefen(): void {
  laufend = null;
}

async function pruefen(): Promise<boolean> {
  let status;
  try {
    status = await getMe();
  } catch {
    return false;
  }
  const id = status.authenticated ? status.user?.id : undefined;
  if (!id) return false;
  const vorher = getLetztePerson();
  if (vorher !== null && vorher !== id) {
    await clearDeviceData();
    // Auch der Speicher der Seite: Sonst schriebe der Cache-Spiegel die Abläufe von A gleich wieder nach IndexedDB.
    queryClient.setQueryData(schluessel.ich(), status);
    await queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== schluessel.ich()[0] });
  }
  setLetztePerson(id);
  return true;
}
