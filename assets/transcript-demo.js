/* Transcript flow mock (#cred .csp-tx): a looping, scripted scene.
     01 Upload      — the pointer drags a rushes file into the bin;
     02 Transcribe  — upload + transcription progress, then the transcript
                      streams in with speakers and timecodes;
     03 Select      — the pointer highlights a line, word by word;
     04 Add         — a popup menu opens on the selection; "Add to selects"
                      puts the line, with its timecode, in the Selects tray.
   Same conventions as the #demo mock (assets/demo-v3.js): status line inside
   the app, pointer travels then clicks, camera pushes in on desktop only.
   Story content is invented (fictional local-news interview).
   Plays for everyone, including reduced-motion visitors: it is the product explanation. */
(function () {
  'use strict';
  var root = document.querySelector('#cred .csp-tx');
  if (!root) return;

  var $ = function (s) { return root.querySelector(s); };
  var cam = $('.csp-cam'), cursor = $('.csp-cursor'), bin = $('.tx-bin'), drop = $('.tx-drop');
  var files = $('.tx-files'), lines = $('.tx-lines'), name = $('.tx-name'), meta = $('.tx-meta');
  var chips = $('.tx-chips'), empty = $('.tx-empty');
  var steps = document.querySelectorAll('#cred .tx-steps span');
  if (!cam || !cursor || !drop || !files || !lines || !chips) {
    console.warn('transcript demo: markup incomplete, animation not started');
    return;
  }

  var FILE = 'council-leader_interview.mov';
  var LINES = [
    ['REPORTER', '00:04:02:11', 'When did the council know the wall wasn’t finished?'],
    ['COUNCIL LEADER', '00:04:06:20', 'We knew in 2019. We started that work and we didn’t finish it.'],
    ['COUNCIL LEADER', '00:04:12:08', 'The money was moved to roads. It shouldn’t have been, and I’ve said that to residents.'],
    ['REPORTER', '00:04:21:15', 'Will the people on Riverside Road be compensated?'],
    ['COUNCIL LEADER', '00:04:25:02', 'That’s a decision for the full council, but I’ll be arguing for it.']
  ];
  var PICK = 2, SEL_TO = 9;   // highlight line 3, words 0..9: "The money was moved to roads. It shouldn't have been,"
  var MENU = [['+', 'Add to selects', 'S'], ['⌕', 'Find similar lines', 'F'], ['⧉', 'Copy with timecode', 'C'], ['✦', 'Ask Smithy about this', '']];
  var timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // Status line inside the app (styles: .csp-status in assets/demo-v3.css).
  var status = el('div', 'csp-status', '<span class="spin"></span><span class="n"></span><span class="t"></span>');
  root.appendChild(status);
  function say(i, text, done) {
    if (i !== null) steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    status.classList.remove('in');
    later(function () {
      status.querySelector('.n').textContent = i === null || i < 0 ? '' : '0' + (i + 1);
      status.querySelector('.t').textContent = text;
      status.classList.toggle('done', !!done);
      status.classList.add('in');
    }, 200);
  }

  // ── Camera + pointer (same approach as the #demo mock) ──
  var phone = matchMedia('(max-width: 760px)'), TOP = 56;
  function local(t) {
    var x = 0, y = 0, n = t;
    while (n && n !== cam) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: t.offsetWidth, h: t.offsetHeight };
  }
  function zoom(t, max) {
    if (phone.matches) return;
    var p = local(t), W = cam.offsetWidth, H = cam.offsetHeight;
    var s = Math.max(1, Math.min(max, (W - 64) / p.w, (H - TOP - 32) / p.h));
    var tx = Math.min(0, Math.max(W - W * s, W / 2 - (p.x + p.w / 2) * s));
    var ty = Math.min(0, Math.max(H - H * s, TOP + (H - TOP) / 2 - (p.y + p.h / 2) * s));
    cam.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }
  function wide() { cam.style.transform = ''; }
  function moveTo(t, fx, fy) {
    var p = local(t);
    cursor.style.opacity = '1';
    cursor.style.transform = 'translate(' + (p.x + p.w * (fx == null ? 0.55 : fx)) + 'px,' + (p.y + p.h * (fy == null ? 0.6 : fy)) + 'px)';
  }
  function click(t) {
    if (t) { t.classList.add('press'); later(function () { t.classList.remove('press'); }, 220); }
    cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click');
  }
  function park() { cursor.style.opacity = '0'; }

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    files.innerHTML = ''; bin.classList.remove('has-file'); drop.classList.remove('over');
    lines.innerHTML = '<div class="tx-ph">Transcripts appear here, every word timecoded.</div>';
    name.textContent = 'No file open'; meta.textContent = '';
    chips.innerHTML = ''; chips.appendChild(empty);
    var d = $('.tx-drag'); if (d) d.remove();
    cursor.style.transition = '';
    park(); wide();
  }

  function line(l) {
    var r = el('div', 'tx-line');
    r.setAttribute('data-in', '');
    r.innerHTML = '<span class="who' + (l[0] === 'REPORTER' ? ' rep' : '') + '">' + l[0] + '</span>' +
      '<span class="tc mono">' + l[1] + '</span>' +
      '<span class="txt">' + l[2].split(' ').map(function (w) { return '<span>' + w + '</span>'; }).join(' ') + '</span>';
    return r;
  }

  function play() {
    reset();
    root.classList.remove('fade');
    var t = 0;

    // 01 Upload: a file card is dragged into the drop zone.
    say(0, 'Drop in the rushes');
    var card = el('div', 'tx-drag', FILE + '<small>2.1 GB · 24:16</small>');
    cam.appendChild(card);
    var start = local(lines);
    card.style.transition = 'none';
    card.style.transform = 'translate(' + (start.x + start.w * 0.45) + 'px,' + (start.y + 60) + 'px)';
    cursor.style.transition = 'none';
    cursor.style.transform = 'translate(' + (start.x + start.w * 0.45 + 150) + 'px,' + (start.y + 82) + 'px)';
    later(function () { zoom(bin.offsetWidth < 300 ? $('.tx-body') : bin, 1.25); }, 200);
    later(function () {
      card.style.transition = ''; cursor.style.transition = '';
      card.style.opacity = '1'; cursor.style.opacity = '1';
    }, 900);
    t = 1700;
    later(function () {
      var p = local(drop);
      card.style.transform = 'translate(' + (p.x + 6) + 'px,' + (p.y + 8) + 'px)';
      cursor.style.transform = 'translate(' + (p.x + 150) + 'px,' + (p.y + 30) + 'px)';
      later(function () { drop.classList.add('over'); }, 600);
    }, t);
    t += 1300;
    later(function () {
      click(); card.style.opacity = '0'; drop.classList.remove('over'); park();
      bin.classList.add('has-file');
      var f = el('div', 'tx-file', '<div class="nm">' + FILE + '</div><div class="st"><span class="lab">Uploading</span><span class="pc mono">0%</span></div><div class="tx-bar"><i></i></div>');
      f.setAttribute('data-in', ''); files.appendChild(f); later(function () { f.classList.add('in'); }, 20);
    }, t);
    t += 400;

    // 02 Transcribe: upload, then transcription, then the transcript streams in.
    later(function () { say(1, 'Uploading ' + FILE); }, t);
    for (var i = 1; i <= 10; i++) (function (i) {
      later(function () { var f = files.querySelector('.tx-file'); f.querySelector('.pc').textContent = i * 10 + '%'; f.querySelector('.tx-bar i').style.width = i * 10 + '%'; }, t + i * 120);
    })(i);
    t += 1500;
    later(function () {
      say(1, 'Transcribing: every word, speaker and timecode');
      var f = files.querySelector('.tx-file'); f.querySelector('.lab').textContent = 'Transcribing';
      f.querySelector('.tx-bar i').style.transition = 'none'; f.querySelector('.tx-bar i').style.width = '0';
    }, t);
    for (var j = 1; j <= 20; j++) (function (j) {
      later(function () { var f = files.querySelector('.tx-file'); f.querySelector('.pc').textContent = j * 5 + '%'; var b = f.querySelector('.tx-bar i'); b.style.transition = ''; b.style.width = j * 5 + '%'; }, t + 300 + j * 110);
    })(j);
    t += 300 + 20 * 110 + 200;
    later(function () {
      var f = files.querySelector('.tx-file');
      f.querySelector('.st').classList.add('ok'); f.querySelector('.lab').textContent = '✓ Transcribed'; f.querySelector('.pc').textContent = '2 speakers';
      f.querySelector('.tx-bar').classList.add('ok');
      name.textContent = FILE; meta.textContent = '24:16 · 2 speakers';
      lines.innerHTML = ''; wide();
    }, t);
    LINES.forEach(function (l, k) {
      later(function () { var r = line(l); lines.appendChild(r); later(function () { r.classList.add('in'); }, 20); }, t + 300 + k * 450);
    });
    t += 300 + LINES.length * 450;
    later(function () { say(1, 'Transcribed: 2 speakers, 24 minutes, every word timecoded', true); }, t);
    t += 2400;

    // 03 Select: the pointer drags across the line, word by word.
    var row, words;
    later(function () {
      say(2, 'Highlight the line you want');
      row = lines.querySelectorAll('.tx-line')[PICK]; words = row.querySelectorAll('.txt span');
      zoom(row, 1.5);
    }, t);
    later(function () { moveTo(words[0], 0, 0.7); }, t + 900);
    t += 1800;
    later(function () {
      cursor.style.transition = 'transform ' + (SEL_TO * 0.13 + 0.1) + 's linear, opacity .3s';
      moveTo(words[SEL_TO], 1, 0.7);
      for (var k = 0; k <= SEL_TO; k++) (function (k) { later(function () { words[k].classList.add('sel'); }, k * 130); })(k);
    }, t);
    t += SEL_TO * 130 + 500;

    // 04 Add: the popup menu opens on the selection; pick "Add to selects".
    var pop;
    later(function () {
      cursor.style.transition = '';
      say(3, 'Choose what to do with it');
      pop = el('div', 'tx-pop', MENU.map(function (m) { return '<div><b>' + m[0] + '</b>' + m[1] + (m[2] ? '<kbd>' + m[2] + '</kbd>' : '') + '</div>'; }).join(''));
      lines.appendChild(pop);
      var last = words[SEL_TO], first = words[0];
      pop.style.left = Math.min(first.offsetLeft, lines.clientWidth - 236) + 'px';
      pop.style.top = (last.offsetTop + last.offsetHeight + 8) + 'px';
      later(function () { pop.classList.add('in'); zoom(pop.offsetTop > row.offsetTop ? row : row, 1.3); }, 30);
    }, t);
    t += 1300;
    later(function () { var a = pop.firstChild; moveTo(a, 0.4, 0.55); later(function () { a.classList.add('hov'); }, 650); }, t);
    t += 1500;
    later(function () { click(pop.firstChild); }, t);
    later(function () {
      pop.classList.remove('in'); park(); row.classList.add('added');
      empty.remove();
      var q = Array.prototype.slice.call(words, 0, SEL_TO + 1).map(function (w) { return w.textContent; }).join(' ').replace(/,$/, '.');
      var c = el('div', 'tx-chip', '<span class="n mono">1.</span><span class="tc mono">00:04:12:08 – 00:04:16:02</span><span class="q">“' + q + '”</span><span class="who">Council leader</span>');
      c.setAttribute('data-in', ''); chips.appendChild(c); later(function () { c.classList.add('in'); }, 20);
      zoom($('.tx-selects'), 1.3);
      say(3, 'In your selects, with its timecode', true);
    }, t + 300);
    t += 300 + 3200;

    // Pull out on the finished state, fade, loop.
    later(function () { wide(); say(-1, 'Every word searchable. Every select timecoded.', true); }, t);
    t += 3800;
    later(function () { root.classList.add('fade'); }, t);
    t += 700;
    later(play, t);
  }

  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
  }, { threshold: 0.25 });
  io.observe(root);
})();
