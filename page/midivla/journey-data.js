(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.MIDIVLA_JOURNEY_DATA = factory();
  }
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var scales = [1, 2, 3];
  var stagePercentages = [0, 33, 66, 99];

  // Freeze only newly constructed snapshots, never the caller's experiment data.
  function freezeSnapshot(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === 'object') freezeSnapshot(value[key]);
    });
    return Object.freeze(value);
  }

  function resolveF1(stage) {
    if (!Number.isInteger(stage) || stage < 0 || stage > 3) {
      throw new RangeError('Finding 1 stage must be an integer from 0 to 3.');
    }
    return freezeSnapshot({
      stage: stage,
      label: stagePercentages[stage] + '%',
      percent: stagePercentages[stage],
      source: '/page/midivla/assets/f1-start.webp',
      target: '/page/midivla/assets/f1-target.webp',
      frames: scales.map(function (scale) {
        return { scale: scale, src: '/page/midivla/assets/f1-s' + scale + '-' + stage + '.webp' };
      })
    });
  }

  function resolveMatrix(data, percent) {
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new RangeError('Matrix percent must be a finite number from 0 to 100.');
    }
    if (!data || !data.experiments || typeof data.experiments !== 'object') {
      throw new TypeError('Matrix data must contain experiments.');
    }
    var recordedPercent = Math.round(percent / 5) * 5;
    var rows = scales.map(function (placement) {
      var model = data.experiments[placement];
      if (!model || !Array.isArray(model.records)) {
        throw new Error('Missing experiment model ' + placement + ' or its records.');
      }
      var cells = scales.map(function (scale) {
        var record = model.records.find(function (item) {
          return item && item.layer === scale - 1 && item.percent === recordedPercent;
        });
        if (!record) {
          throw new Error('Missing record for model ' + placement + ', scale ' + scale + ', percent ' + recordedPercent + '.');
        }
        return {
          placement: placement,
          scale: scale,
          src: model.base + record.image,
          diagonal: scale === placement,
          upstream: scale < placement
        };
      });
      return {
        placement: placement,
        source: model.base + model.source,
        target: model.base + model.target,
        clean: model.base + model.clean,
        cells: cells
      };
    });
    return freezeSnapshot({ percent: recordedPercent, rows: rows });
  }

  function resolveExperiment(data, placement, percent) {
    if (!Number.isInteger(placement) || placement < 1 || placement > 3) {
      throw new RangeError('Training placement must be an integer from 1 to 3.');
    }
    var matrix = resolveMatrix(data, percent);
    var row = matrix.rows[placement - 1];
    return freezeSnapshot({
      percent: matrix.percent,
      placement: row.placement,
      source: row.source,
      target: row.target,
      clean: row.clean,
      cells: row.cells
    });
  }

  return Object.freeze({ resolveF1: resolveF1, resolveMatrix: resolveMatrix, resolveExperiment: resolveExperiment });
}));
