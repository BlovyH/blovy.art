// 命令速查 - npm run help
const lines = `
blovy.art 命令速查

开发
  npm run dev              dev server
  npm run build            生产构建（build 内含 i18n 词条检查）
  npm run lint             eslint
  npm run preview          预览构建产物

内容 / 资产
  npm run i18n             翻译覆盖报告，缺哪句列哪句
  npm run i18n -- 关键词    反查 key（按基准文本或 key 片段），例 - npm run i18n -- wish
  非对话 UI 文案登记在 src/i18n.js 的 UI_TEXT，调用处写 tUi('key')
  npm run assets:build     gallery 贴图构建并上传 R2
  npm run subset-fonts     字体子集化
  npm run font:glyph       补字，放 12x12 的 public/assets/fonts/glyph-<码位>.png，可多张，注意原图上面 1px 留空给变音符号
  npm run tree             对话树

R2（改 content.json 后先 put 再部署，顺序反了线上渲染残缺）
  npx wrangler r2 object put blovy-art/config/content.json --file public/data/content.json
  npx wrangler r2 object get blovy-art/config/content.json --file public/data/content.json --remote   恢复丢失的 content.json

logalert
  cd logalert && node ../node_modules/wrangler/bin/wrangler.js deploy

改这里加新命令 - scripts/help.js
`
console.log(lines)
