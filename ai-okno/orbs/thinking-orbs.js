/*!
 * thinking-orbs: ванильный перенос без сборки (один файл, без зависимостей, без сети).
 *
 * Источник : https://github.com/Jakubantalik/thinking-orbs (v0.3.1, коммит de85557ca220, ветка main на 16.08.2026)
 * Автор    : Jakub Antalik
 * Лицензия : MIT, Copyright (c) 2026 Jakub Antalik. Полный текст в файле LICENSE рядом с этим файлом.
 *            Уведомление об авторстве и текст лицензии обязаны сопровождать любые копии и производные.
 *
 * Что перенесено: вся геометрия девяти состояний (orbits, globe, rubik, wave, web, braid, ribbon, ring, morph),
 * пресеты 64 и 20, общие часы, пауза вне экрана и на скрытой вкладке, статичный кадр при reduced-motion.
 * Математика переписана с TypeScript на JavaScript построчно, без изменения формул; проверена на
 * совпадение с эталонными векторами автора (spec/orbs-golden.json, допуск 1e-4), см. scripts/verify-golden.cjs.
 *
 * Что изменено относительно оригинала (правки Housebook):
 *  1. Палитры. Оригинал монохромный (серый ink от белого к чёрному). Здесь цвет задаётся парой near/far и
 *     может быть любым; палитра "original" воспроизводит оригинал побайтно.
 *  2. Поле acc (0..1) у точки: где оригинал рисует активный элемент темнее (метка сканирования globe, активная
 *     полоса rubik, импульсы web), мы подмешиваем акцентный цвет палитры. Геометрия от этого не меняется.
 *  3. Режим "big": тот же рисунок крупнее (точки растут линейно, а не как size^0.6), для витрины.
 *  4. Один общий цикл requestAnimationFrame на все холсты вместо цикла на каждый холст.
 *
 * API: window.ThinkingOrbs = { STATES, PALETTES, resolvePreset, resolveBig, MODE_FRAMES, frameFor, mount, paintFrame,
 *                              setPaused, isPaused, reducedMotion }
 */
(function (global) {
  'use strict';

  /* ---------- ядро: общие примитивы ---------- */

  function lerp(a, b, f) { return a + (b - a) * f; }
  function frac(x) { return x - Math.floor(x); }
  function hashD(a, b) {
    var h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var a = hashD(xi, yi), b = hashD(xi + 1, yi), c = hashD(xi, yi + 1), d = hashD(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fibDir(i, n) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    var y = 1 - (2 * (i + 0.5)) / n;
    var rad = Math.sqrt(1 - y * y);
    var a = i * golden;
    return [rad * Math.cos(a), y, rad * Math.sin(a)];
  }
  function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function makeProj(yaw, tilt, cx, cy, scale) {
    var st = Math.sin(tilt), ct = Math.cos(tilt), sy = Math.sin(yaw), cyw = Math.cos(yaw);
    return function (x, y, z) {
      var x1 = x * cyw + z * sy;
      var z1 = -x * sy + z * cyw;
      var y1 = y * ct - z1 * st;
      var z2 = y * st + z1 * ct;
      return [cx + x1 * scale, cy - y1 * scale, z2];
    };
  }
  function radiusScale(size, pow) { return Math.pow(size / 300, pow); }

  /* кадр: отбросить невидимое, поджать радиусы до пола, отсортировать от дальних к ближним */
  function finalizeFrame(dots, lines, rMin) {
    if (rMin === undefined) rMin = 0.3;
    var visible = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if ((d.a === undefined ? 1 : d.a) < 0.02) continue;
      d.r = Math.max(rMin, d.r);
      visible.push(d);
    }
    visible.sort(function (a, b) { return a.z - b.z; });
    return {
      dots: visible,
      lines: lines.filter(function (l) { return (l.a === undefined ? 1 : l.a) >= 0.02; })
    };
  }

  /* ---------- режим orbits: "working", частицы на наклонных орбитах ---------- */

  function frameOrbits(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.82;
    var pt = makeProj(t * 0.12, 0.3, cx, cy, 1);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var dots = [];
    var orbitN = o.orbitN === undefined ? 12 : o.orbitN;
    var ghostN = o.ghostN === undefined ? 40 : o.ghostN;
    var particles = o.particles === undefined ? 3 : o.particles;
    for (var orb = 0; orb < orbitN; orb++) {
      var h1 = hashD(orb, 1.7), h2 = hashD(orb, 5.2), h3 = hashD(orb, 8.9);
      var ro = R * (0.45 + 0.52 * h1);
      var th = h1 * 2 * Math.PI;
      var phi = Math.acos(2 * h2 - 1);
      var nx = Math.sin(phi) * Math.cos(th);
      var ny = Math.cos(phi);
      var nz = Math.sin(phi) * Math.sin(th);
      var ux = -ny, uy = nx, uz = 0;
      var ul = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
      ux /= ul; uy /= ul;
      var vx = ny * uz - nz * uy;
      var vy = nz * ux - nx * uz;
      var vz = nx * uy - ny * ux;
      var speed = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1);
      var k, a, p, depth;
      for (k = 0; k < ghostN; k++) {
        a = (k / ghostN) * 2 * Math.PI;
        p = pt(
          (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
          (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
          (uz * Math.cos(a) + vz * Math.sin(a)) * ro
        );
        depth = (p[2] / ro + 1) / 2;
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: (o.ghostR === undefined ? 0.9 : o.ghostR) * rs,
          white: 0.72,
          a: (o.ghostA === undefined ? 0.5 : o.ghostA) * (0.4 + 0.6 * depth)
        });
      }
      for (var m = 0; m < particles; m++) {
        a = t * speed + (m / particles) * 2 * Math.PI + h2 * 6;
        p = pt(
          (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
          (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
          (uz * Math.cos(a) + vz * Math.sin(a)) * ro
        );
        depth = (p[2] / ro + 1) / 2;
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: ((o.partR === undefined ? 1.2 : o.partR) + (o.partRDepth === undefined ? 1.6 : o.partRDepth) * depth) * rs,
          white: 0.3 - 0.22 * depth
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  /* ---------- режим braid: "weaving", три нити плетутся вокруг сферы ---------- */

  function frameBraid(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.76;
    var pt = makeProj(t * 0.4, 0.3, cx, cy, 1);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var dots = [];
    var ghostN = o.ghostN === undefined ? 150 : o.ghostN;
    var i, d, p, depth;
    for (i = 0; i < ghostN; i++) {
      d = fibDir(i, ghostN);
      p = pt(d[0] * R, d[1] * R, d[2] * R);
      depth = (p[2] / R + 1) / 2;
      dots.push({ x: p[0], y: p[1], z: p[2], r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
    }
    var strandN = o.strandN === undefined ? 52 : o.strandN;
    var turns = o.turns === undefined ? 3 : o.turns;
    for (var s = 0; s < 3; s++) {
      var phase = (s / 3) * 2 * Math.PI;
      for (i = 0; i < strandN; i++) {
        var u = (frac(i / strandN + t * 0.045) * 2 - 1) * 0.96;
        var surf = Math.sqrt(Math.max(0, 1 - u * u));
        var endFade = Math.min(1, (1 - Math.abs(u)) / 0.1);
        var a = u * Math.PI * turns + phase;
        var weave = 1 + 0.075 * Math.sin(u * Math.PI * turns * 2 + phase * 2 + t * 0.8);
        var rr = surf * R * weave;
        p = pt(Math.cos(a) * rr, u * R * weave, Math.sin(a) * rr);
        depth = (p[2] / R + 1) / 2;
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: ((o.rBase === undefined ? 1.2 : o.rBase) + (o.rDepth === undefined ? 1.8 : o.rDepth) * depth) * rs,
          white: 0.55 - 0.45 * depth,
          a: endFade * (0.45 + 0.55 * depth)
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  /* ---------- сферические решётки: globe ("searching"), rubik ("solving"), wave ("listening") ---------- */

  function solveCycle(time, count, slotDur, rest) {
    var cyc = 2 * count * slotDur + rest;
    var tc = time % cyc;
    var amount = [];
    for (var z = 0; z < count; z++) amount.push(0);
    var active = -1;
    if (tc < 2 * count * slotDur) {
      var slot = Math.floor(tc / slotDur);
      var p = (tc - slot * slotDur) / slotDur;
      var cl = Math.min(1, p / 0.7);
      var ep = 1 - Math.pow(1 - cl, 3);
      var i;
      if (slot < count) {
        for (i = 0; i < slot; i++) amount[i] = 1;
        amount[slot] = ep;
        active = slot;
      } else {
        var u = 2 * count - 1 - slot;
        for (i = 0; i < u; i++) amount[i] = 1;
        amount[u] = 1 - ep;
        active = u;
      }
    }
    return { amount: amount, active: active };
  }

  function applyMoves(pt3, moves, sc) {
    var x = pt3[0], y = pt3[1], z = pt3[2];
    var inActive = false;
    for (var i = 0; i < moves.length; i++) {
      if (sc.amount[i] <= 0) continue;
      var mv = moves[i];
      var coord = mv.axis === 0 ? x : mv.axis === 1 ? y : z;
      if (coord < mv.lo || coord >= mv.hi) continue;
      if (i === sc.active) inActive = true;
      var a = mv.ang * sc.amount[i];
      var ca = Math.cos(a), sa = Math.sin(a);
      if (mv.axis === 0) {
        var y2 = y * ca - z * sa;
        z = y * sa + z * ca;
        y = y2;
      } else if (mv.axis === 1) {
        var x2 = x * ca + z * sa;
        z = -x * sa + z * ca;
        x = x2;
      } else {
        var x3 = x * ca - y * sa;
        y = x * sa + y * ca;
        x = x3;
      }
    }
    return [x, y, z, inActive];
  }

  function makeMoves(count) {
    var moves = [];
    for (var i = 0; i < count; i++) {
      var axis = Math.min(2, Math.floor(hashD(i, 2.3) * 3));
      var lo = -1.0 + 0.5 * Math.min(3, Math.floor(hashD(i, 5.9) * 4));
      var dir = hashD(i, 7.7) < 0.5 ? 1 : -1;
      moves.push({ axis: axis, lo: lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
    }
    return moves;
  }

  function frameGlobe(size, t, o) {
    var spin = 0.5;
    var cx = size / 2, cy = size / 2;
    var radius = (size / 2) * 0.82;
    var tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
    var pt = makeProj(t * spin, tilt, cx, cy, radius);
    var scan = t * (spin + (1.7 - spin) * (o.scanMul === undefined ? 1 : o.scanMul));
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var dimBase = o.dimBase === undefined ? 1 : o.dimBase;
    var dots = [];
    var latRings = o.latRings === undefined ? 17 : o.latRings;
    var lonDensity = o.lonDensity === undefined ? 44 : o.lonDensity;
    for (var li = 0; li <= latRings; li++) {
      var lat = -Math.PI / 2 + (li / latRings) * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (var lj = 0; lj < lonCount; lj++) {
        var lon = (lj / lonCount) * 2 * Math.PI;
        var p = pt(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
        var z = p[2];
        var depth = (z + 1) / 2;
        var d = angleDelta(lon + t * spin, scan);
        var boost = Math.exp(-(d * d) / 0.18) * Math.max(0, z);
        dots.push({
          x: p[0], y: p[1], z: z,
          r: ((o.rBase === undefined ? 0.6 : o.rBase) + (o.rDepth === undefined ? 1.7 : o.rDepth) * depth + (o.rBoost === undefined ? 1 : o.rBoost) * boost) * rs,
          white: (o.inkFar === undefined ? 0.62 : o.inkFar) - (o.inkSpan === undefined ? 0.54 : o.inkSpan) * depth,
          a: dimBase + (1 - dimBase) * Math.min(1, boost),
          acc: Math.min(1, Math.max(0, (boost - 0.1) * 2.2)) /* правка Housebook: метка сканирования подкрашивается акцентом */
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  function frameRubik(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.82;
    var pt = makeProj(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, R);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var moveCount = o.moveCount === undefined ? 14 : o.moveCount;
    var moves = makeMoves(moveCount);
    var sc = solveCycle(t, moveCount, 0.42, 1.2);
    var dots = [];
    var latRings = o.latRings === undefined ? 15 : o.latRings;
    var lonDensity = o.lonDensity === undefined ? 40 : o.lonDensity;
    for (var li = 0; li <= latRings; li++) {
      var lat = -Math.PI / 2 + (li / latRings) * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (var lj = 0; lj < lonCount; lj++) {
        var lon = (lj / lonCount) * 2 * Math.PI;
        var m = applyMoves([cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)], moves, sc);
        var inActive = m[3];
        var p = pt(m[0], m[1], m[2]);
        var depth = (p[2] + 1) / 2;
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: ((o.rBase === undefined ? 0.6 : o.rBase) + (o.rDepth === undefined ? 1.7 : o.rDepth) * depth + (inActive ? (o.rActive === undefined ? 0.3 : o.rActive) : 0)) * rs,
          white: (o.inkFar === undefined ? 0.62 : o.inkFar) - (o.inkSpan === undefined ? 0.54 : o.inkSpan) * depth - (inActive ? 0.14 : 0),
          acc: inActive ? 1 : 0 /* правка Housebook: активная полоса, "рука", получает акцент */
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  function frameWave(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.874;
    var pt = makeProj(t * 0.18, 0.38, cx, cy, 1);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var dots = [];
    var rings = o.rings === undefined ? 15 : o.rings;
    var lonDensity = o.lonDensity === undefined ? 40 : o.lonDensity;
    for (var ri = 0; ri <= rings; ri++) {
      var lat = -Math.PI / 2 + (ri / rings) * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var w = 0.62 * Math.sin(t * 2.1 - ri * 0.52) + 0.38 * Math.sin(t * 1.27 + ri * 0.83);
      var rr = R * (0.88 + 0.105 * w);
      var lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (var lj = 0; lj < lonCount; lj++) {
        var lon = (lj / lonCount) * 2 * Math.PI;
        var p = pt(cosLat * Math.cos(lon) * rr, sinLat * rr, cosLat * Math.sin(lon) * rr);
        var depth = (p[2] / R + 1) / 2;
        var crest = Math.max(0, w);
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: ((o.rBase === undefined ? 0.6 : o.rBase) + (o.rDepth === undefined ? 1.7 : o.rDepth) * depth) * (1 + 0.4 * crest) * rs,
          white: 0.66 - 0.56 * depth - 0.1 * crest
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  /* ---------- режим web: "connecting", созвездие соединяется, по рёбрам бегут импульсы ---------- */

  function frameWeb(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.8 * (o.spread === undefined ? 1 : o.spread);
    var pt = makeProj(t * 0.12, 0.32, cx, cy, R);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var nodeN = o.nodeN === undefined ? 30 : o.nodeN;
    var thr = o.thr === undefined ? 0.72 : o.thr;
    var nodeR = o.nodeR === undefined ? 1.4 : o.nodeR;
    var nodeRDepth = o.nodeRDepth === undefined ? 1.8 : o.nodeRDepth;
    var nodes = [];
    var i, j;
    for (i = 0; i < nodeN; i++) {
      var d = fibDir(i, nodeN);
      var x = d[0] + 0.3 * (vnoise(i * 0.31 + 9, t * 0.24) - 0.5) * 2;
      var y = d[1] + 0.3 * (vnoise(i * 0.53 + 27, t * 0.21) - 0.5) * 2;
      var z = d[2] + 0.3 * (vnoise(i * 0.77 + 55, t * 0.27) - 0.5) * 2;
      var l = Math.sqrt(x * x + y * y + z * z);
      nodes.push([x / l, y / l, z / l]);
    }
    var lines = [];
    var dots = [];
    for (i = 0; i < nodeN; i++) {
      for (j = i + 1; j < nodeN; j++) {
        var dx = nodes[i][0] - nodes[j][0];
        var dy = nodes[i][1] - nodes[j][1];
        var dz = nodes[i][2] - nodes[j][2];
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist >= thr) continue;
        var p1 = pt(nodes[i][0], nodes[i][1], nodes[i][2]);
        var p2 = pt(nodes[j][0], nodes[j][1], nodes[j][2]);
        var depth = ((p1[2] + p2[2]) / 2 + 1) / 2;
        lines.push({
          x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
          white: 0.42,
          a: (1 - dist / thr) * (0.3 + 0.55 * depth),
          w: Math.max(0.6, (o.lineW === undefined ? 0.8 : o.lineW) * rs)
        });
      }
    }
    for (i = 0; i < nodeN; i++) {
      var pp = pt(nodes[i][0], nodes[i][1], nodes[i][2]);
      var dep = (pp[2] + 1) / 2;
      var pulse = 1 + 0.25 * Math.sin(t * 1.4 + i * 2.7);
      dots.push({
        x: pp[0], y: pp[1], z: pp[2],
        r: (nodeR + nodeRDepth * dep) * pulse * rs,
        white: 0.55 - 0.45 * dep
      });
    }
    var signals = o.signals === undefined ? 5 : o.signals;
    for (var s = 0; s < signals; s++) {
      var seg = Math.floor(t * 0.55 + s * 7.31);
      var a = Math.floor(hashD(seg, s * 3.1 + 1.7) * nodeN);
      var b = Math.floor(hashD(seg, s * 5.7 + 4.2) * nodeN);
      if (a === b) continue;
      var f = frac(t * 0.55 + s * 7.31);
      var sx = lerp(nodes[a][0], nodes[b][0], f);
      var sy = lerp(nodes[a][1], nodes[b][1], f);
      var sz = lerp(nodes[a][2], nodes[b][2], f);
      var sl = Math.max(1e-6, Math.sqrt(sx * sx + sy * sy + sz * sz));
      var q = pt(sx / sl, sy / sl, sz / sl);
      var qd = (q[2] + 1) / 2;
      dots.push({
        x: q[0], y: q[1], z: q[2],
        r: (nodeR * 1.5 + nodeRDepth * qd) * rs,
        white: 0.05,
        a: 0.5 + 0.5 * qd,
        acc: 1 /* правка Housebook: импульс, бегущий по ребру, получает акцент */
      });
    }
    return finalizeFrame(dots, lines, o.rMin);
  }

  /* ---------- режим ribbon / ring: "composing" (лента) и "breathing" (кольцо) ---------- */

  function frameRibbon(size, t, o) {
    var cx = size / 2, cy = size / 2;
    var R = (size / 2) * 0.78;
    var spin = o.spin === undefined ? 1 : o.spin;
    var camTilt = 0.3;
    var pt = makeProj(t * 0.1 * spin, camTilt, cx, cy, 1);
    var rs = radiusScale(size, o.rsPow === undefined ? 0.6 : o.rsPow);
    var dots = [];
    var ghostN = o.ghostN === undefined ? 150 : o.ghostN;
    var i, d, p, depth;
    for (i = 0; i < ghostN; i++) {
      d = fibDir(i, ghostN);
      p = pt(d[0] * R, d[1] * R, d[2] * R);
      depth = (p[2] / R + 1) / 2;
      dots.push({ x: p[0], y: p[1], z: p[2], r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
    }
    var ya = t * 0.24 * spin;
    var ta = o.faceOn ? -camTilt : 0.55 + 0.3 * Math.sin(t * 0.18) * spin;
    var ux = Math.cos(ya), uy = 0, uz = Math.sin(ya);
    var vx = -uz * Math.sin(ta), vy = Math.cos(ta), vz = ux * Math.sin(ta);
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var wobAmp = 0.23 * (o.wobMul === undefined ? 1 : o.wobMul);
    var baseR = o.faceOn ? R / (1 + 0.85 * wobAmp) : R;
    var baseLanes = o.lanes === undefined ? 5 : o.lanes;
    var segs = o.segs === undefined ? 88 : o.segs;
    var lanes = Math.max(1, Math.round(baseLanes * (o.bandMul === undefined ? 1 : o.bandMul)));
    for (var w = 0; w < lanes; w++) {
      var laneOff = (w - (lanes - 1) / 2) * 0.075;
      var edge = Math.abs(w - (lanes - 1) / 2) / Math.max(1, (lanes - 1) / 2);
      for (var k = 0; k < segs; k++) {
        var a = (k / segs) * 2 * Math.PI;
        var wob = (0.16 * Math.sin(a * 3 - t * 1.7 + w * 0.22) + 0.07 * Math.sin(a * 5 + t * 1.1)) * (o.wobMul === undefined ? 1 : o.wobMul);
        var radial = o.faceOn ? 1 + wob : 1;
        var off = o.faceOn ? laneOff : laneOff + wob;
        var x = ux * Math.cos(a) + vx * Math.sin(a) + nx * off;
        var y = uy * Math.cos(a) + vy * Math.sin(a) + ny * off;
        var z = uz * Math.cos(a) + vz * Math.sin(a) + nz * off;
        var l = Math.sqrt(x * x + y * y + z * z);
        var rr = baseR * radial;
        var q = pt((x / l) * rr, (y / l) * rr, (z / l) * rr);
        var dd = (q[2] / R + 1) / 2;
        dots.push({
          x: q[0], y: q[1], z: q[2],
          r: ((o.rBase === undefined ? 1.1 : o.rBase) + (o.rDepth === undefined ? 1.7 : o.rDepth) * dd) * (1 - 0.25 * edge) * rs,
          white: 0.52 - 0.44 * dd + 0.18 * edge,
          a: 0.4 + 0.6 * dd
        });
      }
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  /* ---------- режим morph: "shaping", точечный контур круг, треугольник, квадрат ---------- */

  function smoothE(x) { return x * x * (3 - 2 * x); }

  function polyPath(verts) {
    var V = verts.length;
    var L = [];
    var total = 0;
    for (var i = 0; i < V; i++) {
      var a = verts[i], b = verts[(i + 1) % V];
      var l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      L.push(l);
      total += l;
    }
    return function (f) {
      var target = f * total;
      var i2 = 0;
      while (target > L[i2] && i2 < V - 1) { target -= L[i2]; i2++; }
      var a2 = verts[i2], b2 = verts[(i2 + 1) % V];
      var ff = L[i2] ? Math.min(1, target / L[i2]) : 0;
      return [a2[0] + (b2[0] - a2[0]) * ff, a2[1] + (b2[1] - a2[1]) * ff];
    };
  }

  var CIRCLE = function (f) {
    var a = -Math.PI / 2 + f * 2 * Math.PI;
    return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
  };
  var TRIANGLE = polyPath([[0.0, -0.26], [0.24, 0.16], [-0.24, 0.16]]);
  var SQUARE = polyPath([[0, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]]);
  var CYCLE = [CIRCLE, TRIANGLE, SQUARE];
  var HOLD = 1.4, MORPH = 0.9, SEG = HOLD + MORPH;

  function morphN(d) { return Math.max(6, Math.round(34 * d)); }

  function frameMorph(size, t, o) {
    var K = CYCLE.length;
    var tc = t % (SEG * K);
    var k = Math.floor(tc / SEG);
    var local = tc - k * SEG;
    var m = local > HOLD ? smoothE((local - HOLD) / MORPH) : 0;
    var sprd = o.spread === undefined ? 1 : o.spread;
    var pA = CYCLE[k], pB = CYCLE[(k + 1) % K];
    var M = 160;
    var pts = [];
    var i;
    for (i = 0; i < M; i++) {
      var f = i / M;
      var a = pA(f), b = pB(f);
      pts.push([(a[0] + (b[0] - a[0]) * m) * sprd, (a[1] + (b[1] - a[1]) * m) * sprd]);
    }
    var L = [];
    var total = 0;
    for (i = 0; i < M; i++) {
      var a1 = pts[i], b1 = pts[(i + 1) % M];
      var l = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
      L.push(l);
      total += l;
    }
    var n = morphN(o.iconD === undefined ? 1 : o.iconD);
    var re = (o.rDot === undefined ? 0.021 : o.rDot) * 1.35 * sprd;
    var pulse = 1 + 0.02 * Math.sin(local * 3.1);
    var dots = [];
    var c2 = size / 2;
    var seg = 0, acc = 0;
    for (var k2 = 0; k2 < n; k2++) {
      var target = (k2 / n) * total;
      while (acc + L[seg] < target && seg < M - 1) { acc += L[seg]; seg++; }
      var pa = pts[seg], pb = pts[(seg + 1) % M];
      var ff = L[seg] ? Math.min(1, (target - acc) / L[seg]) : 0;
      var x = (pa[0] + (pb[0] - pa[0]) * ff) * pulse;
      var y = (pa[1] + (pb[1] - pa[1]) * ff) * pulse;
      dots.push({ x: c2 + x * size, y: c2 + y * size, z: 0, r: Math.max(0.35, re * size), white: 0.1 });
    }
    return finalizeFrame(dots, [], o.rMin);
  }

  var MODE_FRAMES = {
    orbits: frameOrbits, globe: frameGlobe, rubik: frameRubik, wave: frameWave, web: frameWeb,
    braid: frameBraid, ribbon: frameRibbon, ring: frameRibbon, morph: frameMorph
  };

  /* ---------- плотности и пресеты ---------- */

  var COUNT_PAIRS = [['latRings', 'lonDensity'], ['rings', 'lonDensity'], ['lanes', 'segs']];
  var COUNT_KEYS = ['orbitN', 'ghostN', 'nodeN', 'strandN', 'signals'];
  var RADIUS_KEYS = ['rBase', 'rDepth', 'rActive', 'rDot', 'ghostR', 'partR', 'partRDepth', 'nodeR', 'nodeRDepth'];

  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  function scaleCounts(opts, scale) {
    var out = copy(opts);
    var done = {};
    var rt = Math.sqrt(scale);
    COUNT_PAIRS.forEach(function (pr) {
      var a = pr[0], b = pr[1];
      var va = out[a], vb = out[b];
      if (va != null && vb != null && !done[a] && !done[b]) {
        out[a] = Math.max(2, Math.round(va * rt));
        out[b] = Math.max(2, Math.round(vb * rt));
        done[a] = true; done[b] = true;
      }
    });
    COUNT_KEYS.forEach(function (k) {
      var v = out[k];
      if (v != null && v !== 0 && !done[k]) out[k] = Math.max(1, Math.round(v * scale));
    });
    if (out.iconD != null) out.iconD = Math.max(0.02, out.iconD * scale);
    return out;
  }

  function scaleRadii(opts, scale) {
    var out = copy(opts);
    RADIUS_KEYS.forEach(function (k) { if (out[k] != null) out[k] = out[k] * scale; });
    out.rSizeMul = (out.rSizeMul === undefined ? 1 : out.rSizeMul) * scale;
    return out;
  }

  var BASE_PROFILES = {
    globe: { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1.0, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3, partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 },
    rubik: { latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7, rActive: 0.3, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    web: { nodeN: 30, thr: 0.72, signals: 5, nodeR: 1.4, nodeRDepth: 1.8, lineW: 0.8, rsPow: 0.6, rMin: 0.3 },
    braid: { strandN: 52, turns: 3.0, ghostN: 150, rBase: 1.2, rDepth: 1.8, rsPow: 0.6, rMin: 0.3 },
    ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    ring: { lanes: 5, segs: 88, ghostN: 0, faceOn: 1, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    morph: { rDot: 0.021, iconD: 1, rMin: 0.25 }
  };

  var STATE_TO_MODE = {
    working: 'orbits', searching: 'globe', solving: 'rubik', listening: 'wave', connecting: 'web',
    weaving: 'braid', composing: 'ribbon', breathing: 'ring', shaping: 'morph'
  };
  var STATES = ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing', 'shaping'];

  var PRESETS = {
    orbits: { 64: { speed: 1.885, count: 1, size: 1 }, 20: { speed: 3.9, count: 0.238, size: 2.4 } },
    globe: {
      64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
      20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } }
    },
    rubik: { 64: { speed: 1.82, count: 0.35, size: 1.05 }, 20: { speed: 1.95, count: 0.088, size: 1.9 } },
    wave: { 64: { speed: 4.388, count: 0.341, size: 1 }, 20: { speed: 3.998, count: 0.105, size: 1.6 } },
    web: { 64: { speed: 3.315, count: 1.35, size: 0.95 }, 20: { speed: 6.63, count: 0.25, size: 1.52 } },
    braid: { 64: { speed: 1.625, count: 0.5, size: 1 }, 20: { speed: 2.75, count: 0.1125, size: 1.36 } },
    ribbon: {
      64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
      20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } }
    },
    ring: {
      64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
      20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } }
    },
    morph: {
      64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
      20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } }
    }
  };

  var cache = {};
  function resolvePreset(state, size) {
    var key = state + '-' + size;
    if (cache[key]) return cache[key];
    var mode = STATE_TO_MODE[state];
    var preset = PRESETS[mode][size];
    var opts = copy(BASE_PROFILES[mode]);
    if (preset.count !== 1) opts = scaleCounts(opts, preset.count);
    if (preset.size !== 1) opts = scaleRadii(opts, preset.size);
    if (preset.extra) { var ex = preset.extra; for (var k in ex) opts[k] = ex[k]; }
    var resolved = { mode: mode, speed: preset.speed, opts: opts };
    cache[key] = resolved;
    return resolved;
  }

  /* Крупная версия (правка Housebook): пресет 64, тот же рисунок крупнее. Радиусы точек растут линейно
     с размером (в оригинале size^0.6), поэтому множитель (px/64)^0.4 к радиусам; число точек то же. */
  var bigCache = {};
  function resolveBig(state, px) {
    var key = state + '@' + px;
    if (bigCache[key]) return bigCache[key];
    var base = resolvePreset(state, 64);
    var opts = base.opts;
    if (base.mode !== 'morph') {
      var mul = Math.pow(px / 64, 0.4);
      opts = scaleRadii(opts, mul);
      if (opts.lineW != null) opts.lineW = opts.lineW * mul;
    }
    var resolved = { mode: base.mode, speed: base.speed, opts: opts };
    bigCache[key] = resolved;
    return resolved;
  }

  function frameFor(state, size, t) {
    var r = resolvePreset(state, size);
    return MODE_FRAMES[r.mode](size, t * 1, r.opts);
  }

  /* ---------- палитры ---------- */

  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  /* цвет точки = смесь far и near по k = 1 - white (white 0 это ближняя, самая насыщенная точка).
     "original" и "originalLight" дают ровно серые тона оригинала: на тёмной подложке (1 - white) * 255,
     на светлой white * 255. acc подмешивает акцентную пару accNear/accFar. */
  var PALETTES = {
    original: { near: [255, 255, 255], far: [0, 0, 0], accNear: null, accFar: null },
    originalLight: { near: [0, 0, 0], far: [255, 255, 255], accNear: null, accFar: null },
    /* Housebook, светлая тема: нефрит-ховер #0B5533 к смеси jade2 #267953 и мяты #73B28C (#4C9670), акцент жёлтый бренда (#E6B422 и его тени) */
    housebook: { near: hex('#0B5533'), far: hex('#4C9670'), accNear: hex('#C99A14'), accFar: hex('#F5DE96') },
    /* Housebook, "Сумерки": на тёмном ближние точки светлее; жёлтый не меняется */
    housebookDusk: { near: hex('#DAF1DC'), far: hex('#267953'), accNear: hex('#F5DE96'), accFar: hex('#B38A14') }
  };

  function mix(far, near, k) {
    return [far[0] + (near[0] - far[0]) * k, far[1] + (near[1] - far[1]) * k, far[2] + (near[2] - far[2]) * k];
  }
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function inkRGB(pal, white, acc) {
    var k = 1 - clamp01(white);
    var c = mix(pal.far, pal.near, k);
    if (acc && pal.accNear) {
      var ac = mix(pal.accFar, pal.accNear, k);
      c = mix(c, ac, clamp01(acc));
    }
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',';
  }

  function paintFrame(ctx, frame, pal) {
    var i, l, d;
    for (i = 0; i < frame.lines.length; i++) {
      l = frame.lines[i];
      ctx.strokeStyle = inkRGB(pal, l.white, 0) + (l.a === undefined ? 1 : l.a) + ')';
      ctx.lineWidth = l.w;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    for (i = 0; i < frame.dots.length; i++) {
      d = frame.dots[i];
      ctx.fillStyle = inkRGB(pal, d.white, d.acc) + (d.a === undefined ? 1 : d.a) + ')';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- монтирование: общий цикл, пауза вне экрана и на скрытой вкладке, reduced-motion ---------- */

  var rmq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(rmq && rmq.matches); }

  var instances = [];
  var userPaused = false;
  var raf = 0;

  function anyActive() {
    if (userPaused || reducedMotion() || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return false;
    for (var i = 0; i < instances.length; i++) if (instances[i].visible) return true;
    return false;
  }
  function tick() {
    raf = 0;
    if (!anyActive()) return;
    var now = performance.now() / 1000;
    for (var i = 0; i < instances.length; i++) if (instances[i].visible) instances[i].draw(now);
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && anyActive()) raf = requestAnimationFrame(tick); }

  function redrawAll() {
    var now = performance.now() / 1000;
    for (var i = 0; i < instances.length; i++) instances[i].draw(now);
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', kick);
  if (rmq) {
    var onRm = function () { redrawAll(); kick(); };
    if (rmq.addEventListener) rmq.addEventListener('change', onRm); else if (rmq.addListener) rmq.addListener(onRm);
  }

  function setPaused(v) { userPaused = !!v; if (!userPaused) kick(); }
  function isPaused() { return userPaused; }

  /* mount(canvas, { state, size: 64|20, big: <px>, palette: <имя> }) */
  function mount(canvas, cfg) {
    var state = cfg.state;
    var big = cfg.big || 0;
    var css = big || cfg.size || 64;
    var res = big ? resolveBig(state, big) : resolvePreset(state, cfg.size || 64);
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    canvas.style.width = css + 'px';
    canvas.style.height = css + 'px';
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');
    var inst = {
      canvas: canvas,
      visible: typeof IntersectionObserver === 'undefined',
      palette: PALETTES[cfg.palette || 'housebook'],
      lastMs: 0,
      draw: function (nowSec) {
        var t0 = performance.now();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, css, css);
        /* статичный кадр при reduced-motion: фиксированный момент 0.6, как в оригинале */
        var t = reducedMotion() ? 0.6 : nowSec * res.speed;
        paintFrame(ctx, MODE_FRAMES[res.mode](css, t, res.opts), inst.palette);
        inst.lastMs = performance.now() - t0;
      }
    };
    instances.push(inst);
    inst.draw(performance.now() / 1000);
    var io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (entries) {
        inst.visible = entries[entries.length - 1].isIntersecting;
        if (inst.visible) { inst.draw(performance.now() / 1000); kick(); }
      });
      io.observe(canvas);
    } else {
      kick();
    }
    return {
      setPalette: function (name) { inst.palette = PALETTES[name]; inst.draw(performance.now() / 1000); },
      stats: function () { return { dots: MODE_FRAMES[res.mode](css, 0.6, res.opts).dots.length, lastMs: inst.lastMs }; },
      destroy: function () {
        var i = instances.indexOf(inst);
        if (i >= 0) instances.splice(i, 1);
        if (io) io.disconnect();
      }
    };
  }

  var api = {
    STATES: STATES, STATE_TO_MODE: STATE_TO_MODE, PALETTES: PALETTES,
    resolvePreset: resolvePreset, resolveBig: resolveBig, MODE_FRAMES: MODE_FRAMES, frameFor: frameFor,
    mount: mount, paintFrame: paintFrame, setPaused: setPaused, isPaused: isPaused, reducedMotion: reducedMotion
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ThinkingOrbs = api;
})(typeof window !== 'undefined' ? window : globalThis);
