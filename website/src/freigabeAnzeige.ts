/**
 * **Die Worte und Farben der Freigabe** (Bauplan Website W3b-2) – eine Stelle für Etikett und Zeile, damit der Reiter
 * „Seiten“ und der Reiter „Freigaben“ dasselbe sagen. Die Regeln selbst stehen in `@shared/website/freigabe` und `status`.
 */
import type { EtikettTon } from '@ui/bedienung/Etikett';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { datumUhrText } from '@shared/ct/zeit';
import type { Eintrag, OnlineLage } from '@shared/website/freigabe';
import type { SeitenStatus } from '@shared/website/status';

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
