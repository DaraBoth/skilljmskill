// Save as Markdown, inlined into index.html by build-page.mjs. Reads the project name and file
// slug from data-map-name and data-map-slug on <html>; in the single file, diagrams come from
// window.MAP_DIAGRAMS, otherwise from diagrams/<name>-map-<lang>.html.
(function () {
  // Save as Markdown: the open tab or the whole document, in the language on screen. Diagrams
  // become a list of their boxes with each box's explanation and code links.
  var root = document.documentElement;
  var slug = root.getAttribute('data-map-slug') || 'project';
  var mapName = root.getAttribute('data-map-name') || 'project';
  var status = document.getElementById('md-status');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-md]'));
  var downloads = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').catch(function () { return null; })
    : null;

  var WORDS = {
    en: { working: 'Preparing the file...', saved: 'Saved.', started: 'Download started.', declined: 'Not saved.',
      busy: 'Another save is open. Try again in a moment.', failed: 'This view cannot save files.',
      diagram: 'Diagram', contents: 'Contents', source: 'Exported from the {name} system map',
      code: 'Code' },
    ko: { working: '파일을 만드는 중이에요...', saved: '저장했어요.', started: '내려받기를 시작했어요.', declined: '저장하지 않았어요.',
      busy: '다른 저장 창이 열려 있어요. 잠시 뒤 다시 해 보세요.', failed: '이 화면에서는 파일을 저장할 수 없어요.',
      diagram: '그림', contents: '목차', source: '{name} 시스템 지도에서 내보냈어요',
      code: '코드' },
  };

  function lang() { return root.getAttribute('data-ui') === 'en' ? 'en' : 'ko'; }
  function say(key) { status.textContent = (WORDS[lang()][key] || '').replace('{name}', mapName); }
  function repeat(ch, n) { return new Array(n + 1).join(ch); }
  function text(s) { return String(s).replace(/\s+/g, ' ').replace(/([\\`*<\[\]])/g, '\\$1'); }

  var BLOCK = /^(P|DIV|SECTION|ARTICLE|FIGURE|UL|OL|LI|TABLE|PRE|H[1-6]|IFRAME|DETAILS|SUMMARY|DL|BLOCKQUOTE|HEADER|FOOTER|ASIDE)$/;

  function shown(el) {
    if (el.nodeType !== 1) return true;
    if (el.classList.contains(lang() === 'en' ? 'ko' : 'en')) return false;
    var tag = el.tagName.toUpperCase();
    if (tag === 'BUTTON' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'TEMPLATE') return false;
    if (tag === 'A' && el.hasAttribute('data-full')) return false;
    return true;
  }

  function hasBlock(el) {
    for (var i = 0; i < el.children.length; i++) {
      var c = el.children[i];
      if (!shown(c)) continue;
      if (BLOCK.test(c.tagName.toUpperCase()) || hasBlock(c)) return true;
    }
    return false;
  }

  function inline(nodes) {
    var out = '';
    Array.prototype.forEach.call(nodes, function (c) {
      if (c.nodeType === 3) { out += text(c.nodeValue); return; }
      if (c.nodeType !== 1 || !shown(c)) return;
      var tag = c.tagName.toUpperCase();
      if (tag === 'CODE') {
        var v = c.textContent.replace(/\s+/g, ' ');
        out += v.indexOf('`') >= 0 ? '`` ' + v + ' ``' : '`' + v + '`';
        return;
      }
      var inner = inline(c.childNodes).replace(/^\s+|\s+$/g, '');
      if (!inner) return;
      if (tag === 'STRONG' || tag === 'B') out += '**' + inner + '**';
      else if (tag === 'EM' || tag === 'I') out += '_' + inner + '_';
      else if (tag === 'A') {
        var href = c.getAttribute('href') || '';
        out += /^https?:/.test(href) ? '[' + inner + '](' + href + ')' : inner;
      } else if (tag === 'BR') out += ' ';
      else if (BLOCK.test(tag)) out += ' ' + inner + ' ';
      else out += inner;
    });
    return out;
  }

  function line(nodes) { return inline(nodes).replace(/\s+/g, ' ').replace(/^ | $/g, ''); }

  function list(el, ordered, indent) {
    var lines = [];
    var n = 0;
    Array.prototype.forEach.call(el.children, function (li) {
      if (li.tagName.toUpperCase() !== 'LI' || !shown(li)) return;
      var own = [];
      var subs = [];
      Array.prototype.forEach.call(li.childNodes, function (c) {
        var tag = c.nodeType === 1 ? c.tagName.toUpperCase() : '';
        if ((tag === 'UL' || tag === 'OL') && shown(c)) subs.push(list(c, tag === 'OL', indent + (ordered ? '   ' : '  ')));
        else own.push(c);
      });
      var body = line(own);
      if (!body && !subs.length) return;
      n++;
      lines.push(indent + (ordered ? n + '. ' : '- ') + body);
      subs.forEach(function (s) { if (s) lines.push(s); });
    });
    return lines.join('\n');
  }

  function table(t) {
    var rows = Array.prototype.filter.call(t.querySelectorAll('tr'), shown);
    var lines = [];
    var width = 0;
    rows.forEach(function (tr) {
      var cells = Array.prototype.filter.call(tr.children, function (c) {
        var tag = c.tagName.toUpperCase();
        return (tag === 'TD' || tag === 'TH') && shown(c);
      }).map(function (c) { return line(c.childNodes).replace(/\|/g, '\\|') || ' '; });
      if (!cells.length) return;
      if (!lines.length) width = cells.length;
      while (cells.length < width) cells.push(' ');
      lines.push('| ' + cells.join(' | ') + ' |');
      if (lines.length === 1) lines.push('|' + cells.map(function () { return ' --- '; }).join('|') + '|');
    });
    return lines.join('\n');
  }

  // Walks a container and pushes Markdown blocks; a diagram is pushed as {diagram: name}.
  function walk(el, shift, out) {
    Array.prototype.forEach.call(el.childNodes, function (c) {
      if (c.nodeType === 3) { var s = text(c.nodeValue).trim(); if (s) out.push(s); return; }
      if (c.nodeType !== 1 || !shown(c)) return;
      var tag = c.tagName.toUpperCase();
      if (c.classList.contains('tab-title')) return;
      var h = /^H([1-6])$/.exec(tag);
      if (h) { var head = line(c.childNodes); if (head) out.push(repeat('#', Math.min(6, Number(h[1]) + shift)) + ' ' + head); return; }
      if (tag === 'UL' || tag === 'OL') { var l = list(c, tag === 'OL', ''); if (l) out.push(l); return; }
      if (tag === 'TABLE') { var t = table(c); if (t) out.push(t); return; }
      if (tag === 'PRE') { out.push('```\n' + c.textContent.replace(/\n+$/, '') + '\n```'); return; }
      if (tag === 'IFRAME') { if (c.hasAttribute('data-diagram')) out.push({ diagram: c.getAttribute('data-diagram') }); return; }
      if (tag === 'DL') {
        var term = '';
        Array.prototype.forEach.call(c.children, function (d) {
          if (!shown(d)) return;
          if (d.tagName.toUpperCase() === 'DT') term = line(d.childNodes);
          else if (d.tagName.toUpperCase() === 'DD') out.push('- **' + term + '**: ' + line(d.childNodes));
        });
        return;
      }
      if (c.classList.contains('cap')) { var cap = line(c.childNodes); if (cap) out.push('_' + cap + '_'); return; }
      if (hasBlock(c)) { walk(c, shift, out); return; }
      var p = line(c.childNodes);
      if (p) out.push(tag === 'SUMMARY' ? '**' + p + '**' : p);
    });
  }

  function diagramHtml(name) {
    var key = name + '-map-' + lang();
    if (window.MAP_DIAGRAMS) return Promise.resolve(window.MAP_DIAGRAMS[key] || '');
    return fetch('diagrams/' + key + '.html')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .catch(function () { return ''; });
  }

  function diagram(name, level) {
    var w = WORDS[lang()];
    return diagramHtml(name).then(function (html) {
      if (!html) return '';
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var h1 = doc.querySelector('h1');
      var sub = doc.querySelector('.subtitle');
      var lines = [repeat('#', level) + ' ' + w.diagram + ': ' + text(h1 ? h1.textContent.trim() : name)];
      if (sub) lines.push('', text(sub.textContent.trim()));
      var m = /var D = (\{.*\});\n/.exec(html);
      var data = null;
      try { data = m ? JSON.parse(m[1]) : null; } catch (e) { data = null; }
      if (data && data.nodes) {
        lines.push('');
        Object.keys(data.nodes).forEach(function (id) {
          var n = data.nodes[id];
          if (!n.label) return;
          lines.push('- **' + text(n.label) + '**' + (n.sub ? ' (' + text(n.sub) + ')' : '') + (n.about ? ': ' + text(n.about) : ''));
          (n.src || []).forEach(function (s) {
            var at = s.name.indexOf(':') >= 0 ? ':' + s.name.split(':').pop() : '';
            lines.push('  - ' + w.code + ': [`' + s.path + at + '`](' + s.href + ')' + (s.text ? ' ' + text(s.text) : ''));
          });
        });
      }
      return lines.join('\n');
    });
  }

  function tabMarkdown(panel, level) {
    var label = document.getElementById('tab-' + panel.id);
    var parts = [];
    walk(panel, level - 1, parts);
    return Promise.all(parts.map(function (p) {
      return typeof p === 'string' ? p : diagram(p.diagram, level + 1);
    })).then(function (done) {
      var head = repeat('#', level) + ' ' + line(label ? label.childNodes : []);
      return [head].concat(done.filter(Boolean)).join('\n\n');
    });
  }

  function headerMarkdown() {
    var top = document.querySelector('header.top .top-main');
    var w = WORDS[lang()];
    var pick = function (sel) {
      return Array.prototype.filter.call(top.querySelectorAll(sel), shown).map(function (el) { return line(el.childNodes); }).filter(Boolean);
    };
    var out = ['# ' + pick('h1').join(' ')];
    out = out.concat(pick('.eyebrow'), pick('.summary'), pick('.dates'));
    var stats = Array.prototype.map.call(top.querySelectorAll('.stats li'), function (li) {
      var n = li.querySelector('strong');
      var label = Array.prototype.filter.call(li.children, function (c) { return c !== n && shown(c); }).map(function (c) { return c.textContent.trim(); }).join(' ');
      return (n ? n.textContent.trim() + ' ' : '') + label;
    });
    if (stats.length) out.push(stats.join(' · '));
    out.push('_' + w.source.replace('{name}', mapName) + '._');
    return out;
  }

  function contents() {
    var w = WORDS[lang()];
    var lines = ['## ' + w.contents];
    Array.prototype.forEach.call(document.querySelectorAll('nav.side .grp, nav.side [role="tab"]'), function (el) {
      if (el.classList.contains('grp')) lines.push('- ' + line(el.childNodes));
      else lines.push('  - ' + line(el.childNodes));
    });
    return lines.join('\n');
  }

  function build(scope) {
    var panels = Array.prototype.slice.call(document.querySelectorAll('section.panel[role="tabpanel"]'));
    if (scope === 'tab') {
      var open = panels.filter(function (p) { return !p.hidden; })[0] || panels[0];
      return tabMarkdown(open, 1).then(function (body) {
        return { name: slug + '-system-map-' + open.id + '-' + lang() + '.md', text: body + '\n' };
      });
    }
    return Promise.all(panels.map(function (p) { return tabMarkdown(p, 2); })).then(function (tabs) {
      var head = headerMarkdown();
      return { name: slug + '-system-map-' + lang() + '.md', text: head.concat([contents()], tabs).join('\n\n') + '\n' };
    });
  }

  function fallback(file) {
    try {
      var url = URL.createObjectURL(new Blob([file.text], { type: 'text/markdown;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      say('started');
    } catch (e) {
      say('failed');
    }
  }

  function save(file) {
    if (!downloads) { fallback(file); return Promise.resolve(); }
    return downloads.then(function (dl) {
      if (!dl) { fallback(file); return; }
      return dl.save({ filename: file.name, data: file.text }).then(function () { say('saved'); }, function (err) {
        var code = err && err.code;
        if (code === 'declined') say('declined');
        else if (code === 'rate_limited') say('busy');
        else say('failed');
      });
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      buttons.forEach(function (x) { x.disabled = true; });
      say('working');
      build(b.getAttribute('data-md'))
        .then(save)
        .catch(function () { say('failed'); })
        .then(function () { buttons.forEach(function (x) { x.disabled = false; }); });
    });
  });

  window.MAP_MARKDOWN = build;
})();
