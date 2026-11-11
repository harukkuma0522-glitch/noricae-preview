// ノリカエ.com（第12版）の動き
// 1) 共通  2) 最初の画面の写真（自動で1枚ずつ切りかわる）  3) 車のタイヤ  4) 郵便番号  5) 申込み（1問ずつ）  6) 相場
// 7) 査定で見るところ・還付の計算（個別ページ）  8) メニュー・検索向けの情報・下の帯  9) 見えたときの小さな動き
// トップ以外のページは、申込みの欄をトップの index.html から読み込む（欄の中身は1か所だけで直せる）
// 動きは html.motion があるときだけ（「動きを減らす」設定・データ節約の設定では付かない）。文字を隠して待つ動きは使わない。
(() => {
  'use strict';
  /* 公式LINEのURLが決まったら入れる。空のあいだはLINEの入口を隠す */
  const LINE_URL = '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const half = s => String(s || '').normalize('NFKC');
  const zip7 = s => { const z = half(s).replace(/\D/g, ''); return z.length === 7 ? `${z.slice(0, 3)}-${z.slice(3)}` : z; };
  const track = (event, extra) => { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, extra || {})); };
  const store = { get: k => { try { return sessionStorage.getItem(k); } catch (x) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (x) { /* 保存できなくても動く */ } } };

  /* ---- 1) 共通 ---- */
  if (LINE_URL) {
    root.classList.remove('no-line');
    $$('a[href="#line"]').forEach(a => { a.href = LINE_URL; a.target = '_blank'; a.rel = 'noopener'; });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const place = a.dataset.place || a.className || 'link';   // data-place（header・hero・band-1 など）で、どのボタンが効いたか分かる
    if (href.startsWith('tel:')) track('tel_click', { place });
    else if (LINE_URL && a.href === LINE_URL) track('line_click', { place });
  });
  /* 質問へのリンク：その質問と、包んでいる「ほかの質問」を開く */
  const openDetails = d => { for (let e = d; e; e = e.parentElement && e.parentElement.closest('details')) e.open = true; };
  const openTarget = () => {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t && t.tagName === 'DETAILS') openDetails(t);
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);
  $$('a[href^="#faq-"]').forEach(a => a.addEventListener('click', () => { const d = document.getElementById(a.hash.slice(1)); if (d) openDetails(d); }));

  /* どこから来たか（広告・チラシの utm と、最初に開いたページ）を、申込みに添える */
  if (!store.get('nrc-from')) {
    const q = new URLSearchParams(location.search), utm = ['utm_source', 'utm_medium', 'utm_campaign'].map(k => q.get(k)).filter(Boolean).join('/');
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (x) { ref = ''; }
    store.set('nrc-from', [utm || '-', location.pathname.split('/').pop() || 'index.html', ref || '直接'].join('｜'));
  }

  /* 受付時間（毎日 8:00〜23:00、日本の時刻）の外なら、電話のそばに一言出す */
  try {
    const h = +new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Tokyo' }).format(new Date());
    if (h < 8 || h >= 23) {
      $$('.night').forEach(n => { n.hidden = false; });
      $$('.dock-hours').forEach(n => { n.textContent = '8時から受付'; });
    }
  } catch (x) { /* 時刻が分からないときは出さない */ }

  /* ---- 2) 最初の画面の写真：1枚ずつ自動で切りかわる ----
     写真は assets/hero/ に、名前-640/960/1440 の .avif と .webp を置く（data-img が名前）。
     1枚目だけ HTML に書いてあり、2枚目からは切りかわる少し前に読む。データ節約の設定では1枚目だけ。 */
  const show = $('#show');
  if (show) (() => {
    const slides = $$('.slide', show);
    const saveData = root.classList.contains('save');
    if (slides.length < 2 || saveData) { slides.slice(1).forEach(s => s.remove()); return; }
    const SIZES = '(min-width: 900px) 54vw, calc(100vw - 32px)';
    const WAIT = 3800, LOOPS = 3;
    const set = (base, ext) => [640, 960, 1440].map(w => `${base}-${w}.${ext} ${w}w`).join(', ');
    const fill = s => {
      if (s.querySelector('img')) return Promise.resolve();
      const base = s.dataset.img, pic = document.createElement('picture'), src = document.createElement('source'), img = new Image();
      src.type = 'image/avif'; src.srcset = set(base, 'avif'); src.sizes = SIZES;
      img.srcset = set(base, 'webp'); img.sizes = SIZES; img.src = `${base}-960.webp`;
      img.width = 1440; img.height = 1080; img.alt = s.dataset.alt || ''; img.decoding = 'async';
      pic.append(src, img);
      s.prepend(pic);
      return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
    };

    const ui = document.createElement('div');
    ui.className = 'show-ui';
    const dots = document.createElement('div');
    dots.className = 'show-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', '写真をえらぶ');
    slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `${i + 1}枚目：${s.querySelector('figcaption').textContent}`);
      b.addEventListener('click', () => { stopAuto(true); go(i); });
      dots.append(b);
    });
    let pauseBtn = null;
    if (motion) {   // 「止める」はキーボードで点より先に届くように、前に置く（見た目は点の右）
      pauseBtn = document.createElement('button');
      pauseBtn.type = 'button';
      pauseBtn.className = 'show-pause';
      pauseBtn.addEventListener('click', () => { if (userPaused || finished) { userPaused = false; finished = false; loops = 0; } else userPaused = true; tick(); });
      ui.append(pauseBtn);
    }
    ui.append(dots);
    $('.show-view', show).append(ui);

    let at = 0, timer = 0, loops = 0, userPaused = !motion, finished = false, inside = false, seen = true;
    const btns = $$('button', dots);
    function go(i) {
      const next = (i + slides.length) % slides.length;
      if (next === at) return;
      fill(slides[next]).then(() => {
        slides.forEach((s, k) => {
          s.classList.toggle('is-on', k === next);
          s.classList.toggle('is-off', k === at && k !== next);
          if (k !== next && k !== at) s.classList.remove('is-off');
          s.setAttribute('aria-hidden', String(k !== next));
        });
        if (next === 0 && at === slides.length - 1) loops++;
        at = next;
        btns.forEach((b, k) => b.setAttribute('aria-current', String(k === at)));
        if (loops >= LOOPS && at === 0) finished = true;
        tick();
      });
    }
    function stopAuto(byUser) { if (byUser && motion) userPaused = true; tick(); }
    function tick() {
      clearTimeout(timer);
      const paused = userPaused || finished || inside || !seen || document.hidden;
      show.classList.toggle('paused', paused);
      if (pauseBtn) {
        const stopped = userPaused || finished;
        pauseBtn.textContent = stopped ? '動かす' : '止める';
        pauseBtn.setAttribute('aria-label', stopped ? '写真の切りかえを動かす' : '写真の切りかえを止める');
      }
      if (paused) return;
      const next = (at + 1) % slides.length;
      timer = setTimeout(() => go(next), WAIT);
      setTimeout(() => fill(slides[next]), Math.max(0, WAIT - 2200));   // 切りかわる少し前に次の写真を読む
    }
    slides.forEach((s, k) => s.setAttribute('aria-hidden', String(k !== 0)));
    btns.forEach((b, k) => b.setAttribute('aria-current', String(k === 0)));
    // マウスを乗せても止めない（止まると「切りかわりが遅い」と感じるため。止めたい人は「止める」ボタン）
    // キーボードで中に入ったときだけ止める（マウスで「動かす」を押したあと、止まったままにならないように）
    show.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) { inside = true; tick(); } });
    show.addEventListener('focusout', e => { if (!show.contains(e.relatedTarget)) { inside = false; tick(); } });
    document.addEventListener('visibilitychange', tick);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; tick(); }, { threshold: 0.25 }).observe(show);
    // 2枚目は、ページを読み終えてから（自動で動かないときは、点で選ばれたときに読む）
    const start = () => { if (motion) fill(slides[1]); tick(); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
  })();

  /* ---- 3) 車のタイヤ（3Dデータから求めた位置に、同じ画像を丸く切って重ねて回す） ---- */
  const WHEELS = {
    car: { src: 'assets/img/car-side.webp', w: 1400, h: 566, r: 6.92, at: [[77.18, 78.28], [22.21, 78.28]] },
    sedan: { src: 'assets/img/sedan-side.webp', w: 1400, h: 443, r: 5.74, at: [[74.92, 76.96], [23.23, 76.96]] },
    kei: { src: 'assets/img/kei-side.webp', w: 1400, h: 746, r: 6.99, at: [[74.42, 81.84], [25.19, 81.84]] },
    truck: { src: 'assets/img/truck-side.webp', w: 1400, h: 748, r: 5.58, at: [[84.25, 84.86], [28.36, 84.89]] }
  };
  // 車の絵（loading=lazy）が読みこまれてからタイヤを付ける。先に付けると、見えていない絵まで読んでしまう
  $$('.wcar[data-wheels]').forEach(box => {
    const d = WHEELS[box.dataset.wheels], ih = d.h / d.w * 100, im = $('img', box);
    const add = () => d.at.forEach(([cx, cy]) => {
      const i = document.createElement('i');
      i.className = 'wh';
      const cyW = cy / 100 * ih;
      i.style.cssText = `left:${cx}%;top:${cy}%;width:${d.r * 2}%;background-image:url(${d.src});background-size:${100 / (d.r * 2) * 100}% auto;background-position:${(cx - d.r) / (100 - 2 * d.r) * 100}% ${(cyW - d.r) / (ih - 2 * d.r) * 100}%`;
      box.appendChild(i);
    });
    if (!im || (im.complete && im.naturalWidth)) add(); else im.addEventListener('load', add, { once: true });
  });

  /* ---- 4) 郵便番号：上3桁が 210〜259 なら神奈川県 ---- */
  const zipCheck = input => {
    const out = document.getElementById(input.dataset.zipOut);
    const d = half(input.value).replace(/\D/g, '');
    out.className = 'zip-out';
    if (d.length < 3) { out.textContent = ''; return; }
    const p = +d.slice(0, 3);
    if (p >= 210 && p <= 259) { out.textContent = '神奈川県内です。ご自宅まで伺えます。'; out.classList.add('ok'); }
    else { out.textContent = '神奈川県の外のようです。伺えるかどうか、お電話でご相談ください。'; out.classList.add('warn'); }
  };
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches('input[data-zip-out]')) zipCheck(e.target); });

  /* ---- 5) 申込み：1問ずつ。答えるたびにナンバーの数字がそろい、ネジが締まる ---- */
  const slot = $('#wz-slot'), dlg = $('#dlg'), dlgBody = $('#dlg-body');
  const pageKind = document.body.dataset.kind || '';
  let openWizard = null;
  function setupWizard(wz) {
    const steps = $$('.wz-step', wz);
    const plate = $('#wz-plate', wz), top = $('#wz-top', wz), count = $('#wz-count', wz);
    const digits = $$('.wz-num b', wz), bolts = $$('.bolt', plate);
    const back = $('.wz-back', wz), next = $('.wz-next', wz), err = $('.wz-error', wz);
    let at = 0;

    const answered = s => !!$('input[type=radio]:checked', s);
    function show(i, focus) {
      at = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach((s, k) => { s.hidden = k !== at; });
      digits.forEach((d, k) => d.classList.toggle('on', k < at));
      bolts.forEach((b, k) => b.classList.toggle('on', k < at));
      const last = at === steps.length - 1;
      count.textContent = last ? 'さいごです。' : `${at + 1} / ${steps.length}　分かるところだけで大丈夫です`;
      back.hidden = at === 0;
      next.hidden = last;
      next.textContent = answered(steps[at]) ? '次へ' : '分からないので次へ';
      if (focus) {
        const l = $('legend', steps[at]); l.tabIndex = -1; l.focus({ preventScroll: true });
        // 次の問いの頭が見えるように（ダイアログの中は上へ、ページの中は問いが画面の上に隠れたときだけ）
        if (wz.closest('dialog')) wz.closest('dialog').scrollTop = 0;
        else if (wz.getBoundingClientRect().top < 0) wz.scrollIntoView({ block: 'start' });
        track('form_step', { step: steps[at].dataset.key });
      }
    }
    back.addEventListener('click', () => show(at - 1, true));
    next.addEventListener('click', () => show(at + 1, true));

    function tone(t) {
      plate.classList.remove('pl-white', 'pl-yellow', 'pl-green', 'pl-black', 'pl-gray', 'flip');
      plate.classList.add(`pl-${t}`);
      void plate.offsetWidth;
      if (motion) plate.classList.add('flip');
    }
    function reflect(input) {
      if (input.name === 'kind') tone(input.closest('label').dataset.tone);
      if (input.name === 'maker') top.textContent = input.value === 'わからない' || input.value === 'そのほか' ? 'ノリカエ' : input.value;
      next.textContent = '次へ';
    }
    wz.addEventListener('change', e => { if (e.target.type === 'radio') reflect(e.target); });
    // マウスと指で選んだときだけ、次の質問へ進む（キーボードは「次へ」で進む）
    wz.addEventListener('click', e => {
      if (!e.target.matches('.ch input[type=radio]') || e.detail === 0) return;
      setTimeout(() => show(at + 1, true), 260);
    });
    show(0, false);

    function setRadio(name, value) {
      const r = value && wz.querySelector(`input[name="${name}"][value="${value}"]`);
      if (r) { r.checked = true; reflect(r); }
    }
    function open(pre, place) {
      if (pre && pre.souba) {   // 相場から開くときは、前の答えを消してから入れる（前の車の答えが残らないように）
        $$('.wz-step:not(.wz-contact) input[type=radio]', wz).forEach(r => { r.checked = false; });
        top.textContent = 'ノリカエ';
        tone('white');
      }
      if (pre) {
        Object.keys(pre).forEach(k => {
          if (['model', 'souba'].includes(k)) wz.elements[k].value = pre[k]; else setRadio(k, pre[k]);
        });
        const first = steps.findIndex(s => s.dataset.key !== 'contact' && !answered(s));
        show(first < 0 ? steps.length - 1 : first, false);
      }
      track('form_link_click', { place: place || 'link' });
      if (typeof dlg.showModal !== 'function') { const a = $('#apply'); if (a) a.scrollIntoView(); return; }
      if (slot) slot.style.minHeight = `${slot.offsetHeight}px`;
      dlgBody.append(wz);
      if ($('.wz-done')) dlgBody.append($('.wz-done'));
      dlg.showModal();
      dlg.scrollTop = 0;
      const l = wz.hidden ? $('.wz-done h3', dlgBody) : $('legend', steps[at]);   // 開いたら、今の問いを読み上げる
      if (l) { l.tabIndex = -1; l.focus({ preventScroll: true }); }
    }
    dlg.addEventListener('close', () => {
      if (!slot) return;
      slot.append(wz);
      const d = $('.wz-done', dlgBody);
      if (d) slot.append(d);
      slot.style.minHeight = '';
    });

    function check() {
      const msgs = [];
      const name = wz.elements.name, tel = wz.elements.tel;
      const t = half(tel.value).replace(/\D/g, '');
      const badName = !name.value.trim(), badTel = !/^0\d{9,10}$/.test(t);
      if (badName) msgs.push('お名前を入れてください（名字だけでも大丈夫です）。');
      if (!t) msgs.push('お電話番号を入れてください。伺う日時を決めるために使います。');
      else if (badTel) msgs.push('お電話番号は、0から始まる10けたか11けたの数字で入れてください（例：090-1234-5678）。');
      if (!err.id) err.id = 'wz-err';
      [[name, badName], [tel, badTel]].forEach(([el, bad]) => {
        if (bad) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', err.id); }
        else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
      });
      return { msgs, t };
    }
    wz.addEventListener('submit', async e => {
      e.preventDefault();
      const { msgs, t } = check();
      if (msgs.length) {
        err.innerHTML = `<b>送る前に、次を確かめてください。</b><ul>${msgs.map(m => `<li>${m}</li>`).join('')}</ul>`;
        err.hidden = false;
        track('form_error', { count: msgs.length });
        const bad = $('[aria-invalid=true]', wz);
        if (bad) bad.focus();
        return;
      }
      err.hidden = true;
      wz.elements.tel.value = t;
      wz.elements.zip.value = zip7(wz.elements.zip.value);
      if (wz.elements.from) wz.elements.from.value = store.get('nrc-from') || '';
      if (wz.dataset.demo !== '1') {
        try {
          const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(wz)).toString() });
          if (!res.ok) throw new Error(String(res.status));
        } catch (x) {
          err.innerHTML = '<b>うまく送れませんでした。</b>お手数ですが、もう一度お試しいただくか、お電話ください。';
          err.hidden = false;
          track('form_error', { send: 'failed' });
          return;
        }
      }
      // 送れたあとで数える（送れなかった人は数えない）
      track('form_submit', { kind: (wz.querySelector('[name="kind"]:checked') || {}).value || '', from_souba: !!wz.elements.souba.value });
      digits.forEach(d => d.classList.add('on'));
      const done = document.createElement('div');
      done.className = 'wz-done';
      done.setAttribute('role', 'status');
      const sms = wz.elements.sms && wz.elements.sms.checked;
      done.innerHTML = sms
        ? `<h3>お申込みを受け付けました。</h3>
        <p>このあと、株式会社おてつだい.comから、ショートメールでご連絡します。伺う日時は、そのやり取りで決めます。</p>
        <p>受付時間（毎日 8:00〜23:00）内なら、なるべく早くご連絡します。時間外のお申込みは、翌朝8時以降のご連絡です。</p>`
        : `<h3>お申込みを受け付けました。</h3>
        <p>このあと、株式会社おてつだい.comからお電話します。知らない番号に出ない設定の方は、着信にご注意ください。</p>
        <p>受付時間（毎日 8:00〜23:00）内なら、なるべく早くお電話します。時間外のお申込みは、翌朝8時以降のご連絡です。</p>`;
      done.innerHTML += `<div><b>ご連絡までに、ご用意いただくと早いもの</b><ul><li>車検証（ダッシュボードの中に入っていることが多いです）</li><li>走行距離（メーターの数字）</li><li>傷やへこみ、直したところ</li></ul></div>
        ${wz.dataset.demo === '1' ? '<p class="note">この確認用のページからは、実際には送られません。</p>' : ''}`;
      wz.hidden = true;
      wz.after(done);
      const h = $('h3', done); h.tabIndex = -1; h.focus();
    });
    wz.addEventListener('input', () => { if (!err.hidden) { const { msgs } = check(); if (!msgs.length) err.hidden = true; } });
    return open;
  }
  if (dlg) {
    $('.dlg-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-apply]');
    if (!a || !openWizard) return;   // 読み込めていないときは、ふつうのリンクとしてトップの申込みへ
    e.preventDefault();
    openWizard(pageKind ? { kind: pageKind } : null, a.dataset.place || a.className);
  });
  if ($('#wizard')) openWizard = setupWizard($('#wizard'));
  else if (dlg) fetch('index.html').then(r => r.text()).then(t => {
    const f = new DOMParser().parseFromString(t, 'text/html').querySelector('#wizard');
    if (!f) return;
    const n = document.importNode(f, true);
    dlgBody.append(n);
    openWizard = setupWizard(n);
  }).catch(() => {});

  const odoHTML = '<span class="dcol"><span>' + [...'0123456789'].map(d => `<i>${d}</i>`).join('') + '</span></span>';
  function setOdo(box, n) {
    const chars = [...String(n)], pat = chars.map(c => (/\d/.test(c) ? 'd' : c)).join('');
    if (box.dataset.pat !== pat) {
      box.innerHTML = chars.map(c => (/\d/.test(c) ? odoHTML : `<span class="odo-c">${c}</span>`)).join('');
      box.dataset.pat = pat;
      void box.offsetWidth;
    }
    [...box.children].forEach((c, k) => { if (/\d/.test(chars[k])) c.firstChild.style.transform = `translateY(-${+chars[k]}em)`; });
  }

  /* ---- 6) 相場（見本の数字）。車の表は assets/data の CSV ---- */
  const NOW = new Date().getFullYear(), OLDEST = NOW - 25;
  const KM_CAR = [['3万km未満', 1.5, '3万km未満'], ['3万〜5万km', 4, '3万〜5万km'], ['5万〜7万km', 6, '5万〜7万km'], ['7万〜10万km', 8.5, '7万〜10万km'], ['10万〜15万km', 12.5, '10万〜15万km'], ['15万〜20万km', 17.5, '15万km以上'], ['20万km以上', 24, '15万km以上']];
  const KM_TRUCK = [['10万km未満', 6, ''], ['10万〜20万km', 15, ''], ['20万〜30万km', 25, '15万km以上'], ['30万〜50万km', 40, '15万km以上'], ['50万km以上', 60, '15万km以上']];
  const num = s => parseFloat(half(s).replace(/[^\d.\-]/g, ''));
  const parseCSV = text => text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => l.split(',').map(c => c.trim()));
  const wareki = y => (y >= 2020 ? `令和${y - 2018}年` : y === 2019 ? '令和元年' : y >= 1990 ? `平成${y - 1988}年` : `平成元年`);
  const el = { maker: $('#e-maker'), model: $('#e-model'), year: $('#e-year'), km: $('#e-km'), lo: $('#odo-lo'), hi: $('#odo-hi'), car: $('#est-car'), live: $('#est-live'), go: $('#est-go') };
  let RULES = {}, MODELS = [];

  const genFor = (m, y) => {
    const hit = m.gens.filter(g => g.from <= y && y <= g.to);
    if (hit.length) return hit[hit.length - 1];
    return m.gens.reduce((b, g) => (Math.min(Math.abs(y - g.from), Math.abs(y - g.to)) < Math.min(Math.abs(y - b.from), Math.abs(y - b.to)) ? g : b));
  };
  function estimate(m, y, km) {
    const g = genFor(m, y), r = RULES[g.type], age = Math.max(0, NOW - y), cv = r.curve, last = cv.length - 1;
    const rate = age <= last ? cv[age] : cv[last] * Math.pow(0.88, age - last);
    const std = Math.max(0.5, age * r.perYear), s = r.sens / 100, d = km - std;
    let f = d > 0 ? 1 - Math.min(0.35, 0.025 * d * s) : 1 + Math.min(0.12, 0.015 * -d * s);
    const many = 10 * Math.max(1, r.perYear);
    if (km >= many) f *= 1 - 0.06 * s;
    if (km >= many * 1.5) f *= 1 - 0.08 * s;
    const mid = g.price * rate / 100 * f * g.pop / 100, unit = mid >= 300 ? 5 : 1;
    let lo = Math.floor(mid * 0.86 / unit) * unit, hi = Math.ceil(mid * 1.12 / unit) * unit;
    lo = Math.max(lo, r.floor); hi = Math.max(hi, lo + (lo < 10 ? 2 : unit));
    return { lo, hi, g };
  }
  const opts = (sel, list, val) => { sel.innerHTML = list.map(o => `<option value="${o[0]}">${o[1]}</option>`).join(''); if (val != null && list.some(o => String(o[0]) === String(val))) sel.value = val; };
  const current = () => MODELS.find(m => m.key === el.model.value);
  const bands = m => (genFor(m, +el.year.value || m.to).type === 'トラック' ? KM_TRUCK : KM_CAR);
  function fillModels(val) { const list = MODELS.filter(m => m.maker === el.maker.value); opts(el.model, list.map(m => [m.key, m.name]), val); }
  function fillYears(val) { const m = current(); const ys = []; for (let y = m.to; y >= Math.max(m.from, OLDEST); y--) ys.push([y, `${y}年（${wareki(y)}）`]); opts(el.year, ys, val); }
  function fillKm(val) { const b = bands(current()); opts(el.km, b.map(x => [x[0], x[0]]), val); }
  function update() {
    const m = current(), y = +el.year.value, b = bands(m).find(x => x[0] === el.km.value) || bands(m)[0];
    const e = estimate(m, y, b[1]);
    setOdo(el.lo, e.lo); setOdo(el.hi, e.hi);
    el.car.textContent = `${m.maker} ${m.name}／${y}年／${b[0]}`;
    el.live.textContent = `買取の目安は、${e.lo}万円から${e.hi}万円です（見本の数字）。`;
    const age = NOW - y;
    el.go.dataset.pre = JSON.stringify({
      kind: /トラック|商用/.test(e.g.type) ? 'トラック・会社の車' : /^軽/.test(e.g.type) ? '軽自動車・軽トラ' : '乗用車・ミニバン',
      maker: ['トヨタ', 'レクサス', '日産', 'ホンダ', 'マツダ', 'スバル', '三菱', 'スズキ', 'ダイハツ', 'いすゞ', '日野', '三菱ふそう', 'UDトラックス'].includes(m.maker) ? m.maker : '輸入車',
      age: age <= 3 ? '3年以内' : age <= 5 ? '4〜5年' : age <= 7 ? '6〜7年' : age <= 10 ? '8〜10年' : age <= 13 ? '11〜13年' : '14年以上',
      km: b[2], model: m.name, souba: `${m.maker} ${m.name}／${y}年／${b[0]}：${e.lo}〜${e.hi}万円`
    });
  }
  if ($('#est')) (async () => {
    try {
      const [cars, rules] = await Promise.all(['assets/data/souba-cars.csv', 'assets/data/souba-rules.csv'].map(u => fetch(u).then(r => r.text())));
      const rr = parseCSV(rules), rh = rr[0], rc = n => rh.findIndex(h => h.startsWith(n));
      rr.slice(1).forEach(r => { RULES[r[rc('タイプ')]] = { perYear: num(r[rc('年間')]) || 1, sens: num(r[rc('距離の影響')]), floor: num(r[rc('最低額')]) || 0, curve: r.slice(rc('今年')).map(num).filter(n => !isNaN(n)) }; });
      const cr = parseCSV(cars), ch = cr[0], cc = n => ch.findIndex(h => h.startsWith(n));
      const byKey = new Map();
      cr.slice(1).forEach(r => {
        const maker = r[cc('メーカー')], name = r[cc('車種')], type = r[cc('タイプ')], price = num(r[cc('新車価格')]), from = num(r[cc('発売年')]);
        if (!maker || !name || !price || !from || !RULES[type]) return;
        const key = `${maker}|${name}`;
        if (!byKey.has(key)) byKey.set(key, { key, maker, name, gens: [] });
        const to = num(r[cc('終了年')]), pop = num(r[cc('人気')]);
        byKey.get(key).gens.push({ type, from, to: isNaN(to) ? NOW : Math.min(to, NOW), price, pop: isNaN(pop) ? 100 : pop });
      });
      MODELS = [...byKey.values()];
      MODELS.forEach(m => { m.gens.sort((a, b) => a.from - b.from); m.from = Math.max(OLDEST, m.gens[0].from); m.to = Math.max(...m.gens.map(g => g.to)); });
      const makers = [...new Set(MODELS.map(m => m.maker))];
      opts(el.maker, makers.map(m => [m, m]), 'トヨタ');
      fillModels('トヨタ|プリウス'); fillYears(2016); fillKm('5万〜7万km'); update();
      let used = false;
      const changed = () => { if (!used) { used = true; track('souba_use', {}); } };
      el.maker.addEventListener('change', () => { fillModels(); fillYears(); fillKm(); update(); changed(); });
      el.model.addEventListener('change', () => { fillYears(); fillKm(); update(); changed(); });
      el.year.addEventListener('change', () => { fillKm(el.km.value); update(); changed(); });
      el.km.addEventListener('change', () => { update(); changed(); });
    } catch (x) {
      $('.est-out').innerHTML = '<p>相場の表を読み込めませんでした。お手数ですが、査定をお申し込みください。</p><a class="btn btn-go" href="#apply" data-apply>無料で査定を申し込む</a>';
    }
  })();
  if (el.go) el.go.addEventListener('click', e => {
    e.preventDefault();
    track('souba_to_form', {});
    if (openWizard) openWizard(JSON.parse(el.go.dataset.pre || '{}'), 'est-go');
  });

  /* ---- 7) 査定で見るところ（番号を押すと、説明が入れかわる） ---- */
  const insp = $('.insp');
  if (insp) {
    const data = JSON.parse($('#insp-data').textContent);
    const panel = $('.insp-panel', insp), btns = $$('[data-i]', insp);
    let cur = 0;
    const showSpot = i => {
      cur = (i + data.length) % data.length;
      const d = data[cur];
      btns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === cur)));
      $('.insp-no', panel).textContent = `見るところ ${cur + 1} / ${data.length}`;
      $('h3', panel).textContent = d.t;
      ['look', 'price', 'tip'].forEach(k => { $(`[data-k="${k}"]`, panel).textContent = d[k]; });
      if (motion) { panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap'); }
    };
    btns.forEach(b => b.addEventListener('click', () => showSpot(+b.dataset.i)));
    $('.insp-prev', insp).addEventListener('click', () => showSpot(cur - 1));
    $('.insp-next', insp).addEventListener('click', () => showSpot(cur + 1));
  }

  /* 自動車税（種別割）の還付の目安。普通自動車だけ。抹消登録した翌月から3月までの月割り、100円未満は切り捨て */
  const calc = $('.calc');
  if (calc) {
    const RATES = {
      new: [25000, 30500, 36000, 43500, 50000, 57000, 65500, 75500, 87000, 110000],
      old: [29500, 34500, 39500, 45000, 51000, 58000, 66500, 76500, 88000, 111000],
      heavy: [33900, 39600, 45400, 51700, 58600, 66700, 76400, 87900, 101200, 127600]
    };
    const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
    const f = $('.calc-form', calc), yen = $('#co-n', calc), live = $('#co-live', calc), detail = $('.co-detail', calc), bar = $('.months', calc);
    const fmt = n => n.toLocaleString('ja-JP');
    const upd = () => {
      const cc = +f.elements.cc.value, era = f.elements.era.value || 'old', m = +f.elements.month.value;
      const annual = RATES[era][cc], left = 11 - m, v = Math.floor(annual * left / 12 / 100) * 100;
      setOdo(yen, fmt(v));
      live.textContent = `戻る自動車税の目安は、${fmt(v)}円です。`;
      detail.textContent = left > 0
        ? `${MONTHS[m]}に抹消登録すると、${MONTHS[m + 1]}〜3月の${left}か月分が戻る目安です（年額 ${fmt(annual)}円）。`
        : '3月に抹消登録すると、戻る月はありません。4月1日の時点の持ち主に、1年分の税がかかります。';
      $$('i', bar).forEach((c, i) => { c.className = i < m ? '' : i === m ? 'now' : 'left'; });
    };
    f.elements.month.value = String((new Date().getMonth() + 9) % 12);
    f.addEventListener('input', upd);
    f.addEventListener('change', upd);
    f.addEventListener('submit', e => e.preventDefault());
    upd();
  }

  /* ---- 8) メニュー：リンクを押す・外を押す・Esc で閉じる ---- */
  const menu = $('.bar-menu');
  if (menu) {
    document.addEventListener('click', e => { if (menu.open && (!menu.contains(e.target) || e.target.closest('.bar-panel a'))) menu.open = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open) { menu.open = false; $('summary', menu).focus(); } });
  }

  /* 検索エンジン向けの情報：本文の質問と答え、会社とお店から作る */
  const addLd = o => { const t = document.createElement('script'); t.type = 'application/ld+json'; t.textContent = JSON.stringify(Object.assign({ '@context': 'https://schema.org' }, o)); document.head.appendChild(t); };
  if ($('.faq-list details')) addLd({ '@type': 'FAQPage', mainEntity: $$('.faq-list details:not(.faq-more)').map(d => ({ '@type': 'Question', name: $('summary', d).textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: $('p', d).textContent.trim() } })) });
  const crumbs = $('.crumbs');
  if (crumbs) addLd({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'トップ', item: new URL('index.html', location.href).href }, { '@type': 'ListItem', position: 2, name: crumbs.lastChild.textContent.replace(/^[\s＞]+/, '').trim(), item: location.href.split('#')[0] }] });
  if ($('.hero')) {
    const hours = { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '08:00', closes: '23:00' };
    addLd({
      '@type': 'AutomotiveBusiness', name: 'ノリカエ.com', url: location.href.split('#')[0], telephone: '+81-120-979-574',
      description: '神奈川県の出張車買取。中古車・廃車・動かない車・軽トラから4トンまで。ご自宅まで無料で伺います。',
      address: { '@type': 'PostalAddress', addressCountry: 'JP', addressRegion: '神奈川県', addressLocality: '厚木市', streetAddress: '下依知2-15-12', postalCode: '243-0806' },
      openingHoursSpecification: hours,
      areaServed: { '@type': 'AdministrativeArea', name: '神奈川県' },
      department: [{ '@type': 'AutomotiveBusiness', name: 'ノリカエ.com 相模原店', telephone: '+81-120-979-574', address: { '@type': 'PostalAddress', addressCountry: 'JP', addressRegion: '神奈川県', addressLocality: '相模原市中央区', streetAddress: '田名1870-1', postalCode: '252-0244' } }],
      parentOrganization: { '@type': 'Organization', name: '株式会社おてつだい.com', url: 'https://risaikuru-otetudai.com/' }
    });
  }

  /* スマホの下の帯：最初の画面と申込みの章が見えている間は出さない */
  const dock = $('.dock');
  if (dock) {
    const first = $('.hero') || $('.phero');
    let applySeen = false;
    const dockUpd = () => {
      const past = first ? first.getBoundingClientRect().bottom < window.innerHeight * 0.35 : window.scrollY > window.innerHeight * 0.6;
      dock.classList.toggle('on', past && !applySeen);
    };
    const ap = $('#apply');
    if (ap && 'IntersectionObserver' in window) new IntersectionObserver(es => { applySeen = es[0].isIntersecting; dockUpd(); }, { threshold: 0.1 }).observe(ap);
    window.addEventListener('scroll', dockUpd, { passive: true });
    dockUpd();
  }

  /* ---- 9) 見えたときの小さな動き（字は隠さない。飾りだけ動かす） ---- */
  if (!motion || !('IntersectionObserver' in window)) return;
  // 画面の外にあるものだけ、動く前の形にしておく（もう見えているものは、そのまま）
  const onSight = (els, prep, play, opt) => {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const t = e.target;
      if (!t.dataset.sight) { t.dataset.sight = e.isIntersecting ? 'done' : 'wait'; if (!e.isIntersecting) prep(t); return; }
      if (e.isIntersecting && t.dataset.sight === 'wait') { t.dataset.sight = 'done'; play(t); io.unobserve(t); }
    }), opt || { rootMargin: '0px 0px -12% 0px' });
    els.forEach(x => io.observe(x));
  };

  /* 約束の数字：ロールして止まる */
  onSight($$('.dg-num'), box => {
    const n = +box.dataset.final;
    box.innerHTML = `<span class="roll" style="transition:none;transform:translateY(-80%)">${[n, (n + 7) % 10, (n + 3) % 10, (n + 8) % 10, (n + 5) % 10].map(x => `<b>${x}</b>`).join('')}</span>`;
  }, box => {
    const r = $('.roll', box);
    if (!r) return;
    const k = $$('.dg-num').indexOf(box) % 2;
    void r.offsetWidth;
    r.style.transition = '';
    r.style.transitionDelay = `${k * 0.12}s`;
    r.style.transform = 'translateY(0)';
  });

  /* 買い取る車：走って入ってきて止まる。タイヤが回る */
  onSight($$('.bay .wcar'), c => { c.classList.add('ready', 'spin'); }, c => {
    void c.offsetWidth;
    c.classList.add('go');
    c.classList.remove('ready');
    setTimeout(() => c.classList.remove('spin', 'go'), 1250);
  });

  /* 一括査定の電話は、見えたときに少しだけ鳴る */
  const diff = $('.diff');
  if (diff) new IntersectionObserver(es => { if (es[0].isIntersecting) diff.classList.add('on'); }, { threshold: 0.3 }).observe(diff);

  /* 個別ページ：車が走って入ってくる（page.css が形を決める） */
  $$('.phero .wcar').forEach(c => { c.classList.add('spin'); setTimeout(() => c.classList.remove('spin'), 1200); });
})();
