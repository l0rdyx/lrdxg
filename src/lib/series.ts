// Собирает серии из src/series/<slug>/ на этапе сборки.
// Фотки — любые .jpg/.jpeg/.png/.webp/.avif в папке серии.
// Метаданные: series.yml (приоритет) → EXIF/IPTC/XMP из файла (Lightroom) → пусто.
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import sharp from 'sharp';
import exifr from 'exifr';
import type { ImageMetadata } from 'astro';

export type RGB = [number, number, number];

export interface Photo {
  file: string;
  image: ImageMetadata;
  title: string;
  description: string;
  location: string;
  color: string; // средний цвет фотки, hex — плейсхолдер пока грузится
}

export interface Series {
  slug: string;
  title: string;
  description: string;
  year?: string | number;
  order: number;
  cover: Photo;
  photos: Photo[];
  bg: string; // средний цвет серии
  fg: string; // контрастный цвет текста
  muted: string; // приглушённый цвет текста
}

interface PhotoMeta {
  title?: string;
  description?: string;
  location?: string;
}

interface SeriesYml {
  title?: string;
  description?: string;
  year?: string | number;
  order?: number;
  cover?: string;
  hidden?: boolean;
  color?: string; // ручной override фона, если авто-цвет не нравится
  photos?: Record<string, PhotoMeta>;
}

const images = import.meta.glob<ImageMetadata>(
  '/src/series/*/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP,avif,AVIF}',
  { eager: true, import: 'default' },
);

const ROOT = process.cwd();

const toHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): RGB => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// WCAG relative luminance
const luminance = ([r, g, b]: RGB) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

async function averageColor(file: string): Promise<RGB> {
  try {
    const { channels } = await sharp(file).resize(64, 64, { fit: 'inside' }).stats();
    return [channels[0].mean, channels[1].mean, channels[2].mean];
  } catch (e) {
    console.warn(`[series] не смог посчитать цвет для ${file}:`, e);
    return [128, 128, 128];
  }
}

const str = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return str(v[0]);
  if (typeof v === 'object' && 'value' in (v as object)) return str((v as { value: unknown }).value);
  return String(v).trim();
};

async function exifMeta(file: string): Promise<PhotoMeta> {
  try {
    const d = await exifr.parse(file, { iptc: true, xmp: true, tiff: true, exif: false, gps: false });
    if (!d) return {};
    const city = str(d.City) || str(d.city);
    const country = str(d.Country) || str(d.country) || str(d.CountryName);
    const sub = str(d.Sublocation) || str(d.Location);
    return {
      title: str(d.title) || str(d.ObjectName) || str(d.Headline),
      description: str(d.description) || str(d.Caption) || str(d.ImageDescription),
      location: [sub, city, country].filter(Boolean).join(', '),
    };
  } catch {
    return {};
  }
}

const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const humanize = (slug: string) =>
  slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

async function readYml(dir: string): Promise<SeriesYml> {
  for (const name of ['series.yml', 'series.yaml']) {
    try {
      const raw = await fs.readFile(path.join(dir, name), 'utf8');
      return (yaml.load(raw) as SeriesYml) ?? {};
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw new Error(`Ошибка в ${dir}/${name}: ${e.message}`);
    }
  }
  return {};
}

async function build(): Promise<Series[]> {
  const bySlug = new Map<string, { file: string; abs: string; image: ImageMetadata }[]>();
  for (const [key, image] of Object.entries(images)) {
    const [, , , slug, file] = key.split('/'); // '', src, series, slug, file
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push({ file, abs: path.join(ROOT, key), image });
  }

  const all = await Promise.all(
    [...bySlug.entries()].map(async ([slug, files]) => {
      const meta = await readYml(path.join(ROOT, 'src/series', slug));
      if (meta.hidden) return null;
      files.sort((a, b) => naturalSort(a.file, b.file));

      const photos: (Photo & { rgb: RGB })[] = await Promise.all(
        files.map(async ({ file, abs, image }) => {
          const [rgb, ex] = await Promise.all([averageColor(abs), exifMeta(abs)]);
          const own = meta.photos?.[file] ?? {};
          return {
            file,
            image,
            rgb,
            color: toHex(rgb),
            title: str(own.title) || ex.title || '',
            description: str(own.description) || ex.description || '',
            location: str(own.location) || ex.location || '',
          };
        }),
      );

      const avg: RGB = meta.color
        ? fromHex(meta.color)
        : (photos.reduce((acc, p) => acc.map((v, i) => v + p.rgb[i]) as RGB, [0, 0, 0] as RGB)
            .map((v) => v / photos.length) as RGB);
      const dark = luminance(avg) < 0.32;

      const cover = photos.find((p) => p.file === meta.cover) ?? photos[0];
      if (meta.cover && cover.file !== meta.cover)
        console.warn(`[series] ${slug}: cover "${meta.cover}" не найден, беру первую фотку`);

      return {
        slug,
        title: meta.title ?? humanize(slug),
        description: meta.description ?? '',
        year: meta.year,
        order: meta.order ?? 999,
        cover,
        photos,
        bg: toHex(avg),
        fg: dark ? '#ffffff' : '#000000',
        muted: dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.65)',
      } satisfies Series;
    }),
  );

  return all
    .filter((s): s is Series => s !== null)
    .sort((a, b) => a.order - b.order || naturalSort(a.title, b.title));
}

let cache: Promise<Series[]> | undefined;
export const getSeries = () => (cache ??= build());
