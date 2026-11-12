import { beitragsGruppenAus, beitragsText, type Beitrag } from '@shared/protokolle/beitrag';
import { ApiError, NichtUebernommen, Unklar } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { abgelehnt } from './planen';

/**
 * **Beitrag in der Gruppe** (Bauplan S6-2) – nach der Freigabe, wenn das Häkchen „In der Gruppe Bescheid geben“ an ist.
 * Gemessen 11.11.2026 (Bauplan „S6 Messung Beitrag“, Teil 2 und 3): `POST /posts` → 201 mit der ID, Absender ist die
 * angemeldete Person; `GET /post/groups` listet die Gruppen, in denen man schreiben darf.
 *
 * Fehler, je Zweig:
 * - **abgelehnt** (4xx außer 403/408, fehlendes Recht): nichts angelegt → Fehler, „Nochmal versuchen“ darf neu schicken;
 * - **unklar** (Netz, Zeitgrenze, 5xx, Proxy-403, 201 ohne ID): vielleicht angelegt → `Unklar`, **kein** zweiter
 *   Versuch – sonst stünde der Beitrag doppelt in der Gruppe (und ChurchTools benachrichtigte doppelt);
 * - **angelegt, Nachlesen scheitert vorübergehend:** der nächste Versuch liest nur nach, er schickt nicht neu;
 * - **angelegt, aber nicht da** (404 beim Nachlesen): `NichtUebernommen`, der nächste Versuch schickt neu.
 */

const UNKLAR =
  'ChurchTools hat nicht geantwortet – ob der Beitrag in der Gruppe erstellt wurde, ist unklar. Bitte in der Gruppe nachsehen, statt es noch einmal zu versuchen – sonst steht er doppelt da.';

/** Darf ich in dieser Gruppe einen Beitrag schreiben? (`/post/groups`) Wirft, wenn die Liste nicht kommt. */
export async function beitragMoeglich(gruppe: number): Promise<boolean> {
  return beitragsGruppenAus(await ctDaten<unknown>('/post/groups')).has(gruppe);
}

/**
 * Der Schritt „Beitrag erstellen“ – als Funktion, die man nach einem Fehler noch einmal aufrufen kann: Sie merkt sich die
 * ID eines schon angelegten Beitrags und liest dann nur noch nach.
 */
export function beitragSchritt(gruppe: number, b: Beitrag): () => Promise<void> {
  let id: number | null = null;
  return async () => {
    if (id === null) {
      let neu: { data?: { id?: unknown } } | null;
      try {
        neu = await ctAnfrage<{ data?: { id?: unknown } } | null>('/posts', {
          method: 'POST',
          body: JSON.stringify({
            groupId: gruppe,
            title: b.titel,
            content: beitragsText(b),
            visibility: 'group_intern',
            commentsActive: false,
          }),
          verweigert: 'Dir fehlt in ChurchTools das Recht, in dieser Gruppe Beiträge zu schreiben.',
        });
      } catch (e) {
        if (abgelehnt(e)) throw e;
        throw new Unklar(UNKLAR);
      }
      if (typeof neu?.data?.id !== 'number') throw new Unklar(UNKLAR);
      id = neu.data.id;
    }
    let da: { id?: unknown; title?: unknown } | null;
    try {
      da = await ctDaten<{ id?: unknown; title?: unknown } | null>(`/posts/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        id = null;
        throw new NichtUebernommen('den Beitrag in der Gruppe');
      }
      throw e;
    }
    if (da?.id !== id || da.title !== b.titel)
      throw new NichtUebernommen('den Beitrag in der Gruppe');
  };
}
