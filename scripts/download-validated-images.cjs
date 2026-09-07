const fs = require('fs');
const path = require('path');

const groupsPath = path.join(
  __dirname,
  '../public/data/product-image-groups.json'
);

const imagesDir = path.join(__dirname, '../public/images/parfums');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function getExtensionFromUrl(url) {
  const cleanUrl = String(url).split('?')[0].toLowerCase();

  if (cleanUrl.endsWith('.png')) return '.png';
  if (cleanUrl.endsWith('.webp')) return '.webp';
  if (cleanUrl.endsWith('.jpeg')) return '.jpg';
  if (cleanUrl.endsWith('.jpg')) return '.jpg';

  return '.jpg';
}

function publicPathToLocalPath(publicPath) {
  if (!publicPath || !String(publicPath).startsWith('/images/parfums/')) {
    return null;
  }

  return path.join(imagesDir, path.basename(publicPath));
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.startsWith('image/')) {
    throw new Error(`Contenu non image : ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 1000) {
    throw new Error('Image trop petite ou invalide');
  }

  fs.writeFileSync(outputPath, buffer);
}

async function main() {
  const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));

  let downloaded = 0;
  let reused = 0;
  let forced = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    if (group.status !== 'validated' || !group.imageUrl) {
      skipped++;
      continue;
    }

    const ext = getExtensionFromUrl(group.imageUrl);
    const fileName = `${slugify(group.representativeName)}${ext}`;
    const localPath = path.join(imagesDir, fileName);
    const publicPath = `/images/parfums/${fileName}`;
    const forceDownload = group.forceDownload === true;
    const previousLocalPath = publicPathToLocalPath(group.localImage);

    try {
      if (fs.existsSync(localPath) && !forceDownload) {
        group.localImage = publicPath;
        delete group.downloadError;
        reused++;
        console.log(`♻️ ${i + 1}/${groups.length} déjà présente : ${fileName}`);
        continue;
      }

      if (forceDownload) {
        console.log(`🔄 ${i + 1}/${groups.length} remplacement : ${group.representativeName}`);
      } else {
        console.log(`⬇️ ${i + 1}/${groups.length} ${group.representativeName}`);
      }

      // On télécharge d'abord dans un fichier temporaire.
      // Ainsi, si le téléchargement échoue, l'ancienne image locale reste intacte.
      const tempPath = `${localPath}.tmp`;

      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      await downloadImage(group.imageUrl, tempPath);

      // Remplacement atomique du fichier cible.
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }

      fs.renameSync(tempPath, localPath);

      // Si l'extension / le nom local a changé, supprimer l'ancien fichier
      // seulement après que la nouvelle image a été téléchargée avec succès.
      if (
        previousLocalPath &&
        previousLocalPath !== localPath &&
        fs.existsSync(previousLocalPath)
      ) {
        fs.unlinkSync(previousLocalPath);
      }

      group.localImage = publicPath;
      delete group.downloadError;

      if (forceDownload) {
        delete group.forceDownload;
        forced++;
        console.log(`✅ Remplacée : ${fileName}`);
      } else {
        downloaded++;
        console.log(`✅ Téléchargée : ${fileName}`);
      }
    } catch (error) {
      failed++;
      group.downloadError = error.message;

      // On garde forceDownload=true en cas d'échec :
      // un prochain clic sur "Finaliser" retentera automatiquement.
      console.log(`❌ Échec : ${group.representativeName} — ${error.message}`);
    }

    fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf8');
  }

  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf8');

  console.log('\n🎉 Téléchargement terminé');
  console.log(`✅ Téléchargées : ${downloaded}`);
  console.log(`🔄 Remplacées    : ${forced}`);
  console.log(`♻️ Réutilisées   : ${reused}`);
  console.log(`⚠️ Ignorées      : ${skipped}`);
  console.log(`❌ Échecs        : ${failed}`);
  console.log(`📁 Dossier       : ${imagesDir}`);
}

main().catch((error) => {
  console.error('Erreur fatale :', error);
  process.exit(1);
});
