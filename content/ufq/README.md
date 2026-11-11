# UFQ SAT Math question bank (import-ready)

Source: `UFQ.pdf` (3394 questions, 21 topics, answer key after every 100).

- `t01_001-100.json` — questions 1–100 (Topic 1, Ratios, Rates, and Units). Import in
  Admin → Questions → **Bulk import**: pick this JSON, select `figures/q046.webp` and
  `figures/q097.webp` in the *Images* field, then import.
- `source/*.txt` — hand-transcribed source (LaTeX in `$...$`, tables as HTML). `source/build.py`
  merges it with the PDF answer key and checks option/answer consistency.
- `figures/` — diagrams redrawn as SVG and exported to WEBP (5–16 KB each).
- Difficulty = position inside the topic (the PDF orders questions easy → hard): first third
  easy, middle third medium, last third hard.
- Questions print as in the PDF. Known PDF anomalies: Q62 and Q91 omit the data needed to solve
  them (the key is used as printed).
