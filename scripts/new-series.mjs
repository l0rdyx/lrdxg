// npm run new-series "Tokyo Nights"  → создаёт src/series/tokyo-nights/series.yml
import fs from 'node:fs';
import path from 'node:path';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: npm run new-series "Series title"');
  process.exit(1);
}
const slug = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
if (!slug) {
  console.error('Не получилось сделать slug из названия — используй латиницу.');
  process.exit(1);
}
const dir = path.join('src/series', slug);
if (fs.existsSync(dir)) {
  console.error(`Уже есть: ${dir}`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'series.yml'),
  `title: ${JSON.stringify(title)}
description: ""
year: ${new Date().getFullYear()}
# order: 1          # порядок в меню (меньше = выше)
# cover: 01.jpg     # обложка, по умолчанию первая фотка
# color: "#7a1f1f"  # если авто-цвет фона не нравится
# hidden: true      # спрятать серию, не удаляя

# Подписи к фоткам. Можно не писать — тогда возьмутся Title/Caption/City
# из метаданных файла (заполняются в Lightroom при экспорте).
photos:
  # 01.jpg:
  #   title: ""
  #   description: ""
  #   location: ""
`,
);
console.log(`Готово: ${dir}/ — кидай туда фотки.`);
