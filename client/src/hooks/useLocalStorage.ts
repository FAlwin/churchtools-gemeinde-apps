import { useCallback, useState } from 'react';
import { lokalSchreiben } from '../utils/lokalSpeicher';

/**
 * Wie useState, persistiert den Wert aber in localStorage.
 * Serialisiert via JSON. Fällt bei Fehlern auf den Initialwert zurück.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        lokalSchreiben(key, JSON.stringify(next)); // voll → Wert bleibt zumindest im State
        return next;
      });
    },
    [key],
  );

  return [stored, setValue];
}
