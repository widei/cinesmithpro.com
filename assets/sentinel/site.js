/* sentinel-insi.org shared script. Every block checks for its own markup and
   does nothing on pages that do not contain it. Loaded with defer. */

/* Shared by the home-page animations (the demo and the map tour): a
   pause-aware timeline and an on-screen pointer inside `frame`. One pending
   wait at a time; pausing keeps the time left on it, so it resumes where it
   stopped. play(loop) runs only while the frame is on screen and the tab is
   visible, and holds while the pointer is over the frame (.is-held). */
function playback(frame, cursor) {
  var active = false, timer = null, pending = null, remaining = 0, due = 0;
  function wait(ms, fn) { pending = fn; remaining = ms; if (active) arm(); }
  function arm() {
    due = Date.now() + remaining;
    timer = setTimeout(function () { timer = null; var f = pending; pending = null; f(); }, remaining);
  }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) { if (pending && !timer) arm(); }
    else if (timer) { clearTimeout(timer); timer = null; remaining = Math.max(0, due - Date.now()); }
  }
  function seq(steps, done) {
    var i = 0;
    (function next() { if (i < steps.length) steps[i++](next); else done(); })();
  }
  function pause(ms) { return function (next) { wait(ms, next); }; }
  function act(fn) { return function (next) { fn(); next(); }; }
  function show(el) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }

  function moveTo(el) {
    return function (next) {
      var f = frame.getBoundingClientRect(), r = el.getBoundingClientRect();
      var x = r.left - f.left + Math.min(r.width * 0.55, 40), y = r.top - f.top + r.height * 0.55;
      cursor.classList.add('in');
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      wait(900, next);
    };
  }
  function click(el) {
    return function (next) {
      cursor.classList.remove('is-click'); void cursor.offsetWidth; cursor.classList.add('is-click');
      el.classList.add('is-press');
      wait(180, function () { el.classList.remove('is-press'); next(); });
    };
  }
  function parkCursor() { cursor.classList.remove('in', 'is-click'); cursor.style.transform = ''; }

  function play(loop) {
    var inView = false, hovered = false;
    function sync() {
      frame.classList.toggle('is-held', hovered);
      setActive(inView && !hovered && !document.hidden);
    }
    document.addEventListener('visibilitychange', sync);
    // Hold on hover only where a real pointer hovers: on touch a tap fires
    // mouseenter and nothing ever fires mouseleave, which froze the animation.
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      frame.addEventListener('mouseenter', function () { hovered = true; sync(); });
      frame.addEventListener('mouseleave', function () { hovered = false; sync(); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting; sync();
      }, { threshold: 0.3 }).observe(frame);
    } else {
      inView = true;
    }
    loop();
    sync();
  }

  return { wait: wait, seq: seq, pause: pause, act: act, show: show, moveTo: moveTo, click: click, parkCursor: parkCursor, play: play };
}

/* Mobile nav (every page) */
(function () {
  var btn = document.querySelector('.menu-btn');
  var links = document.getElementById('nav-links');
  if (!btn || !links) return;
  function setOpen(open) {
    btn.setAttribute('aria-expanded', String(open));
    links.classList.toggle('open', open);
  }
  btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); btn.focus(); }
  });
})();

/* Hero map (home page only) */
(function () {
  var canvas = document.getElementById('city');
  var stage = document.getElementById('map');
  if (!canvas || !stage || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* Generative city map, light paper palette */
  var MAP = {
    paper: '#f5f8fc',
    street: '18,44,84',                 /* navy, used at low alpha */
    river: '#dbe4ef',
    riverEdge: 'rgba(18,44,84,0.2)',
    parkFill: 'rgba(61,111,182,0.07)',
    parkEdge: 'rgba(61,111,182,0.18)',
    arterialCase: 'rgba(255,255,255,0.95)',
    arterial: 'rgba(18,44,84,0.2)',
    building: 'rgba(18,44,84,0.05)',
    label: 'rgba(86,101,122,0.9)'
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function riverX(t, w) {
    return w * (0.53 + 0.07 * Math.sin(t * 3.1 + 0.4) + 0.03 * Math.sin(t * 7.3 + 1.2));
  }

  function grid(w, h, angle, step, ox, oy, avenueEvery, alpha) {
    var d = Math.hypot(w, h);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);
    for (var pass = 0; pass < 2; pass++) {
      for (var i = -d; i < d; i += step) {
        var k = Math.round(i / step);
        var avenue = k % avenueEvery === 0;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(' + MAP.street + ',' + (avenue ? alpha * 2.1 : alpha) + ')';
        ctx.lineWidth = avenue ? 1.6 : 1;
        if (pass === 0) { ctx.moveTo(i, -d); ctx.lineTo(i, d); }
        else { ctx.moveTo(-d, i); ctx.lineTo(d, i); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw() {
    var r = stage.getBoundingClientRect();
    var w = Math.max(1, r.width), h = Math.max(1, r.height);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var rand = rng(41);

    ctx.fillStyle = MAP.paper;
    ctx.fillRect(0, 0, w, h);

    var rw = Math.max(26, w * 0.045);
    var left = [], right = [];
    for (var s = 0; s <= 60; s++) {
      var t = s / 60, y = t * h, x = riverX(t, w);
      left.push([x - rw / 2, y]); right.push([x + rw / 2, y]);
    }

    function path(points, close) {
      ctx.beginPath();
      points.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      if (close) ctx.closePath();
    }

    /* West bank: two districts with different grid angles */
    ctx.save();
    path([[0, 0]].concat(left, [[0, h]]), true); ctx.clip();
    grid(w, h, -0.12, 20, 0, 0, 6, 0.07);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, h * 0.62); ctx.lineTo(w * 0.42, h * 0.74); ctx.lineTo(w * 0.5, h); ctx.lineTo(0, h); ctx.closePath(); ctx.clip();
    ctx.fillStyle = MAP.paper; ctx.fillRect(0, 0, w, h);
    grid(w, h, 0.62, 24, w * 0.2, h * 0.8, 5, 0.07);
    ctx.restore();
    ctx.restore();

    /* East bank */
    ctx.save();
    path([[w, 0]].concat(right, [[w, h]]), true); ctx.clip();
    grid(w, h, 0.0, 26, 0, 0, 5, 0.065);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(w * 0.62, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.34); ctx.lineTo(w * 0.7, h * 0.26); ctx.closePath(); ctx.clip();
    ctx.fillStyle = MAP.paper; ctx.fillRect(0, 0, w, h);
    grid(w, h, -0.45, 18, w * 0.8, 0, 7, 0.07);
    ctx.restore();
    ctx.restore();

    /* Parks */
    ctx.fillStyle = MAP.parkFill;
    ctx.strokeStyle = MAP.parkEdge;
    ctx.lineWidth = 1;
    [[0.12, 0.38, 0.1, 0.12], [0.8, 0.44, 0.09, 0.08], [0.3, 0.84, 0.12, 0.07], [0.86, 0.82, 0.08, 0.1]].forEach(function (p) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p[0] * w, p[1] * h, p[2] * w, p[3] * h, 6);
      else ctx.rect(p[0] * w, p[1] * h, p[2] * w, p[3] * h);
      ctx.fill(); ctx.stroke();
    });

    /* River */
    path(left.concat(right.slice().reverse()), true);
    ctx.fillStyle = MAP.river; ctx.fill();
    ctx.strokeStyle = MAP.riverEdge; ctx.lineWidth = 1;
    path(left, false); ctx.stroke();
    path(right, false); ctx.stroke();

    /* Arterials and bridges: white casing, navy core */
    ctx.lineCap = 'round';
    var arterials = [[0.0, 0.52, 0.45, 0.47, 1.0, 0.4], [0.18, 0.0, 0.4, 0.5, 0.36, 1.0], [0.0, 0.18, 0.6, 0.22, 1.0, 0.12], [0.2, 1.0, 0.65, 0.66, 1.0, 0.72]];
    [[MAP.arterialCase, 5], [MAP.arterial, 2.4]].forEach(function (style) {
      ctx.strokeStyle = style[0]; ctx.lineWidth = style[1];
      arterials.forEach(function (a) {
        ctx.beginPath(); ctx.moveTo(a[0] * w, a[1] * h); ctx.quadraticCurveTo(a[2] * w, a[3] * h, a[4] * w, a[5] * h); ctx.stroke();
      });
    });

    /* Sparse building ticks for texture */
    ctx.fillStyle = MAP.building;
    for (var b = 0; b < 140; b++) {
      var bx = rand() * w, by = rand() * h;
      if (Math.abs(bx - riverX(by / h, w)) < rw) continue;
      ctx.fillRect(bx, by, 3 + rand() * 7, 3 + rand() * 5);
    }

    /* District names */
    ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = MAP.label;
    [['Downtown', 0.3, 0.52], ['Riverside', riverX(0.2, 1) + 0.05, 0.18], ['East district', 0.74, 0.5], ['North yards', 0.76, 0.2], ['South end', 0.14, 0.88]].forEach(function (d) {
      ctx.fillText(d[0].toUpperCase(), d[1] * w, d[2] * h);
    });
  }

  draw();
  if ('ResizeObserver' in window) new ResizeObserver(function () { draw(); }).observe(stage);
  else window.addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  /* Loop: markers appear one by one, the alert pins to city hall, holds, then clears and repeats.
     Runs only while the map is on screen and the tab is visible. */
  {
    var items = stage.querySelectorAll('.markers li');
    var card = stage.querySelector('.pin-card');
    var timers = [], running = false, onScreen = true;
    var STEP = 360, HOLD = 5200, CLEAR = 900;
    stage.classList.add('pre');

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stop() {
      timers.forEach(clearTimeout); timers = []; running = false;
    }
    function cycle() {
      running = true;
      items.forEach(function (li) { li.classList.remove('in'); });
      if (card) card.classList.remove('in');
      items.forEach(function (li, i) {
        later(function () { li.classList.add('in'); }, 350 + i * STEP);
      });
      var shown = 350 + items.length * STEP + 250;
      if (card) later(function () { card.classList.add('in'); }, shown);
      later(function () {
        items.forEach(function (li) { li.classList.remove('in'); });
        if (card) card.classList.remove('in');
      }, shown + HOLD);
      later(function () {
        running = false;
        if (onScreen && !document.hidden) cycle();
      }, shown + HOLD + CLEAR);
    }
    function maybeStart() { if (!running && onScreen && !document.hidden) cycle(); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        maybeStart();
      }, { threshold: 0.25 }).observe(stage);
    } else {
      cycle();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else maybeStart();
    });
  }
})();

/* INSI member logo strip (home page only; same list and rotation as the live site).
   No visible control: rotation (a fade) pauses on hover and focus. */
(function () {
  var LOGO_DIR = "assets/sentinel/logos/";
  var M = [
    ["ABC News","abc-news.png","https://abcnews.go.com/"],
    ["AFP","afp.png","https://www.afp.com/en"],
    ["Al Jazeera","aljazeera.png","https://www.aljazeera.com/"],
    ["Al Arabiya","al-arabiya.png","https://english.alarabiya.net"],
    ["The Atlantic","the-atlantic.png","https://www.theatlantic.com/"],
    ["Associated Press","ap.png","https://www.ap.org/en-us/"],
    ["ARD","ard.png","https://www.ard.de/"],
    ["BBC","bbc.png","https://news.bbc.co.uk/"],
    ["Bloomberg","bloomberg.png","https://www.bloomberg.com/"],
    ["Bonnier News","bonnier-corp.png","https://www.bonniercorp.com/"],
    ["Bayerischer Rundfunk","bayerischer-rundfunk.png","https://www.br.de/index.html"],
    ["Business Insider","business-insider.png","https://www.businessinsider.com"],
    ["CBC Canada","cbc-canada.jpg","https://www.cbc.ca/news"],
    ["CBS News","cbs-news.png","https://www.cbsnews.com/"],
    ["Channel 4","channel-4.png","https://www.channel4.com/"],
    ["CNN","cnn.png","https://www.cnn.com/"],
    ["CTV News","ctv-news.jpg","https://www.ctvnews.ca/"],
    ["Deutsche Welle","deutsche-welle.png","https://www.dw.com/"],
    ["EBU","ebu.png","https://www.ebu.ch/"],
    ["Financial Times","financial-times.png","https://www.ft.com/"],
    ["Globo TV","globo-tv.png","https://www.globo.com/"],
    ["The Guardian","the-guardian.png","https://www.guardian.co.uk/"],
    ["Iran International","iran-intl.jpg","https://iranintl.com/"],
    ["ITN","itn.png","https://www.itn.co.uk/"],
    ["NBC","nbc.png","https://www.nbc.com/"],
    ["News UK","news-uk.png","https://www.news.co.uk/"],
    ["The New York Times","new-york-times.png","https://www.nytimes.com/"],
    ["Nikkei","nikkei.jpg","https://www.nikkei.com/"],
    ["NHK","nhk.png","https://www.nhk.or.jp/nhkworld/"],
    ["NOS","nos.png","https://nos.nl/"],
    ["NPR","npr.png","https://www.npr.org/"],
    ["NRK","nrk.png","https://www.nrk.no/"],
    ["Politico","politico.png","https://www.politico.com"],
    ["ProPublica","propublica.jpg","https://www.propublica.org/"],
    ["RTL Nieuws","rtl-nieuws.png","https://www.rtlnieuws.nl/"],
    ["RTE","rte.png","https://www.rte.ie/"],
    ["Reuters","reuters.png","https://www.reuters.com/"],
    ["Schibsted","schibsted.png","https://www.schibsted.com/"],
    ["Sky News","sky-news.png","https://www.sky.com/skynews/home"],
    ["Sveriges Radio","sveriges-radio.png","https://sverigesradio.se/"],
    ["SVT","svt.jpg","https://www.svt.se/"],
    ["TIME","time.png","https://time.com/"],
    ["TV2","tv2.png","https://www.tv2.no/"],
    ["TV4","tv4.png","https://www.tv4.se/"],
    ["VG","vg.png","https://www.vg.no/"],
    ["VRT","vrt.png","https://www.vrt.be/"],
    ["The Washington Post","washington-post.png","https://www.washingtonpost.com"],
    ["The Wall Street Journal","wall-street-journal.png","https://www.wsj.com/"],
    ["WDR","wrd.png","https://www1.wdr.de/index.html"],
    ["ZDF","zdf.png","https://www.zdf.de/"],
    ["YLE","yle.png","https://yle.fi/radio/yleradio1/"],
    ["ABRAJI","abraji.png","https://www.abraji.org.br/"],
    ["BDFJ","bdfj.png","https://www.bdfj.de/"],
    ["CIOJ","ioj.png","https://cioj.org"],
    ["CPJ","cpj.png","https://www.cpj.org/"],
    ["DJV","djv.png","https://www.djv.de/"],
    ["Suomen Journalistiliitto","suomen-journalistiliitto.jpg","https://journalistiliitto.fi/fi/"]
  ];

  var SLOTS = 6, ROTATE_MS = 1100, FADE_MS = 500;
  // Household-name members surface first; the long tail joins the rotation after.
  var TOP = ["BBC","Reuters","Associated Press","CNN","The New York Times","The Guardian",
    "The Washington Post","AFP","Bloomberg","Financial Times","Sky News","NBC","CBS News",
    "ABC News","Al Jazeera","The Wall Street Journal","Deutsche Welle","TIME","Politico","NPR"];
  var strip = document.getElementById("member-strip");
  if (!strip) return;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var all = M.map(function (_, i) { return i; });
  var order = shuffle(all.filter(function (i) { return TOP.indexOf(M[i][0]) !== -1; }))
    .concat(shuffle(all.filter(function (i) { return TOP.indexOf(M[i][0]) === -1; })));
  var picks = order.slice(0, SLOTS);
  var queue = order.slice(SLOTS);
  var slotOrder = shuffle(picks.map(function (_, i) { return i; }));
  var slotPos = 0;

  function fill(anchor, idx) {
    var m = M[idx];
    anchor.href = m[2];
    anchor.title = m[0];
    anchor.setAttribute("aria-label", m[0] + " (opens in a new tab)");
    var img = anchor.querySelector("img");
    img.alt = m[0];
    img.src = LOGO_DIR + m[1];
  }

  var slots = picks.map(function (idx, i) {
    var a = document.createElement("a");
    a.className = "member-slot";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.addEventListener("error", function () {
      // Drop broken logos from rotation and backfill the slot.
      var bad = picks[i];
      console.warn("Member logo failed to load, dropping from rotation:", M[bad][1]);
      queue = queue.filter(function (q) { return q !== bad; });
      var next = queue.shift();
      if (next === undefined) return;
      picks[i] = next;
      fill(a, next);
    });
    a.appendChild(img);
    fill(a, idx);
    strip.appendChild(a);
    return a;
  });

  // Rotation (a fade, no movement) holds while the pointer or focus is on the strip.
  var hover = false;
  strip.addEventListener("mouseenter", function () { hover = true; });
  strip.addEventListener("mouseleave", function () { hover = false; });
  strip.addEventListener("focusin", function () { hover = true; });
  strip.addEventListener("focusout", function () { hover = false; });

  function tick() {
    setTimeout(function () {
      if (hover) { tick(); return; }
      var slot = slotOrder[slotPos];
      slotPos = (slotPos + 1) % slotOrder.length;
      slots[slot].classList.add("is-out");
      setTimeout(function () {
        var next = queue.shift();
        if (next !== undefined) {
          queue.push(picks[slot]);
          picks[slot] = next;
          fill(slots[slot], next);
        }
        slots[slot].classList.remove("is-out");
        tick();
      }, FADE_MS);
    }, ROTATE_MS);
  }
  tick();
})();

/* Sliders (home page): real answers and real briefs. Each
   <div class="slider" data-slider="name" data-interval="ms"> advances on its own
   with a fade (or a sideways slide with data-motion="slide"). With data-arrows it
   gets prev/next buttons that appear on hover or focus. It holds while the pointer or keyboard focus
   is on it, while any <details> inside it is expanded, and while the tab is
   hidden.
   Without this script every card is shown as a plain list. */
(function () {
  var roots = document.querySelectorAll('.slider[data-slider]');
  if (!roots.length) return;
  var DEFAULT_INTERVAL_MS = 6000;

  function initSlider(root) {
    var name = root.getAttribute('data-slider') || root.id || '(unnamed)';
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.dots span'));
    if (!slides.length) {
      console.warn('Slider "' + name + '" has no .slide elements; leaving it as markup.');
      return;
    }
    if (!root.querySelector('.dots')) {
      console.warn('Slider "' + name + '" has no .dots element; slides will advance without dots.');
    } else if (dots.length !== slides.length) {
      console.warn('Slider "' + name + '": ' + dots.length + ' dots for ' + slides.length + ' slides; dots will not match.');
    }
    var interval = parseInt(root.getAttribute('data-interval'), 10);
    if (!(interval > 0)) {
      console.warn('Slider "' + name + '" has no valid data-interval; using ' + DEFAULT_INTERVAL_MS + ' ms.');
      interval = DEFAULT_INTERVAL_MS;
    }

    var current = 0, timer = null, hover = false, focus = false, inView = true;
    var WORD_MS = 200, MAX_MS = 10000; // enough to read the lead at a skim; hovering holds it for longer
    var live = root.querySelector('.slides');

    function expanded() { return !!slides[current].querySelector('details[open]'); }
    function held() { return hover || focus || expanded() || document.hidden || !inView; }

    // Time on a slide scales with its question and lead answer; data-interval is the floor.
    function dwell() {
      var s = slides[current];
      var text = ['.q', '.a'].map(function (sel) {
        var el = s.querySelector(sel); return el ? el.textContent : '';
      }).join(' ').trim();
      var words = text ? text.split(/\s+/).length : 0;
      return Math.min(MAX_MS, Math.max(interval, words * WORD_MS));
    }

    // dir: 1 = forward (new slide comes in from the right), -1 = back.
    function show(n, dir) {
      root.classList.toggle('go-prev', dir === -1);
      var prev = current;
      current = n;
      slides.forEach(function (s, i) {
        var on = i === n;
        s.classList.toggle('is-active', on);
        s.classList.toggle('is-leaving', !on && i === prev && prev !== n);
        s.setAttribute('aria-hidden', String(!on));
        // A slide that leaves closes its "Read more", so the slider does not stay held.
        if (!on) Array.prototype.forEach.call(s.querySelectorAll('details[open]'), function (d) { d.open = false; });
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === n); });
    }

    function step(dir) {
      var wasOpen = expanded();
      show((current + dir + slides.length) % slides.length, dir);
      // Closing a long "Read more" shrinks the page; bring the slider back into view.
      if (wasOpen && root.getBoundingClientRect().top < 0) {
        root.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }

    // Optional prev/next arrows (data-arrows): shown on hover or keyboard focus.
    if (root.hasAttribute('data-arrows') && slides.length > 1) {
      [['prev', -1, 'Previous example', '‹'], ['next', 1, 'Next example', '›']].forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slider-arrow slider-arrow--' + a[0];
        b.setAttribute('aria-label', a[2]);
        b.textContent = a[3];
        b.addEventListener('click', function () { step(a[1]); schedule(); });
        root.appendChild(b);
      });
    }

    function stop() { if (timer) { clearTimeout(timer); timer = null; } }

    // The active dot fills over the slide's time (--dwell); .is-held freezes it.
    function syncHeld() { root.classList.toggle('is-held', held()); }

    function schedule() {
      stop();
      syncHeld();
      if (slides.length < 2) return;
      var ms = dwell();
      root.style.setProperty('--dwell', ms + 'ms');
      // Restart the active dot's fill so it matches the new timer.
      var dot = dots[current];
      if (dot) { dot.classList.remove('is-active'); void dot.offsetWidth; dot.classList.add('is-active'); }
      timer = setTimeout(function () {
        if (!held()) step(1);
        schedule();
      }, ms);
    }

    root.addEventListener('mouseenter', function () { hover = true; syncHeld(); });
    root.addEventListener('mouseleave', function () { hover = false; syncHeld(); });
    // Only keyboard focus holds it: a mouse click on an arrow should not pause it for good.
    root.addEventListener('focusin', function () {
      focus = root.matches(':focus-visible') || !!root.querySelector(':focus-visible');
      if (live) live.setAttribute('aria-live', 'polite');
      syncHeld();
    });
    root.addEventListener('focusout', function () {
      focus = false;
      if (live) live.setAttribute('aria-live', 'off');
      syncHeld();
    });
    root.addEventListener('keydown', function (e) {
      if (e.target !== root) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); schedule(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); schedule(); }
    });
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { step(dx < 0 ? 1 : -1); schedule(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var was = inView;
        inView = entries[0].isIntersecting;
        // Coming into view starts the current slide's time afresh.
        if (inView && !was) schedule(); else syncHeld();
      }, { threshold: 0.4 }).observe(root);
    }
    if (live) live.setAttribute('aria-live', 'off');
    // Collapsing a brief restarts the full interval so the reader is not cut off.
    root.addEventListener('toggle', function () { if (!expanded()) schedule(); }, true);

    show(0);
    root.classList.add('is-ready');
    schedule();
  }

  Array.prototype.forEach.call(roots, initSlider);
})();

/* Demo (home page): an animated walk through the app, played the way the app
   plays a run. A question is typed into Ask Sentinel; each lookup lands as a
   one-line card under the live stage line; the answer streams as a grey draft
   and is replaced by the checked answer, which the thread then reads through;
   the cards fold into "How I got here". A second question proposes a beat,
   the card is accepted, and the view cuts to the beat page, where Generate
   brief runs its own lookups and the brief is read through.
   Runs only while on screen and the tab is visible, and holds while the
   pointer is over it (the text can then be scrolled by hand). */
(function () {
  var root = document.querySelector('[data-demo]');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var frame = $('.demo-frame');
  var thread = $('.demo-thread');
  var body = $('.demo-body');
  var composer = $('.demo-composer');
  var typed = $('.demo-typed');
  var send = $('.demo-send');
  var q1 = $('[data-q="1"]'), q2 = $('[data-q="2"]');
  var run1 = $('[data-run="1"]'), run2 = $('[data-run="2"]'), runBrief = $('[data-run="brief"]');
  var ans1 = $('[data-answer="1"]'), ans2 = $('[data-answer="2"]');
  var card = $('.demo-card');
  var yes = $('.demo-yes');
  var view = $('.demo-view');
  var gen = $('.demo-gen');
  var brief = $('.demo-brief');
  var cursor = $('.demo-cursor');
  var parts = [frame, thread, body, composer, typed, send, q1, q2, run1, run2, runBrief, ans1, ans2, card, yes, view, gen, brief, cursor];
  if (parts.some(function (el) { return !el; })) {
    console.warn('demo: markup incomplete, animation not started');
    return;
  }
  var draft = ans1.querySelector('.demo-draft');
  var md1 = ans1.querySelector('.demo-md');
  var DRAFT = [].slice.call(md1.children, 0, 4).map(function (el) { return el.textContent.replace(/\s+/g, ' ').trim(); }).join(' ');

  var pb = playback(frame, cursor);
  var wait = pb.wait, seq = pb.seq, pause = pb.pause, act = pb.act, show = pb.show;
  var moveTo = pb.moveTo, click = pb.click, parkCursor = pb.parkCursor;

  function toBottom(box) { box.scrollTop = box.scrollHeight; }
  /* Glide a scroll box to `target` at an even reading pace. */
  function glide(box, target, pxPerSec, maxMs) {
    return function (next) {
      var from = box.scrollTop, dist = Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight) - from);
      if (dist < 2) { next(); return; }
      var ms = Math.min(maxMs, dist / pxPerSec * 1000), t = 0, STEP = 40;
      (function tick() {
        t += STEP;
        box.scrollTop = from + dist * Math.min(1, t / ms);
        if (t < ms) wait(STEP, tick); else next();
      })();
    };
  }
  function readThrough(box, el, maxMs) {
    return function (next) {
      box.scrollTop = Math.max(0, el.offsetTop - box.offsetTop - 12);
      seq([pause(1400), glide(box, box.scrollHeight, 170, maxMs || 10000)], next);
    };
  }

  function type(text) {
    return function (next) {
      var i = 0;
      composer.classList.add('is-typing', 'has-text');
      (function tick() {
        typed.textContent = text.slice(0, ++i);
        if (i < text.length) wait(text.charAt(i) === ' ' ? 60 : 32, tick);
        else { composer.classList.remove('is-typing'); next(); }
      })();
    };
  }
  function sendAs(q) {
    return function (next) {
      send.classList.add('is-press');
      wait(160, function () {
        send.classList.remove('is-press');
        composer.classList.remove('has-text'); typed.textContent = '';
        show(q); toBottom(thread);
        next();
      });
    };
  }

  function clockText(sec) {
    return sec < 60 ? sec + 's' : Math.floor(sec / 60) + 'm ' + ('0' + sec % 60).slice(-2) + 's';
  }
  /* A run: the stage line names the step in progress; when it finishes it
     lands as a card above the line. `last` is the closing stage. */
  function runSteps(run, box, perStep, last) {
    return function (next) {
      var stage = run.querySelector('.demo-stage');
      var txt = stage.querySelector('.txt'), clock = stage.querySelector('.clock');
      var finds = [].slice.call(run.querySelectorAll('.demo-finds li'));
      var clocks = (run.getAttribute('data-clock') || '0').split(',').map(Number);
      var k = 0;
      show(run); show(stage);
      function at(i) { clock.textContent = clockText(clocks[Math.min(i, clocks.length - 1)]); }
      (function tick() {
        if (k < finds.length) {
          txt.textContent = finds[k].getAttribute('data-active');
          at(k); toBottom(box);
          wait(perStep, function () { show(finds[k]); k++; toBottom(box); tick(); });
        } else {
          txt.textContent = last; at(k); toBottom(box);
          wait(500, next);
        }
      })();
    };
  }
  function fold(run) { run.classList.add('is-folded'); run.querySelector('.demo-stage').classList.remove('in'); }

  function streamDraft(next) {
    var words = DRAFT.split(' '), n = 0;
    ans1.classList.add('is-draft');
    show(ans1);
    (function tick() {
      n += 6;
      draft.textContent = words.slice(0, n).join(' ');
      toBottom(thread);
      if (n < words.length) wait(40, tick); else next();
    })();
  }

  function reset() {
    frame.setAttribute('data-scene', 'ask');
    root.querySelectorAll('.in').forEach(function (el) { if (el !== cursor) el.classList.remove('in'); });
    [run1, runBrief].forEach(function (r) { r.classList.remove('is-folded'); });
    ans1.classList.remove('is-draft');
    draft.textContent = '';
    card.classList.remove('is-done');
    gen.classList.remove('is-busy');
    composer.classList.remove('is-typing', 'has-text');
    typed.textContent = '';
    thread.scrollTop = 0; body.scrollTop = 0;
    parkCursor();
  }

  function loop() {
    reset();
    frame.classList.remove('is-fading');
    seq([
      /* Ask Sentinel: the question, the lookups, the answer */
      pause(800), type(q1.textContent), sendAs(q1), pause(500),
      runSteps(run1, thread, 320, 'Writing the answer'),
      streamDraft,
      act(function () { fold(run1); ans1.classList.remove('is-draft'); }),
      readThrough(thread, ans1), pause(1500),

      /* A beat from the conversation */
      type(q2.textContent), sendAs(q2), pause(400),
      runSteps(run2, thread, 0, 'Proposing a beat'),
      act(function () { run2.classList.remove('in'); show(ans2); toBottom(thread); }), pause(700),
      act(function () { show(card); toBottom(thread); }), pause(1500),
      moveTo(yes), click(yes), act(function () { card.classList.add('is-done'); }), pause(1000),
      moveTo(view), click(view), pause(250),

      /* The beat page: Generate brief, its lookups, the brief */
      act(function () { parkCursor(); frame.setAttribute('data-scene', 'beat'); }), pause(1200),
      moveTo(gen), click(gen), act(function () { gen.classList.add('is-busy'); }), pause(300),
      act(parkCursor),
      runSteps(runBrief, body, 180, 'Checking citations'),
      act(function () { fold(runBrief); gen.classList.remove('is-busy'); show(brief); }),
      readThrough(body, brief, 15000), pause(3000),
      act(function () { frame.classList.add('is-fading'); }), pause(500)
    ], loop);
  }

  root.classList.add('is-live');
  pb.play(loop);
})();

/* Map tour (home page): the pointer hovers Pennsylvania on the national map
   and its hover card opens; a click zooms into Philadelphia, landing on the
   county view, where three counties' cards open in turn; then back out. The
   cards carry the figures in the screenshots. Shares the demo's playback, so
   it runs only on screen and holds while the visitor's pointer is over it,
   when the rings answer their own hover. */
(function () {
  var root = document.querySelector('[data-maptour]');
  if (!root) return;
  var stage = root.querySelector('.mt-stage');
  var cursor = root.querySelector('.demo-cursor');
  var KEYS = ['pa', 'bucks', 'montgomery', 'delaware'];
  var spots = {}, cards = {};
  KEYS.forEach(function (k) {
    spots[k] = root.querySelector('.mt-spot[data-card="' + k + '"]');
    cards[k] = root.querySelector('#mt-' + k);
  });
  if (!stage || !cursor || KEYS.some(function (k) { return !spots[k] || !cards[k]; })) {
    console.warn('map tour: markup incomplete, tour not started');
    return;
  }

  function hide() {
    KEYS.forEach(function (k) { cards[k].classList.remove('in'); spots[k].classList.remove('is-on'); });
  }
  /* The card opens beside its ring, flipped left near the right edge. */
  function place(k) {
    var c = cards[k], s = spots[k];
    var f = stage.getBoundingClientRect(), r = s.getBoundingClientRect();
    var x = r.left - f.left + r.width / 2, y = r.top - f.top + r.height / 2;
    hide();
    c.classList.add('in'); s.classList.add('is-on');
    var w = c.offsetWidth, h = c.offsetHeight;
    var left = x + 20 + w > f.width - 8 ? x - 20 - w : x + 20;
    c.style.left = Math.max(8, left) + 'px';
    c.style.top = Math.min(Math.max(8, y - h / 2), f.height - h - 8) + 'px';
  }

  var pb = playback(stage, cursor);
  KEYS.forEach(function (k) {
    spots[k].addEventListener('mouseenter', function () {
      if (stage.classList.contains('is-held')) place(k);
    });
    spots[k].addEventListener('mouseleave', hide);
  });
  stage.addEventListener('mouseenter', function () { hide(); pb.parkCursor(); });

  function hover(k) {
    return function (next) {
      pb.seq([pb.moveTo(spots[k]), pb.act(function () { place(k); }), pb.pause(2800), pb.act(hide), pb.pause(300)], next);
    };
  }
  function loop() {
    hide(); pb.parkCursor();
    stage.classList.remove('is-zoomed');
    pb.seq([
      pb.pause(1500),
      pb.moveTo(spots.pa), pb.act(function () { place('pa'); }), pb.pause(2200),
      pb.click(spots.pa), pb.act(function () { hide(); pb.parkCursor(); stage.classList.add('is-zoomed'); }), pb.pause(2600),
      hover('bucks'), hover('montgomery'), hover('delaware'),
      pb.act(function () { pb.parkCursor(); stage.classList.remove('is-zoomed'); }), pb.pause(2800)
    ], loop);
  }
  pb.play(loop);
})();

/* Scroll reveals (home page). Any [data-reveal] element is armed (its start
   state applied) and gets .is-in the first time 35% of it is on screen. CSS
   owns the animation. */
(function () {
  var els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    console.warn('IntersectionObserver unavailable; reveals show their final state.');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.35 });
  Array.prototype.forEach.call(els, function (el) {
    el.classList.add('is-armed');
    io.observe(el);
  });
})();
