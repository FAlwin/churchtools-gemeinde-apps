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
 *    iPhone nach dem Entsperren weiter. `&bitrate=1000` begrenzt den Upload je Zuhörer (≈ 1 Mbit/s).
 *  - `&label=` des Zuhörers kommt beim Sender als `push-connection-info.label` an („Wer hört zu?“, G4).
 */
import type { Zugang } from './zugang';

export const VDO_BASIS = 'https://vdo.ninja/';

/** Kbit/s, die ein Zuhörer mit Bild anfordert (S0b). */
export const BITRATE = 1000;

/** Was das iframe des Senders darf (G0-3: Kamera und Mikro fragt der Browser für die ChurchTools-Adresse ab). */
export const ERLAUBNIS_SENDER = 'camera; microphone; autoplay; fullscreen';
/** Was das iframe eines Zuhörers darf – kein Mikrofon, Mitmachen gibt es erst in V2. */
export const ERLAUBNIS_ZUHOERER = 'autoplay; fullscreen';

/** Name des Senders, den die Zuhörer sehen (`view-connection-info.label`). */
export const SENDER_NAME = 'Technik';

const teil = (s: string) => encodeURIComponent(s);

export function senderLink(z: Pick<Zugang, 'streamId' | 'passwort' | 'mitBild'>): string {
  return (
    `${VDO_BASIS}?push=${teil(z.streamId)}&password=${teil(z.passwort)}` +
    `&audiodevice=1&videodevice=${z.mitBild ? 1 : 0}&autostart&label=${teil(SENDER_NAME)}`
  );
}

/** `name` = Vor- und Nachname aus ChurchTools – zwei gleiche Vornamen wären beim Sender nicht zu unterscheiden (G0-3). */
export function zuhoererLink(
  z: Pick<Zugang, 'streamId' | 'passwort' | 'mitBild'>,
  name: string,
): string {
  const bild = z.mitBild ? `&bitrate=${BITRATE}` : '&novideo';
  return (
    `${VDO_BASIS}?view=${teil(z.streamId)}&password=${teil(z.passwort)}` +
    `${bild}&cleanish&label=${teil(name.trim() || 'Gast')}`
  );
}
