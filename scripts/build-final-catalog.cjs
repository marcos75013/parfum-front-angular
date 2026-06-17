const fs = require('fs');
const path = require('path');

const catalogPath = path.join(
  __dirname,
  '../public/data/parfums_with_type_juin_2026.json'
);

const groupsPath = path.join(
  __dirname,
  '../public/data/product-image-groups.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/parfums_with_type_juin_2026_with_images.json'
);

const placeholder = '/images/parfums/placeholder-parfum.png';

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\+.*$/g, '')
    .replace(/\b\d+\s?(ml|g|gr|x\d+|x|%|edp|edt|edc)\b/gi, '')
    .replace(/\b(eau de parfum|eau de toilette|extrait de parfum|parfum|tester|testeur|format)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));

const imageByProductIndex = new Map();

for (const group of groups) {
  const image = group.localImage || placeholder;

  for (const product of group.products || []) {
    imageByProductIndex.set(product.index, image);
  }
}

const finalCatalog = catalog.map((parfum, index) => {
  const image = imageByProductIndex.get(index) || placeholder;

  return {
    ...parfum,
    image,
  };
});

fs.writeFileSync(outputPath, JSON.stringify(finalCatalog, null, 2), 'utf8');

const withRealImage = finalCatalog.filter(
  (p) => p.image && p.image !== placeholder
).length;

const withPlaceholder = finalCatalog.length - withRealImage;

console.log('🎉 Catalogue final généré');
console.log(`✅ Produits total      : ${finalCatalog.length}`);
console.log(`🖼️ Images réelles     : ${withRealImage}`);
console.log(`🧩 Placeholders       : ${withPlaceholder}`);
console.log(`📄 Fichier généré     : ${outputPath}`);
