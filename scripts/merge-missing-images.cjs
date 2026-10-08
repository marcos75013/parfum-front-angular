const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../public/data/parfums.json');
const groupsPath = path.join(__dirname, '../public/data/product-image-groups-missing.json');
const backupPath = path.join(__dirname, '../public/data/parfums_backup_avant_merge_missing.json');

const apply = process.argv.includes('--apply');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isMissing(image) {
  if (!image || typeof image !== 'string') return true;
  return /placeholder/i.test(image);
}

const imageMap = new Map();
const conflicts = [];

for (const group of groups) {
  if (group.status !== 'validated' || !group.localImage) continue;

  const file = path.join('public', group.localImage.replace(/^\//, ''));

  if (!fs.existsSync(file)) continue;

  for (const product of group.products || []) {
    const key = normalize(product.nom);
    if (!key) continue;

    if (imageMap.has(key) && imageMap.get(key) !== group.localImage) {
      conflicts.push(product.nom);
    }

    imageMap.set(key, group.localImage);
  }
}

const changes = [];

const updated = catalog.map(product => {
  if (!isMissing(product.image)) return product;

  const image = imageMap.get(normalize(product.nom));

  if (!image) return product;

  changes.push({
    nom: product.nom,
    before: product.image,
    after: image
  });

  return { ...product, image };
});

const beforeMissing = catalog.filter(p => isMissing(p.image)).length;
const afterMissing = updated.filter(p => isMissing(p.image)).length;

console.log('\n📊 FUSION IMAGES MANQUANTES');
console.log('────────────────────────────');
console.log('Mode :', apply ? 'APPLICATION' : 'SIMULATION');
console.log('Produits :', catalog.length);
console.log('Images à intégrer :', changes.length);
console.log('Placeholders avant :', beforeMissing);
console.log('Placeholders après :', afterMissing);
console.log('Conflits :', conflicts.length);

if (catalog.length !== 700) {
  throw new Error('Catalogue inattendu : nombre de produits différent de 700');
}

if (conflicts.length) {
  console.error('Conflits détectés :', conflicts);
  throw new Error('Fusion annulée');
}

if (!apply) {
  console.log('\n🔒 Simulation uniquement : aucun fichier modifié.');
  console.log('Pour appliquer : node scripts/merge-missing-images.cjs --apply');
  process.exit(0);
}

fs.copyFileSync(catalogPath, backupPath);
fs.writeFileSync(catalogPath, JSON.stringify(updated, null, 2) + '\n');

console.log('\n✅ Catalogue mis à jour.');
console.log('📦 Sauvegarde :', backupPath);
