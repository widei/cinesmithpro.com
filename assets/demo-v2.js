/* "See it work" v2 — loaded with index.html?demo=v2 (v1 = assets/demo.js).
   Same scripted scene as v1 (transcript → beats → Find selects → edit batch →
   send to the NLE), reworked so a first-time visitor can follow it:
     • a caption bar inside the frame says, in plain words, what each step does
       and carries a progress bar across the whole loop;
     • slower pacing, with holds on every payoff so it can be read;
     • every click shows a ring, so the viewer sees what was pressed;
     • the Find selects shot frames the whole beat, not just the button;
     • the loop fades out and back in instead of hard-cutting to empty.
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
  var steps = document.querySelectorAll('#demo .demo-steps span');
  var cam = $('.csp-cam');
  if (!typed || !thread || !rows || !ship || !laneV || !cursor || !cam) {
    console.warn('demo v2: markup incomplete, animation not started');
    return;
  }

  // Caption bar: built here (not in index.html) so v1 markup stays untouched.
  // It sits outside the camera layer, so it never zooms.
  var cap = document.createElement('div');
  cap.className = 'csp-cap';
  cap.innerHTML = '<span class="csp-cap-n"></span><span class="csp-cap-t"></span><span class="csp-cap-bar"><i></i></span>';
  root.appendChild(cap);
  var capN = cap.querySelector('.csp-cap-n'), capT = cap.querySelector('.csp-cap-t');
  var capBar = cap.querySelector('.csp-cap-bar i');

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

  // Pacing (ms). Every duration lives here so the progress bar's length is
  // computed from the same numbers the scene uses.
  var T = {
    open: 2600, push: 1300, key: 45, typedHold: 600, send: 2500,
    beatsIn: 1000, beatGap: 750, beatsHold: 2200,
    pick: 2700, rowsIn: 900, rowGap: 520, rowsHold: 2400,
    ship: 3300, clipGap: 380, clipsTail: 500, nleHold: 3000,
    endHold: 4500, fade: 700
  };
  var LOOP_MS = T.open + T.push + PROMPT.length * T.key + T.typedHold + T.send +
    T.beatsIn + BEATS.length * T.beatGap + T.beatsHold +
    T.pick + T.rowsIn + SELECTS.length * T.rowGap + T.rowsHold +
    T.ship + CLIP_W.length * T.clipGap + T.clipsTail + T.nleHold + T.endHold + T.fade;

  var loop = 0, timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function show(e, ms) { later(function () { e.classList.add('in'); }, ms); }

  // Step = caption text + the chips under the frame, kept in sync.
  // i = -1 for the opening and closing lines (no step number).
  function step(i, text) {
    steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    cap.classList.remove('in');
    later(function () {
      capN.textContent = i < 0 ? '' : '0' + (i + 1);
      capT.textContent = text;
      cap.classList.add('in');
    }, 220);
  }

  // ── Camera ───────────────────────────────────────────────
  // .csp-cam (transform-origin 0 0) is scaled/translated to push in on one
  // element and pulled back out with wide().
  var phone = matchMedia('(max-width: 760px)');

  // Layout position inside the camera, unaffected by any transform in flight
  // (.csp-cam is position:relative, so the offsetParent chain ends there).
  function local(target) {
    var x = 0, y = 0, n = target;
    while (n && n !== cam) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: target.offsetWidth, h: target.offsetHeight };
  }

  // anchor 'left' frames the element's start edge, 'right' its end edge
  // (wide rows whose action is at one side); default centres it.
  function zoom(target, s, anchor) {
    if (phone.matches) return;   // phones: the mock already fills the screen; zooming only crops it
    // H = the picture area only (the caption strip sits below it, outside the camera).
    var p = local(target), W = root.clientWidth, H = cam.offsetHeight;
    var tx = anchor === 'left' ? -(p.x - 24) * s
           : anchor === 'right' ? W - (p.x + p.w + 24) * s
           : W / 2 - (p.x + p.w / 2) * s;
    var ty = H / 2 - (p.y + p.h / 2) * s;
    tx = Math.min(0, Math.max(W - W * s, tx));   // never show past the frame edge
    ty = Math.min(0, Math.max(H - H * s, ty));
    cam.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }

  function wide() { cam.style.transform = ''; }

  // Fake pointer, placed in camera space so it zooms with everything else.
  function pointAt(target) {
    var p = local(target);
    cursor.style.opacity = '1';
    cursor.style.transform = 'translate(' + (p.x + p.w * 0.55) + 'px,' + (p.y + p.h * 0.55) + 'px)';
  }

  // Click = button pressed state + an expanding ring at the pointer.
  function click(target) {
    target.classList.add('press');
    cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click');
    later(function () { target.classList.remove('press'); }, 260);
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

  function selectRow(s, i) {
    var r = el('div', 'csp-row');
    r.setAttribute('data-in', '');
    r.innerHTML = '<span class="n mono">' + (i + 1) + '.</span><span class="tc mono">' + s[0] + '</span>' +
      '<span class="q">' + s[1] + '</span><span class="st">○ draft</span>';
    return r;
  }

  function addClips() {
    CLIP_W.forEach(function (w, i) {
      [laneV, laneA].forEach(function (lane) {
        var c = el('span', 'csp-clip');
        lane.appendChild(c);
        later(function () { c.style.width = w + '%'; }, i * T.clipGap);
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

  // Progress bar: one linear CSS transition across the whole loop.
  function startBar() {
    capBar.style.transition = 'none'; capBar.style.width = '0';
    void capBar.offsetWidth;
    capBar.style.transition = 'width ' + LOOP_MS + 'ms linear'; capBar.style.width = '100%';
  }

  function play() {
    reset();
    var host = HOSTS[loop % HOSTS.length];
    setHost(host);
    var composer = $('.csp-composer'), chat = $('.csp-chat');
    var batch = $('.csp-batch'), nle = $('.csp-nle');
    root.classList.remove('fade');
    startBar();

    // 0. Wide shot: set the scene before anything moves.
    step(-1, 'An interview transcript is loaded. Watch it become a sequence.');
    var t = T.open;

    // 1. Push in on the composer and type the request.
    later(function () { step(0, 'Ask for the story beats, in plain English.'); zoom(composer, 1.7, 'left'); }, t);
    t += T.push;
    PROMPT.split('').forEach(function (ch, i) { later(function () { typed.textContent += ch; }, t + i * T.key); });
    t += PROMPT.length * T.key + T.typedHold;
    later(function () { zoom(sendBtn, 1.7); }, t);
    later(function () { pointAt(sendBtn); }, t + 900);
    later(function () { click(sendBtn); }, t + 1600);
    later(function () {
      typed.textContent = '';
      var u = user(PROMPT); thread.appendChild(u); show(u, 20);
      cursor.style.opacity = '0';
    }, t + 1900);
    t += T.send;

    // 2. Back to the chat; beats arrive one at a time, then hold to read.
    later(function () { step(1, 'Smithy reads the interview and maps it into beats, with timecodes.'); zoom(chat, 1.2); }, t);
    var s;
    later(function () { s = smithy(); thread.appendChild(s.node); show(s.node, 20); }, t + 400);
    BEATS.forEach(function (b, i) {
      later(function () { var c = beatCard(b, i); s.list.appendChild(c); show(c, 20); }, t + T.beatsIn + i * T.beatGap);
    });
    t += T.beatsIn + BEATS.length * T.beatGap + T.beatsHold;

    // 3. Frame beat 1 (text + button), then click Find selects.
    later(function () {
      step(2, 'Pick a beat. Smithy pulls the exact lines that tell it.');
      var card = s.list.querySelector('.csp-beat'), f = card.querySelector('.csp-find');
      zoom(card, Math.min(1.35, (root.clientWidth - 48) / card.offsetWidth));   // whole beat in frame: text + button
      later(function () { pointAt(f); }, 1200);
      later(function () { click(f); f.classList.add('hit'); }, 2000);
    }, t);
    t += T.pick;
    // The edit batch fills; hold so the quotes can be read.
    later(function () { cursor.style.opacity = '0'; zoom(batch, 1.35, 'left'); empty.style.display = 'none'; }, t);
    SELECTS.forEach(function (x, i) {
      later(function () { var r = selectRow(x, i); rows.appendChild(r); show(r, 20); }, t + T.rowsIn + i * T.rowGap);
    });
    t += T.rowsIn + SELECTS.length * T.rowGap + T.rowsHold;

    // 4. Send to the NLE; the timeline builds in front of the viewer.
    later(function () { step(3, 'One click sends the selects to ' + host + ' as a sequence.'); zoom(ship, 1.9); }, t);
    later(function () { pointAt(ship); }, t + 1100);
    later(function () { click(ship); nleState.textContent = 'Building sequence…'; }, t + 1900);
    later(function () {
      cursor.style.opacity = '0';
      rows.querySelectorAll('.st').forEach(function (e) { e.classList.add('ok'); e.textContent = '● linked'; });
      zoom(nle, 1.5, 'left');
    }, t + 2300);
    later(function () { addClips(); }, t + T.ship);
    t += T.ship + CLIP_W.length * T.clipGap + T.clipsTail;
    later(function () {
      nleState.textContent = SELECTS.length + ' clips on the timeline';
      head.style.transition = ''; head.style.left = '62%';
    }, t);
    t += T.nleHold;

    // 5. Pull out on the finished state, then fade and start again.
    later(function () { wide(); step(-1, 'Interview to edit-ready sequence. You make the cut.'); }, t);
    t += T.endHold;
    later(function () { root.classList.add('fade'); }, t);
    t += T.fade;

    later(function () { loop++; play(); }, t);
  }

  // Start the first time the mock scrolls into view, then keep looping.
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
  }, { threshold: 0.25 });
  io.observe(root);
})();
