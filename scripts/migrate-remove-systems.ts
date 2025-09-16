import { execSync } from 'child_process';
import { join } from 'path';

console.log('🗃️  Executando migração para remover tabelas roofing_systems e sealing_systems...');

try {
  // Execute the SQL migration script
  const scriptPath = join(__dirname, 'sql', '20250916_remove_roofing_and_sealing_systems.sql');
  
  console.log(`📄 Executando script: ${scriptPath}`);
  
  execSync(`npx tsx scripts/run-sql.ts "${scriptPath}"`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ Migração concluída com sucesso!');
  console.log('');
  console.log('📋 Resumo das alterações:');
  console.log('   • Tabela roofing_systems removida');
  console.log('   • Tabela sealing_systems removida');
  console.log('   • Índices relacionados removidos');
  console.log('   • Constraints de foreign key removidas');
  console.log('');
  console.log('🔧 Próximos passos:');
  console.log('   • O código da aplicação já foi atualizado');
  console.log('   • As funcionalidades relacionadas foram removidas');
  console.log('   • Sistema simplificado e funcional');
  
} catch (error) {
  console.error('❌ Erro durante a migração:', error);
  process.exit(1);
}