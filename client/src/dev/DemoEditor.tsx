import { ChordEditor } from '../components/ChordEditor';
import { DEMO_EDITOR_TEXT as SAMPLE } from './demoEditorText';

/** NUR Entwicklung (?demo=editor): zeigt den ChordPro-Editor mit einem Beispiel-Lied, um Toolbar,
 *  Syntax-Farben, Rückgängig/Wiederholen und die PDF-Vorschau ohne ChurchTools zu prüfen. */
export function DemoEditor() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <ChordEditor
        songTitle="Treu"
        initialText={SAMPLE}
        initialName="Akustik"
        tonart="E"
        kapo={2}
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
