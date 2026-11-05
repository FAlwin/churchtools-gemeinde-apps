// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CtSong } from '@shared/ct/typen';
import { LiedAnsicht } from './LiedAnsicht';

/**
 * Die Dateien der Lied-Ansicht kommen aus ChurchTools-Daten (#849). ChurchTools lehnt `javascript:` beim Anlegen ab
 * (gemessen) – über die API oder aus älteren Einträgen kann trotzdem so eine Adresse dastehen. Sie darf kein Link werden.
 */
const lied = (fileUrl: string) =>
  ({
    id: 7,
    name: 'Lied',
    author: null,
    ccli: null,
    arrangements: [
      {
        id: 70,
        name: 'A',
        key: null,
        keyOfArrangement: null,
        bpm: null,
        beat: null,
        files: [{ name: 'Noten.pdf', fileUrl }],
      },
    ],
  }) as unknown as CtSong;

const punkt = {
  id: 1,
  titel: 'Lied',
  song: { songId: 7, arrangementId: 70, title: 'Lied', originalKey: null, bpm: null },
} as unknown as Parameters<typeof LiedAnsicht>[0]['punkt'];

function zeige(fileUrl: string) {
  render(
    <LiedAnsicht
      terminId={1}
      punkt={punkt}
      lied={lied(fileUrl)}
      musikApp={null}
      onClose={() => {}}
    />,
  );
  return screen.getByText('Noten.pdf').closest('a');
}

describe('LiedAnsicht – Dateien nur mit sicherer Adresse (#849)', () => {
  it('eine Datei aus ChurchTools öffnet sich', () => {
    expect(zeige('https://ct.test/?q=public/filedownload&id=5')?.getAttribute('href')).toBe(
      'https://ct.test/?q=public/filedownload&id=5',
    );
  });

  it('javascript: wird kein Link', () => {
    expect(zeige('javascript:alert(1)//?q=public/filedownload&id=5')).toBeNull();
  });
});
