/**
 * **Die VDO.Ninja-Adressen des Gebetsabends** (Bauplan Gebetsabend G1) – EINE Stelle für Sender und Zuhörer, damit
 * die gemessenen Parameter nicht in jeder Ansicht nachgebaut werden.
 *
 * Gemessen (Messung S0/S0b/G0, 05.11.2026):
 *  - Sender `&audiodevice=1&videodevice=1&autostart`: Standard-Mikrofon und -Kamera ohne Auswahl. Mit
 *    `&videodevice=0` (nur Ton) zeigt VDO.Ninja dagegen eine Auswahl, dort greift `autostart` nicht.
 *  - Zuhörer `&cleanish`: nur das Bild, **außer** VDO.Ninjas Wiedergabe-Knopf, wenn der Browser das Abspielen sperrt.
 *    Mit `&cleanoutput` (bis G2) fehlte er: Im ChurchTools-iframe am iPhone blieb das Bild schwarz, bis man ins Feld
 *    tippte – ohne jeden Hinweis (Test-Instanz 05.11.2026, 15:47). Unser Tippen auf „zuhören“ zählt für das fremde
 *    iframe nicht, dessen Verbindung steht erst Sekunden später. Läuft danach am
 *    iPhone nach dem Entsperren weiter. `&bitrate=` begrenzt den Upload je Zuhörer (`BITRATE`).
 *  - Zuhörer mit Bild `&videocontrols`: die Steuerleiste des Geräts im Bild – am iPhone Apples Player mit **echtem
 *    Vollbild**, auch in der ChurchTools-PWA (Messung 05.11.2026, test-05.11e). **Bild-in-Bild** bietet Apple nur in
 *    Safari an, in der PWA nicht – unabhängig vom Player (gegengeprüft mit eigenem `<video>` über das VDO.Ninja-SDK).
 *  - `&label=` des Zuhörers kommt beim Sender als `push-connection-info.label` an („Wer hört zu?“, G4).
 */
import type { Zugang } from './zugang';

export const VDO_BASIS = 'https://vdo.ninja/';

/**
 * Auflösung des Senders: `0` = 1920×1080 (VDO.Ninja `&quality`; ohne Angabe wählt es je Gerät selbst, „nicht immer
 * 720p“). Alwin, 05.11.2026: fest Full HD. Wie scharf es beim Zuhörer ankommt, begrenzt `BITRATE` – und VDO.Ninja
 * verkleinert das Bild je Zuhörer auf dessen Playergröße (gemessen G0: 36 % am Mac, 86 % am iPhone).
 */
export const QUALITAET = 0;

/**
 * Kbit/s, die ein Zuhörer mit Bild höchstens anfordert. Jeder Zuhörer bekommt einen eigenen Strom vom Gerät im Raum
 * (P2P): Bei 40 Mbit/s Upload im Gemeindehaus (Alwin, 05.11.2026) sind 10 Zuhörer = 20 Mbit/s, 15 = 30 Mbit/s – Reserve
 * für alles andere. Bis dahin 1000 (S0b).
 */
export const BITRATE = 2000;

/** Was das iframe des Senders darf (G0-3: Kamera und Mikro fragt der Browser für die ChurchTools-Adresse ab). */
export const ERLAUBNIS_SENDER = 'camera; microphone; autoplay; fullscreen';
/** Was das iframe eines Zuhörers darf – Vollbild und Bild-in-Bild der Apple-Leiste; kein Mikrofon (Mitmachen erst V2). */
export const ERLAUBNIS_ZUHOERER = 'autoplay; fullscreen; picture-in-picture';

/** Name des Senders, den die Zuhörer sehen (`view-connection-info.label`). */
export const SENDER_NAME = 'Technik';

const teil = (s: string) => encodeURIComponent(s);

export function senderLink(z: Pick<Zugang, 'streamId' | 'passwort' | 'mitBild'>): string {
  return (
    `${VDO_BASIS}?push=${teil(z.streamId)}&password=${teil(z.passwort)}` +
    `&audiodevice=1&videodevice=${z.mitBild ? `1&quality=${QUALITAET}` : 0}&autostart&label=${teil(SENDER_NAME)}`
  );
}

/** `name` = Vor- und Nachname aus ChurchTools – zwei gleiche Vornamen wären beim Sender nicht zu unterscheiden (G0-3). */
export function zuhoererLink(
  z: Pick<Zugang, 'streamId' | 'passwort' | 'mitBild'>,
  name: string,
): string {
  const bild = z.mitBild ? `&bitrate=${BITRATE}&videocontrols` : '&novideo';
  return (
    `${VDO_BASIS}?view=${teil(z.streamId)}&password=${teil(z.passwort)}` +
    `${bild}&cleanish&label=${teil(name.trim() || 'Gast')}`
  );
}
