### Neu (Dienstplaner)

- **Pause wirkt** (Scheibe PL-3). Wer in der Personenliste einer Dienstgruppe pausiert („bis“ einschließlich, ohne Datum unbefristet), wird für
  **diese Dienstgruppe** nicht mehr erinnert und vom Zauberstab nicht mehr vorgeschlagen; in „Wer kann?“ stand sie schon unter „Kann nicht“.
  - **Erinnern:** Ein Termin gilt für eine pausierte Person nicht als offen. Ist dadurch nichts mehr offen, bekommt sie keine Mail; die Mail
    nennt nur die nicht pausierten Termine. Im Fenster steht ruhig „N Personen werden wegen Pause nicht erinnert.“ (nur wenn N größer als 0).
  - **Zauberstab:** Wer an dem Termin pausiert, wird nie vorgeschlagen – wie ein Abwesender. In der Auswahl steht die Person unter „Passt eher nicht“
    mit „Pause bis …“; von Hand wählen lässt sie sich weiterhin.
  - **Bleibt, wie es ist:** Selbst antworten und eingeteilt werden geht weiter. Eine Pause einer anderen Dienstgruppe wirkt nicht; eine Pause, die vor
    dem Termin endet, auch nicht.

### Intern (Dienstplaner)

- Die Regel steht nur in `pauseAm` (`personenliste.ts`): `fehlendeInGruppe` (neu: `personenlisten`, Ergebnis `pausiert`, dazu `pausiertAusgelassen`)
  und `bewerte` im Zauberstab (neu: `ZauberPlatz.personenliste`, `Bewertet.pause`, über `pauseDerPerson` – dieselbe Funktion wie „Wer kann?“).
  Die Liste kommt aus `EntwuerfeDaten.personenlisten` in `ErinnernFenster` und `ZauberstabFach`. Die Demo hat Pausen, an denen man beides sieht.
