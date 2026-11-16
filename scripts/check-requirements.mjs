// 要件定義書(docs/01-requirements.md)を機械で確かめる。
// 確かめること:
//   1. 表の各行の列の数が、その表の見出しの行の列の数と同じであること。
//      要件の表(見出しが「ID」で始まり、FR- の行を持つ表)は、7列であること。
//   2. FR- の ID が重ならず、FR-001 から書いた順に1つずつ並んでいること。
//   3. 文書の中で指している FR- と TBD- の ID が、表の行として実在すること。
// 使い方: node scripts/check-requirements.mjs [ファイル]
// 問題がなければ 0、問題があれば 1 で終わる。

import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "docs/01-requirements.md";
const lines = readFileSync(file, "utf8").split("\n");
const errors = [];
const REQUIREMENT_COLUMNS = 7;

// 表の行のセルを数える。`…` の中の | と、\| は区切りとして数えない。
function countCells(line) {
  let count = 0;
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "`") inCode = !inCode;
    else if (c === "\\") i++;
    else if (c === "|" && !inCode) count++;
  }
  return count - 1;
}

const isTableLine = (line) => line.trimStart().startsWith("|");
const firstCell = (line) => line.split("|")[1]?.trim() ?? "";

// 1. 列の数
const defined = { FR: [], TBD: [] };
for (let i = 0; i < lines.length; i++) {
  if (!isTableLine(lines[i]) || (i > 0 && isTableLine(lines[i - 1]))) continue;
  const headerLine = i + 1;
  const headerCells = countCells(lines[i]);
  let hasRequirement = false;
  let j = i;
  for (; j < lines.length && isTableLine(lines[j]); j++) {
    const cells = countCells(lines[j]);
    if (cells !== headerCells) {
      errors.push(`${j + 1}行目: 列の数が ${cells} です。表の見出し(${headerLine}行目)は ${headerCells} 列です。`);
    }
    const id = firstCell(lines[j]).match(/^(FR|TBD)-\d{3}$/);
    if (id) {
      defined[id[1]].push({ id: id[0], line: j + 1 });
      if (id[1] === "FR") hasRequirement = true;
    }
  }
  if (hasRequirement && headerCells !== REQUIREMENT_COLUMNS) {
    errors.push(`${headerLine}行目: 要件の表の見出しが ${headerCells} 列です。「この文書の書き方」の ${REQUIREMENT_COLUMNS} 列にします。`);
  }
  i = j - 1;
}

// 2. FR- の重なりと並び
const seen = new Map();
defined.FR.forEach(({ id, line }, index) => {
  if (seen.has(id)) {
    errors.push(`${line}行目: ${id} が重なっています(${seen.get(id)}行目と同じ)。`);
  } else {
    seen.set(id, line);
  }
  const expected = `FR-${String(index + 1).padStart(3, "0")}`;
  if (id !== expected) {
    errors.push(`${line}行目: ${id} の位置には ${expected} が来るはずです。ID は書いた順に付け、表の最後に足します。`);
  }
});

// 3. 指している ID の実在
const exists = new Set([...defined.FR, ...defined.TBD].map(({ id }) => id));
lines.forEach((line, index) => {
  for (const ref of line.match(/\b(?:FR|TBD)-\d{3}\b/g) ?? []) {
    if (!exists.has(ref)) {
      errors.push(`${index + 1}行目: ${ref} を指していますが、その ID の行がありません。`);
    }
  }
});

if (errors.length > 0) {
  console.error(`${file}: ${errors.length} 件の問題があります。`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`${file}: 問題はありません(FR- ${defined.FR.length} 行、TBD- ${defined.TBD.length} 行)。`);
