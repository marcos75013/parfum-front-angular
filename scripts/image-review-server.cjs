const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = 3001;

const groupsPath = path.join(__dirname, '../public/data/product-image-groups.json');
const publicDir = path.join(__dirname, '../public');
const finalizeScript = path.join(__dirname, 'finalize-catalog.cjs');
const projectRoot = path.join(__dirname, '..');

app.use(express.json({ limit: '2mb' }));
app.use('/images', express.static(path.join(publicDir, 'images')));

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

function normalizeSearch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function isPending(group) {
  return group.status !== 'validated' && group.status !== 'skipped';
}

function findNextPendingIndex(groups, fromIndex = -1) {
  const nextAfterCurrent = groups.findIndex(
    (group, index) => index > fromIndex && isPending(group)
  );

  if (nextAfterCurrent !== -1) return nextAfterCurrent;
  return groups.findIndex((group) => isPending(group));
}

function getStats(groups) {
  return {
    total: groups.length,
    validated: groups.filter((group) => group.status === 'validated').length,
    skipped: groups.filter((group) => group.status === 'skipped').length,
    pending: groups.filter((group) => isPending(group)).length,
    corrections: groups.filter((group) => group.forceDownload === true).length,
  };
}

function getSearchText(group) {
  return normalizeSearch([
    group.representativeName,
    group.groupKey,
    ...(group.products || []).map((product) => product.nom),
  ].filter(Boolean).join(' '));
}

function statusLabel(group) {
  if (group.forceDownload) return '🛠️ Correction à finaliser';
  if (group.status === 'validated') return '✅ Validé';
  if (group.status === 'skipped') return '⏭️ Passé';
  return '🟠 Pending';
}

app.get('/', (req, res) => {
  const groups = readGroups();
  const stats = getStats(groups);
  const nextPendingIndex = findNextPendingIndex(groups);
  const query = String(req.query.q || '').trim();
  const normalizedQuery = normalizeSearch(query);

  const results = normalizedQuery
    ? groups
        .map((group, index) => ({ group, index }))
        .filter(({ group }) => getSearchText(group).includes(normalizedQuery))
        .slice(0, 50)
    : [];

  const resultsHtml = normalizedQuery
    ? `
      <div class="search-results">
        <h2>Résultats (${results.length}${results.length === 50 ? '+' : ''})</h2>
        ${
          results.length === 0
            ? '<p class="muted">Aucun parfum trouvé.</p>'
            : results.map(({ group, index }) => `
              <div class="result">
                <div>
                  <strong>${escapeHtml(group.representativeName)}</strong>
                  <div class="muted">${escapeHtml(statusLabel(group))} · ${group.products?.length || 0} produit(s)</div>
                </div>
                <a class="edit" href="/review/${index}?edit=1">Modifier l'image</a>
              </div>
            `).join('')
        }
      </div>
    `
    : '';

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Image Review Parfums</title>
  <style>
    body { font-family:Arial,sans-serif; padding:24px; background:#f8f8f8; color:#111; }
    .card { background:#fff; padding:24px; border-radius:16px; max-width:1000px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    a, button { display:inline-block; padding:11px 16px; border-radius:10px; border:0; cursor:pointer; text-decoration:none; font-size:14px; }
    a { background:#eee; color:#111; }
    button { background:#1f2937; color:#fff; }
    .primary { background:#047857; color:#fff; }
    .finalize { background:#7c3aed; color:#fff; }
    .success { color:#047857; font-weight:700; }
    .muted { color:#666; }
    .stats { margin:18px 0; line-height:1.8; }
    .search { margin-top:28px; padding-top:22px; border-top:1px solid #eee; }
    form { display:flex; gap:10px; }
    input { flex:1; padding:12px; border:1px solid #ddd; border-radius:10px; font-size:16px; }
    .search-results { margin-top:20px; }
    .result { display:flex; justify-content:space-between; align-items:center; gap:16px; border:1px solid #e5e7eb; border-radius:12px; padding:14px; margin:10px 0; }
    .edit { background:#111827; color:#fff; white-space:nowrap; }
    #finalizeMessage { white-space:pre-wrap; margin-top:12px; font-family:monospace; font-size:12px; max-height:300px; overflow:auto; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Validation images parfums</h1>

    <div class="stats">
      <div><strong>${stats.total}</strong> groupes au total</div>
      <div><strong>${stats.validated}</strong> groupes validés</div>
      <div><strong>${stats.skipped}</strong> groupes passés</div>
      <div><strong>${stats.pending}</strong> groupe(s) à valider</div>
      <div><strong>${stats.corrections}</strong> correction(s) d'image à finaliser</div>
    </div>

    ${
      stats.pending === 0
        ? '<p class="success">Toutes les validations mensuelles sont terminées 🎉</p>'
        : `<a class="primary" href="/review/${nextPendingIndex}">Continuer les ${stats.pending} groupe(s) pending</a>`
    }

    ${
      stats.corrections > 0
        ? `<button class="finalize" onclick="finalizeChanges()">🔄 Finaliser les ${stats.corrections} correction(s)</button>`
        : '<p class="muted">Aucune correction d’image en attente de finalisation.</p>'
    }

    <div id="finalizeMessage"></div>

    <div class="search">
      <h2>🔎 Corriger l'image d'un parfum</h2>
      <p class="muted">Recherche dans tous les groupes, y compris ceux déjà validés.</p>
      <form method="get" action="/">
        <input name="q" value="${escapeHtml(query)}" placeholder="Ex. Tom Ford Ombre Leather, H24, Guerlain..." autofocus />
        <button type="submit">Rechercher</button>
      </form>
      ${resultsHtml}
    </div>
  </div>

  <script>
    async function finalizeChanges() {
      const message = document.getElementById('finalizeMessage');

      if (!confirm('Finaliser les corrections ? Les images modifiées seront retéléchargées puis parfums.json sera reconstruit.')) {
        return;
      }

      message.textContent = '⏳ Finalisation en cours...';

      try {
        const res = await fetch('/api/finalize', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          message.textContent = '❌ ' + (data.error || 'Erreur pendant la finalisation.');
          return;
        }

        message.textContent = '✅ Finalisation terminée.\\n\\n' + (data.output || '');
        setTimeout(() => window.location.reload(), 1200);
      } catch (error) {
        message.textContent = '❌ Erreur réseau pendant la finalisation.';
      }
    }
  </script>
</body>
</html>
  `);
});

app.get('/next', (req, res) => {
  const groups = readGroups();
  const fromIndex = Number(req.query.from ?? -1);
  const nextPendingIndex = findNextPendingIndex(groups, fromIndex);

  if (nextPendingIndex === -1) return res.redirect('/');
  res.redirect(`/review/${nextPendingIndex}`);
});

app.get('/review/:index', (req, res) => {
  const groups = readGroups();
  const index = Number(req.params.index);
  const group = groups[index];
  const stats = getStats(groups);
  const editMode = req.query.edit === '1';

  if (!group) {
    return res.status(404).send('<h1>Groupe introuvable</h1><a href="/">Retour</a>');
  }

  if (!editMode && !isPending(group)) {
    const nextPendingIndex = findNextPendingIndex(groups, index);

    if (nextPendingIndex === -1) return res.redirect('/');
    return res.redirect(`/review/${nextPendingIndex}`);
  }

  const currentImage = group.localImage || group.imageUrl || '';
  const actionTitle = editMode ? 'Correction ciblée' : 'Validation mensuelle';

  res.send(`
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(actionTitle)} - ${escapeHtml(group.representativeName)}</title>
  <style>
    body { font-family:Arial,sans-serif; padding:24px; background:#f8f8f8; }
    .card { background:#fff; padding:24px; border-radius:16px; max-width:1100px; margin:auto; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    .muted { color:#666; }
    .actions a, button { display:inline-block; margin:8px 8px 8px 0; padding:10px 14px; border-radius:10px; text-decoration:none; border:0; cursor:pointer; font-size:14px; }
    a { background:#eee; color:#111; }
    button { background:#1f2937; color:white; }
    .validate { background:#047857; color:white; }
    .replace { background:#7c3aed; color:white; }
    .skip { background:#b45309; color:white; }
    input { width:100%; box-sizing:border-box; padding:12px; margin-top:12px; font-size:16px; border:1px solid #ddd; border-radius:8px; }
    .candidates { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; margin-top:24px; }
    .candidate { border:1px solid #ddd; border-radius:14px; padding:12px; background:#fafafa; }
    .candidate img { width:100%; height:180px; object-fit:contain; background:white; border-radius:10px; }
    .candidate-title { font-size:13px; margin:8px 0; min-height:38px; }
    .candidate-source { font-size:12px; color:#666; word-break:break-word; }
    .danger { color:#b91c1c; }
    .pill { display:inline-block; padding:6px 10px; border-radius:999px; background:#eef2ff; margin:4px 8px 4px 0; font-size:13px; }
    .current { margin:22px 0; padding:16px; border:1px solid #e5e7eb; border-radius:14px; }
    .current img { max-width:300px; width:100%; height:260px; object-fit:contain; background:#fafafa; border-radius:12px; }
    .edit-banner { background:#f5f3ff; border:1px solid #ddd6fe; padding:12px; border-radius:12px; margin-bottom:18px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="actions"><a href="/">← Accueil / recherche</a></div>

    ${editMode ? '<div class="edit-banner"><strong>🛠️ Mode correction ciblée</strong> — les autres groupes ne seront pas remis en attente.</div>' : ''}

    <p class="muted">Groupe réel ${index + 1} / ${groups.length}</p>

    <p>
      <span class="pill">${stats.pending} à valider</span>
      <span class="pill">${stats.validated} validés</span>
      <span class="pill">${stats.skipped} passés</span>
    </p>

    <h1>${escapeHtml(group.representativeName)}</h1>
    <p>${group.products?.length || 0} produit(s)</p>
    <p><strong>Genre :</strong> ${escapeHtml(getMainGender(group) || 'non précisé')}</p>
    <p><strong>Statut :</strong> ${escapeHtml(statusLabel(group))}</p>
    <p class="muted">${escapeHtml(group.groupKey)}</p>

    ${
      currentImage
        ? `<div class="current">
            <h2>Image actuelle</h2>
            <img src="${escapeHtml(currentImage)}" alt="Image actuelle" />
            <div class="muted">${escapeHtml(currentImage)}</div>
          </div>`
        : '<p class="muted">Aucune image actuelle.</p>'
    }

    <div class="actions">
      <a target="_blank" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(safeQuery(group))}">Google Images</a>
      <a target="_blank" href="https://www.google.com/search?q=${encodeURIComponent(`${group.representativeName} site:fragrantica.fr/parfum`)}">Fragrantica</a>
      <button onclick="loadCandidates()">🔎 Charger images candidates</button>
      ${editMode ? '' : '<button class="skip" onclick="skip()">Passer</button><a href="/next?from=' + index + '">Groupe pending suivant →</a>'}
    </div>

    <input id="manualUrl" placeholder="Coller une URL image manuellement" value="${escapeHtml(editMode ? '' : (group.imageUrl || ''))}" />
    <button class="${editMode ? 'replace' : 'validate'}" onclick="validateManual()">
      ${editMode ? '🔄 Remplacer par cette URL' : '✅ Valider URL manuelle'}
    </button>

    <p id="message" class="danger"></p>
    <div id="candidates" class="candidates"></div>
  </div>

  <script>
    var loadedCandidates = [];
    var editMode = ${editMode ? 'true' : 'false'};

    async function loadCandidates() {
      const container = document.getElementById('candidates');
      const message = document.getElementById('message');

      message.innerText = '';
      container.innerHTML = '<p>Chargement des images candidates...</p>';

      try {
        const res = await fetch('/api/candidates/${index}');
        const data = await res.json();

        loadedCandidates = data.candidates || [];

        if (loadedCandidates.length === 0) {
          container.innerHTML = '<p>Aucune image candidate fiable trouvée.</p>';
          return;
        }

        container.innerHTML = '';

        loadedCandidates.forEach(function(candidate, candidateIndex) {
          const card = document.createElement('div');
          card.className = 'candidate';

          const img = document.createElement('img');
          img.src = candidate.thumbnail || candidate.imageUrl;
          card.appendChild(img);

          const title = document.createElement('div');
          title.className = 'candidate-title';
          title.innerText = candidate.title || '';
          card.appendChild(title);

          const source = document.createElement('div');
          source.className = 'candidate-source';
          source.innerText = candidate.source || '';
          card.appendChild(source);

          const button = document.createElement('button');
          button.className = editMode ? 'replace' : 'validate';
          button.type = 'button';
          button.innerText = editMode ? '🔄 Remplacer par cette image' : '✅ Choisir cette image';
          button.addEventListener('click', function() {
            validateCandidate(candidateIndex);
          });
          card.appendChild(button);

          container.appendChild(card);
        });
      } catch (error) {
        console.error(error);
        container.innerHTML = '<p>Aucune image candidate fiable trouvée.</p>';
        message.innerText = 'Erreur pendant le chargement des images candidates.';
      }
    }

    async function validateCandidate(candidateIndex) {
      const candidate = loadedCandidates[candidateIndex];

      if (!candidate || !candidate.imageUrl) {
        document.getElementById('message').innerText = 'Image candidate introuvable.';
        return;
      }

      const res = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: candidate.imageUrl,
          sourceUrl: candidate.sourceUrl || '',
          forceDownload: editMode
        })
      });

      if (!res.ok) {
        document.getElementById('message').innerText = 'Erreur pendant l’enregistrement.';
        return;
      }

      window.location.href = editMode ? '/?q=${encodeURIComponent(group.representativeName)}' : '/next?from=${index}';
    }

    async function validateManual() {
      const imageUrl = document.getElementById('manualUrl').value.trim();

      if (!imageUrl) {
        document.getElementById('message').innerText = 'Colle une URL image avant de valider.';
        return;
      }

      const res = await fetch('/api/validate/${index}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          forceDownload: editMode
        })
      });

      if (!res.ok) {
        document.getElementById('message').innerText = 'Erreur pendant l’enregistrement.';
        return;
      }

      window.location.href = editMode ? '/?q=${encodeURIComponent(group.representativeName)}' : '/next?from=${index}';
    }

    async function skip() {
      await fetch('/api/skip/${index}', { method: 'POST' });
      window.location.href = '/next?from=${index}';
    }

    loadCandidates();
  </script>
</body>
</html>
  `);
});

async function getDuckDuckGoVqd(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
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
    'makeup', 'maquillage', 'mascara', 'lipstick', 'robe', 'bag', 'sac',
    'shoes', 'adult', 'porn', 'nude',
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

    if (!vqd) return res.json({ candidates: [] });

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
  const group = groups[index];

  if (!group) {
    return res.status(404).json({ error: 'Groupe introuvable' });
  }

  const imageUrl = String(req.body.imageUrl || '').trim();

  if (!imageUrl) {
    return res.status(400).json({ error: 'URL image manquante' });
  }

  group.imageUrl = imageUrl;
  group.sourceUrl = String(req.body.sourceUrl || '');
  group.status = 'validated';

  if (req.body.forceDownload === true) {
    group.forceDownload = true;
    delete group.downloadError;
  }

  writeGroups(groups);
  res.json({ ok: true, forceDownload: group.forceDownload === true });
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

app.post('/api/finalize', (_req, res) => {
  execFile(
    process.execPath,
    [finalizeScript],
    {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
    },
    (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();

      if (error) {
        console.error(error);
        return res.status(500).json({
          error: error.message,
          output,
        });
      }

      res.json({
        ok: true,
        output,
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`✅ Image Review lancé : http://localhost:${PORT}`);
  console.log('🔎 Recherche/correction ciblée disponible sur la page d’accueil');
});
