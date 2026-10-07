/**
 * Was in dieser App als Datei durchgeht – **einzige Quelle für Client UND Server** (#321).
 *
 * Warum hier und nicht im Server: Eine hochgeladene Datei wandert vom Browser über den Server nach
 * ChurchTools. Damit prüfen zwei Stellen dieselbe Grenze – der Client, **bevor** er 50 MB durchs Netz
 * schickt, und der Server, bevor er sie annimmt. Stünde die Zahl an beiden Orten, wäre die Frage nur,
 * wann sie auseinanderlaufen: Der Client bötte dann etwas an, das der Server ablehnt – nach der
 * vollen Übertragung, also im schlechtesten Moment.
 *
 * Dieselbe Überlegung hat `shared/keys` (#250) und `shared/tempo` (#145) hervorgebracht.
 *
 * Der Wert lag vorher als `MAX_FILE_BYTES` in `server/src/services/ctHttp.ts` und galt dort fürs
 * LESEN aus ChurchTools. Beim Hochladen dieselbe Grenze zu nehmen ist Absicht: Was die App nicht
 * wieder ausliefern kann, soll sie auch nicht annehmen.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Die Grenze in Worten – für Meldungen an den Nutzer, damit „52428800" nirgends auftaucht. */
export const MAX_FILE_TEXT = '50 MB';

/**
 * Nur diese MIME-Typen werden 1:1 (inline) ausgeliefert. Alles andere reicht der Proxy als
 * `application/octet-stream` mit `Content-Disposition: attachment` durch. Hintergrund (#138):
 * Die Bytes kommen aus ChurchTools, wo jeder mit Upload-Recht (Musiker) eine Datei an ein
 * Arrangement hängen kann. Würde der Content-Type ungefiltert übernommen, könnte eine HTML-/JS-
 * Datei auf UNSERER Origin ausgeführt werden (in der Extension: auf der ChurchTools-Origin, #335) (Stored-XSS, umgeht die CSP über `'self'`). Die
 * App braucht nur PDF + Rasterbilder + Klartext. **SVG bewusst NICHT gelistet** – es kann
 * Skripte enthalten und würde als Bild auf der eigenen Origin rendern.
 */
const INLINE_SAFE_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
]);

/** Rein & testbar: entscheidet über Content-Type + ob als Download (attachment) ausgeliefert wird. */
export function sanitizeFileContentType(raw: string): {
  contentType: string;
  attachment: boolean;
} {
  const mime = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (INLINE_SAFE_MIME.has(mime)) return { contentType: raw, attachment: false };
  return { contentType: 'application/octet-stream', attachment: true };
}
