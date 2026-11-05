const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../public/data');
const catalogPath = path.join(dataDir, 'parfums_source.json');
const groupsPath = path.join(dataDir, 'product-image-groups.json');
const overridesPath = path.join(dataDir, 'product-image-overrides.json');
const outputPath = path.join(dataDir, 'parfums.json');
const imagesDir = path.join(__dirname, '../public/images/parfums');
const placeholder = '/images/parfums/placeholder-parfum.png';

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} introuvable : ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlaceholder(image) {
  return !image || image === placeholder || String(image).includes('placeholder-parfum');
}

function toPublicImagePath(localImage) {
  if (!localImage || typeof localImage !== 'string') return '';
  const image = localImage.trim();
  if (!image) return '';
  if (image.startsWith('/images/parfums/')) return image;
  if (image.startsWith('images/parfums/')) return `/${image}`;
  // Only accept a bare filename or an image path inside our image directory.
  if (image.includes('/') || image.includes('\\')) return '';
  return `/images/parfums/${image}`;
}

function imageFileExists(publicImagePath) {
  if (isPlaceholder(publicImagePath)) return false;
  if (typeof publicImagePath !== 'string' || !publicImagePath.startsWith('/images/parfums/')) return false;
  const filename = publicImagePath.slice('/images/parfums/'.length);
  if (!filename || filename === '.' || filename === '..' || filename.includes('/') || filename.includes('\\')) return false;
  return fs.existsSync(path.join(imagesDir, filename));
}

function getBestImageForGroup(group) {
  for (const candidate of [group.localImage, group.image, group.imagePath]) {
    const image = toPublicImagePath(candidate);
    if (imageFileExists(image)) return image;
  }
  return '';
}

const normalizeName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Same key must be used by the individual image editor.
const productKey = (product) =>
  `${normalizeName(product.nom)}|${normalizeName(product.genre)}`;

const catalog = readJson(catalogPath, 'Catalogue source');
const groups = readJson(groupsPath, 'Groupes images');
const overrides = fs.existsSync(overridesPath)
  ? readJson(overridesPath, 'Corrections individuelles')
  : {};

if (!Array.isArray(catalog) || !Array.isArray(groups) || !overrides || Array.isArray(overrides) || typeof overrides !== 'object') {
  throw new Error('Structure JSON incorrecte : catalogue, groupes ou corrections');
}

const imageByProductName = new Map();
let groupsWithImage = 0;
let groupsWithoutImage = 0;

for (const group of groups) {
  const image = getBestImageForGroup(group);
  if (image) groupsWithImage += 1;
  else groupsWithoutImage += 1;
  for (const product of group.products || []) {
    if (product.nom) imageByProductName.set(normalizeName(product.nom), image);
  }
}

let appliedOverrides = 0;
const finalCatalog = catalog.map((parfum) => {
  const key = productKey(parfum);
  const overrideValue = overrides[key];
  const overrideImage = toPublicImagePath(
    typeof overrideValue === 'string' ? overrideValue : overrideValue?.image
  );
  const groupImage = imageByProductName.get(normalizeName(parfum.nom));
  const currentImage = toPublicImagePath(parfum.image);
  let image = placeholder;

  if (overrideImage && imageFileExists(overrideImage)) {
    image = overrideImage;
    appliedOverrides += 1;
  } else if (groupImage && imageFileExists(groupImage)) {
    image = groupImage;
  } else if (!isPlaceholder(currentImage) && imageFileExists(currentImage)) {
    image = currentImage;
  }

  return {
    ...parfum,
    image,
    nouveaute: parfum.nouveaute === true,
    moisNouveaute: parfum.nouveaute === true
      ? (parfum.moisNouveaute || '2026-06')
      : (parfum.moisNouveaute || null),
  };
});

// Write only after the complete catalogue has been generated successfully.
const tmpPath = `${outputPath}.tmp`;
fs.writeFileSync(tmpPath, JSON.stringify(finalCatalog, null, 2), 'utf8');
fs.renameSync(tmpPath, outputPath);

const withRealImage = finalCatalog.filter((p) => !isPlaceholder(p.image)).length;
const withPlaceholder = finalCatalog.length - withRealImage;
const monthlyNews = finalCatalog.filter((p) => p.nouveaute === true).length;
const monthlyNewsWithImage = finalCatalog.filter((p) => p.nouveaute === true && !isPlaceholder(p.image)).length;

console.log('🎉 Catalogue final généré');
console.log(`✅ Produits total           : ${finalCatalog.length}`);
console.log(`🖼️ Images réelles          : ${withRealImage}`);
console.log(`🧩 Placeholders            : ${withPlaceholder}`);
console.log(`✨ Nouveautés              : ${monthlyNews}`);
console.log(`✨ Nouveautés avec image   : ${monthlyNewsWithImage}`);
console.log(`🛠️ Corrections appliquées  : ${appliedOverrides}`);
console.log(`✅ Groupes avec image      : ${groupsWithImage}`);
console.log(`⚠️ Groupes sans image      : ${groupsWithoutImage}`);
console.log(`📄 Fichier généré          : ${outputPath}`);
