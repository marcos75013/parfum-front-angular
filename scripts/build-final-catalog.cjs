const fs = require('fs');
const path = require('path');

const catalogPath = path.join(
  __dirname,
  '../public/data/parfums_with_type_juin_2026_with_images.json'
);

const groupsPath = path.join(
  __dirname,
  '../public/data/product-image-groups.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/parfums_with_type_juin_2026_with_images.json'
);

const imagesDir = path.join(
  __dirname,
  '../public/images/parfums'
);

const placeholder = '/images/parfums/placeholder-parfum.png';

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${label} introuvable : ${filePath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlaceholder(image) {
  return !image || image === placeholder || String(image).includes('placeholder-parfum');
}

function toPublicImagePath(localImage) {
  if (!localImage) {
    return '';
  }

  const image = String(localImage).trim();

  if (!image) {
    return '';
  }

  if (image.startsWith('/images/parfums/')) {
    return image;
  }

  if (image.startsWith('images/parfums/')) {
    return `/${image}`;
  }

  return `/images/parfums/${path.basename(image)}`;
}

function imageFileExists(publicImagePath) {
  if (isPlaceholder(publicImagePath)) {
    return false;
  }

  const fileName = path.basename(publicImagePath);
  const absolutePath = path.join(imagesDir, fileName);

  return fs.existsSync(absolutePath);
}

function getBestImageForGroup(group) {
  const candidates = [
    group.localImage,
    group.image,
    group.imagePath,
  ];

  for (const candidate of candidates) {
    const publicImagePath = toPublicImagePath(candidate);

    if (imageFileExists(publicImagePath)) {
      return publicImagePath;
    }
  }

  return '';
}

const catalog = readJson(catalogPath, 'Catalogue source');
const groups = readJson(groupsPath, 'Groupes images');

const imageByProductIndex = new Map();
let groupsWithImage = 0;
let groupsWithoutImage = 0;

for (const group of groups) {
  const image = getBestImageForGroup(group);

  if (image) {
    groupsWithImage += 1;
  } else {
    groupsWithoutImage += 1;
  }

  for (const product of group.products || []) {
    if (typeof product.index === 'number') {
      imageByProductIndex.set(product.index, image);
    }
  }
}

const finalCatalog = catalog.map((parfum, index) => {
  const imageFromGroup = imageByProductIndex.get(index);
  const currentImage = parfum.image;

  let image = placeholder;

  if (imageFromGroup && imageFileExists(imageFromGroup)) {
    image = imageFromGroup;
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

fs.writeFileSync(outputPath, JSON.stringify(finalCatalog, null, 2), 'utf8');

const withRealImage = finalCatalog.filter(
  (parfum) => !isPlaceholder(parfum.image)
).length;

const withPlaceholder = finalCatalog.length - withRealImage;
const monthlyNews = finalCatalog.filter((parfum) => parfum.nouveaute === true).length;
const monthlyNewsWithImage = finalCatalog.filter(
  (parfum) => parfum.nouveaute === true && !isPlaceholder(parfum.image)
).length;

console.log('🎉 Catalogue final généré');
console.log(`✅ Produits total           : ${finalCatalog.length}`);
console.log(`🖼️ Images réelles          : ${withRealImage}`);
console.log(`🧩 Placeholders            : ${withPlaceholder}`);
console.log(`✨ Nouveautés              : ${monthlyNews}`);
console.log(`✨ Nouveautés avec image   : ${monthlyNewsWithImage}`);
console.log(`✅ Groupes avec image      : ${groupsWithImage}`);
console.log(`⚠️ Groupes sans image      : ${groupsWithoutImage}`);
console.log(`📄 Fichier généré          : ${outputPath}`);
