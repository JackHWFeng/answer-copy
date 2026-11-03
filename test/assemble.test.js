/**
 * 纯模块单测：node test/assemble.test.js
 * 三条断言覆盖需求书 §3.2（复制格式 / 空内容跳过 / 全空不复制）与 §7 第 4/5/6 条的核心逻辑。
 */
const assert = require('assert');
const { buildOutput, countItems } = require('../src/lib/assemble.js');

const items = [
  { name: 'Codex', checked: true, text: '第一段内容' },
  { name: 'DeepSeek Harness', checked: true, text: '第二段内容\n换行保留' },
  { name: 'WorkBuddy', checked: false, text: '这段被取消勾选' },
  { name: 'Trae Work', checked: true, text: '   ' },
  { name: 'Grok Bot', checked: true, text: '第五段' },
];

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
    pass++;
  } catch (e) {
    console.log('FAIL  ' + name + ' -> ' + e.message);
    fail++;
  }
}

// ① 5 格中 3 格有效 → 取消 1 个勾后正好 2 段，且格式严格符合 §3.2
check('① 取消 1 个勾 → 正好 2 段且格式符合', function () {
  const two = [
    { name: 'Codex', checked: true, text: 'A' },
    { name: 'DeepSeek Harness', checked: true, text: 'B' },
    { name: 'WorkBuddy', checked: false, text: 'C' },
  ];
  const out = buildOutput(two);
  const expected = 'Codex回复：\nA\n\nDeepSeek Harness回复：\nB';
  assert.strictEqual(out, expected, '输出与期望格式不一致：' + JSON.stringify(out));
  assert.strictEqual(countItems(two), 2, '段数应为 2');
});

// ② 勾选但内容为空（或纯空白）→ 不出现在输出
check('② 勾选但空内容不出现', function () {
  const mixed = [
    { name: 'Codex', checked: true, text: '  ' },
    { name: 'WorkBuddy', checked: true, text: '有内容' },
  ];
  const out = buildOutput(mixed);
  assert.strictEqual(out, 'WorkBuddy回复：\n有内容', '空内容被错误包含：' + JSON.stringify(out));
  assert.strictEqual(countItems(mixed), 1);
  assert.ok(out.indexOf('Codex') === -1, 'Codex 不应出现');
});

// ③ 全空 → 返回空串（调用方据此不写剪贴板）
check('③ 全空 → 返回空串', function () {
  const empty = items.map(function (x) {
    return { name: x.name, checked: true, text: '   ' };
  });
  assert.strictEqual(buildOutput(empty), '');
  assert.strictEqual(countItems(empty), 0);
  assert.strictEqual(buildOutput([]), '');
});

console.log('\n结果: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
