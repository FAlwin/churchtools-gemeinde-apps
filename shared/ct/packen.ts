/**
 * **Text kompakt in einen ChurchTools-Wert packen** – deflate + Base64url. Stand bis 22.10.2026 nur privat in
 * `shared/anmeldung/formular.ts` (Einstellungen in der Gruppenbeschreibung); die Protokolle brauchen dasselbe für
 * ihre Protokoll-Teile (Bauplan Protokolle 3.3: ein langes Protokoll packt sich von ~80 Tsd. auf ~16 Tsd. Zeichen).
 * Eine Stelle für beide, damit die beiden Kodierungen nicht auseinanderlaufen.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

export function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function ausBase64url(code: string): Uint8Array {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Text → gepackter Code (nur die Zeichen `A–Z a–z 0–9 - _`). */
export function textPacken(text: string): string {
  return base64url(deflateSync(strToU8(text), { level: 9 }));
}

/** Gegenstück zu `textPacken`. Wirft bei kaputtem Code – der Aufrufer entscheidet, was das heißt. */
export function textEntpacken(code: string): string {
  return strFromU8(inflateSync(ausBase64url(code)));
}
