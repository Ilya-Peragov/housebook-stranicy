# Общие блоки страниц макетов: python3 kit/obshchee/sobrat.py (сверка без записи: --check)
# Источники рядом со скриптом: ikonki.svg (спрайт), shapka.html (skip, шапка, мобильное меню), podval.html (подвал),
# ai.html (кнопка и окно AI), zayavka.html (окно заявки). Пишутся как для страницы в корне: пути от корня, без aria-current,
# ссылка EN плейсхолдером {{EN}}, номер WhatsApp плейсхолдером {{WA}}. Цели: все *.html корня, кроме index.html, и kit/glavnaya.html.
# По каждой странице EN и aria-current="page" (сразу после href) берутся из её текущей шапки (мобильное меню обязано
# совпадать), пути страниц в подпапке пересчитываются, каждый блок заменяется ровно по границам элемента (теги внутри
# комментариев <!-- --> не считаются), переводы строк страницы сохраняются. Окно заявки меняется только там, где есть,
# и без ловушки .hp в источнике не раскладывается.
# Любая ошибка - код 2 с причиной; ошибка блока называет страницу и блок, и тогда ничего не пишется. Без аргументов пишет
# только изменившиеся страницы: сначала все во временные файлы, затем подмена, права страниц сохраняются. --check ничего
# не пишет: код 1 и строки страница:блок при расхождении, 0 если всё совпадает.
import os, re, sys, glob, shutil, traceback, posixpath
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(D))
BLOCKS = (  # имя, источник, начало элемента, обязателен
    ('спрайт', 'ikonki.svg', r'<svg xmlns="http://www.w3.org/2000/svg" hidden\b', True),
    ('skip', 'shapka.html', r'<a class="skip"', True),
    ('header', 'shapka.html', r'<header class="top"', True),
    ('mnav', 'shapka.html', r'<dialog\b[^>]*\bid="mnav"', True),
    ('footer', 'podval.html', r'<footer class="foot"', True),
    ('aid-fab', 'ai.html', r'<button\b[^>]*\bid="aid-fab"', True),
    ('aid', 'ai.html', r'<dialog\b[^>]*\bid="aid"', True),
    ('lead', 'zayavka.html', r'<dialog\b[^>]*\bid="lead"', False),
)
KEEP = re.compile(r'[#/?]|[a-z][a-z0-9+.-]*:', re.I)  # якоря, пути от корня, запросы и ссылки со схемой в подпапке не пересчитываются
def rd(p):
    try: return open(p, encoding='utf-8', newline='').read()
    except UnicodeDecodeError as e: raise ValueError('%s не в UTF-8: %s' % (p, e)) from None
def nocom(s): return re.sub(r'<!--.*?-->', lambda m: ' ' * len(m.group(0)), s, flags=re.S)  # комментарии -> пробелы той же длины
def span(s, pat):
    # (начало, конец) единственного элемента, чьё начало совпадает с pat; вложенные одноимённые теги учитываются, теги в комментариях нет
    s = nocom(s); ms = list(re.finditer(pat, s))
    if len(ms) != 1: raise LookupError('нет блока' if not ms else 'блок встречается %d раза' % len(ms))
    tag = re.match(r'<(\w+)', ms[0].group(0)).group(1); depth = 0
    for t in re.finditer(r'<(/?)%s\b[^>]*?(/?)>' % tag, s[ms[0].start():]):
        if not t.group(2): depth += -1 if t.group(1) else 1
        if not depth: return ms[0].start(), ms[0].start() + t.end()
    raise LookupError('блок не закрыт')
def hrefs(s, attr): return re.findall(r'<a\b[^>]*?\bhref="([^"]*)"[^>]*\b%s' % attr, s)
# WhatsApp в общих блоках ({{WA}}): клиентский на клиентских страницах, партнёрский на страницах раздела /pro (pro.html, pro-*.html),
# как на бою (src/lib/constants.ts HOUSEBOOK_WA_GLOBAL и HOUSEBOOK_WA_PARTNERSHIP, выбор isPartnerSurface в src/lib/whatsapp/wa-link.ts)
WA_CLIENT, WA_PRO, PRO = '447418315506', '447418316042', re.compile(r'pro(-[^.]*)?\.html$')
def fit(frag, d, en, cur, name, wa):
    frag = frag.replace('{{EN}}', en).replace('{{WA}}', wa)
    if d: frag = re.sub(r'\b(href|src|action)="([^"]*)"', lambda m: m.group(0) if not m.group(2) or KEEP.match(m.group(2)) else '%s="%s"' % (m.group(1), posixpath.relpath(m.group(2), d)), frag)
    if cur and name in ('header', 'mnav'):  # текущий раздел отмечается в nav шапки и в ссылках меню
        a, b = span(frag, r'<nav\b'); link = '<a href="%s">' % cur
        if frag.count(link, a, b) != 1: raise LookupError('ссылка текущего раздела %s в nav найдена %d раз' % (cur, frag.count(link, a, b)))
        frag = frag[:a] + frag[a:b].replace(link, link[:-1] + ' aria-current="page">') + frag[b:]
    return frag
def main():
    if sys.argv[1:] not in ([], ['--check']): print('запуск: python3 kit/obshchee/sobrat.py [--check]', file=sys.stderr); sys.exit(2)
    check = sys.argv[1:] == ['--check']
    src = {}
    for name, f, pat, need in BLOCKS:
        t = rd(os.path.join(D, f)).replace('\r\n', '\n')  # переводы строк источника приводятся к \n
        try: a, b = span(t, pat)
        except LookupError as e: print('ОШИБКА в источнике %s:%s %s' % (f, name, e), file=sys.stderr); sys.exit(2)
        src[name] = t[a:b]
    if 'class="hp"' not in src['lead']: print('ОШИБКА в источнике zayavka.html: нет ловушки .hp', file=sys.stderr); sys.exit(2)
    pages = sorted(p for p in glob.glob(os.path.join(glob.escape(ROOT), '*.html')) if os.path.basename(p) != 'index.html')
    if not pages: print('ОШИБКА: в %s нет страниц *.html' % ROOT, file=sys.stderr); sys.exit(2)
    pages.append(os.path.join(ROOT, 'kit', 'glavnaya.html'))
    errs, out = [], []
    for p in pages:
        rel = os.path.relpath(p, ROOT); d = os.path.dirname(rel); s = rd(p); spans = {}; n = len(errs); nl = '\r\n' if '\r\n' in s else '\n'
        for name, f, pat, need in BLOCKS:
            if not need and not re.search(pat, nocom(s)): continue
            try: spans[name] = span(s, pat)
            except LookupError as e: errs.append('%s:%s %s' % (rel, name, e))
        if len(errs) > n: continue
        h, m = (s[slice(*spans[k])] for k in ('header', 'mnav'))
        en, cur = hrefs(h, 'hreflang="en"'), hrefs(h, 'aria-current="page"')
        if len(en) != 1 or len(cur) > 1 or (hrefs(m, 'hreflang="en"'), hrefs(m, 'aria-current="page"')) != (en, cur) or h.count('aria-current') != len(cur) or m.count('aria-current') != len(cur):
            errs.append('%s:mnav ссылка EN или aria-current не распознаны или не совпадают с шапкой (шапка: EN %s, раздел %s; нужен aria-current="page" сразу после href)' % (rel, en, cur)); continue
        new, changed = s, []
        for name in sorted(spans, key=lambda k: spans[k][0], reverse=True):  # с конца страницы, чтобы границы не сдвигались
            a, b = spans[name]
            try: frag = fit(src[name], d, en[0], cur[0] if cur else None, name, WA_PRO if PRO.match(os.path.basename(p)) else WA_CLIENT).replace('\n', nl)
            except LookupError as e: errs.append('%s:%s %s' % (rel, name, e)); continue
            if frag != s[a:b]: changed.insert(0, name); new = new[:a] + frag + new[b:]
        if changed: out.append((p, rel, new, changed))
    if errs: print('ОШИБКА, ничего не записано:', *errs, sep='\n  ', file=sys.stderr); sys.exit(2)
    if check:
        for p, rel, new, changed in out: print('\n'.join('%s:%s' % (rel, c) for c in changed))
        sys.exit(1 if out else 0)
    tmps = []  # (страница, временный файл); страница-ссылка пишется по месту настоящего файла
    try:
        for p, rel, new, changed in out:  # сначала все временные файлы: сбой здесь не меняет ни одной страницы
            q = os.path.realpath(p); tmps.append((q, os.path.join(os.path.dirname(q), '.' + os.path.basename(q) + '.tmp')))
            with open(tmps[-1][1], 'w', encoding='utf-8', newline='') as fh: fh.write(new)
            shutil.copymode(q, tmps[-1][1])
        for (q, t), (p, rel, new, changed) in zip(tmps, out):  # затем подмена, каждая страница целиком; в выводе только подменённые
            os.replace(t, q); print('\n'.join('%s:%s' % (rel, c) for c in changed))
    finally:
        for q, t in tmps:
            if os.path.exists(t): os.remove(t)
    print('изменено страниц: %d из %d' % (len(out), len(pages)))
try: main()
except Exception: print('ОШИБКА, сборка прервана:', file=sys.stderr); traceback.print_exc(); sys.exit(2)
