/* "See it work" — plays a looping, scripted scene inside the CineSmithPro
   mock (#demo .csp). The scene mirrors the real flow:
     transcript → ask for beats → Find selects → edit batch → Send to the NLE.
   All story content is invented (a fictional local-news interview) so the
   demo never puts words in a real person's mouth.
   Each loop alternates the host app (Premiere Pro, then DaVinci Resolve).
   Reduced motion: renders the finished state once, no animation. */
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
  var steps = document.querySelectorAll('#demo .demo-steps span');
  if (!typed || !thread || !rows || !ship || !laneV || !cursor) {
    console.warn('demo: markup incomplete, animation not started');
    return;
  }

  var FILE = 'flood-defences_interview.srt';
  var PROMPT = 'Beats from ' + FILE;
  var BEATS = [
    ['Why the barrier failed: the council leader admits the 2019 repairs were never finished.', '00:01:12 – 00:01:48', 'Council leader'],
    ['Cost: the bill for the new defences, and who is being asked to pay it.', '00:03:05 – 00:03:41', 'Council leader'],
    ['Residents: a shop owner on clearing out the ground floor for the third time.', '00:06:20 – 00:06:58', 'Resident'],
    ['What happens next: a promise of a public meeting before the winter.', '00:09:44 – 00:10:15', 'Council leader']
  ];
  var SELECTS = [
    ['00:01:14:06 – 00:01:22:18', '“We started that work and we didn’t finish it. That’s on us.”'],
    ['00:01:31:02 – 00:01:39:11', '“The money was moved to roads. It shouldn’t have been.”'],
    ['00:03:07:20 – 00:03:15:04', '“Every household on the river will see it in the bill.”'],
    ['00:06:22:09 – 00:06:30:00', '“Third time. You stop unpacking after the second.”'],
    ['00:09:46:13 – 00:09:53:22', '“We’ll be in that hall before November. All of us.”']
  ];
  var CLIP_W = [14, 11, 13, 12, 10]; // % widths on the timeline lanes
  var HOSTS = ['Premiere Pro', 'DaVinci Resolve'];
  var loop = 0, timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function show(e, ms) { later(function () { e.classList.add('in'); }, ms); }
  function step(i) { steps.forEach(function (s, k) { s.classList.toggle('on', k === i); }); }

  // Move the fake pointer onto an element (coordinates relative to the mock).
  function pointAt(target) {
    var r = root.getBoundingClientRect(), t = target.getBoundingClientRect();
    cursor.style.opacity = '1';
    cursor.style.transform = 'translate(' + (t.left - r.left + t.width * 0.55) + 'px,' + (t.top - r.top + t.height * 0.55) + 'px)';
  }

  function setHost(name) {
    hostEls.forEach(function (h) { h.textContent = name; });
    shipLabel.textContent = name === 'Premiere Pro' ? 'Premiere' : 'Resolve';
  }

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    typed.textContent = ''; thread.innerHTML = ''; rows.innerHTML = '';
    empty.style.display = ''; laneV.innerHTML = ''; laneA.innerHTML = '';
    head.style.transition = 'none'; head.style.left = '56px';
    nleState.textContent = 'Waiting for a batch';
    cursor.style.opacity = '0'; ship.classList.remove('press');
  }

  function beatCard(b, i) {
    var c = el('div', 'csp-beat');
    c.setAttribute('data-in', '');
    c.innerHTML = '<p>' + (i + 1) + '. ' + b[0] + '</p><span class="csp-find">Find selects</span>' +
      '<span class="meta mono">' + b[1] + ' <span class="spk">· ' + b[2] + ', <em>INTERVIEWEE</em></span></span>';
    return c;
  }

  function selectRow(s, i, sent) {
    var r = el('div', 'csp-row');
    r.setAttribute('data-in', '');
    r.innerHTML = '<span class="n mono">' + (i + 1) + '.</span><span class="tc mono">' + s[0] + '</span>' +
      '<span class="q">' + s[1] + '</span><span class="st' + (sent ? ' ok' : '') + '">' + (sent ? '● linked' : '○ draft') + '</span>';
    return r;
  }

  function addClips(animate) {
    CLIP_W.forEach(function (w, i) {
      [laneV, laneA].forEach(function (lane) {
        var c = el('span', 'csp-clip');
        lane.appendChild(c);
        if (animate) later(function () { c.style.width = w + '%'; }, i * 260);
        else c.style.width = w + '%';
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

  // Finished state, no motion — for prefers-reduced-motion.
  function staticEnd() {
    setHost(HOSTS[0]);
    thread.appendChild(user(PROMPT));
    var s = smithy(); thread.appendChild(s.node);
    BEATS.forEach(function (b, i) { s.list.appendChild(beatCard(b, i)); });
    empty.style.display = 'none';
    SELECTS.forEach(function (x, i) { rows.appendChild(selectRow(x, i, true)); });
    addClips(false);
    nleState.textContent = SELECTS.length + ' clips on the timeline';
    root.querySelectorAll('[data-in]').forEach(function (e) { e.classList.add('in'); });
    step(3);
  }

  function play() {
    reset();
    setHost(HOSTS[loop % HOSTS.length]);
    var t = 400;

    // 1. Type the request.
    step(0);
    PROMPT.split('').forEach(function (ch, i) { later(function () { typed.textContent += ch; }, t + i * 38); });
    t += PROMPT.length * 38 + 300;
    later(function () { pointAt(sendBtn); }, t - 200);
    later(function () { sendBtn.classList.add('press'); }, t + 500);
    later(function () {
      sendBtn.classList.remove('press'); typed.textContent = '';
      var u = user(PROMPT); thread.appendChild(u); show(u, 20);
    }, t + 700);
    t += 1500;

    // 2. Smithy returns beats, one at a time.
    later(function () { step(1); }, t);
    var s;
    later(function () { s = smithy(); thread.appendChild(s.node); show(s.node, 20); }, t);
    BEATS.forEach(function (b, i) {
      later(function () { var c = beatCard(b, i); s.list.appendChild(c); show(c, 20); }, t + 500 + i * 450);
    });
    t += 500 + BEATS.length * 450 + 700;

    // 3. Find selects on beat 1 → edit batch fills.
    later(function () {
      step(2);
      var f = s.list.querySelector('.csp-find');
      pointAt(f);
      later(function () { f.classList.add('hit'); }, 650);
    }, t);
    t += 1300;
    later(function () { empty.style.display = 'none'; }, t);
    SELECTS.forEach(function (x, i) {
      later(function () { var r = selectRow(x, i, false); rows.appendChild(r); show(r, 20); }, t + i * 320);
    });
    t += SELECTS.length * 320 + 700;

    // 4. Send to the NLE → clips land on the timeline, playhead runs.
    later(function () { step(3); pointAt(ship); }, t);
    later(function () { ship.classList.add('press'); nleState.textContent = 'Building sequence…'; }, t + 750);
    later(function () {
      ship.classList.remove('press');
      rows.querySelectorAll('.st').forEach(function (e) { e.classList.add('ok'); e.textContent = '● linked'; });
      addClips(true);
    }, t + 1000);
    t += 1000 + CLIP_W.length * 260 + 400;
    later(function () {
      nleState.textContent = SELECTS.length + ' clips on the timeline';
      cursor.style.opacity = '0';
      head.style.transition = ''; head.style.left = '62%';
    }, t);
    t += 4200;

    later(function () { loop++; play(); }, t);
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { staticEnd(); return; }

  // Start the first time the mock scrolls into view, then keep looping.
  // (Resetting on every exit made it restart mid-scene as people scrolled.)
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
  }, { threshold: 0.25 });
  io.observe(root);
})();
