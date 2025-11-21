#!/usr/bin/env node

import fs from "fs";
import { CodeRedundancyAnalyzer } from "../lib/code-redundancy-analyzer";

/**
 * Debug script to see what files are being processed by the redundancy analyzer
 */
async function debugRedundancyAnalyzer(): Promise<void> {
  console.log("🔍 Debugging Code Redundancy Analyzer...");

  try {
    const analyzer = new CodeRedundancyAnalyzer();

    // Access private methods through type assertion for debugging
    const analyzerAny = analyzer as any;

    console.log("\n📁 Component Files:");
    const componentFiles = await analyzerAny.getComponentFiles();
    console.log(`Found ${componentFiles.length} component files:`);
    componentFiles
      .slice(0, 10)
      .forEach((file: string) => console.log(`  - ${file}`));
    if (componentFiles.length > 10) {
      console.log(`  ... and ${componentFiles.length - 10} more`);
    }

    console.log("\n⚙️ Utility Files:");
    const utilityFiles = await analyzerAny.getUtilityFiles();
    console.log(`Found ${utilityFiles.length} utility files:`);
    utilityFiles
      .slice(0, 10)
      .forEach((file: string) => console.log(`  - ${file}`));
    if (utilityFiles.length > 10) {
      console.log(`  ... and ${utilityFiles.length - 10} more`);
    }

    console.log("\n📄 All Source Files:");
    const allFiles = await analyzerAny.getAllSourceFiles();
    console.log(`Found ${allFiles.length} source files total`);

    // Sample a few files to check for imports
    console.log("\n🔍 Sample Import Analysis:");
    const sampleFiles = componentFiles.slice(0, 3);
    for (const file of sampleFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const imports = analyzerAny.extractImports(content);
        console.log(`\n${file}:`);
        console.log(`  - ${imports.length} imports found`);
        imports.slice(0, 3).forEach((imp: any) => {
          const isUsed = analyzerAny.isImportUsed(content, imp.name);
          console.log(
            `    • ${imp.name} from ${imp.path} (line ${imp.line}) - ${
              isUsed ? "USED" : "UNUSED"
            }`
          );
        });
      } catch (error) {
        console.log(`  Error reading ${file}: ${error}`);
      }
    }

    // Check for potential duplicates manually
    console.log("\n🔄 Manual Duplicate Check:");
    const componentNames = new Map<string, string[]>();

    for (const file of componentFiles.slice(0, 20)) {
      // Check first 20 files
      try {
        const content = fs.readFileSync(file, "utf-8");
        const componentName = analyzerAny.extractComponentName(content, file);

        if (componentName) {
          if (!componentNames.has(componentName)) {
            componentNames.set(componentName, []);
          }
          componentNames.get(componentName)!.push(file);
        }
      } catch (error) {
        console.log(`Error processing ${file}: ${error}`);
      }
    }

    console.log("Components by name:");
    for (const [name, files] of componentNames.entries()) {
      if (files.length > 1) {
        console.log(`  🔄 ${name}: ${files.length} files`);
        files.forEach((file) => console.log(`    - ${file}`));
      } else {
        console.log(`  ✅ ${name}: 1 file`);
      }
    }
  } catch (error) {
    console.error("❌ Debug failed:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Run the debug
if (require.main === module) {
  debugRedundancyAnalyzer();
}

export { debugRedundancyAnalyzer };
