import { describe, expect, it } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { GRUNDWERTE, sommerferienAus, wechseljahre } from '@shared/organigramm/gruppenwechsel';
import type { KeinSchalterGrund } from '@shared/organigramm/gruppenwechselSicht';
import { tagPunkt } from '@shared/ct/datum';
import { ausnahmeFehlerText, keinSchalterText } from './ausnahmeTexte';

const [JAHR] = wechseljahre(
  sommerferienAus(
    [{ titel: 'Sommerferien NRW 2027', beginn: '2027-07-19', ende: '2027-08-31' }],
    'Sommerferien',
  ),
  GRUNDWERTE,
);

describe('ausnahmeTexte', () => {
  it('jeder Grund hat einen eigenen Text; vor der Ankündigung steht der Tag', () => {
    const gruende: KeinSchalterGrund[] = [
      'abAnkuendigung',
      'zuSpaet',
      'rechtFehlt',
      'rechtUnbekannt',
      'nichtLesbar',
    ];
    const texte = gruende.map((g) => keinSchalterText(g, JAHR));
    expect(new Set(texte).size).toBe(gruende.length);
    expect(texte[0]).toBe(
      `Eine Ausnahme kannst du ab dem ${tagPunkt(JAHR.ankuendigung)} eintragen.`,
    );
  });

  it('Fehler: „nicht übernommen“ sagt genau das, alles andere beginnt mit „Gerade nicht gespeichert“', () => {
    expect(ausnahmeFehlerText(new NichtUebernommen('die Ausnahme'))).toBe(
      'ChurchTools hat die Ausnahme nicht übernommen. Bitte noch einmal versuchen.',
    );
    expect(ausnahmeFehlerText(new ApiError(503, 'x'))).toMatch(
      /^Gerade nicht gespeichert\. ChurchTools antwortet gerade nicht/,
    );
    expect(ausnahmeFehlerText(new TypeError('Failed to fetch'))).toMatch(
      /^Gerade nicht gespeichert\./,
    );
    expect(ausnahmeFehlerText(new ApiError(403, 'Du darfst das nicht.'))).toBe(
      'Gerade nicht gespeichert. Du darfst das nicht.',
    );
  });
});
