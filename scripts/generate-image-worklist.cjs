const fs = require('fs');
const path = require('path');

const inputPath = path.join(
  __dirname,
  '../public/data/parfums_source.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/product-image-sources.json'
);

function cleanSearchName(name) {
  return String(name)
    .replace(/\(Format Testeur\)/gi, '')
    .replace(/\(Sans Film\)/gi, '')
    .replace(/\(Sans Boite.*?\)/gi, '')
    .replace(/\+.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const parfums = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const worklist = parfums.map((parfum, index) => {
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

fs.writeFileSync(outputPath, JSON.stringify(worklist, null, 2), 'utf8');

console.log(`✅ Worklist générée : ${outputPath}`);
console.log(`✅ Produits traités : ${worklist.length}`);
