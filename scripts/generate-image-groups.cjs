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

const existingGroups = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  : [];

const existingMap = new Map();

for (const group of existingGroups) {
  existingMap.set(group.groupKey, group);
}

const nextMap = new Map();

for (const item of items) {
  const groupKey = normalizeKey(item.cleanName || item.nom);

  if (!nextMap.has(groupKey)) {
    const existingGroup = existingMap.get(groupKey);

    nextMap.set(groupKey, existingGroup
      ? {
        ...existingGroup,
        representativeName: existingGroup.representativeName || item.cleanName || item.nom,
        searchQuery: existingGroup.searchQuery || `${item.cleanName || item.nom} perfume bottle`,
        products: [],
      }
      : {
        groupKey,
        representativeName: item.cleanName || item.nom,
        searchQuery: `${item.cleanName || item.nom} perfume bottle`,
        imageUrl: '',
        sourceUrl: '',
        localImage: '',
        status: 'pending',
        products: [],
      }
    );
  }

  nextMap.get(groupKey).products.push({
    index: item.index,
    nom: item.nom,
    type: item.type,
    genre: item.genre,
  });
}

const groups = [...nextMap.values()].sort(
  (a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.products.length - a.products.length;
  }
);

fs.writeFileSync(outputPath, JSON.stringify(groups, null, 2), 'utf8');

const validatedCount = groups.filter((group) => group.status === 'validated').length;
const pendingCount = groups.filter((group) => group.status === 'pending').length;

console.log(`✅ Groupes générés / fusionnés : ${outputPath}`);
console.log(`✅ Produits total : ${items.length}`);
console.log(`✅ Groupes uniques estimés : ${groups.length}`);
console.log(`✅ Groupes déjà validés conservés : ${validatedCount}`);
console.log(`🟡 Groupes à valider : ${pendingCount}`);
console.log(`✅ Plus gros groupe : ${groups[0]?.representativeName} (${groups[0]?.products.length} produits)`);
