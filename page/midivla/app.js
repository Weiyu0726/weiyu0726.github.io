'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

$$('[data-grid]').forEach(grid => {
  const side = Number(grid.dataset.grid);
  grid.style.setProperty('--grid', side);
  grid.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < side * side; i++) grid.append(document.createElement('i'));
});

// Preload the recorded experimental frames; there is no generated interpolation.
for (let scale = 1; scale <= 3; scale++) {
  for (let step = 0; step < 4; step++) new Image().src = `/page/midivla/assets/f1-s${scale}-${step}.webp`;
}

const f1 = { step: 0, playing: false, timer: null, entered: false };
const phaseNames = ['No noise · 0%', 'Recorded stage 2', 'Recorded stage 3', 'Strong noise · 99%'];
function setF1Step(step) {
  f1.step = Math.max(0, Math.min(3, Number(step)));
  $('#f1-step').value = f1.step;
  $('#f1-step').setAttribute('aria-valuetext', phaseNames[f1.step]);
  $('#f1-output').textContent = `${f1.step + 1} / 4`;
  $('#f1-phase').textContent = phaseNames[f1.step];
  const experiment = $('#f1-experiment');
  experiment.style.setProperty('--noise', String(f1.step / 3));
  experiment.querySelectorAll('[data-dose]').forEach(el => { el.textContent = ['0%', 'Stage 2', 'Stage 3', '99%'][f1.step]; });
  $('#f1-reading').textContent = [
    'Without noise, all three columns show the same reconstruction. Play the sequence to see which one loses the action.',
    'Compare each image with Before and After. Noise is increased in one scale per column; the other two are held fixed.',
    'Watch the middle-scale test: is the toy moving back toward its position in Before? Changes in other columns show that more than one scale matters.',
    'In this example, disturbing the middle scale most clearly removes the motion. Changes in the other columns show that sensitivity is not exclusive to one scale.'
  ][f1.step];
  for (let k = 1; k <= 3; k++) {
    const img = $(`#f1-image-${k}`);
    img.src = `/page/midivla/assets/f1-s${k}-${f1.step}.webp`;
    img.alt = `Scale ${k} perturbation, ${phaseNames[f1.step].toLowerCase()}`;
  }
}
function playF1(playing) {
  clearInterval(f1.timer);
  f1.playing = playing;
  $('#f1-play').textContent = playing ? 'Ⅱ Pause' : '▶ Play the experiment';
  $('#f1-experiment').classList.toggle('is-playing', playing);
  $('#f1-play').setAttribute('aria-pressed', String(playing));
  if (playing) f1.timer = setInterval(() => setF1Step((f1.step + 1) % 4), 1400);
}
$('#f1-play').addEventListener('click', () => playF1(!f1.playing));
$('#f1-step').addEventListener('input', event => { playF1(false); setF1Step(event.target.value); });

const experimentObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting && !f1.entered) {
      f1.entered = true;
      // Begin clean; let first-time readers choose when to start the intervention.
    } else if (!entry.isIntersecting) playF1(false);
  }
}, { threshold: 0.2 });
experimentObserver.observe($('#finding-one'));
document.addEventListener('visibilitychange', () => { if (document.hidden) playF1(false); });
reducedMotion.addEventListener('change', event => { if (event.matches) playF1(false); });

function selectEvidence(key, moveFocus = false) {
  $$('[data-evidence]').forEach(button => {
    const active = button.dataset.evidence === key;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $(`#panel-${button.dataset.evidence}`).hidden = !active;
    if (active && moveFocus) button.focus();
  });
}
const evidenceTabs = $$('[data-evidence]');
evidenceTabs.forEach((button, index) => {
  button.addEventListener('click', () => selectEvidence(button.dataset.evidence));
  button.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % evidenceTabs.length;
    else if (event.key === 'ArrowLeft') next = (index + evidenceTabs.length - 1) % evidenceTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = evidenceTabs.length - 1;
    else return;
    event.preventDefault();
    selectEvidence(evidenceTabs[next].dataset.evidence, true);
  });
});
$('#pretrain-select').addEventListener('change', event => {
  $$('[data-pretraining]').forEach(panel => { panel.hidden = panel.dataset.pretraining !== event.target.value; });
});

const dialog = $('#figure-dialog');
$$('[data-figure]').forEach(button => button.addEventListener('click', () => {
  $('#figure-title').textContent = button.dataset.title;
  $('#dialog-image').src = `/page/midivla/assets/figure-${button.dataset.figure}.webp`;
  $('#dialog-image').alt = button.dataset.title;
  dialog.showModal();
  document.body.classList.add('modal-open');
}));
$('#close-figure').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

$('#copy-citation').addEventListener('click', async () => {
  const citation = $('#bibtex').textContent;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(citation);
    $('#copy-citation').textContent = 'Copied ✓';
    $('#copy-status').textContent = 'BibTeX copied to clipboard.';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#bibtex'));
    selection.removeAllRanges();
    selection.addRange(range);
    $('#copy-status').textContent = 'Citation selected. Press Ctrl+C (or ⌘C) to copy.';
  }
});

setF1Step(0);
