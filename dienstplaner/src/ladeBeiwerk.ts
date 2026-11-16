/**
 * **Was die Startseite außer den Terminen noch zeigt** (Bauplan E3-3): die Lieder des nächsten Termins,
 * die eigenen Abwesenheiten und den Weg zur Musik-App. Alles davon ist Beiwerk – scheitert es, zeigt die
 * Startseite die Angabe nicht, statt etwas Falsches zu sagen (z. B. „keine Abwesenheiten“).
 */
import { ctAlleSeiten, ctBasis, ctDaten } from '@ui/ct/verbindung';
import { dienstAusAnfragen, type MeinDienstKurz } from '@shared/dienstplan/meineDienste';
import { ApiError } from '@ui/ct/fehler';
import { abwesenheitPort } from '@ui/ct/abwesenheitPort';
import { ctAbwesenheiten } from '@shared/absences/abwesenheiten';
import type { CtAbsence, CtAgenda, CtSong } from '@shared/ct/typen';
import { terminVorlagenAus, type TerminVorlage } from '@shared/ct/terminVorlagen';

/**
 * Die Liedtitel aus dem Ablauf eines Termins, in Ablauf-Reihenfolge. `null` = der Termin hat keinen
 * Ablauf (ChurchTools: 404). Andere Fehler werden geworfen.
 */
export async function ladeLieder(eventId: number): Promise<string[] | null> {
  const ablauf = await ladeAblauf(eventId);
  if (!ablauf) return null;
  return ablauf.items
    .filter((i) => i.type === 'song')
    .map((i) => i.song?.title?.trim() || i.title.trim())
    .filter((t) => t !== '');
}

/**
 * Der Ablauf eines Termins (Startseite, Termin-Ansicht E6-1b). `null` = der Termin hat keinen Ablauf (ChurchTools:
 * 404) – eine Stelle für diese Regel. Andere Fehler werden geworfen.
 */
export async function ladeAblauf(eventId: number): Promise<CtAgenda | null> {
  try {
    const ablauf = await ctDaten<CtAgenda | null>(`/events/${eventId}/agenda`);
    // Ohne Punkte-Liste ist der Ablauf leer – `items` ist danach immer eine Liste (die Aufrufer prüfen das nicht noch
    // einmal). `ctDaten` gibt bei `{ data: null }` den ganzen Körper zurück; der zählt nicht als Ablauf.
    return ablauf && Array.isArray(ablauf.items) ? ablauf : { items: [] };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Die eigenen Abwesenheiten von `von` bis `bis` (`YYYY-MM-DD`). Wirft, wenn keine Liste kommt – über den gemeinsamen
 * Kern (`ctAbwesenheiten`, E7-2a): Er liest einen Tag weiter, sonst fehlte ein Eintrag mit Uhrzeit am letzten Tag.
 */
export function ladeAbwesenheiten(ichId: number, von: string, bis: string): Promise<CtAbsence[]> {
  return ctAbwesenheiten(abwesenheitPort, ichId, von, bis);
}

/** Die eigenen kommenden Dienste je Termin – offen und zugesagt (`@shared/dienstplan/meineDienste`). */
export async function ladeMeineDienste(ichId: number): Promise<Map<number, MeinDienstKurz[]>> {
  return dienstAusAnfragen(
    await ctAlleSeiten<unknown>(`/persons/${ichId}/servicerequests?only_future=true`),
  );
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

/**
 * Die Lieder eines Ablaufs – **eine** Abfrage für alle: `GET /songs?ids[]=…` (gemessen E6-O0: liefert genau die
 * gewünschten, ~135 ms). Der Ablauf selbst nennt weder Autor (Lied-Karte, E6-O1) noch Verlag, CCLI und Dateien
 * (Lied-Ansicht, E6-O O4) – dieselbe Antwort trägt beides, deshalb keine zweite Abfrage. Beiwerk: Ohne Lieder gar keine
 * Abfrage; was nicht als Liste kommt, wirft – die Karte steht dann ohne Autor da, die Lied-Ansicht mit dem, was der
 * Ablauf weiß.
 */
export async function ladeLiedDaten(songIds: readonly number[]): Promise<Map<number, CtSong>> {
  const ids = [...new Set(songIds)];
  if (ids.length === 0) return new Map();
  const q = ids.map((id) => `ids[]=${id}`).join('&');
  const liste = await ctDaten<unknown>(`/songs?${q}`);
  if (!Array.isArray(liste)) throw new ApiError(502, 'Lieder kamen nicht als Liste.');
  const lieder = new Map<number, CtSong>();
  for (const s of liste as Partial<CtSong>[]) {
    if (typeof s.id === 'number') {
      lieder.set(s.id, {
        ...(s as CtSong),
        arrangements: Array.isArray(s.arrangements) ? s.arrangements : [],
      });
    }
  }
  return lieder;
}

/** Der Autor eines geladenen Lieds – leer zählt als keiner (für die Lied-Karte, E6-O1). */
export const autorVon = (lied: CtSong | undefined): string | null =>
  typeof lied?.author === 'string' && lied.author.trim() ? lied.author.trim() : null;

/**
 * Die Terminvorlagen von ChurchTools (`/eventtemplates`, gemessen 13.11.2026) fürs Plätze-Fach. Beiwerk: **wirft**, wenn
 * keine Liste kommt – das Fach zeigt dann einen ruhigen Hinweis und bleibt sonst bedienbar. Kaputte Einzeleinträge
 * fallen im Parser weg, ohne zu werfen.
 */
export async function ladeTerminVorlagen(): Promise<TerminVorlage[]> {
  const roh = await ctDaten<unknown>('/eventtemplates');
  if (!Array.isArray(roh)) throw new ApiError(502, 'ChurchTools hat die Vorlagen nicht geliefert.');
  return terminVorlagenAus(roh);
}
