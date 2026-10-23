/**
 * Metadaten aus ChordPro-Text lesen (#198).
 *
 * ChordPro schreibt Kopfangaben als `{title: …}`, `{artist: …}`, `{key: E}`, `{time: 4/4}`,
 * `{tempo: 72}`. Sie haben Vorrang vor dem, was ChurchTools am Lied/Arrangement hinterlegt hat –
 * wer die Datei bearbeitet, hat das letzte Wort.
 */

/**
 * Liest einen Metadaten-Wert aus ChordPro-Text ({key: E} → "E").
 *
 * Ein leerer Wert (`{title: }`) gilt als **nicht gesetzt** und liefert `null` – sonst würde eine
 * halb getippte Kopfzeile den ChurchTools-Wert durch nichts ersetzen (#236).
 */
export function metaValue(chordpro: string, key: string): string | null {
  // Ersten NICHT-leeren Treffer nehmen: eine leere Kopfzeile soll einen späteren echten Wert
  // nicht verdecken.
  return metaWerte(chordpro, key)[0] ?? null;
}

/**
 * **Alle nicht-leeren Werte einer Kopfangabe**, in der Reihenfolge der Datei. SongSelect schreibt etwa zwei
 * `{artist: …}`-Zeilen (Original und Übersetzung) – `metaValue` sieht nur die erste, beim Umräumen nach ChurchTools
 * (Lied-Editor L4) darf die zweite aber nicht verloren gehen. EINE Grammatik für beide.
 */
export function metaWerte(chordpro: string, key: string): string[] {
  const re = new RegExp(`\\{${key}\\s*:\\s*([^}]*)\\}`, 'gi');
  return [...chordpro.matchAll(re)].map((m) => m[1].trim()).filter(Boolean);
}
