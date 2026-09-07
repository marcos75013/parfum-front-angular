const fs = require('fs');
const path = require('path');

const sourcePath = path.join(
  __dirname,
  '../public/data/parfums_source.json'
);

const enrichedPath = path.join(
  __dirname,
  '../public/data/parfums_with_type_septembre_2026_prix_boutique.json'
);

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));

const pricesByName = new Map(
  enriched
    .filter(item => item.prix_boutique != null)
    .map(item => [item.nom, item.prix_boutique])
);

let updated = 0;

for (const item of source) {
  const newPrice = pricesByName.get(item.nom);

  if (
    item.nouveaute === true &&
    item.moisNouveaute === 'Septembre 2026' &&
    newPrice != null &&
    item.prix_boutique !== newPrice
  ) {
    item.prix_boutique = newPrice;
    updated++;
  }
}

fs.writeFileSync(
  sourcePath,
  JSON.stringify(source, null, 2),
  'utf8'
);

console.log(`✅ Prix boutique mis à jour : ${updated}`);
