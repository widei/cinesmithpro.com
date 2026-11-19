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
  // The drop: [name, size, duration, speakers]. The first one opens in the transcript.
  var RUSHES = [
    [FILE, '2.1 GB', '24:16', '2 speakers'],
    ['resident_vox-pops.mov', '1.4 GB', '11:02', '6 speakers'],
    ['riverside_phone-footage.mp4', '380 MB', '03:47', '3 speakers'],
    ['reporter_pieces-to-camera.mxf', '1.9 GB', '05:31', '1 speaker']
  ];
  // A full page of transcript, so the panel reads like a real interview.
  var LINES = [
    ['REPORTER', '00:03:31:04', 'Thanks for making the time. Can we start with the night itself?'],
    ['COUNCIL LEADER', '00:03:35:12', 'Of course. The river came over the wall just after two in the morning.'],
    ['COUNCIL LEADER', '00:03:41:20', 'By four, forty homes on Riverside Road had water through the ground floor.'],
    ['REPORTER', '00:03:48:02', 'Residents say they were told the wall had been fixed.'],
    ['COUNCIL LEADER', '00:03:52:16', 'I understand why they believed that. It’s what we said in 2019.'],
    ['REPORTER', '00:03:58:09', 'When did the council know the wall wasn’t finished?'],
    ['COUNCIL LEADER', '00:04:06:20', 'We knew in 2019. We started that work and we didn’t finish it.'],
    ['COUNCIL LEADER', '00:04:12:08', 'The money was moved to roads. It shouldn’t have been, and I’ve said that to residents.'],
    ['REPORTER', '00:04:21:15', 'Who made that decision?'],
    ['COUNCIL LEADER', '00:04:24:03', 'It went through the budget committee. I sat on it. I voted for it.'],
    ['REPORTER', '00:04:31:18', 'Will the people on Riverside Road be compensated?'],
    ['COUNCIL LEADER', '00:04:35:02', 'That’s a decision for the full council, but I’ll be arguing for it.'],
    ['REPORTER', '00:04:42:11', 'And the wall itself? When will it actually be finished?'],
    ['COUNCIL LEADER', '00:04:46:24', 'The contract goes out next month. Work starts before the winter.'],
    ['REPORTER', '00:04:53:07', 'What would you say to the shop owners who’ve flooded three times?'],
    ['COUNCIL LEADER', '00:04:58:15', 'That they were let down. And that we’ll be in that hall before November.'],
    ['REPORTER', '00:05:06:02', 'Will you stand for re-election?'],
    ['COUNCIL LEADER', '00:05:09:19', 'That’s not what today is about.']
  ];
  var PICK = 7, SEL_TO = 9;   // highlight line 8, words 0..9: "The money was moved to roads. It shouldn't have been,"
  // 05 Ask Smithy: highlight a place, Smithy finds it across every transcript and suggests selects.
  var ASK_LINE = 10, ASK_FROM = 4, ASK_TO = 5;   // "Riverside Road" in "Will the people on Riverside Road be compensated?"
  var MENTIONS = [['council-leader_interview.mov', 3], ['resident_vox-pops.mov', 4], ['riverside_phone-footage.mp4', 2]];
  var SUGGEST = [
    ['resident_vox-pops.mov', '00:02:14:10', 'Riverside Road’s been under water three times since I moved in.', 'Resident'],
    ['riverside_phone-footage.mp4', '00:00:41:03', 'It’s coming up the road now. Get the car out, get it out!', 'Resident, phone video'],
    ['council-leader_interview.mov', '00:03:41:20', 'By four, forty homes on Riverside Road had water through the ground floor.', 'Council leader']
  ];
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
    for (var q = t.parentNode; q && q !== cam; q = q.parentNode) y -= q.scrollTop || 0;   // scrolled panels (transcript, Smithy)
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
    lines.scrollTop = 0; lines.innerHTML = '<div class="tx-ph">Transcripts appear here, every word timecoded.</div>';
    name.textContent = 'No file open'; meta.textContent = '';
    chips.innerHTML = ''; chips.appendChild(empty);
    var d = $('.tx-drag'); if (d) d.remove();
    var sm = $('.tx-smithy'); if (sm) sm.remove();
    var pp = $('.tx-pop'); if (pp) pp.remove();
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

    // 01 Upload: a stack of rushes is dragged into the drop zone.
    say(0, 'Drop in the rushes');
    var card = el('div', 'tx-drag', RUSHES.length + ' files<small>' + RUSHES.map(function (f) { return f[0]; }).join('<br>') + '</small>');
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
      RUSHES.forEach(function (f, k) {
        var r = el('div', 'tx-file', '<div class="nm">' + f[0] + '</div><div class="st"><span class="lab">Queued</span><span class="pc mono">' + f[1] + '</span></div><div class="tx-bar"><i></i></div>');
        r.setAttribute('data-in', ''); files.appendChild(r); later(function () { r.classList.add('in'); }, 20 + k * 90);
      });
    }, t);
    t += 500;

    // 02 Transcribe: each file uploads, then transcribes, a little behind the one before.
    later(function () { say(1, 'Uploading ' + RUSHES.length + ' files'); }, t);
    RUSHES.forEach(function (f, k) {
      var t0 = t + k * 500;
      for (var i = 1; i <= 8; i++) (function (i) {
        later(function () { var r = files.children[k]; r.querySelector('.lab').textContent = 'Uploading'; r.querySelector('.pc').textContent = Math.round(i * 12.5) + '%'; r.querySelector('.tx-bar i').style.width = i * 12.5 + '%'; }, t0 + i * 110);
      })(i);
      later(function () { var b = files.children[k].querySelector('.tx-bar i'); b.style.transition = 'none'; b.style.width = '0'; files.children[k].querySelector('.lab').textContent = 'Transcribing'; }, t0 + 1050);
      for (var j = 1; j <= 10; j++) (function (j) {
        later(function () { var r = files.children[k]; r.querySelector('.pc').textContent = j * 10 + '%'; var b = r.querySelector('.tx-bar i'); b.style.transition = ''; b.style.width = j * 10 + '%'; }, t0 + 1100 + j * 170);
      })(j);
      later(function () {
        var r = files.children[k];
        r.querySelector('.st').classList.add('ok'); r.querySelector('.lab').textContent = '✓ Transcribed'; r.querySelector('.pc').textContent = f[3];
        r.querySelector('.tx-bar').classList.add('ok');
      }, t0 + 1100 + 10 * 170 + 150);
    });
    later(function () { say(1, 'Transcribing: every word, speaker and timecode'); }, t + 1100);
    t += (RUSHES.length - 1) * 500 + 1100 + 10 * 170 + 400;
    later(function () {
      files.children[0].classList.add('open');
      name.textContent = RUSHES[0][0]; meta.textContent = RUSHES[0][2] + ' · ' + RUSHES[0][3];
      lines.innerHTML = ''; wide();
    }, t);
    LINES.forEach(function (l, k) {
      later(function () { var r = line(l); lines.appendChild(r); later(function () { r.classList.add('in'); }, 20); }, t + 300 + k * 140);
    });
    t += 300 + LINES.length * 140 + 300;
    later(function () { say(1, '4 files transcribed: every word, speaker and timecode', true); }, t);
    t += 2400;

    // 03 Select: the pointer drags across the line, word by word.
    var row, words;
    later(function () {
      say(2, 'Highlight the line you want');
      row = lines.querySelectorAll('.tx-line')[PICK]; words = row.querySelectorAll('.txt span');
      lines.scrollTop = Math.max(0, row.offsetTop - lines.clientHeight * 0.3);   // bring the line up the panel
      later(function () { zoom(row, 1.5); }, 500);
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
    t += 300 + 2600;

    // 05 Ask Smithy: highlight "Riverside Road", ask about it, take the suggested selects.
    var row2, w2, pop2, sm;
    later(function () {
      wide(); if (pop) pop.remove();
      say(4, 'Highlight a place: “Riverside Road”');
      row2 = lines.querySelectorAll('.tx-line')[ASK_LINE]; w2 = row2.querySelectorAll('.txt span');
      lines.scrollTop = Math.max(0, row2.offsetTop - lines.clientHeight * 0.3);
      later(function () { zoom(row2, 1.5); }, 500);
    }, t);
    later(function () { moveTo(w2[ASK_FROM], 0, 0.7); }, t + 900);
    t += 1800;
    later(function () {
      cursor.style.transition = 'transform .45s linear, opacity .3s';
      moveTo(w2[ASK_TO], 1, 0.7);
      w2[ASK_FROM].classList.add('sel'); later(function () { w2[ASK_TO].classList.add('sel'); }, 220);
    }, t);
    t += 800;
    later(function () {
      cursor.style.transition = '';
      pop2 = el('div', 'tx-pop', MENU.map(function (m) { return '<div><b>' + m[0] + '</b>' + m[1] + (m[2] ? '<kbd>' + m[2] + '</kbd>' : '') + '</div>'; }).join(''));
      lines.appendChild(pop2);
      var f = w2[ASK_FROM], l = w2[ASK_TO];
      pop2.style.left = Math.min(f.offsetLeft, lines.clientWidth - 236) + 'px';
      pop2.style.top = (l.offsetTop + l.offsetHeight + 8) + 'px';
      later(function () { pop2.classList.add('in'); }, 30);
    }, t);
    t += 900;
    later(function () { var a = pop2.children[3]; moveTo(a, 0.45, 0.55); later(function () { a.classList.add('hov'); }, 650); }, t);
    t += 1400;
    later(function () { click(pop2.children[3]); }, t);
    later(function () {
      pop2.classList.remove('in'); park(); wide();
      say(4, 'Smithy searches all 4 transcripts');
      sm = el('div', 'tx-smithy',
        '<div class="who">SMITHY</div><div class="ask">About <b>Riverside Road</b></div><div class="dots"><i></i><i></i><i></i></div><div class="ans"></div>');
      $('.tx-body').appendChild(sm);
      later(function () { sm.classList.add('in'); }, 30);
    }, t + 300);
    t += 2300;
    later(function () {
      sm.querySelector('.dots').style.display = 'none';
      var ans = sm.querySelector('.ans');
      ans.innerHTML = '<p>Riverside Road comes up <b>9 times</b> in <b>3 transcripts</b>:</p>' +
        '<ul class="men">' + MENTIONS.map(function (m) { return '<li data-in><span class="mono">' + m[0] + '</span><b>' + m[1] + '×</b></li>'; }).join('') + '</ul>' +
        '<p data-in>Here are a few selects for you:</p>' +
        '<div class="sug">' + SUGGEST.map(function (x) { return '<div class="sg" data-in><span class="tc mono">' + x[1] + ' · ' + x[0] + '</span><span class="q">“' + x[2] + '”</span><span class="by">' + x[3] + '</span></div>'; }).join('') + '</div>' +
        '<span class="addall" data-in>+ Add all 3 to selects</span>';
      ans.querySelectorAll('[data-in]').forEach(function (e, k) { later(function () { e.classList.add('in'); }, 120 + k * 260); });
    }, t);
    t += 120 + 9 * 260 + 300;
    later(function () { say(4, 'Riverside Road: 9 mentions, 3 selects suggested', true); }, t);
    t += 1800;
    later(function () { sm.scrollTop = sm.scrollHeight; }, t - 600);   // bring the Add all button into view
    later(function () { moveTo(sm.querySelector('.addall')); }, t);
    later(function () { click(sm.querySelector('.addall')); }, t + 900);
    later(function () {
      park(); sm.classList.remove('in');
      SUGGEST.forEach(function (x, k) {
        later(function () {
          var c = el('div', 'tx-chip', '<span class="n mono">' + (k + 2) + '.</span><span class="tc mono">' + x[1] + '</span><span class="q">“' + x[2] + '”</span><span class="who">' + x[3] + '</span>');
          c.setAttribute('data-in', ''); chips.appendChild(c); later(function () { c.classList.add('in'); }, 20);
        }, k * 250);
      });
      zoom($('.tx-selects'), 1.2);
      say(4, '4 selects from 3 files, all timecoded', true);
    }, t + 1200);
    t += 1200 + 3400;

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
