const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const groupsPath = path.join(
  __dirname,
  '../public/data/product-image-groups-missing.json'
);

const imagesDir = path.join(
  __dirname,
  '../public/images/parfums'
);

const reportPath = path.join(
  __dirname,
  '../public/data/missing-images-download-report.json'
);

fs.mkdirSync(imagesDir, { recursive: true });

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function extensionFromContentType(type) {
  const mime = type.split(';')[0].trim().toLowerCase();

  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/jpeg') return '.jpg';

  throw new Error(`Format non pris en charge : ${mime}`);
}

async function downloadImage(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'image/webp,image/png,image/jpeg,image/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const extension = extensionFromContentType(contentType);

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length < 1000) {
    throw new Error('Image trop petite ou invalide');
  }

  return { buffer, extension };
}

async function main() {
  const groups = JSON.parse(
    fs.readFileSync(groupsPath, 'utf8')
  );

  const report = {
    totalGroups: groups.length,
    downloaded: 0,
    reused: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    if (group.status !== 'validated' || !group.imageUrl) {
      report.skipped++;
      continue;
    }

    const hash = crypto
      .createHash('sha256')
      .update(group.representativeName)
      .digest('hex')
      .slice(0, 10);

    const baseName = `missing-${slugify(group.representativeName)}-${hash}`;

    try {
      // Réutilisation d'un téléchargement précédent.
      const existing = ['.jpg', '.png', '.webp']
        .map(ext => `${baseName}${ext}`)
        .find(name => fs.existsSync(path.join(imagesDir, name)));

      if (existing) {
        group.localImage = `/images/parfums/${existing}`;
        delete group.downloadError;
        report.reused++;

        console.log(`♻️ ${i + 1}/${groups.length} ${existing}`);
        continue;
      }

      console.log(`⬇️ ${i + 1}/${groups.length} ${group.representativeName}`);

      const { buffer, extension } = await downloadImage(group.imageUrl);

      const fileName = `${baseName}${extension}`;
      const targetPath = path.join(imagesDir, fileName);

      // wx refuse d'écraser un fichier existant.
      fs.writeFileSync(targetPath, buffer, { flag: 'wx' });

      group.localImage = `/images/parfums/${fileName}`;
      delete group.downloadError;

      report.downloaded++;

      console.log(`✅ ${fileName}`);
    } catch (error) {
      report.failed++;
      group.downloadError = error.message;

      report.errors.push({
        name: group.representativeName,
        url: group.imageUrl,
        error: error.message
      });

      console.log(`❌ ${group.representativeName} : ${error.message}`);
    } finally {
      fs.writeFileSync(
        groupsPath,
        JSON.stringify(groups, null, 2),
        'utf8'
      );
    }
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log('\n📊 CAMPAGNE IMAGES MANQUANTES');
  console.log('────────────────────────────');
  console.log(`📦 Groupes             : ${report.totalGroups}`);
  console.log(`✅ Téléchargées        : ${report.downloaded}`);
  console.log(`♻️ Réutilisées         : ${report.reused}`);
  console.log(`⏭️ Ignorées            : ${report.skipped}`);
  console.log(`❌ Échecs              : ${report.failed}`);
  console.log(`📄 Rapport             : ${reportPath}`);
  console.log('\n🔒 Catalogue inchangé.');
}

main().catch(error => {
  console.error('Erreur fatale :', error);
  process.exit(1);
});
