/**
 * **Eine kleine Beispiel-PDF für Tests und die Demo** (N1d) – selbst erzeugt aus wenigen Zeilen PDF-Quelltext, kein fremdes
 * Dokument. Seite(n) in beliebigem Format (pt), je Seite ein paar Zeilen Text im Stil eines Antragsformulars.
 */
export function beispielPdf(
  opt: { seiten?: number; breitePt?: number; hoehePt?: number } = {},
): Uint8Array {
  const seiten = opt.seiten ?? 1;
  const b = opt.breitePt ?? 595.276;
  const h = opt.hoehePt ?? 841.89;
  const objekte: string[] = [];
  // 1 Katalog, 2 Seitenbaum, 3 Schrift, danach je Seite: Seite + Inhalt.
  const kinder = Array.from({ length: seiten }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objekte.push('<< /Type /Catalog /Pages 2 0 R >>');
  objekte.push(`<< /Type /Pages /Kids [${kinder}] /Count ${seiten} >>`);
  objekte.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const zeilen = [
    ['Antrag auf ein erweitertes Fuehrungszeugnis', 20, 0.9],
    ['Name, Vorname:', 12, 0.82],
    ['Geburtsdatum:', 12, 0.77],
    ['Anschrift:', 12, 0.72],
    ['Ort, Datum:', 12, 0.6],
    ['Unterschrift:', 12, 0.5],
  ] as const;
  for (let i = 0; i < seiten; i++) {
    const inhalt = zeilen
      .map(
        ([t, g, y]) =>
          `BT /F1 ${g} Tf ${Math.round(b * 0.1)} ${Math.round(h * y)} Td (${t}${seiten > 1 ? ` (Seite ${i + 1})` : ''}) Tj ET`,
      )
      .join('\n');
    objekte.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${b} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    objekte.push(`<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`);
  }
  let pdf = '%PDF-1.4\n';
  const stellen: number[] = [];
  objekte.forEach((o, i) => {
    stellen.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const st of stellen) pdf += `${String(st).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
