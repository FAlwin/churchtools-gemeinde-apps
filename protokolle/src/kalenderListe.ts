/**
 * **Die Kalender, in die man eintragen darf** (W14): `GET /calendars` (nur die, die man sehen darf) gefiltert auf die
 * Kalender mit dem Recht „Termine anlegen“ (`churchcal` „edit category“ – `schreibbareKalender`, dieselbe Regel wie in den
 * Anmeldungen), nach Namen sortiert. Wirft bei jedem Fehler – „keine Kalender“ ist nicht „ChurchTools antwortet nicht“.
 */
import { ctDaten } from '@ui/ct/verbindung';

export interface KalenderEintrag {
  id: number;
  name: string;
}

export async function ladeSchreibKalender(
  schreibbar: readonly number[],
): Promise<KalenderEintrag[]> {
  const erlaubt = new Set(schreibbar);
  const liste = (await ctDaten<{ id?: number; name?: string }[]>('/calendars')) ?? [];
  return (Array.isArray(liste) ? liste : [])
    .flatMap((k) =>
      typeof k.id === 'number' && erlaubt.has(k.id)
        ? [{ id: k.id, name: k.name ?? `Kalender ${k.id}` }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
