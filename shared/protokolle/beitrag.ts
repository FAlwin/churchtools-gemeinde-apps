/**
 * **Beitrag in der Gruppe nach der Freigabe** (Bauplan S6-2, entschieden 09./11.11.2026, Entwurf `s6-freigabe-pdf-v1`).
 *
 * - Das Häkchen „In der Gruppe Bescheid geben“ gibt es nur, wo man **Beiträge schreiben darf**: `/post/groups` listet
 *   genau diese Gruppen (Typ erlaubt Beiträge **und** Recht 10130; gemessen 11.11.2026: Einträge mit
 *   `type: 'postPossible'`, Gruppe 194 vom Typ „Anmeldung“ fehlt).
 * - Der Beitrag ist **Markdown** (gemessen 11.11.2026): ein einfacher Zeilenumbruch fließt zusammen, ein Absatz braucht
 *   eine Leerzeile, `[Text](Adresse)` wird ein Link.
 */
import { datumText, tagPunkt } from '../ct/datum';
import { tagAusIso } from '../ct/zeit';

export interface Beitrag {
  /** Überschrift des Beitrags. */
  titel: string;
  /** Der Satz darüber – ohne Markdown, für die Vorschau im Fenster. */
  satz: string;
  /** Adresse, die „Protokoll öffnen“ öffnet. */
  link: string;
}

/**
 * **Was im Beitrag steht:** „Protokoll vom 11.11.2026 ist freigegeben“ – „Das Protokoll „Leitungssitzung“ vom
 * Mi, 11.11.2026 ist freigegeben.“ – „Protokoll öffnen“. Der Titel in Anführungszeichen, weil er alles sein kann
 * („der Leitungssitzung“ passte nicht zu „Gruppentreffen“). Tag in der Zeitzone der Gemeinde.
 */
export function freigabeBeitrag(q: {
  titel: string;
  beginn: string;
  zeitzone: string;
  link: string;
}): Beitrag {
  const tag = tagAusIso(q.beginn, q.zeitzone);
  const titel = q.titel.trim() || 'Sitzung';
  return {
    titel: `Protokoll vom ${tagPunkt(tag)} ist freigegeben`,
    satz: `Das Protokoll „${titel}“ vom ${datumText(tag)} ist freigegeben.`,
    link: q.link,
  };
}

/** Zeichen, die Markdown als Auszeichnung liest – im Titel einer Sitzung sollen sie nur Zeichen sein. */
const markdownSicher = (t: string): string => t.replace(/([\\`*_[\]<>#|~])/g, '\\$1');

/** Der Text, der an ChurchTools geht: Satz, Leerzeile, Link. */
export function beitragsText(b: Beitrag): string {
  return `${markdownSicher(b.satz)}\n\n[Protokoll öffnen](${b.link})`;
}

/** Die Gruppen aus `/post/groups`, in denen man einen Beitrag schreiben darf. Unbekanntes fällt weg. */
export function beitragsGruppenAus(antwort: unknown): Set<number> {
  const ids = new Set<number>();
  if (!Array.isArray(antwort)) return ids;
  for (const e of antwort as { type?: unknown; group?: { domainIdentifier?: unknown } }[]) {
    if (e?.type !== 'postPossible') continue;
    const id = Number(e.group?.domainIdentifier);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}
