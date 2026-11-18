# ICML 2026 Poster Website

Interactive companion page for the poster **Belief-Aware Decision Transformers for Offline-to-Online Decision-Making under Partial Observability: A Geosteering Case Study**. It was a Spotlight at the ICML 2026 Workshop on Decision-Making from Offline Datasets to Online Adaptation.

The page follows the printed poster's layout, colours and section numbering, and adds interactivity:

- **Formulation:** the POMDP tuple 𝒫 = (S, A, T, R, Ω, O, γ) is linked to the coloured chevrons.
- **Approach:**
  - The architecture diagram is clickable, with a "Play forward pass" walkthrough.
  - A variant switcher (DT / Parallel / Coupled / Strict) rewires the diagram and highlights the chosen variant in the results.
  - An animated *Gather → Analyse → Decide* geosteering loop.
- **Results:**
  - Dot-and-whisker charts with tooltips.
  - An online belief-correction chart with a correction-rate slider.
  - A data-table view.
- **Discussion:** an Offline / Online toggle showing which design wins.
- **Site-wide:**
  - Poster lightbox, PDF download and a BibTeX dialog.
  - Copy buttons on the references.

It is a static site served by GitHub Pages and needs no build step.

```
index.html              page content
assets/css/style.css    styles (palette taken from the poster)
assets/js/main.js       interactions + chart data
assets/img/             logos, QR code, poster preview images
assets/icons/           icons extracted from the poster
assets/ICML2026_poster.pdf
```

## Editing

- **Numbers in the charts** are in the `DATA` block at the top of `assets/js/main.js`. The means are the values printed on the poster. The ± spreads were read off the figures and are only used to draw the whiskers. To print them in tooltips and tables as well, enter the exact spreads and set `SHOW_SPREAD_NUMBERS = true`.
- **Paper / code links:** see the commented-out buttons in the header of `index.html`.

## Local preview

Open `index.html` in a browser, or run:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```
