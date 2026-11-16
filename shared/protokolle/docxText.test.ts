import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { docxText, textAusDocumentXml } from './docxText';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="x"';
const docx = (bodyXml: string, name = 'word/document.xml'): Uint8Array =>
  zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    [name]: strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}</w:body></w:document>`,
    ),
  });
const p = (inner: string): string => `<w:p><w:r><w:t>${inner}</w:t></w:r></w:p>`;

describe('docxText', () => {
  it('liest mehrere Absätze als Zeilen, mit Umlauten', () => {
    const r = docxText(docx(p('Größe: Müller & Söhne') + p('Zweiter Absatz ß') + p('Dritter')));
    expect(r).toEqual({ ok: true, text: 'Größe: Müller & Söhne\nZweiter Absatz ß\nDritter' });
  });

  it('hängt w:t eines Absatzes aneinander (mehrere Formatierungsläufe), Leerzeichen bleiben', () => {
    const r = docxText(
      docx(
        '<w:p><w:r><w:t>Hallo </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">liebe </w:t></w:r><w:r><w:t>Welt</w:t></w:r></w:p>',
      ),
    );
    expect(r).toEqual({ ok: true, text: 'Hallo liebe Welt' });
  });

  it('w:tab wird Tab, w:br Zeilenumbruch – aber nicht die Tabulator-Stopps in w:pPr', () => {
    const r = docxText(
      docx(
        '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="708"/></w:tabs></w:pPr><w:r><w:t>Name</w:t><w:tab/><w:t>Peter</w:t><w:br/><w:t>Zeile 2</w:t></w:r></w:p>',
      ),
    );
    expect(r).toEqual({ ok: true, text: 'Name\tPeter\nZeile 2' });
  });

  it('löst XML-Entities auf (benannt, dezimal, hexadezimal)', () => {
    expect(
      textAusDocumentXml(
        p('a &lt; b &amp;&amp; c &gt; d &quot;x&quot; &apos;y&apos; &#228;&#xF6;&#x1F600;'),
      ),
    ).toBe('a < b && c > d "x" \'y\' äö😀');
    expect(textAusDocumentXml(p('&unbekannt; &#99999999999;'))).toBe('&unbekannt; &#99999999999;');
  });

  it('liest Tabellenzellen als eigene Zeilen und kürzt leere Absätze am Ende', () => {
    const tab =
      '<w:tbl><w:tr><w:tc>' +
      p('Zelle A') +
      '</w:tc><w:tc>' +
      p('Zelle B') +
      '</w:tc></w:tr></w:tbl>';
    const r = docxText(docx(p('Vor') + '<w:p/>' + tab + '<w:p><w:pPr/></w:p><w:p/>'));
    expect(r).toEqual({ ok: true, text: 'Vor\n\nZelle A\nZelle B' });
  });

  it('ignoriert gelöschten Text der Änderungsverfolgung und Feldcodes', () => {
    const r = docxText(
      docx(
        '<w:p><w:r><w:t>bleibt</w:t></w:r><w:del><w:r><w:delText>weg</w:delText></w:r></w:del><w:r><w:instrText> PAGE </w:instrText></w:r></w:p>',
      ),
    );
    expect(r).toEqual({ ok: true, text: 'bleibt' });
  });

  it('verwechselt w:t nicht mit w:tbl, w:tc, w:tab', () => {
    expect(textAusDocumentXml('<w:p><w:tbl/><w:tc/><w:r><w:t>nur das</w:t></w:r></w:p>')).toBe(
      'nur das',
    );
  });

  it('kennt nur w:tab, w:br, w:cr – nicht Elemente, die genauso anfangen', () => {
    expect(
      textAusDocumentXml(
        '<w:p><w:r><w:t>a</w:t><w:tabs/><w:brx/><w:crx/><w:cr/><w:t>b</w:t></w:r></w:p>',
      ),
    ).toBe('a\nb');
  });

  it('zählt Elemente wie w:pgSz oder w:pict zwischen Absätzen nicht als Absatz', () => {
    expect(textAusDocumentXml(p('A') + '<w:pgSz w:w="1"/><w:pict/>' + p('B'))).toBe('A\nB');
  });

  it('Datei mit BOM in der document.xml', () => {
    const bytes = zipSync({
      'word/document.xml': new Uint8Array([
        0xef,
        0xbb,
        0xbf,
        ...strToU8(`<w:document ${NS}><w:body>${p('mit BOM')}</w:body></w:document>`),
      ]),
    });
    expect(docxText(bytes)).toEqual({ ok: true, text: 'mit BOM' });
  });

  describe('kaputte Dateien: verständliche Meldung statt Ausnahme', () => {
    it('kein ZIP (z. B. altes .doc oder Zufallsbytes)', () => {
      const r = docxText(strToU8('Das ist kein Word'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.meldung).toMatch(/nicht als Word-Datei \(\.docx\)/);
    });

    it('leere Datei', () => {
      expect(docxText(new Uint8Array(0)).ok).toBe(false);
    });

    it('abgeschnittenes ZIP', () => {
      const ganz = docx(p('Text'));
      expect(docxText(ganz.slice(0, ganz.length - 30)).ok).toBe(false);
    });

    it('ZIP ohne word/document.xml', () => {
      const r = docxText(docx(p('x'), 'word/anders.xml'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.meldung).toMatch(/nicht als Word-Datei/);
    });

    it('document.xml unrealistisch groß (Zip-Bombe): Meldung, ohne zu entpacken', () => {
      const riesig = zipSync({ 'word/document.xml': new Uint8Array(51 * 1024 * 1024) });
      const r = docxText(riesig);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.meldung).toMatch(/zu groß/);
    });

    it('Word-Datei ohne Text', () => {
      const r = docxText(docx('<w:p/><w:p><w:r><w:t> </w:t></w:r></w:p>'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.meldung).toMatch(/kein Text/);
    });
  });
});
