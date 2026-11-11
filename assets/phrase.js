// 日本語の文を、語の途中ではなく文節（意味のまとまり）の切れ目で折り返す
// CSS の word-break:auto-phrase は iPhone の Safari で効かないので、ブラウザ標準の Intl.Segmenter で切れ目を探して <wbr> を入れる
// HTML の文を直すだけでそのまま効く。あとから書きかわる文（申込みの欄・相場の結果など）も自動で処理する
// Intl.Segmenter がないブラウザでは何もしない（ふつうの折り返しのまま読める）
(() => {
  'use strict';
  if (!window.Intl || !Intl.Segmenter) return;
  const seg = new Intl.Segmenter('ja', { granularity: 'word' });
  const root = document.documentElement;

  const JA = /[぀-ヿ㐀-鿿]/;
  const KANJI = /^[㐀-鿿]+$/;
  const SKIP = 'script,style,noscript,template,textarea,select,option,title,svg,.crumbs,.tel-no,.roll';
  const len = s => [...s].length;
  const kind = s => /^\s+$/.test(s) ? 'sp'
    : /^[、。，．！？!?…・／：]+$/.test(s) ? 'end'     // ここで切ってよい記号
    : /^[）」』】〉》)］\]]+$/.test(s) ? 'cl'          // 閉じかっこ
    : /^[（「『【〈《(［[]+$/.test(s) ? 'op'           // 開きかっこ
    : /^[ぁ-ゞ]+$/.test(s) ? 'hi'              // ひらがなだけ
    : 'co';                                            // 漢字・カタカナ・英数字

  /* ひらがなで始まっても、行の頭に来てよい語 */
  const FREE = /^(ください|くださ|いただ|ござい|あり|その|この|あの|どの|こちら|そちら|どちら|いつ|すべて|まず|また|すぐ|ぜひ|もし|もちろん|でき|しれな|おすすめ|おまかせ|そのまま|だいたい|ほとんど)/;
  /* こと・とき など。「何社もの」のような言い方と分けるため、ひらがなの後ろでだけ行の頭に来てよい */
  const FORMAL = /^(こと|とき|もの|ところ|ため|ほう)/;
  /* 次の語と離さない語 */
  const HOLD = /^(その|この|あの|どの|もう|また|まだ)$/;
  /* 前の語につける、ひらがなの語（助詞・語尾） */
  const TAIL = /^(から|まで|より|など|ので|のに|です|ます|ませ|ない|なら|ても|でも|ては|たら|だけ|しか|ほど|くらい|する|して|した|しま|され|させ|いる|いま|いた|おり|よう|か[。、？]|か$|ね|よ[。、！])/;
  const PARTICLE = /^[はがをへもに]$/;
  /* 1字の名詞のあとに続く語 */
  const AFTER_NOUN = /^(は|が|を|に|で|と|も|へ|や|の|から|まで|など|です|より|だけ)/;
  /* 閉じかっこのすぐ後の助詞を、行の頭に出さない */
  const GLUE = /[）」』】〉》)］\]][\u3041-\u309E]/g;
  /* 途中で切らない語（名前など）。切れ方がおかしい語があれば、ここに足す */
  const NAMES = /おてつだい\.com|ノリカエ\.com|バルスリサイクル|へこみ/g;

  const cuts = text => {
    const s = [...seg.segment(text)].map(x => ({ t: x.segment, i: x.index, k: kind(x.segment) }));
    const out = new Set();
    /* 漢字・カタカナの続きの長さ（長すぎるときだけ途中で切れるように） */
    for (let a = 0; a < s.length;) {
      if (s[a].k !== 'co') { a++; continue; }
      let b = a, n = 0;
      while (b < s.length && s[b].k === 'co') n += len(s[b++].t);
      let left = 0;
      for (let c = a; c < b; c++) { s[c].left = left; s[c].right = n - left; left += len(s[c].t); }
      a = b;
    }
    s.forEach((c, a) => {
      const p = s[a - 1], n = s[a + 1], pp = s[a - 2];
      if (!p || c.k === 'sp' || p.k === 'sp' || c.k === 'end' || c.k === 'cl' || p.k === 'op') return;
      if (p.k === 'end' || c.k === 'op') { out.add(c.i); return; }
      if (c.k === 'hi') {
        const rest = text.slice(c.i);
        const lone = /^[はがをにでともへやのか]$/.test(c.t);   // 助詞1字は語の頭にしない
        const stem = pp && len(pp.t) === 1 && KANJI.test(pp.t);   // 下/が/らない のような語尾
        const prefix = /^[おご]$/.test(c.t) && n && n.k === 'co' && !HOLD.test(p.t) && p.t !== 'か';   // 「フォームかお電話で」は続ける
        const free = !lone && FREE.test(rest) && !HOLD.test(p.t);
        const formal = !lone && FORMAL.test(rest) && /[\u3041-\u309E]$/.test(p.t) && !HOLD.test(p.t);
        const suffix = len(c.t) === 1 && n && TAIL.test(n.t);   // ワックスが/け/まで のような語の続き
        const afterParticle = PARTICLE.test(p.t) && !stem && !lone && !suffix && !TAIL.test(rest) && !/^[っゃゅょぁぃぅぇぉんらりるれろ]/.test(c.t);
        if (prefix || free || formal || afterParticle) out.add(c.i);
        return;
      }
      /* c は漢字・カタカナ・英数字 */
      if (p.k === 'co') {
        if (/[\u3041-\u309E]$/.test(p.t) && /^[おご][\u3400-\u9FFF]/.test(c.t)) { out.add(c.i); return; }   // 先に｜お答えします
        const ascii = /[\x21-\x7E]$/.test(p.t) || /^[\x21-\x7E]/.test(c.t);
        const script = /[\u3400-\u9FFF]$/.test(p.t) !== /^[\u3400-\u9FFF]/.test(c.t);   // 漢字とカタカナの境目
        if (!ascii && len(c.t) >= 2 && ((c.left >= 4 && c.right >= 4) || (script && c.left >= 3 && c.right >= 3))) out.add(c.i);
        return;
      }
      if (p.k === 'cl') { out.add(c.i); return; }
      /* p はひらがな */
      if (/^[おご]$/.test(p.t) || HOLD.test(p.t)) return;
      if (p.t === 'か' && pp && /\d$/.test(pp.t)) return;                                   // 3か月
      if (pp && len(pp.t) === 1 && KANJI.test(pp.t) && len(p.t) === 1 && !AFTER_NOUN.test(p.t)) return;   // 買い・取る のように分かれたとき
      if (len(c.t) === 1 && (!n || n.k === 'end' || n.k === 'cl' || n.k === 'op' || n.k === 'sp' || AFTER_NOUN.test(n.t))) return;   // 「車」1字で行の頭に来ない
      out.add(c.i);
    });
    for (const m of text.matchAll(NAMES)) {
      for (let i = m.index + 1; i < m.index + m[0].length; i++) out.delete(i);
      if (m.index > 0 && kind(text[m.index - 1]) !== 'op') out.add(m.index);
    }
    const list = [...out].sort((x, y) => x - y);
    /* 最後に2字以下だけが1行で残らないように */
    if (list.length && len(text.slice(list[list.length - 1]).replace(/[\s、。，．！？）」』]/g, '')) <= 2) list.pop();
    return list;
  };

  /* 前の文字（<b> などをまたいだ、すぐ前の1字） */
  const prevChar = node => {
    for (let e = node; e && e !== document.body; e = e.parentNode) {
      const p = e.previousSibling;
      if (p) return p.nodeType === 1 && p.tagName === 'BR' ? '' : (p.textContent || '').slice(-1);
      if (!e.parentNode || getComputedStyle(e.parentNode).display !== 'inline') return '';
    }
    return '';
  };
  const startsPhrase = (node, text) => {
    const c = prevChar(node);
    if (!c || /\s/.test(c)) return false;
    const k = kind(c), first = text.trim()[0] || '';
    if (kind(first) === 'end' || kind(first) === 'cl') return false;
    return k === 'end' || kind(first) === 'op' || (k === 'hi' && kind(first) === 'co');
  };

  /* 先に全部を読んで（どこで切るか決める）、あとでまとめて書きかえる。読みと書きを交互にすると、そのたびに画面の計算がやり直しになって遅い */
  const plan = node => {
    const text = node.nodeValue, parent = node.parentElement;
    if (!parent || !JA.test(text) || parent.closest(SKIP)) return null;
    const cs = getComputedStyle(parent);
    if (/nowrap|pre/.test(cs.whiteSpace)) return null;   // 1行で見せる文。<wbr> を入れると nowrap でも折り返してしまう
    const at = cuts(text);
    if (startsPhrase(node, text)) at.unshift(0);
    if (!at.length && !text.match(GLUE)) return null;
    return { node, text, at, box: /flex|grid/.test(cs.display) };
  };
  const apply = ({ node, text, at, box }) => {
    if (!node.isConnected) return;
    const f = document.createDocumentFragment();
    const add = s => {
      let last = 0;
      for (const m of s.matchAll(GLUE)) {
        f.append(s.slice(last, m.index));
        const nb = document.createElement('x-nb');
        nb.textContent = m[0];
        f.append(nb);
        last = m.index + m[0].length;
      }
      f.append(s.slice(last));
    };
    let a = 0;
    at.forEach(c => { if (c > a) add(text.slice(a, c)); f.append(document.createElement('wbr')); a = c; });
    add(text.slice(a));
    /* flex・grid の中では <wbr> で文が別々の箱に分かれるので、1つの箱に包む */
    if (box) {
      const b = document.createElement('x-phrase');
      b.append(f);
      node.replaceWith(b);
    } else node.replaceWith(f);
  };

  const walk = top => {
    let list = [];
    if (top.nodeType === 3) list = [top];
    else if (top.nodeType === 1 && !top.matches(SKIP)) {
      const w = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) list.push(w.currentNode);
    }
    list.map(plan).filter(Boolean).forEach(apply);
  };

  walk(document.body);
  root.classList.add('phrase');

  const seen = new MutationObserver(recs => {
    recs.forEach(r => r.addedNodes.forEach(n => { if (n.isConnected) walk(n); }));
    seen.takeRecords();
  });
  seen.observe(document.body, { childList: true, subtree: true });
})();
