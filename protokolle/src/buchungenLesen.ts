/**
 * **Ressourcen und Buchungen aus ChurchTools** (W15-2, Reiter „Ressourcen“ im Fenster „In Kalender eintragen“).
 *
 * - `ladeRessourcen`: `GET /resources` und `GET /resourcetypes`, gefiltert auf die buchbaren (`shared/ct/ressourcenRechte`).
 *   **Wirft bei jedem Fehler** – „keine Ressourcen“ ist nicht „ChurchTools antwortet nicht“.
 * - `buchungenNachlesen`: **Ein Erfolgssignal ist kein Beleg** (Lehre 11.08.2026). Die Antwort auf das Anlegen eines Termins
 *   enthält die Buchungen nicht (gemessen 23.11.2026, W15-0) – erst `GET /bookings?resource_ids[]=…&from&to` zeigt, ob sie
 *   da sind. Je gewünschter Ressource wird einzeln gelesen (jede Zeile gehört dann zu dieser Ressource) und gesucht, ob eine
 *   Buchung zu diesem Termin (`booking.base.appointment.id`) existiert. Scheitert das Lesen, ist die Ressource **unklar**, nicht
 *   „fehlt“ (vorübergehend ist nicht ungültig).
 */
import { ressourcenAus, type Ressource } from '@shared/protokolle/terminRessourcen';
import { ctDaten } from '@ui/ct/verbindung';

/** Die buchbaren Ressourcen, nach Typ und Namen sortiert. */
export async function ladeRessourcen(buchbar: ReadonlySet<number>): Promise<Ressource[]> {
  const [ressourcen, typen] = await Promise.all([
    ctDaten<unknown>('/resources'),
    ctDaten<unknown>('/resourcetypes'),
  ]);
  return ressourcenAus(ressourcen, typen, buchbar);
}

/**
 * Eine Zeile aus `GET /bookings`, nur die gelesenen Felder. Gemessen 23.11.2026 (Test-Instanz): Die Zeile trägt `booking.base`
 * **und** noch `base` – `@deprecated: { base: 'booking.base' }`. Gelesen wird das neue Feld, das alte nur als Ersatz; sonst
 * meldete das Fenster „nicht gebucht“, sobald ChurchTools `base` streicht.
 */
interface BuchungRoh {
  booking?: { base?: { appointment?: { id?: number } } };
  base?: { appointment?: { id?: number } };
}

/** Zu welchem Termin gehört die Buchung? */
const terminDer = (b: BuchungRoh): number | undefined =>
  (b.booking?.base ?? b.base)?.appointment?.id;

/** Der Pfad, der die Buchungen einer Ressource in einem Zeitraum (Tage `JJJJ-MM-TT`) liest. */
export const buchungenPfad = (ressource: number, von: string, bis: string): string =>
  `/bookings?resource_ids[]=${ressource}&from=${von}&to=${bis}`;

/**
 * **Hat ChurchTools die gewünschten Buchungen wirklich angelegt?** `fehlend` = gelesen, aber keine Buchung zu diesem Termin;
 * `unklar` = bei mindestens einer Ressource ließ sich nicht lesen. Wirft nie.
 */
export async function buchungenNachlesen(q: {
  termin: number;
  ressourcen: readonly number[];
  /** Beginn-Tag und Ende-Tag des Termins, `JJJJ-MM-TT`. */
  von: string;
  bis: string;
}): Promise<{ fehlend: number[]; unklar: boolean }> {
  const stand = await Promise.all(
    q.ressourcen.map(async (r): Promise<'da' | 'fehlt' | 'unklar'> => {
      try {
        const liste = (await ctDaten<BuchungRoh[] | null>(buchungenPfad(r, q.von, q.bis))) ?? [];
        if (!Array.isArray(liste)) return 'unklar';
        return liste.some((b) => terminDer(b) === q.termin) ? 'da' : 'fehlt';
      } catch {
        return 'unklar';
      }
    }),
  );
  return {
    fehlend: q.ressourcen.filter((_, i) => stand[i] === 'fehlt'),
    unklar: stand.includes('unklar'),
  };
}
