// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';
import { oeffnePdf } from './sharePdf';
import { downloadFile } from './shareFile';

vi.mock('./shareFile', () => ({ downloadFile: vi.fn(), shareOrDownload: vi.fn() }));
const laden = vi.mocked(downloadFile);

const pdf = { output: () => new Blob(['%PDF'], { type: 'application/pdf' }) } as unknown as jsPDF;

afterEach(() => {
  vi.useRealTimers();
  laden.mockClear();
});

describe('oeffnePdf', () => {
  it('öffnet die PDF in einem neuen Tab und gibt die Adresse später frei', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:pdf-1');
    URL.revokeObjectURL = vi.fn();
    const oeffnen = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    oeffnePdf(pdf, 'Organigramm-Gemeinde');
    expect(oeffnen).toHaveBeenCalledWith('blob:pdf-1', '_blank');
    expect(laden).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
  });

  it('sperrt der Browser das Fenster, wird die PDF heruntergeladen', () => {
    URL.createObjectURL = vi.fn(() => 'blob:pdf-2');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue(null);
    oeffnePdf(pdf, 'Organigramm-Gemeinde');
    expect(laden).toHaveBeenCalledWith(expect.any(Blob), 'Organigramm-Gemeinde.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-2');
  });
});
