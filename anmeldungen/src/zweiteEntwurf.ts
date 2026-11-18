import type { ZweiteMail, ZweiteWann } from '@shared/anmeldung/ablaeufe';

/**
 * **Die zweite Mail im Fenster „Mails“** (F7b) – was das Fenster festhält, auch solange sie aus ist (Einschalten holt
 * den Text zurück), und der Weg von und zu dem, was gespeichert wird (`ZweiteMail`).
 */
export interface ZweiteEntwurf {
  an: boolean;
  art: ZweiteWann['art'];
  /** `null`: Feld leer. */
  tage: number | null;
  datum: string;
  betreff: string;
  text: string;
}

/** Der Entwurf als zweite Mail – `null`, wenn sie aus ist. Ein leeres Tage-Feld wird zu `NaN` (die Prüfung meldet es). */
export function zweiteAusEntwurf(w: ZweiteEntwurf): ZweiteMail | null {
  if (!w.an) return null;
  const wann: ZweiteWann =
    w.art === 'sofort'
      ? { art: 'sofort' }
      : w.art === 'tage'
        ? { art: 'tage', tage: w.tage ?? Number.NaN }
        : { art: 'datum', datum: w.datum };
  return { wann, betreff: w.betreff, text: w.text };
}

/** Der Entwurf aus dem, was in ChurchTools steht – ohne zweite Mail: aus, „gleich danach“, 3 Tage. */
export function entwurfAus(z: ZweiteMail | null): ZweiteEntwurf {
  return {
    an: !!z,
    art: z?.wann.art ?? 'sofort',
    tage: z?.wann.art === 'tage' ? z.wann.tage : 3,
    datum: z?.wann.art === 'datum' ? z.wann.datum : '',
    betreff: z?.betreff ?? '',
    text: z?.text ?? '',
  };
}
