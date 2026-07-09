const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const groupsPath = path.join(__dirname, '../public/data/product-image-groups.json');

app.use(express.json({ limit: '2mb' }));

function readGroups() {
  return JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
}

function writeGroups(groups) {
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf8');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getMainGender(group) {
  const genders = group.products
    .map((p) => String(p.genre || '').toLowerCase())
    .filter(Boolean);

  if (genders.includes('homme')) return 'men';
  if (genders.includes('femme')) return 'women';
  if (genders.includes('mixte')) return 'unisex';

  return '';
}

function getMainGender(group) {
  const genders = group.products
    .map((product) => String(product.genre || '').toLowerCase())
    .filter(Boolean);

  if (genders.includes('homme')) {
    return 'homme';
  }

  if (genders.includes('femme')) {
    return 'femme';
  }

  if (genders.includes('mixte')) {
    return 'mixte';
  }

  return '';
}

function getGenderSearchTerm(group) {
  const gender = getMainGender(group);

  if (gender === 'homme') {
    return 'homme men';
  }

  if (gender === 'femme') {
    return 'femme women';
  }

  if (gender === 'mixte') {
    return 'mixte unisex';
  }

  return '';
}

function safeQuery(group) {
  const genderTerm = getGenderSearchTerm(group);

  return [
    group.representativeName,
    genderTerm,
    'parfum',
    'flacon',
    'perfume bottle',
  ]
    .filter(Boolean)
    .join(' ');
}

app.get('/', (_req, res) => {
  const groups = readGroups();
  const pending = groups.findIndex((g) => g.status !== 'validated');

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />  <title>Image Review Parfums</title>  <style>    body { font-family: Arial, sans-serif; padding: 24px; background:#f8f8f8; }    .card { background:#fff; padding:24px; border-radius:16px; max-width:900px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }    a { display:inline-block; margin-top:16px; padding:12px 18px; border-radius:10px; background:#eee; color:#111; text-decoration:none; }  </style></head>
<body>
  <div class="card">    <h1>Validation images parfums</h1>    <p><strong>${groups.length}</strong> groupes — prochain à valider : <strong>${pending + 1}</strong></p>
    <a href="/review/${Math.max(pending, 0)}">Commencer / Continuer</a>
  </div></body>
</html>
  `);
});

app.get('/review/:index', (req, res) => {
  const groups = readGroups();
  const index = Number(req.params.index);
  const group = groups[index];

  if (!group) {
    return res.send('<h1>Terminé ✅</h1><a href="/">Retour</a>');
  }

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />  <title>Review ${index + 1}</title>
  <style>    body { font-family: Arial, sans-serif; padding: 24px; background:#f8f8f8; }    .card { background:#fff; padding:24px; border-radius:16px; max-width:1100px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }    .muted { color:#666; }    .actions a, button { display:inline-block; margin:8px 8px 8px 0; padding:10px 14px; border-radius:10px; text-decoration:none; border:0; cursor:pointer; }    a { background:#eee; color:#111; }    button { background:#1f2937; color:white; }    .validate { background:#047857; }    .skip { background:#b45309; }    input { width:100%; padding:12px; margin-top:12px; font-size:16px; }    .candidates { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:16px; margin-top:24px; }    .candidate { border:1px solid #ddd; border-radius:14px; padding:12px; background:#fafafa; }    .candidate img { width:100%; height:180px; object-fit:contain; background:white; border-radius:10px; }    .candidate-title { font-size:13px; margin:8px 0; min-height:38px; }    .candidate-source { font-size:12px; color:#666; word-break:break-word; }    .danger { color:#b91c1c; }  </style></head>
<body>
  <div class="card">    <p class="muted">Groupe ${index + 1} / ${groups.length}</p>
    <h1>${escapeHtml(group.representativeName)}</h1>
    <p>${group.products.length} produit(s)</p>    <p><strong>Genre :</strong> ${escapeHtml(getMainGender(group) || 'non précisé')}</p>
    <p class="muted">${escapeHtml(group.groupKey)}</p>

    <div class="actions">      <a target="_blank" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(safeQuery(group))}">Google Images</a>
      <a target="_blank" href="https://www.google.com/search?q=${encodeURIComponent(`${group.representativeName} site:fragrantica.fr/parfum`)}">Fragrantica</a>
      <button onclick="loadCandidates()">🔎 Charger images candidates</button>
      <button class="skip" onclick="skip()">Passer</button>
      <a href="/review/${Math.max(index - 1, 0)}">← Précédent</a>
      <a href="/review/${index + 1}">Suivant →</a>
    </div>
    <input id="manualUrl" placeholder="Optionnel : coller une URL image manuellement" value="${escapeHtml(group.imageUrl || '')}" />
    <button class="validate" onclick="validateManual()">✅ Valider URL manuelle</button>

    <p id="message" class="danger"></p>    <div id="candidates" class="candidates"></div>  </div>
  <script>    async function loadCandidates() {
      const container = document.getElementById('candidates');
      const message = document.getElementById('message');

      message.innerText = '';      container.innerHTML = '<p>Chargement des images candidates...</p>';
      const res = await fetch('/api/candidates/${index}');
      const data = await res.json();

      if (!data.candidates || data.candidates.length === 0) {        container.innerHTML = '<p>Aucune image candidate fiable trouvée.</p>';        return;      }
      container.innerHTML = data.candidates.map((candidate, i) => \`
        <div class="candidate">          <img src="\${candidate.thumbnail || candidate.imageUrl}" onerror="this.style.display='none'" />
          <div class="candidate-title">\${candidate.title || ''}</div>          <div class="candidate-source">\${candidate.source || ''}</div>          <button class="validate" onclick="validateCandidate('\${encodeURIComponent(candidate.imageUrl)}', '\${encodeURIComponent(candidate.sourceUrl || '')}')">            ✅ Choisir cette image          </button>        </div>      \`).join('');
    }
    async function validateCandidate(encodedImageUrl, encodedSourceUrl) {
      const imageUrl = decodeURIComponent(encodedImageUrl);
      const sourceUrl = decodeURIComponent(encodedSourceUrl);

      const res = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, sourceUrl })      });
      if (res.ok) {
        window.location.href = '/review/${index + 1}';
      } else {        document.getElementById('message').innerText = 'Erreur validation image.';      }    }
    async function validateManual() {
      const imageUrl = document.getElementById('manualUrl').value.trim();

      if (!imageUrl) {
        document.getElementById('message').innerText = 'Colle une URL image avant de valider.';        return;      }
      const res = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })      });
      if (res.ok) {
        window.location.href = '/review/${index + 1}';
      }    }
    async function skip() {
      await fetch('/api/skip/${index}', { method: 'POST' });
      window.location.href = '/review/${index + 1}';
    }
    loadCandidates();
  </script></body>
</html>
  `);
});

async function getDuckDuckGoVqd(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  const text = await res.text();
  const match = text.match(/vqd="([^"]+)"/) || text.match(/vqd=([^&]+)&/);

  return match?.[1] ?? null;
}

function scoreCandidate(candidate, group) {
  const text = `${candidate.title || ''} ${candidate.image || ''} ${candidate.url || ''}`.toLowerCase();
  const name = String(group.representativeName || '').toLowerCase();

  let score = 0;

  const words = name
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const word of words) {
    if (text.includes(word)) score += 3;
  }

  if (text.includes('fragrantica')) score += 20;
  if (text.includes('parfumo')) score += 18;
  if (text.includes('notino')) score += 12;
  if (text.includes('sephora')) score += 12;
  if (text.includes('marionnaud')) score += 12;
  if (text.includes('douglas')) score += 10;

  if (text.includes('perfume') || text.includes('parfum')) score += 8;
  if (text.includes('bottle') || text.includes('flacon')) score += 6;

  const badWords = [
    'makeup',
    'maquillage',
    'mascara',
    'lipstick',
    'robe',
    'bag',
    'sac',
    'shoes',
    'adult',
    'porn',
    'nude',
  ];

  for (const bad of badWords) {
    if (text.includes(bad)) score -= 50;
  }

  return score;
}

app.get('/api/candidates/:index', async (req, res) => {
  try {
    const groups = readGroups();
    const index = Number(req.params.index);
    const group = groups[index];

    if (!group) {
      return res.status(404).json({ error: 'Groupe introuvable' });
    }

    const query = safeQuery(group);
    const vqd = await getDuckDuckGoVqd(query);

    if (!vqd) {
      return res.json({ candidates: [] });
    }

    const url =
      `https://duckduckgo.com/i.js?l=fr-fr&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;

    const ddgRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://duckduckgo.com/',
      },
    });

    const data = await ddgRes.json();

    const candidates = (data.results || [])
      .map((item) => ({
        title: item.title || '',
        imageUrl: item.image || '',
        thumbnail: item.thumbnail || item.image || '',
        sourceUrl: item.url || '',
        source: item.url || '',
        score: scoreCandidate(item, group),
      }))
      .filter((item) => item.imageUrl && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    res.json({ candidates });
  } catch (error) {
    console.error(error);
    res.json({ candidates: [] });
  }
});

app.post('/api/validate/:index', (req, res) => {
  const groups = readGroups();
  const index = Number(req.params.index);

  if (!groups[index]) {
    return res.status(404).json({ error: 'Groupe introuvable' });
  }

  groups[index].imageUrl = req.body.imageUrl;
  groups[index].sourceUrl = req.body.sourceUrl || '';
  groups[index].status = 'validated';

  writeGroups(groups);

  res.json({ ok: true });
});

app.post('/api/skip/:index', (req, res) => {
  const groups = readGroups();
  const index = Number(req.params.index);

  if (!groups[index]) {
    return res.status(404).json({ error: 'Groupe introuvable' });
  }

  groups[index].status = 'skipped';

  writeGroups(groups);

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Image Review lancé : http://localhost:${PORT}`);
});

