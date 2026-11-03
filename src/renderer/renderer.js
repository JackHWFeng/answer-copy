/** 渲染进程：界面、状态、持久化、复制、清空、置顶开关、Ctrl+Enter
 *  视觉换皮 v2（Book）：行状态用 .is-filled / .is-missing（兼容 .disabled），自动高度 fitRow，滚动渐隐。
 */
(function () {
  'use strict';

  var listEl = document.getElementById('list');
  var listWrap = document.getElementById('list-wrap');
  var badgeEl = document.getElementById('badge');
  var copyBtn = document.getElementById('copyBtn');
  var clearBtn = document.getElementById('clearBtn');
  var statusEl = document.getElementById('status');
  var pinBtn = document.getElementById('pinBtn');
  var newNameEl = document.getElementById('newName');
  var addBtn = document.getElementById('addBtn');

  var items = [];
  var alwaysOnTop = true;
  var saveTimer = null;
  var statusTimer = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { window.api.saveState(items); } catch (e) { /* ignore */ }
    }, 150);
  }

  function showStatus(text, isError, ms) {
    statusEl.textContent = text;
    statusEl.classList.toggle('is-error', !!isError);
    statusEl.classList.add('show');
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      statusEl.classList.remove('show');
      statusEl.classList.remove('is-error');
    }, ms || 1800);
  }

  /* 列表是否可滚动：只在真正可滚动时显示底部渐隐 */
  function updateScrollState() {
    if (!listWrap) return;
    listWrap.classList.toggle('is-scrollable', listEl.scrollHeight > listEl.clientHeight + 1);
  }

  /* 高度策略：默认 5 格等分；内容超出可见高度时该格伸展（上限 168px），列表滚动 */
  function fitRow(row, ta) {
    var MAX = 168;
    row.classList.remove('row--grow');
    ta.style.height = '';
    var need = ta.scrollHeight;
    var avail = ta.clientHeight;
    if (need > avail + 2) {
      row.classList.add('row--grow');
      ta.style.height = Math.min(need, MAX) + 'px';
      ta.style.overflowY = need > MAX ? 'auto' : 'hidden';
    } else {
      ta.style.overflowY = 'auto';
    }
    updateScrollState();
  }

  function render() {
    listEl.innerHTML = '';

    if (items.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.innerHTML = '还没有格子<br><span>在下面输入你的 Agent 名字，回车即可添加</span>';
      listEl.appendChild(empty);
      badgeEl.textContent = '0 个';
      updateScrollState();
      requestAnimationFrame(updateScrollState);
      return;
    }

    items.forEach(function (item, i) {
      var hasText = item.text.trim().length > 0;

      var row = document.createElement('div');
      row.className = 'row' + (hasText ? ' is-filled' : '');

      var head = document.createElement('div');
      head.className = 'row-head';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!item.checked;
      cb.setAttribute('aria-label', item.name);
      cb.addEventListener('change', function () {
        items[i].checked = cb.checked;
        scheduleSave();
      });

      var label = document.createElement('span');
      label.className = 'label';
      label.innerHTML = escapeHtml(item.name) + '<span class="suffix">回复：</span>';

      var dot = document.createElement('span');
      dot.className = 'filled-dot' + (hasText ? ' show' : '');
      dot.setAttribute('aria-hidden', 'true');

      /* 行操作：改名 / 删除（悬停才显示，避免干扰视线） */
      var actions = document.createElement('span');
      actions.className = 'row-actions';

      var renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'row-act';
      renameBtn.innerHTML = '✎';
      renameBtn.title = '重命名';
      renameBtn.setAttribute('aria-label', '重命名 ' + item.name);
      renameBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        startRename(i, head, label);
      });

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-act row-act--del';
      delBtn.innerHTML = '×';
      delBtn.title = '删除这一格';
      delBtn.setAttribute('aria-label', '删除 ' + item.name);
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeItem(i);
      });

      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);

      head.appendChild(cb);
      head.appendChild(label);
      head.appendChild(dot);
      head.appendChild(actions);

      /* 点行头任意处切换勾选（按钮、输入框除外） */
      head.addEventListener('click', function (e) {
        if (e.target === cb) return;
        if (e.target.closest && e.target.closest('.row-actions')) return;
        cb.checked = !cb.checked;
        items[i].checked = cb.checked;
        scheduleSave();
      });

      var ta = document.createElement('textarea');
      ta.placeholder = '把 ' + item.name + ' 的回复粘贴到这里…';
      ta.value = item.text;
      ta.setAttribute('aria-label', item.name + ' 的回复内容');
      ta.addEventListener('input', function () {
        items[i].text = ta.value;
        var has = ta.value.trim().length > 0;
        dot.classList.toggle('show', has);
        row.classList.toggle('is-filled', has);
        fitRow(row, ta);
        scheduleSave();
      });

      row.appendChild(head);
      row.appendChild(ta);
      listEl.appendChild(row);

      fitRow(row, ta);
    });

    badgeEl.textContent = items.length + ' 个';
    updateScrollState();
    requestAnimationFrame(updateScrollState);
  }

  /* 就地改名：标签变输入框，回车/失焦确认，Esc 取消 */
  function startRename(i, head, labelEl) {
    if (head.querySelector('.rename-input')) return;
    var cur = items[i].name;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'rename-input';
    inp.value = cur;
    inp.maxLength = 40;
    labelEl.style.display = 'none';
    head.insertBefore(inp, labelEl);
    inp.focus();
    inp.select();

    var done = false;
    function commit(save) {
      if (done) return;
      done = true;
      var v = inp.value.trim();
      if (save && v && v !== cur) {
        items[i].name = v;
        scheduleSave();
      }
      render();
    }

    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
    inp.addEventListener('blur', function () { commit(true); });
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function removeItem(i) {
    var name = items[i].name;
    var hasText = items[i].text.trim().length > 0;
    if (hasText && !window.confirm('「' + name + '」里还有内容，确定删除这一格？')) return;
    items.splice(i, 1);
    scheduleSave();
    render();
  }

  function addItem() {
    var name = (newNameEl.value || '').trim();
    if (!name) return;
    if (items.some(function (it) { return it.name === name; })) {
      showStatus('已经有这个名字了', true, 1600);
      return;
    }
    items.push({ name: name, checked: true, text: '' });
    newNameEl.value = '';
    scheduleSave();
    render();
    /* 新格子滚到底部可见 */
    requestAnimationFrame(function () {
      if (listEl.lastElementChild) listEl.lastElementChild.scrollIntoView({ block: 'nearest' });
    });
  }

  function updatePin() {
    pinBtn.classList.toggle('on', !!alwaysOnTop);
    pinBtn.setAttribute('aria-pressed', alwaysOnTop ? 'true' : 'false');
    // 置顶状态镜像到独立 localStorage 键（内容键 agent-paste-board-v1 不动；Electron 以主进程状态为准）
    try { localStorage.setItem('agent-paste-board-pin', alwaysOnTop ? '1' : '0'); } catch (e) {}
  }

  async function copyAll() {
    var out = window.Assemble.buildOutput(items);
    if (!out) {
      showStatus('没有可复制内容', true, 1600);
      return;
    }
    var n = window.Assemble.countItems(items);
    var res = await window.api.copy(out);
    if (res && res.ok) showStatus('已复制 ' + n + ' 段 ✓', false, 1800);
    else showStatus('复制失败', true, 1600);
  }

  async function clearAll() {
    var ok = false;
    try { ok = await window.api.confirmClear(); } catch (e) { ok = false; }
    if (!ok) return;
    items.forEach(function (it) { it.text = ''; });   // 只清内容，勾选保留
    scheduleSave();
    render();
  }

  async function togglePin() {
    // 先按用户意图切换并立刻给视觉反馈；只有明确失败才回滚。
    // 不要用主进程的“置顶查询值”反向覆盖（setAlwaysOnTop 后立刻回读可能 stale，会把已置顶显示成关）。
    var next = !alwaysOnTop;
    alwaysOnTop = next;
    updatePin();
    try {
      var res = await window.api.setAlwaysOnTop(next);
      if (res && res.ok === false) {
        alwaysOnTop = !next;
        updatePin();
        showStatus('置顶切换失败', true, 1600);
        return;
      }
    } catch (e) {
      alwaysOnTop = !next;
      updatePin();
      showStatus('置顶切换失败', true, 1600);
      return;
    }
    // 即时反馈：复用 #status 的 1.8s 淡出，不新增 UI 元素；中性/成功色（非错误红）
    showStatus(alwaysOnTop ? '已置顶 ✓' : '已取消置顶', false, 1800);
  }

  copyBtn.addEventListener('click', copyAll);
  clearBtn.addEventListener('click', clearAll);
  pinBtn.addEventListener('click', togglePin);
  addBtn.addEventListener('click', addItem);

  newNameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      copyAll();
    }
  });

  window.addEventListener('resize', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.row'), function (row) {
      fitRow(row, row.querySelector('textarea'));
    });
    updateScrollState();
  });

  (async function boot() {
    try {
      var data = await window.api.init();
      items = Array.isArray(data.items) ? data.items : [];
      alwaysOnTop = data.alwaysOnTop !== false;
      updatePin();
      render();
      newNameEl.focus();
    } catch (e) {
      statusEl.textContent = '初始化失败';
      statusEl.classList.add('show', 'is-error');
    }
  })();
})();
