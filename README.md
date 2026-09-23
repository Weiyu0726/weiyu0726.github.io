# Weiyu Zhao's homepage

A responsive academic homepage published at [weiyu0726.github.io](https://weiyu0726.github.io/).

## Preview locally

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. There is no build step or runtime dependency.

## Update content

- `index.html`: biography, publications, author lists, education and contact links.
- `assets/`: portrait, school logos and publication teaser images.
- `styles.css`: desktop and mobile layout, colors and typography.
- `script.js`: theme switching, publication filters, active navigation and footer year.

The site starts in dark mode. The header button switches between dark and light, and an explicit choice is saved in `localStorage` under `weiyu-theme`. The small bootstrap in the document head restores it before the stylesheet loads. Theme colors are centralized in CSS custom properties.

The first section pairs the profile with an academic introduction and Shandong Taishan note. Education appears before the publications.

To add a paper, copy a publication article, give it a unique heading ID and `data-topic` (`perception`, `robotics` or `motion`), then update its image, full author list, venue and links. Every paper has Paper, Project and Code controls. Use a native disabled button when a URL is unavailable; replace it with an anchor only after verifying the destination. Keep content in HTML so it remains available without JavaScript.

The list currently contains seven works. The All work count is calculated from the articles.

Publication sources added on 2026-09-23:

- QueryMe: its official CVPR 2026 entry in the CVF Open Access repository.
- From Gaussians to Graphs: title, author order, ACM MM 2026 venue and teaser image from [Ru Li's homepage](https://liru0126.github.io/). No resource URLs are supplied there, so the three resource controls remain disabled.
- MaP-WAM: title, author order, arXiv 2026 status, resource links and framework image from [the project page](https://sizhezhao.github.io/projects/MaP-WAM/); paper metadata also verified at [arXiv](https://arxiv.org/abs/2609.11561).

- DiffuGesture: title, three-author order, ICMI 2023 Workshop venue, preview GIF and Paper link from [Liangxiao Hu's homepage](https://huliangxiao.github.io/); verified against the [GENEA Challenge 2023 listing](https://genea-workshop.github.io/2023/challenge/).

## Validate changes

```sh
node --check script.js
git diff --check
```

Preview at phone and desktop widths, check images and links, and try all publication filters, and verify theme switching with keyboard and after reload. Changes pushed to the existing GitHub Pages publishing branch are deployed by GitHub.
