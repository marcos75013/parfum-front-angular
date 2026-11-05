
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'public/data');

const sourcePath = path.join(dataDir, 'parfums_source.json');

const archives = [
  'backups/novembre-2026/parfums.json',
  'backups/novembre-2026/parfums_source.json',
  'public/data/parfums_with_type_septembre_2026.json',
  'public/data/parfums_with_type_juillet_2026_with_images.json',
  'public/data/parfums_with_type_juin_2026_with_images.json',
  'public/data/parfums_backup_ok.json',
];

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function validPrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pricesByName = new Map();

for (const archive of archives) {
  const filePath = path.join(root, archive);

  if (!fs.existsSync(filePath)) continue;

  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let available = 0;

  for (const item of items) {
    const price = validPrice(item.prix_boutique);
    if (price === null) continue;

    const key = normalizeName(item.nom);
    if (!key || pricesByName.has(key)) continue;

    pricesByName.set(key, { price, archive });
    available++;
  }

  console.log(`📁 ${archive} : ${available} références ajoutées`);
}

let updated = 0;
const missing = [];
const recovered = [];

for (const item of source) {
  if (validPrice(item.prix_boutique) !== null) continue;

  const key = normalizeName(item.nom);
  const match = pricesByName.get(key);
  const salePrice = validPrice(item.prix);

  if (match && salePrice !== null && match.price > salePrice) {
    item.prix_boutique = match.price;
    updated++;

    recovered.push({
      nom: item.nom,
      prix: salePrice,
      prix_boutique: match.price,
      archive: match.archive,
    });
  } else {
    missing.push({
      nom: item.nom,
      prix: item.prix,
      prix_boutique: item.prix_boutique,
    });
  }
}

const reportPath = path.join(
  root,
  'prix-boutique-novembre-rapport.json'
);

fs.writeFileSync(sourcePath, JSON.stringify(source, null, 2));
fs.writeFileSync(
  reportPath,
  JSON.stringify({ updated, recovered, missing }, null, 2)
);

console.log('\n✅ Récupération terminée');
console.log(`Prix boutique récupérés : ${updated}`);
console.log(`Prix boutique encore manquants : ${missing.length}`);
console.log(`Rapport : ${reportPath}`);
