#!/usr/bin/env tsx

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

interface QualityMetrics {
  eslintResults: {
    totalFiles: number;
    errors: number;
    warnings: number;
    issues: Array<{
      file: string;
      line: number;
      column: number;
      severity: "error" | "warning";
      message: string;
      rule: string;
    }>;
  };
  duplicateCodeResults: {
    totalFiles: number;
    totalLines: number;
    duplicatedLines: number;
    duplicatedPercentage: number;
    clonesFound: number;
  };
  dependencyResults: {
    unusedDependencies: string[];
    unusedDevDependencies: string[];
    missingDependencies: string[];
    orphanedFiles: string[];
  };
  codeMetrics: {
    totalSourceFiles: number;
    totalLinesOfCode: number;
    estimatedTechnicalDebt: string;
  };
}

async function runQualityChecks(): Promise<QualityMetrics> {
  console.log("🔍 Running comprehensive code quality checks...\n");

  const metrics: QualityMetrics = {
    eslintResults: {
      totalFiles: 0,
      errors: 0,
      warnings: 0,
      issues: [],
    },
    duplicateCodeResults: {
      totalFiles: 0,
      totalLines: 0,
      duplicatedLines: 0,
      duplicatedPercentage: 0,
      clonesFound: 0,
    },
    dependencyResults: {
      unusedDependencies: [],
      unusedDevDependencies: [],
      missingDependencies: [],
      orphanedFiles: [],
    },
    codeMetrics: {
      totalSourceFiles: 0,
      totalLinesOfCode: 0,
      estimatedTechnicalDebt: "Medium",
    },
  };

  // 1. ESLint Analysis
  console.log("📋 Running ESLint analysis...");
  try {
    execSync("npm run lint", { stdio: "pipe" });
    console.log("✅ No ESLint issues found");
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || "";

    // Parse ESLint output
    const lines = output.split("\n");
    let currentFile = "";

    for (const line of lines) {
      if (line.startsWith("./")) {
        currentFile = line.trim();
        metrics.eslintResults.totalFiles++;
      } else if (line.includes("Error:") || line.includes("Warning:")) {
        const match = line.match(
          /(\d+):(\d+)\s+(Error|Warning):\s+(.+?)\s+(.+)$/
        );
        if (match) {
          const [, lineNum, column, severity, message, rule] = match;
          metrics.eslintResults.issues.push({
            file: currentFile,
            line: parseInt(lineNum),
            column: parseInt(column),
            severity: severity.toLowerCase() as "error" | "warning",
            message: message.trim(),
            rule: rule.trim(),
          });

          if (severity === "Error") {
            metrics.eslintResults.errors++;
          } else {
            metrics.eslintResults.warnings++;
          }
        }
      }
    }
    console.log(
      `⚠️  Found ${metrics.eslintResults.errors} errors and ${metrics.eslintResults.warnings} warnings`
    );
  }

  // 2. Duplicate Code Analysis
  console.log("\n🔍 Running duplicate code analysis...");
  try {
    const output = execSync("npm run duplicate:check", { encoding: "utf8" });

    // Parse duplicate code output
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes("Files analyzed")) {
        const match = line.match(/(\d+)/);
        if (match) metrics.duplicateCodeResults.totalFiles = parseInt(match[1]);
      } else if (line.includes("Total lines")) {
        const match = line.match(/(\d+)/);
        if (match) metrics.duplicateCodeResults.totalLines = parseInt(match[1]);
      } else if (line.includes("Duplicated lines")) {
        const match = line.match(/(\d+)\s+\(([0-9.]+)%\)/);
        if (match) {
          metrics.duplicateCodeResults.duplicatedLines = parseInt(match[1]);
          metrics.duplicateCodeResults.duplicatedPercentage = parseFloat(
            match[2]
          );
        }
      } else if (
        line.includes("clones found") ||
        line.includes("Clones found")
      ) {
        const match = line.match(/(\d+)/);
        if (match)
          metrics.duplicateCodeResults.clonesFound = parseInt(match[1]);
      }
    }
    console.log(
      `✅ Found ${metrics.duplicateCodeResults.clonesFound} code clones (${metrics.duplicateCodeResults.duplicatedPercentage}% duplication)`
    );
  } catch (error) {
    console.log("⚠️  Could not run duplicate code analysis");
  }

  // 3. Dependency Analysis
  console.log("\n📦 Running dependency analysis...");
  try {
    const output = execSync("npm run deps:check", { encoding: "utf8" });

    // Parse dependency output for orphaned files
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes("no-orphans:")) {
        const file = line.split("no-orphans:")[1]?.trim();
        if (file) {
          metrics.dependencyResults.orphanedFiles.push(file);
        }
      }
    }
    console.log(
      `✅ Found ${metrics.dependencyResults.orphanedFiles.length} orphaned files`
    );
  } catch (error) {
    console.log("⚠️  Could not run dependency analysis");
  }

  // 4. Calculate code metrics
  console.log("\n📊 Calculating code metrics...");
  try {
    // Use PowerShell commands for Windows compatibility
    const output = execSync(
      'powershell -Command "(Get-ChildItem -Path app,components,lib,hooks -Include *.ts,*.tsx -Recurse).Count"',
      { encoding: "utf8" }
    );
    metrics.codeMetrics.totalSourceFiles = parseInt(output.trim()) || 0;

    const linesOutput = execSync(
      'powershell -Command "(Get-ChildItem -Path app,components,lib,hooks -Include *.ts,*.tsx -Recurse | Get-Content | Measure-Object -Line).Lines"',
      { encoding: "utf8" }
    );
    metrics.codeMetrics.totalLinesOfCode = parseInt(linesOutput.trim()) || 0;

    // Estimate technical debt based on issues
    const totalIssues =
      metrics.eslintResults.errors + metrics.eslintResults.warnings;
    if (totalIssues > 1000) {
      metrics.codeMetrics.estimatedTechnicalDebt = "High";
    } else if (totalIssues > 500) {
      metrics.codeMetrics.estimatedTechnicalDebt = "Medium-High";
    } else if (totalIssues > 100) {
      metrics.codeMetrics.estimatedTechnicalDebt = "Medium";
    } else {
      metrics.codeMetrics.estimatedTechnicalDebt = "Low";
    }

    console.log(
      `✅ Analyzed ${metrics.codeMetrics.totalSourceFiles} files with ${metrics.codeMetrics.totalLinesOfCode} lines of code`
    );
  } catch (error) {
    console.log("⚠️  Could not calculate code metrics");
  }

  return metrics;
}

function generateQualityReport(metrics: QualityMetrics): string {
  const timestamp = new Date().toISOString();

  return `# Code Quality Report

Generated: ${timestamp}

## Executive Summary

- **Total Source Files**: ${metrics.codeMetrics.totalSourceFiles}
- **Total Lines of Code**: ${metrics.codeMetrics.totalLinesOfCode.toLocaleString()}
- **Technical Debt Level**: ${metrics.codeMetrics.estimatedTechnicalDebt}
- **Overall Health**: ${getOverallHealth(metrics)}

## ESLint Analysis

- **Files Analyzed**: ${metrics.eslintResults.totalFiles}
- **Errors**: ${metrics.eslintResults.errors}
- **Warnings**: ${metrics.eslintResults.warnings}
- **Total Issues**: ${
    metrics.eslintResults.errors + metrics.eslintResults.warnings
  }

### Top Issue Categories

${getTopIssueCategories(metrics.eslintResults.issues)}

## Code Duplication Analysis

- **Files Analyzed**: ${metrics.duplicateCodeResults.totalFiles}
- **Total Lines**: ${metrics.duplicateCodeResults.totalLines.toLocaleString()}
- **Duplicated Lines**: ${metrics.duplicateCodeResults.duplicatedLines} (${
    metrics.duplicateCodeResults.duplicatedPercentage
  }%)
- **Code Clones Found**: ${metrics.duplicateCodeResults.clonesFound}

## Dependency Health

- **Orphaned Files**: ${metrics.dependencyResults.orphanedFiles.length}

### Orphaned Files
${metrics.dependencyResults.orphanedFiles.map((file) => `- ${file}`).join("\n")}

## Recommendations

### High Priority
${getHighPriorityRecommendations(metrics)}

### Medium Priority
${getMediumPriorityRecommendations(metrics)}

### Low Priority
${getLowPriorityRecommendations(metrics)}

## Quality Metrics Trends

- **Code Quality Score**: ${calculateQualityScore(metrics)}/100
- **Maintainability Index**: ${calculateMaintainabilityIndex(metrics)}
- **Technical Debt Ratio**: ${calculateTechnicalDebtRatio(metrics)}%

## Next Steps

1. **Immediate Actions** (Next 1-2 days)
   - Fix critical ESLint errors
   - Remove unused imports
   - Address high-severity warnings

2. **Short Term** (Next 1-2 weeks)
   - Refactor duplicate code
   - Clean up orphaned files
   - Improve type safety

3. **Long Term** (Next month)
   - Implement automated quality gates
   - Set up continuous code quality monitoring
   - Establish coding standards and guidelines

---
*Report generated by automated quality analysis system*
`;
}

function getOverallHealth(metrics: QualityMetrics): string {
  const score = calculateQualityScore(metrics);
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

function getTopIssueCategories(issues: any[]): string {
  const categories: { [key: string]: number } = {};

  issues.forEach((issue) => {
    const category = issue.rule.split("/")[0] || "general";
    categories[category] = (categories[category] || 0) + 1;
  });

  return Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => `- **${category}**: ${count} issues`)
    .join("\n");
}

function getHighPriorityRecommendations(metrics: QualityMetrics): string {
  const recommendations = [];

  if (metrics.eslintResults.errors > 0) {
    recommendations.push(
      `- Fix ${metrics.eslintResults.errors} ESLint errors immediately`
    );
  }

  if (metrics.duplicateCodeResults.duplicatedPercentage > 5) {
    recommendations.push(
      `- Refactor duplicate code (${metrics.duplicateCodeResults.duplicatedPercentage}% duplication is above 5% threshold)`
    );
  }

  if (metrics.eslintResults.warnings > 500) {
    recommendations.push(
      `- Address ${metrics.eslintResults.warnings} ESLint warnings systematically`
    );
  }

  return recommendations.length > 0
    ? recommendations.join("\n")
    : "- No high priority issues identified";
}

function getMediumPriorityRecommendations(metrics: QualityMetrics): string {
  const recommendations = [];

  if (metrics.dependencyResults.orphanedFiles.length > 0) {
    recommendations.push(
      `- Clean up ${metrics.dependencyResults.orphanedFiles.length} orphaned files`
    );
  }

  if (metrics.duplicateCodeResults.clonesFound > 0) {
    recommendations.push(
      `- Consolidate ${metrics.duplicateCodeResults.clonesFound} code clones`
    );
  }

  recommendations.push(
    "- Set up automated code quality checks in CI/CD pipeline"
  );
  recommendations.push("- Implement stricter TypeScript configuration");

  return recommendations.join("\n");
}

function getLowPriorityRecommendations(metrics: QualityMetrics): string {
  return `- Set up code coverage reporting
- Implement automated dependency updates
- Add performance monitoring
- Create coding style guide documentation`;
}

function calculateQualityScore(metrics: QualityMetrics): number {
  let score = 100;

  // Deduct points for errors and warnings
  score -= metrics.eslintResults.errors * 2;
  score -= metrics.eslintResults.warnings * 0.5;

  // Deduct points for code duplication
  score -= metrics.duplicateCodeResults.duplicatedPercentage * 2;

  // Deduct points for orphaned files
  score -= metrics.dependencyResults.orphanedFiles.length * 0.5;

  return Math.max(0, Math.round(score));
}

function calculateMaintainabilityIndex(metrics: QualityMetrics): string {
  const score = calculateQualityScore(metrics);
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function calculateTechnicalDebtRatio(metrics: QualityMetrics): number {
  const totalIssues =
    metrics.eslintResults.errors + metrics.eslintResults.warnings;
  const ratio = (totalIssues / metrics.codeMetrics.totalLinesOfCode) * 100;
  return Math.round(ratio * 100) / 100;
}

async function main() {
  try {
    const metrics = await runQualityChecks();
    const report = generateQualityReport(metrics);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = join("reports", `quality-report-${timestamp}.md`);

    writeFileSync(reportPath, report);

    console.log("\n✅ Quality analysis complete!");
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`\n📊 Quality Score: ${calculateQualityScore(metrics)}/100`);
    console.log(`🏥 Overall Health: ${getOverallHealth(metrics)}`);
    console.log(
      `🔧 Technical Debt: ${metrics.codeMetrics.estimatedTechnicalDebt}`
    );
  } catch (error) {
    console.error("❌ Error running quality checks:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
