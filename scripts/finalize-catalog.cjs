const { execSync } = require('child_process');

function run(command) {
  console.log(`\n▶️ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

console.log('🚀 Finalisation du catalogue');

run('node scripts/download-validated-images.cjs');
run('node scripts/build-final-catalog.cjs');

console.log('\n✅ Catalogue finalisé');
console.log('📄 Fichier final : public/data/parfums.json');
