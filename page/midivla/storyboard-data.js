(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./journey-data.js'));
  else root.MIDIVLA_STORY = factory(root.MIDIVLA_JOURNEY_DATA);
}(typeof window === 'undefined' ? globalThis : window, function (records) {
  'use strict';
  const fps = 30;
  const definitions = [
    ['lapa', 'Lapa', 10, 'Learning a change from two frames', 'What does reconstruction ask a token to carry?'],
    ['multiscale', 'Multiscale', 10, 'Give the transition more than one scale', 'Does a hierarchy separate action by itself?'],
    ['finding-one', 'FindingOne', 15, 'Sensitivity without exclusivity', 'Where does the transition information reside?'],
    ['degeneration', 'Degeneration', 10, 'Give a missing action a training target', 'Can we choose where the action must live?'],
    ['finding-two', 'FindingTwo', 25, 'Placement reshapes action allocation', 'What survives outside the constrained scale?'],
    ['bottleneck', 'Bottleneck', 5, 'Put the bottleneck first', 'Which scale has no earlier bypass?'],
    ['composition', 'Composition', 10, 'Two transitions. One prediction.', 'Can the action codes describe a longer change?'],
    ['vla', 'Vla', 5, 'From video transitions to robot actions', 'How does the representation become supervision?']
  ];
  let from = 0;
  const scenes = definitions.map(([id, composition, seconds, title, question], i) => {
    const prefix = String(i + 1).padStart(2, '0') + '-' + id;
    const scene = Object.freeze({id, composition, seconds, title, question, from, frames: seconds * fps,
      video: 'videos/' + prefix + '.mp4', poster: 'videos/keyframes/' + prefix + '.png'});
    from += scene.frames;
    return scene;
  });
  function sceneAt(frame) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= from) throw new RangeError('Frame outside storyboard.');
    return scenes.find(scene => frame >= scene.from && frame < scene.from + scene.frames);
  }
  function f1StageAt(frame) {
    return frame < 120 ? 0 : frame < 195 ? 1 : frame < 270 ? 2 : 3;
  }
  function f2StateAt(frame) {
    const comparison = frame >= 630;
    const placement = comparison ? 1 : Math.min(3, Math.floor(frame / 210) + 1);
    const local = Math.max(0, frame % 210);
    const percent = comparison ? 100 : Math.min(100, Math.floor(Math.max(0, local - 25) / 6) * 5);
    return {placement, percent, comparison};
  }
  return Object.freeze({fps, width: 1920, height: 1080, totalFrames: from, scenes: Object.freeze(scenes),
    colors: Object.freeze(['#087f83', '#468641', '#cb6a28']), sceneAt, f1StageAt, f2StateAt,
    resolveF1: records.resolveF1, resolveF2: records.resolveExperiment});
}));
