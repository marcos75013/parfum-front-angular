// const fs = require('fs');
// const path = require('path');
//
// const filePath = path.join(
//   __dirname,
//   '../public/data/parfums_with_type_juin_2026.json'
// );
//
// const outputPath = path.join(
//   __dirname,
//   '../public/data/parfums_with_type_mai_2026_with_images.json'
// );
//
// const placeholder = '/images/parfums/placeholder-parfum.png';
//
// const parfums = JSON.parse(fs.readFileSync(filePath, 'utf8'));
//
// const updated = parfums.map((parfum) => ({
//   ...parfum,
//   image: parfum.image || placeholder,
// }));
//
// fs.writeFileSync(outputPath, JSON.stringify(updated, null, 2), 'utf8');
//
// console.log(`✅ Fichier généré : ${outputPath}`);
// console.log(`✅ Produits traités : ${updated.length}`);
