import { render } from '@testing-library/react';
import { LeisesPlus } from '@ui/bedienung/LeisesPlus';

/**
 * Die Klasse, die `LeisesPlus` seinem Knopf gibt – damit ein Test belegt, dass ein „+ …“ **dieser Baustein** ist und kein
 * Nachbau (R10, Regel-Dopplung): Ein eigener Knopf bekäme eine andere Klasse.
 */
export function leisesFeldKlasse(): string {
  const { container, unmount } = render(<LeisesPlus label="x" onClick={() => {}} />);
  const klasse = container.querySelector('button')!.className;
  unmount();
  return klasse;
}
