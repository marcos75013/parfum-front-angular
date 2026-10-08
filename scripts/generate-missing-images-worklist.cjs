const fs = require('fs');
const path = require('path');

const inputPath = path.join(
  __dirname,
  '../public/data/parfums.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/product-image-sources-missing.json'
);

const PLACEHOLDER = '/images/parfums/placeholder.jpg';

function cleanSearchName(name) {
  return String(name)
    .replace(/\(Format Testeur\)/gi, '')
    .replace(/\(Sans Film\)/gi, '')
    .replace(/\(Sans Blister\)/gi, '')
    .replace(/\(Sans Boite\)/gi, '')
    .replace(/\(Sans Boîte\)/gi, '')
    .replace(/\(Sans Bouchon\)/gi, '')
    .replace(/\+.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMissingImage(parfum) {
  if (!parfum.image) {
    return true;
  }

  return (
    String(parfum.image).toLowerCase().includes('placeholder') ||
    parfum.image === PLACEHOLDER
  );
}

const parfums = JSON.parse(
  fs.readFileSync(inputPath, 'utf8')
);

// Uniquement les produits qui n'ont actuellement aucune vraie image.
const missing = parfums.filter(isMissingImage);

const worklist = missing.map((parfum, index) => {
  const cleanName = cleanSearchName(parfum.nom);

  return {
    index,
    nom: parfum.nom,
    cleanName,
    genre: parfum.genre,
    type: parfum.type,
    searchQuery: `${cleanName} perfume bottle`,
    sourceUrl: '',
    imageUrl: '',
    localImage: '',
    status: 'pending',
  };
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(worklist, null, 2),
  'utf8'
);

console.log('');
console.log('🖼️ CAMPAGNE IMAGES MANQUANTES');
console.log('────────────────────────────────');
console.log(`📦 Catalogue complet     : ${parfums.length}`);
console.log(`✅ Avec image            : ${parfums.length - missing.length}`);
console.log(`⚠️ Sans image            : ${missing.length}`);
console.log(`🔎 Produits à rechercher : ${worklist.length}`);
console.log('');
console.log(`📄 Worklist : ${outputPath}`);
