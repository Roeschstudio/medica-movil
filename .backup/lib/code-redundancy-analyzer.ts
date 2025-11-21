import fs from "fs";
import path from "path";

// Types for redundancy analysis
export interface ComponentDuplicate {
  name: string;
  files: string[];
  similarity: number;
  codeSnippet: string;
  recommendations: string[];
}

export interface UtilityDuplicate {
  functionName: string;
  files: string[];
  similarity: number;
  codeSnippet: string;
  recommendations: string[];
}

export interface UnusedImport {
  file: string;
  importName: string;
  importPath: string;
  line: number;
}

export interface RedundancyReport {
  duplicateComponents: ComponentDuplicate[];
  duplicateUtilities: UtilityDuplicate[];
  unusedImports: UnusedImport[];
  summary: {
    totalDuplicates: number;
    totalUnusedImports: number;
    potentialSavings: string;
  };
  recommendations: string[];
}

export class CodeRedundancyAnalyzer {
  private sourceDirectories: string[] = ["app", "components", "lib", "hooks"];
  private excludePatterns: string[] = [
    "node_modules",
    ".next",
    "dist",
    "build",
  ];

  /**
   * Main method to analyze code redundancy across the codebase
   */
  async analyzeRedundancy(): Promise<RedundancyReport> {
    console.log("Starting code redundancy analysis...");

    const duplicateComponents = await this.scanForDuplicateComponents();
    const duplicateUtilities = await this.scanForDuplicateUtilities();
    const unusedImports = await this.scanForUnusedImports();

    const report: RedundancyReport = {
      duplicateComponents,
      duplicateUtilities,
      unusedImports,
      summary: {
        totalDuplicates: duplicateComponents.length + duplicateUtilities.length,
        totalUnusedImports: unusedImports.length,
        potentialSavings: this.calculatePotentialSavings(
          duplicateComponents,
          duplicateUtilities,
          unusedImports
        ),
      },
      recommendations: this.generateRecommendations(
        duplicateComponents,
        duplicateUtilities,
        unusedImports
      ),
    };

    return report;
  }

  /**
   * Scan for duplicate components across the codebase
   */
  private async scanForDuplicateComponents(): Promise<ComponentDuplicate[]> {
    const componentFiles = await this.getComponentFiles();
    const duplicates: ComponentDuplicate[] = [];
    const componentMap = new Map<
      string,
      { file: string; content: string; name: string }
    >();

    // Parse all component files
    for (const file of componentFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const componentName = this.extractComponentName(content, file);

        if (componentName) {
          const normalizedContent = this.normalizeComponentCode(content);
          const key = `${componentName}_${this.getContentHash(
            normalizedContent
          )}`;

          if (componentMap.has(key)) {
            const existing = componentMap.get(key)!;
            const similarity = this.calculateSimilarity(
              existing.content,
              content
            );

            if (similarity > 0.8) {
              // 80% similarity threshold
              const existingDuplicate = duplicates.find(
                (d) => d.name === componentName
              );
              if (existingDuplicate) {
                existingDuplicate.files.push(file);
              } else {
                duplicates.push({
                  name: componentName,
                  files: [existing.file, file],
                  similarity,
                  codeSnippet: this.extractCodeSnippet(content),
                  recommendations: this.generateComponentRecommendations(
                    componentName,
                    [existing.file, file]
                  ),
                });
              }
            }
          } else {
            componentMap.set(key, {
              file,
              content: normalizedContent,
              name: componentName,
            });
          }
        }
      } catch (error) {
        console.warn(`Error processing component file ${file}:`, error);
      }
    }

    return duplicates;
  }

  /**
   * Scan for duplicate utility functions and helpers
   */
  private async scanForDuplicateUtilities(): Promise<UtilityDuplicate[]> {
    const utilityFiles = await this.getUtilityFiles();
    const duplicates: UtilityDuplicate[] = [];
    const functionMap = new Map<
      string,
      { file: string; content: string; name: string }
    >();

    for (const file of utilityFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const functions = this.extractFunctions(content);

        for (const func of functions) {
          const normalizedContent = this.normalizeFunctionCode(func.content);
          const key = `${func.name}_${this.getContentHash(normalizedContent)}`;

          if (functionMap.has(key)) {
            const existing = functionMap.get(key)!;
            const similarity = this.calculateSimilarity(
              existing.content,
              func.content
            );

            if (similarity > 0.85) {
              // 85% similarity threshold for functions
              const existingDuplicate = duplicates.find(
                (d) => d.functionName === func.name
              );
              if (existingDuplicate) {
                existingDuplicate.files.push(file);
              } else {
                duplicates.push({
                  functionName: func.name,
                  files: [existing.file, file],
                  similarity,
                  codeSnippet: func.content.substring(0, 200) + "...",
                  recommendations: this.generateUtilityRecommendations(
                    func.name,
                    [existing.file, file]
                  ),
                });
              }
            }
          } else {
            functionMap.set(key, {
              file,
              content: normalizedContent,
              name: func.name,
            });
          }
        }
      } catch (error) {
        console.warn(`Error processing utility file ${file}:`, error);
      }
    }

    return duplicates;
  }

  /**
   * Scan for unused imports and dependencies
   */
  private async scanForUnusedImports(): Promise<UnusedImport[]> {
    const allFiles = await this.getAllSourceFiles();
    const unusedImports: UnusedImport[] = [];

    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const imports = this.extractImports(content);

        for (const importItem of imports) {
          if (!this.isImportUsed(content, importItem.name)) {
            unusedImports.push({
              file,
              importName: importItem.name,
              importPath: importItem.path,
              line: importItem.line,
            });
          }
        }
      } catch (error) {
        console.warn(
          `Error processing file for unused imports ${file}:`,
          error
        );
      }
    }

    return unusedImports;
  }

  /**
   * Get all component files using recursive directory scanning
   */
  private async getComponentFiles(): Promise<string[]> {
    const directories = ["components", "app", "src/components"];
    const extensions = [".tsx", ".jsx"];
    const files: string[] = [];

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const foundFiles = this.scanDirectory(dir, extensions);
        files.push(...foundFiles);
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Get all utility files using recursive directory scanning
   */
  private async getUtilityFiles(): Promise<string[]> {
    const directories = ["lib", "hooks", "utils", "helpers"];
    const extensions = [".ts", ".js"];
    const files: string[] = [];

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const foundFiles = this.scanDirectory(dir, extensions);
        files.push(...foundFiles);
      }
    }

    return [...new Set(files)];
  }

  /**
   * Get all source files for import analysis using recursive directory scanning
   */
  private async getAllSourceFiles(): Promise<string[]> {
    const directories = ["app", "components", "lib", "hooks", "src"];
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    const files: string[] = [];

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const foundFiles = this.scanDirectory(dir, extensions);
        files.push(...foundFiles);
      }
    }

    return [...new Set(files)];
  }

  /**
   * Recursively scan directory for files with specific extensions
   */
  private scanDirectory(dirPath: string, extensions: string[]): string[] {
    const files: string[] = [];

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        // Skip excluded patterns
        if (
          this.excludePatterns.some((pattern) => fullPath.includes(pattern))
        ) {
          continue;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Recursively scan subdirectories
          files.push(...this.scanDirectory(fullPath, extensions));
        } else if (stat.isFile()) {
          // Check if file has one of the target extensions
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning directory ${dirPath}:`, error);
    }

    return files;
  } /**
 
  * Extract component name from file content
   */
  private extractComponentName(
    content: string,
    filePath: string
  ): string | null {
    // Try to extract from export default
    const defaultExportMatch = content.match(
      /export\s+default\s+(?:function\s+)?(\w+)/
    );
    if (defaultExportMatch) {
      return defaultExportMatch[1];
    }

    // Try to extract from function declaration
    const functionMatch = content.match(
      /(?:export\s+)?(?:const|function)\s+(\w+)\s*[=:]/
    );
    if (functionMatch) {
      return functionMatch[1];
    }

    // Fallback to filename
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  /**
   * Normalize component code for comparison
   */
  private normalizeComponentCode(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
      .replace(/\/\/.*$/gm, "") // Remove line comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/['"`]/g, '"') // Normalize quotes
      .trim();
  }

  /**
   * Extract functions from file content
   */
  private extractFunctions(
    content: string
  ): Array<{ name: string; content: string }> {
    const functions: Array<{ name: string; content: string }> = [];

    // Match function declarations and arrow functions
    const functionRegex =
      /(?:export\s+)?(?:const|function)\s+(\w+)\s*[=:]?\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*{|{)/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startIndex = match.index;

      // Find the end of the function by counting braces
      let braceCount = 0;
      let endIndex = startIndex;
      let inString = false;
      let stringChar = "";

      for (let i = startIndex; i < content.length; i++) {
        const char = content[i];

        if (!inString && (char === '"' || char === "'" || char === "`")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && content[i - 1] !== "\\") {
          inString = false;
        } else if (!inString) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;

          if (braceCount === 0 && i > startIndex) {
            endIndex = i + 1;
            break;
          }
        }
      }

      const functionContent = content.substring(startIndex, endIndex);
      if (functionContent.length > 20) {
        // Only consider substantial functions
        functions.push({
          name: functionName,
          content: functionContent,
        });
      }
    }

    return functions;
  }

  /**
   * Normalize function code for comparison
   */
  private normalizeFunctionCode(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
      .replace(/\/\/.*$/gm, "") // Remove line comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/['"`]/g, '"') // Normalize quotes
      .replace(/\b\w+(?=\s*[=:])/g, "VAR") // Replace variable names
      .trim();
  }

  /**
   * Extract imports from file content
   */
  private extractImports(
    content: string
  ): Array<{ name: string; path: string; line: number }> {
    const imports: Array<{ name: string; path: string; line: number }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(
        /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"`]([^'"`]+)['"`]/
      );

      if (importMatch) {
        const [, namedImports, defaultImport, importPath] = importMatch;

        if (namedImports) {
          // Handle named imports
          const names = namedImports.split(",").map((name) => name.trim());
          for (const name of names) {
            imports.push({
              name: name.replace(/\s+as\s+\w+/, "").trim(),
              path: importPath,
              line: i + 1,
            });
          }
        } else if (defaultImport) {
          // Handle default import
          imports.push({
            name: defaultImport,
            path: importPath,
            line: i + 1,
          });
        }
      }
    }

    return imports;
  }

  /**
   * Check if an import is used in the file content
   */
  private isImportUsed(content: string, importName: string): boolean {
    // Remove import statements to avoid false positives
    const contentWithoutImports = content.replace(
      /import\s+.*?from\s+['"`][^'"`]+['"`];?/g,
      ""
    );

    // Check for usage patterns
    const usagePatterns = [
      new RegExp(`\\b${importName}\\b`, "g"), // Direct usage
      new RegExp(`${importName}\\.`, "g"), // Property access
      new RegExp(`<${importName}`, "g"), // JSX usage
      new RegExp(`${importName}\\(`, "g"), // Function call
    ];

    return usagePatterns.some((pattern) => pattern.test(contentWithoutImports));
  }

  /**
   * Calculate similarity between two code strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Generate a simple hash for content comparison
   */
  private getContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Extract a code snippet for display
   */
  private extractCodeSnippet(content: string): string {
    const lines = content.split("\n");
    const relevantLines = lines.slice(0, 10).join("\n");
    return relevantLines.length > 200
      ? relevantLines.substring(0, 200) + "..."
      : relevantLines;
  }

  /**
   * Generate recommendations for duplicate components
   */
  private generateComponentRecommendations(
    componentName: string,
    files: string[]
  ): string[] {
    return [
      `Consider consolidating ${componentName} into a single reusable component`,
      `Move the consolidated component to a shared location like components/shared/`,
      `Update all imports to reference the consolidated component`,
      `Add proper TypeScript interfaces for component props`,
      `Consider using composition patterns if components have slight variations`,
    ];
  }

  /**
   * Generate recommendations for duplicate utilities
   */
  private generateUtilityRecommendations(
    functionName: string,
    files: string[]
  ): string[] {
    return [
      `Consolidate ${functionName} into a single utility function`,
      `Move the function to lib/utils.ts or create a dedicated utility file`,
      `Update all imports to reference the consolidated function`,
      `Add proper TypeScript types and JSDoc documentation`,
      `Consider creating a utility class if multiple related functions exist`,
    ];
  }

  /**
   * Calculate potential savings from removing redundancy
   */
  private calculatePotentialSavings(
    duplicateComponents: ComponentDuplicate[],
    duplicateUtilities: UtilityDuplicate[],
    unusedImports: UnusedImport[]
  ): string {
    const componentSavings = duplicateComponents.reduce(
      (acc, dup) => acc + (dup.files.length - 1),
      0
    );
    const utilitySavings = duplicateUtilities.reduce(
      (acc, dup) => acc + (dup.files.length - 1),
      0
    );
    const importSavings = unusedImports.length;

    const totalFiles = componentSavings + utilitySavings;
    const totalLines = totalFiles * 50; // Estimate 50 lines per duplicate

    return `Approximately ${totalFiles} duplicate files and ${importSavings} unused imports could be removed, saving ~${totalLines} lines of code`;
  }

  /**
   * Generate overall recommendations
   */
  private generateRecommendations(
    duplicateComponents: ComponentDuplicate[],
    duplicateUtilities: UtilityDuplicate[],
    unusedImports: UnusedImport[]
  ): string[] {
    const recommendations: string[] = [];

    if (duplicateComponents.length > 0) {
      recommendations.push(
        "Prioritize consolidating duplicate components to improve maintainability",
        "Create a component library structure for shared components",
        "Implement proper TypeScript interfaces for component props"
      );
    }

    if (duplicateUtilities.length > 0) {
      recommendations.push(
        "Consolidate duplicate utility functions into shared modules",
        "Create a comprehensive utils library with proper categorization",
        "Add unit tests for consolidated utility functions"
      );
    }

    if (unusedImports.length > 0) {
      recommendations.push(
        "Remove unused imports to reduce bundle size",
        "Configure ESLint rules to automatically detect unused imports",
        "Set up automated tools to clean up unused imports during build"
      );
    }

    recommendations.push(
      "Implement code review guidelines to prevent future duplication",
      "Set up automated tools to detect code duplication during CI/CD",
      "Create documentation for shared components and utilities"
    );

    return recommendations;
  }
}
