/* SkillJM Skill site. Plain JavaScript, no libraries. */
(function () {
  var SITE = 'https://daraboth.github.io/skilljmskill';
  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var live = $('#live');
  function say(t) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); } }

  /* GitHub star count (cached for an hour; the button works without it) */
  (function () {
    var els = $$('[data-stars]'); if (!els.length) return;
    function show(n) {
      if (typeof n !== 'number') return;
      var t = n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
      els.forEach(function (e) { e.textContent = t; e.hidden = false; });
    }
    var c = null; try { c = JSON.parse(store.get('sjm-stars') || 'null'); } catch (e) {}
    if (c) show(c.n);
    if (c && Date.now() - c.t < 36e5) return;
    if (!window.fetch) return;
    fetch('https://api.github.com/repos/DaraBoth/skilljmskill').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.stargazers_count === 'number') { show(d.stargazers_count); store.set('sjm-stars', JSON.stringify({ n: d.stargazers_count, t: Date.now() })); } })
      .catch(function () {});
  })();

  /* Light or dark */
  $$('.theme').forEach(function (b) {
    b.addEventListener('click', function () {
      var dark = doc.dataset.theme ? doc.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      doc.dataset.theme = dark ? 'light' : 'dark';
      store.set('sjm-theme', doc.dataset.theme);
      say(dark ? 'Light mode' : 'Dark mode');
    });
  });

  /* Windows or Mac / Linux. Phones default to Windows: most students install on a Windows laptop. */
  var ua = navigator.userAgent;
  var os = store.get('sjm-os') || (/Macintosh|Mac OS X|Linux|X11/.test(ua) && !/Android|iPhone|iPad/.test(ua) ? 'nix' : 'win');
  function showOs() {
    $$('.os button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.os === os)); });
    $$('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== os; });
    render();
  }
  $$('.os button').forEach(function (b) {
    b.addEventListener('click', function () { os = b.dataset.os; store.set('sjm-os', os); showOs(); });
  });

  function command(names) {
    if (os === 'win') {
      return names.length ? '& ([scriptblock]::Create((irm ' + SITE + '/install.ps1))) --skills ' + names.join(',')
                          : 'irm ' + SITE + '/install.ps1 | iex';
    }
    return 'curl -fsSL ' + SITE + '/install.sh | sh' + (names.length ? ' -s -- --skills ' + names.join(',') : '');
  }

  /* Copy buttons */
  $$('.copy').forEach(function (b) {
    var label = b.querySelector('span');
    b.addEventListener('click', function () {
      var text = document.getElementById(b.dataset.copy).textContent;
      var done = function () {
        b.setAttribute('data-done', '');
        label.textContent = 'Copied';
        say('Copied. Paste it in your terminal.');
        clearTimeout(b._t);
        b._t = setTimeout(function () { b.removeAttribute('data-done'); label.textContent = 'Copy'; }, 1800);
      };
      var fallback = function () {
        var r = document.createRange(), code = document.getElementById(b.dataset.copy);
        r.selectNodeContents(code);
        var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        if (ok) done(); else { label.textContent = 'Selected: copy it'; say('The command is selected. Copy it with your keyboard.'); }
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });

  /* Picked skills, shared between the overview and the skill pages */
  var picked = (store.get('sjm-picks') || '').split(',').filter(Boolean);
  var known = $$('.punch').map(function (b) { return b.dataset.name; });
  if (known.length) picked = picked.filter(function (n) { return known.indexOf(n) >= 0; });
  function savePicks() { store.set('sjm-picks', picked.join(',')); }

  function toggle(name) {
    var i = picked.indexOf(name);
    if (i < 0) picked.push(name); else picked.splice(i, 1);
    savePicks();
    render();
    say(i < 0 ? name + ' added. ' + picked.length + ' in your command.' : name + ' removed. ' + picked.length + ' in your command.');
    return i < 0;
  }

  $$('.punch, .add').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = toggle(b.dataset.name);
      if (on && b.classList.contains('punch')) {
        b.classList.remove('just'); void b.offsetWidth; b.classList.add('just');
      }
    });
  });

  var tray = $('#tray');
  if (tray) tray.hidden = false;
  function render() {
    var all = $('#cmd-all');
    if (all) all.textContent = command([]);
    $$('.punch, .add').forEach(function (b) {
      var on = picked.indexOf(b.dataset.name) >= 0;
      b.setAttribute('aria-pressed', String(on));
      if (b.classList.contains('punch')) {
        b.setAttribute('aria-label', (on ? 'Remove ' : 'Add ') + b.dataset.name + (on ? ' from' : ' to') + ' my install command');
        b.closest('.row').classList.toggle('is-picked', on);
      }
    });
    if (!tray) return;
    $('#cmd-pick').textContent = command(picked);
    $('#tray-n').textContent = picked.length + (picked.length === 1 ? ' skill' : ' skills');
    var on = picked.length > 0;
    tray.classList.toggle('on', on);
    document.body.classList.toggle('has-tray', on);
    if (on) document.body.style.setProperty('--tray-h', tray.offsetHeight + 'px');
  }
  var clear = $('#tray-clear');
  if (clear) clear.addEventListener('click', function () {
    picked = []; savePicks(); render(); say('Your list is empty.');
    var q = $('#q'); if (q) q.focus();
  });
  addEventListener('resize', function () { if (tray && picked.length) document.body.style.setProperty('--tray-h', tray.offsetHeight + 'px'); });

  /* Search */
  var q = $('#q');
  if (q) {
    var rows = $$('.row'), groups = $$('.group'), count = $('#count'), empty = $('#empty'), total = rows.length;
    var filter = function () {
      var words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean), shown = 0;
      rows.forEach(function (r) {
        var hay = r.getAttribute('data-search');
        var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
        r.hidden = !ok; if (ok) shown++;
      });
      groups.forEach(function (g) { g.hidden = !$$('.row', g).some(function (r) { return !r.hidden; }); });
      $('.routes').hidden = words.length > 0;
      count.textContent = words.length ? shown + ' of ' + total + ' skills' : total + ' skills';
      empty.hidden = shown > 0;
      $('#empty-q').textContent = q.value.trim();
    };
    q.addEventListener('input', filter);
    $('#clear-q').addEventListener('click', function () { q.value = ''; filter(); q.focus(); });
    addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
    if (q.value) filter();
  }

  showOs();
})();
