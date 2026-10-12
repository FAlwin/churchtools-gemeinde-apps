import { useCallback, useEffect, useRef, useState } from 'react';

/** So lange steht „Rückgängig" nach einer Änderung bereit. */
export const RUECKGAENGIG_MS = 8000;

/**
 * „Rückgängig" für die letzte eigene Änderung am Ablauf (Alwin, 12.10.2026): Löschen und Verschieben.
 *
 * Es gibt immer nur EIN Angebot – eine neue Änderung ersetzt das alte, wie in anderen Apps auch. Nach
 * `RUECKGAENGIG_MS` verschwindet es von selbst. Ausgelöst wird höchstens einmal: Der Hinweis ist weg,
 * bevor der Schreibvorgang beginnt, ein zweites Tippen findet keinen Knopf mehr.
 */
export function useRueckgaengig(): {
  angebot: string | null;
  anbieten: (text: string, tun: () => Promise<void>) => void;
  ausloesen: () => Promise<void>;
  verwerfen: () => void;
} {
  const [angebot, setAngebot] = useState<{ text: string; tun: () => Promise<void> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verwerfen = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAngebot(null);
  }, []);

  const anbieten = useCallback((text: string, tun: () => Promise<void>) => {
    if (timer.current) clearTimeout(timer.current);
    setAngebot({ text, tun });
    timer.current = setTimeout(() => {
      timer.current = null;
      setAngebot(null);
    }, RUECKGAENGIG_MS);
  }, []);

  const ausloesen = useCallback(async () => {
    const a = angebot;
    verwerfen();
    if (a) await a.tun();
  }, [angebot, verwerfen]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { angebot: angebot?.text ?? null, anbieten, ausloesen, verwerfen };
}
