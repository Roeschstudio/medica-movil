#!/usr/bin/env tsx

import { promises as fs } from "fs";
import path from "path";
import { systemBreakPointAnalyzer } from "../lib/system-break-point-analyzer";

/**
 * Script to run comprehensive system break point analysis
 */
async function main() {
  try {
    console.log("🚀 Starting System Break Point Analysis...");
    console.log("=".repeat(50));

    // Run the analysis
    const report = await systemBreakPointAnalyzer.analyze();

    // Generate report content
    const reportContent = await systemBreakPointAnalyzer.generateReport(report);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), "reports");
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir, { recursive: true });
    }

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      reportsDir,
      `system-break-points-${timestamp}.md`
    );
    await fs.writeFile(reportPath, reportContent, "utf-8");

    // Display summary
    console.log("\n📊 Analysis Complete!");
    console.log("=".repeat(50));
    console.log(`Total Issues Found: ${report.summary.totalIssues}`);
    console.log(`  🔴 Critical: ${report.summary.criticalIssues}`);
    console.log(`  🟠 High: ${report.summary.highIssues}`);
    console.log(`  🟡 Medium: ${report.summary.mediumIssues}`);
    console.log(`  🟢 Low: ${report.summary.lowIssues}`);
    console.log("");

    // Display breakdown by category
    console.log("📋 Issues by Category:");
    console.log(`  Error Handling: ${report.errorHandling.length}`);
    console.log(`  Database: ${report.database.length}`);
    console.log(`  Authentication: ${report.authentication.length}`);
    console.log(`  Real-time: ${report.realtime.length}`);
    console.log("");

    // Display critical issues
    const criticalIssues = [
      ...report.errorHandling,
      ...report.database,
      ...report.authentication,
      ...report.realtime,
    ].filter((issue) => issue.severity === "critical");

    if (criticalIssues.length > 0) {
      console.log("🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:");
      console.log("-".repeat(50));
      criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.description}`);
        console.log(`   File: ${issue.file}:${issue.line}`);
        console.log(`   Fix: ${issue.suggestion}`);
        console.log("");
      });
    }

    // Display high priority issues
    const highIssues = [
      ...report.errorHandling,
      ...report.database,
      ...report.authentication,
      ...report.realtime,
    ].filter((issue) => issue.severity === "high");

    if (highIssues.length > 0) {
      console.log("⚠️  HIGH PRIORITY ISSUES:");
      console.log("-".repeat(50));
      highIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.description}`);
        console.log(`   File: ${issue.file}:${issue.line}`);
        console.log(`   Fix: ${issue.suggestion}`);
        console.log("");
      });

      if (highIssues.length > 5) {
        console.log(
          `   ... and ${highIssues.length - 5} more high priority issues`
        );
        console.log("");
      }
    }

    // Display top recommendations
    if (report.recommendations.length > 0) {
      console.log("💡 TOP RECOMMENDATIONS:");
      console.log("-".repeat(50));
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log("");
    }

    console.log(`📄 Full report saved to: ${reportPath}`);
    console.log("");

    // Exit with appropriate code
    if (report.summary.criticalIssues > 0) {
      console.log("❌ Analysis completed with CRITICAL issues found!");
      console.log("   Please address critical issues before deployment.");
      process.exit(1);
    } else if (report.summary.highIssues > 0) {
      console.log("⚠️  Analysis completed with HIGH priority issues found!");
      console.log("   Consider addressing high priority issues soon.");
      process.exit(0);
    } else {
      console.log("✅ Analysis completed successfully!");
      console.log("   No critical or high priority issues found.");
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as analyzeSystemBreakPoints };
