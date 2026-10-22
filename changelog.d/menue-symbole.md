### Behoben (Musik-App)

- **Symbole im Lied-Menü und in Hinweisen** (Alwin am iPad: „Bearbeiten“-Symbol kaputt): Statt Behelfszeichen
  und Emoji (🖉 ⤴ 📎 ⚠️ 📴 📅 🎵 …), die je Gerät anders oder gar nicht dargestellt werden, stehen überall die
  Symbole aus `ui/icons` – Menü, Dateien-Liste, Links, Hinweis-Seiten, Ablauf-Liste, Fehlermeldungen am Blatt.

### Intern

- Neue Dauerprüfung `ui/design/keineBehelfszeichen.test.ts`: findet Behelfszeichen/Emoji im Oberflächen-Code.
  Gemeinsamer Datei-Sammler `ui/design/quelltexte.testutil.ts` (auch von `festeWerte.test.ts` genutzt).
