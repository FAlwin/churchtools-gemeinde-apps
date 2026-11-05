/**
 * **Was die Zuhörer-Seite zeigt** (Bauplan Gebetsabend G2, Entwurf v2) – die Texte und Entscheidungen an EINER Stelle,
 * damit Karte, Knopf und Player nicht je eigene Regeln haben.
 *
 * Zwei Quellen:
 *  - **Vor dem Zuhören** der Merker „läuft seit“ aus dem Zugang (KV-Store, schreibt die Technik). Ohne ihn gibt es
 *    keinen leeren schwarzen Player, sondern „Noch keine Übertragung“; die Seite fragt regelmäßig nach.
 *  - **Beim Zuhören** der Player selbst (`zustand.ts`, aus den VDO.Ninja-Meldungen).
 */
import type { PlayerZustand } from './zustand';
import type { Zugang } from './zugang';

/** So oft fragt die Seite nach, ob die Technik gestartet, neu gestartet oder beendet hat. */
export const NACHFRAGEN_MS = 20_000;

export type VorStart = { art: 'aus' } | { art: 'laeuft'; seit: string };

export function vorStart(zugang: Zugang | null): VorStart {
  return zugang?.laeuftSeit ? { art: 'laeuft', seit: zugang.laeuftSeit } : { art: 'aus' };
}

/** Der Satz unter „Läuft seit …“, solange der Player offen ist. */
export const PLAYER_TEXT: Record<PlayerZustand, string> = {
  verbindet: 'Verbindet …',
  wartet: 'Verbunden – die Übertragung beginnt gleich.',
  laeuft: 'Verbunden – der Ton kommt gleich.',
  // „Ton kommt an“, nicht „du hörst“: VDO.Ninja meldet den angekommenen Ton, nicht ob er schon abgespielt wird
  // (iPhone: gemeldet, aber noch gesperrt – 05.11.2026).
  ton: 'Der Ton kommt an.',
  unterbrochen: 'Kurz unterbrochen – verbindet von selbst wieder …',
};

/**
 * Steht unter dem Player, solange er offen ist: Sperrt der Browser das Abspielen, zeigt VDO.Ninja seinen
 * Wiedergabe-Knopf (`&cleanish`) – ein Tippen ins Bild startet es.
 */
export const HINWEIS_TIPPEN = 'Bleibt das Bild schwarz? Einmal ins Bild tippen.';

/** Ist der Player „gut“ (grüner Punkt) oder wartet/stockt er (grauer Punkt)? */
export const PLAYER_GUT: Record<PlayerZustand, boolean> = {
  verbindet: false,
  wartet: false,
  laeuft: true,
  ton: true,
  unterbrochen: false,
};

/**
 * Was nach einer Nachfrage mit einem offenen Player passiert:
 *  - `weiter`: dieselbe Übertragung – nichts tun (der Player verbindet sich bei Aussetzern selbst neu, S0b).
 *  - `neu`: die Technik hat neu gestartet (neue StreamID/Passwort) – Player mit den neuen Daten neu laden, sonst
 *    hinge er an der alten Übertragung und zeigte für immer „unterbrochen“.
 *  - `beendet`: keine Übertragung mehr – Player schließen und „beendet“ sagen.
 */
export function nachNachfrage(
  gehoert: Pick<Zugang, 'streamId' | 'passwort' | 'mitBild'>,
  neu: Zugang | null,
): 'weiter' | 'neu' | 'beendet' {
  if (!neu?.laeuftSeit) return 'beendet';
  return neu.streamId === gehoert.streamId &&
    neu.passwort === gehoert.passwort &&
    neu.mitBild === gehoert.mitBild
    ? 'weiter'
    : 'neu';
}

/** Name für „Wer hört zu?“ beim Sender: Vor- und Nachname (G0-3: zwei gleiche Vornamen waren nicht zu trennen). */
export function zuhoererName(vorname: string, nachname: string | undefined): string {
  return [vorname, nachname ?? '']
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}
