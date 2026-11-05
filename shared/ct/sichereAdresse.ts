/**
 * **Adressen aus fremden Daten – die eine Prüfung** (#849, Code-Check 04.11.2026).
 *
 * Was in ChurchTools steht (Links in Protokollen, Termin-Dateien, Arrangement-Dateien, Logos, Links der Gemeinde), kann
 * jeder mit dem passenden Recht über die API setzen – an der Oberfläche vorbei. React blockt `javascript:` in `href`
 * NICHT; ein solcher Link liefe mit der vollen ChurchTools-Sitzung der Person, die ihn antippt. Bis dahin gab es drei
 * eigene Prüfungen (`sichereAdresse` in den Protokollen, `dateiAdresse`, das Links-Schema der Musik-App), und die
 * Dateien der Lied-Ansicht im Dienstplaner gingen ungeprüft an `href`.
 *
 * Geprüft wird über `URL`, nicht über einen Textanfang: `new URL` kennt die Regeln des Browsers (Groß-/Kleinschreibung,
 * Leerzeichen, `https://instanz.church.tools.fremd.de`).
 */

/** Ein Link, der sicher zu öffnen ist: nur `http(s)` – auf Wunsch auch `mailto:`. Sonst `null`. */
export function sichererLink(roh: unknown, o: { mailto?: boolean } = {}): string | null {
  if (typeof roh !== 'string') return null;
  const adresse = roh.trim();
  try {
    // Geprüft über `URL`, zurück kommt die Adresse wie geschrieben (ohne angehängten „/“ o. Ä.).
    const u = new URL(adresse);
    if (u.protocol === 'https:' || u.protocol === 'http:') return adresse;
    if (o.mailto && u.protocol === 'mailto:') return adresse;
  } catch {
    // keine gültige Adresse
  }
  return null;
}

/**
 * Eine Adresse **in der eigenen ChurchTools-Instanz** (`basis` wie `https://gemeinde.church.tools`) – für Dateien, bei
 * denen die Sitzung mitgehen kann, und für Bilder, die sonst einem fremden Host verraten, wer das Formular ansieht.
 * Sonst `null`.
 */
export function adresseInInstanz(roh: unknown, basis: string): string | null {
  const link = sichererLink(roh);
  if (!link) return null;
  try {
    return new URL(link).origin === new URL(basis).origin ? link : null;
  } catch {
    return null;
  }
}
