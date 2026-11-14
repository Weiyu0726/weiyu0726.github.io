(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MIDIVLA_SCROLL_STORY = api;
    api.mount(root.document, root);
  }
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  // A state is visible only after all of its images are ready. New requests
  // invalidate old requests, including their eventual errors.
  function createFrameTransaction(options) {
    var revision = 0;
    return {
      request: async function (snapshot) {
        var current = ++revision;
        options.status('loading', 'Loading ' + snapshot.label + '...');
        try {
          await Promise.all(snapshot.images.map(options.loadImage));
          if (current !== revision) return false;
          options.commit(snapshot);
          options.status('ready', snapshot.status || snapshot.label + '.');
          return true;
        } catch (error) {
          if (current !== revision) return false;
          options.status('error', 'Could not load ' + snapshot.label + '. The last complete display is retained. Try another state or replay.');
          return false;
        }
      }
    };
  }

  function createPlayback(options) {
    var running = false;
    var timer = null;
    var generation = 0;
    var schedule = options.schedule || function (callback) { return setTimeout(callback, options.delay || 1100); };
    var cancel = options.cancel || clearTimeout;
    var allowed = options.allowed || function () { return true; };
    function stop() {
      running = false;
      generation++;
      cancel(timer);
      timer = null;
      options.change(false);
    }
    function queue(current) {
      timer = schedule(async function () {
        if (!running || current !== generation) return;
        if (!allowed()) { stop(); return; }
        var complete = await options.advance();
        if (!running || current !== generation) return;
        if (complete === false) stop();
        else queue(current);
      });
    }
    return {
      start: function () {
        if (running || !allowed()) return;
        running = true;
        options.change(true);
        queue(++generation);
      },
      stop: stop,
      isRunning: function () { return running; }
    };
  }

  function chapterProgress(top, height, viewport) {
    return Math.max(0, Math.min(1, (viewport * 0.5 - top) / Math.max(1, height - viewport * 2 / 3)));
  }

  function readingPhase(positions, viewport) {
    var phase = 0;
    positions.forEach(function (top, index) { if (top < viewport * 0.5) phase = index; });
    return phase;
  }

  function createMatrixSnapshot(data, percent, resolveMatrix) {
    var matrix = resolveMatrix(data, percent);
    var reference = matrix.rows[0];
    return {
      percent: matrix.percent,
      rows: matrix.rows,
      source: reference.source,
      target: reference.target,
      label: 'all three models at ' + matrix.percent + '% noise',
      images: [reference.source, reference.target].concat(matrix.rows.flatMap(function (row) {
        return [row.clean].concat(row.cells.map(function (cell) { return cell.src; }));
      })),
      status: 'All three independently trained models / ' + matrix.percent + '% noise. Each row keeps its own clean baseline and three separate scale tests.'
    };
  }

  function visualFitsViewport(height, viewport, top) {
    return height <= viewport - top - 16;
  }

  function findingTwoGuide(step) {
    var guides = {
      trained: {
        cells: ['1:1', '2:2', '3:3'],
        caption: 'The diagonal is required by training, not evidence of unique localization.',
        notes: ['S1 noise: Before target.', 'S2 noise: Before target.', 'S3 noise: Before target.']
      },
      earlier: {
        cells: ['2:1', '3:1', '3:2'],
        caption: 'The key evidence is off-diagonal: earlier scales still change the action.',
        notes: ['No earlier scale to test.', 'S1 still changes the action.', 'S1 and S2 still change the action.']
      },
      decision: {
        cells: ['1:1'],
        caption: 'Constrain S1: the residual chain has no earlier latent route around it.',
        notes: ['S1: no earlier latent route.', 'S2 leaves S1 upstream.', 'S3 leaves S1 and S2 upstream.']
      }
    };
    var selected = Object.hasOwn(guides, step) ? step : 'trained';
    return Object.assign({ step: selected }, guides[selected]);
  }

  function createScenePlayback(options) {
    var inside = false;
    var manuallyPaused = false;
    function play() {
      return Promise.resolve(options.play()).catch(function () {});
    }
    function userPlay() {
      if (options.explicitAllowed && !options.explicitAllowed()) return;
      manuallyPaused = false;
      if (options.beforePlay) options.beforePlay();
      return play();
    }
    function userPause() {
      manuallyPaused = true;
      options.pause();
    }
    function refresh() {
      if (inside && !manuallyPaused && options.allowed()) return play();
      options.pause();
    }
    return {
      enter: function () {
        if (inside) return;
        inside = true;
        if (!manuallyPaused && options.allowed()) play();
      },
      leave: function () { inside = false; options.pause(); },
      replay: function () { options.reset(); return userPlay(); },
      pause: function () { options.pause(); },
      refresh: refresh,
      userPlay: userPlay,
      userPause: userPause,
      seek: function (time) {
        var duration = options.duration();
        if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return;
        userPause();
        if (options.beforeSeek) options.beforeSeek();
        options.seek(Math.max(0, Math.min(Math.max(0, duration - 1 / 30), time)));
      }
    };
  }

  function createSceneControls(document, video, playback) {
    var minimal = video.getAttribute('data-video-controls') === 'minimal';
    var controls = document.createElement('div');
    controls.className = minimal ? 'ambient-controls ambient-controls-minimal' : 'ambient-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', minimal ? 'Animation controls' : 'Video controls');
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ambient-toggle';
    toggle.setAttribute('aria-controls', video.id);
    var icon = document.createElement('img');
    icon.alt = '';
    icon.width = 18;
    icon.height = 18;
    toggle.append(icon);
    var seek, clock;
    if (!minimal) {
      seek = document.createElement('input');
      seek.type = 'range';
      seek.className = 'ambient-seek';
      seek.min = 0;
      seek.step = 0.1;
      seek.setAttribute('aria-controls', video.id);
      seek.setAttribute('aria-label', 'Playback position: ' + (video.getAttribute('aria-label') || 'Video'));
      clock = document.createElement('span');
      clock.className = 'ambient-time';
    }
    function formatTime(seconds) {
      seconds = Math.max(0, Math.floor(Number(seconds) || 0));
      return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }
    function sync() {
      var duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      var current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      var label = minimal ? (video.paused ? 'Resume animation' : 'Pause animation') :
        (video.paused ? 'Play video' : 'Pause video');
      toggle.title = label;
      toggle.setAttribute('aria-label', label);
      icon.src = '/page/midivla/assets/icons/' + (video.paused ? 'play' : 'pause') + '.svg';
      if (minimal) return;
      seek.disabled = !duration;
      seek.max = duration || 1;
      seek.value = Math.min(current, duration);
      seek.setAttribute('aria-valuetext', formatTime(current) + ' of ' + formatTime(duration));
      seek.style.setProperty('--seek-progress', (duration ? current / duration * 100 : 0) + '%');
      clock.textContent = formatTime(current) + ' / ' + formatTime(duration);
    }
    toggle.addEventListener('click', function () {
      if (video.paused) playback.userPlay();
      else playback.userPause();
    });
    if (seek) seek.addEventListener('input', function () { playback.seek(Number(seek.value)); });
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'play', 'pause', 'ended', 'emptied'].forEach(function (event) {
      video.addEventListener(event, sync);
    });
    controls.append(toggle);
    if (!minimal) controls.append(seek, clock);
    sync();
    var links = minimal && video.parentElement.querySelector('.pipeline-links');
    if (links) links.append(controls);
    else video.insertAdjacentElement('afterend', controls);
    // Long pipelines retain native controls until the custom toolbar mounts.
    video.controls = false;
    video.classList.add('has-ambient-controls');
    return controls;
  }

  var scenePlaybackRate = 1.35;

  function createDiagramMotionControl(document, diagram, footer, options) {
    var paused = true;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'icon-button diagram-motion-toggle';
    toggle.setAttribute('aria-controls', diagram.id);
    var icon = document.createElement('img');
    icon.alt = '';
    icon.width = 16;
    icon.height = 16;
    toggle.append(icon);
    function setPaused(value) {
      paused = value;
      diagram.classList.toggle('is-motion-paused', value);
      var label = value ? 'Resume animation' : 'Pause animation';
      toggle.title = label;
      toggle.setAttribute('aria-label', label);
      icon.src = '/page/midivla/assets/icons/' + (value ? 'play' : 'pause') + '.svg';
    }
    var playback = createScenePlayback({
      play: function () { setPaused(false); },
      pause: function () { setPaused(true); },
      allowed: options.allowed,
      explicitAllowed: options.explicitAllowed
    });
    toggle.addEventListener('click', function () {
      if (paused) playback.userPlay();
      else playback.userPause();
    });
    setPaused(true);
    footer.append(toggle);
    return playback;
  }

  function scenePlaybackRateFor(id) {
    return ['representation-film', 'finding-one-film', 'finding-two-film'].includes(id) ? scenePlaybackRate : 1;
  }

  function findingTwoNoiseTime(percent) {
    return 7.6 + Math.round(Math.max(0, Math.min(100, Number(percent) || 0)) / 5) * 0.25;
  }

  function findingTwoNoiseAt(time) {
    return time >= 7.5 && time < 12.75 ? Math.min(100, Math.floor((time - 7.5 + 1e-6) / 0.25) * 5) : 100;
  }

  function createNoiseInspection(options) {
    var selected = null;
    function apply() {
      if (selected === null) return;
      options.pause();
      if (options.ready()) options.seek(findingTwoNoiseTime(selected));
    }
    return {
      select: function (percent) {
        selected = findingTwoNoiseAt(findingTwoNoiseTime(percent));
        options.show(selected);
        apply();
      },
      loaded: apply,
      observe: function (time) { if (selected === null) options.show(findingTwoNoiseAt(time)); },
      clear: function () { selected = null; },
      isManual: function () { return selected !== null; }
    };
  }

  function createSceneDrag(options) {
    var origin = null;
    var active = false;
    function seek(time) {
      var duration = options.duration();
      if (!Number.isFinite(duration) || duration <= 0) return;
      options.seek(Math.max(0, Math.min(duration - 1 / 30, time)));
    }
    function end() {
      origin = null;
      if (active) options.change(false);
      active = false;
    }
    return {
      start: function (x, y, width) {
        end();
        if (!Number.isFinite(options.duration()) || options.duration() <= 0 || width <= 0) return false;
        origin = {x: x, y: y, width: width, time: options.time()};
        return true;
      },
      move: function (x, y) {
        if (!origin) return false;
        var dx = x - origin.x;
        var dy = y - origin.y;
        if (!active) {
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) { end(); return false; }
          if (Math.abs(dx) < 5) return false;
          active = true;
          options.pause();
          options.change(true);
        }
        seek(origin.time + dx / origin.width * options.duration());
        return true;
      },
      end: end,
      step: function (delta) {
        if (!Number.isFinite(delta) || !Number.isFinite(options.duration()) || options.duration() <= 0) return;
        options.pause();
        seek(options.time() + delta);
      }
    };
  }

  function createTitleTokens() {
    var tokens = [];
    [3, 4, 5].forEach(function (side, group) {
      var size = (66 - (side - 1) * 3) / side;
      for (var i = 0; i < side * side; i++) tokens.push({
        scale: group + 1, size: size,
        color: ['#e97524', '#8d969e', '#c4cbd0'][group],
        x: 94 + group * 123 + (i % side) * (size + 3),
        y: 20 + Math.floor(i / side) * (size + 3)
      });
    });
    return tokens;
  }

  function titleAnimationState(seconds) {
    var ease = function (start, duration) {
      var t = Math.max(0, Math.min(1, (seconds - start) / duration));
      return t * t * (3 - 2 * t);
    };
    var push = ease(1.8, 2.3);
    return {
      phase: seconds < 0.8 ? 'scales' : seconds < 1.8 ? 'gather' : seconds < 4.1 ? 'push' : seconds < 5.7 ? 'assemble' : 'wordmark',
      gather: ease(0.8, 1), push: push, assemble: ease(4.1, 1.5),
      cartX: 120 + push * 250, settle: ease(5.7, 0.7),
      characterVisible: seconds >= 1.2 && seconds < 6,
      characterOpacity: ease(1.2, 0.5) * (1 - ease(5.2, 0.8)),
      stride: seconds > 1.8 && seconds < 4.1 ? Math.sin((seconds - 1.8) * 16) : 0
    };
  }

  function drawTitlePerson(context, x, state) {
    var stride = state.stride * 5;
    var reach = state.assemble;
    context.save();
    context.translate(x, 136);
    context.globalAlpha = state.characterOpacity;
    context.strokeStyle = '#3e454b';
    context.fillStyle = '#3e454b';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    // A leaning shoulder and two planted hands keep contact with the tokens.
    context.beginPath();
    context.arc(3 - reach * 4, -34, 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(1 - reach * 4, -26);
    context.lineTo(-5, -14);
    context.lineTo(-14 - stride, -1);
    context.lineTo(-8 - stride, -1);
    context.moveTo(-5, -14);
    context.lineTo(3 + stride, -1);
    context.lineTo(9 + stride, -1);
    context.moveTo(0, -24);
    context.lineTo(9, -20 - reach * 10);
    context.lineTo(20 - reach * 6, -20 - reach * 18);
    context.moveTo(-2, -21);
    context.lineTo(8, -15 - reach * 10);
    context.lineTo(20 - reach * 6, -15 - reach * 18);
    context.stroke();
    context.restore();
  }

  function taskCarouselDestination(index, offsets, maximum) {
    if (!offsets.length) return 0;
    var bounded = Math.max(0, Math.min(offsets.length - 1, index));
    return Math.max(0, Math.min(maximum, offsets[bounded]));
  }

  function taskCarouselIndex(scrollLeft, offsets, maximum) {
    if (offsets.length < 2 || maximum <= 0) return 0;
    if (scrollLeft >= maximum - 2) return offsets.length - 1;
    return offsets.reduce(function (nearest, offset, index) {
      return Math.abs(offset - scrollLeft) < Math.abs(offsets[nearest] - scrollLeft) ? index : nearest;
    }, 0);
  }

  function createTaskAutoScroll(options) {
    var frame = null;
    var previous = null;
    var direction = 1;
    var active = false;
    var position = 0;
    function tick(time) {
      frame = null;
      if (!active) return;
      if (previous === null) position = options.readPosition();
      else {
        var maximum = options.maximum();
        var next = position + direction * 28 * Math.min(64, Math.max(0, time - previous)) / 1000;
        if (next >= maximum) { next = maximum; direction = -1; }
        else if (next <= 0) { next = 0; direction = 1; }
        position = next;
        options.writePosition(next);
      }
      previous = time;
      frame = options.requestFrame(tick);
    }
    return {
      setActive: function (value) {
        if (active === value) return;
        active = value;
        previous = null;
        if (frame !== null) options.cancelFrame(frame);
        frame = active ? options.requestFrame(tick) : null;
      }
    };
  }

  function mountTaskVideos(document, window, media) {
    var players = new Map();
    Array.from(document.querySelectorAll('#task-carousel video')).forEach(function (video) {
      video.muted = true;
      video.loop = true;
      var playback = createScenePlayback({
        play: function () { return video.play(); },
        pause: function () { video.pause(); },
        allowed: function () { return !document.hidden && !media.matches; }
      });
      players.set(video, playback);
    });
    if (!players.size) return;
    if (window.IntersectionObserver) {
      var observer = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var playback = players.get(entry.target);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.15) playback.enter();
          else playback.leave();
        });
      }, {threshold: [0, 0.15]});
      players.forEach(function (_, video) { observer.observe(video); });
    } else players.forEach(function (playback) { playback.enter(); });
    function refresh() { players.forEach(function (playback) { playback.refresh(); }); }
    document.addEventListener('visibilitychange', refresh);
    media.addEventListener('change', refresh);
  }

  function mountTaskCarousel(document, window, media) {
    var track = document.querySelector('#task-carousel');
    if (!track) return;
    var items = Array.from(track.querySelectorAll('.task-example'));
    var requestedIndex = null;
    var drag = null;
    var scrollFrame = null;
    function geometry() {
      return {
        offsets: items.map(function (item) { return item.offsetLeft - items[0].offsetLeft; }),
        maximum: Math.max(0, track.scrollWidth - track.clientWidth)
      };
    }
    function index() {
      var layout = geometry();
      return taskCarouselIndex(track.scrollLeft, layout.offsets, layout.maximum);
    }
    function update() {
      scrollFrame = null;
      var layout = geometry();
      if (requestedIndex !== null && Math.abs(track.scrollLeft - taskCarouselDestination(requestedIndex, layout.offsets, layout.maximum)) < 2) requestedIndex = null;
    }
    function goTo(next) {
      var layout = geometry();
      requestedIndex = Math.max(0, Math.min(items.length - 1, next));
      track.scrollTo({left: taskCarouselDestination(requestedIndex, layout.offsets, layout.maximum), behavior: media.matches ? 'auto' : 'smooth'});
      update();
    }
    track.addEventListener('keydown', function (event) {
      if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
      var current = requestedIndex === null ? index() : requestedIndex;
      var next = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: items.length - 1}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      goTo(next);
    });
    track.addEventListener('scroll', function () {
      if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(update);
    }, {passive: true});
    track.addEventListener('wheel', function () { requestedIndex = null; }, {passive: true});
    track.addEventListener('pointerdown', function (event) {
      requestedIndex = null;
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, a, video')) return;
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: track.scrollLeft, active: false};
    });
    track.addEventListener('pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var dx = event.clientX - drag.x;
      if (!drag.active) {
        if (Math.abs(event.clientY - drag.y) > Math.abs(dx) + 6) { drag = null; return; }
        if (Math.abs(dx) < 6) return;
        drag.active = true;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
      }
      event.preventDefault();
      track.scrollLeft = drag.left - dx;
    });
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      var active = drag.active;
      var next = index();
      drag = null;
      track.classList.remove('is-dragging');
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      if (active) goTo(next);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', endDrag);
    track.addEventListener('pointerleave', function () { if (drag && !drag.active) drag = null; });
    window.addEventListener('resize', function () { requestedIndex = null; update(); });
    if (window.IntersectionObserver) {
      var visible = false;
      var hovered = track.matches(':hover');
      var focused = track.matches(':focus-visible');
      var interacting = false;
      var resumeTimer = null;
      var autoScroll = createTaskAutoScroll({
        requestFrame: function (callback) { return window.requestAnimationFrame(callback); },
        cancelFrame: function (id) { window.cancelAnimationFrame(id); },
        readPosition: function () { return track.scrollLeft; },
        writePosition: function (left) { track.scrollLeft = left; },
        maximum: function () { return Math.max(0, track.scrollWidth - track.clientWidth); }
      });
      function refreshAutoScroll() {
        track.classList.toggle('has-auto-scroll', !media.matches);
        autoScroll.setActive(visible && !document.hidden && !media.matches && !hovered && !focused && !interacting);
      }
      function pauseInteraction() {
        window.clearTimeout(resumeTimer);
        interacting = true;
        refreshAutoScroll();
      }
      function resumeAfterInteraction() {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(function () { interacting = false; refreshAutoScroll(); }, 1800);
      }
      track.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') { hovered = true; refreshAutoScroll(); } });
      track.addEventListener('pointerleave', function () { hovered = false; refreshAutoScroll(); });
      track.addEventListener('focusin', function (event) { focused = track.matches(':focus-visible') || event.target !== track; refreshAutoScroll(); });
      track.addEventListener('focusout', function (event) { focused = track.contains(event.relatedTarget); refreshAutoScroll(); });
      track.addEventListener('keydown', function () { focused = true; refreshAutoScroll(); });
      track.addEventListener('pointerdown', pauseInteraction);
      track.addEventListener('pointerup', resumeAfterInteraction);
      track.addEventListener('pointercancel', resumeAfterInteraction);
      track.addEventListener('lostpointercapture', resumeAfterInteraction);
      window.addEventListener('pointerup', function () { if (interacting) resumeAfterInteraction(); });
      track.addEventListener('wheel', function () { pauseInteraction(); resumeAfterInteraction(); }, {passive: true});
      document.addEventListener('visibilitychange', refreshAutoScroll);
      media.addEventListener('change', refreshAutoScroll);
      new window.IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        refreshAutoScroll();
      }, {threshold: 0.15}).observe(track);
      refreshAutoScroll();
    }
    update();
  }

  function mount(document, window) {
    if (!document || !document.querySelector('.scroll-story')) return;
    var $ = function (selector, container) { return (container || document).querySelector(selector); };
    var $$ = function (selector, container) { return Array.from((container || document).querySelectorAll(selector)); };
    var records = window.MIDIVLA_STORY || window.MIDIVLA_JOURNEY_DATA;
    var dataset = window.MIDIVLA_NOISE_EXPERIMENTS;
    var imageCache = new Map();
    var media = window.matchMedia('(prefers-reduced-motion: reduce)');
    var playbacks = [];
    var sceneSelections = new Map();

    mountTaskCarousel(document, window, media);
    mountTaskVideos(document, window, media);

    if (window.IntersectionObserver) {
      var emblemObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting && !media.matches);
        });
      }, { threshold: 0.6 });
      $$('.finding-emblem').forEach(function (emblem) { emblemObserver.observe(emblem); });
    }

    var title = $('.animated-title');
    var titleCanvas = title && $('.title-tokens', title);
    var titleContext = titleCanvas && titleCanvas.getContext('2d');
    var titleRaf = null;
    var titleStarted = null;
    var titleParticles = [];
    var titleTokens = createTitleTokens();
    var titleAX = 370;
    function stopTitle() {
      window.cancelAnimationFrame(titleRaf);
      titleStarted = null;
      if (title) title.classList.remove('is-forming');
    }
    if (titleContext) {
      // Only S1 supplies the A. Other particles form MiDiVL; these are decorative,
      // not measured codebook values. The initial grids retain 9/16/25 tokens.
      var mask = document.createElement('canvas');
      mask.width = 500; mask.height = 112;
      var maskContext = mask.getContext('2d');
      maskContext.font = '700 78px Arial';
      var wordX = (500 - maskContext.measureText('MiDiVLA').width) / 2;
      titleAX = wordX + maskContext.measureText('MiDiVL').width;
      maskContext.fillText('MiDiVLA', wordX, 84);
      var pixels = maskContext.getImageData(0, 0, 500, 112).data;
      for (var y = 12; y < 100; y += 3) {
        for (var x = 45; x < 455; x += 3) {
          if (pixels[(y * 500 + x) * 4 + 3] > 160) titleParticles.push({x: x, y: y});
        }
      }
      titleParticles.forEach(function (particle, index) {
        particle.isAction = particle.x >= titleAX - 1;
        var tokenIndex = particle.isAction ? index % 9 : 9 + index % 41;
        var token = titleTokens[tokenIndex];
        var local = Math.floor(index / titleTokens.length);
        particle.fromX = token.x + ((local * 0.61803398875) % 1) * (token.size - 2);
        particle.fromY = token.y + ((local * 0.41421356237) % 1) * (token.size - 2);
        particle.scale = token.scale;
        particle.tokenIndex = tokenIndex;
        particle.color = token.color;
      });
      titleCanvas.width = 1000; titleCanvas.height = 296;
      titleContext.scale(2, 2);
    }
    function drawTitle(now) {
      if (titleStarted === null) titleStarted = now;
      var seconds = (now - titleStarted) / 1000;
      var state = titleAnimationState(seconds);
      var cartX = 120 + state.push * (titleAX + 13 - 120);
      titleContext.clearRect(0, 0, 500, 148);
      titleTokens.forEach(function (token, index) {
        titleContext.fillStyle = token.color;
        if (token.scale === 1) {
          titleContext.globalAlpha = 1 - state.assemble;
          var size = token.size + (6 - token.size) * state.gather;
          titleContext.fillRect(token.x + (cartX + index % 3 * 8 - token.x) * state.gather,
            token.y + (113 + Math.floor(index / 3) * 8 - token.y) * state.gather, size, size);
        } else {
          titleContext.globalAlpha = Math.max(0, 1 - state.gather * 4);
          titleContext.fillRect(token.x, token.y, token.size, token.size);
        }
      });
      if (state.gather > 0) {
        titleParticles.forEach(function (particle) {
          var progress = particle.isAction ? state.assemble : state.gather;
          var fromX = particle.isAction ? cartX + particle.tokenIndex % 3 * 8 : particle.fromX;
          var fromY = particle.isAction ? 113 + Math.floor(particle.tokenIndex / 3) * 8 : particle.fromY;
          titleContext.globalAlpha = Math.min(1, progress * 5) * (1 - state.settle);
          titleContext.fillStyle = particle.isAction ? '#e97524' : '#69747c';
          titleContext.fillRect(fromX + (particle.x - fromX) * progress,
            fromY + (particle.y - fromY) * progress - (particle.isAction ? Math.sin(progress * Math.PI) * 20 : 0), 2.6, 2.6);
        });
      }
      if (state.characterVisible) drawTitlePerson(titleContext, cartX - 20, state);
      titleContext.globalAlpha = 1;
      title.style.setProperty('--title-settle', state.settle);
      title.dataset.animationPhase = state.phase;
      if (seconds < 6.4) titleRaf = window.requestAnimationFrame(drawTitle);
      else stopTitle();
    }
    function replayTitle() {
      stopTitle();
      if (!titleContext || media.matches || document.hidden) return;
      title.style.setProperty('--title-settle', 0);
      title.classList.add('is-forming');
      titleRaf = window.requestAnimationFrame(drawTitle);
    }
    if (titleContext && window.IntersectionObserver) {
      var titleObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stopTitle();
          if (entry.isIntersecting) replayTitle();
        });
      }, { threshold: 0.5 });
      titleObserver.observe(title);
    }

    var ambientScenes = new Map();
    $$('[data-ambient-scene]').forEach(function (video) {
      video.defaultPlaybackRate = scenePlaybackRateFor(video.id);
      video.playbackRate = scenePlaybackRateFor(video.id);
      video.loop = true;
      video.draggable = false;
      video.tabIndex = -1;
      video.removeAttribute('title');
      video.removeAttribute('aria-keyshortcuts');
      var inspection = null;
      if (video.id === 'finding-two-film') {
        var noiseInput = $('#f2-scene-noise');
        inspection = createNoiseInspection({
          ready: function () { return video.readyState >= 1; },
          pause: function () { video.pause(); },
          seek: function (time) { video.currentTime = time; },
          show: function (percent) {
            noiseInput.value = percent;
            noiseInput.setAttribute('aria-valuetext', percent + '% test noise');
            $('#f2-scene-noise-value').textContent = percent + '%';
          }
        });
        noiseInput.addEventListener('input', function () {
          playback.userPause();
          inspection.select(noiseInput.value);
        });
        video.addEventListener('loadedmetadata', inspection.loaded);
        video.addEventListener('timeupdate', function () { inspection.observe(video.currentTime); });
        video.addEventListener('seeked', function () { inspection.observe(video.currentTime); });
      }
      var playback = createScenePlayback({
        play: function () { return video.play(); },
        pause: function () { video.pause(); },
        reset: function () { video.currentTime = 0; },
        duration: function () { return video.duration; },
        seek: function (time) { video.currentTime = time; },
        beforePlay: function () { if (inspection) inspection.clear(); },
        beforeSeek: function () { if (inspection) inspection.clear(); },
        allowed: function () { return !media.matches && !document.hidden && !$('dialog[open]') && !(inspection && inspection.isManual()); },
        explicitAllowed: function () { return !document.hidden && !$('dialog[open]'); }
      });
      ambientScenes.set(video, playback);
      createSceneControls(document, video, playback);
    });
    $$('.representation-live').forEach(function (diagram) {
      var diagramAllowed = function () {
        return !media.matches && !document.hidden && !$('dialog[open]');
      };
      var playback = createDiagramMotionControl(document, diagram,
        $('.evidence-footer', diagram.parentElement), {
          allowed: diagramAllowed,
          explicitAllowed: diagramAllowed
        });
      ambientScenes.set(diagram, playback);
      if (!window.IntersectionObserver) playback.enter();
    });
    if (window.IntersectionObserver) {
      var sceneObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var playback = ambientScenes.get(entry.target);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) playback.enter();
          else playback.leave();
        });
      }, {threshold: [0, 0.6]});
      ambientScenes.forEach(function (_, video) { sceneObserver.observe(video); });
    }

    $$('[data-open-evidence]').forEach(function (button) {
      button.addEventListener('click', function () {
        ambientScenes.forEach(function (playback) { playback.pause(); });
        $('#' + button.dataset.openEvidence).showModal();
      });
    });
    $$('[data-close-evidence]').forEach(function (button) {
      button.addEventListener('click', function () { button.closest('dialog').close(); });
    });
    $$('.evidence-dialog').forEach(function (dialog) {
      dialog.addEventListener('close', function () {
        playbacks.forEach(function (playback) { playback.stop(); });
        ambientScenes.forEach(function (playback) { playback.refresh(); });
      });
      dialog.addEventListener('click', function (event) {
        var rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
      });
    });
    function openLegacyEvidence() {
      if (window.location.hash === '#measured-noise-sweep') {
        ambientScenes.forEach(function (playback) { playback.pause(); });
        $('#f2-evidence-dialog').showModal();
      }
    }
    window.addEventListener('hashchange', openLegacyEvidence);
    openLegacyEvidence();

    // Mechanism chapters share a figure-first stage; experimental viewers keep
    // their own layout and state, including all three Finding 2 model rows.
    $$('[data-chapter]').forEach(function (chapter) {
      var layout = $('.chapter-layout', chapter);
      if (layout.classList.contains('experiment-layout') || layout.classList.contains('single-scene')) return;
      var diagram = $('[data-diagram]', chapter);
      var narrative = $('.chapter-narrative', chapter);
      var toolbar = document.createElement('div');
      toolbar.className = 'scene-toolbar';
      toolbar.append($('.diagram-heading', diagram));
      var surface = document.createElement('div');
      surface.className = 'scene-surface';
      diagram.classList.remove('sticky-visual');
      surface.append(diagram);
      layout.prepend(toolbar, surface);
      layout.append(narrative);
      layout.classList.add('is-deck');


      var steps = $$('.story-step', narrative);
      steps.forEach(function (step, index) {
        var heading = $('h3', step);
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'scene-step';
        button.dataset.sceneStep = index;
        button.setAttribute('aria-pressed', 'false');
        var number = document.createElement('span');
        number.className = 'scene-step-number';
        number.textContent = String(index + 1).padStart(2, '0');
        button.append(number, document.createTextNode(heading.textContent));
        heading.replaceChildren(button);
        button.addEventListener('click', function () {
          sceneSelections.set(chapter.id, index);
          updateReading();
        });
        button.addEventListener('keydown', function (event) {
          var next = event.key === 'ArrowRight' ? (index + 1) % steps.length :
            event.key === 'ArrowLeft' ? (index + steps.length - 1) % steps.length :
            event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          var target = $('button', steps[next]);
          target.focus();
          target.click();
        });
      });
    });
    $$('[data-model-row]').forEach(function (row) {
      $$('[data-test-scale]', row).forEach(function (cell) {
        var test = Number(cell.dataset.testScale);
        var trained = Number(row.dataset.modelRow);
        cell.classList.toggle('is-trained-test', test === trained);
        cell.classList.toggle('is-upstream-test', test < trained);
      });
    });

    function replayDiagram(diagram) {
      diagram.classList.remove('is-animating');
      if (media.matches || document.hidden) return;
      void diagram.offsetWidth;
      diagram.classList.add('is-animating');
    }
    if (window.IntersectionObserver) {
      var diagramObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { entry.target.classList.remove('is-animating'); return; }
          if (!entry.target.dataset.hasPlayed) {
            replayDiagram(entry.target);
            entry.target.dataset.hasPlayed = 'true';
          }
        });
      }, { threshold: 0.35 });
      $$('.diagram-sheet, .f2-matrix-viewer').forEach(function (diagram) { diagramObserver.observe(diagram); });
    }

    function selectFindingGuide(step, animate) {
      var guide = findingTwoGuide(step);
      var viewer = $('#measured-noise-sweep');
      viewer.dataset.guide = guide.step;
      $('#f2-guide-caption').textContent = guide.caption;
      $$('[data-f2-guide]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.f2Guide === guide.step));
      });
      $$('[data-model-row]').forEach(function (row, index) {
        var model = Number(row.dataset.modelRow);
        $('[data-guide-note]', row).textContent = guide.notes[index];
        $$('[data-test-scale]', row).forEach(function (cell) {
          cell.classList.toggle('is-guide-focus', guide.cells.includes(model + ':' + cell.dataset.testScale));
        });
        $$('[data-node]', row).forEach(function (node) {
          var scale = Number(node.dataset.node);
          node.classList.toggle('is-constraint', scale === model);
          node.classList.toggle('is-evidence', guide.cells.includes(model + ':' + scale));
        });
      });
      if (animate) replayDiagram(viewer);
    }
    var guideButtons = $$('[data-f2-guide]');
    guideButtons.forEach(function (button, index) {
      button.addEventListener('click', function () { selectFindingGuide(button.dataset.f2Guide, true); });
      button.addEventListener('keydown', function (event) {
        var next = event.key === 'ArrowRight' ? (index + 1) % guideButtons.length :
          event.key === 'ArrowLeft' ? (index + guideButtons.length - 1) % guideButtons.length :
          event.key === 'Home' ? 0 : event.key === 'End' ? guideButtons.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        guideButtons[next].focus();
        guideButtons[next].click();
      });
    });
    selectFindingGuide('trained', false);
    $$('video').forEach(function (video) {
      video.addEventListener('play', function () {
        playbacks.forEach(function (playback) { playback.stop(); });
      });
    });
    function loadImage(src) {
      if (imageCache.has(src)) return imageCache.get(src);
      var pending = new Promise(function (resolve, reject) {
        var image = new window.Image();
        image.onload = function () {
          if (!image.naturalWidth) reject(new Error('Empty image: ' + src));
          else if (image.decode) image.decode().then(resolve, reject);
          else resolve();
        };
        image.onerror = function () { reject(new Error('Image unavailable: ' + src)); };
        image.src = src;
      });
      imageCache.set(src, pending);
      pending.catch(function () { imageCache.delete(src); });
      return pending;
    }

    function statusFor(viewer, output) {
      return function (state, message) {
        viewer.setAttribute('aria-busy', String(state === 'loading'));
        output.dataset.state = state;
        output.textContent = message;
      };
    }

    function updatePlaybackButton(button, playing) {
      var description = playing ? 'Pause recorded experiment' : 'Play recorded experiment';
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', description);
      button.title = description;
      $('img', button).src = '/page/midivla/assets/icons/' + (playing ? 'pause' : 'play') + '.svg';
    }

    function canPlay(viewer) {
      var bounds = viewer.getBoundingClientRect();
      return !document.hidden && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight;
    }

    function attachTransport(name, playback, requestClean) {
      var play = $('#' + name + '-play');
      play.addEventListener('click', function () {
        if (playback.isRunning()) playback.stop();
        else playback.start();
      });
      $('#' + name + '-replay').addEventListener('click', async function () {
        playback.stop();
        if (await requestClean()) playback.start();
      });
      playbacks.push(playback);
    }

    if (records && dataset) {
      var f2Slider = $('#f2-noise');
      var f2State = { percent: Number(f2Slider.value) };
      var f2Transaction = createFrameTransaction({
        loadImage: loadImage,
        status: statusFor($('#measured-noise-sweep'), $('#f2-status')),
        commit: function (snapshot) {
          $('#f2-before').src = snapshot.source;
          $('#f2-after').src = snapshot.target;
          snapshot.rows.forEach(function (row) {
            var baseline = $('#f2-clean-' + row.placement);
            baseline.src = row.clean;
            baseline.alt = 'Model g' + row.placement + ' clean reconstruction';
            row.cells.forEach(function (cell) {
              var image = $('#f2-record-' + row.placement + '-' + cell.scale);
              image.src = cell.src;
              image.alt = 'Model g' + row.placement + ', test noise at Scale ' + cell.scale + ', ' + snapshot.percent + '%';
              var relationship = cell.diagonal ? 'Constrained scale' : cell.upstream ? 'Upstream scale' : 'Downstream scale';
              $('[data-relation="' + row.placement + ':' + cell.scale + '"]').textContent = relationship;
            });
          });
          f2Slider.value = snapshot.percent;
          f2Slider.setAttribute('aria-valuetext', snapshot.percent + '% noise');
          $('#f2-value').textContent = snapshot.percent + '%';
          $('#f2-records').dataset.percent = snapshot.percent;
        }
      });
      function requestF2(percent) {
        f2State.percent = Number(percent);
        return f2Transaction.request(createMatrixSnapshot(dataset, f2State.percent, window.MIDIVLA_JOURNEY_DATA.resolveMatrix));
      }
      var f2Playback = createPlayback({
        delay: 650,
        allowed: function () { return canPlay($('#measured-noise-sweep')); },
        advance: function () { return requestF2((f2State.percent + 5) % 105); },
        change: function (playing) { updatePlaybackButton($('#f2-play'), playing); }
      });
      attachTransport('f2', f2Playback, function () { return requestF2(0); });
      f2Slider.addEventListener('input', function () { f2Playback.stop(); requestF2(f2Slider.value); });
      requestF2(f2State.percent);

      if (window.IntersectionObserver) {
        var observer = new window.IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              f2Playback.stop();
            }
          });
        }, { threshold: 0.1 });
        observer.observe($('#measured-noise-sweep'));
      }
    } else {
      $$('.experiment-status').forEach(function (status) { status.textContent = 'The recording data did not load. Reload the page to restore the experiment controls.'; });
      $$('.experiment-transport button, .experiment-transport input').forEach(function (control) { control.disabled = true; });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopTitle();
        playbacks.forEach(function (playback) { playback.stop(); });
        ambientScenes.forEach(function (playback) { playback.pause(); });
        $$('video').forEach(function (video) { video.pause(); });
        $$('.is-animating').forEach(function (diagram) { diagram.classList.remove('is-animating'); });
      } else {
        ambientScenes.forEach(function (playback) { playback.refresh(); });
      }
    });
    media.addEventListener('change', function (event) {
      if (event.matches) {
        stopTitle();
        playbacks.forEach(function (playback) { playback.stop(); });
        ambientScenes.forEach(function (playback) { playback.pause(); });
      } else {
        ambientScenes.forEach(function (playback) { playback.refresh(); });
      }
    });

    // Scrolling changes explanation emphasis only. Experimental state is owned
    // exclusively by the manual controls and their requested recordings.
    var queued = false;
    function updateReading() {
      queued = false;
      var viewport = window.innerHeight;
      $$('[data-chapter]').forEach(function (chapter) {
        var steps = $$('.story-step', chapter);
        var rect = chapter.getBoundingClientRect();
        var deck = $('.is-deck', chapter);
        var active = deck ? Math.min(2, Math.floor(chapterProgress(rect.top, rect.height, viewport) * 3)) :
          readingPhase(steps.map(function (item) { return item.getBoundingClientRect().top; }), viewport);
        if (sceneSelections.has(chapter.id)) active = sceneSelections.get(chapter.id);
        steps.forEach(function (item, index) {
          item.classList.toggle('is-active', index === active);
          var button = $('.scene-step', item);
          if (button) button.setAttribute('aria-pressed', String(index === active));
        });
        var diagram = $('[data-diagram]', chapter);
        var stickyTop = parseFloat(window.getComputedStyle(diagram).top) || 100;
        diagram.classList.toggle('is-too-tall', !visualFitsViewport(diagram.getBoundingClientRect().height, viewport, stickyTop));
        diagram.dataset.phase = active;
        $$('[data-highlight]', diagram).forEach(function (item) {
          var beat = Number(item.dataset.highlight);
          item.classList.toggle('is-highlighted', beat === active);
          item.classList.toggle('is-revealed', beat <= active);
        });
      });
      $$('.scene-film').forEach(function (video) { if (!canPlay(video)) video.pause(); });
    }
    function scheduleReading() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updateReading);
    }
    window.addEventListener('scroll', scheduleReading, { passive: true });
    window.addEventListener('resize', scheduleReading);
    if (window.ResizeObserver) {
      var sizeObserver = new window.ResizeObserver(scheduleReading);
      $$('.sticky-visual').forEach(function (visual) { sizeObserver.observe(visual); });
    }

    var dialog = $('#figure-dialog');
    var dialogImage = $('#dialog-image');
    var imageViewport = $('.dialog-image-wrap', dialog);
    $$('[data-figure]').forEach(function (button) {
      button.addEventListener('click', function () {
        ambientScenes.forEach(function (playback) { playback.pause(); });
        playbacks.forEach(function (playback) { playback.stop(); });
        $('#figure-title').textContent = button.dataset.title;
        dialogImage.src = '/page/midivla/assets/figure-' + button.dataset.figure + '.webp';
        dialogImage.alt = button.dataset.title;
        imageViewport.classList.remove('is-zoomed');
        imageViewport.scrollTop = 0;
        imageViewport.scrollLeft = 0;
        dialogImage.style.width = '';
        $('#zoom-figure').setAttribute('aria-pressed', 'false');
        $('#zoom-figure').setAttribute('aria-label', 'Show figure at full size');
        $('#zoom-figure').title = 'Show figure at full size';
        dialog.showModal();
        document.body.classList.add('modal-open');
      });
    });
    $('#close-figure').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      ambientScenes.forEach(function (playback) { playback.refresh(); });
    });
    dialog.addEventListener('click', function (event) {
      var box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    function toggleZoom() {
      if (!dialogImage.naturalWidth) return;
      var zoomed = imageViewport.classList.toggle('is-zoomed');
      dialogImage.style.width = zoomed ? dialogImage.naturalWidth + 'px' : '';
      $('#zoom-figure').setAttribute('aria-pressed', String(zoomed));
      $('#zoom-figure').setAttribute('aria-label', zoomed ? 'Fit figure to window' : 'Show figure at full size');
      $('#zoom-figure').title = zoomed ? 'Fit figure to window' : 'Show figure at full size';
    }
    imageViewport.addEventListener('click', toggleZoom);
    $('#zoom-figure').addEventListener('click', toggleZoom);

    var evidenceTabs = $$('[data-evidence]');
    function selectEvidence(key, focus) {
      evidenceTabs.forEach(function (button) {
        var active = button.dataset.evidence === key;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        $('#panel-' + button.dataset.evidence).hidden = !active;
        if (active && focus) button.focus();
      });
    }
    evidenceTabs.forEach(function (button, index) {
      button.addEventListener('click', function () { selectEvidence(button.dataset.evidence); });
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (index + 1) % evidenceTabs.length;
        else if (event.key === 'ArrowLeft') next = (index + evidenceTabs.length - 1) % evidenceTabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = evidenceTabs.length - 1;
        else return;
        event.preventDefault();
        selectEvidence(evidenceTabs[next].dataset.evidence, true);
      });
    });
    $('#copy-citation').addEventListener('click', async function () {
      try {
        await window.navigator.clipboard.writeText($('#bibtex').textContent);
        $('#copy-status').textContent = 'BibTeX copied to clipboard.';
      } catch (error) {
        var range = document.createRange();
        range.selectNodeContents($('#bibtex'));
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        $('#copy-status').textContent = 'Citation selected for copying.';
      }
    });
    document.body.classList.add('story-motion');
    updateReading();
  }

  return Object.freeze({
    mountTaskVideos: mountTaskVideos,
    createTaskAutoScroll: createTaskAutoScroll,
    taskCarouselDestination: taskCarouselDestination,
    taskCarouselIndex: taskCarouselIndex,
    mountTaskCarousel: mountTaskCarousel,
    findingTwoNoiseTime: findingTwoNoiseTime,
    findingTwoNoiseAt: findingTwoNoiseAt,
    createNoiseInspection: createNoiseInspection,
    createSceneDrag: createSceneDrag,
    scenePlaybackRate: scenePlaybackRate,
    scenePlaybackRateFor: scenePlaybackRateFor,
    createScenePlayback: createScenePlayback,
    createSceneControls: createSceneControls,
    createDiagramMotionControl: createDiagramMotionControl,
    createTitleTokens: createTitleTokens,
    titleAnimationState: titleAnimationState,
    createFrameTransaction: createFrameTransaction,
    createPlayback: createPlayback,
    createMatrixSnapshot: createMatrixSnapshot,
    findingTwoGuide: findingTwoGuide,
    visualFitsViewport: visualFitsViewport,
    chapterProgress: chapterProgress,
    readingPhase: readingPhase,
    mount: mount
  });
}));
