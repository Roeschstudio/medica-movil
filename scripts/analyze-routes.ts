#!/usr/bin/env tsx

import { writeFile } from "fs/promises";
import { join } from "path";
import {
  RouteConflictAnalyzer,
  generateRouteReport,
} from "../lib/route-conflict-analyzer";

/**
 * CLI script to analyze route conflicts and generate reports
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "analyze";
  const appDirectory = args[1] || "./app";
  const outputFile = args[2] || "./reports/route-analysis-report.md";

  console.log("🔍 Route Conflict Analyzer");
  console.log("==========================\n");

  try {
    const analyzer = new RouteConflictAnalyzer(appDirectory);

    switch (command) {
      case "scan":
        console.log("📂 Scanning dynamic routes...\n");
        const routes = await analyzer.scanDynamicRoutes();

        console.log(`Found ${routes.length} dynamic routes:\n`);
        for (const route of routes) {
          console.log(`  📍 ${route.path}`);
          console.log(
            `     Parameters: ${route.parameters
              .map((p) => `[${p}]`)
              .join(", ")}`
          );
          console.log(`     Type: ${route.routeType}`);
          console.log(`     Files: ${route.files.length}\n`);
        }
        break;

      case "validate":
        console.log("✅ Validating route consistency...\n");
        const validation = await analyzer.validateRouteConsistency();

        console.log(`📊 Validation Results:`);
        console.log(`   Total Routes: ${validation.summary.totalRoutes}`);
        console.log(`   Total Conflicts: ${validation.summary.totalConflicts}`);
        console.log(`   Critical: ${validation.summary.criticalConflicts}`);
        console.log(`   Warnings: ${validation.summary.warningConflicts}`);
        console.log(
          `   Status: ${validation.isValid ? "✅ Valid" : "❌ Issues Found"}\n`
        );

        if (validation.conflicts.length > 0) {
          console.log("🚨 Conflicts Found:\n");
          for (const conflict of validation.conflicts) {
            const icon =
              conflict.severity === "critical"
                ? "🚨"
                : conflict.severity === "warning"
                ? "⚠️"
                : "ℹ️";
            console.log(
              `${icon} ${conflict.severity.toUpperCase()}: ${conflict.path}`
            );
            console.log(
              `   Parameters: ${conflict.conflictingParams.join(", ")}`
            );
            console.log(`   Files: ${conflict.affectedFiles.length}`);
            console.log(`   ${conflict.description}\n`);
          }

          // Generate resolution plan
          const resolutionPlan = analyzer.generateResolutionPlan(
            validation.conflicts
          );
          console.log("💡 Resolution Recommendations:\n");
          for (const rec of resolutionPlan.recommendations) {
            console.log(`📋 ${rec.action.toUpperCase()}: ${rec.description}`);
            console.log(`   Effort: ${rec.estimatedEffort}`);
            console.log(`   Steps: ${rec.steps.length}\n`);
          }
        }
        break;

      case "analyze":
        console.log("📋 Generating comprehensive analysis report...\n");

        // Generate and save report
        const report = await generateRouteReport(appDirectory);

        // Ensure reports directory exists
        const reportsDir = join(process.cwd(), "reports");
        try {
          await writeFile(outputFile, report, "utf-8");
          console.log(`✅ Report generated successfully!`);
          console.log(`📄 Report saved to: ${outputFile}\n`);
        } catch (error) {
          console.error(`❌ Error saving report: ${error}`);
          console.log("📄 Report content:\n");
          console.log(report);
        }

        // Also run validation and show summary
        const quickValidation = await analyzer.validateRouteConsistency();
        console.log(`📊 Quick Summary:`);
        console.log(
          `   Routes Analyzed: ${quickValidation.summary.totalRoutes}`
        );
        console.log(
          `   Issues Found: ${quickValidation.summary.totalConflicts}`
        );
        console.log(
          `   Status: ${
            quickValidation.isValid ? "✅ All Good" : "⚠️ Needs Attention"
          }`
        );
        break;

      case "help":
        console.log(
          "Usage: tsx scripts/analyze-routes.ts [command] [appDirectory] [outputFile]\n"
        );
        console.log("Commands:");
        console.log("  scan      - Scan and list all dynamic routes");
        console.log(
          "  validate  - Validate route consistency and show conflicts"
        );
        console.log("  analyze   - Generate comprehensive report (default)");
        console.log("  help      - Show this help message\n");
        console.log("Examples:");
        console.log("  tsx scripts/analyze-routes.ts");
        console.log("  tsx scripts/analyze-routes.ts scan ./app");
        console.log("  tsx scripts/analyze-routes.ts validate");
        console.log(
          "  tsx scripts/analyze-routes.ts analyze ./app ./my-report.md"
        );
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log(
          'Run "tsx scripts/analyze-routes.ts help" for usage information.'
        );
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { main };
