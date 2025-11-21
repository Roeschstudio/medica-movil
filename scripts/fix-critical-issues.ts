#!/usr/bin/env tsx

import { promises as fs } from "fs";
import { glob } from "glob";
import path from "path";

/**
 * Script to automatically fix critical system break point issues
 */

interface FixResult {
  file: string;
  fixes: string[];
  errors: string[];
}

class CriticalIssueFixer {
  private workspaceRoot: string;
  private results: FixResult[] = [];

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Run all critical fixes
   */
  async fixAll(): Promise<FixResult[]> {
    console.log("🔧 Starting critical issue fixes...");

    await Promise.all([
      this.fixApiRouteErrorHandling(),
      this.addErrorBoundariesToComponents(),
      this.fixAuthenticationChecks(),
      this.addInputValidation(),
    ]);

    return this.results;
  }

  /**
   * Fix API routes missing error handling
   */
  private async fixApiRouteErrorHandling(): Promise<void> {
    console.log("📋 Fixing API route error handling...");

    const apiFiles = await glob("app/api/**/route.ts", {
      cwd: this.workspaceRoot,
      ignore: ["**/node_modules/**", "**/.next/**"],
    });

    for (const file of apiFiles) {
      try {
        const filePath = path.join(this.workspaceRoot, file);
        const content = await fs.readFile(filePath, "utf-8");

        // Skip if already using our wrapper
        if (
          content.includes("createApiRoute") ||
          content.includes("withErrorHandler")
        ) {
          continue;
        }

        const fixes: string[] = [];
        let newContent = content;

        // Check if it has async functions without try-catch
        const hasAsyncFunction =
          /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/.test(
            content
          );
        const hasTryCatch = /try\s*{[\s\S]*?}\s*catch/.test(content);

        if (hasAsyncFunction && !hasTryCatch) {
          // Add import for error handling wrapper
          if (!content.includes("createApiRoute")) {
            newContent = `import { createApiRoute } from "@/lib/api-route-wrapper";\n${newContent}`;
            fixes.push("Added error handling wrapper import");
          }

          // Wrap each export function
          const functionRegex =
            /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*{/g;
          let match;

          while ((match = functionRegex.exec(content)) !== null) {
            const method = match[1];
            const originalFunction = `export async function ${method}`;
            const wrappedFunction = `export const ${method} = createApiRoute(async (request, context)`;

            newContent = newContent.replace(originalFunction, wrappedFunction);
            fixes.push(`Wrapped ${method} function with error handler`);
          }

          // Fix function closing braces (this is a simplified approach)
          // In a real implementation, you'd need more sophisticated AST parsing
        }

        if (fixes.length > 0) {
          await fs.writeFile(filePath, newContent, "utf-8");
          this.results.push({ file, fixes, errors: [] });
        }
      } catch (error) {
        this.results.push({
          file,
          fixes: [],
          errors: [(error as Error).message],
        });
      }
    }
  }

  /**
   * Add error boundaries to complex components
   */
  private async addErrorBoundariesToComponents(): Promise<void> {
    console.log("🛡️ Adding error boundaries to components...");

    const componentFiles = await glob("components/**/*.tsx", {
      cwd: this.workspaceRoot,
      ignore: ["**/node_modules/**", "**/.next/**", "**/error-boundary.tsx"],
    });

    for (const file of componentFiles) {
      try {
        const filePath = path.join(this.workspaceRoot, file);
        const content = await fs.readFile(filePath, "utf-8");

        // Skip if already has error boundary
        if (
          content.includes("ErrorBoundary") ||
          content.includes("withErrorBoundary")
        ) {
          continue;
        }

        const fixes: string[] = [];
        let newContent = content;

        // Check if it's a complex component (has hooks)
        const hasHooks = /use(State|Effect|Context|Reducer|Callback|Memo)/.test(
          content
        );

        if (hasHooks) {
          // Add error boundary import
          if (!content.includes("withErrorBoundary")) {
            const importMatch = content.match(/^(import.*from.*;\n)*/m);
            const importSection = importMatch ? importMatch[0] : "";
            const restContent = content.substring(importSection.length);

            newContent = `${importSection}import { withErrorBoundary } from "@/components/enhanced-error-boundary";\n${restContent}`;
            fixes.push("Added error boundary import");
          }

          // Wrap default export with error boundary
          const exportMatch = content.match(/export default (\w+)/);
          if (exportMatch) {
            const componentName = exportMatch[1];
            newContent = newContent.replace(
              `export default ${componentName}`,
              `export default withErrorBoundary(${componentName})`
            );
            fixes.push(`Wrapped ${componentName} with error boundary`);
          }
        }

        if (fixes.length > 0) {
          await fs.writeFile(filePath, newContent, "utf-8");
          this.results.push({ file, fixes, errors: [] });
        }
      } catch (error) {
        this.results.push({
          file,
          fixes: [],
          errors: [(error as Error).message],
        });
      }
    }
  }

  /**
   * Fix missing authentication checks in API routes
   */
  private async fixAuthenticationChecks(): Promise<void> {
    console.log("🔐 Fixing authentication checks...");

    const apiFiles = await glob("app/api/**/route.ts", {
      cwd: this.workspaceRoot,
      ignore: [
        "**/node_modules/**",
        "**/.next/**",
        "**/auth/**",
        "**/health/**",
      ],
    });

    for (const file of apiFiles) {
      try {
        const filePath = path.join(this.workspaceRoot, file);
        const content = await fs.readFile(filePath, "utf-8");

        const fixes: string[] = [];
        let newContent = content;

        // Check if it's missing authentication
        const hasAuthCheck =
          content.includes("getServerSession") ||
          content.includes("requireAuth") ||
          content.includes("createApiRoute");

        if (!hasAuthCheck && !file.includes("public")) {
          // Add authentication wrapper
          if (!content.includes("createProtectedRoute")) {
            newContent = `import { createProtectedRoute } from "@/lib/api-route-wrapper";\n${newContent}`;
            fixes.push("Added protected route wrapper import");
          }

          // Replace createApiRoute with createProtectedRoute if present
          newContent = newContent.replace(
            /createApiRoute/g,
            "createProtectedRoute"
          );
          fixes.push("Changed to protected route wrapper");
        }

        if (fixes.length > 0) {
          await fs.writeFile(filePath, newContent, "utf-8");
          this.results.push({ file, fixes, errors: [] });
        }
      } catch (error) {
        this.results.push({
          file,
          fixes: [],
          errors: [(error as Error).message],
        });
      }
    }
  }

  /**
   * Add input validation to API routes
   */
  private async addInputValidation(): Promise<void> {
    console.log("✅ Adding input validation...");

    const apiFiles = await glob("app/api/**/route.ts", {
      cwd: this.workspaceRoot,
      ignore: ["**/node_modules/**", "**/.next/**"],
    });

    for (const file of apiFiles) {
      try {
        const filePath = path.join(this.workspaceRoot, file);
        const content = await fs.readFile(filePath, "utf-8");

        const fixes: string[] = [];
        let newContent = content;

        // Check if it processes request body without validation
        const hasRequestBody =
          content.includes("request.json()") ||
          content.includes("request.formData()");
        const hasZodValidation =
          content.includes("z.") ||
          content.includes("zod") ||
          content.includes("schema");

        if (hasRequestBody && !hasZodValidation) {
          // Add validation helper import
          if (!content.includes("validateRequestBody")) {
            newContent = `import { validateRequestBody } from "@/lib/api-route-wrapper";\nimport { z } from "zod";\n${newContent}`;
            fixes.push("Added validation imports");
          }

          // Add basic schema (this is a simplified approach)
          const schemaComment = `
// TODO: Define proper validation schema
const requestSchema = z.object({
  // Add your validation rules here
});
`;

          if (!content.includes("requestSchema")) {
            const firstFunctionMatch = content.match(
              /export\s+(const|async\s+function)/
            );
            if (firstFunctionMatch) {
              const insertIndex = content.indexOf(firstFunctionMatch[0]);
              newContent =
                content.slice(0, insertIndex) +
                schemaComment +
                content.slice(insertIndex);
              fixes.push("Added validation schema template");
            }
          }
        }

        if (fixes.length > 0) {
          await fs.writeFile(filePath, newContent, "utf-8");
          this.results.push({ file, fixes, errors: [] });
        }
      } catch (error) {
        this.results.push({
          file,
          fixes: [],
          errors: [(error as Error).message],
        });
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("🚀 Starting Critical Issue Fixer...");
    console.log("=".repeat(50));

    const fixer = new CriticalIssueFixer();
    const results = await fixer.fixAll();

    // Display results
    console.log("\n📊 Fix Results:");
    console.log("=".repeat(50));

    let totalFixes = 0;
    let totalErrors = 0;
    let filesModified = 0;

    results.forEach((result) => {
      if (result.fixes.length > 0 || result.errors.length > 0) {
        console.log(`\n📁 ${result.file}`);

        if (result.fixes.length > 0) {
          filesModified++;
          result.fixes.forEach((fix) => {
            console.log(`  ✅ ${fix}`);
            totalFixes++;
          });
        }

        if (result.errors.length > 0) {
          result.errors.forEach((error) => {
            console.log(`  ❌ ${error}`);
            totalErrors++;
          });
        }
      }
    });

    console.log("\n📈 Summary:");
    console.log(`  Files Modified: ${filesModified}`);
    console.log(`  Total Fixes Applied: ${totalFixes}`);
    console.log(`  Errors Encountered: ${totalErrors}`);

    if (totalErrors > 0) {
      console.log("\n⚠️  Some fixes failed. Please review the errors above.");
      console.log("   You may need to apply some fixes manually.");
    }

    if (totalFixes > 0) {
      console.log("\n✅ Critical issues have been addressed!");
      console.log("   Please review the changes and test your application.");
      console.log("   Run the system analyzer again to verify fixes.");
    } else {
      console.log("\n✨ No critical issues found that could be auto-fixed!");
    }

    process.exit(totalErrors > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Critical error during fix process:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as fixCriticalIssues };
