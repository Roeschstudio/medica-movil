#!/usr/bin/env node

/**
 * Debug Tools Runner
 * Comprehensive debugging and analysis tool runner for the medical platform
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

class DebugToolsRunner {
  constructor() {
    this.reportsDir = path.join(process.cwd(), "reports");
    this.ensureReportsDirectory();
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  runCommand(command, description) {
    this.log(`Running: ${description}`, "info");
    try {
      const output = execSync(command, {
        encoding: "utf8",
        stdio: "pipe",
        cwd: process.cwd(),
      });
      this.log(`✅ Completed: ${description}`, "success");
      return output;
    } catch (error) {
      this.log(`❌ Failed: ${description} - ${error.message}`, "error");
      return null;
    }
  }

  async runBundleAnalysis() {
    this.log("Starting Bundle Analysis...", "info");

    // Set environment variable for bundle analysis
    process.env.ANALYZE = "true";

    const result = this.runCommand(
      "npm run build",
      "Bundle analysis with Next.js Bundle Analyzer"
    );

    if (result) {
      this.log(
        "Bundle analysis completed. Check the opened browser tab for results.",
        "success"
      );
    }

    // Reset environment variable
    delete process.env.ANALYZE;
  }

  async runDependencyAnalysis() {
    this.log("Starting Dependency Analysis...", "info");

    // Check for circular dependencies
    this.runCommand(
      "npx dependency-cruiser --validate .dependency-cruiser.js app components lib hooks",
      "Circular dependency detection"
    );

    // Generate dependency graph
    this.runCommand(
      "npx dependency-cruiser --output-type dot app components lib hooks > reports/dependency-graph.dot",
      "Dependency graph generation"
    );

    // Generate JSON report
    this.runCommand(
      "npx dependency-cruiser --output-type json app components lib hooks > reports/dependency-report.json",
      "Dependency JSON report"
    );
  }

  async runDuplicateCodeAnalysis() {
    this.log("Starting Duplicate Code Analysis...", "info");

    // Run jscpd with HTML and console output
    this.runCommand(
      "npx jscpd --reporters html,console,json app components lib hooks",
      "Duplicate code detection"
    );
  }

  async runPerformanceAnalysis() {
    this.log("Starting Performance Analysis...", "info");

    // Analyze bundle size
    const buildOutput = this.runCommand(
      "npm run build 2>&1",
      "Build analysis for performance metrics"
    );

    if (buildOutput) {
      // Extract bundle size information
      const bundleInfo = this.extractBundleInfo(buildOutput);
      this.saveBundleReport(bundleInfo);
    }
  }

  extractBundleInfo(buildOutput) {
    const lines = buildOutput.split("\n");
    const bundleInfo = {
      timestamp: new Date().toISOString(),
      pages: [],
      chunks: [],
      totalSize: null,
    };

    // Parse Next.js build output for bundle information
    lines.forEach((line) => {
      if (line.includes("○") || line.includes("●") || line.includes("λ")) {
        // Page information
        const match = line.match(/([○●λ])\s+([^\s]+)\s+([0-9.]+\s*[kKmM]?B)/);
        if (match) {
          bundleInfo.pages.push({
            type: match[1],
            path: match[2],
            size: match[3],
          });
        }
      }
    });

    return bundleInfo;
  }

  saveBundleReport(bundleInfo) {
    const reportPath = path.join(this.reportsDir, "bundle-analysis.json");
    fs.writeFileSync(reportPath, JSON.stringify(bundleInfo, null, 2));
    this.log(`Bundle report saved to: ${reportPath}`, "success");
  }

  async generateComprehensiveReport() {
    this.log("Generating Comprehensive Debug Report...", "info");

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        bundleAnalysis: fs.existsSync(
          path.join(this.reportsDir, "bundle-analysis.json")
        ),
        dependencyAnalysis: fs.existsSync(
          path.join(this.reportsDir, "dependency-report.json")
        ),
        duplicateCodeAnalysis: fs.existsSync(
          path.join(this.reportsDir, "jscpd")
        ),
      },
      recommendations: [
        "Review bundle analysis for optimization opportunities",
        "Check dependency graph for circular dependencies",
        "Address duplicate code findings",
        "Monitor performance metrics regularly",
      ],
    };

    const reportPath = path.join(this.reportsDir, "debug-summary.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`Comprehensive report saved to: ${reportPath}`, "success");
  }

  async runAll() {
    this.log("Starting Comprehensive Debug Analysis...", "info");

    try {
      await this.runDependencyAnalysis();
      await this.runDuplicateCodeAnalysis();
      await this.runPerformanceAnalysis();
      await this.generateComprehensiveReport();

      this.log("All debug tools completed successfully!", "success");
      this.log(`Reports available in: ${this.reportsDir}`, "info");
    } catch (error) {
      this.log(`Debug analysis failed: ${error.message}`, "error");
    }
  }
}

// CLI Interface
const args = process.argv.slice(2);
const runner = new DebugToolsRunner();

switch (args[0]) {
  case "bundle":
    runner.runBundleAnalysis();
    break;
  case "deps":
    runner.runDependencyAnalysis();
    break;
  case "duplicates":
    runner.runDuplicateCodeAnalysis();
    break;
  case "performance":
    runner.runPerformanceAnalysis();
    break;
  case "all":
  default:
    runner.runAll();
    break;
}
