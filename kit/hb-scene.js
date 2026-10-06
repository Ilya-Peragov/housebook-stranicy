/* Housebook kit: hb-scene.js. 3D-блоки страницы на three.js r128 (глобальный THREE с cdnjs; если его нет, файл подгружает r128 сам).
   Один WebGL-контекст на страницу: каждый блок рисуется в угол закадрового холста (viewport и scissor) и в той же задаче копируется в 2D-холст блока.
   Три типа блоков (разметка и атрибуты в README):
     a) планета      [data-globe]    data-aim="lat,lon" data-pins="all|uae,thailand" data-markets="all|none|dubai,phuket" data-place="right" data-pin-href="url"
     b) объект       [data-object="tower|villa"] data-floors="9" data-floor="0" data-interactive data-floor-slider
     c) башни-столбики [data-bars='[{"label":"Дубай","v":5375}]'] data-prefix="$" data-suffix="&nbsp;м²"; поле "tip" у значения заменяет подсказку при наведении
   Задники .bg3d и кровли [data-roofs] сцена не рисует: это плоские паттерны CSS (решения владельца 06-07.10.2026).
   Деградация: Save-Data, телефон (сенсор, до 899 px) или слабый ПК (до 4 ГБ памяти или до 4 ядер) -> html.no-3d, картинки вместо 3D, three.js не грузится; нет WebGL или ошибка -> html.no-webgl и window.__sceneErr; в обоих случаях CSS показывает паттерн брендбука.
   prefers-reduced-motion: один статичный кадр, перерисовка только по делу (тема, размер, жест). Живые блоки не чаще 30 кадров в секунду,
   рисуются только в кадре, пауза при скрытой вкладке; pixelRatio не больше 1,5. Палитра читается из CSS-токенов hb.css; на тёмной теме акцент сцены мятой. */
(() => {
'use strict';
const root = document.documentElement;
// [data-roofs] больше не рисуется в 3D (решение владельца 06.10.2026): блок показывает плоский паттерн «Кровли» средствами CSS
// задники-улицы .bg3d с 07.10.2026 плоский паттерн CSS (решение владельца), сцена их не трогает; 2D-график .chart[data-bars] рисует hb-ui.js
const SEL = '[data-globe], [data-object], .hb3d[data-bars]';
const els = [...document.querySelectorAll(SEL)];
if (!els.length) return;

// столбики: список значений строится до проверки WebGL; при живой сцене он для скринридера, без WebGL виден вместо башен
const fmt = v => Number(v).toLocaleString('ru-RU').replace(/\s/g, ' ');
const barsData = el => { try { const a = JSON.parse(el.dataset.bars); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const barText = (el, d) => d.t || (el.dataset.prefix || '') + fmt(d.v) + (el.dataset.suffix || '');
// подсказки при наведении (window.hbTip из hb-ui.js): у столбика его поле tip или подпись и значение, у страны число проектов и рынок
const plural = (n, f1, f2, f5) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? f5 : k === 1 ? f1 : k > 1 && k < 5 ? f2 : f5; };
const barTip = (el, data, i) => data[i].tip || `${data[i].label}\n${barText(el, data[i])}`;
const pinTip = p => { const n = +p.c.n || 0; return `${p.c.name}\n${p.c.n} ${plural(n, 'проект', 'проекта', 'проектов')} в каталоге` + (p.market ? `\nРынок с медианой цены: ${p.market.city}` : ''); };
for (const el of document.querySelectorAll('.hb3d[data-bars]')) if (!el.querySelector('.hb3d__list')) {
  const ul = document.createElement('ul'); ul.className = 'hb3d__list bars3d-list';
  const data = barsData(el); data.forEach((d, i) => { const li = document.createElement('li'), s = document.createElement('span'), b = document.createElement('b'); s.textContent = d.label; b.textContent = barText(el, d); li.dataset.tip = barTip(el, data, i); li.append(s, b); ul.appendChild(li); });
  el.appendChild(ul);
}

let stopped = false;
const fail = (why, cls = 'no-webgl') => { stopped = true; window.__sceneErr = why; root.classList.add(cls); for (const el of els) el.classList.remove('is-live'); };
const conn = navigator.connection;
if (conn && conn.saveData) { fail('save-data', 'no-3d'); return; }
// слабое устройство -> картинки вместо 3D, three.js не грузится вовсе; ?3d=1 и ?3d=0 переключают вручную для проверки
const force = new URLSearchParams(location.search).get('3d');
const phone = matchMedia('(pointer: coarse)').matches && innerWidth < 900;
const weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
if (force === '0' || (force !== '1' && (phone || weak))) { fail(phone ? 'phone' : force === '0' ? 'forced' : 'weak-device', 'no-3d'); return; }
try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) throw new Error('webgl-unavailable'); const lx = gl.getExtension('WEBGL_lose_context'); if (lx) lx.loseContext(); }
catch (e) { fail('webgl-unavailable'); return; }
const boot = () => { try { start(); } catch (e) { fail('init: ' + (e && e.message || e)); } };
if (window.THREE) boot();
else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = () => window.THREE ? boot() : fail('three-missing'); s.onerror = () => fail('three-load'); document.head.appendChild(s); }

function start() {
if (!THREE.REVISION || THREE.REVISION !== '128') console.info('hb-scene: ожидается three.js r128, загружена r' + THREE.REVISION);
// ---------- палитра из CSS-токенов: дневные значения и мята тёмной темы ----------
const hadDusk = root.classList.contains('dusk'), theme = root.getAttribute('data-theme');
root.classList.remove('dusk'); root.removeAttribute('data-theme');
const hex = (cs, n, d) => { const v = parseInt(cs.getPropertyValue(n).trim().replace('#', ''), 16); return Number.isFinite(v) ? v : d; };
let cs = getComputedStyle(root);
const V = { page: hex(cs, '--page', 0xF3F8FC), paper: hex(cs, '--paper', 0xFFFFFF), sunken: hex(cs, '--sunken', 0xEDF2F5), tint: hex(cs, '--tint', 0xDAF1DC), line: hex(cs, '--line', 0xE2E7EA), control: hex(cs, '--control', 0x7E8386), ink3: hex(cs, '--ink-3', 0x656A6D), ink2: hex(cs, '--ink-2', 0x4D5254), ink: hex(cs, '--ink', 0x121517), accent: hex(cs, '--accent', 0x00732D), jade: hex(cs, '--jade', 0x0E6A40) };
root.classList.add('dusk'); cs = getComputedStyle(root);
const MINT_HEX = hex(cs, '--accent', 0x73B28C), DARK_PAGE = hex(cs, '--page', 0x121517);
root.classList.toggle('dusk', hadDusk); if (theme !== null) root.setAttribute('data-theme', theme);
// в сцене accent2 это светлая зелень (окна вечером, вторая крона, камни дорожки): из цвета логотипа к подложке
V.accent2 = new THREE.Color(V.accent).lerp(new THREE.Color(V.tint), .22).getHex();
const MINT = new THREE.Color(MINT_HEX), A2N = new THREE.Color(MINT_HEX).lerp(new THREE.Color(V.tint), .22).getHex();
// брендбук: #00732D на тёмном не используется. Каждый материал цвета акцента записан в NL и к вечеру уходит в мяту
let NL = [], nightNow = 0;
const tmpC = new THREE.Color();
const nlc = (m, d, n) => { NL.push({ m, d, n }); m.color.setHex(d).lerp(tmpC.setHex(n), nightNow); return m; };
const ng = m => nlc(m, V.accent, MINT_HEX);
const autoN = m => { if (m && m.color) { const h = m.color.getHex(); if (h === V.accent) ng(m); else if (h === V.accent2) nlc(m, V.accent2, A2N); } return m; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = matchMedia('(max-width: 899px)').matches;
const live = !reduced && !isPhone; // живые блоки: не телефон и не reduced-motion

// ---------- один закадровый WebGL-холст ----------
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('context-lost'); });
const PR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(PR); renderer.setClearColor(0x000000, 0);
const EXP_DAY = .66, OBJ_EXP = .78; let expCity = EXP_DAY; renderer.toneMapping = THREE.LinearToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = isPhone ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(V.page, 60, 230);

// окружение для отражений: мягкое небо и две светлые «витрины», от них блики на стекле и на воде
const pmrem = new THREE.PMREMGenerator(renderer);
{ const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const pos = sky.geometry.attributes.position, col = []; const top = new THREE.Color(0xffffff), mid = new THREE.Color(V.page), low = new THREE.Color(V.control);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 20; const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(low, -y); col.push(c.r, c.g, c.b); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); env.add(sky);
  for (const [x, y, z, w, h] of [[-8, 9, -6, 9, 4], [10, 7, 4, 6, 6]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); }
  scene.environment = pmrem.fromScene(env, .04).texture; }

// свет: небо, солнце с тенью для города, вечерний режим гасит солнце и зажигает окна
const hemi = new THREE.HemisphereLight(0xffffff, 0xd9dfd9, .34); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, .32); sun.position.set(8, 12, 10); scene.add(sun);

// ---------- материалы и фасад (из главной v22) ----------
const wall = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .86, metalness: 0, envMapIntensity: .35, vertexColors: !!o.ao, transparent: (o.alpha ?? 1) < 1, opacity: o.alpha ?? 1, emissive: o.emissive ?? 0x000000 }); return autoN(o.plaster ? plaster(m) : m); };
const glassMat = () => new THREE.MeshStandardMaterial({ color: V.tint, roughness: .12, metalness: .55, envMapIntensity: 1.1 });
// шум для штукатурки и стекла внутри шейдеров: хеш и сглаженная решётка
// код инстанса фасада: r = стиль (+8: этаж .72 вместо .55), g = зерно, b = тон (+4: без двери)
const STYLE = { glass: 0, balcony: 1, bands: 2, ribbon: 3, plain: 4, blank: 5 }, TONE = { paper: 0, sunken: 1, page: 2, tint: 3 }, ic = new THREE.Color();
const wallCode = (style, tone, o = {}) => ic.setRGB((STYLE[style] + (o.tall ? 8 : 0)) / 16, rnd(), (TONE[tone] + (o.noDoor ? 4 : 0)) / 8);
// instanceColor создаём сами на полную ёмкость: setColorAt в r128 заводит буфер по текущему count, а он обнулён
const wallMesh = (n, mat = facade) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.count = 0; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; return m; };
const GLSL_NOISE = 'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); } float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }';
// штукатурка: лёгкий шум по мировым координатам, чтобы плоскость стены не читалась заливкой
function plaster(mat) { mat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\n vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;\n#else\n vWp = (modelMatrix * vec4(transformed, 1.)).xyz;\n#endif');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + GLSL_NOISE).replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.965 + 0.07 * (vn(vec2(vWp.x + vWp.z, vWp.y) * 14.) * .5 + vn(vec2(vWp.x - vWp.z, vWp.y) * 47.) * .5);'); };
  mat.customProgramCacheKey = () => 'hb-plaster'; return mat; }
// фасад квартала: один материал на все коробки. Цвет инстанса это данные: r стиль (0 витраж, 1 балконы, 2 ленты, 3 ленточные окна, 4 простые, 5 глухая), g зерно, b тон стены.
// Окна, рамы, витражные импосты, дверь, штукатурка, затемнение у земли и тёмная кровля считаются в шейдере по размерам коробки, на всех четырёх гранях.
const FU = { uTone: { value: [V.paper, V.sunken, V.page, V.tint].map(c => new THREE.Color(c)) }, uGlass: { value: new THREE.Color(V.tint) }, uFrame: { value: new THREE.Color(V.ink3) }, uDoor: { value: new THREE.Color(V.accent) }, uLit: { value: new THREE.Color(V.accent2) }, uRoof: { value: new THREE.Color(V.control) }, uNight: { value: 0 } };
// материал фасада можно размножить (у объекта свой на каждый этаж, чтобы этажи гасли по одному), униформы общие
function makeFacade() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .86, metalness: 0, envMapIntensity: .5 });
  m.userData.u = FU;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vN0; varying vec3 vDim;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vL = position; vN0 = normal;\n#ifdef USE_INSTANCING\n vDim = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));\n#else\n vDim = vec3(1.);\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vN0; varying vec3 vDim; uniform vec3 uTone[4]; uniform vec3 uGlass; uniform vec3 uFrame; uniform vec3 uDoor; uniform vec3 uLit; uniform vec3 uRoof; uniform float uNight;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', [
        ' float sr = floor(vColor.r * 16. + .5), tall = step(7.5, sr), style = sr - 8. * tall, FH = mix(.55, .72, tall), seed = vColor.g * 97.;',
        ' float tb = floor(vColor.b * 8. + .5), noDoor = step(3.5, tb), ti = tb - 4. * noDoor;',
        ' vec3 tone = ti < .5 ? uTone[0] : ti < 1.5 ? uTone[1] : ti < 2.5 ? uTone[2] : uTone[3];',
        ' vec3 P = vL * vDim; float H = vDim.y; float onX = step(.5, abs(vN0.x)); float W = mix(vDim.x, vDim.z, onX);',
        ' float u = mix(P.x, P.z, onX) + W * .5, h = P.y + H * .5; float side = 1. - step(.5, abs(vN0.y)); float top = step(.5, vN0.y);',
        ' float face = vN0.x * 2. + vN0.z * 3. + 7.;',
        ' float pn = vn(vec2(u, h) * 9. + seed) * .5 + vn(vec2(u, h) * 31. + seed * 2.) * .5;',
        ' vec3 col = tone * (0.9 + 0.07 * pn);',
        ' float fw = max(fwidth(u), fwidth(h)) * 1.2 + 1e-4;',
        ' float glassK = 0., frameK = 0., doorK = 0., sillK = 0., wid = 0., gy = .5;',
        ' if (side > .5 && style < 4.5) {',
        '  if (style < .5) {',
        '   float fl = h / FH, cl = u / .5; vec2 c = vec2(fract(cl), fract(fl));',
        '   float mull = 1. - smoothstep(.05 - fw * 2., .05 + fw * 2., min(c.x, 1. - c.x)); float tran = 1. - smoothstep(.055 - fw * 2., .055 + fw * 2., min(c.y, 1. - c.y));',
        '   float spand = 1. - smoothstep(.12, .14, c.y * FH); float fr = max(mull, tran);',
        '   wid = h21(vec2(floor(cl), floor(fl)) + seed + face); gy = c.y;',
        '   glassK = (1. - fr) * (1. - spand); frameK = fr; col = mix(col, tone * .9, spand * (1. - fr));',
        '  } else {',
        '   float ribbon = step(2.5, style) * step(style, 3.5); float pw = style < 1.5 ? .62 : .5; float cols = max(1., floor(W / pw));',
        '   float cell = .82 * W / cols; float ux = u - W * .09; float k = floor(ux / cell); float cx = (k + .5) * cell + W * .09;',
        '   float rows = floor((H - .1 + .2 * tall) / FH); float row = floor((h - .4 + FH * .5) / FH); float cy = .4 + row * FH;',
        '   float inCol = step(0., ux) * step(k, cols - .5); float inRow = step(0., row) * step(row, rows - .5);',
        '   float ww = ribbon > .5 ? .42 * W : (style < 1.5 ? .2 : .16), hh = ribbon > .5 ? .09 : .13;',
'   // витрина первого этажа на уличной грани каждого дома: окно ниже и шире, между витринами остаётся простенок, у ленточных на всю ленту',
'   float shop = step(.5, vN0.z) * (1. - step(.5, row)) * (1. - step(4.5, style)) * (1. - noDoor); ww = mix(ww, ribbon > .5 ? .42 * W : min(.23, cell * .5 - .045), shop); hh = mix(hh, .2, shop); cy = mix(cy, .33, shop);',
'   float ax = ribbon > .5 ? abs(u - W * .5) : abs(u - cx), ay = abs(h - cy);',
        '   float inner = (1. - smoothstep(ww - fw, ww + fw, ax)) * (1. - smoothstep(hh - fw, hh + fw, ay));',
        '   float outer = (1. - smoothstep(ww + .022 - fw, ww + .022 + fw, ax)) * (1. - smoothstep(hh + .022 - fw, hh + .022 + fw, ay));',
        '   float on = inRow * mix(inCol, 1., ribbon); glassK = inner * on; frameK = (outer - inner) * on;',
'   // подоконник: светлая полка под окном',
'   sillK = on * (1. - ribbon) * (1. - smoothstep(ww + .05, ww + .07, ax)) * step(cy - hh - .055, h) * step(h, cy - hh - .022);',
        '   wid = h21(vec2(k * (1. - ribbon), row) + seed + face); gy = clamp((h - cy) / (2. * hh) + .5, 0., 1.);',
        '   // дверь на фасаде к улице: одна ячейка первого ряда от земли до полуметра',
        '   float dk = floor(h21(vec2(seed, face)) * cols); float dx = abs(u - ((dk + .5) * cell + W * .09));',
        '   doorK = step(.5, vN0.z) * (1. - ribbon) * (1. - noDoor) * (1. - smoothstep(.13 - fw, .13 + fw, dx)) * (1. - smoothstep(.44 - fw, .44 + fw, h));',
        '   glassK *= 1. - doorK; frameK *= 1. - doorK;',
        '   // потёки под подоконниками',
        '   col *= 1. - .05 * on * (1. - smoothstep(0., .12, cy - hh - h)) * (1. - smoothstep(ww, ww + .06, ax)) * (1. - ribbon);',
        '  }',
        ' }',
        ' // стекло: отражение неба по Френелю, тёмная комната или светлая штора за ним, тень перемычки сверху',
        ' vec3 Vw = normalize((vec4(normalize(vViewPosition), 0.) * viewMatrix).xyz); vec3 R = reflect(-Vw, vN0); float fres = pow(1. - clamp(dot(Vw, vN0), 0., 1.), 3.);',
        ' vec3 sky = mix(uTone[2], vec3(1.), clamp(R.y * 1.4 + .2, 0., 1.)); vec3 room = mix(uGlass * .5, tone * .9, step(wid, .22));',
        ' vec3 gcol = mix(room, sky, .3 + .55 * fres) * (.88 + .2 * wid); gcol *= 1. - .3 * smoothstep(.55, 1., gy) * (1. - fres);',
        ' col = mix(col, gcol, glassK); col = mix(col, uFrame, frameK * .55); col = mix(col, uTone[0], sillK); col = mix(col, uDoor, doorK);',
        ' col *= 1. - .07 * side * (1. - smoothstep(0., .3, min(u, W - u)));',
        ' col *= mix(.74, 1., smoothstep(0., .5, h)) * (1. - .045 * top);',
        ' // кровля: серая посыпка, чуть светлее кромка у парапета',
        ' col = mix(col, mix(tone * .9, uRoof, .4 + .16 * pn) * (1. + .1 * (1. - smoothstep(0., .22, min(min(u, W - u), min(h, H - h))))), top * step(1.2, W));',
        ' diffuseColor.rgb = col;'].join('\n'))
      .replace('#include <roughnessmap_fragment>', ' float roughnessFactor = mix(.86, .2, glassK);')
      .replace('#include <metalnessmap_fragment>', ' float metalnessFactor = mix(0., .35, glassK);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n { vec3 tng = normalize(cross(vec3(0., 1., 0.), normal)); normal = normalize(normal + tng * (wid - .5) * .07 * glassK); }')
      .replace('#include <emissivemap_fragment>', ' totalEmissiveRadiance += uLit * glassK * uNight * step(.42, wid) * step(h21(vec2(seed, 3.)), .78) * .9;');
  };
  m.customProgramCacheKey = () => 'hb-facade';
  return m; }
const facade = makeFacade();
// затемнение к основанию: вершинный цвет коробки темнее у земли, объём читается без запечённого света
function aoColors(g, k = .8) { const p = g.attributes.position, c = []; let miny = 1e9, maxy = -1e9; for (let i = 0; i < p.count; i++) { miny = Math.min(miny, p.getY(i)); maxy = Math.max(maxy, p.getY(i)); }
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - miny) / Math.max(1e-6, maxy - miny); const v = lerp(k, 1, Math.sqrt(t)); c.push(v, v, v); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; }
function box(w, h, d, color, o = {}) {
  const g = o.ao === false ? new THREE.BoxGeometry(w, h, d) : aoColors(new THREE.BoxGeometry(w, h, d), o.ao ?? .8);
  const m = new THREE.Mesh(g, wall(color, { ao: o.ao !== false, alpha: o.alpha, emissive: o.emissive, rough: o.rough, plaster: o.plaster !== false }));
  m.userData.baseAlpha = o.alpha ?? 1;
  // кромки по умолчанию выключены: чернильные рёбра делали дома бумажной моделью, объём теперь даёт свет и штукатурка
  if (o.edges === true) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: o.edgeColor ?? V.ink, transparent: true, opacity: o.edgeAlpha ?? .22 })); e.userData.baseAlpha = o.edgeAlpha ?? .22; e.userData.edge = true; m.add(e); }
  m.castShadow = o.shadow !== false; m.receiveShadow = true;
  return m;
}
function mergeGeos(list) { const pos = [], nor = [], idx = []; let off = 0; for (const g of list) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } const ix = g.index; if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off); off += p.count; g.dispose(); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g; }
function slab(w, h, color, alpha, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, roughness: .95, envMapIntensity: .2, transparent: true, opacity: alpha, depthWrite: alpha >= 1 })); autoN(m.material); m.userData.baseAlpha = alpha; m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; }
function fade(group, a) { group.traverse(o => { if (o.material && o.material.opacity !== undefined && !o.userData.noFade) { o.material.transparent = true; o.material.opacity = (o.userData.baseAlpha ?? 1) * a; } }); group.visible = a > .01; }

// ---------- подписи-плашки поверх блока ----------
function callout(host, cls, href) {
  const el = document.createElement(href ? 'a' : 'div'); el.className = 'co' + (cls ? ' ' + cls : ''); if (href) { el.href = href; el.tabIndex = -1; } host.appendChild(el);
  const o = { el, on: false, box: null, at(v3, on, cam, opt = {}) {
    const v = v3.clone().project(cam); const vis = !!on && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    if (vis) { const W = host.clientWidth, Hh = host.clientHeight, half = el.offsetWidth / 2 + 8, ax = (v.x + 1) / 2 * W, stem = opt.stem ?? 16; let ay = (1 - v.y) / 2 * Hh, cx = clamp(ax, half, W - half);
      const minTop = opt.minTop ?? 8;
      if (ay - stem - el.offsetHeight < minTop) ay = minTop + stem + el.offsetHeight;
      // подпись не лезет под панель текста: сдвигается в сторону от панели, ножка остаётся на точке
      if (opt.avoid) { const sr = host.getBoundingClientRect(), top = ay - el.offsetHeight - stem;
        for (const pn of opt.avoid) { const r = pn.getBoundingClientRect(); const l = r.left - sr.left, rt = r.right - sr.left, t = r.top - sr.top, bt = r.bottom - sr.top; if (r.width && cx + half > l && cx - half < rt && ay > t && top < bt) cx = l > W / 2 ? Math.max(half, l - half) : Math.min(W - half, rt + half); } }
      el.style.left = cx + 'px'; el.style.top = ay + 'px'; el.style.setProperty('--px', clamp(ax - cx + el.offsetWidth / 2, 10, el.offsetWidth - 10) + 'px'); o.box = { cx, ay, w: el.offsetWidth, h: el.offsetHeight }; }
    if (vis !== o.on) { o.on = vis; el.classList.toggle('on', vis); } } };
  return o;
}
const setLabel = (o, name, val) => { o.el.textContent = name ? name + ' · ' : ''; const b = document.createElement('b'); b.textContent = val; o.el.appendChild(b); };

// ---------- планета ----------
const R = 3;
const globe = new THREE.Group(); scene.add(globe);
const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: V.paper, roughness: .9, metalness: 0, envMapIntensity: .25 })); sphere.receiveShadow = true; globe.add(sphere);
// кромка: чернила по краю шара, плотнее к горизонту; читается как атмосфера
const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 64), new THREE.ShaderMaterial({
  uniforms: { c: { value: new THREE.Color(V.accent) }, a: { value: .5 } }, transparent: true, depthWrite: false,
  vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 c; uniform float a; varying vec3 vN, vV; void main(){ float f = pow(1. - max(dot(normalize(vN), normalize(vV)), 0.), 2.6); gl_FragColor = vec4(c, f * a); }'
})); rim.userData.noFade = true; globe.add(rim);
const toV = (lat, lon, r) => { const ph = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };
// материки точечной картой: суша Natural Earth, сжатая сборщиком в серии по широтным рядам
const landPts = [];
LAND.rows.forEach((row, i) => { const lat = LAND.lat0 + i * LAND.step, n = row[0]; for (let k = 1; k < row.length; k += 2) for (let j = row[k]; j < row[k] + row[k + 1]; j++) { const v = toV(lat, -180 + (j + .5) * 360 / n, R * 1.006); landPts.push(v.x, v.y, v.z); } });
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill(); const t = new THREE.CanvasTexture(c); return t; })();
const landMat = new THREE.PointsMaterial({ color: V.accent, size: .09, map: dotTex, alphaMap: dotTex, transparent: true, opacity: .78, depthWrite: false, sizeAttenuation: true });
const land = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(landPts, 3)), landMat); land.userData.baseAlpha = .78; globe.add(land);
// градусная сетка, едва заметная
const gridMat = new THREE.LineBasicMaterial({ color: V.ink, transparent: true, opacity: .07 });
for (let lat = -60; lat <= 60; lat += 30) { const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push(toV(lat, lon, R * 1.001)); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat); l.userData.noFade = true; globe.add(l); }
for (let lon = -180; lon < 180; lon += 30) { const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(toV(lat, lon, R * 1.001)); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat); l.userData.noFade = true; globe.add(l); }
// одиннадцать стран: на шаре лежит знак бренда «u с крышей» (брендбук 29.09: кольцо «o» не используется), подпись с числом проектов ведёт на страницу страны
const pinsGroup = new THREE.Group(); globe.add(pinsGroup);
// текстура знака из путей брендбука: днём чаша чернилами и крыша цветом логотипа, вечером на тёмном шаре знак целиком белый
// v22: как метка рынка в брендбуке (patterns/gen.py pin): обводка цветом фона шириной 22 в единицах знака, поля 12 под неё
const markTex = (night, edge = true) => { const c = document.createElement('canvas'); c.width = 107; c.height = 151; const x = c.getContext('2d'); x.translate(12, 12); if (edge) { x.lineWidth = 22; x.lineJoin = 'round'; x.strokeStyle = night ? '#121517' : '#F3F8FC'; x.stroke(new Path2D(HB_MARK.bowl)); x.stroke(new Path2D(HB_MARK.roof)); } x.fillStyle = night ? '#FFFFFF' : '#121517'; x.fill(new Path2D(HB_MARK.bowl)); x.fillStyle = night ? '#FFFFFF' : '#00732D'; x.fill(new Path2D(HB_MARK.roof)); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
const markDay = markTex(false), markNight = markTex(true), echoDay = markTex(false, false), echoNight = markTex(true, false); // у знака-эха обводки нет, иначе он расползается серым пятном
// v22: знак стоит вместо точки страны: центр знака (41.5, 63.5 из 83x127) совпадает с центром плоскости и стоит на месте рынка; 83 единицы знака = .17
const MU = .17 / 83, markGeo = new THREE.PlaneGeometry(107 * MU, 151 * MU), markMat = new THREE.MeshBasicMaterial({ map: markDay, transparent: true, depthWrite: false });
const pins = HB_COUNTRIES.map(c => {
  const g = new THREE.Group(); g.position.copy(toV(c.lat, c.lon, R)); g.lookAt(0, 0, 0);
  // лицевая сторона наружу, крыша к северу
  const mark = new THREE.Mesh(markGeo, markMat); mark.rotation.y = Math.PI; mark.position.set(0, 0, -.03); mark.renderOrder = 2; g.add(mark);
  const top = new THREE.Object3D(); top.position.set(0, 63.5 * MU, -.03); g.add(top); // сюда крепится подпись страны
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.userData.noFade = true; hit.userData.pin = c; g.add(hit);
  pinsGroup.add(g);
  const market = HB_MARKETS.find(m => m.country === c.name);
  // у рынков знак-эхо: расходится и гаснет, пока планета в покое
  const pulse = market ? new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: echoDay, transparent: true, opacity: 0, depthWrite: false })) : null; if (pulse) { pulse.rotation.y = Math.PI; pulse.position.set(0, 0, -.028); g.add(pulse); }
  return { c, g, mark, top, hit, market, pulse, normal: toV(c.lat, c.lon, 1).normalize() };
});
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Zv = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion(), userQ = new THREE.Quaternion();
const FACE = new THREE.Vector3(0, .36, .93).normalize();
// дуги между рынками: своя группа на каждый набор рынков, по ним бежит пунктир
const arcMat = ng(new THREE.LineDashedMaterial({ color: V.accent, transparent: true, opacity: .45, dashSize: .1, gapSize: .07 }));
const arcSets = new Map();
function arcsFor(keys) {
  const id = keys.join(','); if (arcSets.has(id)) return arcSets.get(id);
  const grp = new THREE.Group(); globe.add(grp); arcSets.set(id, grp);
  const ms = keys.map(k => HB_MARKETS.find(m => m.key === k)).filter(Boolean).map(m => HB_COUNTRIES.find(c => c.name === m.country)).filter(Boolean).map(c => toV(c.lat, c.lon, 1).normalize());
  if (ms.length < 2) return grp;
  for (let i = 0; i < ms.length; i++) { const a = ms[i], b = ms[(i + 1) % ms.length]; if (ms.length === 2 && i === 1) break; const ang = a.angleTo(b); if (ang < .01) continue; const pts = [];
    for (let k = 0; k <= 48; k++) { const t = k / 48; const v = a.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang)).normalize(); v.multiplyScalar(R * (1.01 + .1 * Math.sin(t * Math.PI) * Math.min(1, ang * 1.4))); pts.push(v); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat); l.computeLineDistances(); l.userData.noFade = true; grp.add(l); }
  return grp;
}
// ориентация: страна aim смотрит на камеру чуть выше центра, север вверх
function aimQ(lat, lon) { const n = toV(lat, lon, 1).normalize(); return new THREE.Quaternion().setFromAxisAngle(X, Math.asin(n.y) - Math.asin(FACE.y)).multiply(tmpQ.setFromAxisAngle(Y, -Math.atan2(n.x, n.z))); }

// ---------- город (задники) ----------
const S_END = 60, R_END = R * S_END;
const city = new THREE.Group(); scene.add(city);
const cityLight = new THREE.DirectionalLight(0xfff6e8, 1.0); cityLight.position.set(16, 26, 14); cityLight.castShadow = true;
cityLight.shadow.mapSize.set(isPhone ? 1024 : 1536, isPhone ? 1024 : 1536); cityLight.shadow.bias = -.0004; cityLight.shadow.normalBias = .12;
Object.assign(cityLight.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 2, far: 90 });
city.add(cityLight); city.add(cityLight.target);
// плоскость, прогнутая по кривизне планеты в конечном масштабе
function curved(w, h, sx, sz, cz, hf) { const g = new THREE.PlaneGeometry(w, h, sx, sz); const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = -a.getY(i) + cz; a.setZ(i, -(x * x + z * z) / (2 * R_END) + (hf ? hf(x, z) : 0)); } g.computeVertexNormals(); return g; }
let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
// шум для холмов: сглаженная решётка случайных высот
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = smooth(x - xi), fz = smooth(z - zi); return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), fx), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), fx), fz); }
const SP = 3.7, Z0 = -3.6, HOME = { gx: 0, gz: 2 }; const homeZ = Z0 + HOME.gz * SP;
const SHORE = -6.05;
let built = null; // всё, что зависит от выбранного рынка
let lmGroup = null, seaMat, flats = [], blocks = [], home = {}, stones = [], cars = [], boats = [];
let homes = [];
// камера в системе квартала (без масштаба): опорные точки глав II..V; дорожка проверяется на пересечение с домами и деревьями
const KEY = {
  B: { cam: [0, 26, homeZ + 28], look: [0, 1, homeZ - 2] },
  C: { cam: [8.6, 5.6, homeZ + 11.8], look: [0, 2.4, homeZ] },
  D: { cam: [1.6, 1.4, homeZ + 5.4], look: [-.1, .9, homeZ + 1.2] },
  E: { cam: [-5.2, 5.6, homeZ + 13.6], look: [.9, .2, homeZ + 5.6] },
};
const pushFor = m => m ? 1.25 : 1;
function camLocal(t3, t4, t5, push) {
  const v = k => new THREE.Vector3(KEY[k].cam[0] * push, KEY[k].cam[1] * (k === 'D' ? 1 : push), KEY[k].cam[2] * push), l = k => new THREE.Vector3(...KEY[k].look);
  const cam = v('B').lerp(v('C'), t3).lerp(v('D'), t4).lerp(v('E'), t5), look = l('B').lerp(l('C'), t3).lerp(l('D'), t4).lerp(l('E'), t5);
  return { cam, look };
}
// образцы пути камеры для обоих раскладов: по ним из квартала убирается всё, что попало бы в кадр вплотную
const PATH = [];
for (const push of [1, 1.25]) for (let i = 0; i <= 240; i++) { const t = i / 240 * 3; PATH.push(camLocal(smooth(clamp(t, 0, 1)), smooth(clamp(t - 1, 0, 1)), smooth(clamp(t - 2, 0, 1)), push).cam); }
const nearPath = (x, y, z, r) => PATH.some(p => Math.abs(p.x - x) < r && Math.abs(p.z - z) < r && p.y < y + r);
function clearBuilt() { if (!built) return; city.remove(built); built.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.userData.shared) for (const mt of [].concat(o.material)) { mt.userData.dead = true; mt.dispose(); } }); built = null; }

function buildCity(m) {
  clearBuilt(); NL = NL.filter(r => !r.m.userData.dead); homes = homes.filter(h => !h.city); seed = m.seed || 11; flats = []; blocks = []; stones = [];
  const g = new THREE.Group(); built = g; city.add(g);
  const pr = m.profile;
  // земля: квартал ровный, дальше холмы по профилю рынка, на стороне моря высота ноль
  const hills = (x, z) => { const d = Math.hypot(x, z - 6); const mask = smooth((d - 26) / 40); const coast = smooth((z - SHORE + 2) / 10); return mask * coast * pr.hills * (noise(x / 22 + 3, z / 22) * 9 + noise(x / 7, z / 7 + 1) * 2.2); };
  const ground = new THREE.Mesh(curved(360, 360, 96, 96, 40, hills), new THREE.MeshStandardMaterial({ color: V.sunken, roughness: 1, envMapIntensity: .15, transparent: true, vertexColors: true }));
  { const a = ground.geometry.attributes.position, col = []; for (let i = 0; i < a.count; i++) { const h = a.getZ(i) + (a.getX(i) ** 2 + (-a.getY(i) + 40) ** 2) / (2 * R_END); const t = clamp(h / 9, 0, 1); const c = new THREE.Color(V.sunken).lerp(new THREE.Color(V.tint), t * .8); col.push(c.r, c.g, c.b); } ground.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground); flats.push(ground);
  // море с рябью: у берега плотнее и с пеной, дальше прозрачнее
  seaMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: { value: 0 }, c: { value: new THREE.Color(V.accent) }, f: { value: new THREE.Color(V.paper) }, k: { value: new THREE.Color(V.tint) }, a: { value: 1 }, night: { value: 0 } },
    vertexShader: 'uniform float t; varying vec2 vP; varying float vW; varying float vD; void main(){ vP = position.xy; float w = sin(position.x*.9 + t*1.1)*.5 + sin(position.y*1.7 - t*.8)*.5; vec3 p = position; p.z += w*.06; vW = w; vec4 mv = modelViewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c, f, k; uniform float a, t, night; varying vec2 vP; varying float vW; varying float vD; void main(){ float d = max(0., 120. - vP.y); float near = 1. - smoothstep(0., 14., d); float ripple = sin(d*5.2 - t*1.6 + sin(vP.x*.7)*1.5)*.5+.5; float r2 = sin(vP.x*1.1 + d*.8 + t*.7)*.5+.5; float foam = smoothstep(.93, 1., ripple) * near * (1. - smoothstep(0., 3., d)*.5); float m = mix(.32, .16, near) + (ripple - .5)*.11 + (r2 - .5)*.07 + vW*.03; vec3 col = mix(k, c, m); col = mix(col, f, foam*.9); col = mix(col, vec3(.06,.09,.07), night*.75); float fog = 1. - smoothstep(60., 230., vD); gl_FragColor = vec4(col, (.94 + foam*.3) * a * fog); }' });
  const sea = new THREE.Mesh(curved(520, 260, 80, 40, -136), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, .04, -136); sea.userData.baseAlpha = 1; g.add(sea); flats.push(sea);
  const beach = slab(380, 3.4, V.paper, 1); beach.position.set(0, .02, SHORE - 1.6); g.add(beach); flats.push(beach);
  const shoreLine = slab(380, .12, V.ink, .16); shoreLine.position.set(0, .05, SHORE); g.add(shoreLine); flats.push(shoreLine);
  // острова за морем, если у рынка они есть
  if (pr.islands) for (const [x, z, s] of [[-58, -48, 1], [-44, -62, .7], [52, -44, 1.2], [70, -58, .8]]) { const isl = new THREE.Mesh(curved(28 * s, 18 * s, 18, 12, 0, (a, b) => Math.max(0, (1 - Math.hypot(a / (14 * s), b / (9 * s))) * 5.5 * s)), new THREE.MeshStandardMaterial({ color: V.tint, roughness: 1, transparent: true, envMapIntensity: .15 })); isl.rotation.x = -Math.PI / 2; isl.position.set(x, .1, z); g.add(isl); flats.push(isl); }
  // улицы
  for (let gz = -1; gz <= 6; gz++) { const z = Z0 + gz * SP + SP / 2; const sw = slab(46, 1.7, V.paper, .5); sw.position.set(0, .011, z); g.add(sw); flats.push(sw); const s = slab(46, .9, V.control, .26); s.position.set(0, .012, z); g.add(s); flats.push(s); }
  for (let gx = -6; gx <= 6; gx++) { const x = gx * SP + SP / 2; const sw = slab(1.7, 30, V.paper, .5); sw.position.set(x, .011, Z0 + 3 * SP); g.add(sw); flats.push(sw); const s = slab(.9, 30, V.control, .26); s.position.set(x, .012, Z0 + 3 * SP); g.add(s); flats.push(s); }
  { const pts = [], P3 = (x, z) => new THREE.Vector3(x, .02, z); const parkX = 3 * SP / 2 + 1.9;
    for (let gz = -1; gz <= 6; gz++) { const z = Z0 + gz * SP + SP / 2; if (gz >= HOME.gz && gz <= HOME.gz + 2) pts.push(P3(-23, z), P3(-parkX, z), P3(parkX, z), P3(23, z)); else pts.push(P3(-23, z), P3(23, z)); }
    const pz0 = Z0 + (HOME.gz + 1) * SP - SP / 2, pz1 = Z0 + (HOME.gz + 3) * SP + SP / 2;
    for (let gx = -6; gx <= 6; gx++) { const x = gx * SP + SP / 2; if (Math.abs(x) < parkX) pts.push(P3(x, Z0 + 3 * SP - 15), P3(x, pz0), P3(x, pz1), P3(x, Z0 + 3 * SP + 15)); else pts.push(P3(x, Z0 + 3 * SP - 15), P3(x, Z0 + 3 * SP + 15)); }
    const dash = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: V.paper, transparent: true, opacity: .9, dashSize: .45, gapSize: .4 })); dash.computeLineDistances(); dash.userData.baseAlpha = .9; g.add(dash); flats.push(dash); }
  // парк перед домом: три ряда кварталов свободны, здесь дорожки, деревья и путь камеры
  const park = (gx, gz) => gz >= HOME.gz + 1 && gz <= HOME.gz + 3 && Math.abs(gx) <= 2;
  const lawn = slab(3 * SP + 3.6, 3 * SP - .9, V.tint, 1); lawn.position.set(0, .014, Z0 + (HOME.gz + 2) * SP); g.add(lawn); flats.push(lawn);
  const lawn2 = slab(3 * SP + 3.6, 3 * SP - .9, V.accent2, .16); lawn2.position.set(0, .015, Z0 + (HOME.gz + 2) * SP); g.add(lawn2); flats.push(lawn2);
  const walk = slab(1.1, 3 * SP - .9, V.paper, 1); walk.position.set(0, .016, Z0 + (HOME.gz + 2) * SP); g.add(walk); flats.push(walk);
  const plaza = slab(9.6, 2.4, V.paper, 1); plaza.position.set(0, .019, homeZ + 2.6); g.add(plaza); flats.push(plaza);
  // деревья: кроны из нескольких шаров (три варианта), у пальм семь листьев одной геометрией; ни одно не стоит на пути камеры
  // кроны темнее снизу: вершинный цвет вместо запечённого света, чтобы шары читались листвой, а не мячами
  const leafGeo = aoColors(new THREE.IcosahedronGeometry(.42, 1), .6), trunkGeo = new THREE.CylinderGeometry(.05, .07, .7, 6);
  const crownGeos = [0, 1, 2].map(v => aoColors(mergeGeos([[0, 0, 0, .4], [.27, .1, .12, .3], [-.22, .17, -.16, .27], [.06, -.08, .3, .24]].slice(0, 3 + v % 2).map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r * (1 + v * .08), 1).translate(x, y, z))), .6));
  const frond = new THREE.Shape(); frond.moveTo(0, 0); frond.quadraticCurveTo(.21, .5, 0, .98); frond.quadraticCurveTo(-.21, .5, 0, 0);
  const palmGeo = mergeGeos([...Array(8)].map((_, i) => new THREE.ShapeGeometry(frond, 6).rotateX(i % 2 ? -1.78 : -1.42).rotateY(i / 8 * Math.PI * 2)).concat([new THREE.SphereGeometry(.09, 8, 6)]));
  const leafA = ng(wall(V.accent, { rough: .95, ao: true })), leafB = wall(V.accent2, { rough: .95, ao: true }), trunkMat = wall(V.ink3), palmMat = ng(wall(V.accent, { rough: .95 })); palmMat.side = THREE.DoubleSide; leafA.userData = leafB.userData = trunkMat.userData = palmMat.userData = { shared: true };
  // деревья одними инстансами: стволы, три кроны в двух тонах, пальмы; ни одно не стоит на пути камеры
  const trunkI = new THREE.InstancedMesh(trunkGeo, trunkMat, 72), palmI = new THREE.InstancedMesh(palmGeo, palmMat, 72), crownI = crownGeos.flatMap(cg => [leafA, leafB].map(mm => new THREE.InstancedMesh(cg, mm, 72)));
  const treeSets = [trunkI, palmI, ...crownI]; for (const m of treeSets) { m.count = 0; m.castShadow = true; }
  const Mt = new THREE.Matrix4(), Ml = new THREE.Matrix4(), Mw = new THREE.Matrix4(), Qt = new THREE.Quaternion(), St = new THREE.Vector3(), Pt = new THREE.Vector3();
  const putTree = (m, mat) => { if (m.count < 72) m.setMatrixAt(m.count++, mat); };
  const lmSpot = LM_SPOT[m.key];
  function tree(x, z, s = 1, palm) { if (PATH.some(q => Math.hypot(q.x - x, q.z - z) < 2.4 && q.y < 7.5)) return; if (lmSpot && Math.hypot(lmSpot[0] - x, lmSpot[1] - z) < lmSpot[2]) return;
    const crown = palm ? null : crownI[Math.floor(rnd() * 3) * 2 + (rnd() < .5 ? 0 : 1)], ry = rnd() * 3, tilt = palm ? (rnd() - .5) * .16 : 0;
    Mt.compose(Pt.set(x, 0, z), Qt.setFromAxisAngle(Zv, tilt), St.set(1, 1, 1));
    Ml.compose(Pt.set(0, (palm ? .6 : .35) * s, 0), Qt.identity(), St.set(s, palm ? 1.7 * s : s, s)); putTree(trunkI, Mw.multiplyMatrices(Mt, Ml));
    Ml.compose(Pt.set(0, (palm ? 1.2 : 1) * s, 0), Qt.setFromAxisAngle(Y, ry), St.set(s, s, s)); putTree(palm ? palmI : crown, Mw.multiplyMatrices(Mt, Ml)); }
  // кварталы: у каждого дома свой характер (витраж, балконы, ленты, ленточные окна, простые окна), сдвоенные и угловые корпуса; окна и рамы рисует шейдер фасада
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), Pv = new THREE.Vector3();
  const NB = 1200, NR = 2400;
  const balc = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, .035, .2), wall(V.sunken, { rough: .9 }), NB); let bi = 0;
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, .13, .02), new THREE.MeshStandardMaterial({ color: V.line, transparent: true, opacity: .6, roughness: .3, metalness: .4 }), NR); let ri = 0;
  const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .045, 1), wall(V.sunken, { rough: .9 }), 900); let ni = 0;
  // перила: рейка длиной len на уличной грани (side 0 это +z, 1 это +x), по оси грани
  function rail(x, y, z, len, side, sy = 1) { if (ri >= NR) return; S.set(len / .42, sy, 1); M.compose(Pv.set(x, y, z), side ? Q.setFromAxisAngle(Y, Math.PI / 2) : Q.identity(), S); rails.setMatrixAt(ri++, M); S.set(1, 1, 1); }
  // балконы на двух уличных гранях со второго этажа (первый отдан витрине): у балконных домов плита под каждым окном по раскладке шейдера (.62 на окно, 82% грани), у остальных один длинный балкон на этаж
  function balconiesFor(w, h, d, x0, z0, long, y0 = 0) { const rows = Math.floor((h - .1) / .55);
    for (let f = 1; f < rows; f++) for (const side of [0, 1]) { const len = side === 0 ? w : d, cols = long ? 1 : Math.max(1, Math.floor(len / .62)), sx = long ? len * .86 / .42 : 1; for (let k = 0; k < cols && bi < NB; k++) { const y = y0 + .4 + f * .55 - .12, u = long ? 0 : ((k + .5) / cols - .5) * len * .82;
      if (side === 0) { Pv.set(x0 + u, y, z0 + d / 2 + .1); Q.identity(); } else { Pv.set(x0 + w / 2 + .1, y, z0 + u); Q.setFromAxisAngle(Y, Math.PI / 2); }
      S.set(sx, 1, 1); M.compose(Pv, Q, S); balc.setMatrixAt(bi++, M); S.set(1, 1, 1); rail(Pv.x + (side ? .09 : 0), y + .085, Pv.z + (side ? 0 : .09), sx * .42, side); } } }
  // межэтажные плиты с перилами по их кромке на уличных гранях
  function bandsFor(w, h, d, x0, z0, y0 = 0) { for (let y = y0 + .55; y < y0 + h - .2 && ni < 900; y += .55) { M.compose(Pv.set(x0, y, z0), Q.identity(), S.set(w + .08, 1, d + .08)); bands.setMatrixAt(ni++, M); S.set(1, 1, 1); rail(x0, y + .085, z0 + d / 2 + .05, w * .9, 0, .9); rail(x0 + w / 2 + .05, y + .085, z0, d * .9, 1, .9); } }
  // ограждение по кромке плоской кровли поверх парапета
  function roofRails(w, top, d, x0, z0) { const y = top + .125; rail(x0, y, z0 + d / 2 + .05, w + .1, 0, .8); rail(x0, y, z0 - d / 2 - .05, w + .1, 0, .8); rail(x0 + w / 2 + .05, y, z0, d + .1, 1, .8); rail(x0 - w / 2 - .05, y, z0, d + .1, 1, .8); }
  // коробки домов, парапеты и надстройки одним инстансом с материалом фасада; крыши, сады, бассейны и кроны отдельными
  // вальмовая крыша: пирамида с основанием в единичный квадрат, растягивается под любой прямоугольник
  const hipGeo = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(Math.SQRT2, 1, Math.SQRT2);
  const inst = { walls: wallMesh(1800),
    hip: new THREE.InstancedMesh(hipGeo, wall(V.sunken, { rough: .95 }), 260), hipDark: new THREE.InstancedMesh(hipGeo, wall(new THREE.Color(V.control).lerp(new THREE.Color(V.sunken), .45).getHex(), { rough: 1 }), 200),
    garden: new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: V.tint, roughness: .95, envMapIntensity: .2 }), 160),
    pool: new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), nlc(new THREE.MeshStandardMaterial({ color: new THREE.Color(V.tint).lerp(new THREE.Color(V.accent), .3), roughness: .12, metalness: .1, envMapIntensity: .6 }), new THREE.Color(V.tint).lerp(new THREE.Color(V.accent), .3).getHex(), new THREE.Color(V.tint).lerp(MINT, .3).getHex()), 160),
    leaf: new THREE.InstancedMesh(leafGeo, leafA, 160) };
  for (const k in inst) { inst[k].count = 0; inst[k].castShadow = k !== 'garden' && k !== 'pool'; inst[k].receiveShadow = true; }
  inst.walls.material.userData.shared = true;
  const put = (k, x, y, z, sx, sy, sz, q) => { const m = inst[k]; if (m.count >= m.instanceMatrix.count) return; M.compose(Pv.set(x, y, z), q || Q.identity(), S.set(sx, sy, sz)); m.setMatrixAt(m.count++, M); S.set(1, 1, 1); };
  // коробка квартала: стиль, тон и зерно едут в цвете инстанса, шейдер рисует по ним фасад
  const putWall = (style, tone, x, y, z, sx, sy, sz, o) => { const m = inst.walls; if (m.count >= m.instanceMatrix.count) return; m.setColorAt(m.count, wallCode(style, tone, o)); put('walls', x, y, z, sx, sy, sz); };
  const flatQ = new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2);
  // бассейн: бортик из светлой плиты и вода чуть выше него; y это уровень, на котором он стоит (земля или кровля)
  const pool = (x, z, w, d, y = 0) => { putWall('blank', 'paper', x, y + .025, z, w + .14, .05, d + .14); put('pool', x, y + .052, z, w, d, 1, flatQ); };
  // пергола: четыре стойки и рейки поверх
  const pergola = (x, y, z, w, d) => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) putWall('blank', 'paper', x + sx * (w / 2 - .03), y + .16, z + sz * (d / 2 - .03), .05, .32, .05);
    for (let i = 0; i < 5; i++) putWall('blank', 'paper', x - w / 2 + (i + .5) * w / 5, y + .34, z, .035, .035, d + .06); };
  // низкая ограда по периметру участка
  const fence = (x, z, w, d) => { putWall('blank', 'sunken', x, .07, z + d / 2, w, .14, .05); putWall('blank', 'sunken', x, .07, z - d / 2, w, .14, .05); putWall('blank', 'sunken', x - w / 2, .07, z, .05, .14, d - .05); putWall('blank', 'sunken', x + w / 2, .07, z, .05, .14, d - .05); };
  const tones = ['paper', 'paper', 'paper', 'sunken', 'page', 'tint'];
  const pick = a => a[Math.floor(rnd() * a.length)];
  // дом квартала: o.st стиль фасада, o.tone тон, o.y0 высота основания (башня на подиуме), o.roof: flat, hip, tier, garden, pool, pergola, bare
  function building(x, z, w, h, d, o = {}) {
    const y0 = o.y0 || 0, top = y0 + h;
    if (nearPath(x, top, z, Math.max(w, d) / 2 + .9)) return false;
    const r = rnd(); const st = o.st || (r < .16 ? 'glass' : r < .36 ? 'balcony' : r < .5 ? 'bands' : r < .62 ? 'ribbon' : 'plain');
    const tone = o.tone || pick(tones);
    putWall(st, tone, x, y0 + h / 2, z, w, h, d, y0 ? { noDoor: true } : undefined);
    blocks.push({ position: new THREE.Vector3(x, top / 2, z), geometry: { parameters: { width: w, height: top, depth: d } }, userData: {} });
    const roof = o.roof || 'flat';
    if (roof === 'hip' || roof === 'tier') { const ov = o.ov ?? .22, sy = o.pitch ?? .32; put(roof === 'tier' ? 'hipDark' : 'hip', x, top + sy / 2, z, w / 2 + ov, sy, d / 2 + ov);
      if (roof === 'tier') put('hipDark', x, top + sy * .72 + .2, z, w * .3 + ov * .5, sy * 1.1, d * .3 + ov * .5); }
    else if (roof !== 'bare') { putWall('blank', 'sunken', x, top + .035, z, w + .1, .07, d + .1); if (!o.noRails) roofRails(w, top, d, x, z);
      if (roof === 'garden') { put('garden', x, top + .075, z, w * .72, d * .72, 1, flatQ); put('leaf', x + w * .22, top + .28, z - d * .18, .4, .4, .4); }
      else if (roof === 'pool') { pool(x - w * .12, z, w * .5, d * .38, top + .07); pergola(x + w * .3, top + .07, z, w * .3, d * .55); }
      else if (roof === 'pergola') pergola(x + (rnd() - .5) * w * .3, top + .07, z + (rnd() - .5) * d * .2, w * .45, d * .5);
      else if (!o.noUnits) { const rr = rnd();
        if (rr < .3) putWall('blank', 'paper', x + (rnd() - .5) * w * .3, top + .22, z + (rnd() - .5) * d * .3, w * .45, .3, d * .45);
        const nu = 1 + Math.floor(rnd() * 3); for (let i = 0; i < nu; i++) putWall('blank', 'sunken', x + (rnd() - .5) * w * .7, top + .13, z + (rnd() - .5) * d * .7, .22 + rnd() * .16, .18, .22 + rnd() * .16); } }
    if (o.balc === false) return true;
    if (st === 'glass' || st === 'bands') bandsFor(w, h, d, x, z, y0);
    else balconiesFor(w, h, d, x, z, o.balc === 'long' || (st !== 'balcony' && o.balc !== 'each'), y0);
    return true;
  }
  // облик города по исследованию новостроек (issledovanie/arhitektura-gorodov.md): у каждого рынка свои объёмы, этажность и кровли
  // этаж .55; у моря (ряды 0-1) выше пяти этажей не строим, иначе башни закрывают берег и ориентир в главе II
  const LOTS = {
    // Пхукет: широкие малоэтажные корпуса «гребёнкой» вокруг бассейна и виллы-коробки с бассейном вдоль фасада, башен нет
    phuket(cx, cz, gz) {
      if (rnd() < .58) { const h = 1.7 + Math.floor(rnd() * 4) * .55, w = 2.3 + rnd() * .4, roof = rnd() < .5 ? 'hip' : 'garden';
        building(cx, cz - .78, w, h, .95, { st: 'balcony', balc: 'long', tone: pick(['paper', 'paper', 'sunken']), roof, pitch: .26, ov: .25 });
        building(cx, cz + .78, w, Math.max(1.1, h - .55), .95, { st: 'balcony', balc: 'long', tone: 'paper', roof, pitch: .26, ov: .25 });
        pool(cx, cz, w * .8, .34); }
      else for (const s of [-1, 1]) { const w = 1.15 + rnd() * .2, h = rnd() < .5 ? .6 : 1.15, x = cx + s * .72, z = cz - .35;
        building(x, z, w, h, 1.05, { st: pick(['glass', 'plain']), tone: 'paper', roof: rnd() < .6 ? 'hip' : 'pergola', pitch: .24, ov: .24, balc: false });
        pool(x, z + .95, w * .85, .34); }
    },
    // Дубай: башни на широком подиуме с садом и бассейном на кровле подиума; у моря посёлок двухэтажных вилл за оградой
    dubai(cx, cz, gz) {
      if (gz >= 3 || (gz === 2 && rnd() < .5)) { const pw = 2.5 + rnd() * .3, ph = .9 + rnd() * .5, tw = 1.1 + rnd() * .35, th = gz >= 3 ? 4.5 + rnd() * 5.5 : 3.2 + rnd() * 1.6;
        if (!building(cx, cz, pw, ph, pw, { st: 'ribbon', tone: 'sunken', roof: 'bare', balc: false })) return;
        putWall('blank', 'sunken', cx, ph + .035, cz, pw + .1, .07, pw + .1); roofRails(pw, ph, pw, cx, cz);
        put('garden', cx + pw * .2, ph + .075, cz + pw * .22, pw * .5, pw * .4, 1, flatQ); pool(cx + pw * .2, cz + pw * .24, pw * .32, pw * .16, ph + .07);
        building(cx - pw * .18, cz - pw * .18, tw, th, tw, { y0: ph + .07, st: 'glass', tone: pick(['paper', 'page', 'sunken']), noRails: true }); }
      else { fence(cx, cz, 2.9, 2.9); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) building(cx + sx * .68, cz + sz * .68, 1.0, 1.15, .95, { st: 'plain', tone: pick(['paper', 'page']), roof: rnd() < .4 ? 'pergola' : 'flat', noRails: true, balc: false }); }
    },
    // Чангу: узкие одно- и двухэтажные виллы с длинным бассейном вдоль участка, многоярусная скатная кровля или плоская терраса
    canggu(cx, cz, gz) {
      const n = rnd() < .5 ? 2 : 3, step = 2.8 / n;
      for (let i = 0; i < n; i++) { const x = cx - 1.4 + step * (i + .5), w = step * .55, h = rnd() < .45 ? .62 : 1.17, tier = rnd() < .45;
        building(x - step * .14, cz - .2, w, h, 2.0, { st: pick(['glass', 'plain']), tone: pick(['paper', 'paper', 'sunken']), roof: tier ? 'tier' : rnd() < .5 ? 'pergola' : 'flat', pitch: .34, ov: .2, noRails: true, balc: false });
        pool(x + step * .3, cz - .1, step * .16, 1.8); }
    },
    // Стамбул: несколько пластин с ленточными балконами на общем стилобате с торговым этажом; у моря узкие бутиковые дома и сдвоенные виллы за оградой
    istanbul(cx, cz, gz) {
      if (gz >= 3) { const ph = .8, pw = 2.8;
        if (!building(cx, cz, pw, ph, pw, { st: 'ribbon', tone: 'sunken', roof: 'bare', balc: false })) return;
        putWall('blank', 'sunken', cx, ph + .035, cz, pw + .1, .07, pw + .1); put('garden', cx, ph + .075, cz + .95, pw * .8, .5, 1, flatQ);
        for (const s of [-1, 1]) { const th = 3.3 + rnd() * 3.3; building(cx + s * .7, cz - .25, .85, th, 2.0, { y0: ph + .07, st: 'bands', tone: pick(['paper', 'page']), noRails: true, noUnits: true });
          putWall('blank', 'paper', cx + s * .7, ph + .07 + th + .2, cz - .25, .6, .26, 1.4); } }
      else if (rnd() < .5) { let x = cx - 1.4; while (x < cx + 1.2) { const w = .72 + rnd() * .22, h = 2.2 + Math.floor(rnd() * 4) * .55;
          building(x + w / 2, cz + (rnd() - .5) * .12, w, h, 1.9 + rnd() * .3, { st: pick(['balcony', 'plain', 'ribbon']), tone: pick(tones), balc: 'each' }); x += w + .07; } }
      else { fence(cx, cz, 2.9, 2.9); for (const sz of [-1, 1]) { const h = 1.1 + Math.floor(rnd() * 2) * .55, z = cz + sz * .66;
          building(cx, z, 2.1, h, .95, { st: 'plain', tone: pick(['paper', 'page']), roof: rnd() < .5 ? 'hip' : 'flat', pitch: .3, ov: .12, noRails: true, balc: false });
          putWall('blank', 'sunken', cx, h / 2 + .02, z + .06, .07, h + .04, 1.07); } }
    },
    // Пафос: компактные белые корпуса в 2-4 этажа с перголой и бассейном на плоской кровле, двухэтажные виллы; редкий дом в 6-8 этажей
    paphos(cx, cz, gz) {
      const r = rnd();
      if (r < .08 && gz >= 3) building(cx, cz, 2.0, 3.3 + rnd() * 1.1, 1.7, { st: 'balcony', tone: 'paper', roof: 'pergola' });
      else if (r < .7) { const h = 1.1 + Math.floor(rnd() * 3) * .55; building(cx + (rnd() - .5) * .3, cz - .2, 2.1 + rnd() * .3, h, 1.5, { st: 'balcony', tone: pick(['paper', 'paper', 'page']), roof: rnd() < .55 ? 'pool' : 'pergola', balc: 'each' });
        put('garden', cx, .03, cz + 1.05, 2.3, .5, 1, flatQ); }
      else for (const s of [-1, 1]) { const x = cx + s * .7; building(x, cz - .3, 1.15, 1.15, 1.05, { st: 'plain', tone: 'paper', roof: 'pergola', noRails: true, balc: false }); pool(x, cz + .72, .8, .36); }
    },
    // Батуми: стройные башни без подиума с двухцветными панелями, плотным рядом; изредка пара близнецов
    batumi(cx, cz, gz) {
      const tall = gz >= 2, tower = (x, z, w, h) => { if (!building(x, z, w, h, w, { st: 'glass', tone: pick(['paper', 'page', 'sunken']), noRails: true })) return;
        const s = rnd() < .5 ? -1 : 1; putWall('blank', pick(['tint', 'sunken', 'page']), x + s * w * .28, h * .52, z + w / 2 + .03, w * .34, h * .9, .06); };
      if (rnd() < .18 && tall) { const h = 5 + rnd() * 3.5; tower(cx - .75, cz, 1.05, h); tower(cx + .75, cz, 1.05, h); }
      else tower(cx + (rnd() - .5) * .4, cz + (rnd() - .5) * .4, 1.3 + rnd() * .35, tall ? 3.5 + rnd() * 6.5 : 2.2 + rnd() * 1.3);
    },
  };
  const lot = LOTS[m.key];
  for (let gx = -5; gx <= 5; gx++) for (let gz = 0; gz <= 6; gz++) {
    if (gx === HOME.gx && gz === HOME.gz) continue;
    if (park(gx, gz)) continue;
    lot(gx * SP + (rnd() - .5) * .2, Z0 + gz * SP + (rnd() - .5) * .2, gz);
  }
  balc.count = bi; rails.count = ri; bands.count = ni; balc.instanceMatrix.needsUpdate = rails.instanceMatrix.needsUpdate = bands.instanceMatrix.needsUpdate = true; balc.castShadow = rails.castShadow = bands.castShadow = false; rails.frustumCulled = false; g.add(balc); g.add(rails); g.add(bands);
  // дальний силуэт: башни за кварталом, где рынок высотный
  if (pr.towers > 0) for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 1.1 - Math.PI * .05, r = 40 + rnd() * 26; const x = Math.cos(a) * r, z = 10 + Math.abs(Math.sin(a)) * r; if (z < 24) continue; const h = 6 + rnd() * 16 * pr.towers, w = 2 + rnd() * 2.5; const y = h / 2 + hills(x, z); putWall(rnd() < .4 ? 'glass' : rnd() < .5 ? 'bands' : 'plain', rnd() < .5 ? 'paper' : 'sunken', x, y, z, w, h, w); }
  for (let x = -24; x <= 24; x += 2.4) tree(x + (rnd() - .5), SHORE - .9 + (rnd() - .5) * .4, .85 + rnd() * .3, pr.palms);
  for (let i = 0; i < 18; i++) { const side = rnd() < .5 ? -1 : 1; tree(side * (3.6 + rnd() * 5.2), homeZ + 4.6 + rnd() * 9.6, .7 + rnd() * .35, pr.palms && rnd() < .5); }
  for (let i = 0; i < 24; i++) { const gx = Math.floor(rnd() * 11) - 5, gz = Math.floor(rnd() * 7); if (park(gx, gz)) continue; tree(gx * SP + SP / 2 + (rnd() - .5) * .3, Z0 + gz * SP + (rnd() - .5) * 2.4, .7 + rnd() * .3, pr.palms && rnd() < .4); }
  for (const k in inst) { const m = inst[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; if (m.count) g.add(m); }
  for (const m of treeSets) { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; if (m.count) g.add(m); }
  { const lg = new THREE.Group(); g.add(lg); buildLandmark(lg, m.key); lmGroup = lg; }
  // машины на улицах вне парка и лодки в море: движутся, пока город в кадре; теней не отбрасывают, карта теней в покое не пересчитывается
  cars = []; boats = [];
  { const carGeo = new THREE.BoxGeometry(.44, .15, .22), cabGeo = new THREE.BoxGeometry(.24, .1, .2), carTones = [V.ink3, V.control, V.paper, V.accent2, V.ink2];
    for (let i = 0; i < 9; i++) { const gz = [-1, 0, 1, 5, 6][i % 5], dir = i % 2 ? 1 : -1; const c = new THREE.Group(); const body = new THREE.Mesh(carGeo, wall(carTones[i % carTones.length], { rough: .5 })); body.position.y = .1; c.add(body); const cab = new THREE.Mesh(cabGeo, glassMat()); cab.position.set(-.04, .22, 0); c.add(cab);
      c.position.set(-22 + rnd() * 44, 0, Z0 + gz * SP + SP / 2 + dir * .22); c.rotation.y = dir > 0 ? 0 : Math.PI; c.userData.v = dir * (1.3 + rnd() * 1.2); c.userData.keepEdges = true; g.add(c); cars.push(c); }
    for (let i = 0; i < 3; i++) { const b = new THREE.Group(); const hull = box(.7, .1, .26, V.paper, { edgeAlpha: .25, ao: false, shadow: false }); hull.position.y = .06; b.add(hull); const sail = new THREE.Mesh(new THREE.PlaneGeometry(.34, .46), autoN(new THREE.MeshStandardMaterial({ color: i === 1 ? V.accent2 : V.paper, side: THREE.DoubleSide, roughness: .9 }))); sail.position.set(.02, .36, 0); sail.rotation.y = .5; b.add(sail); const mast = box(.02, .5, .02, V.ink3, { edges: false, ao: false }); mast.position.y = .35; b.add(mast);
      b.position.set(-16 + i * 14 + rnd() * 6, .04, SHORE - 9 - i * 7 - rnd() * 4); b.userData = { v: i % 2 ? .35 : -.28, i, keepEdges: true }; g.add(b); boats.push(b); } }
  // дом: у рынка либо башня с балконами, либо вилла с бассейном и садом
  home = buildHome(g, m); home.city = true;
  // дорожка сделки: шесть камней от двери через парк, каждый этап на своём камне
  const stoneGeo = new THREE.CylinderGeometry(.42, .42, .06, 24);
  const ringGeo = new THREE.RingGeometry(.4, .45, 32);
  for (let i = 0; i < HB_STAGES.length; i++) { const s = new THREE.Mesh(stoneGeo, new THREE.MeshStandardMaterial({ color: V.tint, roughness: .8, emissive: V.accent2, emissiveIntensity: 0 })); const z = homeZ + 2.65 + i * 1.5, x = 1.1 + Math.sin(i * 1.3) * .9; s.position.set(x, .045, z); s.receiveShadow = true; s.userData.i = i; const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: V.accent, transparent: true, opacity: .2 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .04; s.add(ring); s.userData.ring = ring; g.add(s); stones.push(s); }
  // кромки: линии всех коробок квартала и дома собираются в одну геометрию на каждую прозрачность вместо сотен отдельных
  { const edgeList = []; (function walk(o, m) { if (o.userData.keepEdges) return; o.updateMatrix(); const mm = new THREE.Matrix4().multiplyMatrices(m, o.matrix);
      for (const ch of [...o.children]) { if (ch.userData.edge) { ch.updateMatrix(); edgeList.push({ geo: ch.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(mm, ch.matrix)), alpha: ch.material.opacity }); ch.geometry.dispose(); ch.material.dispose(); o.remove(ch); } else walk(ch, mm); } })(g, new THREE.Matrix4());
    const byA = {}; for (const e of edgeList) { const k = e.alpha.toFixed(2); (byA[k] = byA[k] || []).push(e.geo); }
    for (const k in byA) { const pos = []; for (const gg of byA[k]) { const q = gg.attributes.position; for (let i = 0; i < q.count; i++) pos.push(q.getX(i), q.getY(i), q.getZ(i)); gg.dispose(); }
      const l = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: V.ink, transparent: true, opacity: +k })); l.frustumCulled = false; l.userData.baseAlpha = +k; g.add(l); } }
  // кромки гаснут, пока квартал сплюснут: сложенные линии этажей иначе ложатся на крышу серыми полосами
  g.userData.lines = []; g.traverse(o => { if (o.isLineSegments && o.userData.baseAlpha !== undefined) g.userData.lines.push(o); });
  for (const f of flats) { f.material.transparent = true; f.userData.baseAlpha = f.userData.baseAlpha ?? 1; }
  // слои земли лежат в тысячных долях друг над другом и в сплюснутом квартале сливаются: порядок по высоте закреплён сдвигом глубины, иначе они мерцают серым
  [...flats].sort((a, b) => a.position.y - b.position.y).forEach((f, i) => { f.material.polygonOffset = true; f.material.polygonOffsetFactor = 0; f.material.polygonOffsetUnits = -4 * i; }); // без множителя наклона: на пологом виде он выдвигал землю вперёд пальм и заборов
  applyNight(nightNow, true);
}

// панели остекления дома: отражение неба по Френелю, тёмная комната, импосты каждые .6 м по мировым координатам, ночью подсветка тем же uNight
const paneMat = (dark = false) => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2, metalness: dark ? .35 : .2, envMapIntensity: .6, transparent: dark, opacity: dark ? .5 : 1 }); // у виллы за стеклом комната, стекло держим полупрозрачным, чтобы мебель читалась
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uPage: { value: new THREE.Color(V.page) }, uGlass: { value: new THREE.Color(V.tint) }, uFrame: { value: new THREE.Color(V.ink3) }, uLit: facade.userData.u.uLit, uNight: facade.userData.u.uNight, uDark: { value: dark ? 1 : 0 } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp = (modelMatrix * vec4(position, 1.)).xyz; vWn = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uPage; uniform vec3 uGlass; uniform vec3 uFrame; uniform vec3 uLit; uniform float uNight; uniform float uDark;')
      .replace('#include <color_fragment>', [
        ' vec3 Nv = normalize(vNormal), Vv = normalize(vViewPosition); float fres = pow(1. - clamp(dot(Vv, Nv), 0., 1.), 3.);',
        ' vec3 Rw = (vec4(reflect(-Vv, Nv), 0.) * viewMatrix).xyz; vec3 sky = mix(uPage, vec3(1.), clamp(Rw.y * 1.4 + .2, 0., 1.));',
        ' float alongX = step(.5, abs(vWn.x)); float pu = mix(vWp.x, vWp.z, alongX); float fu = fract(pu / .6); float du = min(fu, 1. - fu) * .6;',
        ' float paneMull = (1. - smoothstep(.018, .034, du)) * (1. - step(.5, abs(vWn.y)));',
        ' // тёмное остекление (вилла): глубокий тон комнаты, небо только по Френелю; светлое (башня): больше неба',
        ' vec3 col = mix(mix(uGlass * .8, sky, .45 + .42 * fres), mix(uGlass * .3, sky, .12 + .6 * fres), uDark); col = mix(col, vec3(1.), paneMull * .85);',
        ' diffuseColor.rgb = col;'].join('\n'))
      .replace('#include <roughnessmap_fragment>', ' float roughnessFactor = mix(.2, .7, paneMull);')
      .replace('#include <metalnessmap_fragment>', ' float metalnessFactor = mix(mix(.2, .35, uDark), 0., paneMull);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uLit * uNight * (1. - paneMull) * .5;');
  }; m.customProgramCacheKey = () => 'hb-pane'; return m; };
// ориентир города у кромки моря слева от квартала: узнаётся одним силуэтом, цвета только из палитры сайта
// море и земля прогнуты по кривизне планеты, поэтому основание каждой детали ставится на уровень воды в своей точке
const LM_SPOT = { phuket: [-15, -12.5, 4.5], dubai: [-15, -6.9, 2.9], canggu: [-14, -9.5, 3.4], istanbul: [-15, -9.5, 3.6], paphos: [-14, -11.5, 3.5], batumi: [-15, -7.2, 2] }; // x левее дома: в главе «Дом» ориентир виден сбоку от башни, а не за ней
const seaY = (x, z) => .04 - (x * x + z * z) / (2 * R_END);
function buildLandmark(g, key) {
  const sp = LM_SPOT[key]; if (!sp) return; const [cx, cz] = sp;
  const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const white = wall(V.paper, { rough: .7 }), stone = wall(V.sunken, { rough: .9 }), dark = wall(V.ink2, { rough: .95 }), mid = wall(V.control, { rough: .9 }), land = wall(new THREE.Color(V.tint).lerp(new THREE.Color(V.accent2), .3).getHex(), { rough: 1 }), crown = wall(V.accent, { rough: .95 });
  // холм-мыс из воды: купол по кривизне, низ уходит под воду
  const mound = (x, z, rx, rz, h) => { const geo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); geo.scale(rx, h, rz); const o = add(geo, land, x, seaY(x, z) - .15, z); for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .45 + (i % 3) * .14, px = Math.cos(a) * r, pz = Math.sin(a) * r, py = h * Math.sqrt(Math.max(0, 1 - px * px - pz * pz)); if (r < .5) continue; add(new THREE.IcosahedronGeometry(.32 + (i % 2) * .1, 1), crown, x + px * rx, o.position.y + py + .12, z + pz * rz); } return o; };
  if (key === 'phuket') {
    // Большой Будда на холме: сидящая белая фигура упрощена до широкого основания, плеч и головы с ушнишей
    const top = mound(cx, cz, 3.8, 2.8, 1.9).position.y + 1.9 - .05;
    add(new THREE.CylinderGeometry(1.15, 1.3, .28, 24), white, cx, top + .14, cz);
    // скрещённые ноги шире плеч, торс сужается к шее, голова с ушнишей: так силуэт читается сидящей фигурой, а не колоколом
    const lap = new THREE.SphereGeometry(1, 24, 12); lap.scale(1.25, .5, .85); add(lap, white, cx, top + .38, cz + .1);
    const body = new THREE.LatheGeometry([[0, 0], [.72, 0], [.78, .35], [.7, .8], [.62, 1.25], [.46, 1.5], [.2, 1.62], [0, 1.64]].map(([r, y]) => new THREE.Vector2(r, y)), 24); body.scale(1, 1, .8);
    add(body, white, cx, top + .45, cz - .12);
    add(new THREE.SphereGeometry(.36, 20, 14), white, cx, top + .45 + 1.9, cz - .08);
    add(new THREE.ConeGeometry(.16, .36, 14), white, cx, top + .45 + 2.33, cz - .08);
  } else if (key === 'dubai') {
    // Дубай-Фрейм на пляже: две башни и перемычка, открытая рама; ограничений на образ исследование не нашло (Бурдж-Халифа и Бурдж-аль-Араб защищены)
    const y0 = .02, fh = 5.2, fw = 3.2;
    add(new THREE.BoxGeometry(fw + 1.2, .16, 1.1), stone, cx, y0 + .08, cz);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(.62, fh, .62), white, cx + s * fw / 2, y0 + fh / 2 + .16, cz);
    add(new THREE.BoxGeometry(fw + .62, .5, .62), white, cx, y0 + fh + .16 - .25, cz);
    add(new THREE.BoxGeometry(fw - .62, .08, .5), mid, cx, y0 + fh + .16 - .54, cz);
    // Пальма Джумейра в море: ствол к берегу, листья и полумесяц волнолома; читается сверху, пока камера спускается; каждая полоса лежит на воде в своей точке
    const px = -2, pz = -13.2, sand = wall(V.paper, { rough: 1 }), strip = (x, z, w, d, ry) => { const b = add(new THREE.BoxGeometry(w, .5, d), sand, x, seaY(x, z) - .1, z, ry); b.castShadow = false; };
    strip(px, pz + 1.9, .6, 6.6, 0);
    for (let i = 0; i < 8; i++) { const z = pz + 4.4 - i * .8, len = 3 - Math.abs(i - 3.5) * .3; for (const s of [-1, 1]) strip(px + s * (len / 2 + .3), z, len, .24, 0); }
    for (let i = 0; i <= 20; i++) { const a = Math.PI * (.08 + .84 * i / 20), x = px + Math.cos(a) * 5.4, z = pz + 1.2 - Math.sin(a) * 5; strip(x, z, .3, .95, Math.PI / 2 - a); }
  } else if (key === 'canggu') {
    // Пура Бату Болонг: тёмная скала со сквозным проёмом в прибое, на ней храм-меру из пяти соломенных ярусов
    const y0 = seaY(cx, cz);
    const rock = (x, z, sx, sy, sz) => { const geo = new THREE.DodecahedronGeometry(1, 0); geo.scale(sx, sy, sz); add(geo, dark, x, y0 + sy * .35, z); };
    rock(cx - .9, cz, 1.1, 1.3, 1.3); rock(cx + .9, cz, 1.1, 1.2, 1.3);
    add(new THREE.BoxGeometry(2.6, .45, 1.8), dark, cx, y0 + 1.25, cz);
    const base = y0 + 1.48; add(new THREE.BoxGeometry(1.1, .3, 1.1), mid, cx, base + .15, cz);
    for (let i = 0; i < 5; i++) { const r = .78 - i * .13, y = base + .45 + i * .34; add(new THREE.CylinderGeometry(.05, .05, .16, 6), dark, cx, y - .08, cz); add(new THREE.ConeGeometry(r, .2, 4), dark, cx, y + .1, cz, Math.PI / 4); }
    // расколотые ворота канди-бентар на пляже: две ступенчатые половины с проходом
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(.5 - i * .1, .32, .5 - i * .1), mid, cx + 3.2 + s * .42, .02 + .16 + i * .32, -6.9);
  } else if (key === 'istanbul') {
    // Галатская башня на холме над проливом: каменный цилиндр, галерея и острый конус
    const top = mound(cx, cz, 3, 2.4, 1.2).position.y + 1.2 - .05;
    add(new THREE.CylinderGeometry(.62, .72, 4.2, 20), stone, cx, top + 2.1, cz);
    add(new THREE.CylinderGeometry(.8, .8, .5, 20), white, cx, top + 4.45, cz);
    add(new THREE.ConeGeometry(.78, 1.7, 20), dark, cx, top + 4.7 + .85, cz);
  } else if (key === 'paphos') {
    // скала Афродиты: светлый известняковый пик из воды и две скалы поменьше
    const y0 = seaY(cx, cz);
    const rockMat = wall(new THREE.Color(V.sunken).lerp(new THREE.Color(V.control), .45).getHex(), { rough: 1 });
    // глыба из воды: многогранник с неровными вершинами, верх смещён к морю; рядом две скалы поменьше
    const rock = (x, z, sx, sy, sz, ry, lean) => { const geo = new THREE.DodecahedronGeometry(1, 1); const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) { const k = .78 + hash(Math.round(a.getX(i) * 9) + x, Math.round(a.getY(i) * 9) + Math.round(a.getZ(i) * 9) * 3) * .44, t = Math.max(0, a.getY(i)); a.setXYZ(i, a.getX(i) * k * (1 - t * .45) + t * lean, a.getY(i) * k, a.getZ(i) * k * (1 - t * .45)); }
      geo.computeVertexNormals(); geo.scale(sx, sy, sz); add(geo, rockMat, x, y0 + sy * .45, z, ry); };
    rock(cx, cz, 1.5, 2.3, 1.2, .3, .35); rock(cx + 1.6, cz + .8, .8, 1.1, .7, 1.4, .1); rock(cx - 1.4, cz + 1.1, .55, .7, .5, 2.6, 0);
  } else if (key === 'batumi') {
    // Алфавитная башня на бульваре: тонкий ствол, двойная спираль и шар наверху
    const y0 = .02, H = 7;
    add(new THREE.CylinderGeometry(.75, .8, .2, 24), stone, cx, y0 + .1, cz);
    add(new THREE.CylinderGeometry(.13, .16, H, 12), white, cx, y0 + H / 2, cz);
    for (const ph of [0, Math.PI]) { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = ph + t * Math.PI * 2 * 4.5; pts.push(new THREE.Vector3(Math.cos(a) * .48, .3 + t * (H - .9), Math.sin(a) * .48)); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, .06, 6), mid, cx, y0, cz); }
    add(new THREE.CylinderGeometry(.5, .5, .16, 20), white, cx, y0 + H - .45, cz);
    add(new THREE.SphereGeometry(.55, 24, 16), white, cx, y0 + H + .15, cz);
  }
}
// дерево у дома: ствол и крона светлой зеленью, общие материалы
let treeM = null;
function tree(H, x, y, z, k = 1) {
  treeM ||= { trunk: wall(V.ink3, { rough: 1 }), leaf: wall(V.accent2, { rough: .95 }), geo: [new THREE.CylinderGeometry(.035, .05, .34, 6), new THREE.IcosahedronGeometry(.26, 1)] };
  const t = new THREE.Mesh(treeM.geo[0], treeM.trunk), c = new THREE.Mesh(treeM.geo[1], treeM.leaf);
  t.position.set(x, y + .17 * k, z); t.scale.setScalar(k); c.position.set(x, y + .46 * k, z); c.scale.set(k, k * 1.15, k);
  for (const o of [t, c]) { o.castShadow = o.receiveShadow = true; H.add(o); }
}
function buildHome(g, m, z = homeZ, opt = {}) {
  const home = { group: new THREE.Group(), glass: [], frames: [], floors: [], type: m.home.type }; homes.push(home); home.group.position.set(0, 0, z); g.add(home.group); const H = home.group;
  const FH = .72, floors = m.home.floors, apt = m.home.apt;
  // стены дома тем же процедурным фасадом, что и квартал; дверь у дома своя, поэтому noDoor
  const HW = wallMesh(24), HM = new THREE.Matrix4(), HP = new THREE.Vector3(), HS = new THREE.Vector3(); H.add(HW);
  let HWc = HW, HT = H; const HWs = [HW];
  const hput = (style, tone, o, x, y, z, sx, sy, sz) => { HWc.setColorAt(HWc.count, wallCode(style, tone, o)); HM.compose(HP.set(x, y, z), new THREE.Quaternion(), HS.set(sx, sy, sz)); HWc.setMatrixAt(HWc.count++, HM); };
  // глухие куски стен и мебель: коробки одного цвета без кромок
  const ip = (w, h, d, x, y, z, col = V.paper) => { const b = box(w, h, d, col, { edges: false, ao: false }); b.position.set(x, y, z); HT.add(b); return b; };
  // прихожая за дверью: ниша с внутренними гранями (BackSide), а не плашка; в стене перед ней оставлен проём ровно под дверь
  // пол темнее стен смесью палитры (sunken + control), иначе стена и пол сливаются в одно белое; светится только стена ниши, пол нет
  const floorTone = new THREE.Color(V.sunken).lerp(new THREE.Color(V.control), .45).getHex();
  const hallMat = () => { home.hallWall = new THREE.MeshStandardMaterial({ color: new THREE.Color(V.sunken).lerp(new THREE.Color(V.control), .3), emissive: V.tint, emissiveIntensity: 0, roughness: .9, side: THREE.BackSide }); const fl = new THREE.MeshStandardMaterial({ color: new THREE.Color(V.sunken).lerp(new THREE.Color(V.control), .7), roughness: .95, side: THREE.BackSide }); return [home.hallWall, home.hallWall, home.hallWall, fl, home.hallWall, home.hallWall]; };
  if (m.home.type === 'villa') {
    // вилла: два уровня, широкие витражи, терраса, бассейн, сад за стеной
    const base = box(3.4, .12, 3.2, floorTone, { edgeAlpha: .16 }); base.position.y = .06; H.add(base);
    // стены фасадом только в глубине дома; за остеклением не стена с нарисованными окнами, а комната: глухие панели, пол и мебель
    hput('plain', 'paper', { noDoor: true }, -.15, .12 + .425, -.575, 2.9, .85, 1.75);
    ip(2.6, .85, .04, -.15, .545, .33); ip(.3, .85, .95, -1.45, .545, .775); ip(.25, .85, .95, 1.175, .545, .775);
    ip(2.6, .13, .1, 0, .91, 1.21); ip(1.8, .13, .1, -.4, .185, 1.2); // на 1 см впереди простенка, иначе лица совпадали и мерцали
    // гостиная: ковёр, диван, столик, стеллаж, торшер
    const rug = slab(1.2, .8, V.tint, 1); rug.position.set(-.6, .125, .8); H.add(rug);
    ip(.8, .22, .32, -.6, .23, .5, V.control); ip(.8, .2, .08, -.6, .42, .38, V.control); ip(.4, .03, .3, -.6, .33, .95, V.ink3); ip(.06, .7, .5, .32, .47, .58, V.ink3); ip(.03, .5, .03, -1.15, .37, .45, V.ink3);
    home.lamps = [ip(.12, .12, .12, -1.15, .66, .45, V.tint), ip(.3, .02, .3, -.5, .95, .75, V.tint)];
    // остекление до дверного проёма, за дверью прихожая
    const gl1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, .6, .05), paneMat(true)); gl1.position.set(-.4, .55, 1.27); H.add(gl1); home.glass.push(gl1);
    hput('plain', 'paper', { noDoor: true }, .2, 1.4, -.825, 2.2, .8, 1.25);
    ip(2.0, .8, .04, .2, 1.4, -.17); ip(.2, .8, .95, -.8, 1.4, .275); ip(.2, .8, .95, 1.2, 1.4, .275); ip(1.8, .13, .1, .2, 1.74, .7); ip(1.8, .13, .1, .2, 1.06, .7);
    // спальня: кровать с изголовьем, шкаф, тумба
    ip(.9, .2, .6, .55, 1.135, .2); ip(.9, .3, .06, .55, 1.3, -.1, V.control); ip(.5, .7, .3, -.4, 1.385, -.02, V.ink3); ip(.25, .18, .25, .0, 1.125, -.05, V.ink3);
    home.lamps.push(ip(.3, .02, .3, .3, 1.78, .3, V.tint));
    const gl2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, .55, .05), paneMat(true)); gl2.position.set(.2, 1.4, .76); H.add(gl2); home.glass.push(gl2);
    const roof1 = box(3.1, .07, 2.9, V.sunken, { edgeAlpha: .16 }); roof1.position.set(-.15, 1.0, -.1); H.add(roof1);
    const roof2 = box(2.4, .07, 2.4, V.sunken, { edgeAlpha: .16 }); roof2.position.set(.2, 1.84, -.35); H.add(roof2);
    const terrace = slab(2.4, 1.2, V.paper, 1); terrace.position.set(-.5, 1.04, .9); H.add(terrace);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(1.8, .06, .9), ng(new THREE.MeshStandardMaterial({ color: V.accent, transparent: true, opacity: .35, roughness: .1, metalness: .3 }))); pool.position.set(-1.9, .11, 1.2); H.add(pool);
    const deck = slab(2.4, 1.4, V.paper, 1); deck.position.set(-1.9, .125, 1.2); H.add(deck);
    for (const [x, z] of [[.8, .9], [1.25, .9], [.8, .2], [1.25, .2]]) { const p = box(.05, .5, .05, V.ink3, { edges: false, ao: false }); p.position.set(x, 1.28, z); H.add(p); }
    const perg = box(.7, .04, .95, V.control, { alpha: .7, edgeAlpha: .2, ao: false }); perg.position.set(1.02, 1.55, .55); H.add(perg);
    // забор с калиткой: дорожка сделки начинается у двери и проходит в проём, камни не лежат под стеной
    for (const [x0, x1] of [[-2.3, .55], [1.65, 1.9]]) { const fence = box(x1 - x0, .35, .06, V.sunken, { edgeAlpha: .2 }); fence.position.set((x0 + x1) / 2, .29, 2.05); H.add(fence); }
    for (const x of [.55, 1.65]) ip(.1, .45, .1, x, .34, 2.05, V.control);
    { const hinge = new THREE.Group(); hinge.position.set(.62, .12, 2.05); hinge.rotation.y = -1.75; H.add(hinge); // створка открыта наружу, на улицу, мимо дорожки
      const leaf = box(.96, .3, .03, V.control, { edges: false, ao: false }); leaf.position.set(.48, .19, 0); hinge.add(leaf);
      for (const x of [.2, .48, .76]) { const bar = box(.02, .3, .035, V.ink3, { edges: false, ao: false }); bar.position.set(x, .19, 0); hinge.add(bar); } }
    for (const [x, z] of [[.85, 1.55], [.95, 1.8]]) ip(.34, .02, .2, x, .13, z, floorTone); // плитки от крыльца к калитке
    home.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, .84, 2.3)), ng(new THREE.LineBasicMaterial({ color: V.accent, transparent: true, opacity: 0 }))); home.frame.position.set(.2, 1.4, -.35); H.add(home.frame);
    home.roofY = 1.9; home.doorZ = 1.27; home.aptY = 1.4;
    home.pivot = new THREE.Group(); home.pivot.position.set(.55, .12, 1.3); H.add(home.pivot);
    const door = box(.5, .7, .05, V.accent, { edges: false, ao: false }); ng(door.material); door.position.set(.25, .35, 0); home.pivot.add(door); // верх .82, плита крыши с .965: запас, чтобы дверь не касалась крыши
    home.hall = new THREE.Mesh(new THREE.BoxGeometry(.48, .7, .86), hallMat()); home.hall.position.set(.8, .475, .84); H.add(home.hall); // на 1 см уже проёма и на 2 см от задней панели: совпавшие плоскости мерцали; низ ниши на 5 мм выше плиты основания, иначе z-fighting
    ip(.56, .02, .1, .8, .13, 1.3, V.ink3); // порог: тёмная черта между полом прихожей и крыльцом
    // рама проёма: два косяка и перемычка тёмным тоном, чтобы вход читался вырезом в стене
    ip(.04, .72, .06, .52, .48, 1.3, V.ink3); ip(.04, .72, .06, 1.08, .48, 1.3, V.ink3); ip(.6, .04, .06, .8, .86, 1.3, V.ink3);
  } else {
    // башня: этажи с балконными плитами, лента остекления, парапет, крыша с бассейном
    // opt.look меняет облик (столбики графика): стиль и тон фасада, плиты без балконов, без ленты стекла, своя кровля
    const lk = opt.look || {}, wStyle = lk.style || 'ribbon', wTone = lk.tone || 'paper', PW = lk.plate ?? 2.9, panes = lk.panes !== false, rails = lk.rails !== false;
    for (let i = 0; i < floors; i++) {
      if (opt.perFloor) { HT = new THREE.Group(); H.add(HT); home.floors.push(HT); HWc = wallMesh(4, makeFacade()); HT.add(HWc); HWs.push(HWc); }
      if (i) hput(wStyle, wTone, { tall: true, noDoor: true }, 0, i * FH + .36, 0, 2.4, .62, 2.4);
      else { hput(wStyle, wTone, { tall: true, noDoor: true }, 0, .36, -.45, 2.4, .62, 1.5); ip(.92, .62, .9, -.74, .36, .75); ip(.98, .62, .9, .71, .36, .75); }
      const plate = box(i ? PW : 2.9, .06, i ? PW : 2.9, i ? V.sunken : floorTone, { edgeAlpha: .14, ao: false }); plate.position.y = i * FH + .03; HT.add(plate);
      if (i > 0 && rails) for (const [x, z, w, d] of [[0, 1.42, 2.9, .04], [1.42, 0, .04, 2.9]]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(w, .3, d), new THREE.MeshStandardMaterial({ color: V.line, transparent: true, opacity: .55, roughness: .3, metalness: .4 })); rail.position.set(x, i * FH + .2, z); rail.userData.baseAlpha = .55; HT.add(rail); }
      // на первом этаже фасадной ленты нет: там дверной проём и витрины лобби по бокам, лента шла бы поперёк входа
      const gl = new THREE.Mesh(new THREE.BoxGeometry(2, .34, .05), paneMat()); gl.position.set(0, i * FH + .36, 1.22); if (i && panes) { HT.add(gl); home.glass.push(gl); }
      const glX = new THREE.Mesh(new THREE.BoxGeometry(.05, .34, 2), paneMat()); glX.position.set(1.22, i * FH + .36, 0); if (panes || !i) { HT.add(glX); home.glass.push(glX); }
      if (i === apt) { home.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.94, .7, 2.94)), ng(new THREE.LineBasicMaterial({ color: V.accent, transparent: true, opacity: 0 }))); home.frame.position.y = i * FH + .36; HT.add(home.frame); home.aptY = i * FH + .36; home.aptGlass = i ? [gl, glX] : [glX]; }
    }
    HT = H; HWc = HW;
    home.roofY = floors * FH;
    const roof = box(2.9, .06, 2.9, V.sunken, { edgeAlpha: .14, ao: false }); roof.position.y = home.roofY + .03; H.add(roof);
    const par = box(2.96, .16, 2.96, V.paper, { edgeAlpha: .2, ao: false }); par.position.y = home.roofY + .1; H.add(par);
    const crown = lk.crown || 'pool', ry = home.roofY; home.topY = ry + .6;
    if (crown === 'setback') {
      // надстройка с отступом от края и мачта: силуэт стеклянной башни
      hput(wStyle, wTone, { tall: true, noDoor: true }, -.2, ry + .5, -.25, 1.7, .62, 1.6);
      ip(1.84, .05, 1.74, -.2, ry + .84, -.25, V.sunken);
      ip(.05, .9, .05, .45, ry + 1.3, -.6, V.ink3); const tip = box(.09, .09, .09, V.accent, { edges: false, ao: false }); ng(tip.material); tip.position.set(.45, ry + 1.78, -.6); H.add(tip);
      home.topY = ry + .9;
    } else if (crown === 'garden') {
      // сад на крыше: кадки и кроны по углам
      for (const [x, z, k] of [[-.75, .7, 1], [.7, .65, .8], [-.6, -.7, .85], [.75, -.6, 1.05]]) { ip(.5 * k, .14, .5 * k, x, ry + .19, z, V.control); tree(H, x, ry + .26, z, .9 * k); }
    } else if (crown === 'tank') {
      // бак с водой на опорах и навес
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .5, 18), wall(V.control, { rough: .7 })); tank.position.set(-.6, ry + .58, -.5); tank.castShadow = tank.receiveShadow = true; H.add(tank);
      for (const [x, z] of [[-.82, -.72], [-.38, -.72], [-.82, -.28], [-.38, -.28]]) ip(.04, .2, .04, x, ry + .2, z, V.ink3);
      const awn = box(1.1, .04, .7, V.sunken, { edgeAlpha: .2, ao: false }); awn.position.set(.6, ry + .5, .5); H.add(awn);
      for (const [x, z] of [[.15, .25], [1.05, .25], [.15, .75], [1.05, .75]]) ip(.04, .32, .04, x, ry + .33, z, V.ink3);
    } else {
      const pool = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .9), ng(new THREE.MeshStandardMaterial({ color: V.accent, transparent: true, opacity: .35, roughness: .1, metalness: .3 }))); pool.position.set(-.5, ry + .09, .3); H.add(pool);
      for (const [x, z] of [[.5, -.8], [1.2, -.8], [.5, -.1], [1.2, -.1]]) { const p = box(.05, .5, .05, V.ink3, { edges: false, ao: false }); p.position.set(x, ry + .3, z); H.add(p); }
      const pergola = box(.9, .04, .9, V.control, { alpha: .7, edgeAlpha: .2, ao: false }); pergola.position.set(.85, ry + .56, -.45); H.add(pergola);
    }
    const canopy = box(1.3, .05, .7, V.sunken, { edgeAlpha: .2, ao: false }); canopy.position.set(0, .69, 1.5); H.add(canopy);
    for (const lx of [-.72, .72]) { const lobby = new THREE.Mesh(new THREE.BoxGeometry(.76, .5, .05), paneMat()); lobby.position.set(lx, .4, 1.23); H.add(lobby); }
    home.pivot = new THREE.Group(); home.pivot.position.set(-.28, .06, 1.26); H.add(home.pivot);
    const door = box(.5, .62, .05, V.accent, { edges: false, ao: false }); ng(door.material); door.position.set(.25, .31, 0); home.pivot.add(door); // верх двери .68, плита второго этажа начинается с FH = .72
    home.hall = new THREE.Mesh(new THREE.BoxGeometry(.48, .62, .86), hallMat()); home.hall.position.set(-.03, .375, .8); H.add(home.hall);
    ip(.56, .02, .1, -.03, .07, 1.28, V.ink3);
    ip(.04, .62, .06, -.31, .37, 1.26, V.ink3); ip(.04, .62, .06, .25, .37, 1.26, V.ink3); // косяки; перемычку заменяет козырёк
    home.doorZ = 1.25;
  }
  for (const w of HWs) w.instanceMatrix.needsUpdate = w.instanceColor.needsUpdate = true;
  home.halo = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.2, 56), ng(new THREE.MeshBasicMaterial({ color: V.accent, transparent: true, opacity: 0, side: THREE.DoubleSide }))); home.halo.rotation.x = -Math.PI / 2; home.halo.position.set(0, .05, 0); H.add(home.halo);
  home.FH = FH; return home;
}

// ---------- виды задников ----------
const HB_STAGES = []; // дорожка сделки из v20 в задниках не показывается, камни не строятся
const camB = new THREE.PerspectiveCamera(36, 1, .1, 900);
const VIEWS = {
  gorod: { cam: [8, 30, homeZ + 22], look: [0, 0, homeZ + 1], tall: { cam: [3, 30, homeZ + 12], look: [0, 0, homeZ + 6] }, hf: 60, sway: .28 }, // сверху на квартал: дом-башня в центре, кварталы и башни по краям, берег с пальмами у верхнего края
  bashni: { cam: [-14, 9, homeZ + 26], look: [4, 3, homeZ - 4], tall: { cam: [2, 22, homeZ + 11], look: [0, 0, homeZ + 7] }, hf: 70, sway: .1 }, // низко из глубины квартала: башни стоят стеной через весь кадр
  ulica: { cam: [2.4, 1.4, homeZ + 7.2], look: [-.4, 2.6, homeZ], tall: { cam: [1.8, 1.6, homeZ + 9.5], look: [0, 3.2, homeZ] }, hf: 72, sway: .06 }, // с улицы перед домом: дом рынка и соседи на уровне глаз
  sverhu: { cam: [0, 50, homeZ + 6], look: [0, 0, homeZ + 1], tall: { cam: [0, 56, homeZ + 3], look: [0, 0, homeZ + 2] }, hf: 56, sway: .14 }, // почти сверху: план квартала, кровли и парк
};

// ---------- объект: дом на подиуме, этажи по одному ----------
const objLights = [];
function buildObject(b) {
  const type = b.el.dataset.object === 'villa' ? 'villa' : 'tower', floors = clamp(parseInt(b.el.dataset.floors, 10) || 9, 2, 24);
  const g = new THREE.Group(); g.visible = false; scene.add(g); seed = 5;
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, .14, 56), wall(V.sunken, { rough: .95 })); podium.position.y = -.07; podium.receiveShadow = true; g.add(podium);
  const lawn = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.5, 56), new THREE.MeshStandardMaterial({ color: V.tint, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = .002; lawn.receiveShadow = true; g.add(lawn);
  const home = buildHome(g, { home: { type, floors, apt: -1 } }, 0, { perFloor: type === 'tower' });
  const L = new THREE.DirectionalLight(0xfff6e8, 1.0); L.position.set(6, 12, 7); L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -.0004; L.shadow.normalBias = .05;
  Object.assign(L.shadow.camera, { left: -6, right: 6, top: 10, bottom: -4, near: 1, far: 40 }); g.add(L); g.add(L.target); objLights.push(L);
  // выделение этажа: полупрозрачный объём и рамка цветом акцента (на тёмном мята)
  const mk = new THREE.Group(); mk.visible = false; g.add(mk);
  mk.add(new THREE.Mesh(new THREE.BoxGeometry(2.98, .66, 2.98), ng(new THREE.MeshBasicMaterial({ color: V.accent, transparent: true, opacity: .16, depthWrite: false }))));
  mk.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.02, .7, 3.02)), ng(new THREE.LineBasicMaterial({ color: V.accent }))));
  const H = home.roofY || 2;
  b.o = { g, home, mk, H, yaw: .7, vy: 0, drag: null, floor: 0, cam: new THREE.PerspectiveCamera(32, 1, .1, 200), shadow: false };
  applyNight(nightNow);
  setFloor(b, parseInt(b.el.dataset.floor, 10) || 0);
  if (b.el.hasAttribute('data-floor-slider') && home.floors.length) floorSlider(b);
  if (b.el.hasAttribute('data-interactive')) dragYaw(b);
}
// прозрачность этажа: материалы этажа гаснут до a, исходная прозрачность помнится
function fadeTo(group, a) { group.traverse(o => { const m = o.material; if (!m || m.opacity === undefined || o.userData.noFade) return; if (m.userData.t0 === undefined) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity; m.userData.d0 = m.depthWrite; } m.opacity = m.userData.o0 * a; m.transparent = m.userData.t0 || a < 1; m.depthWrite = a < 1 ? false : m.userData.d0; m.needsUpdate = true; }); }
function setFloor(b, n) {
  const o = b.o; if (!o || !o.home.floors.length) return; n = clamp(n | 0, 0, o.home.floors.length); o.floor = n;
  o.home.floors.forEach((fg, i) => fadeTo(fg, n && i !== n - 1 ? .22 : 1));
  o.mk.visible = !!n; if (n) o.mk.position.y = (n - 1) * o.home.FH + .36;
  if (o.out) o.out.value = n ? `Этаж ${n} из ${o.home.floors.length}` : 'Все этажи';
  if (o.range && +o.range.value !== n) o.range.value = n;
  b.stale = true;
}
let uid = 0;
function floorSlider(b) {
  const ui = document.createElement('div'), id = 'hb3d-floor-' + (++uid); ui.className = 'hb3d__ui';
  const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = 'Этаж';
  const r = document.createElement('input'); r.type = 'range'; r.id = id; r.min = 0; r.max = b.o.home.floors.length; r.step = 1; r.value = b.o.floor;
  const out = document.createElement('output'); out.htmlFor = id;
  ui.append(lb, r, out); b.el.appendChild(ui); b.o.range = r; b.o.out = out; setFloor(b, b.o.floor);
  r.addEventListener('input', () => setFloor(b, +r.value));
}
function dragYaw(b) {
  const o = b.o, cv = b.cv; let x0 = 0, y0 = 0;
  cv.addEventListener('pointerdown', e => { o.drag = { x: e.clientX, yaw: o.yaw }; x0 = e.clientX; y0 = e.clientY; o.vy = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => { if (!o.drag) return; const ny = o.drag.yaw - (e.clientX - o.drag.x) / Math.max(240, b.el.clientWidth) * 4; o.vy = (ny - o.yaw) * 60; o.yaw = ny; b.stale = true; });
  const up = e => { if (!o.drag) return; o.drag = null; cv.style.cursor = ''; try { cv.releasePointerCapture(e.pointerId); } catch (_) {} };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function objectCam(b, w, h) {
  const o = b.o, c = o.cam, a = w / h; c.aspect = a; c.updateProjectionMatrix();
  const half = Math.max(o.H * .62 + .4, 2.6), dist = half / Math.tan(c.fov * Math.PI / 360) * 1.18 / Math.min(1, a * 1.15), el = .32;
  const ty = o.H * .5; c.position.set(Math.sin(o.yaw) * Math.cos(el) * dist, ty + Math.sin(el) * dist, Math.cos(o.yaw) * Math.cos(el) * dist); c.lookAt(0, ty, 0);
}

// ---------- башни-столбики: высота линейна значению, подпись значения обязательна ----------
// облики башен по очереди: высоту задаёт только значение, разные фасад, тон, ширина, кровля и посадка деревьев
const BAR_LOOKS = [
  { w: 1, trees: [[-1.75, 1.1, 1], [1.8, .6, .8]] },
  { w: .86, style: 'glass', tone: 'tint', plate: 2.46, panes: false, rails: false, crown: 'setback', trees: [[1.6, 1.2, .9]] },
  { w: 1.08, style: 'balcony', tone: 'tint', plate: 2.5, panes: false, rails: false, crown: 'garden', trees: [[-1.8, .9, .85], [-1.5, -.9, 1], [1.8, 1.1, .75]] },
  { w: .94, style: 'bands', tone: 'sunken', rails: true, panes: false, crown: 'tank', trees: [[1.75, -.6, 1], [-1.75, 1.2, .9]] },
];
function buildBars(b) {
  const data = barsData(b.el); const g = new THREE.Group(); g.visible = false; scene.add(g); seed = 17;
  // каждый столбик - башня из buildHome (плиты, стёкла, перила, парапет), уменьшенная до S; число этажей по значению, точную высоту добирает масштаб по y
  const S = .6, FHs = .72 * S, n = Math.max(1, data.length), max = Math.max(...data.map(d => +d.v || 0), 1), STEP = 2.5, W = (n - 1) * STEP;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 3.4, .12, 4), wall(V.sunken, { rough: .95 })); base.position.y = -.06; base.receiveShadow = true; g.add(base);
  const bars = data.map((d, i) => { const h = Math.max(.02, (+d.v || 0) / max * 7); const lab = callout(b.el, 'co--bar'); lab.el.textContent = ''; const strong = document.createElement('b'); strong.textContent = barText(b.el, d); lab.el.append(strong);
    // подпись категории - на оси под своей башней, как у обычного графика
    const ax = document.createElement('div'); ax.className = 'bar-axis'; ax.textContent = d.label; ax.setAttribute('aria-hidden', 'true'); b.el.appendChild(ax);
    const lk = BAR_LOOKS[i % BAR_LOOKS.length], home = buildHome(g, { home: { type: 'tower', floors: Math.max(1, Math.round(h / FHs)), apt: -1 } }, 0, { look: lk }); home.group.position.x = -W / 2 + i * STEP;
    // у подножия деревья: у каждой башни своя посадка
    for (const [x, z, k] of lk.trees) tree(home.group, x, .06, z, k);
    return { x: -W / 2 + i * STEP, h, lab, ax, home, wk: lk.w, sy: h / (home.roofY * S), top: new THREE.Vector3() }; });
  const L = new THREE.DirectionalLight(0xfff6e8, 1.0); L.position.set(-5, 11, 9); L.castShadow = true; L.shadow.mapSize.set(2048, 1024); L.shadow.bias = -.0004; L.shadow.normalBias = .05;
  Object.assign(L.shadow.camera, { left: -W / 2 - 3, right: W / 2 + 3, top: 9, bottom: -4, near: 1, far: 40 }); g.add(L); g.add(L.target); objLights.push(L);
  b.r = { g, bars, W, W0: W, base, L, step: STEP, S, k: live ? 0 : 1, cam: new THREE.PerspectiveCamera(30, 1, .1, 200) };
  setBarK(b, b.r.k); applyNight(nightNow);
  // наведение и касание: подсказку даёт башня, ближайшая к указателю по горизонтали
  // плашка сбоку от середины башни, подпись выбранной башни выделяется
  const mark = i => b.r.bars.forEach((s, j) => s.lab.el.classList.toggle('is-tip', j === i));
  const tipBar = e => { if (!window.hbTip) return; const r = b.el.getBoundingClientRect(), v = new THREE.Vector3(); let best = -1, bd = Infinity, bx = 0;
    b.r.bars.forEach((s, i) => { v.copy(s.top).project(b.r.cam); const x = r.left + (v.x + 1) / 2 * r.width, dd = Math.abs(x - e.clientX); if (dd < bd) { bd = dd; best = i; bx = x; } });
    if (best < 0 || bd > r.width / Math.max(2, data.length) / 2) { hbTip.hide(); mark(-1); return; }
    const s = b.r.bars[best], yTop = v.copy(s.top).project(b.r.cam).y, yBase = v.set(s.x, 0, 0).project(b.r.cam).y, y = r.top + (1 - (yTop + yBase) / 2) / 2 * r.height;
    hbTip.show(bx + 24, y, barTip(b.el, data, best), true); mark(best); };
  b.el.dataset.tipArea = ''; b.el.addEventListener('pointermove', tipBar); b.el.addEventListener('pointerdown', tipBar);
  b.el.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && window.hbTip) { hbTip.hide(); mark(-1); } });
}
function setBarK(b, k) {
  // рост: башня вытягивается по y от земли; тени пересчитываются на каждом шаге, иначе остаются от прошлого кадра
  const r = b.r; r.k = k; const e = smooth(k);
  r.bars.forEach(s => { const sy = Math.max(.003, s.sy * e); s.home.group.scale.set(r.S * s.wk, r.S * sy, r.S * s.wk); s.top.set(s.x, (s.home.topY ?? s.home.roofY) * r.S * sy + .22 * r.S, 0); });
  renderer.shadowMap.needsUpdate = true;
}
// узкий режим включается, когда в обычном подписи соседних столбиков пересеклись; запоминается для этой ширины блока
const barsTight = (b, w) => b.r.tw === w;
function barsCam(b, w, h) {
  // узкий блок: сверху два ряда подписей, сцена вписывается в оставшуюся высоту и сдвигается под них
  // снизу полоса под подписи оси
  const r = b.r, c = r.cam, tight = barsTight(b, w), top = tight ? Math.min(h * .45, 2 * (r.bars[0]?.lab.el.offsetHeight || 36) + 22) : 0, bot = (r.axh || 20) + 6, hh = h - top - bot, a = w / hh; c.aspect = a;
  // широкий блок: ряд раздвигается на ширину кадра, иначе башни жмутся в середину и подписям оси не хватает места
  const n = r.bars.length, t = Math.tan(c.fov * Math.PI / 360), halfH = 4.5;
  if (n > 1) { const vis = halfH * 1.08 * a, step = tight ? 2.5 : Math.min(4.5, Math.max(2.5, (vis * .82 - 1.6) * 2 / (n - 1)));
    if (step !== r.step) { r.step = step; r.W = (n - 1) * step; r.base.scale.x = (r.W + 3.4) / (r.W0 + 3.4);
      r.bars.forEach((s, i) => { s.x = -r.W / 2 + i * step; s.home.group.position.x = s.x; s.top.x = s.x; });
      Object.assign(r.L.shadow.camera, { left: -r.W / 2 - 3, right: r.W / 2 + 3 }); r.L.shadow.camera.updateProjectionMatrix(); } }
  const halfW = r.W / 2 + 1.6, dist = Math.max(halfH / t, halfW / (t * a)) * 1.08;
  // камера на три четверти справа: видно две грани башен, правая в тени, объём читается
  // камера прямо перед рядом и сверху: ось башен горизонтальна, как у обычного графика; объём читается по крышам и боковым граням крайних башен
  // сдвиг кадра вместо наклона: камера смотрит горизонтально, середина ряда опускается в центр кадра сдвигом окна, вертикали башен остаются вертикальными
  const Y = 3.9 + dist * .3, shift = (Y - 3.8) / (dist * t) * hh / 2;
  c.position.set(0, Y, dist); c.lookAt(0, Y, 0);
  c.setViewOffset(w, hh, 0, -top + shift, w, h); c.updateProjectionMatrix();
}

// ---------- кровли: изометрия поля домов, медленный дрейф ----------
let roofs = null;
function buildRoofs() {
  if (roofs) return roofs; const g = new THREE.Group(); g.visible = false; scene.add(g);
  const COLS = 7, PER = 3, ROWS = 9, S = 1.7, total = COLS * PER, n = total * ROWS; seed = 29;
  const hipGeo = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(Math.SQRT2, 1, Math.SQRT2);
  const wallsA = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wall(V.paper, { rough: .9 }), n), wallsB = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wall(V.sunken, { rough: .9 }), n);
  const roofAcc = new THREE.InstancedMesh(hipGeo, ng(wall(V.accent, { rough: .9 })), n), roofT = new THREE.InstancedMesh(hipGeo, wall(V.tint, { rough: .95 }), n);
  const sets = [wallsA, wallsB, roofAcc, roofT]; for (const m of sets) { m.count = 0; m.frustumCulled = false; g.add(m); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const put = (m, x, y, z, sx, sy, sz) => { M.compose(P.set(x, y, z), Q, Sc.set(sx, sy, sz)); m.setMatrixAt(m.count++, M); };
  // рисунок повторяется каждые 7 колонок: при дрейфе поле заворачивается без шва; крыш цвета акцента около 16%, как в паттерне «Кровли»
  const cell = []; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) cell.push({ acc: hash(c * 3.1, r * 7.7) < .16, h: .5 + Math.floor(hash(c + 9, r + 2) * 3) * .28, tone: hash(c + 2, r * 5) < .5 });
  for (let k = 0; k < total; k++) for (let r = 0; r < ROWS; r++) { const cl = cell[(k % COLS) * ROWS + r], x = (k - total / 2) * S + (r % 2) * S * .5, z = (r - ROWS / 2) * S;
    put(cl.tone ? wallsA : wallsB, x, cl.h / 2, z, 1, cl.h, 1); put(cl.acc ? roofAcc : roofT, x, cl.h + .23, z, .62, .46, .62); }
  for (const m of sets) m.instanceMatrix.needsUpdate = true;
  const L = new THREE.DirectionalLight(0xffffff, .9); L.position.set(-6, 10, 4); g.add(L); objLights.push(L);
  roofs = { g, period: COLS * S, t: 0, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100) }; applyNight(nightNow); return roofs;
}
function roofsCam(w, h) { const c = roofs.cam, a = w / h, vh = a < 1 ? 6.5 : 5.2; c.left = -vh * a; c.right = vh * a; c.top = vh; c.bottom = -vh; c.updateProjectionMatrix(); c.position.set(20, 22, 20); c.lookAt(0, 0, 0); }

// ---------- вечер ----------
function applyNight(n) {
  nightNow = n;
  for (const r of NL) r.m.color.setHex(r.d).lerp(tmpC.setHex(r.n), n);
  scene.fog.color.setHex(V.page).lerp(tmpC.setHex(DARK_PAGE), n);
  hemi.intensity = lerp(.34, .22, n); hemi.color.setHex(0xffffff).lerp(tmpC.setHex(V.control), n); sun.intensity = lerp(.32, 0, n);
  cityLight.intensity = lerp(1.0, .06, n); for (const L of objLights) L.intensity = lerp(.95, .22, n); expCity = lerp(EXP_DAY, 1, n);
  if (seaMat) { seaMat.uniforms.night.value = n; seaMat.uniforms.c.value.setHex(V.accent).lerp(MINT, n); }
  // окна квартала зажигает шейдер фасада; дверь фасада и кромка шара тоже уходят в мяту
  FU.uNight.value = n; FU.uLit.value.setHex(V.accent2).lerp(tmpC.setHex(V.tint), n); FU.uDoor.value.setHex(V.accent).lerp(MINT, n);
  rim.material.uniforms.c.value.setHex(V.accent).lerp(MINT, n);
  for (const h of homes) { if (h.hallWall) h.hallWall.emissiveIntensity = Math.max(h.hall.userData.door || 0, n * .3); if (h.lamps) for (const l of h.lamps) { l.material.emissive.setHex(V.tint); l.material.emissiveIntensity = n * .6; } }
  // планета вечером: шар темнеет, суша мятой и светлее, иначе точки тонут в сером шаре
  sphere.material.color.setHex(V.paper).lerp(tmpC.setHex(V.ink2), n * .8); landMat.color.setHex(V.accent).lerp(MINT, n).lerp(tmpC.setHex(V.tint), n * .3);
  markMat.map = n > .5 ? markNight : markDay; for (const pin of pins) if (pin.pulse) pin.pulse.material.map = n > .5 ? echoNight : echoDay;
  for (const b of B) b.stale = true;
}
const isNight = () => root.classList.contains('dusk') || root.getAttribute('data-theme') === 'dark';
let nightTarget = isNight() ? 1 : 0;

// ---------- блоки ----------
const typeOf = el => el.hasAttribute('data-globe') ? 'globe' : el.matches('.bg3d') ? 'back' : el.hasAttribute('data-object') ? 'object' : el.hasAttribute('data-bars') ? 'bars' : 'roofs';
const B = els.map(el => { let cv = el.querySelector(':scope > canvas'); if (!cv) { cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); el.prepend(cv); } return { el, cv, ctx: null, type: typeOf(el), on: false, near: false, ready: false, stale: true }; });
// сцена задников строит один квартал: город первого задника с data-city, иначе Дубай
let cityKey = (B.find(b => b.type === 'back' && b.el.dataset.city) || { el: { dataset: {} } }).el.dataset.city;
if (!HB_CITY[cityKey]) cityKey = HB_CITY.dubai ? 'dubai' : Object.keys(HB_CITY)[0];
let cityReady = false, cityShadow = false, backClock = 0;
const stat = { draws: 0 };

function setupGlobe(b) {
  const d = b.el.dataset, aim = (d.aim || '22,75').split(',').map(Number), pinsSel = (d.pins || 'all').split(',').map(s => s.trim());
  const mk = (d.markets || 'all').trim(), mKeys = mk === 'none' ? [] : mk === 'all' ? HB_MARKETS.map(m => m.key) : mk.split(',').map(s => s.trim());
  const slug = c => c.path.split('/').pop();
  const s = b.g = { q: aimQ(aim[0], aim[1] || 0), yaw: 0, pitch: 0, vy: 0, vp: 0, drag: null, down: null, idle: 0, focus: null, cam: new THREE.PerspectiveCamera(40, 1, .1, 900), camA: new THREE.Vector3(), lookA: new THREE.Vector3(),
    right: d.place === 'right', show: new Set(pins.filter(p => pinsSel[0] === 'all' || pinsSel.includes(slug(p.c))).map(p => p)), echo: new Set(pins.filter(p => p.market && mKeys.includes(p.market.key))), arcs: arcsFor(mKeys), labels: new Map(),
    avoid: d.place === 'right' ? [...document.querySelectorAll('[data-hb3d-avoid], .hero__l')] : [...b.el.querySelectorAll('[data-hb3d-avoid]')] };
  // data-pin-href: в макетах все подписи ведут на страницу-образец страны, иначе путь страны из HB_COUNTRIES
  for (const p of s.show) { const o = callout(b.el, 'co--pin', d.pinHref || p.c.path); setLabel(o, p.c.name, p.c.n); o.el.dataset.tip = pinTip(p); s.labels.set(p, o); }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), hits = () => [...s.show].map(p => p.hit);
  const pick = e => { const r = b.cv.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, s.cam); return ray.intersectObjects(hits(), false)[0]; };
  // метка поворачивает планету к стране толчком с затуханием (тот же ход, что у руки)
  // порядок поворотов: сначала рысканье вокруг вертикали экрана, потом наклон вокруг оси экрана X,
  // поэтому вертикальное движение руки не инвертируется после поворота планеты на 180°
  const facePin = pin => { const n0 = pin.normal.clone().applyQuaternion(s.q), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const yawT = Math.atan2(s.cam.position.x, s.cam.position.z) - Math.atan2(n0.x, n0.z);
    const y1 = n0.y, z1 = -n0.x * Math.sin(yawT) + n0.z * Math.cos(yawT);
    const rho = Math.hypot(y1, z1), al = Math.atan2(z1, y1), c = Math.acos(clamp(.3 / rho, -1, 1));
    const pitch = clamp([wrap(c - al), wrap(-c - al)].sort((x, y) => Math.abs(x) - Math.abs(y))[0], -.7, .7);
    const yaw = s.yaw + wrap(yawT - s.idle - s.yaw);
    const k = -Math.log(.08); s.vy = (yaw - s.yaw) * k; s.vp = (pitch - s.pitch) * k; s.focus = pin; b.stale = true; };
  b.cv.style.touchAction = 'pan-y';
  b.cv.addEventListener('pointerdown', e => { s.down = { x: e.clientX, y: e.clientY, yaw: s.yaw, pitch: s.pitch, moved: 0 }; s.drag = true; s.vy = s.vp = 0; b.cv.setPointerCapture(e.pointerId); });
  b.cv.addEventListener('pointermove', e => {
    if (s.down && s.drag) { const dx = e.clientX - s.down.x, dy = e.clientY - s.down.y; s.down.moved = Math.hypot(dx, dy); const k = 1 / Math.max(300, b.el.clientWidth) * 3.2; const ny = s.down.yaw + dx * k, np = clamp(s.down.pitch + dy * k * .6, -.7, .7); s.vy = (ny - s.yaw) * 60; s.vp = (np - s.pitch) * 60; s.yaw = ny; s.pitch = np; b.stale = true; return; }
    const hit = pick(e); b.cv.style.cursor = hit ? 'pointer' : 'grab';
    if (window.hbTip && e.pointerType !== 'touch') { if (hit) hbTip.show(e.clientX, e.clientY - 12, pinTip(pins.find(p => p.hit === hit.object))); else hbTip.hide(); } });
  b.cv.addEventListener('pointerleave', () => window.hbTip && hbTip.hide());
  b.cv.addEventListener('pointerup', e => { s.drag = false; try { b.cv.releasePointerCapture(e.pointerId); } catch (_) {} if (!s.down) return; const click = s.down.moved < 6; s.down = null; if (!click) return; const h = pick(e); if (h) facePin(pins.find(p => p.hit === h.object)); });
  b.cv.addEventListener('pointercancel', () => { s.drag = false; s.down = null; });
  b.ready = true;
}
// камера планеты: data-place="right" повторяет кадр главной (планета в правой половине, на телефоне сверху), иначе планета по центру блока
function globeCam(b, w, h) {
  const s = b.g, c = s.cam; c.aspect = w / h;
  if (s.right) { const mobile = w < 900; c.fov = mobile ? 52 : 40; if (mobile) c.setViewOffset(w, h * 1.45, 0, h * .45, w, h); else c.clearViewOffset(); c.updateProjectionMatrix();
    if (mobile) { s.camA.set(0, .9, 22); s.lookA.set(0, -.6, 0); } else { const H = Math.max(R / (2 * .32), R / (2 * .2) / c.aspect), side = -.5 * H * c.aspect; s.camA.set(side, .9, H / Math.tan(20 * Math.PI / 180)); s.lookA.set(side, .15, 0); } }
  else { c.fov = 40; c.clearViewOffset(); c.updateProjectionMatrix(); const dist = R * 1.3 / Math.tan(20 * Math.PI / 180) / Math.min(1, c.aspect); s.camA.set(0, .6, dist); s.lookA.set(0, 0, 0); }
  c.position.copy(s.camA); c.up.set(0, 1, 0); c.lookAt(s.lookA); c.updateMatrixWorld();
}
const pulseClock = { t: 0 };
function globeFrame(b, w, h) {
  const s = b.g; globeCam(b, w, h);
  globe.quaternion.copy(s.q);
  if (s.idle || s.yaw || s.pitch) { userQ.setFromAxisAngle(X, s.pitch).multiply(tmpQ.setFromAxisAngle(Y, s.idle + s.yaw)); globe.quaternion.premultiply(userQ); }
  globe.updateMatrixWorld(true);
  for (const [, grp] of arcSets) grp.visible = grp === s.arcs;
  pins.forEach((p, i) => { p.g.visible = s.show.has(p); if (p.pulse) { const on = live && s.echo.has(p); p.pulse.visible = on; if (on) { const k = (pulseClock.t * .45 + i * .17) % 1; p.pulse.scale.setScalar(1 + k * 1.2); p.pulse.material.opacity = (1 - k) * .5; } } });
  // подписи стран сверяются по месту, где легли на самом деле, и не ложатся друг на друга; у первого экрана подпись не уходит под шапку
  const camDir = s.cam.position.clone().sub(s.lookA).normalize(), placed = [], top = document.querySelector('.top');
  const minTop = s.right && top ? Math.max(8, top.offsetHeight - (b.el.getBoundingClientRect().top + scrollY) + 8) : 8;
  const order = s.focus ? [s.focus, ...[...s.show].filter(x => x !== s.focus)] : [...s.show];
  for (const p of order) { const lab = s.labels.get(p); if (!lab) continue; const nW = p.normal.clone().applyQuaternion(globe.quaternion), at = p.top.getWorldPosition(new THREE.Vector3());
    lab.at(at, nW.dot(camDir) > .42, s.cam, { stem: 16, minTop, avoid: s.avoid });
    if (lab.on) { const bx = lab.box, r = [bx.cx - bx.w / 2 - 4, bx.ay - bx.h - 16, bx.cx + bx.w / 2 + 4, bx.ay]; if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) lab.at(at, false, s.cam); else placed.push(r); }
    lab.el.classList.toggle('co--sel', p === s.focus); }
}
function backCam(b, w, h) {
  const v = VIEWS[b.el.dataset.view] || VIEWS.gorod, a = w / h;
  camB.aspect = a; camB.fov = clamp(2 * Math.atan(Math.tan(v.hf * Math.PI / 360) / a) * 180 / Math.PI, 26, 70); camB.updateProjectionMatrix();
  const tt = smooth((2 - a) / 1.2), look = new THREE.Vector3(...v.look).lerp(new THREE.Vector3(...v.tall.look), tt);
  camB.position.set(...v.cam).lerp(new THREE.Vector3(...v.tall.cam), tt).sub(look).applyAxisAngle(Y, live ? Math.sin(backClock * .06) * v.sway : 0).add(look); camB.up.set(0, 1, 0); camB.lookAt(look);
}

// размер закадрового холста: наибольший из блоков на странице
let RW = 0, RH = 0;
function fit(w, h) { const nw = Math.max(RW, Math.ceil(w)), nh = Math.max(RH, Math.ceil(h)); if (nw !== RW || nh !== RH) { RW = nw; RH = nh; renderer.setSize(RW, RH, false); } }
function show(type, b) { globe.visible = type === 'globe'; city.visible = type === 'back'; for (const x of B) { if (x.o) x.o.g.visible = x === b; if (x.r) x.r.g.visible = x === b; } if (roofs) roofs.g.visible = type === 'roofs'; }
function draw(b) {
  const w = b.el.clientWidth, h = b.el.clientHeight; if (!w || !h) return false;
  fit(w, h); show(b.type, b);
  let cam, exp = expCity;
  if (b.type === 'globe') { globeFrame(b, w, h); cam = b.g.cam; exp = 1; }
  else if (b.type === 'back') { backCam(b, w, h); cam = camB; if (!cityShadow) { renderer.shadowMap.needsUpdate = true; cityShadow = true; } }
  // у объекта и столбиков свой направленный свет поверх общего: без поправки крыши и подиум уходят в чистый белый
  else if (b.type === 'object') { objectCam(b, w, h); cam = b.o.cam; exp = expCity * OBJ_EXP; if (!b.o.shadow) { renderer.shadowMap.needsUpdate = true; b.o.shadow = true; } }
  else if (b.type === 'bars') { barsCam(b, w, h); cam = b.r.cam; exp = expCity * OBJ_EXP; }
  else { roofsCam(w, h); roofs.g.position.x = -(roofs.t % roofs.period); cam = roofs.cam; }
  renderer.toneMappingExposure = exp;
  renderer.setScissorTest(true); renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.render(scene, cam); renderer.setScissorTest(false);
  const cw = Math.floor(w * PR), ch = Math.floor(h * PR); if (b.cv.width !== cw || b.cv.height !== ch) { b.cv.width = cw; b.cv.height = ch; }
  const ctx = b.ctx || (b.ctx = b.cv.getContext('2d')); ctx.clearRect(0, 0, cw, ch); ctx.drawImage(canvas, 0, canvas.height - ch, cw, ch, 0, 0, cw, ch);
  // узкий блок: подписи соседних столбиков налезают, нечётные поднимаются на высоту подписи
  if (b.type === 'bars') { const tight = barsTight(b, w); b.el.classList.toggle('is-tight', tight); b.r.bars.forEach((s, i) => {
    // узко: подписи компактные, в два ряда вперемежку, ножка тянется до крыши столбика
    let stem = 10; if (tight) { const v = s.top.clone().project(cam), ay = (1 - v.y) / 2 * h, lh = s.lab.el.offsetHeight, rowTop = 8 + (i % 2) * (lh + 6); stem = Math.max(6, ay - rowTop - lh); }
    s.lab.el.style.setProperty('--stem', stem + 'px'); s.lab.at(s.top, true, cam, { stem });
    // год под башней: точка на передней кромке основания под центром башни, подпись сразу под ней
    // ширина подписи не больше шага между башнями: длинная переносится на вторую строку, а не налезает на соседнюю
    const v = new THREE.Vector3(s.x, 0, 2).project(cam), n = b.r.bars.length, step = n > 1 ? Math.abs(new THREE.Vector3(b.r.bars[1].x, 0, 2).project(cam).x - new THREE.Vector3(b.r.bars[0].x, 0, 2).project(cam).x) / 2 * w : w;
    s.ax.style.maxWidth = Math.max(56, step - 8) + 'px'; s.ax.style.left = ((v.x + 1) / 2 * w) + 'px'; s.ax.style.top = Math.min(h - s.ax.offsetHeight - 4, (1 - v.y) / 2 * h + 6) + 'px'; });
    // полоса под подписями по самой высокой подписи: выросла после переноса - кадр перестраивается
    const axh = Math.max(...b.r.bars.map(s => s.ax.offsetHeight)); if (axh !== b.r.axh) { b.r.axh = axh; b.r.redo = true; }
    if (!tight && b.r.bars.some((s, i) => { const p = b.r.bars[i - 1]?.lab.box, q = s.lab.box; return p && q && Math.abs(q.cx - p.cx) < (p.w + q.w) / 2 + 4 && Math.abs(q.ay - p.ay) < (p.h + q.h) / 2 + 4; })) { b.r.tw = w; b.r.redo = true; } }
  if (!b.el.classList.contains('is-live')) b.el.classList.add('is-live');
  b.stale = !!(b.r && b.r.redo); if (b.r) b.r.redo = false; stat.draws++; stat.calls = renderer.info.render.calls; stat.tris = renderer.info.render.triangles; return true;
}
function build(b) {
  if (b.ready) return;
  if (b.type === 'globe') setupGlobe(b);
  else if (b.type === 'back') { if (!cityReady) { const t0 = performance.now(); buildCity(HB_CITY[cityKey]); stat.buildMs = Math.round(performance.now() - t0); cityReady = true; cityShadow = false; } b.ready = true; }
  else if (b.type === 'object') { buildObject(b); b.ready = true; }
  else if (b.type === 'bars') { buildBars(b); b.ready = true; }
  else { buildRoofs(); b.ready = true; }
}
// живой блок перерисовывается сам; остальные только по делу (stale)
const animating = b => live && (b.type === 'globe' || b.type === 'back' || b.type === 'roofs' || (b.type === 'object' && !b.o.drag) || (b.type === 'bars' && b.r.k < 1));

// планета первого экрана строится сразу, остальные блоки за полтора экрана до появления
const near = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const b = B.find(x => x.el === e.target); near.unobserve(e.target); try { build(b); b.stale = true; } catch (err) { fail('build: ' + err.message); } } }, { rootMargin: '150% 0px' });
const seen = new IntersectionObserver(es => { for (const e of es) { const b = B.find(x => x.el === e.target); b.on = e.isIntersecting; if (b.on) b.stale = true; } });
for (const b of B) { near.observe(b.el); seen.observe(b.el); }
const ro = new ResizeObserver(() => { for (const b of B) b.stale = true; }); for (const b of B) ro.observe(b.el);
new MutationObserver(() => { const t = isNight() ? 1 : 0; if (t !== nightTarget) { nightTarget = t; if (reduced) applyNight(t); } }).observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
applyNight(nightTarget);

let last = performance.now(), lastDraw = 0;
function loop(now) {
  if (stopped) return; requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (document.visibilityState !== 'visible') return;
  if (nightNow !== nightTarget) applyNight(clamp(nightNow + (nightTarget ? 1 : -1) * dt * 1.6, 0, 1));
  for (const b of B) {
    if (b.g) { const s = b.g; if (live && !s.drag && b.on) s.idle += dt * .05;
      if (!s.drag && (Math.abs(s.vy) > .001 || Math.abs(s.vp) > .001)) { s.yaw += s.vy * dt; s.pitch = clamp(s.pitch + s.vp * dt, -.7, .7); s.vy *= Math.pow(.08, dt); s.vp *= Math.pow(.08, dt); b.stale = true; } }
    if (b.o) { const o = b.o; if (!o.drag && Math.abs(o.vy) > .001) { o.yaw += o.vy * dt; o.vy *= Math.pow(.05, dt); b.stale = true; } else if (live && !o.drag && b.on) o.yaw += dt * .12; }
    if (b.r && live && b.on && b.r.k < 1) setBarK(b, Math.min(1, b.r.k + dt / 1.4));
  }
  if (now - lastDraw < 33) return; // не чаще 30 кадров в секунду
  const fdt = Math.min(.1, (now - lastDraw) / 1000); lastDraw = now;
  if (live) { pulseClock.t += fdt; arcMat.dashOffset -= fdt * .12; if (roofs) roofs.t += fdt * .25;
    if (cityReady && B.some(b => b.type === 'back' && b.on)) { backClock += fdt; seaMat.uniforms.t.value = backClock;
      for (const c of cars) { c.position.x += c.userData.v * fdt; if (c.position.x > 23) c.position.x = -23; else if (c.position.x < -23) c.position.x = 23; }
      for (const bt of boats) { bt.position.x += bt.userData.v * fdt; if (bt.position.x > 40) bt.position.x = -40; else if (bt.position.x < -40) bt.position.x = 40; bt.position.y = .04 + Math.sin(backClock * 1.3 + bt.userData.i) * .02; bt.rotation.z = Math.sin(backClock * .9 + bt.userData.i) * .04; } } }
  for (const b of B) if (b.on && b.ready && (b.stale || animating(b))) draw(b);
}
requestAnimationFrame(loop);

// ---------- API ----------
window.HBScene = {
  ready: () => B.map(b => ({ type: b.type, ready: b.ready, live: b.el.classList.contains('is-live') })),
  setCity(key) { if (!HB_CITY[key]) return false; cityKey = key; if (cityReady) { buildCity(HB_CITY[key]); cityShadow = false; for (const b of B) if (b.type === 'back') b.stale = true; } return true; },
  highlightFloor(n, el) { for (const b of B) if (b.type === 'object' && (!el || b.el === el)) { if (!b.ready) build(b); setFloor(b, n || 0); } },
  redraw() { for (const b of B) b.stale = true; },
  info: () => ({ live, reduced, phone: isPhone, px: PR, size: [RW, RH], city: cityKey, err: window.__sceneErr || null, ...stat }),
  views: Object.keys(VIEWS),
};
}
})();
