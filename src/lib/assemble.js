/**
 * assemble.js —— 复制内容的纯组装逻辑（不依赖 Electron / DOM，可在 Node 直接单测）
 *
 * 规则（来自 REQUIREMENTS.md §3.2）：
 *  - 只收集「勾选为真」且「内容 trim 后非空」的格子；
 *  - 每段格式：<名称>回复：\n<内容（仅做首尾 trim，其余原样）>；
 *  - 段间空一行；
 *  - 全部为空 → 返回 ''（调用方据此提示且不写剪贴板）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Assemble = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function buildOutput(items) {
    var blocks = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !item.checked) continue;
      var text = String(item.text == null ? '' : item.text).trim();
      if (!text) continue;
      blocks.push(String(item.name) + '回复：\n' + text);
    }
    return blocks.join('\n\n');
  }

  function countItems(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !item.checked) continue;
      if (String(item.text == null ? '' : item.text).trim()) n++;
    }
    return n;
  }

  return { buildOutput: buildOutput, countItems: countItems };
});
