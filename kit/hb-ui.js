/* Housebook kit: hb-ui.js. Поведение страниц без зависимостей. Подключать в конце body: <script src="hb-ui.js" defer></script>.
   Тема: ранняя установка класса dusk идёт inline-сниппетом в head (см. _shablon.html), здесь только переключатель .night.
   Каждый модуль ищет свою разметку и молча пропускается, если её на странице нет. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // строки, которые ставит сам скрипт, и формат чисел: язык из html lang (en* -> en, иначе ru); тексты страниц остаются в HTML.
  // loc - локаль Intl и распознавания речи, как у боевого сайта (каталог: ru-RU и en-US); формы слов через | по порядку Intl.PluralRules: one|few|many (en: one|other)
  const I18N = {
    ru: { loc: 'ru-RU', find: 'Найти', findIn: 'Поиск по списку', none: 'Ничего не найдено', reset: 'Сбросить', done: 'Готово', all: 'Все', picked: n => `Выбрано: ${n}`,
      nouns: 'объект|объекта|объектов', show: (n, w) => `Показать ${n} ${w}`, allFilters: 'Все фильтры', close: 'Закрыть', filters: 'Фильтры',
      of: (i, n) => `${i} из ${n}`, viewer: 'Просмотр изображения', zoomOut: 'Уменьшить', fit: 'Вписать в экран', zoomIn: 'Увеличить', prev: 'Предыдущее', next: 'Следующее',
      favOn: 'Убрать из избранного', favOff: 'В избранное', copied: 'Ссылка скопирована', unfilter: t => `Убрать фильтр «${t}»`,
      mapFail: 'Карта не загрузилась. Проверьте соединение и откройте снова.', osm: '&copy; участники OpenStreetMap',
      rateDay: 'Посуточная ставка, USD', rateMonth: 'Месячная ставка, USD', rateAsk: 'Введите ставку аренды и заполняемость, чтобы увидеть расчёт',
      scen: (p, g, c, n) => `<b>${p}</b> чистыми в год: доход ${g}, расходы ${c}, остаётся ${n}`,
      projects: 'проект|проекта|проектов', inCat: ' в каталоге', andMore: (a, n) => `${a} и ещё ${n}`, useful: n => `Полезно: ${n}`, dismiss: 'Закрыть уведомление',
      consentSaved: 'Выбор сохранён. Изменить его можно по ссылке «Настройки куки» внизу страницы.' },
    en: { loc: 'en-US', find: 'Search', findIn: 'Search the list', none: 'No matches', reset: 'Reset', done: 'Done', all: 'All', picked: n => `${n} selected`,
      nouns: 'property|properties', show: (n, w) => `Show ${n} ${w}`, allFilters: 'All filters', close: 'Close', filters: 'Filters',
      of: (i, n) => `${i} of ${n}`, viewer: 'Image viewer', zoomOut: 'Zoom out', fit: 'Fit to screen', zoomIn: 'Zoom in', prev: 'Previous', next: 'Next',
      favOn: 'Remove from favorites', favOff: 'Add to favorites', copied: 'Link copied', unfilter: t => `Remove filter “${t}”`,
      mapFail: 'The map didn’t load. Check your connection and open it again.', osm: '&copy; OpenStreetMap contributors',
      rateDay: 'Nightly rate, USD', rateMonth: 'Monthly rate, USD', rateAsk: 'Enter the rental rate and occupancy to see the estimate',
      scen: (p, g, c, n) => `<b>${p}</b> net per year: income ${g}, costs ${c}, you keep ${n}`,
      projects: 'project|projects', inCat: ' in the catalog', andMore: (a, n) => `${a} and ${n} more`, useful: n => `Helpful: ${n}`, dismiss: 'Dismiss notification',
      consentSaved: 'Your choice is saved. You can change it via “Cookie settings” at the bottom of the page.' }
  };
  const T = I18N[root.lang.toLowerCase().startsWith('en') ? 'en' : 'ru'];
  // числа, цены и проценты только через Intl; валюта как в макетах: знак $ перед числом, процент без пробела
  const NF = new Intl.NumberFormat(T.loc), NF1 = new Intl.NumberFormat(T.loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), PL = new Intl.PluralRules(T.loc);
  const num = v => NF.format(v), usd = x => '$' + num(Math.round(x)), pct = x => NF1.format(x) + '%';
  const plural = (n, forms) => { const f = forms.split('|'); return f[{ one: 0, few: 1 }[PL.select(n)] ?? f.length - 1]; };

  // тема: кнопки .night переключают html.dusk, выбор помнится в localStorage['hb-night']; сцена слушает событие hb:theme
  const nightBtns = $$('.night');
  // подпись кнопки постоянная («Сумерки», брендбук с.21), состояние передаёт aria-pressed и кружок-индикатор
  const syncNight = () => { const on = root.classList.contains('dusk'); for (const b of nightBtns) b.setAttribute('aria-pressed', String(on)); };
  for (const b of nightBtns) b.addEventListener('click', () => {
    const on = !root.classList.contains('dusk'); root.classList.toggle('dusk', on);
    try { localStorage.setItem('hb-night', on ? '1' : '0'); } catch (e) {}
    syncNight(); document.dispatchEvent(new CustomEvent('hb:theme', { detail: { night: on } }));
  });
  syncNight();

  // мобильное меню: бургер открывает dialog.mnav (Esc, фокус внутри, фон недоступен), ссылка или клик по фону закрывает
  const burger = $('.burger'), mnav = $('#mnav');
  if (burger && mnav && mnav.showModal) {
    burger.addEventListener('click', () => { mnav.showModal(); burger.setAttribute('aria-expanded', 'true'); });
    mnav.addEventListener('close', () => { burger.setAttribute('aria-expanded', 'false'); burger.focus(); });
    mnav.addEventListener('click', e => { if (e.target === mnav || e.target.closest('a') || e.target.closest('[data-close]')) mnav.close(); });
    matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches && mnav.open) mnav.close(); });
  }

  // свои выпадающие списки поверх select.select: поиск, множественный выбор (атрибут multiple), группы optgroup, клавиатура.
  // Родной select остаётся в DOM скрытым: отправка формы, id и обработчики change работают как прежде.
  // data-search="on|off" (по умолчанию поиск, если пунктов больше 5), data-placeholder - текст пустого множественного выбора,
  // data-native - оставить родной список. Программная смена значения: select.value = ...; select.dispatchEvent(new Event('change')).
  const csAll = []; let csN = 0;
  const norm = t => t.toLowerCase().replace(/ё/g, 'е');
  function customSelect(sel) {
    const n = ++csN, multi = sel.multiple, opts = [...sel.options];
    const wrap = document.createElement('div'); wrap.className = 'cs' + (multi ? ' cs--multi' : '');
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
    sel.classList.add('cs__native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    const lab = (sel.id && $(`label[for="${sel.id}"]`)) || sel.closest('label'), labEl = lab && ($('.field__l', lab) || lab);
    if (labEl && !labEl.id) labEl.id = 'cs-l' + n;
    const trig = document.createElement('button'); trig.type = 'button'; trig.className = 'cs__btn select'; trig.disabled = sel.disabled;
    for (const c of sel.classList) if (c.startsWith('select--')) trig.classList.add(c); // размер и форма (select--xs, --s, --t, --l, --pill) переходят на кнопку
    trig.setAttribute('aria-haspopup', 'listbox'); trig.setAttribute('aria-expanded', 'false'); trig.setAttribute('aria-controls', 'cs-list' + n);
    // без подписи имя берётся у самого select: aria-labelledby (те же id) или aria-label (кнопка ссылается на себя: имя, затем значение)
    const by = labEl ? labEl.id : sel.getAttribute('aria-labelledby'), al = !by && sel.getAttribute('aria-label');
    trig.innerHTML = `<span class="cs__val" id="cs-v${n}"></span>`;
    if (by) trig.setAttribute('aria-labelledby', `${by} cs-v${n}`);
    else if (al) { trig.id = 'cs-b' + n; trig.setAttribute('aria-label', al); trig.setAttribute('aria-labelledby', `${trig.id} cs-v${n}`); }
    // панель в top layer (popover): поверх любых секций, шапки и overflow:hidden; координаты от кнопки, при нехватке места снизу открывается вверх
    const pop = document.createElement('div'); pop.className = 'cs__pop'; pop.hidden = true; if (pop.showPopover) pop.popover = 'manual';
    const search = sel.dataset.search ? sel.dataset.search === 'on' : opts.length > 5;
    const q = search ? Object.assign(document.createElement('input'), { type: 'search', className: 'cs__q input input--s', placeholder: T.find, autocomplete: 'off' }) : null;
    if (q) { q.setAttribute('aria-label', T.findIn); q.setAttribute('aria-controls', 'cs-list' + n); pop.appendChild(q); }
    const list = document.createElement('ul'); list.className = 'cs__list'; list.id = 'cs-list' + n; list.setAttribute('role', 'listbox'); list.tabIndex = -1;
    if (multi) list.setAttribute('aria-multiselectable', 'true'); if (by) list.setAttribute('aria-labelledby', by); else if (al) list.setAttribute('aria-label', al);
    let group = null; const heads = [];
    const items = opts.map((o, i) => {
      const g = o.parentNode.tagName === 'OPTGROUP' ? o.parentNode : null;
      if (g && g !== group) { const h = document.createElement('li'); h.className = 'cs__grp'; h.setAttribute('role', 'presentation'); h.textContent = g.label; h.items = []; list.appendChild(h); heads.push(h); }
      group = g;
      const li = document.createElement('li'); li.id = `cs${n}-${i}`; li.className = 'cs__opt'; li.setAttribute('role', 'option'); li.dataset.i = i; li.textContent = o.textContent;
      if (o.disabled) li.setAttribute('aria-disabled', 'true'); if (g) heads[heads.length - 1].items.push(li);
      list.appendChild(li); return li;
    });
    const none = document.createElement('li'); none.className = 'cs__none'; none.setAttribute('role', 'presentation'); none.textContent = T.none; none.hidden = true; list.appendChild(none);
    pop.appendChild(list);
    if (multi) { const f = document.createElement('div'); f.className = 'cs__foot';
      f.innerHTML = `<button type="button" class="btn btn--s" data-cs="reset">${T.reset}</button><button type="button" class="btn btn--acc btn--s" data-cs="done">${T.done}</button>`; pop.appendChild(f); }
    wrap.append(trig, pop);

    let act = null;
    const vis = () => items.filter(li => !li.hidden && li.getAttribute('aria-disabled') !== 'true');
    const fire = () => { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); };
    const sync = () => {
      items.forEach((li, i) => li.setAttribute('aria-selected', String(opts[i].selected)));
      const ch = opts.filter(o => o.selected), ph = sel.dataset.placeholder || T.all;
      $('.cs__val', trig).textContent = multi ? (!ch.length ? ph : ch.length <= 2 ? ch.map(o => o.textContent).join(', ') : T.picked(ch.length)) : (ch[0] ? ch[0].textContent : ph);
      wrap.classList.toggle('has-val', multi ? ch.length > 0 : true);
    };
    const setAct = li => { act = li || null; for (const x of items) x.classList.toggle('is-act', x === act);
      const owner = q || list; if (act) { owner.setAttribute('aria-activedescendant', act.id); act.scrollIntoView({ block: 'nearest' }); } else owner.removeAttribute('aria-activedescendant'); };
    const filter = () => { const v = norm(q.value.trim());
      for (const li of items) li.hidden = !!v && !norm(li.textContent).includes(v);
      for (const h of heads) h.hidden = h.items.every(li => li.hidden);
      none.hidden = items.some(li => !li.hidden); setAct(vis()[0]); if (!pop.hidden) place(); };
    const place = () => { const r = trig.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { close(false); return; }
      pop.style.minWidth = r.width + 'px'; const ph = pop.offsetHeight, pw = pop.offsetWidth, below = innerHeight - r.bottom - 8;
      const up = below < ph && r.top - 8 > below;
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pw - 8)) + 'px'; pop.style.top = Math.max(8, up ? r.top - ph - 6 : r.bottom + 6) + 'px'; };
    const open = () => { if (!pop.hidden || trig.disabled) return; for (const c of csAll) if (c !== close) c(false);
      pop.hidden = false; if (pop.showPopover) pop.showPopover(); wrap.classList.add('is-open'); trig.setAttribute('aria-expanded', 'true');
      if (q) { q.value = ''; filter(); } place(); addEventListener('scroll', place, true); addEventListener('resize', place); setAct(items.find((li, i) => opts[i].selected && !li.hidden) || vis()[0]); (q || list).focus(); };
    const close = back => { if (pop.hidden) return; removeEventListener('scroll', place, true); removeEventListener('resize', place); if (pop.hidePopover) pop.hidePopover(); pop.hidden = true; wrap.classList.remove('is-open'); trig.setAttribute('aria-expanded', 'false'); if (back) trig.focus(); };
    csAll.push(close);
    const choose = li => { if (!li || li.getAttribute('aria-disabled') === 'true') return; const i = +li.dataset.i;
      if (multi) { opts[i].selected = !opts[i].selected; sync(); fire(); setAct(li); }
      else { if (sel.selectedIndex !== i) { sel.selectedIndex = i; sync(); fire(); } close(true); } };
    const keys = e => { const v = vis(), i = v.indexOf(act);
      const go = { ArrowDown: Math.min(v.length - 1, i + 1), ArrowUp: Math.max(0, i - 1), PageDown: Math.min(v.length - 1, i + 8), PageUp: Math.max(0, i - 8) }[e.key];
      if (go !== undefined) { e.preventDefault(); setAct(v[go]); }
      else if ((e.key === 'Home' || e.key === 'End') && !q) { e.preventDefault(); setAct(e.key === 'Home' ? v[0] : v[v.length - 1]); }
      else if (e.key === 'Enter' || (e.key === ' ' && !q)) { e.preventDefault(); choose(act); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') close(false);
      else if (!q && e.key.length === 1) { const hit = v.find(li => norm(li.textContent).startsWith(norm(e.key))); if (hit) setAct(hit); } };
    trig.addEventListener('click', () => pop.hidden ? open() : close(true));
    trig.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    (q || list).addEventListener('keydown', keys); if (q) { list.addEventListener('keydown', keys); q.addEventListener('input', filter); }
    list.addEventListener('mousedown', e => e.preventDefault());
    list.addEventListener('click', e => { const li = e.target.closest('.cs__opt'); if (li) choose(li); });
    list.addEventListener('mousemove', e => { const li = e.target.closest('.cs__opt'); if (li && li !== act && li.getAttribute('aria-disabled') !== 'true') setAct(li); });
    pop.addEventListener('click', e => { const b = e.target.closest('[data-cs]'); if (!b) return;
      if (b.dataset.cs === 'reset') { for (const o of opts) o.selected = false; sync(); fire(); (q || list).focus(); } else close(true); });
    wrap.addEventListener('focusout', e => { if (!wrap.contains(e.relatedTarget)) close(false); });
    if (lab) lab.addEventListener('click', e => { if (!wrap.contains(e.target)) { e.preventDefault(); trig.focus(); } });
    sel.addEventListener('change', sync); sel.focus = () => trig.focus();
    if (sel.form) sel.form.addEventListener('reset', () => setTimeout(sync));
    sync();
  }
  for (const s of $$('select.select:not([data-native])')) customSelect(s);
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.cs')) for (const c of csAll) c(false); });

  // строка фильтров каталога .fbar (стили и разметка в hb.css и kit.html): кнопки .fbtn открывают попапы .fdd__pop (popover, поверх всего),
  // «Все фильтры» открывает панель dialog.fpanel, куда на время переезжают все группы и .fbar__more. Выбранное считается по полям:
  // отмеченные checkbox, radio не первые в своей группе, заполненные поля ввода, пункты select[multiple]. Число «Показать N» в макете
  // условное (data-total уменьшается на каждую активную группу); на сайте его отдаёт API. Склонение: data-noun="проект|проекта|проектов" (en: "project|projects").
  for (const bar of $$('.fbar')) {
    const total = +bar.dataset.total || 0, nouns = bar.dataset.noun || T.nouns;
    const meta = $('.fmeta', bar.parentElement), // между фильтром и счётчиком могут стоять быстрые чипы
      mob = matchMedia('(max-width: 899px)');
    const count = el => { let n = 0; const radios = new Set(), filled = $$('input:not([type=checkbox]):not([type=radio])', el).some(i => i.value.trim());
      for (const i of $$('input[type=checkbox]', el)) n += i.checked;
      for (const i of $$('input[type=radio]', el)) if (i.checked && !radios.has(i.name) && $$(`input[type=radio][name="${i.name}"]`, el)[0] !== i) { radios.add(i.name); n++; }
      for (const sl of $$('select[multiple]', el)) n += sl.selectedOptions.length; return n + filled; };
    const reset = el => { for (const i of $$('input', el)) { if (i.type === 'checkbox') i.checked = false; else if (i.type === 'radio') i.checked = $$(`input[type=radio][name="${i.name}"]`, el)[0] === i; else i.value = ''; }
      for (const sl of $$('select[multiple]', el)) { for (const o of sl.options) o.selected = false; sl.dispatchEvent(new Event('change', { bubbles: true })); } };
    const loc = $('.fbar__loc', bar), more = $('.fbar__more', bar), extra = more ? [...more.children] : [], all = $('.fbtn--all', bar), shows = [];
    const dds = $$('.fdd', bar).map((dd, i) => { const btn = $('.fbtn', dd), pop = $('.fdd__pop', dd), body = $('.fdd__body', dd);
      pop.id ||= `fdd-${Math.random().toString(36).slice(2, 8)}`; pop.popover = 'auto'; btn.popoverTargetElement = pop; btn.setAttribute('aria-expanded', 'false');
      const foot = document.createElement('div'); foot.className = 'fdd__foot';
      foot.innerHTML = `<button type="button" class="btn btn--s" data-reset>${T.reset}</button><button type="button" class="btn btn--acc btn--s" data-show></button>`;
      pop.append(foot); shows.push($('[data-show]', foot));
      $('[data-reset]', foot).addEventListener('click', () => { reset(body); update(); });
      $('[data-show]', foot).addEventListener('click', () => pop.hidePopover());
      const place = () => { if (mob.matches) { pop.style.left = pop.style.top = ''; return; }
        const r = btn.getBoundingClientRect(), w = pop.offsetWidth || 340, h = pop.offsetHeight, below = innerHeight - r.bottom - 8;
        pop.style.left = Math.max(16, Math.min(r.left, innerWidth - w - 16)) + 'px';
        pop.style.top = (h && below < h + 8 && r.top > below ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px'; };
      pop.addEventListener('beforetoggle', e => { if (e.newState === 'open') place(); });
      pop.addEventListener('toggle', e => { const on = e.newState === 'open'; btn.setAttribute('aria-expanded', String(on));
        if (on) { place(); addEventListener('scroll', place, true); addEventListener('resize', place); } else { removeEventListener('scroll', place, true); removeEventListener('resize', place); } });
      return { dd, btn, pop, body, n: $('.fbtn__n', btn) }; });
    // на компьютере строка не прокручивается: кнопки, которым не хватило места, прячутся с конца, их группы остаются в «Все фильтры»
    const row = $('.fbar__row', bar);
    const fit = () => { for (const d of dds) d.dd.hidden = false; if (!row || mob.matches) return;
      for (let i = dds.length - 1; i > 0 && row.scrollWidth > row.clientWidth + 1; i--) dds[i].dd.hidden = true; };
    if (row) { fit(); new ResizeObserver(fit).observe(bar); mob.addEventListener('change', fit); }
    // панель «Все фильтры»: группы переезжают в неё и возвращаются при закрытии, поля и их значения остаются те же
    let panel = null, home = [];
    const groups = () => [...dds.map(d => d.body), ...extra];
    if (all && typeof HTMLDialogElement === 'function') {
      panel = document.createElement('dialog'); panel.className = 'drawer fpanel'; panel.setAttribute('aria-labelledby', 'fpanel-h'); // вид ящика .drawer, fpanel: хук ширины
      panel.innerHTML = `<div class="drawer__head"><h2 id="fpanel-h">${T.allFilters}</h2><button type="button" class="fmeta__reset" data-reset-all>${T.reset}</button><button type="button" class="btn btn--icon btn--quiet fpanel__x" aria-label="${T.close}" data-close><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button></div><div class="drawer__body fpanel__body"></div><div class="drawer__foot"><button type="button" class="btn btn--acc" data-close data-show></button></div>`;
      document.body.append(panel); shows.push($('[data-show]', panel));
      all.setAttribute('aria-haspopup', 'dialog');
      all.addEventListener('click', () => { for (const d of dds) if (d.pop.matches(':popover-open')) d.pop.hidePopover();
        home = groups().map(g => [g, g.parentNode, g.nextSibling]); $('.fpanel__body', panel).append(...home.map(h => h[0])); panel.showModal(); });
      panel.addEventListener('click', e => { if (e.target === panel || e.target.closest('[data-close]')) panel.close(); });
      panel.addEventListener('close', () => { for (const [g, par, nx] of home.reverse()) par.insertBefore(g, nx); home = []; all.focus(); }); // с конца: соседи уже на месте
      $('[data-reset-all]', panel).addEventListener('click', () => { for (const g of groups()) reset(g); update(); });
    }
    const update = () => {
      let act = 0, sum = 0;
      for (const d of dds) { const n = count(d.body); d.btn.classList.toggle('is-on', n > 0); d.n.textContent = n || ''; act += n > 0; sum += n > 0; }
      for (const g of extra) { const n = count(g); act += n > 0; sum += n > 0; }
      if (loc) act += count(loc) > 0;
      const n = Math.max(1, Math.round(total * .58 ** act)), txt = T.show(num(n), plural(n, nouns));
      for (const b of shows) b.textContent = txt;
      if (all) { all.classList.toggle('is-on', sum > 0); $('.fbtn__n', all).textContent = sum || ''; }
      if (meta) { const c = $('[data-fcount]', meta), w = $('[data-fnoun]', meta), r = $('.fmeta__reset', meta);
        if (c) c.textContent = num(n); if (w) w.textContent = plural(n, nouns); if (r) r.hidden = !act; }
    };
    const mine = t => bar.contains(t) || (panel && panel.contains(t));
    document.addEventListener('input', e => { if (mine(e.target)) update(); });
    document.addEventListener('change', e => { if (mine(e.target)) update(); });
    if (meta) $('.fmeta__reset', meta)?.addEventListener('click', () => { for (const g of groups()) reset(g); if (loc) reset(loc); update(); });
    bar.addEventListener('submit', e => e.preventDefault());
    update();
  }

  // возврат к блоку, который не следует за скроллом (решение владельца 06.10.2026: липкое не больше 15-20% экрана).
  // блок с [data-return="Подпись"] стоит на месте; когда он ушёл вверх, а его секция ещё на экране,
  // внизу слева появляется кнопка с подписью (по умолчанию «Фильтры»), она возвращает к блоку и ставит фокус в первое поле.
  // Строка фильтров .fbar получает её без атрибута: на телефоне она не липнет (решение владельца 07.10.2026), на компьютере липнет и кнопки не видно;
  // фокус у неё на «Все фильтры», а не в поле поиска, чтобы на телефоне не выскакивала клавиатура.
  for (const el of $$('[data-return], .fbar')) {
    const zone = el.closest('.sec, section') || el.parentElement;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ret'; b.hidden = true;
    b.innerHTML = '<svg class="ic" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg><span></span>'; $('span', b).textContent = el.dataset.return || T.filters;
    document.body.appendChild(b);
    const upd = () => { const r = el.getBoundingClientRect(), z = zone.getBoundingClientRect(); b.hidden = !(r.bottom < 0 && z.bottom > innerHeight * .5); };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    b.addEventListener('click', () => { el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      const f = $('.fbtn--all', el) || $('button, input, select, [tabindex]:not([tabindex="-1"])', el); if (f) setTimeout(() => (f.matches('select') ? f.focus() : f.focus({ preventScroll: true })), reduced ? 0 : 400); });
  }

  // сортировка таблицы: в th[data-t] кнопка .sort; data-t="n" сортирует по td[data-v], "s" по тексту
  for (const t of $$('table[data-sortable], table#markets')) {
    const ths = $$('th', t.tHead); let cur = -1, dir = 1;
    ths.forEach((th, i) => {
      if (!th.dataset.t) return;
      let btn = th.querySelector('.sort');
      if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sort'; btn.innerHTML = '<span></span><svg class="ic" aria-hidden="true"><use href="#i-arrow-up-down"/></svg>'; btn.firstChild.textContent = th.textContent.trim(); th.textContent = ''; th.appendChild(btn); }
      btn.addEventListener('click', () => {
        dir = cur === i ? -dir : 1; cur = i;
        // у отсортированной колонки одна стрелка (вниз при убывании через CSS), у остальных двойная
        for (const h of ths) { h.removeAttribute('aria-sort'); const ic = h.querySelector('.sort .ic'); if (ic) ic.innerHTML = '<use href="#i-arrow-up-down"/>'; }
        th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending'); btn.querySelector('.ic').innerHTML = '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>';
        const body = t.tBodies[0], rows = [...body.rows], num = th.dataset.t === 'n';
        const key = r => num ? +r.cells[i].dataset.v : r.cells[i].textContent.trim();
        rows.sort((a, b) => { const x = key(a), y = key(b); return (num ? x - y : String(x).localeCompare(String(y), T.loc)) * dir; });
        for (const r of rows) body.appendChild(r);
      });
    });
  }

  // таблица .tbl--stack: на телефоне ячейки становятся блоками, и браузер (Safari) перестаёт видеть таблицу; роли возвращают её дикторам
  for (const t of $$('.tbl--stack table')) { t.setAttribute('role', 'table');
    for (const g of $$(':scope > :is(thead, tbody, tfoot)', t)) g.setAttribute('role', 'rowgroup');
    for (const r of t.rows) { r.setAttribute('role', 'row');
      for (const c of r.cells) c.setAttribute('role', c.tagName === 'TD' ? 'cell' : (c.closest('thead') || c.scope === 'col') ? 'columnheader' : 'rowheader'); } }

  // переключатель кнопкой button.switch[role=switch]: нажатие мышью, Enter или пробелом меняет aria-checked (у input.switch это делает браузер)
  document.addEventListener('click', e => { const b = e.target.closest('button[role="switch"]'); if (b) b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); });

  // reveal, счётчики и столбики оживают, когда попадают в кадр; при reduced-motion сразу финальное состояние
  {
    const seen = new WeakSet();
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting || seen.has(e.target)) return; seen.add(e.target); e.target.classList.add('in'); io.unobserve(e.target);
      const b = e.target.querySelector('[data-count]');
      if (b && !reduced) { const final = b.dataset.count, n = +final.replace(/\D/g, ''), t0 = performance.now();
        const tick = now => { const k = Math.min(1, (now - t0) / 900); b.textContent = k < 1 ? num(Math.round(n * (1 - Math.pow(1 - k, 3)))) : final; if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick); }
      if (!reduced) for (const f of e.target.querySelectorAll('.bar__fill')) { const h = f.dataset.h ??= f.style.getPropertyValue('--h'); f.style.setProperty('--h', '0'); requestAnimationFrame(() => requestAnimationFrame(() => f.style.setProperty('--h', h))); }
    }), { threshold: .2 });
    for (const el of $$('.reveal, .bars')) io.observe(el);
  }

  // подсказка про интерактив планеты: один раз, пока пользователь на первом экране
  const hint = $('#hint');
  if (hint) { let shown = false; const on = () => { if (shown || scrollY > innerHeight * .4 || root.classList.contains('no-webgl') || root.classList.contains('no-3d')) return; shown = true; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 4200); };
    setTimeout(on, 1800); addEventListener('scroll', () => { if (scrollY > innerHeight * .4) hint.classList.remove('on'); }, { passive: true }); }

  // помощник AI: кнопка всплывает, когда поле запроса (data-aid-anchor или .ask первого экрана страницы) ушло вверх, и прячется у .final; окно на нативном dialog.
  // первый экран - .theatre прямо в main: демо первого экрана в витрине лежит глубже и якорем не становится
  const fab = $('#aid-fab'), dlg = $('#aid');
  if (fab && dlg) {
    const anchor = $('[data-aid-anchor]') || $('main > .theatre .hero .ask'), fin = $('.final'), st = new Map();
    const upd = () => { const a = st.get(anchor), f = st.get(fin); fab.classList.toggle('on', anchor ? !!a && !a.isIntersecting && a.boundingClientRect.top < 0 && !(f && f.isIntersecting) : !(f && f.isIntersecting)); };
    const io = new IntersectionObserver(es => { for (const e of es) st.set(e.target, e); upd(); });
    if (anchor) io.observe(anchor); if (fin) io.observe(fin); if (!anchor && !fin) fab.classList.add('on');
    fab.addEventListener('click', () => { dlg.showModal(); fab.setAttribute('aria-expanded', 'true'); });
    for (const x of $$('[data-close], .aid__x', dlg)) x.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { fab.setAttribute('aria-expanded', 'false'); fab.focus(); });
  }

  // табы: role=tablist/tab/tabpanel, стрелки, Home, End; активация по фокусу
  for (const list of $$('[role="tablist"]')) {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => { for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; const p = document.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on; } if (focus) tab.focus(); };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => { const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (k === undefined) return; e.preventDefault(); select(tabs[(k + tabs.length) % tabs.length], true); });
    });
    select(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
  }

  // галерея без автокарусели: миниатюры и стрелки меняют главный кадр, стрелки клавиатуры на кадре
  for (const g of $$('.gallery')) {
    const main = $('.gallery__main img', g), cap = $('.gallery__cap', g), thumbs = $$('.gallery__thumbs button', g); let cur = 0;
    const go = i => { cur = (i + thumbs.length) % thumbs.length; const t = thumbs[cur], im = t.querySelector('img');
      if (main && im) { main.src = t.dataset.full || im.src; main.alt = im.alt; }
      if (cap) cap.textContent = T.of(cur + 1, thumbs.length) + (t.dataset.cap ? ' · ' + t.dataset.cap : '');
      thumbs.forEach((b, k) => b.setAttribute('aria-current', String(k === cur))); };
    thumbs.forEach((b, i) => b.addEventListener('click', () => go(i)));
    const prev = $('[data-prev]', g), next = $('[data-next]', g);
    if (prev) prev.addEventListener('click', () => go(cur - 1)); if (next) next.addEventListener('click', () => go(cur + 1));
    g.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'ArrowRight') go(cur + 1); });
    if (thumbs.length) go(0);
    // полноэкранный просмотр кадра
    $('[data-full]', g)?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : $('.gallery__main', g).requestFullscreen?.());
  }

  // просмотр картинок на месте: a[data-zoom] (группа по значению атрибута) и листы планировок a.p-plans__i открываются поверх страницы.
  // Колесо, кнопки +/-, двойной клик и щипок увеличивают к точке, перетаскивание двигает, стрелки и свайп листают, Esc закрывает
  {
    const SEL = 'a[data-zoom], a.p-plans__i', links = $$(SEL);
    if (links.length && window.HTMLDialogElement) {
      const ic = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
      const dlg = document.createElement('dialog'); dlg.className = 'zoom'; dlg.setAttribute('aria-label', T.viewer);
      dlg.innerHTML = `<div class="zoom__bar"><span class="zoom__n" aria-live="polite"></span><span class="zoom__tools">
<button type="button" class="btn btn--icon btn--dark zoom__b" data-z="-1" aria-label="${T.zoomOut}">${ic('<path d="M5 12h14"/>')}</button><button type="button" class="btn btn--icon btn--dark zoom__b zoom__pct" data-z="0" aria-label="${T.fit}">100%</button><button type="button" class="btn btn--icon btn--dark zoom__b" data-z="1" aria-label="${T.zoomIn}">${ic('<path d="M5 12h14"/><path d="M12 5v14"/>')}</button><button type="button" class="btn btn--icon btn--dark zoom__b" data-close aria-label="${T.close}" autofocus>${ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')}</button></span></div>
<div class="zoom__stage"><img alt="" draggable="false"></div>
<button type="button" class="btn btn--icon btn--dark zoom__nav zoom__nav--p" data-step="-1" aria-label="${T.prev}">${ic('<path d="m15 18-6-6 6-6"/>')}</button><button type="button" class="btn btn--icon btn--dark zoom__nav zoom__nav--n" data-step="1" aria-label="${T.next}">${ic('<path d="m9 18 6-6-6-6"/>')}</button>`;
      document.body.append(dlg);
      const stage = $('.zoom__stage', dlg), img = $('img', stage), num = $('.zoom__n', dlg), pct = $('.zoom__pct', dlg);
      let set = [], cur = 0, s = 1, x = 0, y = 0;
      // сдвиг не даёт картинке уйти с экрана: край увеличенной картинки не заходит внутрь сцены
      const draw = () => { const r = stage.getBoundingClientRect(), mx = Math.max(0, (img.offsetWidth * s - r.width) / 2), my = Math.max(0, (img.offsetHeight * s - r.height) / 2);
        x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
        img.style.transform = `translate(${x}px, ${y}px) scale(${s})`; pct.textContent = NF.format(Math.round(s * 100)) + '%'; stage.classList.toggle('is-zoomed', s > 1); };
      // масштаб к точке окна (cx, cy), без точки к центру сцены: точка под курсором остаётся на месте
      const zoomTo = (ns, cx, cy) => { ns = Math.min(6, Math.max(1, ns)); const r = stage.getBoundingClientRect();
        const px = cx == null ? 0 : cx - r.left - r.width / 2, py = cy == null ? 0 : cy - r.top - r.height / 2;
        x = px - (px - x) * ns / s; y = py - (py - y) * ns / s; s = ns; if (s === 1) x = y = 0; draw(); };
      const show = i => { cur = (i + set.length) % set.length; const a = set[cur], t = a.querySelector('img');
        img.src = a.href; img.alt = t ? t.alt : ''; s = 1; x = y = 0; draw();
        num.textContent = set.length > 1 ? T.of(cur + 1, set.length) : ''; for (const b of $$('.zoom__nav', dlg)) b.hidden = set.length < 2; };
      document.addEventListener('click', e => { const a = e.target.closest(SEL); if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault();
        set = a.dataset.zoom ? links.filter(l => l.dataset.zoom === a.dataset.zoom) : links.filter(l => l.parentElement === a.parentElement);
        dlg.showModal(); show(set.indexOf(a)); });
      let moved = false;
      dlg.addEventListener('click', e => { const b = e.target.closest('button');
        if (b && b.dataset.step) show(cur + Number(b.dataset.step));
        else if (b && b.dataset.z) { const z = Number(b.dataset.z); zoomTo(z ? s * (z > 0 ? 1.5 : 1 / 1.5) : 1); }
        else if ((b && b.hasAttribute('data-close')) || (e.target === stage && !moved)) dlg.close(); });
      dlg.addEventListener('keydown', e => { const k = e.key;
        if (k === 'ArrowLeft' || k === 'ArrowRight') { if (set.length > 1) show(cur + (k === 'ArrowLeft' ? -1 : 1)); }
        else if (k === '+' || k === '=') zoomTo(s * 1.5); else if (k === '-') zoomTo(s / 1.5); else if (k === '0') zoomTo(1); else return;
        e.preventDefault(); });
      stage.addEventListener('wheel', e => { e.preventDefault(); zoomTo(s * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY); }, { passive: false });
      img.addEventListener('dblclick', e => zoomTo(s > 1 ? 1 : 2.5, e.clientX, e.clientY));
      // мышь и один палец двигают увеличенную картинку, на исходном масштабе свайп листает; два пальца масштабируют
      const pts = new Map(); let pinch = null, start = null;
      stage.addEventListener('pointerdown', e => { moved = false; if (e.target !== img) return; try { img.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен: двигаем без захвата */ }
        pts.set(e.pointerId, [e.clientX, e.clientY]); start = pts.size === 1 ? [e.clientX, s] : null;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s }; } });
      stage.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
        if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; zoomTo(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        else if (s > 1) { x += dx; y += dy; draw(); } });
      const up = e => { if (!pts.delete(e.pointerId)) return; if (pts.size < 2) pinch = null;
        if (!pts.size && start && start[1] === 1 && s === 1 && set.length > 1 && Math.abs(e.clientX - start[0]) > 60) show(cur + (e.clientX < start[0] ? 1 : -1));
        if (!pts.size) start = null; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      addEventListener('resize', () => dlg.open && draw());
    }
  }

  // избранное: переключатель aria-pressed
  for (const b of $$('.fav')) b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? T.favOn : T.favOff); });

  // форма заявки: проверка на клиенте, ошибки у полей, состояние успеха; отправку делает страница (data-endpoint), без него показывается успех
  let agreeN = 0;
  for (const f of $$('form.form')) {
    f.noValidate = true;
    f.addEventListener('submit', async e => {
      e.preventDefault(); let first = null;
      for (const el of f.querySelectorAll('[required]:not(:disabled)')) { // отключённое поле скрытого блока [data-when] не проверяется и не отправляется
        const box = el.closest('.field, .check'), ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '' && el.checkValidity();
        if (box) box.classList.toggle('is-err', !ok); el.setAttribute('aria-invalid', String(!ok)); if (!ok && !first) first = el;
        // галочка согласия .agree: текст ошибки читается вместе с ней, пока она не отмечена (скрытый текст в описании диктор прочёл бы всегда)
        const msg = el.closest('.agree') && $('.field__err', el.closest('.agree'));
        if (msg) { msg.id = msg.id || 'agree-err-' + ++agreeN; if (ok) el.removeAttribute('aria-describedby'); else el.setAttribute('aria-describedby', msg.id); }
      }
      if (first) { first.focus(); return; }
      // поле-ловушка .hp заполнено (бот): тот же успех, но без запроса, как на бою (/api/leads при заполненном website отвечает ok и ничего не пишет)
      const ep = f.dataset.endpoint, bot = $$('input.hp, textarea.hp', f).some(h => h.value.trim() !== '');
      if (ep && !bot) { try { const r = await fetch(ep, { method: 'POST', body: new FormData(f) }); if (!r.ok) throw new Error(r.status); } catch (err) { const n = f.querySelector('.form__fail'); if (n) n.hidden = false; return; } }
      f.classList.add('is-ok'); const ok = f.querySelector('.form__ok'); if (ok) { ok.tabIndex = -1; ok.focus(); }
    });
    f.addEventListener('input', e => { const box = e.target.closest('.is-err'); if (box && (e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim())) { box.classList.remove('is-err'); e.target.removeAttribute('aria-invalid'); if (box.closest('.agree')) e.target.removeAttribute('aria-describedby'); } });
  }

  // оглавление статьи: подсветка текущего раздела в каждом .toc на странице (кроме .toc--rows: список-переход, не липнет)
  for (const toc of $$('.toc:not(.toc--rows)')) { const links = $$('a[href^="#"]', toc), secs = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    const io = new IntersectionObserver(() => { let cur = secs[0]; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * .35) cur = s; for (const a of links) a.setAttribute('aria-current', String(a.hash === '#' + cur.id)); }, { rootMargin: '0px 0px -50% 0px', threshold: [0, 1] });
    for (const s of secs) io.observe(s); }

  // модалка заявки #lead: открывают кнопки [data-lead] («Актуальная подборка и расчёт покупки», «Подобрать со специалистом»)
  const lead = $('#lead');
  if (lead && lead.showModal) {
    document.addEventListener('click', e => { const b = e.target.closest('[data-lead]'); if (!b) return; e.preventDefault(); lead.showModal(); });
    lead.addEventListener('click', e => { if (e.target === lead || e.target.closest('[data-close]')) lead.close(); });
  }

  // карточка каталога: листание фото (точки и стрелки), «Поделиться» через системное меню или копирование ссылки
  for (const c of $$('.card')) {
    const dots = $$('.card__dots i', c), img = $('.card__top img', c), photos = (c.dataset.photos || '').split(' ').filter(Boolean); let i = 0;
    const go = d => { if (!dots.length) return; i = (i + d + dots.length) % dots.length; dots.forEach((x, k) => x.classList.toggle('on', k === i)); if (img && photos[i]) img.src = photos[i]; };
    $('.card__nav--prev', c)?.addEventListener('click', e => { e.preventDefault(); go(-1); });
    $('.card__nav--next', c)?.addEventListener('click', e => { e.preventDefault(); go(1); });
    $('.share', c)?.addEventListener('click', async e => { e.preventDefault(); const a = $('.card__link', c), url = new URL(a.getAttribute('href'), location.href).href, b = e.currentTarget;
      try { if (navigator.share) await navigator.share({ title: a.textContent, url }); else { await navigator.clipboard.writeText(url); b.title = T.copied; b.setAttribute('aria-label', T.copied); } } catch (_) {} });
  }

  // выдача: быстрые чипы переключаются и попадают в строку активных фильтров; «Сбросить» снимает всё
  for (const res of $$('[data-results]')) {
    const chips = $$('.qchip', res), act = $('.achips', res);
    const draw = () => { if (!act) return; act.innerHTML = ''; const on = chips.filter(q => q.getAttribute('aria-pressed') === 'true');
      for (const q of on) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pill pill--xs pill--remove'; b.innerHTML = `${q.textContent}<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>`; b.setAttribute('aria-label', T.unfilter(q.textContent)); b.addEventListener('click', () => { q.setAttribute('aria-pressed', 'false'); draw(); }); act.append(b); }
      if (on.length) { const r = document.createElement('button'); r.type = 'button'; r.className = 'fmeta__reset'; r.textContent = T.reset; r.addEventListener('click', () => { chips.forEach(q => q.setAttribute('aria-pressed', 'false')); draw(); }); act.append(r); } };
    for (const q of chips) q.addEventListener('click', () => { q.setAttribute('aria-pressed', String(q.getAttribute('aria-pressed') !== 'true')); draw(); });

    // «Списком / На карте»: карта Leaflet грузится при первом открытии, пины по data-pins="[[lat,lng,'подпись'],...]"
    const vbtn = $$('.view button, button[data-view]', res), list = $('.cards', res), pager = $('.pager', res), map = $('.cmap', res);
    const show = mode => { vbtn.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === mode))); if (list) list.hidden = mode === 'map'; if (pager) pager.hidden = mode === 'map'; if (map) { map.hidden = mode !== 'map'; if (mode === 'map') drawMap(map); } };
    for (const b of vbtn) b.addEventListener('click', () => show(b.dataset.view));
  }
  let leafletP = null;
  const loadLeaflet = () => leafletP ||= new Promise((ok, no) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.append(l);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
  async function drawMap(el) {
    if (el.dataset.ready) return; el.dataset.ready = '1';
    try { await loadLeaflet(); } catch (_) { el.textContent = T.mapFail; return; }
    const pins = JSON.parse(el.dataset.pins || '[]'), m = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: T.osm, maxZoom: 18 }).addTo(m);
    // пин точкой, название проекта в подсказке: подписи соседних проектов не налезают друг на друга
    // четвёртый элемент пина: ссылка, по клику на точку переход (карта стран ведёт в гиды)
    const g = L.featureGroup(pins.map(([la, ln, t, u]) => { const mk = L.marker([la, ln], { title: t, icon: L.divIcon({ className: '', html: '<span class="mpin"></span>', iconSize: [18, 18] }) }).bindTooltip(t, { direction: 'top', offset: [0, -10] }); if (u) mk.on('click', () => { location.href = u; }); return mk; })).addTo(m);
    m.fitBounds(g.getBounds(), { padding: [40, 40], maxZoom: +el.dataset.zoom || 12 });
  }
  // карта без переключателя (страница проекта): грузится, когда доходит до экрана
  for (const el of $$('.cmap[data-auto]')) new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); drawMap(el); } }, { rootMargin: '200px' }).observe(el);

  // «Поделиться» страницей: системное меню или копирование ссылки
  for (const b of $$('[data-share]')) b.addEventListener('click', async () => {
    try { if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else { await navigator.clipboard.writeText(location.href); b.lastChild.textContent = T.copied; } } catch (_) {} });

  // калькулятор доходности, формула как на сайте (ROICalculator): аренда x 12 x заполняемость минус налог,
  // обслуживание за м² и комиссия за поиск арендатора в одну месячную аренду
  for (const c of $$('[data-calc]')) {
    const v = n => +$(`[name="${n}"]`, c).value;
    const out = (k, t) => { for (const e of $$(`[data-out="${k}"]`, c)) e.textContent = t; };
    const calc = () => {
      for (const r of $$('input[type="range"]', c)) $('#o-' + r.name, c).textContent = r.dataset.fmt === 'pct' ? num(+r.value) + '%' : usd(r.value);
      const price = v('price'), rent = v('rent'), ga = rent * 12 * v('occ') / 100, tax = ga * +c.dataset.tax, cam = +c.dataset.cam * +c.dataset.area * 12;
      const net = ga - tax - cam - rent, v5 = price * Math.pow(1 + v('grow') / 100, 5);
      out('month', usd(net / 12)); out('year', usd(net)); out('year2', usd(net)); out('gross', pct(ga / price * 100)); out('net', pct(net / price * 100));
      out('v5', usd(v5)); out('r5', num(Math.round((net * 5 + v5 - price) / price * 100)) + '%');
      out('ga', usd(ga)); out('tax', '-' + usd(tax)); out('cam', '-' + usd(cam)); out('fee', '-' + usd(rent));
    };
    c.addEventListener('input', calc); calc();
  }

  // ползунок .slider и ползунки калькулятора: --v (0-100%) рисует заполнение дорожки, .slider__v показывает значение
  // (data-prefix и data-suffix у input, например «$» и «%»; число по локали страницы через Intl)
  for (const r of $$('.slider input[type="range"], .calc input[type="range"]')) {
    const o = r.closest('.slider')?.querySelector('.slider__v'), mn = +(r.min || 0), mx = +(r.max || 100);
    const upd = () => { r.style.setProperty('--v', (r.value - mn) / (mx - mn || 1) * 100 + '%');
      if (o) o.textContent = (r.dataset.prefix || '') + num(+r.value) + (r.dataset.suffix || ''); };
    r.addEventListener('input', upd); upd();
  }

  // калькулятор сценария (раздел «Инвестиции»): ставку аренды не подставляем, результат молчит, пока её не ввели.
  // Доход STR = посуточная ставка x 365 x заполняемость, LTR = месячная x 12 x заполняемость; минус доли расходов и прочие расходы.
  for (const c of $$('[data-scen]')) {
    const f = n => $(`[name="${n}"]`, c);
    const calc = () => {
      const opt = f('country').selectedOptions[0], med = +opt.dataset.med, budget = +f('budget').value, str = f('mode').value === 'str';
      $('[data-out="area"]', c).textContent = med ? num(Math.round(budget / med)) : '-';
      $('[data-out="ratel"]', c).textContent = str ? T.rateDay : T.rateMonth;
      $('[data-out="fees"]', c).hidden = !str;
      const rate = +f('rate').value, occ = +f('occ').value, other = +f('other').value || 0, res = $('[data-out="res"]', c);
      if (!rate || !occ || !budget) { res.textContent = T.rateAsk; res.classList.remove('is-on'); return; }
      const gross = (str ? rate * 365 : rate * 12) * occ / 100, share = .25 + .065 + .04 + (str ? .04 : 0), net = gross * (1 - share) - other;
      res.innerHTML = T.scen(pct(net / budget * 100), usd(gross), usd(gross * share + other), usd(net)); res.classList.add('is-on');
    };
    c.addEventListener('input', calc); c.addEventListener('change', calc); calc();
  }

  // модалки и ящики по [data-dlg="id"]: закрытый каталог, формы-ворота, любые dialog.modal и dialog.drawer; закрывают фон и [data-close]
  document.addEventListener('click', e => { const b = e.target.closest('[data-dlg]'); if (!b) return; const d = document.getElementById(b.dataset.dlg); if (d && d.showModal) { e.preventDefault(); d.showModal(); } });
  for (const d of $$('dialog:is(.leadm, .modal, .drawer):not(#lead, #mnav, #aid, .fpanel)')) d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });

  // согласие на куки (решение владельца 09.10.2026, 152-ФЗ): разметка - общий блок kit/obshchee/kuki.html. Плашка section#consent немодальная:
  // видна при первом визите, страница под ней доступна, фокус не ловится. Кнопки [data-consent] где угодно: all («Принять все»),
  // necessary («Только необходимые»), settings (окно dialog#consent-set: «Настроить» в плашке, «Настройки куки» в подвале, витрина).
  // Выбор в localStorage['hb-consent'] = {v: версия текста (data-v плашки), at: ISO-дата, analytics, ads}; другая версия или выбор старше
  // 12 месяцев не считаются, и плашка показывается снова. Пока плашка видна, html.has-consent и --consent-h поднимают кнопки и тосты над ней.
  // На сайте (не в макете): скрипты аналитики (Яндекс Метрика с Вебвизором, GA4, GTM) и рекламы (Meta Pixel, рекламные метки Google) грузятся
  // только после согласия по своей категории (событие hb:consent), до него не грузятся вовсе; при отзыве перестают грузиться, а их куки
  // (_ym*, _ga*, _fbp) стираются. Выбор пишется ещё и на сервер, в журнал согласий (время, версия текста, выбор, идентификатор посетителя):
  // это доказательство согласия по ст. 9 ч. 3 152-ФЗ, бремя которого на операторе; localStorage браузера доказательством не является.
  const cBar = $('#consent'), cDlg = $('#consent-set');
  if (cDlg && cDlg.showModal) {
    const KEY = 'hb-consent', V = cBar ? cBar.dataset.v : '', cForm = $('form', cDlg);
    const read = () => { let c = null; try { c = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
      if (!c || c.v !== V) return null; const end = new Date(c.at); end.setMonth(end.getMonth() + 12); return end > new Date() ? c : null; };
    const ro = window.ResizeObserver && cBar ? new ResizeObserver(() => root.style.setProperty('--consent-h', cBar.offsetHeight + 'px')) : null;
    const bar = on => { if (!cBar) return; cBar.hidden = !on; root.classList.toggle('has-consent', on);
      if (!ro) return; if (on) ro.observe(cBar); else { ro.disconnect(); root.style.removeProperty('--consent-h'); } };
    let cur = read(), opener = null, saved = false;
    // фокус из спрятанной плашки не падает на body: переходит на main, и Tab продолжает с начала содержимого страницы
    const toMain = () => { const m = $('main'); if (!m) return; if (!m.hasAttribute('tabindex')) m.tabIndex = -1; m.focus({ preventScroll: true }); };
    const save = (analytics, ads) => {
      cur = { v: V, at: new Date().toISOString(), analytics, ads };
      try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {} // без хранилища выбор живёт до перезагрузки
      const lost = cBar && cBar.contains(document.activeElement);
      bar(false); if (lost) toMain(); document.dispatchEvent(new CustomEvent('hb:consent', { detail: { analytics, ads } }));
    };
    document.addEventListener('click', e => { const b = e.target.closest('[data-consent]'); if (!b) return; const k = b.dataset.consent;
      if (k === 'all') save(true, true); else if (k === 'necessary') save(false, false);
      else if (k === 'settings') { opener = b; cForm.analytics.checked = !!(cur && cur.analytics); cForm.ads.checked = !!(cur && cur.ads); saved = false; cDlg.showModal(); } });
    cForm.addEventListener('submit', () => { save(cForm.analytics.checked, cForm.ads.checked); saved = true; }); // method="dialog": окно закрывает браузер
    // Esc и крестик закрывают без сохранения; фокус возвращается к кнопке, открывшей окно, а если она спряталась вместе с плашкой - на main
    cDlg.addEventListener('close', () => { if (opener && opener.isConnected && opener.getClientRects().length) opener.focus(); else toMain();
      if (saved && window.hbToast) window.hbToast(T.consentSaved, 'ok'); saved = false; });
    bar(!cur);
  }

  // пошаговый квиз [data-quiz]: шаги fieldset.quiz__s, выбор варианта ведёт дальше, «Назад» возвращает,
  // на последнем шаге в [data-qsum] сводка ответов; отправка как у любой .form
  for (const q of $$('[data-quiz]')) {
    const steps = $$('.quiz__s', q), n = $('[data-qn]', q), pr = $('.progress', q), back = $('[data-qback]', q), sum = $('[data-qsum]', q);
    let i = 0;
    const go = k => {
      i = k; steps.forEach((s, j) => { s.hidden = j !== i; }); n.textContent = i + 1; back.hidden = i === 0;
      if (pr) { pr.style.setProperty('--v', `${(i + 1) / steps.length * 100}%`); pr.setAttribute('aria-valuenow', i + 1); } // индикатор .progress--steps
      if (sum && i === steps.length - 1) sum.replaceChildren(...steps.slice(0, -1).flatMap(s => {
        const c = $('input:checked', s); if (!c) return [];
        const li = document.createElement('li'), b = document.createElement('b');
        li.textContent = $('legend', s).textContent + ': '; b.textContent = c.closest('label').textContent.trim(); li.append(b); return [li]; // текст варианта из label: и label.pill > input + текст, и старый label.chip > input + span
      }));
    };
    q.addEventListener('change', e => { if (e.target.type === 'radio' && i < steps.length - 1 && steps[i].contains(e.target)) setTimeout(() => go(i + 1), reduced ? 0 : 180); });
    back.addEventListener('click', () => go(Math.max(0, i - 1)));
    go(0);
  }

  // форма в несколько шагов: «Далее» пускает дальше, только когда поля текущего шага заполнены верно
  for (const f of $$('[data-fsteps]')) {
    const st = $$('.fstep', f), n = $('[data-fsn]', f), pr = $('.progress', f);
    let i = 0;
    const go = k => { i = k; st.forEach((s, j) => { s.hidden = j !== i; }); if (n) n.textContent = i + 1;
      if (pr) { pr.style.setProperty('--v', `${(i + 1) / st.length * 100}%`); pr.setAttribute('aria-valuenow', i + 1); } };
    f.addEventListener('click', e => {
      if (e.target.closest('[data-fnext]')) {
        const bad = $$('input, select, textarea', st[i]).find(x => !x.checkValidity());
        if (bad) { bad.reportValidity(); return; }
        go(i + 1); st[i].querySelector('input, select')?.focus();
      }
      if (e.target.closest('[data-fprev]')) { go(i - 1); st[i].querySelector(':is(input, select, textarea, button):not(.hp, [type="hidden"])')?.focus(); } // кнопка «Назад» скрылась вместе с шагом: фокус в прежний шаг, а не на body
    });
    go(0);
  }

  // поле по выбору: блок [data-when="имя=значение"] виден и проверяется, только когда в форме выбран этот вариант
  for (const f of $$('form')) {
    const w = $$('[data-when]', f);
    if (!w.length) continue;
    const upd = () => w.forEach(b => {
      const [n, v] = b.dataset.when.split('='), on = f.elements[n]?.value === v;
      b.hidden = !on; $$('input, select, textarea', b).forEach(x => { x.disabled = !on; });
    });
    f.addEventListener('change', upd); upd();
  }

  // липкая панель цены: видна, когда блок data-after ушёл вверх, и прячется, пока на экране форма из data-hide
  for (const pb of $$('.pbar')) {
    const a = $(pb.dataset.after), zs = $$(pb.dataset.hide || 'form.form'); // сама форма, а не обёртка div.form.form--bare
    if (!a) continue; // нет якоря data-after: панель остаётся скрытой, остальные модули работают
    const onScreen = z => { const r = z.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
    const upd = () => { pb.hidden = !(a.getBoundingClientRect().bottom < 0 && !zs.some(onScreen)); };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }

  // подсказки запроса: подставляют текст в поле своей формы, как на сайте
  document.addEventListener('click', e => {
    const b = e.target.closest('.ask__hints [data-q]'); if (!b) return;
    const i = b.closest('form').querySelector('input[name="q"]'); i.value = b.dataset.q; i.focus();
  });
  // голосовой поиск: распознавание речи браузера, без него кнопка прячется
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  document.querySelectorAll('.ask__mic').forEach(m => {
    if (!SR) { m.hidden = true; return; }
    m.addEventListener('click', () => {
      const r = new SR(); r.lang = T.loc; m.setAttribute('aria-pressed', 'true');
      r.onresult = ev => { m.closest('form').querySelector('input[name="q"]').value = ev.results[0][0].transcript; };
      r.onend = () => m.setAttribute('aria-pressed', 'false');
      r.start();
    });
  });
  // столбики [data-bars] без класса .hb3d плоским графиком (владелец 07.10.2026: AED-столбики 3D разъезжались); 3D-столбики .hb3d[data-bars] рисует hb-scene.js.
  // data-bars='[{"label":"Дубай","v":5375,"t":"текст значения","tip":"подсказка"}]' data-prefix="$" data-suffix=" м²"; значение над столбиком, подпись под ним,
  // подсказка из поля tip или подписи со значением; самый высокий столбик нефритом. Столбик в фокусе с клавиатуры показывает ту же подсказку.
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  for (const el of $$('[data-bars]:not(.hb3d)')) {
    let data = []; try { data = JSON.parse(el.dataset.bars); } catch (_) { continue; }
    const max = Math.max(...data.map(d => +d.v), 1), txt = d => d.t || (el.dataset.prefix || '') + num(d.v) + (el.dataset.suffix || '');
    const cols = mk('div', 'chart__cols');
    for (const d of data) {
      const c = mk('div', 'chart__c' + (+d.v === max ? ' is-max' : '')); c.tabIndex = 0; c.dataset.tip = d.tip || `${d.label}\n${txt(d)}`; c.style.setProperty('--h', (+d.v / max * 100).toFixed(1));
      c.append(mk('b', '', txt(d)), mk('i'), mk('span', '', d.label)); cols.append(c);
    }
    el.classList.add('chart'); el.replaceChildren(cols);
  }

  // карта рынков [data-dmap] (решение владельца 07.10.2026: вместо Leaflet со странами и 3D-планеты): точки в стиле паттерна «Планета»,
  // суша из LAND (hb-data.js), рамка по меткам. Метки: data-countries="all|uae,thailand" (HB_COUNTRIES, число проектов в подсказке)
  // или data-pins='[[lat,lon,"Страна: пояснение","ссылка"]]'; data-href - ссылка у меток стран; data-ratio - пропорция на широком экране.
  // Подпись у метки ставится справа, слева, сверху или снизу, где не налезает на соседние; иначе прячется, текст остаётся в подсказке.
  const dmaps = $$('[data-dmap]');
  if (dmaps.length && window.LAND) {
    const isLand = (lat, lon) => { const row = LAND.rows[Math.round((lat - LAND.lat0) / LAND.step)]; if (!row) return false;
      const j = Math.floor((((lon + 180) % 360) + 360) % 360 / 360 * row[0]); for (let k = 1; k < row.length; k += 2) if (j >= row[k] && j < row[k] + row[k + 1]) return true; return false; };
    const pinsOf = el => { const d = el.dataset;
      if (d.countries) { const keys = d.countries === 'all' ? null : d.countries.split(',').map(s => s.trim());
        return (window.HB_COUNTRIES || []).filter(c => !keys || keys.includes(c.path.split('/').pop())).map(c => ({ lat: c.lat, lon: c.lon, name: c.name, n: +c.n, href: d.href, tip: `${c.name}\n${num(+c.n)} ${plural(+c.n, T.projects)}${T.inCat}` })); }
      let a = []; try { a = JSON.parse(d.pins || '[]'); } catch (_) {}
      return a.map(([lat, lon, t, u]) => { const [name, ...r] = String(t).split(': '); return { lat, lon, name, n: 0, href: u, tip: name + (r.length ? '\n' + r.join(': ') : '') }; }); };
    const drawDmap = el => {
      const pins = pinsOf(el); if (!pins.length) return;
      const wide = el.clientWidth >= 640, R = wide ? (+el.dataset.ratio || 2.4) : 1.5;
      let x0 = Math.min(...pins.map(p => p.lon)), x1 = Math.max(...pins.map(p => p.lon)), y0 = Math.min(...pins.map(p => p.lat)), y1 = Math.max(...pins.map(p => p.lat));
      const pad = Math.max(10, (x1 - x0) * .14); x0 -= pad; x1 += pad; y0 -= pad * .8; y1 += pad * .8;
      if ((x1 - x0) / (y1 - y0) < R) { const c = (x0 + x1) / 2, h = (y1 - y0) * R / 2; x0 = c - h; x1 = c + h; } else { const c = (y0 + y1) / 2, h = (x1 - x0) / R / 2; y0 = c - h; y1 = c + h; }
      const st = Math.max(wide ? 1 : 1.5, (x1 - x0) / (wide ? 110 : 64)), W = Math.round((x1 - x0) / st), H = Math.round((y1 - y0) / st);
      let land = '', sea = ''; const dot = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) { const x = j + .5, y = i + .5; if (isLand(y1 - y * st, x0 + x * st)) land += dot(x, y, .34); else sea += dot(x, y, .13); }
      const box = mk('div', 'dmap__box'); box.style.aspectRatio = `${W} / ${H}`;
      box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><path class="dmap__sea" d="${sea}"/><path class="dmap__land" d="${land}"/></svg>`;
      // метки ближе 24px на этой ширине касаются кольцами (метка 20px плюс ободок): Кипр и Северный Кипр, на телефоне весь Ближний Восток. Такие сливаются в одну метку
      // в среднем месте: названия с общим словом сворачиваются до него («Кипр»), подпись «А, Б» или «А и ещё N»; в подсказке каждая часть своей строкой
      const cw = el.clientWidth || 600, px = p => [(p.lon - x0) / (x1 - x0) * cw, (y1 - p.lat) / (y1 - y0) * cw * H / W], groups = [];
      for (const p of pins.sort((a, b) => b.n - a.n)) { const g = groups.find(g => Math.hypot(px(g[0])[0] - px(p)[0], px(g[0])[1] - px(p)[1]) < 24); g ? g.push(p) : groups.push([p]); }
      const merged = groups.map(g => { if (g.length === 1) return g[0];
        const words = g.map(p => p.name.split(/[\s()]+/)), short = words.map(ws => ws.find(w => w.length > 3 && words.some(o => o !== ws && o.includes(w))));
        const names = [...new Set(g.map((p, i) => short[i] || p.name))], name = names.length < 3 ? names.join(', ') : T.andMore(names[0], names.length - 1);
        return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length, n: g.reduce((s, p) => s + p.n, 0), href: g[0].href,
          name, tip: name + '\n' + g.map(p => p.tip.replace('\n', ': ').replace(T.inCat, '')).join('\n') }; });
      const items = merged.map(p => { const a = mk(p.href ? 'a' : 'span', 'dmap__pin'); if (p.href) a.href = p.href; else a.tabIndex = 0;
        a.dataset.tip = p.tip; a.setAttribute('aria-label', p.tip.replace('\n', ': ')); a.style.left = ((p.lon - x0) / (x1 - x0) * 100).toFixed(2) + '%'; a.style.top = ((y1 - p.lat) / (y1 - y0) * 100).toFixed(2) + '%';
        a.append(mk('i'), mk('span', 'dmap__l', p.name)); box.append(a); return a; });
      el.replaceChildren(box);
      // подписи: первая свободная сторона; занятые места - точки всех меток и уже поставленные подписи
      const hit = (r, s) => r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom, bx = box.getBoundingClientRect(), inside = r => r.left >= bx.left && r.right <= bx.right && r.top >= bx.top && r.bottom <= bx.bottom;
      const taken = items.map(a => a.firstChild.getBoundingClientRect());
      for (const a of items) { const l = a.lastChild; let ok = false;
        for (const side of ['r', 'l', 't', 'b']) { a.dataset.side = side; const r = l.getBoundingClientRect(); if (inside(r) && !taken.some(s => hit(r, s))) { taken.push(r); ok = true; break; } }
        if (!ok) { a.dataset.side = 'r'; a.classList.add('is-nolabel'); } }
    };
    for (const el of dmaps) { drawDmap(el); let w = el.clientWidth, t; new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) < 2) return; w = el.clientWidth; clearTimeout(t); t = setTimeout(() => drawDmap(el), 120); }).observe(el); }
  }

  // «Полезно» [data-like="id"] data-count: нажатие прибавляет один голос, второе снимает; выбор помнится в браузере (hb-like:id),
  // все кнопки с тем же id на странице синхронны (крупная карточка и список). Без хранилища кнопка работает до перезагрузки.
  const likes = $$('[data-like]');
  if (likes.length) {
    const get = id => { try { return localStorage.getItem('hb-like:' + id) === '1'; } catch (_) { return false; } };
    const put = (id, on) => { try { on ? localStorage.setItem('hb-like:' + id, '1') : localStorage.removeItem('hb-like:' + id); } catch (_) {} };
    const paint = (id, on) => { for (const b of likes) if (b.dataset.like === id) { const n = +b.dataset.count + (on ? 1 : 0);
      b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.querySelector('b').textContent = num(n); b.setAttribute('aria-label', T.useful(num(n))); } };
    for (const b of likes) if (get(b.dataset.like)) paint(b.dataset.like, true);
    document.addEventListener('click', e => { const b = e.target.closest('[data-like]'); if (!b) return; e.preventDefault();
      const id = b.dataset.like, on = b.getAttribute('aria-pressed') !== 'true'; put(id, on); paint(id, on); });
  }

  // сноски: ссылка [1] на источник в той же статье прокручивает его в центр экрана и коротко подсвечивает; фокус переходит на источник
  document.addEventListener('click', e => { const a = e.target.closest('sup a[href^="#"]'); if (!a) return;
    const t = document.getElementById(decodeURIComponent(a.hash.slice(1))); if (!t) return; e.preventDefault();
    t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (!t.hasAttribute('tabindex')) t.tabIndex = -1; t.focus({ preventScroll: true }); history.replaceState(null, '', a.hash);
    t.classList.remove('is-flash'); void t.offsetWidth; t.classList.add('is-flash'); setTimeout(() => t.classList.remove('is-flash'), 2600); });

  // подсказки графиков: [data-tip] показывает пояснение при наведении, фокусе с клавиатуры и касании; плашка .tip одна на страницу.
  // Перевод строки в тексте (&#10; в атрибуте) начинает вторую, мелкую строку. Сцены hb-scene.js зовут window.hbTip.show(x, y, текст) по точке экрана; их блок помечен [data-tip-area], касание в нём плашку не гасит.
  const tip = document.createElement('div'); tip.className = 'tip'; tip.id = 'hb-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  let tipFor = null;
  const tipAt = (x, y, text, side) => {
    const [head, ...rest] = text.split('\n'), b = document.createElement('b'); b.textContent = head;
    tip.replaceChildren(b, ...rest.map(t => { const s = document.createElement('span'); s.textContent = t; return s; }));
    tip.hidden = false; const w = tip.offsetWidth, th = tip.offsetHeight;
    // side: плашка сбоку от точки (справа, у края экрана слева), чтобы не закрывать подписи над башнями
    const left = side ? (x + 16 + w > innerWidth - 8 ? x - 16 - w : x + 16) : Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)),
      top = side ? Math.max(8, y - th / 2) : y - th - 10 < 8 ? y + 18 : y - th - 10;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`; };
  const tipHide = () => { tip.hidden = true; if (tipFor) { tipFor.classList.remove('is-tip'); tipFor.removeAttribute('aria-describedby'); } tipFor = null; };
  const tipOn = el => { if (tipFor !== el) tipHide(); tipFor = el; el.classList.add('is-tip'); el.setAttribute('aria-describedby', 'hb-tip');
    const r = (el.querySelector('.bar__fill') || el).getBoundingClientRect(); tipAt(r.left + r.width / 2, r.top, el.dataset.tip); };
  window.hbTip = { show: tipAt, hide: tipHide };
  // касание: плашка остаётся до касания в другом месте или прокрутки, поэтому уход пальца её не прячет
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) tipOn(el); });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) tipHide(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('[data-tip], [data-tip-area]')) tipHide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) tipOn(el); });
  document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) tipHide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') tipHide(); });
  addEventListener('scroll', () => { if (tipFor && tipFor.matches(':focus-visible')) tipOn(tipFor); else tipHide(); }, { passive: true }); // Tab прокручивает к элементу: плашка фокуса едет с ним
  // подсказка у любого элемента: тот, что сам фокус не получает (li, span, abbr), встаёт в порядок Tab, чтобы плашку видели и с клавиатуры
  // Остановка Tab без текста (точка и полоса шкалы цен) получает имя: первая строка подсказки, роль img; иначе диктор читает пустоту
  for (const el of $$('[data-tip]')) { if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.textContent.trim() && !el.hasAttribute('role') && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', el.dataset.tip.split('\n')[0]); } }

  // тост: window.hbToast(текст, вид) показывает всплывашку снизу по центру; вид 'ok', 'warn', 'err', без вида сведения.
  // Закрывается сам через 5 с или кнопкой. Регион role=status стоит с загрузки (иначе диктор не озвучит), сам ничего не показывает (Р-27)
  const toasts = document.createElement('div'); toasts.className = 'toasts'; toasts.setAttribute('role', 'status'); document.body.append(toasts);
  const svg = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; // свой рисунок: спрайты страниц разные
  const tIc = { info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', ok: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>', err: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>' }; // как i-ban у .notice--err
  window.hbToast = (text, kind) => {
    const k = tIc[kind] ? kind : 'info', t = document.createElement('div'), back = document.activeElement; let timer = 0;
    t.className = k === 'info' ? 'toast' : `toast toast--${k}`;
    t.innerHTML = `${svg(tIc[k])}<p class="toast__t"></p><button type="button" class="btn btn--icon btn--quiet btn--xs toast__x" aria-label="${T.dismiss}">${svg('<path d="M18 6 6 18M6 6l12 12"/>')}</button>`;
    $('.toast__t', t).textContent = text;
    // фокус был в тосте (крестик): возвращается туда, откуда тост вызвали, а не падает на body
    let gone = false;
    const close = () => { gone = true; clearTimeout(timer); const had = t.contains(document.activeElement); t.remove(); if (had && back && back.isConnected && back !== document.body) back.focus({ preventScroll: true }); };
    // наведение и фокус держат тост; после ухода снова 5 с (WCAG 2.2.1)
    const arm = () => { clearTimeout(timer); timer = setTimeout(close, 5000); }, hold = () => clearTimeout(timer);
    t.addEventListener('pointerenter', hold); t.addEventListener('pointerleave', () => { if (!t.contains(document.activeElement)) arm(); });
    t.addEventListener('focusin', hold); t.addEventListener('focusout', e => { if (!t.contains(e.relatedTarget) && !t.matches(':hover')) arm(); });
    $('.toast__x', t).addEventListener('click', close);
    // открытая модалка лежит в top layer, а body под ней инертен: регион переезжает в неё, без модалки он в body.
    // Переехавший регион диктор подхватывает не сразу, поэтому тост в него ставится следующим шагом
    const host = $$('dialog[open]').pop() || document.body, moved = toasts.parentNode !== host;
    if (moved) host.append(toasts);
    const show = () => { if (!gone) { toasts.append(t); arm(); } };
    if (moved) setTimeout(show, 50); else show();
    return close;
  };
})();
