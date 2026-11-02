/**
 * **Die Dateien am Termin** – die Büroklammer in der Dienstplan-Liste von ChurchTools (Idee Alwin 02.11.2026, Entwurf
 * `termin-einstellungen.html` Variante B, Scheibe T2a). Gemessen 02.11.2026 (`dienstplaner-planung/docs/
 * messung-termin-einstellungen.md`, Nachmessung T2):
 *  - Die **Terminliste** (`GET /events…`) trägt je Termin `eventFiles` – ohne Zusatzanfrage. Je Eintrag `title`,
 *    `domainType` (`file` oder `link`), `domainIdentifier` (die Datei-ID als Text) und `frontendUrl` (Download-Adresse
 *    bzw. der Link). **Ohne Größe.**
 *  - Ausführlich `GET /files/service/{id}`: `id`, `name`, `type` (`file`/`link`), `fileUrl`, **`size`** (Bytes, bei
 *    Links `null`).
 *  - Dateien öffnen sich über die Sitzung der Seite (ohne Anmeldung 401) – in der Erweiterung also einfach als Link.
 */

export interface TerminDatei {
  id: number;
  name: string;
  art: 'datei' | 'link';
  /** Download-Adresse (Datei) bzw. das Ziel (Link) – geöffnet nur über `dateiAdresse`. */
  url: string;
  /** Bytes; `null` = unbekannt (die Terminliste liefert keine Größe, Links haben keine). */
  groesse: number | null;
}

const zahl = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

/** Größe in Bytes – als Zahl oder Text (wie bei den Arrangement-Dateien, `groesseVon`), sonst unbekannt. */
const bytes = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Die Dateien aus der Terminliste (`eventFiles`). **Ohne ID oder Adresse kein Eintrag** – eine Zeile, die sich weder
 * öffnen noch (T2b) löschen lässt, wäre schlimmer als keine.
 */
export function dateienAus(termin: { eventFiles?: unknown } | null | undefined): TerminDatei[] {
  const roh = termin?.eventFiles;
  if (!Array.isArray(roh)) return [];
  const aus: TerminDatei[] = [];
  for (const e of roh as Record<string, unknown>[]) {
    const id = zahl(e?.domainIdentifier);
    const url = text(e?.frontendUrl);
    if (id === null || !url) continue;
    aus.push({
      id,
      name: text(e.title) || url,
      art: e.domainType === 'link' ? 'link' : 'datei',
      url,
      groesse: null,
    });
  }
  return aus;
}

/** Die Dateien aus der ausführlichen Liste (`GET /files/service/{id}`, `data[]`) – mit Größe. */
export function dateienAusListe(roh: unknown): TerminDatei[] {
  if (!Array.isArray(roh)) return [];
  const aus: TerminDatei[] = [];
  for (const f of roh as Record<string, unknown>[]) {
    const id = zahl(f?.id);
    const url = text(f?.fileUrl);
    if (id === null || !url) continue;
    const art = f.type === 'link' ? 'link' : 'datei';
    aus.push({
      id,
      name: text(f.name) || url,
      art,
      url,
      groesse: art === 'link' ? null : bytes(f.size),
    });
  }
  return aus;
}

/**
 * **Wohin ein Tipp auf die Datei führt – oder `null`, wenn nirgendwohin.** Eine Datei nur in der eigenen Instanz (die
 * Sitzung soll an keinen fremden Host gehen, wie `ctDatei`), ein Link nur mit `http(s)`. ChurchTools prüft Links beim
 * Anlegen selbst (`javascript:` → 400, gemessen) – hier noch einmal, weil die Adresse aus ChurchTools-DATEN kommt und
 * ältere Einträge anders entstanden sein können.
 */
export function dateiAdresse(d: TerminDatei, basis: string): string | null {
  if (d.art === 'datei') return d.url.startsWith(`${basis}/`) ? d.url : null;
  try {
    const u = new URL(d.url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Woran man eine Liste wiedererkennt – ändert sich, wenn eine Datei dazukommt, wegfällt oder umbenannt wird. */
export function dateienSchluessel(dateien: readonly TerminDatei[]): string {
  return dateien.map((d) => `${d.id}:${d.name}`).join('|');
}
