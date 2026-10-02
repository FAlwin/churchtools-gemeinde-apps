import type { ReactNode } from 'react';
import styles from './Segment.module.scss';

interface SegmentOption<T extends string> {
  value: T;
  /** Beschriftung – darf einen Zähler enthalten (Abwesenheiten: „Einträge" + rote Zahl). */
  label: ReactNode;
}

interface SegmentProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Name der Gruppe für Screenreader („Zeitraum", „Ansicht"). */
  ariaLabel?: string;
  /** Optionale Klasse für äußere Abstände. */
  className?: string;
  /** Ausgegraute Optionen (z. B. „Vergangene" ohne Netz) – bleiben tippbar, der Aufrufer erklärt warum. */
  dimmed?: T[];
}

/**
 * Segment-Control (iOS-/ChurchTools-Stil): eine Auswahl aus 2–3 Optionen – **der eine Umschalter
 * der App**.
 *
 * Bis zum 02.10.2026 stand in `pages/Availability.tsx` eine eigene Kopie samt eigenem CSS. Sie hatte
 * zwei Dinge, die hier fehlten (`aria-pressed`, Gruppenname) – beide sind jetzt hier, und die Kopie
 * ist weg. Anlass war die unsichtbare Schiene (`--seg-track`): Sie hätte sonst an zwei Stellen
 * korrigiert werden müssen.
 */
export function Segment<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  dimmed = [],
}: SegmentProps<T>) {
  return (
    <div
      className={`${styles.seg}${className ? ' ' + className : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={`${styles.btn}${value === o.value ? ' ' + styles.on : ''}${dimmed.includes(o.value) ? ' ' + styles.off : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
