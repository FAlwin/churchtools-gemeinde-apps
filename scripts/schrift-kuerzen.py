"""
Lato 2.015 -> „Gemeinde Sans“: auf Latein + Kyrillisch + Satzzeichen gekürzt und umbenannt (SIL OFL: reservierter Name
„Lato“). Herkunft und Prüfsummen: ui/teilen/schrift/HERKUNFT.md.

Nur einmalig nötig, braucht fonttools (z. B. `python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools==4.55.3`):
    /tmp/ft/bin/python -I scripts/schrift-kuerzen.py <ordner-mit-Lato-*.ttf> ui/teilen/schrift
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools import subset

QUELLE, ZIEL = sys.argv[1], sys.argv[2]
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x250))      # Latein, Latein-1, Latein erweitert A/B
    + list(range(0x400, 0x500))                               # Kyrillisch
    + list(range(0x2000, 0x2070))                             # Satzzeichen („“ – — … • ′ ″ ‹ ›)
    + [0x20AC, 0x20BD, 0x2116, 0x2122, 0x2212, 0x2190, 0x2191, 0x2192, 0x2193, 0x2713]
)
SCHNITTE = {
    'Lato-Regular.ttf': ('Regular', 'GemeindeSans-Regular.ttf'),
    'Lato-Bold.ttf': ('Bold', 'GemeindeSans-Bold.ttf'),
    'Lato-Italic.ttf': ('Italic', 'GemeindeSans-Italic.ttf'),
    'Lato-BoldItalic.ttf': ('Bold Italic', 'GemeindeSans-BoldItalic.ttf'),
}
FAMILIE = 'Gemeinde Sans'

for quelle, (stil, ziel) in SCHNITTE.items():
    font = TTFont(os.path.join(QUELLE, quelle))
    opt = subset.Options()
    opt.hinting = False
    opt.desubroutinize = True
    opt.name_IDs = ['*']
    opt.name_languages = ['*']
    opt.notdef_outline = True
    s = subset.Subsetter(opt)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    name = font['name']
    ps = f"GemeindeSans-{stil.replace(' ', '')}"
    neu = {1: FAMILIE,
           2: stil, 3: f"{ps};gemeinde-apps;2026-11-16", 4: f"{FAMILIE} {stil}",
           6: ps, 16: FAMILIE, 17: stil}
    for rec in list(name.names):
        if rec.nameID in neu:
            name.setName(neu[rec.nameID], rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    # Übrige Einträge mit „Lato“ dürfen nur den Ursprung nennen (Copyright, Marke, Hersteller, Lizenz).
    erlaubt = {0, 5, 7, 8, 9, 10, 11, 12, 13, 14}
    for rec in name.names:
        if 'Lato' in rec.toUnicode() and rec.nameID not in erlaubt:
            raise SystemExit(f'{ziel}: name {rec.nameID} enthält noch „Lato“: {rec.toUnicode()}')
    if 'CFF ' in font: raise SystemExit('unerwartet CFF')
    font.save(os.path.join(ZIEL, ziel))
    cmap = font.getBestCmap()
    print(ziel, os.path.getsize(os.path.join(ZIEL, ziel)), 'Byte,', len(cmap), 'Zeichen,', font['maxp'].numGlyphs, 'Glyphen')
