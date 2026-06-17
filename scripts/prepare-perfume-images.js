import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const inputJsonPath = path.join(
  projectRoot,
  'public',
  'data',
  'parfums_with_type_mai_2026.json',
);

const outputJsonPath = path.join(
  projectRoot,
  'public',
  'data',
  'parfums_with_type_mai_2026_with_images.json',
);

const missingImagesPath = path.join(projectRoot, 'images-missing.json');
const reportPath = path.join(projectRoot, 'images-report.json');

const imageOutputDir = path.join(projectRoot, 'public', 'images', 'parfums');
const publicImageBasePath = '/images/parfums';

const pauseMs = 500;
const forceRefreshImages = false;
const minimumReliableScore = 70;

const trustedDomains = [
  'fragrantica',
  'parfumo',
  'notino',
  'sephora',
  'nocibe',
  'marionnaud',
  'douglas',
  'origines-parfums',
  'my-origines',
  'flaconi',
  'parfumdreams',
  'perfumesclub',
  'fragrancex',
  'fragrancenet',
  'incenza',
  'parfumdo',
];

const forbiddenWords = [
  'porn',
  'porno',
  'xxx',
  'sex',
  'sexo',
  'nude',
  'naked',
  'onlyfans',
  'pornhub',
  'xvideos',
  'xnxx',
  'pinterest',
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'reddit',
  'tumblr',
  'deviantart',
  'wallpaper',
  'casino',
  'anime',
  'manga',
  'crypto',
  'bitcoin',
  'nft',
];

const forbiddenNonPerfumeWords = [
  'bag',
  'bags',
  'sac',
  'handbag',
  'wallet',
  'shirt',
  'tshirt',
  'hoodie',
  'robe',
  'dress',
  'shoes',
  'sneakers',
  'watch',
  'montre',
  'bracelet',
  'makeup',
  'maquillage',
  'mascara',
  'lipstick',
  'rouge-a-levres',
  'rouge a levres',
  'foundation',
  'palette',
  'eyeliner',
  'candle',
  'bougie',
  'diffuser',
  'diffuseur',
];

const positivePerfumeWords = [
  'parfum',
  'perfume',
  'fragrance',
  'eau de parfum',
  'eau-de-parfum',
  'eau de toilette',
  'eau-de-toilette',
  'edp',
  'edt',
  'edc',
  'extrait',
  'cologne',
  'flacon',
  'bottle',
  'spray',
  'vaporisateur',
];

const knownBrands = [
  'Yves Saint Laurent',
  'Jean Paul Gaultier',
  'Dolce & Gabbana',
  'Narciso Rodriguez',
  'Viktor & Rolf',
  'Carolina Herrera',
  'Juliette Has A Gun',
  'Atelier Des Ors',
  'Arabian Oud',
  'Elie Saab',
  'Hugo Boss',
  'Issey Miyake',
  'Jimmy Choo',
  'Jo Malone',
  'Tom Ford',
  'Marc Jacobs',
  'Paco Rabanne',
  'Thierry Mugler',
  'Calvin Klein',
  'Elizabeth Arden',
  'Mont Blanc',
  'Lancôme',
  'Lancome',
  'Nina Ricci',
  'Lolita Lempicka',
  'Azzaro',
  'Armani',
  'Boucheron',
  'Burberry',
  'Bvlgari',
  'Cacharel',
  'Cartier',
  'Cerruti',
  'Chloé',
  'Chloe',
  'Chopard',
  'Clinique',
  'Creed',
  'Diesel',
  'Dior',
  'Escada',
  'Givenchy',
  'Gucci',
  'Guerlain',
  'Guess',
  'Hermès',
  'Hermes',
  'Kenzo',
  'Kilian',
  'Lacoste',
  'Lalique',
  'Lanvin',
  'Mancera',
  'Montale',
  'Moschino',
  'Nishane',
  'Prada',
  'Rochas',
  'Serge Lutens',
  'Valentino',
  'Versace',
  'Xerjoff',
  'Zadig & Voltaire',
  'Maissa',
  'Maïssa',
  'Mauboussin',
].sort((a, b) => b.length - a.length);

const brandAliases = {
  Armani: ['Giorgio Armani'],
  Lancôme: ['Lancome'],
  Lancome: ['Lancôme'],
  'Yves Saint Laurent': ['YSL', 'Saint Laurent'],
  'Paco Rabanne': ['Rabanne'],
  'Thierry Mugler': ['Mugler'],
  'Mont Blanc': ['Montblanc'],
  'Dolce & Gabbana': ['Dolce Gabbana', 'D&G'],
  'Jean Paul Gaultier': ['Gaultier'],
  Bvlgari: ['Bulgari'],
  Hermès: ['Hermes'],
  Hermes: ['Hermès'],
  Chloé: ['Chloe'],
  Chloe: ['Chloé'],
  'Viktor & Rolf': ['Viktor Rolf'],
  'Zadig & Voltaire': ['Zadig Voltaire'],
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘´`]/g, "'")
    .trim();
}

function slugify(value = '') {
  return normalizeText(value)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueArray(values) {
  const seen = new Set();

  return values.filter((value) => {
    const cleanValue = String(value || '').trim();
    if (!cleanValue) return false;

    const key = normalizeText(cleanValue);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getNom(item) {
  return String(item.nom || item.name || '').trim();
}

function extractBrandFromName(name = '') {
  const normalizedName = normalizeText(name);

  for (const brand of knownBrands) {
    const normalizedBrand = normalizeText(brand);

    if (
      normalizedName === normalizedBrand ||
      normalizedName.startsWith(`${normalizedBrand} `)
    ) {
      return brand;
    }
  }

  return String(name).split(' ')[0] || '';
}

function getMarque(item) {
  return String(item.marque || item.brand || '').trim() || extractBrandFromName(getNom(item));
}

function cleanProductName(value = '') {
  return normalizeText(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s?x\s?\d+[,.]?\d*\s?ml\b/g, ' ')
    .replace(/\b\d+[,.]?\d*\s?ml\b/g, ' ')
    .replace(/\beau de parfum\b/g, ' ')
    .replace(/\beau de toilette\b/g, ' ')
    .replace(/\beau de cologne\b/g, ' ')
    .replace(/\bextrait de parfum\b/g, ' ')
    .replace(/\bedp\b/g, ' ')
    .replace(/\bedt\b/g, ' ')
    .replace(/\bedc\b/g, ' ')
    .replace(/\btester\b/g, ' ')
    .replace(/\btesteur\b/g, ' ')
    .replace(/\bformat testeur\b/g, ' ')
    .replace(/\bsans film\b/g, ' ')
    .replace(/\bsans blister\b/g, ' ')
    .replace(/\bcoffret\b/g, ' ')
    .replace(/\bgift set\b/g, ' ')
    .replace(/\bset\b/g, ' ')
    .replace(/\bminiature\b/g, ' ')
    .replace(/\bvapo\b/g, ' ')
    .replace(/\bvaporisateur\b/g, ' ')
    .replace(/\brecharge\b/g, ' ')
    .replace(/\bgel douche\b/g, ' ')
    .replace(/\blait corps\b/g, ' ')
    .replace(/\blait\b/g, ' ')
    .replace(/\bdeodorant\b/g, ' ')
    .replace(/\bdéodorant\b/g, ' ')
    .replace(/\bdeo\b/g, ' ')
    .replace(/\bmascara\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeBrandFromName(name = '', brand = '') {
  const normalizedName = normalizeText(name);
  const normalizedBrand = normalizeText(brand);

  if (normalizedBrand && normalizedName.startsWith(`${normalizedBrand} `)) {
    return name.slice(brand.length).trim();
  }

  return name;
}

function getBaseProductName(name, brand) {
  const withoutBrand = removeBrandFromName(name, brand);
  return cleanProductName(withoutBrand) || cleanProductName(name);
}

function getProductKey(brand, name) {
  return slugify(`${brand}-${getBaseProductName(name, brand)}`);
}

function containsAny(text, words) {
  const normalized = normalizeText(text);
  return words.some((word) => normalized.includes(normalizeText(word)));
}

function isTrustedDomain(value = '') {
  const normalized = normalizeText(value);
  return trustedDomains.some((domain) => normalized.includes(domain));
}

function hasPositivePerfumeContext(text) {
  return containsAny(text, positivePerfumeWords);
}

function hasForbiddenContext(text) {
  return containsAny(text, forbiddenWords) || containsAny(text, forbiddenNonPerfumeWords);
}

function getBrandNamesForSearch(brand) {
  return uniqueArray([brand, ...(brandAliases[brand] || [])]);
}

function buildQueries(brand, name) {
  const baseName = getBaseProductName(name, brand);
  const queries = [];

  for (const brandName of getBrandNamesForSearch(brand)) {
    queries.push(`${brandName} ${baseName} parfum flacon`);
    queries.push(`${brandName} ${baseName} perfume bottle`);
    queries.push(`${brandName} ${baseName} fragrance bottle`);
  }

  return uniqueArray(queries);
}

function normalizeImageUrl(url = '') {
  if (!url) return '';

  let cleanUrl = String(url).trim();

  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  }

  try {
    return new URL(cleanUrl).href;
  } catch {
    return '';
  }
}

function isValidImageUrl(url = '') {
  const cleanUrl = normalizeImageUrl(url);

  if (!cleanUrl) return false;
  if (!/^https?:\/\//i.test(cleanUrl)) return false;
  if (hasForbiddenContext(cleanUrl)) return false;

  return true;
}

function scoreCandidate(candidate, brand, name) {
  const baseName = getBaseProductName(name, brand);
  const brandNames = getBrandNamesForSearch(brand);

  const text = normalizeText(
    [
      candidate.title,
      candidate.alt,
      candidate.imageUrl,
      candidate.sourceUrl,
      candidate.query,
    ].join(' '),
  );

  if (hasForbiddenContext(text)) return 0;

  let score = 0;

  const isTrusted =
    isTrustedDomain(candidate.sourceUrl) || isTrustedDomain(candidate.imageUrl);

  if (isTrusted) {
    score += 35;
  } else {
    score -= 15;
  }

  for (const brandName of brandNames) {
    if (text.includes(normalizeText(brandName))) {
      score += 35;
      break;
    }
  }

  const importantWords = normalizeText(baseName)
    .split(' ')
    .filter((word) => word.length >= 3);

  for (const word of importantWords) {
    if (text.includes(word)) {
      score += 12;
    }
  }

  if (hasPositivePerfumeContext(text)) {
    score += 25;
  }

  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(candidate.imageUrl)) {
    score += 10;
  }

  if (candidate.imageUrl.includes('logo')) score -= 80;
  if (candidate.imageUrl.includes('icon')) score -= 80;
  if (candidate.imageUrl.includes('sprite')) score -= 80;
  if (candidate.imageUrl.includes('avatar')) score -= 80;

  return Math.max(0, Math.min(score, 150));
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  return response.data;
}

async function searchBingImages(query, brand, name) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const candidates = [];

  $('a.iusc').each((_, element) => {
    const rawMeta = $(element).attr('m');

    if (!rawMeta) return;

    try {
      const meta = JSON.parse(rawMeta);

      const candidate = {
        engine: 'bing',
        query,
        imageUrl: normalizeImageUrl(meta.murl),
        sourceUrl: normalizeImageUrl(meta.purl),
        title: meta.t || '',
        alt: meta.t || '',
      };

      if (!isValidImageUrl(candidate.imageUrl)) return;

      candidate.score = scoreCandidate(candidate, brand, name);

      if (candidate.score > 0) {
        candidates.push(candidate);
      }
    } catch {
      // Ignore candidat invalide.
    }
  });

  return candidates;
}

async function searchImageCandidates(brand, name) {
  const queries = buildQueries(brand, name);
  const allCandidates = [];

  for (const query of queries) {
    try {
      const candidates = await searchBingImages(query, brand, name);
      allCandidates.push(...candidates);
    } catch {
      // Bing peut bloquer ponctuellement.
    }

    if (allCandidates.some((candidate) => candidate.score >= minimumReliableScore)) {
      break;
    }

    await sleep(150);
  }

  const byImageUrl = new Map();

  for (const candidate of allCandidates) {
    const existing = byImageUrl.get(candidate.imageUrl);

    if (!existing || candidate.score > existing.score) {
      byImageUrl.set(candidate.imageUrl, candidate);
    }
  }

  return [...byImageUrl.values()].sort((a, b) => b.score - a.score);
}

function getExtensionFromContentType(contentType = '') {
  const normalized = normalizeText(contentType);

  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg')) return 'jpg';
  if (normalized.includes('jpg')) return 'jpg';

  return '';
}

function getExtensionFromUrl(url = '') {
  const clean = String(url).split('?')[0].toLowerCase();

  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.jpeg')) return 'jpg';
  if (clean.endsWith('.jpg')) return 'jpg';

  return 'jpg';
}

async function downloadImage(imageUrl, outputBasePath) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers['content-type'] || '';

  if (!String(contentType).startsWith('image/')) {
    throw new Error(`Contenu non image : ${contentType}`);
  }

  const buffer = Buffer.from(response.data);

  if (buffer.length < 6000) {
    throw new Error('Image trop petite ou invalide');
  }

  const extension = getExtensionFromContentType(contentType) || getExtensionFromUrl(imageUrl);
  const outputPath = `${outputBasePath}.${extension}`;

  fs.writeFileSync(outputPath, buffer);

  return {
    outputPath,
    publicPath: `${publicImageBasePath}/${path.basename(outputPath)}`,
  };
}

async function downloadBestAvailableImage(candidates, outputBasePath) {
  const errors = [];

  for (const candidate of candidates) {
    try {
      const downloaded = await downloadImage(candidate.imageUrl, outputBasePath);

      return {
        downloaded,
        candidate,
      };
    } catch (error) {
      errors.push({
        imageUrl: candidate.imageUrl,
        score: candidate.score,
        reason: error.message,
      });
    }
  }

  throw new Error(
    errors.length
      ? `Téléchargement impossible après ${errors.length} tentative(s)`
      : 'Aucun candidat téléchargeable',
  );
}

function getAlreadyDownloadedImage(outputBasePath) {
  const existingFiles = ['webp', 'jpg', 'jpeg', 'png'].map(
    (ext) => `${outputBasePath}.${ext}`,
  );

  const alreadyDownloaded = existingFiles.find((file) => fs.existsSync(file));

  if (!alreadyDownloaded) return '';

  return `${publicImageBasePath}/${path.basename(alreadyDownloaded)}`;
}

async function main() {
  if (!fs.existsSync(inputJsonPath)) {
    console.error(`❌ Fichier introuvable : ${inputJsonPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(imageOutputDir)) {
    fs.mkdirSync(imageOutputDir, { recursive: true });
  }

  const raw = fs.readFileSync(inputJsonPath, 'utf-8');
  const parfums = JSON.parse(raw);

  if (!Array.isArray(parfums)) {
    console.error('❌ Le fichier JSON doit contenir un tableau.');
    process.exit(1);
  }

  const enriched = [];
  const report = [];
  const imageByProductKey = new Map();

  let foundCount = 0;
  let reusedCount = 0;
  let missingCount = 0;
  let existingCount = 0;

  console.log(`📦 Catalogue chargé : ${parfums.length} produits`);
  console.log(`📁 Dossier images : ${imageOutputDir}`);
  console.log('');

  for (let index = 0; index < parfums.length; index++) {
    const item = parfums[index];

    const name = getNom(item);
    const brand = getMarque(item);
    const productKey = getProductKey(brand, name);

    if (!name || !brand || !productKey) {
      missingCount++;

      enriched.push({
        ...item,
        image: '',
      });

      report.push({
        status: 'skipped',
        index,
        name,
        brand,
        reason: 'Nom, marque ou clé produit manquant',
      });

      continue;
    }

    if (imageByProductKey.has(productKey)) {
      const image = imageByProductKey.get(productKey);

      reusedCount++;

      enriched.push({
        ...item,
        image,
      });

      report.push({
        status: 'reused',
        name,
        brand,
        productKey,
        image,
      });

      console.log(`♻️ Réutilisée : ${index + 1}/${parfums.length} - ${name}`);
      continue;
    }

    const outputBasePath = path.join(imageOutputDir, productKey);
    const alreadyDownloadedImage = getAlreadyDownloadedImage(outputBasePath);

    if (alreadyDownloadedImage && !forceRefreshImages) {
      existingCount++;
      imageByProductKey.set(productKey, alreadyDownloadedImage);

      enriched.push({
        ...item,
        image: alreadyDownloadedImage,
      });

      report.push({
        status: 'existing-file',
        name,
        brand,
        productKey,
        image: alreadyDownloadedImage,
      });

      console.log(`✅ Image locale existante : ${index + 1}/${parfums.length} - ${name}`);
      continue;
    }

    try {
      if (forceRefreshImages) {
        for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
          const oldImagePath = `${outputBasePath}.${ext}`;
          if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
        }
      }

      console.log(`🔎 ${index + 1}/${parfums.length} - ${name}`);

      const candidates = await searchImageCandidates(brand, name);

      const reliableCandidates = candidates.filter(
        (candidate) => candidate.score >= minimumReliableScore,
      );

      if (!reliableCandidates.length) {
        missingCount++;

        enriched.push({
          ...item,
          image: '',
        });

        report.push({
          status: 'missing',
          name,
          brand,
          productKey,
          candidatesCount: candidates.length,
          bestScore: candidates[0]?.score ?? 0,
          bestCandidate: candidates[0] ?? null,
        });

        console.log(`⚠️ Non trouvé fiable : ${name}`);
        await sleep(pauseMs);
        continue;
      }

      const { downloaded, candidate } = await downloadBestAvailableImage(
        reliableCandidates,
        outputBasePath,
      );

      foundCount++;
      imageByProductKey.set(productKey, downloaded.publicPath);

      enriched.push({
        ...item,
        image: downloaded.publicPath,
      });

      report.push({
        status: 'downloaded',
        name,
        brand,
        productKey,
        image: downloaded.publicPath,
        score: candidate.score,
        engine: candidate.engine,
        sourceUrl: candidate.sourceUrl,
        imageUrl: candidate.imageUrl,
        title: candidate.title,
      });

      console.log(`✅ Image ajoutée : ${downloaded.publicPath}`);
      console.log(`   ↳ Score : ${candidate.score}`);

      await sleep(pauseMs);
    } catch (error) {
      missingCount++;

      enriched.push({
        ...item,
        image: '',
      });

      report.push({
        status: 'error',
        name,
        brand,
        productKey,
        reason: error.message,
      });

      console.log(`❌ Erreur : ${name} - ${error.message}`);
      await sleep(pauseMs);
    }
  }

  const finalMissing = enriched
    .map((item, index) => {
      if (item.image) return null;

      const name = getNom(item);
      const brand = getMarque(item);

      return {
        index,
        name,
        brand,
        productKey: getProductKey(brand, name),
        reason: 'Image manquante ou refusée car pas assez fiable',
      };
    })
    .filter(Boolean);

  fs.writeFileSync(outputJsonPath, JSON.stringify(enriched, null, 2));
  fs.writeFileSync(missingImagesPath, JSON.stringify(finalMissing, null, 2));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log('🎉 Terminé');
  console.log(`✅ JSON enrichi : ${outputJsonPath}`);
  console.log(`⚠️ Images manquantes : ${missingImagesPath}`);
  console.log(`📋 Rapport : ${reportPath}`);
  console.log(`🖼️ Dossier images : ${imageOutputDir}`);
  console.log('');
  console.log('📊 Résumé');
  console.log(`   Produits total     : ${parfums.length}`);
  console.log(`   Images ajoutées    : ${foundCount}`);
  console.log(`   Images réutilisées : ${reusedCount}`);
  console.log(`   Images existantes  : ${existingCount}`);
  console.log(`   Images manquantes  : ${finalMissing.length}`);
}

main();
