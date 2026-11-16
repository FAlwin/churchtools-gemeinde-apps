# Gemeinde Sans – die Schrift der PDFs

Die vier Dateien `GemeindeSans-*.ttf` sind **Lato 2.015, gekürzt und umbenannt** (16.11.2026). Gekürzt, weil das
Protokolle-ZIP mit den vollen Schnitten (je ~0,7 MB, mit Griechisch, Vietnamesisch usw.) nicht mehr in ChurchTools
ankam: 3,2 MB wurden gelistet, aber nie ausgeliefert, 2,2 MB sofort. Behalten sind Latein mit Latein-1 und
Latein-Erweiterung A/B, Kyrillisch, die allgemeinen Satzzeichen („“ – — … • ′ ″) und einzelne Zeichen wie €, ₽, №, ™,
−, Pfeile, ✓ (soweit Lato sie hat) – 838 Zeichen je Schnitt, rund 190 KB statt 700 KB.

**Umbenannt, weil die Lizenz es verlangt:** Lato steht unter der SIL Open Font License 1.1 mit dem reservierten Namen
„Lato“ (`OFL.txt`). Eine veränderte Fassung – auch eine gekürzte – darf diesen Namen nicht tragen (OFL Abschnitt 3).
Darum heißen Familie, Schnitte und PostScript-Name „Gemeinde Sans“ / `GemeindeSans-…`, in der PDF und im Code
(`PDF_SCHRIFT = 'GemeindeSans'`). Copyright, Marke, Hersteller und Lizenz in den Namenstabellen bleiben und nennen Lato
als Ursprung. Die Lizenz gilt weiter für diese Fassung.

## Ursprung

Aus [google/fonts](https://github.com/google/fonts/tree/main/ofl/lato), Commit `f3b885d5` (Lato Version 2.015 vom
06.08.2015): normal und fett geholt am 28.10.2026 (Organigramm-PDF, O7b-4), kursiv und fett-kursiv am 12.11.2026
(Protokoll-PDF, S6-3a).

| Ursprungsdatei        | SHA-256 (unverändert, google/fonts)                                |
| --------------------- | ------------------------------------------------------------------ |
| `Lato-Regular.ttf`    | `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251` |
| `Lato-Bold.ttf`       | `8a0aace75d33794eece4b28187bfc1df0bbd2888b5d8a56e01788c8d65d16be1` |
| `Lato-Italic.ttf`     | `e399c44efe1387100531d26c7e4800c5d12251b890d6654a3098c7c679cb1786` |
| `Lato-BoldItalic.ttf` | `62c1b7f0d2e74b45960154c3520efc337b553db0961bfdc950d5618334596cc8` |

## Erzeugt mit

`scripts/schrift-kuerzen.py` (fonttools 4.55.3, nur einmalig in einer eigenen Python-Umgebung – keine Abhängigkeit des
Repos): Ursprungsdateien in einen Ordner legen, dann

```bash
python3 -I scripts/schrift-kuerzen.py <ordner-mit-Lato-ttf> ui/teilen/schrift
```

Das Skript kürzt (ohne Hinting), setzt die Namen und bricht ab, wenn außer Copyright, Marke, Hersteller und Lizenz
noch irgendwo „Lato“ steht.

| Datei                         | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `GemeindeSans-Regular.ttf`    | `eb38d8815d024cd1140a2b01e5f10df8365a71ede37c76dadaf3eb595609ec96` |
| `GemeindeSans-Bold.ttf`       | `d817ca6b0754d199fff4c35e8863cd74be8977475b175de9fc6672c4b78876f8` |
| `GemeindeSans-Italic.ttf`     | `dde0e7bdcbefff8bcd694410cce6ba8d51ce4ad42fb74d74b55a1ec62ad37fc2` |
| `GemeindeSans-BoldItalic.ttf` | `ad4e73597d2badb5c6f8433cb30c9c88bdda6d7ac97362081df561439cb1fa98` |

Fehlt in einem PDF ein Zeichen, steht es nicht in der Auswahl oben: im Skript ergänzen, neu erzeugen, Tabelle
nachziehen. Welche Zeichen sicher drin sein müssen, prüft `ui/teilen/pdfSchrift.test.ts`.
