const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Función para actualizar imports en un archivo
function updateImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Reemplazar imports de @/lib/prisma con @/lib/db
    const updatedContent = content.replace(
      /from ['"]@\/lib\/prisma['"]/g,
      'from "@/lib/db"'
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ Actualizado: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función para buscar archivos recursivamente
function findFilesWithImports(dir, filesToUpdate = new Set()) {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Excluir directorios específicos
        if (!['node_modules', '.backup', '.git', 'dist', 'build'].includes(item)) {
          findFilesWithImports(fullPath, filesToUpdate);
        }
      } else if (stat.isFile()) {
        // Procesar solo archivos TypeScript y JavaScript
        if (/\.(ts|tsx|js|jsx)$/.test(item)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('from "@/lib/db"') || content.includes("from "@/lib/db"")) {
              filesToUpdate.add(fullPath);
            }
          } catch (error) {
            // Ignorar archivos que no se pueden leer
          }
        }
      }
    }
  } catch (error) {
    // Ignorar directorios que no se pueden leer
  }
  
  return filesToUpdate;
}

// Función principal
function updateAllImports() {
  console.log('🔄 Iniciando actualización de imports...');
  
  try {
    // Buscar todos los archivos que importan de @/lib/prisma
    const filesToUpdate = findFilesWithImports(process.cwd());
    
    console.log(`📁 Encontrados ${filesToUpdate.size} archivos para actualizar`);
    
    let updatedCount = 0;
    filesToUpdate.forEach(filePath => {
      if (updateImportsInFile(filePath)) {
        updatedCount++;
      }
    });
    
    console.log(`\n✨ Proceso completado:`);
    console.log(`   - Archivos procesados: ${filesToUpdate.size}`);
    console.log(`   - Archivos actualizados: ${updatedCount}`);
    console.log(`   - Sin cambios: ${filesToUpdate.size - updatedCount}`);
    
  } catch (error) {
    console.error('❌ Error durante la actualización:', error.message);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  updateAllImports();
}

module.exports = { updateAllImports, updateImportsInFile };