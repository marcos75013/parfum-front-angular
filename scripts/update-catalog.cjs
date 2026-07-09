const { execSync } = require('child_process');

function run(command) {
  console.log(`\n▶️ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

console.log('🚀 Préparation du catalogue mensuel');

run('node scripts/generate-image-worklist.cjs');
run('node scripts/generate-image-groups.cjs');

console.log('\n✅ Préparation terminée');
console.log('👉 Lance maintenant :');
console.log('node scripts/image-review-server.cjs');
