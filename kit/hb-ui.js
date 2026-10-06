/* Housebook kit: hb-ui.js. Поведение страниц без зависимостей. Подключать в конце body: <script src="hb-ui.js" defer></script>.
   Тема: ранняя установка класса dusk идёт inline-сниппетом в head (см. _shablon.html), здесь только переключатель .night.
   Каждый модуль ищет свою разметку и молча пропускается, если её на странице нет. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

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
    trig.setAttribute('aria-haspopup', 'listbox'); trig.setAttribute('aria-expanded', 'false'); trig.setAttribute('aria-controls', 'cs-list' + n);
    trig.innerHTML = `<span class="cs__val" id="cs-v${n}"></span>`; if (labEl) trig.setAttribute('aria-labelledby', `${labEl.id} cs-v${n}`);
    // панель в top layer (popover): поверх любых секций, шапки и overflow:hidden; координаты от кнопки, при нехватке места снизу открывается вверх
    const pop = document.createElement('div'); pop.className = 'cs__pop'; pop.hidden = true; if (pop.showPopover) pop.popover = 'manual';
    const search = sel.dataset.search ? sel.dataset.search === 'on' : opts.length > 5;
    const q = search ? Object.assign(document.createElement('input'), { type: 'search', className: 'cs__q input', placeholder: 'Найти', autocomplete: 'off' }) : null;
    if (q) { q.setAttribute('aria-label', 'Поиск по списку'); q.setAttribute('aria-controls', 'cs-list' + n); pop.appendChild(q); }
    const list = document.createElement('ul'); list.className = 'cs__list'; list.id = 'cs-list' + n; list.setAttribute('role', 'listbox'); list.tabIndex = -1;
    if (multi) list.setAttribute('aria-multiselectable', 'true'); if (labEl) list.setAttribute('aria-labelledby', labEl.id);
    let group = null; const heads = [];
    const items = opts.map((o, i) => {
      const g = o.parentNode.tagName === 'OPTGROUP' ? o.parentNode : null;
      if (g && g !== group) { const h = document.createElement('li'); h.className = 'cs__grp'; h.setAttribute('role', 'presentation'); h.textContent = g.label; h.items = []; list.appendChild(h); heads.push(h); }
      group = g;
      const li = document.createElement('li'); li.id = `cs${n}-${i}`; li.className = 'cs__opt'; li.setAttribute('role', 'option'); li.dataset.i = i; li.textContent = o.textContent;
      if (o.disabled) li.setAttribute('aria-disabled', 'true'); if (g) heads[heads.length - 1].items.push(li);
      list.appendChild(li); return li;
    });
    const none = document.createElement('li'); none.className = 'cs__none'; none.setAttribute('role', 'presentation'); none.textContent = 'Ничего не найдено'; none.hidden = true; list.appendChild(none);
    pop.appendChild(list);
    if (multi) { const f = document.createElement('div'); f.className = 'cs__foot';
      f.innerHTML = '<button type="button" class="btn btn--s" data-cs="reset">Сбросить</button><button type="button" class="btn btn--acc btn--s" data-cs="done">Готово</button>'; pop.appendChild(f); }
    wrap.append(trig, pop);

    let act = null;
    const vis = () => items.filter(li => !li.hidden && li.getAttribute('aria-disabled') !== 'true');
    const fire = () => { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); };
    const sync = () => {
      items.forEach((li, i) => li.setAttribute('aria-selected', String(opts[i].selected)));
      const ch = opts.filter(o => o.selected), ph = sel.dataset.placeholder || 'Все';
      $('.cs__val', trig).textContent = multi ? (!ch.length ? ph : ch.length <= 2 ? ch.map(o => o.textContent).join(', ') : `Выбрано: ${ch.length}`) : (ch[0] ? ch[0].textContent : ph);
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
  // условное (data-total уменьшается на каждую активную группу); на сайте его отдаёт API. Склонение: data-noun="проект|проекта|проектов".
  for (const bar of $$('.fbar')) {
    const total = +bar.dataset.total || 0, nouns = (bar.dataset.noun || 'объект|объекта|объектов').split('|');
    const meta = $('.fmeta', bar.parentElement), // между фильтром и счётчиком могут стоять быстрые чипы
      mob = matchMedia('(max-width: 899px)');
    const plural = n => nouns[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
    const fmt = n => n.toLocaleString('ru-RU').replace(/\s/g, ' ');
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
      foot.innerHTML = '<button type="button" class="btn btn--s" data-reset>Сбросить</button><button type="button" class="btn btn--acc btn--s" data-show></button>';
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
    // панель «Все фильтры»: группы переезжают в неё и возвращаются при закрытии, поля и их значения остаются те же
    let panel = null, home = [];
    const groups = () => [...dds.map(d => d.body), ...extra];
    if (all && typeof HTMLDialogElement === 'function') {
      panel = document.createElement('dialog'); panel.className = 'fpanel'; panel.setAttribute('aria-labelledby', 'fpanel-h');
      panel.innerHTML = '<div class="fpanel__head"><h2 id="fpanel-h">Все фильтры</h2><button type="button" class="fmeta__reset" data-reset-all>Сбросить</button><button type="button" class="fpanel__x" aria-label="Закрыть" data-close><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button></div><div class="fpanel__body"></div><div class="fpanel__foot"><button type="button" class="btn btn--acc" data-close data-show></button></div>';
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
      const n = Math.max(1, Math.round(total * .58 ** act)), txt = `Показать ${fmt(n)} ${plural(n)}`;
      for (const b of shows) b.textContent = txt;
      if (all) { all.classList.toggle('is-on', sum > 0); $('.fbtn__n', all).textContent = sum || ''; }
      if (meta) { const c = $('[data-fcount]', meta), w = $('[data-fnoun]', meta), r = $('.fmeta__reset', meta);
        if (c) c.textContent = fmt(n); if (w) w.textContent = plural(n); if (r) r.hidden = !act; }
    };
    const mine = t => bar.contains(t) || (panel && panel.contains(t));
    document.addEventListener('input', e => { if (mine(e.target)) update(); });
    document.addEventListener('change', e => { if (mine(e.target)) update(); });
    if (meta) $('.fmeta__reset', meta)?.addEventListener('click', () => { for (const g of groups()) reset(g); if (loc) reset(loc); update(); });
    bar.addEventListener('submit', e => e.preventDefault());
    update();
  }

  // возврат к блоку, который не следует за скроллом (решение владельца 06.10.2026: липкое не больше 15-20% экрана).
  // .filters--sticky и [data-return="Подпись"] стоят на месте; когда блок ушёл вверх, а его секция ещё на экране,
  // внизу слева появляется кнопка «Фильтры», она возвращает к блоку и ставит фокус в первое поле.
  for (const el of $$('.filters--sticky, [data-return]')) {
    const zone = el.closest('.sec, section') || el.parentElement;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ret'; b.hidden = true;
    b.innerHTML = '<svg class="ic" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg><span></span>'; $('span', b).textContent = el.dataset.return || 'Фильтры';
    document.body.appendChild(b);
    const upd = () => { const r = el.getBoundingClientRect(), z = zone.getBoundingClientRect(); b.hidden = !(r.bottom < 0 && z.bottom > innerHeight * .5); };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    b.addEventListener('click', () => { el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      const f = $('button, input, select, [tabindex]:not([tabindex="-1"])', el); if (f) setTimeout(() => (f.matches('select') ? f.focus() : f.focus({ preventScroll: true })), reduced ? 0 : 400); });
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
        rows.sort((a, b) => { const x = key(a), y = key(b); return (num ? x - y : String(x).localeCompare(String(y), 'ru')) * dir; });
        for (const r of rows) body.appendChild(r);
      });
    });
  }

  // reveal, счётчики и столбики оживают, когда попадают в кадр; при reduced-motion сразу финальное состояние
  {
    const seen = new WeakSet();
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting || seen.has(e.target)) return; seen.add(e.target); e.target.classList.add('in'); io.unobserve(e.target);
      const b = e.target.querySelector('[data-count]');
      if (b && !reduced) { const final = b.dataset.count, n = +final.replace(/\s/g, ''), t0 = performance.now();
        const tick = now => { const k = Math.min(1, (now - t0) / 900); b.textContent = k < 1 ? Math.round(n * (1 - Math.pow(1 - k, 3))).toLocaleString('ru-RU').replace(/[,\s]/g, ' ') : final; if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick); }
      if (!reduced) for (const f of e.target.querySelectorAll('.bar__fill')) { const h = f.dataset.h ??= f.style.getPropertyValue('--h'); f.style.setProperty('--h', '0'); requestAnimationFrame(() => requestAnimationFrame(() => f.style.setProperty('--h', h))); }
    }), { threshold: .2 });
    for (const el of $$('.reveal, .bars')) io.observe(el);
  }

  // подсказка про интерактив планеты: один раз, пока пользователь на первом экране
  const hint = $('#hint');
  if (hint) { let shown = false; const on = () => { if (shown || scrollY > innerHeight * .4 || root.classList.contains('no-webgl') || root.classList.contains('no-3d')) return; shown = true; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 4200); };
    setTimeout(on, 1800); addEventListener('scroll', () => { if (scrollY > innerHeight * .4) hint.classList.remove('on'); }, { passive: true }); }

  // помощник AI: кнопка всплывает, когда поле запроса (data-aid-anchor или .hero .ask) ушло вверх, и прячется у .final; окно на нативном dialog
  const fab = $('#aid-fab'), dlg = $('#aid');
  if (fab && dlg) {
    const anchor = $('[data-aid-anchor]') || $('.hero .ask'), fin = $('.final'), st = new Map();
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
      if (cap) cap.textContent = `${cur + 1} из ${thumbs.length}${t.dataset.cap ? ' · ' + t.dataset.cap : ''}`;
      thumbs.forEach((b, k) => b.setAttribute('aria-current', String(k === cur))); };
    thumbs.forEach((b, i) => b.addEventListener('click', () => go(i)));
    const prev = $('[data-prev]', g), next = $('[data-next]', g);
    if (prev) prev.addEventListener('click', () => go(cur - 1)); if (next) next.addEventListener('click', () => go(cur + 1));
    g.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'ArrowRight') go(cur + 1); });
    if (thumbs.length) go(0);
    // полноэкранный просмотр кадра
    $('[data-full]', g)?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : $('.gallery__main', g).requestFullscreen?.());
  }

  // избранное: переключатель aria-pressed
  for (const b of $$('.fav')) b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное'); });

  // форма заявки: проверка на клиенте, ошибки у полей, состояние успеха; отправку делает страница (data-endpoint), без него показывается успех
  for (const f of $$('form.form')) {
    f.noValidate = true;
    f.addEventListener('submit', async e => {
      e.preventDefault(); let first = null;
      for (const el of f.querySelectorAll('[required]')) {
        const box = el.closest('.field, .check'), ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '' && el.checkValidity();
        if (box) box.classList.toggle('is-err', !ok); el.setAttribute('aria-invalid', String(!ok)); if (!ok && !first) first = el;
      }
      if (first) { first.focus(); return; }
      const ep = f.dataset.endpoint;
      if (ep) { try { const r = await fetch(ep, { method: 'POST', body: new FormData(f) }); if (!r.ok) throw new Error(r.status); } catch (err) { const n = f.querySelector('.form__fail'); if (n) n.hidden = false; return; } }
      f.classList.add('is-ok'); const ok = f.querySelector('.form__ok'); if (ok) { ok.tabIndex = -1; ok.focus(); }
    });
    f.addEventListener('input', e => { const box = e.target.closest('.is-err'); if (box && (e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim())) { box.classList.remove('is-err'); e.target.removeAttribute('aria-invalid'); } });
  }

  // оглавление статьи: подсветка текущего раздела
  const toc = $('.toc');
  if (toc) { const links = $$('a[href^="#"]', toc), secs = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
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
      try { if (navigator.share) await navigator.share({ title: a.textContent, url }); else { await navigator.clipboard.writeText(url); b.title = 'Ссылка скопирована'; b.setAttribute('aria-label', 'Ссылка скопирована'); } } catch (_) {} });
  }

  // выдача: быстрые чипы переключаются и попадают в строку активных фильтров; «Сбросить» снимает всё
  for (const res of $$('[data-results]')) {
    const chips = $$('.qchip', res), act = $('.achips', res);
    const draw = () => { if (!act) return; act.innerHTML = ''; const on = chips.filter(q => q.getAttribute('aria-pressed') === 'true');
      for (const q of on) { const b = document.createElement('button'); b.type = 'button'; b.className = 'achip'; b.innerHTML = `${q.textContent}<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>`; b.setAttribute('aria-label', `Убрать фильтр «${q.textContent}»`); b.addEventListener('click', () => { q.setAttribute('aria-pressed', 'false'); draw(); }); act.append(b); }
      if (on.length) { const r = document.createElement('button'); r.type = 'button'; r.className = 'fmeta__reset'; r.textContent = 'Сбросить'; r.addEventListener('click', () => { chips.forEach(q => q.setAttribute('aria-pressed', 'false')); draw(); }); act.append(r); } };
    for (const q of chips) q.addEventListener('click', () => { q.setAttribute('aria-pressed', String(q.getAttribute('aria-pressed') !== 'true')); draw(); });

    // «Списком / На карте»: карта Leaflet грузится при первом открытии, пины по data-pins="[[lat,lng,'подпись'],...]"
    const vbtn = $$('.view button', res), list = $('.cards', res), pager = $('.pager', res), map = $('.cmap', res);
    const show = mode => { vbtn.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === mode))); if (list) list.hidden = mode === 'map'; if (pager) pager.hidden = mode === 'map'; if (map) { map.hidden = mode !== 'map'; if (mode === 'map') drawMap(map); } };
    for (const b of vbtn) b.addEventListener('click', () => show(b.dataset.view));
  }
  let leafletP = null;
  const loadLeaflet = () => leafletP ||= new Promise((ok, no) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.append(l);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
  async function drawMap(el) {
    if (el.dataset.ready) return; el.dataset.ready = '1';
    try { await loadLeaflet(); } catch (_) { el.textContent = 'Карта не загрузилась. Проверьте соединение и откройте снова.'; return; }
    const pins = JSON.parse(el.dataset.pins || '[]'), m = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; участники OpenStreetMap', maxZoom: 18 }).addTo(m);
    // пин точкой, название проекта в подсказке: подписи соседних проектов не налезают друг на друга
    // четвёртый элемент пина: ссылка, по клику на точку переход (карта стран ведёт в гиды)
    const g = L.featureGroup(pins.map(([la, ln, t, u]) => { const mk = L.marker([la, ln], { title: t, icon: L.divIcon({ className: '', html: '<span class="mpin"></span>', iconSize: [18, 18] }) }).bindTooltip(t, { direction: 'top', offset: [0, -10] }); if (u) mk.on('click', () => { location.href = u; }); return mk; })).addTo(m);
    m.fitBounds(g.getBounds(), { padding: [40, 40], maxZoom: +el.dataset.zoom || 12 });
  }
  // карта без переключателя (страница проекта): грузится, когда доходит до экрана
  for (const el of $$('.cmap[data-auto]')) new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); drawMap(el); } }, { rootMargin: '200px' }).observe(el);

  // «Поделиться» страницей: системное меню или копирование ссылки
  for (const b of $$('[data-share]')) b.addEventListener('click', async () => {
    try { if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else { await navigator.clipboard.writeText(location.href); b.lastChild.textContent = 'Ссылка скопирована'; } } catch (_) {} });

  // калькулятор доходности, формула как на сайте (ROICalculator): аренда x 12 x заполняемость минус налог,
  // обслуживание за м² и комиссия за поиск арендатора в одну месячную аренду
  for (const c of $$('[data-calc]')) {
    const v = n => +$(`[name="${n}"]`, c).value, usd = x => '$' + Math.round(x).toLocaleString('ru-RU'), pct = x => x.toFixed(1).replace('.', ',') + '%';
    const out = (k, t) => { for (const e of $$(`[data-out="${k}"]`, c)) e.textContent = t; };
    const calc = () => {
      for (const r of $$('input[type="range"]', c)) $('#o-' + r.name, c).textContent = r.dataset.fmt === 'pct' ? r.value + '%' : usd(r.value);
      const price = v('price'), rent = v('rent'), ga = rent * 12 * v('occ') / 100, tax = ga * +c.dataset.tax, cam = +c.dataset.cam * +c.dataset.area * 12;
      const net = ga - tax - cam - rent, v5 = price * Math.pow(1 + v('grow') / 100, 5);
      out('month', usd(net / 12)); out('year', usd(net)); out('year2', usd(net)); out('gross', pct(ga / price * 100)); out('net', pct(net / price * 100));
      out('v5', usd(v5)); out('r5', Math.round((net * 5 + v5 - price) / price * 100) + '%');
      out('ga', usd(ga)); out('tax', '-' + usd(tax)); out('cam', '-' + usd(cam)); out('fee', '-' + usd(rent));
    };
    c.addEventListener('input', calc); calc();
  }

  // калькулятор сценария (раздел «Инвестиции»): ставку аренды не подставляем, результат молчит, пока её не ввели.
  // Доход STR = посуточная ставка x 365 x заполняемость, LTR = месячная x 12 x заполняемость; минус доли расходов и прочие расходы.
  for (const c of $$('[data-scen]')) {
    const f = n => $(`[name="${n}"]`, c), usd = x => '$' + Math.round(x).toLocaleString('ru-RU');
    const calc = () => {
      const opt = f('country').selectedOptions[0], med = +opt.dataset.med, budget = +f('budget').value, str = f('mode').value === 'str';
      $('[data-out="area"]', c).textContent = med ? Math.round(budget / med) : '-';
      $('[data-out="ratel"]', c).textContent = str ? 'Посуточная ставка, USD' : 'Месячная ставка, USD';
      $('[data-out="fees"]', c).hidden = !str;
      const rate = +f('rate').value, occ = +f('occ').value, other = +f('other').value || 0, res = $('[data-out="res"]', c);
      if (!rate || !occ || !budget) { res.textContent = 'Введите ставку аренды и заполняемость, чтобы увидеть расчёт'; res.classList.remove('is-on'); return; }
      const gross = (str ? rate * 365 : rate * 12) * occ / 100, share = .25 + .065 + .04 + (str ? .04 : 0), net = gross * (1 - share) - other;
      res.innerHTML = `<b>${(net / budget * 100).toFixed(1).replace('.', ',')}%</b> чистыми в год: доход ${usd(gross)}, расходы ${usd(gross * share + other)}, остаётся ${usd(net)}`; res.classList.add('is-on');
    };
    c.addEventListener('input', calc); c.addEventListener('change', calc); calc();
  }

  // модалки по [data-dlg="id"]: закрытый каталог и другие формы-ворота
  document.addEventListener('click', e => { const b = e.target.closest('[data-dlg]'); if (!b) return; const d = document.getElementById(b.dataset.dlg); if (d && d.showModal) { e.preventDefault(); d.showModal(); } });
  for (const d of $$('dialog.leadm:not(#lead)')) d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });

  // пошаговый квиз [data-quiz]: шаги fieldset.quiz__s, выбор варианта ведёт дальше, «Назад» возвращает,
  // на последнем шаге в [data-qsum] сводка ответов; отправка как у любой .form
  for (const q of $$('[data-quiz]')) {
    const steps = $$('.quiz__s', q), n = $('[data-qn]', q), bar = $('.quiz__bar i', q), back = $('[data-qback]', q), sum = $('[data-qsum]', q);
    let i = 0;
    const go = k => {
      i = k; steps.forEach((s, j) => { s.hidden = j !== i; }); n.textContent = i + 1; back.hidden = i === 0;
      bar.style.setProperty('--p', `${(i + 1) / steps.length * 100}%`);
      if (sum && i === steps.length - 1) sum.replaceChildren(...steps.slice(0, -1).flatMap(s => {
        const c = $('input:checked', s); if (!c) return [];
        const li = document.createElement('li'), b = document.createElement('b');
        li.textContent = $('legend', s).textContent + ': '; b.textContent = c.nextElementSibling.textContent; li.append(b); return [li];
      }));
    };
    q.addEventListener('change', e => { if (e.target.type === 'radio' && i < steps.length - 1 && steps[i].contains(e.target)) setTimeout(() => go(i + 1), reduced ? 0 : 180); });
    back.addEventListener('click', () => go(Math.max(0, i - 1)));
    go(0);
  }

  // форма в несколько шагов: «Далее» пускает дальше, только когда поля текущего шага заполнены верно
  for (const f of $$('[data-fsteps]')) {
    const st = $$('.fstep', f), n = $('[data-fsn]', f);
    let i = 0;
    const go = k => { i = k; st.forEach((s, j) => { s.hidden = j !== i; }); if (n) n.textContent = i + 1; };
    f.addEventListener('click', e => {
      if (e.target.closest('[data-fnext]')) {
        const bad = $$('input, select, textarea', st[i]).find(x => !x.checkValidity());
        if (bad) { bad.reportValidity(); return; }
        go(i + 1); st[i].querySelector('input, select')?.focus();
      }
      if (e.target.closest('[data-fprev]')) go(i - 1);
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
    const a = $(pb.dataset.after), zs = $$(pb.dataset.hide || '.form');
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
      const r = new SR(); r.lang = 'ru-RU'; m.setAttribute('aria-pressed', 'true');
      r.onresult = ev => { m.closest('form').querySelector('input[name="q"]').value = ev.results[0][0].transcript; };
      r.onend = () => m.setAttribute('aria-pressed', 'false');
      r.start();
    });
  });
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
  addEventListener('scroll', tipHide, { passive: true });
})();
