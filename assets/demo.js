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

  // ── Camera ───────────────────────────────────────────────
  // The whole mock sits in .csp-cam (transform-origin 0 0). zoom() pushes in
  // on one element; wide() pulls back out. Positions are measured in the
  // camera's own (unscaled) space: screen offset ÷ current scale.
  var cam = $('.csp-cam'), camScale = 1;
  var phone = matchMedia('(max-width: 760px)');

  // Layout position inside the camera, unaffected by any transform in flight
  // (.csp-cam is position:relative, so the offsetParent chain ends there).
  function local(target) {
    var x = 0, y = 0, n = target;
    while (n && n !== cam) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: target.offsetWidth, h: target.offsetHeight };
  }

  // anchor 'left': frame the element's start edge (for wide things like the
  // composer or timeline, whose action begins at the left); default centres it.
  function zoom(target, s, anchor) {
    if (!cam) return;
    if (phone.matches) return;   // phones: the mock already fills the screen; zooming only crops it
    var p = local(target), W = root.clientWidth, H = root.clientHeight;
    var tx = anchor === 'left' ? -(p.x - 24) * s : W / 2 - (p.x + p.w / 2) * s;
    var ty = H / 2 - (p.y + p.h / 2) * s;
    tx = Math.min(0, Math.max(W - W * s, tx));   // never show past the frame edge
    ty = Math.min(0, Math.max(H - cam.offsetHeight * s, ty));
    camScale = s;
    cam.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }

  function wide() { if (!cam) return; camScale = 1; cam.style.transform = ''; }

  // Move the fake pointer onto an element. The pointer lives inside the camera,
  // so it is placed in camera space and zooms with everything else.
  function pointAt(target) {
    var p = local(target);
    cursor.style.opacity = '1';
    cursor.style.transform = 'translate(' + (p.x + p.w * 0.55) + 'px,' + (p.y + p.h * 0.55) + 'px)';
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
    wide();
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
    var t = 900;   // a beat on the wide shot first, so viewers see the whole app
    var composer = $('.csp-composer'), chat = $('.csp-chat');
    var batch = $('.csp-batch'), nle = $('.csp-nle');

    // 1. Push in on the composer and type the request.
    step(0);
    later(function () { zoom(composer, 1.7, 'left'); }, t);
    t += 1100;
    PROMPT.split('').forEach(function (ch, i) { later(function () { typed.textContent += ch; }, t + i * 38); });
    t += PROMPT.length * 38 + 300;
    later(function () { zoom(sendBtn, 1.7); }, t + 300);   // pan only once the request is fully typed
    later(function () { pointAt(sendBtn); }, t + 1100);
    later(function () { sendBtn.classList.add('press'); }, t + 1700);
    later(function () {
      sendBtn.classList.remove('press'); typed.textContent = '';
      var u = user(PROMPT); thread.appendChild(u); show(u, 20);
      cursor.style.opacity = '0';
    }, t + 1900);
    t += 2300;

    // 2. Ease back to the chat pane while Smithy returns beats, one at a time.
    later(function () { step(1); zoom(chat, 1.2); }, t);
    var s;
    later(function () { s = smithy(); thread.appendChild(s.node); show(s.node, 20); }, t + 300);
    BEATS.forEach(function (b, i) {
      later(function () { var c = beatCard(b, i); s.list.appendChild(c); show(c, 20); }, t + 800 + i * 450);
    });
    t += 800 + BEATS.length * 450 + 800;

    // 3. Push in on beat 1's "Find selects" and click it…
    later(function () {
      step(2);
      var f = s.list.querySelector('.csp-find');
      zoom(f, 1.7);
      later(function () { pointAt(f); }, 900);
      later(function () { f.classList.add('hit'); }, 1600);
    }, t);
    t += 2100;
    // …then pull out and settle on the edit batch as it fills.
    later(function () { cursor.style.opacity = '0'; zoom(batch, 1.35, 'left'); empty.style.display = 'none'; }, t);
    SELECTS.forEach(function (x, i) {
      later(function () { var r = selectRow(x, i, false); rows.appendChild(r); show(r, 20); }, t + 700 + i * 320);
    });
    t += 700 + SELECTS.length * 320 + 700;

    // 4. Push in on "Send to …", click, then cut to the timeline as clips land.
    later(function () { step(3); zoom(ship, 1.9); }, t);
    later(function () { pointAt(ship); }, t + 900);
    later(function () { ship.classList.add('press'); nleState.textContent = 'Building sequence…'; }, t + 1600);
    later(function () {
      ship.classList.remove('press'); cursor.style.opacity = '0';
      rows.querySelectorAll('.st').forEach(function (e) { e.classList.add('ok'); e.textContent = '● linked'; });
      zoom(nle, 1.5, 'left');
    }, t + 1900);
    later(function () { addClips(true); }, t + 2700);
    t += 2700 + CLIP_W.length * 260 + 400;
    later(function () {
      nleState.textContent = SELECTS.length + ' clips on the timeline';
      head.style.transition = ''; head.style.left = '62%';
    }, t);
    t += 2600;

    // 5. Pull all the way out: the finished state, start to end, in one view.
    later(function () { wide(); }, t);
    t += 3200;

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
