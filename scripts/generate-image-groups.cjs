const fs = require('fs');
const path = require('path');

const inputPath = path.join(
  __dirname,
  '../public/data/product-image-sources.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/product-image-groups.json'
);

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

const items = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const map = new Map();

for (const item of items) {
  const groupKey = normalizeKey(item.cleanName || item.nom);

  if (!map.has(groupKey)) {
    map.set(groupKey, {
      groupKey,
      representativeName: item.cleanName || item.nom,
      searchQuery: `${item.cleanName || item.nom} perfume bottle`,
      imageUrl: '',
      sourceUrl: '',
      localImage: '',
      status: 'pending',
      products: [],
    });
  }

  map.get(groupKey).products.push({
    index: item.index,
    nom: item.nom,
    type: item.type,
    genre: item.genre,
  });
}

const groups = [...map.values()].sort(
  (a, b) => b.products.length - a.products.length
);

fs.writeFileSync(outputPath, JSON.stringify(groups, null, 2), 'utf8');

console.log(`✅ Groupes générés : ${outputPath}`);
console.log(`✅ Produits total : ${items.length}`);
console.log(`✅ Groupes uniques estimés : ${groups.length}`);
console.log(`✅ Plus gros groupe : ${groups[0]?.representativeName} (${groups[0]?.products.length} produits)`);
