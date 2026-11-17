import type { Ladestand } from '@ui/ct/useLaden';
import { werVorschau, type WerVorschau } from '@shared/organigramm/einrichtungVorschau';
import type { GruppenwechselEinstellung, Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { FerienStand, KjLadeStand } from './ladeKinderJugend';
import type { Teil } from './WerTabelle';

/**
 * **„Wer wechselt wann wohin“ aus dem, was gerade geladen ist** – eine Stelle für die Vorschau von „Einrichten / Stufen
 * ändern“ und von „Wechseltage nachtragen“ (O9-5d). Jeder Zustand bleibt, was er ist: lädt, nicht ladbar (mit „Erneut
 * versuchen“) oder da – ein Lesefehler wird nie zu „keine Kinder“.
 */
export function werTeil(a: {
  ferien: { stand: Ladestand<FerienStand>; neu: () => void };
  kinder: { stand: Ladestand<KjLadeStand>; neu: () => void };
  einstellung: GruppenwechselEinstellung;
  jahre: readonly Wechseljahr[];
  /** Der Name des Ferienkalenders, für die Meldung, wenn es ihn nicht gibt. */
  kalender: string;
}): Teil<WerVorschau> {
  const f = a.ferien.stand;
  if (f.art === 'fehler') return { art: 'fehler', text: f.fehler.text, neu: a.ferien.neu };
  if (f.art !== 'fertig') return { art: 'laedt' };
  if (f.daten.art !== 'da')
    return {
      art: 'fehler',
      text:
        f.daten.art === 'keinKalender'
          ? `Den Kalender „${a.kalender}“ gibt es nicht oder er ist für dich nicht sichtbar.`
          : 'Der Ferienkalender ließ sich gerade nicht lesen.',
      neu: a.ferien.neu,
    };
  const k = a.kinder.stand;
  if (k.art === 'fehler') return { art: 'fehler', text: k.fehler.text, neu: a.kinder.neu };
  if (k.art !== 'fertig') return { art: 'laedt' };
  if (k.daten.art === 'fehler')
    return { art: 'fehler', text: 'Die Kinder ließen sich gerade nicht lesen.', neu: a.kinder.neu };
  return { art: 'da', daten: werVorschau(k.daten.daten, a.einstellung, a.jahre) };
}
