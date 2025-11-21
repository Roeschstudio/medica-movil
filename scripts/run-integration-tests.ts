#!/usr/bin/env tsx

/**
 * Comprehensive Integration Test Runner
 * Tests all major integration points and reports results
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  details?: string;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];

  private addResult(
    name: string,
    status: "PASS" | "FAIL" | "SKIP",
    message: string,
    details?: string
  ) {
    this.results.push({ name, status, message, details });
    const emoji = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
    console.log(`${emoji} ${name}: ${message}`);
    if (details) {
      console.log(`   Details: ${details}`);
    }
  }

  async testBuildProcess(): Promise<void> {
    console.log("\n🔍 Testing Build Process...");

    try {
      console.log("Running build...");
      execSync("npm run build", { stdio: "pipe" });
      this.addResult(
        "BUILD_PROCESS",
        "PASS",
        "Application builds successfully"
      );
    } catch (error: any) {
      this.addResult("BUILD_PROCESS", "FAIL", "Build failed", error.message);
    }
  }

  async testLinting(): Promise<void> {
    console.log("\n🔍 Testing ESLint Configuration...");

    try {
      const output = execSync("npm run lint", {
        stdio: "pipe",
        encoding: "utf8",
      });

      // Count warnings and errors
      const lines = output.split("\n");
      const warningLines = lines.filter((line) => line.includes("Warning:"));
      const errorLines = lines.filter((line) => line.includes("Error:"));

      if (errorLines.length === 0) {
        this.addResult(
          "ESLINT_ERRORS",
          "PASS",
          `No ESLint errors found (${warningLines.length} warnings)`
        );
      } else {
        this.addResult(
          "ESLINT_ERRORS",
          "FAIL",
          `${errorLines.length} ESLint errors found`
        );
      }

      if (warningLines.length < 100) {
        this.addResult(
          "ESLINT_WARNINGS",
          "PASS",
          `Acceptable number of warnings: ${warningLines.length}`
        );
      } else {
        this.addResult(
          "ESLINT_WARNINGS",
          "FAIL",
          `Too many warnings: ${warningLines.length}`
        );
      }
    } catch (error: any) {
      this.addResult(
        "ESLINT_CONFIG",
        "FAIL",
        "ESLint execution failed",
        error.message
      );
    }
  }

  async testTypeScript(): Promise<void> {
    console.log("\n🔍 Testing TypeScript Configuration...");

    try {
      execSync("npx tsc --noEmit", { stdio: "pipe" });
      this.addResult(
        "TYPESCRIPT_CHECK",
        "PASS",
        "TypeScript compilation successful"
      );
    } catch (error: any) {
      this.addResult(
        "TYPESCRIPT_CHECK",
        "FAIL",
        "TypeScript compilation failed",
        error.message
      );
    }
  }

  async testFileStructure(): Promise<void> {
    console.log("\n🔍 Testing File Structure...");

    const criticalFiles = [
      "package.json",
      "next.config.js",
      "tsconfig.json",
      ".eslintrc.json",
      "prisma/schema.prisma",
      "lib/supabase-client.ts",
      "lib/supabase-server.ts",
      "lib/prisma.ts",
      "middleware.ts",
    ];

    for (const file of criticalFiles) {
      if (existsSync(file)) {
        this.addResult(
          `FILE_${file.replace(/[/.]/g, "_").toUpperCase()}`,
          "PASS",
          `File exists: ${file}`
        );
      } else {
        this.addResult(
          `FILE_${file.replace(/[/.]/g, "_").toUpperCase()}`,
          "FAIL",
          `Missing file: ${file}`
        );
      }
    }
  }

  async testEnvironmentSetup(): Promise<void> {
    console.log("\n🔍 Testing Environment Setup...");

    const requiredEnvVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.addResult(`ENV_${envVar}`, "PASS", `Environment variable is set`);
      } else {
        this.addResult(
          `ENV_${envVar}`,
          "FAIL",
          `Missing environment variable: ${envVar}`
        );
      }
    }

    // Check .env file exists
    if (existsSync(".env")) {
      this.addResult("ENV_FILE", "PASS", ".env file exists");
    } else {
      this.addResult("ENV_FILE", "FAIL", ".env file missing");
    }
  }

  async testDependencies(): Promise<void> {
    console.log("\n🔍 Testing Dependencies...");

    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

      const criticalDeps = [
        "next",
        "react",
        "react-dom",
        "@supabase/supabase-js",
        "@supabase/ssr",
        "stripe",
        "prisma",
        "@prisma/client",
        "next-auth",
      ];

      for (const dep of criticalDeps) {
        if (
          packageJson.dependencies?.[dep] ||
          packageJson.devDependencies?.[dep]
        ) {
          this.addResult(
            `DEP_${dep.replace(/[@/]/g, "_").toUpperCase()}`,
            "PASS",
            `Dependency installed: ${dep}`
          );
        } else {
          this.addResult(
            `DEP_${dep.replace(/[@/]/g, "_").toUpperCase()}`,
            "FAIL",
            `Missing dependency: ${dep}`
          );
        }
      }
    } catch (error: any) {
      this.addResult(
        "DEPENDENCIES_CHECK",
        "FAIL",
        "Failed to check dependencies",
        error.message
      );
    }
  }

  async testAPIRoutes(): Promise<void> {
    console.log("\n🔍 Testing API Route Structure...");

    const apiRoutes = [
      "app/api/auth",
      "app/api/chat",
      "app/api/appointments",
      "app/api/payments",
      "app/api/video",
      "app/api/admin",
    ];

    for (const route of apiRoutes) {
      if (existsSync(route)) {
        this.addResult(
          `API_${route.replace(/[/]/g, "_").toUpperCase()}`,
          "PASS",
          `API route exists: ${route}`
        );
      } else {
        this.addResult(
          `API_${route.replace(/[/]/g, "_").toUpperCase()}`,
          "FAIL",
          `Missing API route: ${route}`
        );
      }
    }
  }

  async testComponentStructure(): Promise<void> {
    console.log("\n🔍 Testing Component Structure...");

    const criticalComponents = [
      "components/ui",
      "components/chat",
      "components/video-call",
      "components/payment-integration",
      "hooks",
      "lib",
    ];

    for (const component of criticalComponents) {
      if (existsSync(component)) {
        this.addResult(
          `COMP_${component.replace(/[/-]/g, "_").toUpperCase()}`,
          "PASS",
          `Component directory exists: ${component}`
        );
      } else {
        this.addResult(
          `COMP_${component.replace(/[/-]/g, "_").toUpperCase()}`,
          "FAIL",
          `Missing component directory: ${component}`
        );
      }
    }
  }

  async testDatabaseSchema(): Promise<void> {
    console.log("\n🔍 Testing Database Schema...");

    try {
      if (existsSync("prisma/schema.prisma")) {
        const schema = readFileSync("prisma/schema.prisma", "utf8");

        const requiredModels = [
          "User",
          "Appointment",
          "ChatRoom",
          "Message",
          "Payment",
        ];

        for (const model of requiredModels) {
          if (schema.includes(`model ${model}`)) {
            this.addResult(
              `SCHEMA_${model.toUpperCase()}`,
              "PASS",
              `Model exists: ${model}`
            );
          } else {
            this.addResult(
              `SCHEMA_${model.toUpperCase()}`,
              "FAIL",
              `Missing model: ${model}`
            );
          }
        }

        // Check for Supabase configuration
        if (schema.includes("supabase")) {
          this.addResult(
            "SCHEMA_SUPABASE",
            "PASS",
            "Supabase configuration found"
          );
        } else {
          this.addResult(
            "SCHEMA_SUPABASE",
            "SKIP",
            "No Supabase configuration in schema"
          );
        }
      } else {
        this.addResult("SCHEMA_FILE", "FAIL", "Prisma schema file missing");
      }
    } catch (error: any) {
      this.addResult(
        "SCHEMA_CHECK",
        "FAIL",
        "Failed to check schema",
        error.message
      );
    }
  }

  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Comprehensive Integration Tests...\n");

    await this.testFileStructure();
    await this.testEnvironmentSetup();
    await this.testDependencies();
    await this.testDatabaseSchema();
    await this.testAPIRoutes();
    await this.testComponentStructure();
    await this.testTypeScript();
    await this.testLinting();
    await this.testBuildProcess();

    this.generateReport();
  }

  private generateReport(): void {
    console.log("\n📊 Integration Test Report");
    console.log("=".repeat(50));

    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const skipped = this.results.filter((r) => r.status === "SKIP").length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`📊 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.message}`);
          if (r.details) {
            console.log(`     Details: ${r.details.substring(0, 200)}...`);
          }
        });
    }

    const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
    console.log(`\n🎯 Success Rate: ${successRate}%`);

    if (failed === 0) {
      console.log(
        "\n🎉 All integration tests passed! The application is ready for deployment."
      );
    } else if (failed <= 3) {
      console.log(
        "\n⚠️ Minor issues found. The application should work but may need attention."
      );
    } else {
      console.log(
        "\n🚨 Multiple issues found. Please review and fix the issues above."
      );
    }

    // Summary recommendations
    console.log("\n📋 Recommendations:");
    if (failed === 0) {
      console.log("   - Application is ready for production deployment");
      console.log("   - Consider setting up monitoring and logging");
      console.log("   - Run end-to-end tests in staging environment");
    } else {
      console.log("   - Fix critical build and TypeScript errors first");
      console.log("   - Address missing environment variables");
      console.log("   - Review and fix ESLint errors");
      console.log("   - Ensure all required dependencies are installed");
    }
  }
}

// Run the tests
async function main() {
  const runner = new IntegrationTestRunner();
  await runner.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { IntegrationTestRunner };
