const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Función para corregir errores de sintaxis comunes en archivos de test
function fixTestSyntax(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Corregir imports JSX mal formateados
    const jsxImportRegex = /import\s+([^\s]+)\s+from\s+['"]([^'"]+)['"];?\s*<([^>]+)>/g;
    if (jsxImportRegex.test(content)) {
      content = content.replace(jsxImportRegex, (match, importName, importPath, jsxContent) => {
        return `import ${importName} from "${importPath}";\n// JSX content moved: <${jsxContent}>`;
      });
      updated = true;
    }
    
    // Corregir JSX mal cerrado en imports
    const malformedJSXRegex = /(import[^;]+;)\s*(<[^>]*>)/g;
    if (malformedJSXRegex.test(content)) {
      content = content.replace(malformedJSXRegex, '$1\n// Moved JSX: $2');
      updated = true;
    }
    
    // Corregir expresiones regulares no terminadas
    const unterminatedRegexRegex = /(render\(\s*<[^>]+)\s*\/\s*>/g;
    if (unterminatedRegexRegex.test(content)) {
      content = content.replace(unterminatedRegexRegex, '$1 />');
      updated = true;
    }
    
    // Corregir JSX mal formateado en render calls
    const renderCallRegex = /render\(\s*<([^\s>]+)([^>]*)>([^<]*)<\/([^>]+)>\s*\)/g;
    content = content.replace(renderCallRegex, (match, tagName, attributes, children, closingTag) => {
      if (tagName === closingTag) {
        return `render(<${tagName}${attributes}>${children}</${closingTag}>)`;
      }
      return match;
    });
    
    // Corregir JSX self-closing mal formateado
    const selfClosingRegex = /render\(\s*<([^\s>]+)([^>]*?)\s*\/\s*>\s*\)/g;
    content = content.replace(selfClosingRegex, 'render(<$1$2 />)');
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Corregido sintaxis en ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function fixAllTestSyntax() {
  console.log('🔧 Iniciando corrección de sintaxis en archivos de test...');
  
  const testFiles = glob.sync('__tests__/**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', '.next/**', '.backup/**']
  });
  
  let totalFiles = 0;
  let fixedFiles = 0;
  
  testFiles.forEach(file => {
    totalFiles++;
    if (fixTestSyntax(file)) {
      fixedFiles++;
    }
  });
  
  console.log(`\n📊 Resumen de corrección de sintaxis:`);
  console.log(`   Archivos de test procesados: ${totalFiles}`);
  console.log(`   Archivos corregidos: ${fixedFiles}`);
  console.log(`   ✅ Corrección de sintaxis completada`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixAllTestSyntax();
}

module.exports = { fixAllTestSyntax, fixTestSyntax };