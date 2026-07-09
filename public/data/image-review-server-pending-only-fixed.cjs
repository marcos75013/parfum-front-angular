const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const groupsPath = path.join(__dirname, '../public/data/product-image-groups.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

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
  return [
    group.representativeName,
    getGenderSearchTerm(group),
    'parfum',
    'flacon',
    'perfume bottle',
  ]
    .filter(Boolean)
    .join(' ');
}

function isPending(group) {
  return group.status !== 'validated' && group.status !== 'skipped';
}

function getPendingIndexes(groups) {
  return groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => isPending(group))
    .map(({ index }) => index);
}

function findNextPendingIndex(groups, fromIndex = -1) {
  const pendingIndexes = getPendingIndexes(groups);
  const nextAfterCurrent = pendingIndexes.find((index) => index > fromIndex);

  if (nextAfterCurrent !== undefined) {
    return nextAfterCurrent;
  }

  return pendingIndexes[0] ?? -1;
}

function getPendingPosition(groups, index) {
  const pendingIndexes = getPendingIndexes(groups);
  const position = pendingIndexes.indexOf(index);

  return position === -1 ? 0 : position + 1;
}

function getStats(groups) {
  return {
    total: groups.length,
    validated: groups.filter((group) => group.status === 'validated').length,
    skipped: groups.filter((group) => group.status === 'skipped').length,
    pending: groups.filter((group) => isPending(group)).length,
  };
}

app.get('/', (_req, res) => {
  const groups = readGroups();
  const stats = getStats(groups);
  const nextPendingIndex = findNextPendingIndex(groups);

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Validation images nouveautés</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background: #f8f8f8; color: #111; }
    .card { background: #fff; padding: 32px; border-radius: 18px; max-width: 900px; margin: 40px auto; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
    h1 { margin-top: 0; font-size: 36px; }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0; }
    .pill { display: inline-block; padding: 8px 12px; border-radius: 999px; background: #eef2ff; font-size: 15px; font-weight: 700; }
    a { display: inline-block; margin-top: 16px; padding: 13px 18px; border-radius: 10px; background: #111827; color: #fff; text-decoration: none; font-weight: 700; }
    .success { color: #047857; font-weight: 800; font-size: 20px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Validation images nouveautés</h1>
    <div class="stats">
      <span class="pill">${stats.pending} nouveauté(s) à valider</span>
      <span class="pill">${stats.validated} image(s) déjà validée(s)</span>
      <span class="pill">${stats.skipped} passée(s)</span>
    </div>
    ${stats.pending === 0
      ? '<p class="success">Toutes les nouveautés sont validées 🎉</p>'
      : `<a href="/review/${nextPendingIndex}">Commencer / Continuer</a>`}
  </div>
</body>
</html>
  `);
});

app.get('/next', (req, res) => {
  const groups = readGroups();
  const fromIndex = Number(req.query.from ?? -1);
  const nextPendingIndex = findNextPendingIndex(groups, fromIndex);

  if (nextPendingIndex === -1) {
    return res.redirect('/');
  }

  res.redirect(`/review/${nextPendingIndex}`);
});

app.get('/review/:index', (req, res) => {
  const groups = readGroups();
  const index = Number(req.params.index);
  const group = groups[index];
  const stats = getStats(groups);

  if (!group) {
    return res.redirect('/');
  }

  if (!isPending(group)) {
    const nextPendingIndex = findNextPendingIndex(groups, index);

    if (nextPendingIndex === -1) {
      return res.redirect('/');
    }

    return res.redirect(`/review/${nextPendingIndex}`);
  }

  const pendingPosition = getPendingPosition(groups, index);
  const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(safeQuery(group))}`;
  const fragranticaUrl = `https://www.google.com/search?q=${encodeURIComponent(`${group.representativeName} site:fragrantica.fr/parfum`)}`;

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Nouveauté ${pendingPosition}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background:#f8f8f8; color:#111; }
    .card { background:#fff; padding:28px; border-radius:18px; max-width:1200px; margin:0 auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    h1 { font-size:34px; line-height:1.15; margin-bottom:18px; }
    .muted { color:#666; font-weight:700; }
    .pill { display:inline-block; padding:8px 12px; border-radius:999px; background:#eef2ff; margin:4px 8px 4px 0; font-size:14px; font-weight:700; }
    .actions a, button { display:inline-block; margin:8px 8px 8px 0; padding:11px 15px; border-radius:10px; text-decoration:none; border:0; cursor:pointer; font-size:14px; font-weight:700; }
    a { background:#eee; color:#111; }
    button { background:#1f2937; color:#fff; }
    .validate { background:#047857; color:#fff; }
    .skip { background:#b45309; color:#fff; }
    input { width:100%; box-sizing:border-box; padding:13px; margin-top:14px; font-size:16px; border:1px solid #ddd; border-radius:9px; }
    .candidates { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:16px; margin-top:24px; }
    .candidate { border:1px solid #ddd; border-radius:14px; padding:12px; background:#fafafa; }
    .candidate img { width:100%; height:190px; object-fit:contain; background:#fff; border-radius:10px; }
    .candidate-title { font-size:13px; margin:8px 0; min-height:42px; font-weight:700; }
    .candidate-source { font-size:12px; color:#666; word-break:break-word; margin-bottom:10px; }
    .danger { color:#b91c1c; font-weight:700; }
  </style>
</head>
<body>
  <div class="card">
    <p class="muted">Nouveauté ${pendingPosition} / ${stats.pending}</p>
    <p><span class="pill">${stats.pending} nouveauté(s) restante(s)</span></p>

    <h1>${escapeHtml(group.representativeName)}</h1>
    <p>${group.products.length} produit(s)</p>
    <p><strong>Genre :</strong> ${escapeHtml(getMainGender(group) || 'non précisé')}</p>
    <p class="muted">${escapeHtml(group.groupKey)}</p>

    <div class="actions">
      <a target="_blank" href="${googleImagesUrl}">Google Images</a>
      <a target="_blank" href="${fragranticaUrl}">Fragrantica</a>
      <button onclick="loadCandidates()">🔎 Charger images candidates</button>
      <button class="skip" onclick="skipGroup()">Passer</button>
      <a href="/next?from=${index}">Nouveauté suivante →</a>
    </div>

    <form method="POST" action="/manual/${index}" style="margin-top: 14px;">
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
    function escapeClientHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    async function loadCandidates() {
      const container = document.getElementById('candidates');
      const message = document.getElementById('message');

      message.innerText = '';
      container.innerHTML = '<p>Chargement des images candidates...</p>';

      const response = await fetch('/api/candidates/${index}');
      const data = await response.json();

      if (data.error) {
        container.innerHTML = '<p>Aucune image candidate fiable trouvée. Tu peux coller une URL manuellement.</p>';
        message.innerText = data.error;
        return;
      }

      if (!data.candidates || data.candidates.length === 0) {
        container.innerHTML = '<p>Aucune image candidate fiable trouvée. Tu peux coller une URL manuellement.</p>';
        return;
      }

      container.innerHTML = data.candidates.map(function(candidate) {
        const imageUrl = candidate.imageUrl || '';
        const sourceUrl = candidate.sourceUrl || '';
        const thumbnail = candidate.thumbnail || imageUrl;
        const title = escapeClientHtml(candidate.title || '');
        const source = escapeClientHtml(candidate.source || '');

        return ''
          + '<div class="candidate">'
          + '<img src="' + thumbnail + '" onerror="this.style.display=\'none\'" />'
          + '<div class="candidate-title">' + title + '</div>'
          + '<div class="candidate-source">' + source + '</div>'
          + '<button class="validate" onclick="validateCandidate(\'' + encodeURIComponent(imageUrl) + '\', \'' + encodeURIComponent(sourceUrl) + '\')">✅ Choisir cette image</button>'
          + '</div>';
      }).join('');
    }

    async function validateCandidate(encodedImageUrl, encodedSourceUrl) {
      const imageUrl = decodeURIComponent(encodedImageUrl);
      const sourceUrl = decodeURIComponent(encodedSourceUrl);

      const response = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, sourceUrl })
      });

      if (response.ok) {
        window.location.href = '/next?from=${index}';
      } else {
        document.getElementById('message').innerText = 'Erreur validation image.';
      }
    }

    async function validateManual() {
      const imageUrl = document.getElementById('manualUrl').value.trim();

      if (!imageUrl) {
        document.getElementById('message').innerText = 'Colle une URL image avant de valider.';
        return;
      }

      const response = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });

      if (response.ok) {
        window.location.href = '/next?from=${index}';
      } else {
        document.getElementById('message').innerText = 'Erreur validation URL manuelle.';
      }
    }

    async function skipGroup() {
      await fetch('/api/skip/${index}', { method: 'POST' });
      window.location.href = '/next?from=${index}';
    }
  </script>
</body>
</html>
  `);
});

async function getDuckDuckGoVqd(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  const text = await response.text();
  const match = text.match(/vqd="([^"]+)"/) || text.match(/vqd=([^&]+)&/);

  return match?.[1] ?? null;
}

function scoreCandidate(candidate, group) {
  const text = `${candidate.title || ''} ${candidate.image || ''} ${candidate.url || ''}`.toLowerCase();
  const name = String(group.representativeName || '').toLowerCase();

  let score = 0;

  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  for (const badWord of badWords) {
    if (text.includes(badWord)) {
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

    const url = `https://duckduckgo.com/i.js?l=fr-fr&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;

    const ddgResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://duckduckgo.com/',
      },
    });

    const data = await ddgResponse.json();

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
    console.error('Erreur recherche images candidates :', error);
    res.json({
      candidates: [],
      error: 'Recherche automatique indisponible pour ce parfum. Colle une URL manuellement puis valide.',
    });
  }
});

function validateGroupImage(index, imageUrl, sourceUrl = '') {
  const groups = readGroups();

  if (!groups[index]) {
    return { ok: false, status: 404, error: 'Groupe introuvable' };
  }

  const cleanImageUrl = String(imageUrl || '').trim();

  if (!cleanImageUrl) {
    return { ok: false, status: 400, error: 'URL image manquante' };
  }

  groups[index].imageUrl = cleanImageUrl;
  groups[index].sourceUrl = String(sourceUrl || '').trim();
  groups[index].status = 'validated';

  writeGroups(groups);

  console.log(`✅ Image validée pour : ${groups[index].representativeName}`);

  return { ok: true };
}

app.post('/api/validate/:index', (req, res) => {
  const index = Number(req.params.index);
  const result = validateGroupImage(index, req.body.imageUrl, req.body.sourceUrl);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  res.json({ ok: true });
});

app.post('/manual/:index', (req, res) => {
  const index = Number(req.params.index);
  const result = validateGroupImage(index, req.body.imageUrl, req.body.sourceUrl);

  if (!result.ok) {
    return res.status(result.status).send(`
      <h1>Erreur</h1>
      <p>${escapeHtml(result.error)}</p>
      <a href="/review/${index}">Retour</a>
    `);
  }

  res.redirect(`/next?from=${index}`);
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
