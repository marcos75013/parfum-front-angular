const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const groupsPath = path.join(__dirname, '../public/data/product-image-groups.json');

const catalogCandidatePaths = [
  path.join(__dirname, '../public/data/parfums_with_type_juin_2026_with_images.json'),
  path.join(__dirname, '../public/data/parfums_with_type_juin_2026_with_images_nouveautes_ready.json'),
  path.join(__dirname, '../public/data/parfums_with_type_juin_2026_with_images_nouveautes_ready1.json'),
];

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Erreur lecture JSON ${filePath}`, error);
    return fallback;
  }
}

function readGroups() {
  return readJson(groupsPath, []);
}

function writeGroups(groups) {
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf8');
}

function readCatalog() {
  for (const catalogPath of catalogCandidatePaths) {
    const catalog = readJson(catalogPath, null);

    if (Array.isArray(catalog)) {
      return catalog;
    }
  }

  return [];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMonthlyNewProduct(product) {
  return (
    product?.nouveaute === true ||
    product?.nouveaute === 'true' ||
    product?.nouveaute_mois === true ||
    product?.isNew === true ||
    Boolean(product?.moisNouveaute)
  );
}

function getMonthlyNewNames() {
  const catalog = readCatalog();

  return new Set(
    catalog
      .filter(isMonthlyNewProduct)
      .map((product) => normalize(product.nom || product.name))
      .filter(Boolean)
  );
}

function isGroupMonthlyNew(group, monthlyNewNames) {
  return (group.products || []).some((product) => {
    return monthlyNewNames.has(normalize(product.nom || product.name));
  });
}

function isPending(group) {
  return group.status !== 'validated' && group.status !== 'skipped';
}

function getGroupsWithMeta() {
  const groups = readGroups();
  const monthlyNewNames = getMonthlyNewNames();

  return groups.map((group, index) => ({
    group,
    index,
    isMonthlyNew: isGroupMonthlyNew(group, monthlyNewNames),
    isPending: isPending(group),
  }));
}

function getFilteredGroups(mode) {
  const groupsWithMeta = getGroupsWithMeta();

  if (mode === 'nouveautes') {
    return groupsWithMeta.filter((item) => item.isMonthlyNew);
  }

  return groupsWithMeta;
}

function getStats() {
  const groupsWithMeta = getGroupsWithMeta();
  const monthlyNewGroups = groupsWithMeta.filter((item) => item.isMonthlyNew);
  const monthlyNewPending = monthlyNewGroups.filter((item) => item.isPending);

  return {
    total: groupsWithMeta.length,
    validated: groupsWithMeta.filter((item) => item.group.status === 'validated').length,
    skipped: groupsWithMeta.filter((item) => item.group.status === 'skipped').length,
    pending: groupsWithMeta.filter((item) => item.isPending).length,
    monthlyNewTotal: monthlyNewGroups.length,
    monthlyNewPending: monthlyNewPending.length,
  };
}

function findNextIndex(mode = 'all', fromIndex = -1) {
  const filtered = getFilteredGroups(mode).filter((item) => item.isPending);

  const nextAfterCurrent = filtered.find((item) => item.index > fromIndex);

  if (nextAfterCurrent) {
    return nextAfterCurrent.index;
  }

  return filtered[0]?.index ?? -1;
}

function getPositionInMode(index, mode = 'all') {
  const filtered = getFilteredGroups(mode).filter((item) => item.isPending);
  const position = filtered.findIndex((item) => item.index === index);

  return {
    position: position === -1 ? 1 : position + 1,
    total: filtered.length || 1,
  };
}

function getMainGender(group) {
  const genders = (group.products || [])
    .map((product) => String(product.genre || '').toLowerCase())
    .filter(Boolean);

  if (genders.includes('homme')) return 'homme';
  if (genders.includes('femme')) return 'femme';
  if (genders.includes('mixte')) return 'mixte';

  return '';
}

function getGenderSearchTerm(group) {
  const gender = getMainGender(group);

  if (gender === 'homme') return 'homme men';
  if (gender === 'femme') return 'femme women';
  if (gender === 'mixte') return 'mixte unisex';

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

function getMode(req) {
  return req.query.mode === 'nouveautes' ? 'nouveautes' : 'all';
}

function nextUrl(index, mode) {
  const query = mode === 'nouveautes' ? '&mode=nouveautes' : '';

  return `/next?from=${index}${query}`;
}

function reviewUrl(index, mode) {
  const query = mode === 'nouveautes' ? '?mode=nouveautes' : '';

  return `/review/${index}${query}`;
}

app.get('/', (_req, res) => {
  const stats = getStats();
  const nextAllIndex = findNextIndex('all');
  const nextNewIndex = findNextIndex('nouveautes');

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Image Review Parfums</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background:#f8f8f8; }
    .card { background:#fff; padding:24px; border-radius:16px; max-width:980px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:22px; }
    a { display:inline-block; padding:12px 18px; border-radius:10px; background:#eee; color:#111; text-decoration:none; }
    .primary { background:#111827; color:#fff; }
    .new { background:#7c3aed; color:#fff; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:18px; }
    .pill { padding:12px 14px; border-radius:14px; background:#f1f5f9; }
    .success { color:#047857; font-weight:700; margin-top:18px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Validation images parfums</h1>

    <div class="stats">
      <div class="pill"><strong>${stats.total}</strong> groupes au total</div>
      <div class="pill"><strong>${stats.pending}</strong> groupes à valider</div>
      <div class="pill"><strong>${stats.monthlyNewTotal}</strong> nouveautés détectées</div>
      <div class="pill"><strong>${stats.monthlyNewPending}</strong> nouveautés à valider</div>
    </div>

    ${
    stats.pending === 0
      ? '<p class="success">Toutes les images sont validées 🎉</p>'
      : ''
  }

    <div class="actions">
      ${
    nextNewIndex === -1
      ? '<a class="new" href="/">Aucune nouveauté à valider ✅</a>'
      : `<a class="new" href="${reviewUrl(nextNewIndex, 'nouveautes')}">✨ Valider uniquement les nouveautés (${stats.monthlyNewPending})</a>`
  }

      ${
    nextAllIndex === -1
      ? ''
      : `<a class="primary" href="${reviewUrl(nextAllIndex, 'all')}">Valider tous les groupes restants (${stats.pending})</a>`
  }
    </div>
  </div>
</body>
</html>
  `);
});

app.get('/next', (req, res) => {
  const mode = getMode(req);
  const fromIndex = Number(req.query.from ?? -1);
  const nextIndex = findNextIndex(mode, fromIndex);

  if (nextIndex === -1) {
    return res.redirect('/');
  }

  return res.redirect(reviewUrl(nextIndex, mode));
});

app.get('/review/:index', (req, res) => {
  const mode = getMode(req);
  const groups = readGroups();
  const index = Number(req.params.index);
  const group = groups[index];
  const stats = getStats();

  if (!group) {
    return res.send('<h1>Terminé ✅</h1><a href="/">Retour</a>');
  }

  const monthlyNewNames = getMonthlyNewNames();
  const groupIsMonthlyNew = isGroupMonthlyNew(group, monthlyNewNames);

  if (!isPending(group) || (mode === 'nouveautes' && !groupIsMonthlyNew)) {
    const nextIndex = findNextIndex(mode, index);

    if (nextIndex === -1) {
      return res.redirect('/');
    }

    return res.redirect(reviewUrl(nextIndex, mode));
  }

  const position = getPositionInMode(index, mode);
  const title = mode === 'nouveautes'
    ? `Nouveauté ${position.position} / ${position.total}`
    : `Groupe ${index + 1} / ${groups.length}`;

  const modeLabel = mode === 'nouveautes'
    ? `${stats.monthlyNewPending} nouveauté(s) restante(s)`
    : `${stats.pending} groupe(s) restant(s)`;

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Review ${index + 1}</title>
  <style>
    body { font-family: Arial, sans-serif; padding:24px; background:#f8f8f8; }
    .card { background:#fff; padding:24px; border-radius:16px; max-width:1180px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    .muted { color:#666; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:18px 0; }
    .actions a, button { display:inline-block; padding:10px 14px; border-radius:10px; text-decoration:none; border:0; cursor:pointer; font-size:14px; }
    a { background:#eee; color:#111; }
    button { background:#1f2937; color:#fff; }
    .validate { background:#047857; color:#fff; }
    .skip { background:#b45309; color:#fff; }
    .new { background:#7c3aed; color:#fff; }
    input { width:100%; padding:12px; margin-top:12px; font-size:16px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; }
    .candidates { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:16px; margin-top:24px; }
    .candidate { border:1px solid #ddd; border-radius:14px; padding:12px; background:#fafafa; }
    .candidate img { width:100%; height:180px; object-fit:contain; background:#fff; border-radius:10px; }
    .candidate-title { font-size:13px; margin:8px 0; min-height:38px; }
    .candidate-source { font-size:12px; color:#666; word-break:break-word; }
    .danger { color:#b91c1c; }
    .pill { display:inline-block; padding:6px 10px; border-radius:999px; background:#eef2ff; margin:4px 8px 4px 0; font-size:13px; }
    .manual-form { margin-top:16px; }
  </style>
</head>
<body>
  <div class="card">
    <p class="muted">${escapeHtml(title)}</p>

    <p>
      <span class="pill">${escapeHtml(modeLabel)}</span>
      ${groupIsMonthlyNew ? '<span class="pill">✨ Nouveauté du mois</span>' : ''}
    </p>

    <h1>${escapeHtml(group.representativeName)}</h1>
    <p>${(group.products || []).length} produit(s)</p>
    <p><strong>Genre :</strong> ${escapeHtml(getMainGender(group) || 'non précisé')}</p>
    <p class="muted">${escapeHtml(group.groupKey)}</p>

    <div class="actions">
      <a target="_blank" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(safeQuery(group))}">Google Images</a>
      <a target="_blank" href="https://www.google.com/search?q=${encodeURIComponent(`${group.representativeName} site:fragrantica.fr/parfum`)}">Fragrantica</a>
      <button type="button" onclick="loadCandidates()">🔎 Charger images candidates</button>
      <button type="button" class="skip" onclick="skip()">Passer</button>
      <a class="new" href="${reviewUrl(findNextIndex('nouveautes'), 'nouveautes')}">✨ Voir uniquement les nouveautés</a>
      <a href="${nextUrl(index, mode)}">${mode === 'nouveautes' ? 'Nouveauté suivante →' : 'Groupe suivant →'}</a>
      <a href="/">Accueil</a>
    </div>

    <form class="manual-form" method="POST" action="/validate-form/${index}?mode=${mode}">
      <input
        id="manualUrl"
        name="imageUrl"
        placeholder="Optionnel : coller une URL image manuellement"
        value="${escapeHtml(group.imageUrl || '')}"
      />
      <button class="validate" type="submit">✅ Valider URL manuelle</button>
    </form>

    <p id="message" class="danger"></p>
    <div id="candidates" class="candidates"></div>
  </div>

  <script>
    async function loadCandidates() {
      const container = document.getElementById('candidates');
      const message = document.getElementById('message');

      message.innerText = '';
      container.innerHTML = '<p>Chargement des images candidates...</p>';

      try {
        const res = await fetch('/api/candidates/${index}');
        const data = await res.json();

        if (!data.candidates || data.candidates.length === 0) {
          container.innerHTML = '<p>Aucune image candidate fiable trouvée. Tu peux coller une URL manuellement.</p>';
          return;
        }

        container.innerHTML = data.candidates.map((candidate) => \`
          <div class="candidate">
            <img src="\${candidate.thumbnail || candidate.imageUrl}" onerror="this.style.display='none'" />
            <div class="candidate-title">\${candidate.title || ''}</div>
            <div class="candidate-source">\${candidate.source || ''}</div>
            <button class="validate" onclick="validateCandidate('\${encodeURIComponent(candidate.imageUrl)}', '\${encodeURIComponent(candidate.sourceUrl || '')}')">
              ✅ Choisir cette image
            </button>
          </div>
        \`).join('');
      } catch (error) {
        container.innerHTML = '<p>Impossible de charger les candidates. Tu peux coller une URL manuellement.</p>';
      }
    }

    async function validateCandidate(encodedImageUrl, encodedSourceUrl) {
      const imageUrl = decodeURIComponent(encodedImageUrl);
      const sourceUrl = decodeURIComponent(encodedSourceUrl);

      const res = await fetch('/api/validate/${index}?mode=${mode}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, sourceUrl })
      });

      if (res.ok) {
        window.location.href = '${nextUrl(index, mode)}';
      } else {
        document.getElementById('message').innerText = 'Erreur validation image.';
      }
    }

    async function skip() {
      await fetch('/api/skip/${index}?mode=${mode}', { method: 'POST' });
      window.location.href = '${nextUrl(index, mode)}';
    }
  </script>
</body>
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
    .filter((word) => word.length > 2);

  for (const word of words) {
    if (text.includes(word)) {
      score += 3;
    }
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
    if (text.includes(bad)) {
      score -= 50;
    }
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

  if (!req.body.imageUrl) {
    return res.status(400).json({ error: 'imageUrl manquante' });
  }

  groups[index].imageUrl = req.body.imageUrl;
  groups[index].sourceUrl = req.body.sourceUrl || '';
  groups[index].status = 'validated';

  writeGroups(groups);

  res.json({ ok: true });
});

app.post('/validate-form/:index', (req, res) => {
  const mode = getMode(req);
  const groups = readGroups();
  const index = Number(req.params.index);

  if (!groups[index]) {
    return res.status(404).send('Groupe introuvable');
  }

  if (!req.body.imageUrl) {
    return res.redirect(reviewUrl(index, mode));
  }

  groups[index].imageUrl = req.body.imageUrl;
  groups[index].sourceUrl = req.body.sourceUrl || '';
  groups[index].status = 'validated';

  writeGroups(groups);

  res.redirect(nextUrl(index, mode));
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
