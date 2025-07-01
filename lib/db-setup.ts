import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export { prisma };

// Función para verificar si la base de datos está inicializada
export async function isDatabaseInitialized() {
  try {
    const userCount = await prisma.user.count();
    return userCount > 0;
  } catch (error) {
    return false;
  }
}

// Función para inicializar la base de datos si es necesario
export async function initializeDatabaseIfNeeded() {
  try {
    const isInitialized = await isDatabaseInitialized();
    
    if (!isInitialized) {
      console.log('🔄 Inicializando base de datos...');
      
      // Ejecutar el script de setup
      const { execSync } = require('child_process');
      execSync('node scripts/setup-vercel.js', { stdio: 'inherit' });
      
      console.log('✅ Base de datos inicializada');
    }
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
  }
} 