/* Arpeda — Arpeggio interactions（依存ライブラリなし）
   1) 最初の1回だけ：譜面の線→ロゴ→見出しを時間差で組み上げる
   2) statement：スクロール位置に合わせて言葉を濃くする（スクロールは奪わない）
   3) process：スクロールに合わせて青い再生線を進める
   html.motion は <head> の小さなスクリプトが「動きを減らす設定でない」ときだけ付ける。 */
(function () {
  var root = document.documentElement;
  var motion = root.classList.contains('motion');

  // 年
  var y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // メールアドレスはJSで組み立てる（HTMLに平文で置かない）
  document.querySelectorAll('.mailslot').forEach(function (el) {
    var e = el.dataset.u + String.fromCharCode(64) + el.dataset.d;
    var a = document.createElement('a');
    a.href = 'mailto:' + e; a.textContent = e;
    el.textContent = ''; el.appendChild(a);
  });

  // ヘッダー：スクロールしたら下線、スマホはメニュー開閉
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('span').textContent = open ? '閉じる' : 'メニュー';
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.querySelector('span').textContent = 'メニュー'; }
    });
  }

  // 見出しを1文字ずつに分ける（読み上げは h1 の aria-label で1文として読む）
  var title = document.querySelector('.hero-title');
  if (title) {
    var n = 0;
    title.querySelectorAll('.ln').forEach(function (ln) {
      var text = ln.textContent; ln.textContent = '';
      Array.from(text).forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--i', n++); s.textContent = c;
        ln.appendChild(s);
      });
    });
    title.querySelectorAll('.staff i').forEach(function (l, i) { l.style.setProperty('--i', i); });
  }


  // ---------- サンプルのカルーセル（動きを減らす設定でも操作はできる） ----------
  (function () {
    var track = document.querySelector('.car-track');
    if (!track) return;
    var slides = Array.prototype.slice.call(track.children);
    var bar = document.querySelector('.car-bar i');
    var num = document.querySelector('.car-count b');
    var btns = document.querySelectorAll('.car-btn');
    var cur = -1, n = slides.length;
    if (bar) bar.style.setProperty('--w', (100 / n) + '%');
    function active() {
      var left = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).scrollPaddingLeft || 0);
      var best = 0, d = Infinity;
      slides.forEach(function (s, i) { var x = Math.abs(s.getBoundingClientRect().left - left); if (x < d) { d = x; best = i; } });
      // 右端まで送ったら最後を選ぶ
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) best = n - 1;
      return best;
    }
    function update() {
      var i = active(); if (i === cur) return; cur = i;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); s.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      if (num) num.textContent = i + 1;
      if (bar) bar.style.setProperty('--x', i * 100);
      if (btns[0]) btns[0].disabled = i === 0;
      if (btns[1]) btns[1].disabled = i === n - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(n - 1, i));
      var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft || 0);
      track.scrollTo({ left: slides[i].offsetLeft - pad, behavior: motion ? 'smooth' : 'auto' });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { go(cur + (+b.dataset.dir)); }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    var raf = 0;
    track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function () { cur = -1; update(); });
    // マウスでのドラッグ（タッチは標準のスワイプに任せる）
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (moved) { track.classList.remove('is-drag'); update(); go(cur); }
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
    update();
  })();


  // ---------- スマホの固定ボタン：最初の画面を過ぎたら出し、最後の相談欄が見えたら引っ込める ----------
  (function () {
    var dock = document.querySelector('.dock'), hero = document.querySelector('.hero, .page-head'), closing = document.querySelector('.closing');
    if (!dock || !hero) return;
    function check() {
      var vh = window.innerHeight;
      var pastHero = hero.getBoundingClientRect().bottom < 0;
      var atEnd = closing ? closing.getBoundingClientRect().top < vh * 0.9 : false;
      var on = pastHero && !atEnd;
      if (dock.classList.contains('is-on') === on) return;
      dock.classList.toggle('is-on', on); dock.setAttribute('aria-hidden', on ? 'false' : 'true'); dock.tabIndex = on ? 0 : -1;
    }
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
  })();


  // ---------- お問い合わせフォーム ----------
  // data-endpoint（Formspree などの受付URL）があればそこへ送る。まだ無いあいだは、入力内容でメールを作って送ってもらう。
  (function () {
    var f = document.querySelector('.cform');
    if (!f) return;
    var st = f.querySelector('.cform-status'), btn = f.querySelector('.cform-submit');
    // ?menu=diag などで「ご相談の内容」を選んだ状態にする
    if (f.elements.ts) f.elements.ts.value = String(Date.now());
    var m = (location.search.match(/[?&]menu=([a-z]+)/) || [])[1];
    if (m) { var r = f.querySelector('input[data-key="' + m + '"]'); if (r) r.checked = true; }
    function val(n) { var el = f.elements[n]; return el ? (el.value || '').trim() : ''; }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [];
      ['name', 'email', 'message'].forEach(function (n) { var el = f.elements[n]; var ng = !val(n) || (n === 'email' && !el.checkValidity()); el.classList.toggle('is-error', ng); if (ng) bad.push(el); });
      var topic = f.querySelector('input[name="topic"]:checked');
      if (!topic) bad.push(f.querySelector('input[name="topic"]'));
      if (bad.length) { st.className = 'cform-status ng'; st.textContent = '未入力または形式が正しくない項目があります。赤い枠の項目と「ご相談の種類」をご確認ください。'; bad[0].focus(); return; }
      if (val('_gotcha')) return;
      var endpoint = f.dataset.endpoint;
      if (endpoint) {
        btn.disabled = true; st.className = 'cform-status'; st.textContent = '送信しています…';
        // Google Apps Script のウェブアプリへ（application/x-www-form-urlencoded で送ると e.parameter で受け取れる）
        fetch(endpoint, { method: 'POST', body: new URLSearchParams(new FormData(f)) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || !d.ok) throw d || {};
            f.reset(); st.className = 'cform-status ok'; st.textContent = '送信しました。通常その日のうちにご返信します。';
          })
          .catch(function (d) {
            var mail = 'hello' + String.fromCharCode(64) + 'arpeda.jp';
            var msg = (d && d.error === 'rate') ? '短い時間に続けて送信されています。少し時間をおいてから、もう一度お試しください。'
              : (d && d.error === 'email') ? 'メールアドレスの形式をご確認ください。'
              : '送信できませんでした。時間をおいて再度お試しいただくか、' + mail + ' までメールでお送りください。';
            st.className = 'cform-status ng'; st.textContent = msg;
          })
          .then(function () { btn.disabled = false; });
      } else {
        var to = 'hello' + String.fromCharCode(64) + 'arpeda.jp';
        var body = 'お名前：' + val('name') + '\nメール：' + val('email') + '\nお店・会社：' + val('organization') + '\nご相談の種類：' + topic.value + '\n今のホームページ：' + val('url') + '\n\n' + val('message');
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('【ご相談】' + topic.value) + '&body=' + encodeURIComponent(body);
        st.className = 'cform-status ok'; st.textContent = 'メールソフトが開きます。内容を確認して、そのまま送信してください。';
      }
    });
  })();

  if (!motion) { root.classList.add('is-ready'); return; }


  // ---------- hero：ホームページが組み上がるアニメーション（構成→デザイン→公開をくり返す） ----------
  (function () {
    var win = document.querySelector('.bwin');
    if (!win) return;
    var shops = [
      { tag: '整体院', h: 'その腰や肩のつらさ、そのままにせずご相談ください。', cta: 'ご予約はこちら', img: '/assets/img/build-seitai.webp' },
      { tag: 'ネイル・まつげ', h: '指先とまつげを、ていねいに整える。', cta: '空き状況を見る', img: '/assets/img/build-nail.webp' },
      { tag: 'トリミング', h: 'その子のペースで、トリミングを。', cta: '予約する', img: '/assets/img/build-pet.webp' }
    ];
    shops.forEach(function (sh) { var im = new Image(); im.src = sh.img; });   // 先に読んでおく
    var tag = win.querySelector('.b-tag-t'), h = win.querySelector('.b-h-t'), cta = win.querySelector('.b-cta-t'), img = win.querySelector('.b-img img');
    var n = 0, timers = [], inView = true, running = false;
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function type(text) {
      h.textContent = '';
      Array.from(text).forEach(function (c, k) { at(k * 55, function () { h.textContent += c; }); });
    }
    function cycle() {
      timers.forEach(clearTimeout); timers = []; running = true;
      var sh = shops[n % shops.length];
      win.classList.remove('is-out');
      win.dataset.shop = n % shops.length; win.dataset.phase = '0';
      tag.textContent = sh.tag; cta.textContent = sh.cta; img.src = sh.img; h.textContent = '';
      at(250, function () { win.dataset.phase = '1'; });
      at(2300, function () { win.dataset.phase = '2'; at(350, function () { type(sh.h); }); });
      at(5200, function () { win.dataset.phase = '3'; });
      at(8400, function () { win.classList.add('is-out'); });
      at(9000, function () { n++; if (inView) cycle(); else running = false; });
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      inView = es[0].isIntersecting; if (inView && !running) cycle();
    }).observe(win);
    at(900, function () { if (!running) cycle(); });
  })();


  // ---------- スクロールで現れる要素 ----------
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  })();

  // 組み上げの開始（フォント待ちは最大600msまで）
  var started = false;
  function start() { if (started) return; started = true; requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-ready'); }); }); }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(start); setTimeout(start, 600); } else { start(); }

  // statement
  var words = Array.prototype.slice.call(document.querySelectorAll('.statement .w'));
  var stmt = document.querySelector('.statement-text');
  // process
  var score = document.querySelector('.score');
  var head = document.querySelector('.playhead');

  var ticking = false;
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (stmt && words.length) {
      var r = stmt.getBoundingClientRect();
      // 段落の上端が画面の85%に来たら始まり、下端が55%に来たら全部濃い
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.3);
      p = Math.max(0, Math.min(1, p));
      var k = Math.round(p * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < k);
    }
    if (score && head) {
      var s = score.getBoundingClientRect();
      var q = (vh * 0.75 - s.top) / (s.height + vh * 0.25);
      q = Math.max(0, Math.min(1, q));
      head.style.setProperty('--p', q.toFixed(4));
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
