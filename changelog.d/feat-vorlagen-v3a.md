### Neu (Dienstplaner)

- **Ablaufvorlagen ansehen und bearbeiten** (E10): In „Planen“ steht neben „Ablauf bearbeiten“ der Knopf **„Vorlagen“**. Die Seite
  zeigt die Vorlagen von ChurchTools nach Kalender (mit Punkten, Vorlauf und letzter Änderung); wo das Recht „Ablaufvorlagen
  bearbeiten“ fehlt, steht „nur ansehen“. Mit dem Recht lassen sich Vorlagen **anlegen** (Name und Kalender), im Bearbeiten-Modus
  füllen, **umbenennen** und – nach Nachfrage – **löschen**. Eine Vorlage hat keine Uhrzeiten, Personen und kein „An diesem Termin
  weglassen“, Infos je Dienstgruppe gibt es wie am Termin (nicht an Überschriften); Dienste stehen als „[Moderation]“ da. Eigene Adressen (`#/vorlagen`, `#/vorlage/<ID>`), Zurück im Browser geht.

### Intern (Dienstplaner)

- **Vorlagen-Modus im Ablauf-Baustein** (`ui/ablauf`): `useAblaufBearbeiten`, `PunktFenster`, `AblaufListe` bekommen `vorlage` – kein
  Auge, Platzhalter neutral (Infos je Dienstgruppe wie am Termin); die Aktionen der Vorlage haben kein
  `setWeggelassen` (eigener Typ `VorlagenAktionen`). Neu: gemeinsame Bausteine `VorlagenBereich`, `VorlagenListe`, `VorlageAnsicht`,
  `VorlagenFenster` über einen `VorlagenZugriff` (für die Musik-App in V3b ohne Änderung nutzbar), `HinweisLink` für weitere Links
  in der Hinweiszeile. Die Liste rechnet `shared/ct/ablaufVorlagenListe.ts` auf `vorlagenAus`/`kalenderAus` auf; die Zählung der
  Vorlauf-Punkte (`vorlaufAnzahl`) teilen sich Liste und „als Vorlage speichern“.
