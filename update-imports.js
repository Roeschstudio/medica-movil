const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapeo de rutas antiguas a nuevas después de la consolidación
const importMappings = {
  // Chat components consolidados
  '@/components/chat-room-list': '@/components/chat/chat-room-list',
  '@/components/chat-room': '@/components/chat/chat-room',
  
  // Video call components consolidados
  '@/components/video-call/VideoCallInterface': '@/components/video-call/video-call-interface',
  '@/components/video-call/VideoCallPage': '@/components/video-call/video-call-page',
  
  // Auth middleware consolidado
  '@/lib/auth-middleware': '@/lib/auth/auth-middleware',
  '@/lib/auth-config': '@/lib/auth/auth-config',
  
  // Admin components consolidados
  '@/components/admin/notification-bell': '@/components/admin/notification-bell',
  '@/components/admin/admin-guard': '@/components/admin/admin-guard',
  '@/components/admin/main-dashboard': '@/components/admin/main-dashboard',
  
  // Video call services consolidados
  '@/lib/video-call-service': '@/lib/video-call/video-call-service',
  '@/lib/video-call-security': '@/lib/video-call/video-call-security',
  '@/lib/video-call-monitoring': '@/lib/video-call/video-call-monitoring'
};

// Función para actualizar imports en un archivo
function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Buscar y reemplazar imports
    for (const [oldPath, newPath] of Object.entries(importMappings)) {
      const importRegex = new RegExp(
        `(import\\s+.*?\\s+from\\s+['"])${oldPath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(['"])`,
        'g'
      );
      
      if (importRegex.test(content)) {
        content = content.replace(importRegex, `$1${newPath}$2`);
        updated = true;
        console.log(`✓ Actualizado import en ${filePath}: ${oldPath} → ${newPath}`);
      }
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function updateAllImports() {
  console.log('🔄 Iniciando actualización sistemática de imports...');
  
  // Patrones de archivos a procesar
  const patterns = [
    'app/**/*.{ts,tsx,js,jsx}',
    'components/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
    '__tests__/**/*.{ts,tsx,js,jsx}',
    '*.{ts,tsx,js,jsx}'
  ];
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, {
      ignore: [
        'node_modules/**',
        '.next/**',
        '.backup/**',
        'dist/**',
        'build/**'
      ]
    });
    
    files.forEach(file => {
      totalFiles++;
      if (updateImportsInFile(file)) {
        updatedFiles++;
      }
    });
  });
  
  console.log(`\n📊 Resumen:`);
  console.log(`   Archivos procesados: ${totalFiles}`);
  console.log(`   Archivos actualizados: ${updatedFiles}`);
  console.log(`   ✅ Actualización de imports completada`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  updateAllImports();
}

module.exports = { updateAllImports, updateImportsInFile, importMappings };