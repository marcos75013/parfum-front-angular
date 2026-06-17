const fs = require('fs');
const path = require('path');

const inputPath = path.join(
  __dirname,
  '../public/data/product-image-groups.json'
);

const outputPath = path.join(
  __dirname,
  '../public/data/image-validation.html'
);

const groups = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function googleImagesUrl(query) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function fragranticaUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} site:fragrantica.fr/parfum`)}`;
}

const rows = groups
  .map((group, i) => {
    const query = group.searchQuery || `${group.representativeName} perfume bottle`;

    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${escapeHtml(group.representativeName)}</strong>
          <br />
          <small>${escapeHtml(group.groupKey)}</small>
          <br />
          <small>${group.products.length} produit(s)</small>
        </td>
        <td>
          <a href="${googleImagesUrl(query)}" target="_blank">Google Images</a>
          <br />
          <a href="${fragranticaUrl(group.representativeName)}" target="_blank">Fragrantica</a>
        </td>
        <td>
          <input
            type="text"
            placeholder="Coller imageUrl ici"
            data-index="${i}"
          />
        </td>
      </tr>
    `;
  })
  .join('');

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Validation images parfums</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background: #fafafa; }
    h1 { margin-bottom: 8px; }
    .help { margin-bottom: 24px; color: #555; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #ddd; padding: 10px; vertical-align: top; }
    th { background: #f1f1f1; position: sticky; top: 0; }
    input { width: 100%; padding: 8px; }
    a { color: #0b57d0; }
  </style>
</head>
<body>
  <h1>Validation images parfums</h1>
  <p class="help">
    Ouvre Google Images ou Fragrantica, copie l’URL directe de l’image du flacon,
    puis colle-la dans product-image-groups.json au bon groupe.
  </p>

  <p><strong>${groups.length}</strong> groupes à valider.</p>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Parfum</th>
        <th>Recherche</th>
        <th>Image URL validée</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');

console.log(`✅ Page générée : ${outputPath}`);
console.log(`✅ Groupes : ${groups.length}`);
