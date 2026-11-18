import type { RefObject } from 'react';
import a from './AnmeldungenReiter.module.scss';

/**
 * **„Antwort einfügen“** (F7a, F7b) – je Frage ein Knopf, der `[Name]` an die Schreibmarke im Textfeld setzt, wie die
 * Platzhalter der Rundmail. Darunter, welche eckigen Klammern keine Frage meinen: Sie bleiben Text, und das soll
 * niemanden überraschen. Die EINE Stelle für Bestätigung und zweite Mail.
 */
export function AntwortKnoepfe({
  namen,
  feld,
  wert,
  onWert,
}: {
  namen: readonly string[];
  /** Das Textfeld, in das eingefügt wird – für die Schreibmarke. */
  feld: RefObject<HTMLTextAreaElement | null>;
  wert: string;
  onWert: (neu: string) => void;
}) {
  const einfuegen = (name: string) => {
    const el = feld.current;
    const token = `[${name}]`;
    const von = el?.selectionStart ?? wert.length;
    const bis = el?.selectionEnd ?? wert.length;
    onWert(wert.slice(0, von) + token + wert.slice(bis));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(von + token.length, von + token.length);
    });
  };
  const bleibtText = [...new Set([...wert.matchAll(/\[([^[\]\n]+)\]/g)].map((m) => m[1]))].filter(
    (n) => !namen.includes(n),
  );
  return (
    <>
      <p className={a.leise}>
        Antwort einfügen – ChurchTools füllt sie je Person:{' '}
        {namen.map((n) => (
          <button
            key={n}
            type="button"
            className={`${a.pille} ${a.platzhalterKnopf}`}
            onClick={() => einfuegen(n)}
          >
            [{n}]
          </button>
        ))}
      </p>
      {bleibtText.length > 0 && (
        <p className={a.leise}>
          Bleibt als Text stehen (keine Frage): {bleibtText.map((n) => `[${n}]`).join(', ')}
        </p>
      )}
    </>
  );
}
