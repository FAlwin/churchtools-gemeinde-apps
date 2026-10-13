/**
 * **Was die Startseite außer den Terminen noch zeigt** (Bauplan E3-3): die Lieder des nächsten Termins,
 * die eigenen Abwesenheiten und den Weg zur Musik-App. Alles davon ist Beiwerk – scheitert es, zeigt die
 * Startseite die Angabe nicht, statt etwas Falsches zu sagen (z. B. „keine Abwesenheiten“).
 */
import { ctBasis, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { CtAbsence, CtAgenda } from '@shared/ct/typen';

/**
 * Die Liedtitel aus dem Ablauf eines Termins, in Ablauf-Reihenfolge. `null` = der Termin hat keinen
 * Ablauf (ChurchTools: 404). Andere Fehler werden geworfen.
 */
export async function ladeLieder(eventId: number): Promise<string[] | null> {
  try {
    const ablauf = await ctDaten<CtAgenda | null>(`/events/${eventId}/agenda`);
    return (ablauf?.items ?? [])
      .filter((i) => i.type === 'song')
      .map((i) => i.song?.title?.trim() || i.title.trim())
      .filter((t) => t !== '');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Die eigenen Abwesenheiten von `von` bis `bis` (`YYYY-MM-DD`). Wirft, wenn keine Liste kommt. */
export async function ladeAbwesenheiten(
  ichId: number,
  von: string,
  bis: string,
): Promise<CtAbsence[]> {
  const q = new URLSearchParams({ from: von, to: bis, limit: '500' });
  const liste = await ctDaten<unknown>(`/persons/${ichId}/absences?${q.toString()}`);
  if (!Array.isArray(liste)) throw new ApiError(502, 'Abwesenheiten kamen nicht als Liste.');
  return liste as CtAbsence[];
}

/**
 * Die Adresse der Musik-App, wenn die Gemeinde sie als Erweiterung installiert hat (Kürzel beginnt mit
 * `musik-app`, wie in der Anleitung), sonst `null`. Gemessen 13.10.2026: auch ein einfaches Mitglied
 * darf `/custommodules` lesen.
 */
export async function ladeMusikApp(): Promise<string | null> {
  const module = await ctDaten<{ shorty?: unknown }[] | null>('/custommodules');
  const musik = (module ?? []).find(
    (m) => typeof m.shorty === 'string' && m.shorty.startsWith('musik-app'),
  );
  return musik ? `${ctBasis()}/ccm/${String(musik.shorty)}/` : null;
}
