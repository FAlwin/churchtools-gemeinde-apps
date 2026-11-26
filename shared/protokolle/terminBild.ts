/**
 * **Was nach dem Anlegen zum Bild zu sagen ist** (Reiter „Kalender“, Feld „Bild“) – `null`, wenn es am Termin steht. `fehlt`:
 * ChurchTools hat nach dem Hochladen kein Bild am Termin (ein `200` war kein Beleg); `unklar`: das Nachlesen selbst ist
 * gescheitert (dann wissen wir es nicht – vorübergehend ist nicht ungültig). Gleiche Form wie bei den Events.
 */
export function bildHinweis(ergebnis: { fehlt: boolean; unklar: boolean }): string | null {
  if (ergebnis.unklar)
    return 'Ob das Bild gespeichert wurde, ließ sich nicht nachlesen. Bitte in ChurchTools am Termin nachsehen und es bei Bedarf noch einmal hinzufügen – der Termin selbst steht im Kalender.';
  if (ergebnis.fehlt)
    return 'Das Bild wurde nicht am Termin gespeichert – bitte in ChurchTools am Termin hinzufügen. Der Termin selbst steht im Kalender.';
  return null;
}

/** Hat der gelesene Termin ein Bild? `image` ist ein Objekt (`id`, `imageUrl`, `name`) – ohne Bild `null`. */
export const hatBild = (image: unknown): boolean =>
  typeof image === 'object' && image !== null && Object.keys(image).length > 0;
