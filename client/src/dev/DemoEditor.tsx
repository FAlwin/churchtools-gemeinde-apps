import { ChordEditor } from '../components/ChordEditor';
import { DEMO_EDITOR_TEXT as SAMPLE } from './demoEditorText';
import type { LiedinfoQuelle } from '../utils/liedinfoFormular';

/**
 * Stammdaten wie aus ChurchTools (L4): Der Autor weicht vom Notenblatt ab (Hinweis am Feld), das Tempo fehlt dort
 * (vorbelegt? nein – das Notenblatt hat keins; ChurchTools hat 72).
 */
const DEMO_LIEDINFO: LiedinfoQuelle = {
  lied: {
    songId: 1,
    name: 'Treu',
    author: 'Gerster',
    ccli: '7090234',
    copyright: null,
    categoryId: 1,
  },
  arrangement: {
    id: 1,
    name: 'Standard',
    isDefault: true,
    key: 'E',
    tempo: 72,
    beat: null,
    duration: null,
    description: null,
    source: null,
    sourceReference: null,
    dateien: 1,
  },
  darf: true,
  // Wie ChurchTools: liefert den Stand nach dem Speichern. Für den E2E sichtbar gemacht.
  speichern: (aenderung) => {
    (window as unknown as { __liedinfo?: unknown }).__liedinfo = aenderung;
    return Promise.resolve({
      lied: { ...DEMO_LIEDINFO.lied, ...aenderung.lied },
      arrangement: {
        ...DEMO_LIEDINFO.arrangement,
        ...(aenderung.arrangement ?? {}),
      } as LiedinfoQuelle['arrangement'],
    });
  },
};

/** NUR Entwicklung (?demo=editor): zeigt den ChordPro-Editor mit einem Beispiel-Lied, um Toolbar,
 *  Syntax-Farben, Rückgängig/Wiederholen und die PDF-Vorschau ohne ChurchTools zu prüfen. */
export function DemoEditor() {
  const mitLiedinfo = new URLSearchParams(window.location.search).has('liedinfo');
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <ChordEditor
        songTitle="Treu"
        initialText={SAMPLE}
        initialName="Akustik"
        tonart="E"
        kapo={2}
        // Mit `&liedinfo` (L4) – ohne bleibt die Demo wie vorher: gespeichert wird Zeichen für Zeichen.
        liedinfo={mitLiedinfo ? DEMO_LIEDINFO : undefined}
        isNew={false}
        saving={false}
        error={null}
        onSave={(text, name) => {
          // Für den E2E (L1): was der Editor beim Speichern liefert.
          (window as unknown as { __gespeichert?: unknown }).__gespeichert = { text, name };
        }}
        onDelete={() => console.log('delete')}
        onClose={() => console.log('close')}
      />
    </div>
  );
}
