/**
 * **Die Worte und Farben der Freigabe** (Bauplan Website W3b-2) – eine Stelle für Etikett und Zeile, damit der Reiter
 * „Seiten“ und der Reiter „Freigaben“ dasselbe sagen. Die Regeln selbst stehen in `@shared/website/freigabe` und `status`.
 */
import type { EtikettTon } from '@ui/bedienung/Etikett';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { datumUhrText } from '@shared/ct/zeit';
import type { Eintrag, OnlineLage } from '@shared/website/freigabe';
import type { SeitenStatus } from '@shared/website/status';
import type { MailErgebnis } from './mailVersand';

export interface EtikettAngabe {
  text: string;
  ton: EtikettTon;
  /** Erklärung beim Darüberfahren. */
  title?: string;
}

/** „von Rita Redakteurin am 20.11.2026, 11:00“ – wer und wann. */
export function werUndWann(s: Pick<SeitenStatus, 'name' | 'zeit'>): string {
  return `von ${s.name || 'jemandem'} am ${datumUhrText(s.zeit)}`;
}

/**
 * **Das Etikett einer Seite:** ein Status geht vor („Eingereicht“, „Zurück“, „Löschen angefragt“); ohne Status sagt es, wo
 * die Seite gegenüber „Veröffentlicht“ steht. `null` = nichts zu sagen (Online-Stand unbekannt).
 */
export function seitenEtikett(
  status: SeitenStatus | null,
  lage: Exclude<OnlineLage, 'nurOnline'> | null,
): EtikettAngabe | null {
  if (status?.zustand === 'eingereicht')
    return {
      text: 'Eingereicht',
      ton: 'blau',
      title: `Zur Prüfung eingereicht ${werUndWann(status)}`,
    };
  if (status?.zustand === 'zurueck')
    return {
      text: 'Zurück',
      ton: 'rot',
      title: `Zurückgegeben ${werUndWann(status)}`,
    };
  if (status?.zustand === 'loeschenAngefragt')
    return {
      text: 'Löschen angefragt',
      ton: 'rot',
      title: `Löschen angefragt ${werUndWann(status)}`,
    };
  if (lage === 'gleich')
    return { text: 'Online', ton: 'gruen', title: 'So steht sie auf der Website.' };
  if (lage === 'nie')
    return { text: 'Entwurf', ton: 'neutral', title: 'Noch nicht veröffentlicht.' };
  if (lage === 'geaendert')
    return {
      text: 'Geändert',
      ton: 'neutral',
      title: 'Online steht noch die Fassung vor deinen Änderungen.',
    };
  return null;
}

/** Das Etikett eines Eintrags im Reiter „Freigaben“. */
export function eintragEtikett(e: Eintrag): EtikettAngabe {
  if (e.einheit === 'seite') {
    if (e.art === 'nurOnline')
      return {
        text: 'Online, Entwurf gelöscht',
        ton: 'rot',
        title: 'Die Seite steht noch auf der Website.',
      };
    return (
      seitenEtikett(e.status, e.lage === 'nurOnline' ? null : e.lage) ?? {
        text: 'Entwurf',
        ton: 'neutral',
      }
    );
  }
  return e.lage === 'nie'
    ? { text: 'Noch nicht online', ton: 'neutral' }
    : {
        text: 'Geändert',
        ton: 'neutral',
        title: 'Online steht noch die Fassung vor den Änderungen.',
      };
}

/**
 * Was bei einem gescheiterten Veröffentlichen, Zurückgeben … zu lesen ist: **was NICHT geschah**, der Grund, und ob ein neuer
 * Versuch lohnt. Vorübergehend ist nicht ungültig – nichts gilt als erledigt, was nicht nachgelesen ist.
 */
export function misserfolg(e: unknown, nichtGeschehen: string): string {
  const m = fehlerMeldung(e);
  return `${nichtGeschehen} ${m.text}${m.nochmal ? ' Du kannst es noch einmal versuchen.' : ''}`;
}

/** Wozu die Mail gehörte – bestimmt, wer benachrichtigt wurde und was bei „unklar“ nicht noch einmal getan werden soll. */
export type MailZweck = 'einreichen' | 'loeschen' | 'zurueck' | 'freigeben';

const MAIL_TEXTE: Record<
  MailZweck,
  { gesendet: string; wem: string; unklar: string; trotzdem: string }
> = {
  einreichen: {
    gesendet: 'Die Leitung ist per Mail benachrichtigt.',
    wem: 'die Leitung',
    unklar:
      'Ob die Mail an die Leitung rausging, ist unklar. Bitte nicht noch einmal einreichen – die Leitung sieht die Seite auch im Reiter „Freigaben“.',
    trotzdem: 'Die Seite ist trotzdem eingereicht und steht für die Leitung unter „Freigaben“.',
  },
  loeschen: {
    gesendet: 'Die Leitung ist per Mail benachrichtigt.',
    wem: 'die Leitung',
    unklar:
      'Ob die Mail an die Leitung rausging, ist unklar. Bitte nicht noch einmal anfragen – die Leitung sieht die Anfrage auch im Reiter „Freigaben“.',
    trotzdem: 'Die Anfrage gilt trotzdem und steht für die Leitung unter „Freigaben“.',
  },
  zurueck: {
    gesendet: 'Wer eingereicht hatte, ist per Mail benachrichtigt.',
    wem: 'den Einreichenden',
    unklar:
      'Ob die Mail rausging, ist unklar. Bitte nicht noch einmal zurückgeben – die Anmerkung steht an der Seite.',
    trotzdem: 'Die Seite ist trotzdem zurückgegeben, die Anmerkung steht an der Seite.',
  },
  freigeben: {
    gesendet: 'Wer eingereicht hatte, ist per Mail benachrichtigt.',
    wem: 'die Einreichenden',
    unklar: 'Ob die Mail rausging, ist unklar. Bitte nicht noch einmal freigeben – es ist online.',
    trotzdem: 'Es ist trotzdem online.',
  },
};

/**
 * **Der kurze Hinweis zur Mail** (W3b-3) – drei Ausgänge, die der Mensch unterscheiden muss: gesendet · nicht verschickt (mit
 * Grund) · unklar. Schalter aus und „niemand zu benachrichtigen“ sagen **nichts** (`null`). Die Handlung selbst gilt in jedem
 * Fall – das sagt der Hinweis bei „nicht verschickt“ ausdrücklich dazu.
 */
export function mailHinweis(e: MailErgebnis, zweck: MailZweck): string | null {
  const t = MAIL_TEXTE[zweck];
  if (e.art === 'gesendet') return t.gesendet;
  if (e.art === 'unklar') return t.unklar;
  if (e.art === 'nichtVerschickt')
    return `Die Mail an ${t.wem} ging nicht raus: ${e.grund.trim()} ${t.trotzdem}`;
  return null;
}

// ── Bereiche (W3b-4b) ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Namen der Bereiche: die Gruppe „Website“ und jede eingerichtete Untergruppe (aus dem Start, `Untergruppe`). */
export interface BereichsNamen {
  website: string;
  untergruppen: readonly { gruppe: number; name: string }[];
}

/** Wie ein Bereich heißt – `null` ist die Website; eine unbekannte Untergruppe heißt „Gruppe 347“. */
export function bereichsName(n: BereichsNamen, bereich: number | null): string {
  if (bereich === null) return n.website;
  return n.untergruppen.find((u) => u.gruppe === bereich)?.name ?? `Gruppe ${bereich}`;
}

/**
 * **Verschoben, aber nicht ganz** (`Freigegeben.bleibtIn`): Die Seite ist in ihrem Bereich online, steht aber zusätzlich noch im
 * alten. Kein Fehler der Freigabe – aber nicht verschweigen. `null`, wenn sie nur in ihrem Bereich steht.
 */
export function bleibtHinweis(
  titel: string,
  bleibtIn: readonly (number | null)[] | undefined,
  n: BereichsNamen,
): string | null {
  if (!bleibtIn || bleibtIn.length === 0) return null;
  const wo = bleibtIn.map((b) => `„${bereichsName(n, b)}“`).join(', ');
  return `„${titel}“ steht zusätzlich noch online im Bereich ${wo} – dort ließ sie sich gerade nicht entfernen. Sie bleibt darum unter „Freigaben“ als „Geändert“; erneut freigeben räumt das auf (aus dem Bereich der Website kann das nur die Leitung der Website).`;
}

/**
 * **Bereich gewechselt, Online-Fassung mitgewandert** (W3b-4b-2, `bereichWechseln`): was die Leitung danach liest. Bleibt die Seite
 * zusätzlich im alten Bereich stehen, sagt es `bleibtHinweis` (dieselben Worte wie beim Freigeben).
 */
export function verschobenHinweis(
  titel: string,
  bereich: number | null,
  bleibtIn: readonly (number | null)[] | undefined,
  n: BereichsNamen,
): string {
  return (
    bleibtHinweis(titel, bleibtIn, n) ??
    `„${titel}“ steht online jetzt im Bereich „${bereichsName(n, bereich)}“.`
  );
}

/**
 * **Bereich gewechselt, aber online nicht verschoben** – der Entwurf trägt den neuen Bereich (gespeichert ist er), die Website
 * zeigt die Seite vorerst weiter aus dem alten. Kein Speicherfehler; „Veröffentlichen“ verschiebt sie (der Weg aus W3b-4b).
 */
export function nichtVerschobenText(titel: string, alt: number | null, n: BereichsNamen): string {
  return `Der neue Bereich von „${titel}“ ist gespeichert. Online steht die Seite aber vorerst noch im Bereich „${bereichsName(n, alt)}“ – „Veröffentlichen“ verschiebt sie.`;
}
