// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor } from '@dnd-kit/core';
import { LANG_DRUECKEN_MS, useZiehSensorenLangDruecken } from './useZiehSensoren';

/** Board der To-Dos (S7-3): Maus nach 6 px, Finger erst nach langem Drücken – sonst blättert man nicht mehr. */
vi.mock('@dnd-kit/core', async (orig) => {
  const echt = await orig<typeof import('@dnd-kit/core')>();
  return { ...echt, useSensor: vi.fn(echt.useSensor) };
});

describe('useZiehSensorenLangDruecken', () => {
  it('Maus: 6 px; Finger: ~0,4 s liegen lassen mit 8 px Spiel; Tastatur', () => {
    renderHook(() => useZiehSensorenLangDruecken());
    const aufrufe = vi.mocked(useSensor).mock.calls;
    const mit = (s: unknown) =>
      aufrufe.find(([x]) => x === s)?.[1] as Record<string, unknown> | undefined;
    expect(mit(MouseSensor)).toEqual({ activationConstraint: { distance: 6 } });
    expect(mit(TouchSensor)).toEqual({ activationConstraint: { delay: 400, tolerance: 8 } });
    expect(LANG_DRUECKEN_MS).toBe(400);
    expect(aufrufe.some(([x]) => x === KeyboardSensor)).toBe(true);
  });
});
