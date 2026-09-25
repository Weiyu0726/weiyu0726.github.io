(function (root) {
  'use strict';
  function snapPercent(value) {
    value = Number(value);
    if (!Number.isFinite(value)) throw new Error('Invalid noise percentage');
    return Math.round(Math.max(0, Math.min(100, value)) / 5) * 5;
  }
  function createController(data, onChange) {
    const experiments = data.experiments || {1: data};
    let percent = 0, placement = 1, previewClean = false;
    function render() {
      const experiment = experiments[placement];
      const available = Boolean(experiment);
      const records = available ? [0, 1, 2].map(layer => {
        const record = experiment.records.find(r => r.layer === layer && r.percent === percent);
        if (!record) throw new Error(`Missing layer ${layer} at ${percent}%`);
        return record;
      }) : [];
      onChange({ percent, records, placement, available, previewClean, experiment });
    }
    function set(value) { percent = snapPercent(value); previewClean = false; render(); }
    return {
      set, reset: () => set(0),
      next: () => { if (experiments[placement]) set(percent === 100 ? 0 : percent + 5); },
      selectPlacement(value) {
        if (![1, 2, 3].includes(Number(value))) throw new Error('Invalid constraint placement');
        placement = Number(value); previewClean = false; render();
      },
      showClean(value) { previewClean = Boolean(experiments[placement]) && Boolean(value); render(); }
    };
  }
  function createSweepTimeline(startPercent, duration = 12000) {
    if (!Number.isFinite(startPercent) || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid timeline');
    const start = startPercent >= 100 ? 0 : Math.max(0, startPercent);
    return { sample(elapsed) {
      const position = Math.min(100, start + Math.max(0, elapsed) / duration * 100);
      return { position, percent: snapPercent(position), done: position >= 100 };
    }};
  }
  function createFrameGate(load, commit) {
    let version = 0;
    return {
      async show(paths) {
        const request = ++version;
        const frames = await Promise.all(paths.map(load));
        if (request === version) commit(frames);
      },
      cancel() { version++; }
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createController, snapPercent, createSweepTimeline, createFrameGate }; return;
  }
  const panel = document.getElementById('measured-noise-sweep');
  if (!panel) return;
  const data = root.MIDIVLA_NOISE_EXPERIMENTS || {experiments: {1: root.MIDIVLA_NOISE_SWEEP}};
  const slider = document.getElementById('noise-strength');
  const play = document.getElementById('noise-play');
  const reset = document.getElementById('noise-reset');
  const clean = document.getElementById('noise-clean');
  const status = document.getElementById('noise-status');
  const tabs = [...panel.querySelectorAll('button[data-placement]')];
  const defaultBase = '/page/midivla/assets/ssv2-blue-cup-sweep/';
  if (!data.experiments[1] || Object.values(data.experiments).some(experiment => !experiment || experiment.records.length !== 63)) {
    status.textContent = 'The recorded sequence is unavailable.';
    slider.disabled = play.disabled = reset.disabled = clean.disabled = true;
    return;
  }
  const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
  let current, raf = null, settleRaf = null, playing = false, driving = false, position = 0;
  const fronts = [0, 1, 2].map(layer => document.getElementById(`noise-layer-${layer}`));
  const backs = fronts.map(front => {
    const back = document.createElement('img'); back.className = 'sweep-frame-previous';
    back.alt = ''; back.setAttribute('aria-hidden', 'true'); back.hidden = true;
    front.classList.add('sweep-frame-current'); front.before(back); return back;
  });
  const fades = [null, null, null];
  const output = document.getElementById('noise-percent');
  const valueText = document.createElement('strong'); valueText.textContent = '0';
  output.replaceChildren(valueText, Object.assign(document.createElement('span'), {textContent:'%'}));
  const cache = new Map();
  function loadImage(src) {
    if (!cache.has(src)) {
      const image = new Image(); image.src = src;
      const decoded = image.decode().then(() => image).catch(error => { cache.delete(src); throw error; });
      cache.set(src, decoded);
    }
    return cache.get(src);
  }
  const frameGate = createFrameGate(loadImage, loaded => {
    loaded.forEach((image, layer) => {
      const front = fronts[layer], back = backs[layer];
      if (front.src === image.src) return;
      fades[layer]?.cancel();
      const canFade = !reduced.matches && front.hasAttribute('src') && front.complete && front.naturalWidth > 0;
      if (canFade) { back.src = front.src; back.hidden = false; }
      else back.hidden = true;
      front.src = image.src;
      if (canFade) {
        const fade = front.animate([{opacity:0},{opacity:1}], {duration:playing ? 260 : 180, easing:'cubic-bezier(.22,.61,.36,1)'});
        fades[layer] = fade;
        fade.onfinish = () => { if (fades[layer] === fade) { back.hidden = true; fades[layer] = null; } };
      }
    });
    panel.dataset.renderedPercent = String(current.percent);
    panel.dataset.renderedPlacement = String(current.placement);
  });
  function paint(value) {
    position = Math.max(0, Math.min(100, value));
    panel.style.setProperty('--progress', position + '%');
    slider.value = String(position);
  }
  function applyPosition(value) {
    driving = true;
    if (snapPercent(value) !== current.percent || current.previewClean) controller.set(value);
    driving = false;
    paint(value);
  }
  function stop() {
    cancelAnimationFrame(raf); cancelAnimationFrame(settleRaf); raf = settleRaf = null; playing = false;
    play.setAttribute('aria-pressed', 'false');
    play.setAttribute('aria-label', current?.percent === 100 ? 'Replay noise sweep' : 'Play noise sweep');
    panel.classList.remove('is-playing');
  }
  function settleTo(target) {
    cancelAnimationFrame(settleRaf);
    const from = position, started = performance.now();
    if (reduced.matches || Math.abs(from-target) < .01) { applyPosition(target); return; }
    function tick(now) {
      const t = Math.min(1, (now-started)/220);
      applyPosition(from + (target-from)*(1-Math.pow(1-t,3)));
      if (t < 1) settleRaf = requestAnimationFrame(tick); else settleRaf = null;
    }
    settleRaf = requestAnimationFrame(tick);
  }
  const controller = createController(data, state => {
    current = state;
    const {percent, records, placement, available, previewClean, experiment} = state;
    panel.dataset.percent = String(percent); panel.dataset.placement = String(placement);
    document.getElementById('training-goal').textContent = `When Scale ${placement} is corrupted during training, this model is taught to reconstruct Before.`;
    panel.querySelectorAll('[data-training-scale]').forEach(el => el.classList.toggle('is-trained', Number(el.dataset.trainingScale) === placement));
    panel.querySelectorAll('[data-dose]').forEach(el => { el.textContent = previewClean ? '0%' : `${percent}%`; });
    const cleanReference = document.getElementById('noise-clean-reference');
    if (available) {
      cleanReference.src = (experiment.base || defaultBase) + experiment.clean;
      cleanReference.alt = `No-noise reconstruction from the model trained with a constraint at Scale ${placement}`;
    } else cleanReference.removeAttribute('src');
    panel.style.setProperty('--noise', String(previewClean ? 0 : percent / 100));
    if (!driving) paint(percent);
    panel.classList.toggle('is-clean-preview', previewClean);
    document.getElementById('sweep-available').hidden = !available;
    document.getElementById('sweep-empty').hidden = available;
    document.getElementById('empty-label').textContent = `CONSTRAINT AT SCALE ${placement}`;
    document.getElementById('constraint-panel').setAttribute('aria-labelledby', `constraint-tab-${placement}`);
    tabs.forEach(tab => {
      const selected = Number(tab.dataset.placement) === placement;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-selected', selected);
    });
    slider.disabled = play.disabled = reset.disabled = clean.disabled = !available;
    slider.setAttribute('aria-valuetext', `${percent}% noise`);
    if (valueText.textContent !== String(percent)) {
      valueText.textContent = String(percent);
      if (!reduced.matches) valueText.animate([{opacity:.5,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}], {duration:180,easing:'ease-out'});
    }
    clean.setAttribute('aria-pressed', String(previewClean));
    clean.querySelector('span').textContent = previewClean ? 'Return to noise' : 'Compare with clean';
    if (!available) {
      frameGate.cancel();
      fronts.forEach((front, layer) => {
        fades[layer]?.cancel(); backs[layer].hidden = true; backs[layer].removeAttribute('src');
        front.removeAttribute('src'); front.alt = '';
      });
    } else {
      fronts.forEach((front, layer) => { front.alt = previewClean ? 'Clean reconstruction without noise' : `Reconstruction with ${percent}% noise at Scale ${layer+1}; other scales fixed`; });
      frameGate.show(records.map(record => (experiment.base || defaultBase) + (previewClean ? experiment.clean : record.image)))
        .catch(() => { status.textContent = 'A recorded frame could not load. Adjust the slider to try again.'; });
    }
    const label = previewClean ? 'Showing no-noise outputs' : percent === 0 ? 'No noise added yet' : `${percent}% noise in one scale per column`;
    document.getElementById('sweep-mode').textContent = label;
    panel.querySelectorAll('.frame-mode').forEach(el => { el.textContent = previewClean || percent === 0 ? 'Clean' : `${percent}% noise`; });
    panel.querySelectorAll('.timeline-ticks i').forEach((el,i) => { el.classList.toggle('passed', i*5<=percent); });
    status.textContent = previewClean ? 'All three columns show this model’s no-noise reconstruction. Return to noise to resume at the same strength.' : percent === 0 ? 'At 0%, every test uses the same clean tokens. Increase the noise to begin.' : 'Only the highlighted scale receives noise. The other two retain their clean tokens.';
  });
  play.addEventListener('click', () => {
    if (playing) { stop(); settleTo(current.percent); return; }
    if (!current.available) return;
    stop(); controller.showClean(false);
    const timeline = createSweepTimeline(current.percent);
    const started = performance.now();
    playing = true;
    play.setAttribute('aria-pressed', 'true'); play.setAttribute('aria-label', 'Pause noise sweep');
    panel.classList.add('is-playing');
    function tick(now) {
      const state = timeline.sample(now-started);
      applyPosition(state.position);
      if (state.done) { stop(); paint(100); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
  slider.addEventListener('pointerdown', () => { stop(); panel.classList.add('is-scrubbing'); });
  slider.addEventListener('input', event => { stop(); applyPosition(Number(event.target.value)); });
  slider.addEventListener('change', () => { panel.classList.remove('is-scrubbing'); settleTo(snapPercent(position)); });
  slider.addEventListener('pointerup', () => { panel.classList.remove('is-scrubbing'); settleTo(snapPercent(position)); });
  slider.addEventListener('pointercancel', () => { panel.classList.remove('is-scrubbing'); settleTo(snapPercent(position)); });
  slider.addEventListener('keydown', event => {
    const delta = {ArrowRight:5,ArrowUp:5,ArrowLeft:-5,ArrowDown:-5,PageUp:10,PageDown:-10}[event.key];
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : delta !== undefined ? snapPercent(current.percent+delta) : null;
    if (target === null) return;
    event.preventDefault(); stop(); applyPosition(target);
  });
  reset.addEventListener('click', () => { stop(); settleTo(0); });
  clean.addEventListener('click', () => { stop(); controller.showClean(!current.previewClean); });
  function select(tab) { stop(); controller.selectPlacement(tab.dataset.placement); }
  tabs.forEach((tab,i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const index = event.key === 'ArrowRight' ? (i+1)%3 : event.key === 'ArrowLeft' ? (i+2)%3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
      if (index < 0) return;
      event.preventDefault(); select(tabs[index]); tabs[index].focus();
    });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); paint(current.percent); } });
  reduced.addEventListener('change', event => {
    if (!event.matches) return;
    stop(); paint(current.percent);
    fades.forEach((fade, layer) => { fade?.cancel(); backs[layer].hidden = true; });
  });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }, {threshold:0}).observe(panel);
  Object.values(data.experiments).forEach(experiment => {
    const base = experiment.base || defaultBase;
    [...experiment.records.map(record => base+record.image), base+experiment.clean].forEach(src => { loadImage(src).catch(() => {}); });
  });
  controller.reset();
})(typeof window === 'undefined' ? globalThis : window);
