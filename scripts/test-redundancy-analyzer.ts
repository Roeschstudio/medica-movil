#!/usr/bin/env node

import { CodeRedundancyAnalyzer } from "../lib/code-redundancy-analyzer";
import { RedundancyReportGenerator } from "../lib/redundancy-report-generator";

/**
 * Test script to verify the redundancy analyzer works with the actual codebase
 */
async function testRedundancyAnalyzer(): Promise<void> {
  console.log("🧪 Testing Code Redundancy Analyzer...");

  try {
    // Initialize analyzer
    const analyzer = new CodeRedundancyAnalyzer();
    console.log("✅ Analyzer initialized successfully");

    // Run a quick analysis on a subset of files
    console.log("🔍 Running analysis...");
    const report = await analyzer.analyzeRedundancy();

    console.log("✅ Analysis completed successfully");
    console.log(`📊 Results:`);
    console.log(
      `   - Duplicate Components: ${report.duplicateComponents.length}`
    );
    console.log(
      `   - Duplicate Utilities: ${report.duplicateUtilities.length}`
    );
    console.log(`   - Unused Imports: ${report.unusedImports.length}`);

    // Test report generation
    const reportGenerator = new RedundancyReportGenerator();
    const consoleSummary = reportGenerator.generateConsoleSummary(report);

    console.log("\n📋 Console Summary Test:");
    console.log(consoleSummary);

    // Test markdown generation
    const markdownReport = await reportGenerator.generateReport(report, {
      outputFormat: "markdown",
      includeCodeSnippets: false,
      groupByType: true,
    });

    console.log("\n✅ Markdown report generation test passed");
    console.log(`📄 Report length: ${markdownReport.length} characters`);

    // Test JSON generation
    const jsonReport = await reportGenerator.generateReport(report, {
      outputFormat: "json",
      includeCodeSnippets: false,
      groupByType: true,
    });

    const parsedJson = JSON.parse(jsonReport);
    console.log("✅ JSON report generation test passed");
    console.log(`📄 JSON structure valid: ${!!parsedJson.metadata}`);

    console.log(
      "\n🎉 All tests passed! The redundancy analyzer is working correctly."
    );
  } catch (error) {
    console.error("❌ Test failed:", error);

    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRedundancyAnalyzer();
}

export { testRedundancyAnalyzer };
