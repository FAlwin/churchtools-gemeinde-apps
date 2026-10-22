/**
 * **Ein Dokument, wie BlockNote es liefert** – aufgenommen am 22.10.2026 aus dem S0-Durchstich
 * (`arbeitskopien/sitzungen-s0/sitzungen-spike`, BlockNote 0.56, `JSON.stringify(editor.document)`), nicht von
 * Hand geschrieben: Die Tests sollen gegen das prüfen, was der Erzeuger wirklich ausgibt (Formatierung als
 * `styles`, Links mit eigenem `content`, Unterpunkte als `children`, Zusatz-`props` wie `textColor`).
 *
 * Der Block `aufgabe` hatte im Durchstich noch `wer/bis/erledigt` als Eigenschaften; im Bau stehen die in
 * „Mitarbeit“ (`props.aufgabe` = Verweis). Sobald der Editor in S4 im Repo ist, kommt ein Test mit dessen
 * echtem Schema dazu.
 */
import type { Block } from './dokument';

export const BLOCKNOTE_DOKUMENT: Block[] = JSON.parse(
  '[{"id":"5a4bf510-ed1d-48e0-bd77-8ffd7f832d09","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":1,"isToggleable":false},"content":[{"type":"text","text":"Andacht & Gebet","styles":{}}],"children":[]},' +
    '{"id":"82139c8f-afed-44fe-95e1-a0fb8f18c6a4","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Peter: ","styles":{"bold":true}},{"type":"text","text":"Römer 12, 9–13","styles":{"italic":true}}],"children":[]},' +
    '{"id":"24e72200-5688-4b9e-84ca-1b1dd7b25a4e","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":1,"isToggleable":false},"content":[{"type":"text","text":"Termine & Gemeindeleben","styles":{}}],"children":[]},' +
    '{"id":"73f559a4-a1c8-43de-96dd-9a9658c85827","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Hauptpunkt","styles":{}}],"children":[{"id":"44e3957f-69bc-4d34-9514-3c6e20a280bd","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Unterpunkt","styles":{}}],"children":[{"id":"5bbbef08-4a7a-4394-98ad-ee3253937552","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ganz tief","styles":{}}],"children":[]}]}]},' +
    '{"id":"d9aaec23-1dad-4f34-b084-7d41b2ab8db5","type":"aufgabe","props":{"wer":"Spike Musiker","bis":"2026-11-01","erledigt":false},"content":[{"type":"text","text":"Beamer reparieren lassen","styles":{}}],"children":[]},' +
    '{"id":"a4dca02b-f2d5-4af6-b5a4-4a849465d204","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"Zwischenüberschrift","styles":{}}],"children":[]},' +
    '{"id":"462d31da-ecd4-4fe0-b042-5a5c32eae217","type":"quote","props":{"backgroundColor":"default","textColor":"default"},"content":[{"type":"text","text":"Ein Zitat","styles":{}}],"children":[]},' +
    '{"id":"ace23568-77d0-4e09-8462-57970d4770e9","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"link","href":"https://example.org","content":[{"type":"text","text":"Link","styles":{}}]}],"children":[]}]',
) as Block[];
