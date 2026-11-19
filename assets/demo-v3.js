/* "See it work" v3 — loaded with index.html?demo=v3 (v1 = assets/demo.js,
   v2 = assets/demo-v2.js). Rebuilt from the independent review of v2:
     • the mock fits the screen under the fixed nav (CSS), so nothing that
       explains the scene is ever below the fold;
     • narration lives inside the app: a status line pinned to the top of the
       frame says what is happening right now (spinner while working, green
       when done), like the product's own working state;
     • each beat has its OWN quotes; picking beat 1 pulls only beat 1's lines;
     • "pick a beat" dims the other beats and pushes in on the chosen one;
     • the pointer travels to a button, then clicks; it is parked between steps;
     • every camera shot shows its whole subject (fit-to-width zooms);
     • phones: no camera, the thread scrolls the active item into view.
   Story content is invented (fictional local-news interview).
   Plays for everyone, including reduced-motion visitors: it is the product explanation. */
(function () {
  'use strict';
  var root = document.querySelector('#demo .csp');
  if (!root) return;

  var $ = function (s) { return root.querySelector(s); };
  var typed = $('.csp-typed'), sendBtn = $('.csp-send'), thread = $('.csp-thread');
  var rows = $('.csp-rows'), empty = $('.csp-batch-empty'), ship = $('.csp-ship');
  var shipLabel = $('.csp-ship-host'), hostEls = document.querySelectorAll('#demo .csp-host');
  var laneV = $('.csp-lane.v'), laneA = $('.csp-lane.a'), head = $('.csp-head');
  var cursor = $('.csp-cursor'), nleState = $('.csp-nle-state');
  var batchName = $('.csp-batch-head .name');
  var composer = $('.csp-composer'), batch = $('.csp-batch'), nle = $('.csp-nle');
  var steps = document.querySelectorAll('#demo .demo-steps span');
  var cam = $('.csp-cam');
  if (!typed || !thread || !rows || !ship || !laneV || !cursor || !cam || !composer) {
    console.warn('demo v3: markup incomplete, animation not started');
    return;
  }

  // Status line (built here so v1/v2 markup stays untouched). Outside the
  // camera layer, so it never zooms or gets cropped.
  var status = document.createElement('div');
  status.className = 'csp-status';
  status.innerHTML = '<span class="spin"></span><span class="n"></span><span class="t"></span>';
  root.appendChild(status);
  var stN = status.querySelector('.n'), stT = status.querySelector('.t');

  var FILE = 'flood-defences_interview.srt';
  var PROMPT = 'Beats from ' + FILE;
  // Each beat carries its own selects. Only beat 1's are pulled in the scene.
  var BEATS = [
    { title: 'Why the barrier failed: the council leader admits the 2019 repairs were never finished.',
      tc: '00:01:12 – 00:01:48', who: 'Council leader', batch: 'why-it-failed',
      selects: [
        ['00:01:14:06 – 00:01:22:18', '“We started that work in 2019 and we didn’t finish it. That’s on us.”'],
        ['00:01:25:10 – 00:01:31:02', '“The last section of the wall was never raised.”'],
        ['00:01:31:02 – 00:01:39:11', '“The money was moved to roads. It shouldn’t have been.”']
      ] },
    { title: 'Cost: the bill for the new defences, and who is being asked to pay it.',
      tc: '00:03:05 – 00:03:41', who: 'Council leader' },
    { title: 'Residents: a shop owner on clearing out the ground floor for the third time.',
      tc: '00:06:20 – 00:06:58', who: 'Resident' },
    { title: 'What happens next: a promise of a public meeting before the winter.',
      tc: '00:09:44 – 00:10:15', who: 'Council leader' }
  ];
  var PICK = BEATS[0];
  var CLIP_W = [16, 12, 15]; // % widths on the timeline lanes, one per select
  var HOSTS = ['Premiere Pro', 'DaVinci Resolve'];
  var loop = 0, timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function show(e, ms) { later(function () { e.classList.add('in'); }, ms); }

  // Narration: step number (or none) + what is happening; done = green dot.
  function say(i, text, done) {
    if (i !== null) steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    status.classList.remove('in');
    later(function () {
      stN.textContent = i === null || i < 0 ? '' : '0' + (i + 1);
      stT.textContent = text;
      status.classList.toggle('done', !!done);
      status.classList.add('in');
    }, 200);
  }

  // ── Camera ───────────────────────────────────────────────
  var phone = matchMedia('(max-width: 760px)');
  var TOP = 56;   // the status line covers the top of the frame: frame shots below it

  // Layout position inside the camera, unaffected by any transform in flight.
  function local(target) {
    var x = 0, y = 0, n = target;
    while (n && n !== cam) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    // The thread scrolls: subtract its scroll so positions match what is shown.
    if (thread.contains(target)) y -= thread.scrollTop;
    return { x: x, y: y, w: target.offsetWidth, h: target.offsetHeight };
  }

  // Push in on `target`, never further than `max`, and never so far that the
  // target's width (plus margin) no longer fits: the whole subject stays in shot.
  function zoom(target, max) {
    if (phone.matches) return;   // phones: the mock already fills the screen
    var p = local(target), W = cam.offsetWidth, H = cam.offsetHeight;
    var s = Math.max(1, Math.min(max, (W - 64) / p.w, (H - TOP - 32) / p.h));
    var tx = W / 2 - (p.x + p.w / 2) * s;
    var ty = TOP + (H - TOP) / 2 - (p.y + p.h / 2) * s;
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    cam.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }
  function wide() { cam.style.transform = ''; }

  // Pointer: travel to the button (0.7s), then click.
  function moveTo(target) {
    var p = local(target);
    cursor.style.opacity = '1';
    cursor.style.transform = 'translate(' + (p.x + p.w * 0.55) + 'px,' + (p.y + p.h * 0.6) + 'px)';
  }
  function click(target) {
    target.classList.add('press');
    cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click');
    later(function () { target.classList.remove('press'); }, 220);
  }
  function park() { cursor.style.opacity = '0'; }

  // Keep a thread item in view (phones rely on this instead of the camera).
  function reveal(node) {
    var top = node.offsetTop - thread.offsetTop - 8;
    thread.scrollTop = Math.max(0, top);
  }

  function setHost(name) {
    hostEls.forEach(function (h) { h.textContent = name; });
    shipLabel.textContent = name === 'Premiere Pro' ? 'Premiere' : 'Resolve';
  }

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    typed.textContent = ''; thread.innerHTML = ''; rows.innerHTML = ''; thread.scrollTop = 0;
    empty.style.display = ''; laneV.innerHTML = ''; laneA.innerHTML = '';
    head.style.transition = 'none'; head.style.left = '56px';
    nleState.textContent = 'Waiting for a batch';
    if (batchName) batchName.textContent = PICK.batch;
    park(); wide();
    var old = cam.querySelector('.csp-player'); if (old) old.remove();
  }

  function beatCard(b, i) {
    var c = el('div', 'csp-beat');
    c.setAttribute('data-in', '');
    c.innerHTML = '<p><span class="csp-play">&#9654;</span>' + (i + 1) + '. ' + b.title + '</p><span class="csp-find">Find selects</span>' +
      '<span class="meta mono">' + b.tc + ' <span class="spk">· ' + b.who + ', <em>INTERVIEWEE</em></span></span>';
    return c;
  }

  function selectRow(s, i) {
    var r = el('div', 'csp-row');
    r.setAttribute('data-in', '');
    r.innerHTML = '<span class="n mono">' + (i + 1) + '.</span><span class="csp-play">&#9654;</span><span class="tc mono">' + s[0] + '</span>' +
      '<span class="q">' + s[1] + '</span><span class="st">○ draft</span>';
    return r;
  }

  function addClips() {
    CLIP_W.forEach(function (w, i) {
      [laneV, laneA].forEach(function (lane) {
        var c = el('span', 'csp-clip');
        lane.appendChild(c);
        later(function () { c.style.width = w + '%'; }, i * 450);
      });
    });
  }

  function user(text) {
    var m = el('div', 'csp-msg');
    m.setAttribute('data-in', '');
    m.innerHTML = '<div class="who">EDITOR</div>' + text;
    return m;
  }

  function smithy() {
    var m = el('div', 'csp-msg ai');
    m.setAttribute('data-in', '');
    m.innerHTML = '<div class="who">SMITHY</div>' + BEATS.length + ' beats from <span class="mono">' + FILE + '</span>.';
    var list = el('div', 'csp-beats');
    m.appendChild(list);
    return { node: m, list: list };
  }

  // ── Clip player: transcript text above an audio waveform; mark in / out ──
  var WORDS = 'We started that work in 2019 and we didn’t finish it. That’s on us.'.split(' ');
  var WT = 320;                                   // ms per word during playback
  var IN_W = 7, OUT_W = WORDS.length - 1;         // new selection: "we didn't finish it. That's on us."
  function frac(k) { return 0.04 + k * (0.92 / WORDS.length); }   // word k's position on the waveform
  function buildPlayer() {
    var pl = el('div', 'csp-player');
    var bars = '';
    for (var i = 0; i < 72; i++) bars += '<i style="height:' + Math.round(18 + Math.abs(Math.sin(i * 1.7) * Math.sin(i * 0.37 + 1)) * 78) + '%"></i>';
    pl.innerHTML = '<div class="hd"><span><b>Select 1</b> · ' + FILE.replace('.srt', '.mov') + '</span><span class="mono">✕</span></div>' +
      '<p class="csp-words">' + WORDS.map(function (w) { return '<span>' + w + '</span>'; }).join(' ') + '</p>' +
      '<div class="csp-wave">' + bars + '<span class="rng"></span><span class="ph"></span></div>' +
      '<div class="ctl"><span class="tc mono">00:01:14:06</span><span class="btn pp">&#9654; Play</span>' +
      '<span class="btn mi">Mark in</span><span class="btn mo">Mark out</span><span class="btn use">Use selection</span></div>';
    cam.appendChild(pl);
    return pl;
  }

  function play() {
    reset();
    var host = HOSTS[loop % HOSTS.length];
    setHost(host);
    root.classList.remove('fade');
    var t = 0;

    // 0. Wide: the project with its interview transcripts loaded.
    say(-1, 'A news interview, transcribed and loaded', true);
    t += 2400;

    // 1. Ask. Push in on the message box (whole box in shot), type, then send.
    later(function () { say(0, 'The editor asks for the story beats'); zoom(composer, 1.6); }, t);
    t += 1300;
    PROMPT.split('').forEach(function (ch, i) { later(function () { typed.textContent += ch; }, t + i * 45); });
    t += PROMPT.length * 45 + 400;
    later(function () { moveTo(sendBtn); }, t);
    later(function () { click(sendBtn); }, t + 900);
    later(function () {
      typed.textContent = ''; park();
      var u = user(PROMPT); thread.appendChild(u); show(u, 20);
    }, t + 1150);
    t += 1700;

    // 2. Beats. Pull back to the conversation; beats arrive one at a time.
    var s;
    later(function () { say(1, 'Smithy reads the interview and finds the beats'); wide(); }, t);
    later(function () { s = smithy(); thread.appendChild(s.node); show(s.node, 20); }, t + 900);
    BEATS.forEach(function (b, i) {
      later(function () { var c = beatCard(b, i); s.list.appendChild(c); show(c, 20); }, t + 1500 + i * 800);
    });
    t += 1500 + BEATS.length * 800;
    later(function () { say(1, '4 beats, each with timecodes and speaker', true); }, t);
    t += 2600;   // hold: let the list be read

    // 3. Pick a beat. Dim the others, push in on beat 1, pointer travels, click.
    later(function () {
      say(2, 'Pick a beat: “Why the barrier failed”');
      var card = s.list.querySelector('.csp-beat');
      reveal(s.node);
      s.list.classList.add('focus'); card.classList.add('pick');
      later(function () { zoom(card, 1.6); }, 300);
    }, t);
    t += 1700;
    later(function () { moveTo(s.list.querySelector('.csp-find')); }, t);
    later(function () { var f = s.list.querySelector('.csp-find'); click(f); f.classList.add('hit'); }, t + 900);
    t += 1300;

    // The edit batch fills with THAT beat's lines; frame quotes + button together.
    later(function () {
      park(); say(2, 'Smithy pulls the 3 lines that tell that beat'); zoom(batch, 1.4);
      empty.style.display = 'none';
    }, t);
    PICK.selects.forEach(function (x, i) {
      later(function () { var r = selectRow(x, i); rows.appendChild(r); show(r, 20); }, t + 1000 + i * 700);
    });
    t += 1000 + PICK.selects.length * 700;
    later(function () { say(2, '3 selects, timecoded, in the edit batch', true); }, t);
    t += 2400;

    // 3b. Check a select by ear: play row 1, mark a tighter in / out, use it.
    var pl, row1;
    later(function () {
      say(2, 'Play select 1 to check it');
      row1 = rows.querySelector('.csp-row'); moveTo(row1.querySelector('.csp-play'));
    }, t);
    later(function () { click(row1.querySelector('.csp-play')); }, t + 900);
    later(function () { park(); wide(); pl = buildPlayer(); later(function () { pl.classList.add('in'); }, 30); }, t + 1200);
    t += 2200;
    later(function () {
      say(2, 'Listen, then mark a new in and out');
      var ph = pl.querySelector('.ph');
      ph.style.transition = 'left ' + (WORDS.length * WT / 1000) + 's linear';
      ph.style.left = (frac(WORDS.length) * 100) + '%';
      pl.querySelector('.pp').innerHTML = '&#10073;&#10073; Pause';
      var ws = pl.querySelectorAll('.csp-words span'), tc = pl.querySelector('.tc');
      ws.forEach(function (w, k) {
        later(function () {
          w.classList.add('on');
          var f = 6 + k * 9, sec = 14 + Math.floor(f / 25);
          tc.textContent = '00:01:' + sec + ':' + ('0' + (f % 25)).slice(-2);
        }, k * WT);
      });
    }, t);
    later(function () { moveTo(pl.querySelector('.mi')); }, t + IN_W * WT - 900);
    later(function () {
      click(pl.querySelector('.mi'));
      var r = pl.querySelector('.rng'); r.style.left = (frac(IN_W) * 100) + '%'; r.style.width = '0'; r.classList.add('in');
    }, t + IN_W * WT);
    later(function () { moveTo(pl.querySelector('.mo')); }, t + (OUT_W + 1) * WT - 700);
    later(function () {
      click(pl.querySelector('.mo'));
      pl.querySelector('.rng').style.width = ((frac(OUT_W + 1) - frac(IN_W)) * 100) + '%';
      pl.querySelectorAll('.csp-words span').forEach(function (w, k) { if (k >= IN_W && k <= OUT_W) w.classList.add('sel'); });
      pl.querySelector('.pp').innerHTML = '&#9654; Play';
      say(2, 'New in and out: “we didn’t finish it. That’s on us.”', true);
    }, t + (OUT_W + 1) * WT + 100);
    t += (OUT_W + 1) * WT + 1800;
    later(function () { moveTo(pl.querySelector('.use')); }, t);
    later(function () { click(pl.querySelector('.use')); }, t + 900);
    later(function () {
      park(); pl.classList.remove('in'); zoom(batch, 1.4);
      row1.querySelector('.tc').textContent = '00:01:17:20 – 00:01:22:18';
      row1.querySelector('.q').textContent = '“We didn’t finish it. That’s on us.”';
      row1.classList.add('trim');
      say(2, 'Select 1 now uses the new in and out', true);
    }, t + 1300);
    t += 1300 + 2800;

    // 4. Send. Pointer to "Send to …", click, then cut to the timeline.
    later(function () { say(3, 'Send the selects to ' + host); moveTo(ship); }, t);
    later(function () { click(ship); nleState.textContent = 'Building sequence…'; }, t + 1000);
    later(function () {
      park();
      rows.querySelectorAll('.st').forEach(function (e) { e.classList.add('ok'); e.textContent = '● linked'; });
      zoom(nle, 1.5);
    }, t + 1300);
    later(function () { addClips(); say(3, 'Building the sequence in ' + host); }, t + 2300);
    t += 2300 + CLIP_W.length * 450 + 600;
    later(function () {
      nleState.textContent = CLIP_W.length + ' clips on the timeline';
      say(3, 'Sequence ready in ' + host, true);
      head.style.transition = ''; head.style.left = '48%';
    }, t);
    t += 3200;

    // 5. Pull out on the whole finished state, then fade and loop.
    later(function () { wide(); say(-1, 'Interview to sequence. You make the cut.', true); }, t);
    t += 4200;
    later(function () { root.classList.add('fade'); }, t);
    t += 700;

    later(function () { loop++; play(); }, t);
  }

  // Start the first time the mock scrolls into view, then keep looping.
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
  }, { threshold: 0.25 });
  io.observe(root);
})();
