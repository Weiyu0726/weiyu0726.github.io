# Personal homepage redesign

## Scope

Redesign Weiyu Zhao's academic homepage in the existing static GitHub Pages repository. The user requested a local preview before publication and is refining that preview. The latest revision removes the 3D module entirely.

## Design and content

Use a dark academic layout by default, with pale text, blue accents and restrained borders. Include a light theme and save explicit visitor choices. Increase the previous small text sizes: biography 16px, author lists 14px and paper titles 20px at desktop widths; maintain readable responsive variants. The hero pairs the portrait, name, research summary and profile links with an academic biography and Shandong Taishan note on the right. Preserve all original education, advisor, author, publication and contact facts. Order the page About → Background → Research → Contact; education stays before the seven works.

Every publication has Paper, Project and Code controls. Verified destinations are real links. Missing destinations use native disabled buttons with subtle charcoal text and a fine border, without a dark fill or conspicuous disabled icon. QueryMe's Paper link points to the official CVPR 2026 entry in CVF Open Access, verified against the title and author list on 2026-09-23.

## Implementation

Keep dependency-free HTML/CSS/JavaScript and all original assets. Remove the canvas, renderer, animation tests, scene styles and mode controls. Keep publication topic filters, active navigation, current year, semantic markup and visible keyboard focus. All academic content and working links remain available without JavaScript.

## Acceptance

Check JavaScript syntax, assets and local anchors, four complete sets of paper controls, native disabled behavior, working topic filters and responsive layouts at desktop and phone widths. No horizontal overflow, broken images, console errors or remaining animation scripts. The user approved publishing this reviewed revision to the existing GitHub Pages repository on 2026-09-23.

## Added publications

Add From Gaussians to Graphs (ACM MM 2026), preserving the four-author order on Ru Li's homepage. Add MaP-WAM as an arXiv 2026 preprint with the eight authors, framework image, Paper, Project and Code destinations from its project page. Group publications under 3D vision, Robotics and Human motion, with two 3D vision works, two robotics works and three human motion works. Keep unavailable links subtle and disabled in both themes.

Add DiffuGesture (ICMI 2023 Workshop / GENEA Challenge) after the newer works, preserving the supplied full title and author order Weiyu Zhao, Liangxiao Hu, Shengping Zhang. Use the reference homepage GIF and OpenReview Paper link; keep Project and Code disabled.
