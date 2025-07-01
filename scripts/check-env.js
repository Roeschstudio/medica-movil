// Script para verificar variables de entorno
console.log('🔍 Verificando variables de entorno...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL preview:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NO ENCONTRADA');
console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada!');
  process.exit(1);
}

if (!process.env.DATABASE_URL.includes('postgresql://')) {
  console.error('❌ DATABASE_URL no es PostgreSQL!');
  console.error('Actual:', process.env.DATABASE_URL);
  process.exit(1);
}

console.log('✅ Variables de entorno correctas'); 