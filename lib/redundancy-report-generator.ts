import fs from "fs";
import path from "path";
import {
  ComponentDuplicate,
  RedundancyReport,
  UnusedImport,
  UtilityDuplicate,
} from "./code-redundancy-analyzer";

export interface ReportOptions {
  outputFormat: "markdown" | "json" | "html";
  outputPath?: string;
  includeCodeSnippets: boolean;
  groupByType: boolean;
}

export class RedundancyReportGenerator {
  /**
   * Generate a comprehensive redundancy report
   */
  async generateReport(
    report: RedundancyReport,
    options: ReportOptions
  ): Promise<string> {
    switch (options.outputFormat) {
      case "markdown":
        return this.generateMarkdownReport(report, options);
      case "json":
        return this.generateJsonReport(report, options);
      case "html":
        return this.generateHtmlReport(report, options);
      default:
        throw new Error(`Unsupported output format: ${options.outputFormat}`);
    }
  }

  /**
   * Save report to file
   */
  async saveReport(
    reportContent: string,
    options: ReportOptions
  ): Promise<string> {
    if (!options.outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extension =
        options.outputFormat === "markdown" ? "md" : options.outputFormat;
      options.outputPath = `reports/redundancy-report-${timestamp}.${extension}`;
    }

    // Ensure reports directory exists
    const reportsDir = path.dirname(options.outputPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(options.outputPath, reportContent, "utf-8");
    return options.outputPath;
  }

  /**
   * Generate markdown format report
   */
  private generateMarkdownReport(
    report: RedundancyReport,
    options: ReportOptions
  ): string {
    const sections: string[] = [];

    // Header
    sections.push("# Code Redundancy Analysis Report");
    sections.push(`Generated on: ${new Date().toLocaleString()}`);
    sections.push("");

    // Executive Summary
    sections.push("## Executive Summary");
    sections.push(
      `- **Total Duplicates Found:** ${report.summary.totalDuplicates}`
    );
    sections.push(`- **Unused Imports:** ${report.summary.totalUnusedImports}`);
    sections.push(
      `- **Potential Savings:** ${report.summary.potentialSavings}`
    );
    sections.push("");

    // Duplicate Components
    if (report.duplicateComponents.length > 0) {
      sections.push("## Duplicate Components");
      sections.push(
        `Found ${report.duplicateComponents.length} sets of duplicate components:`
      );
      sections.push("");

      report.duplicateComponents.forEach((duplicate, index) => {
        sections.push(`### ${index + 1}. ${duplicate.name}`);
        sections.push(
          `**Similarity:** ${(duplicate.similarity * 100).toFixed(1)}%`
        );
        sections.push(`**Files:**`);
        duplicate.files.forEach((file) => {
          sections.push(`- \`${file}\``);
        });

        if (options.includeCodeSnippets) {
          sections.push("**Code Snippet:**");
          sections.push("```typescript");
          sections.push(duplicate.codeSnippet);
          sections.push("```");
        }

        sections.push("**Recommendations:**");
        duplicate.recommendations.forEach((rec) => {
          sections.push(`- ${rec}`);
        });
        sections.push("");
      });
    }

    // Duplicate Utilities
    if (report.duplicateUtilities.length > 0) {
      sections.push("## Duplicate Utility Functions");
      sections.push(
        `Found ${report.duplicateUtilities.length} sets of duplicate utility functions:`
      );
      sections.push("");

      report.duplicateUtilities.forEach((duplicate, index) => {
        sections.push(`### ${index + 1}. ${duplicate.functionName}`);
        sections.push(
          `**Similarity:** ${(duplicate.similarity * 100).toFixed(1)}%`
        );
        sections.push(`**Files:**`);
        duplicate.files.forEach((file) => {
          sections.push(`- \`${file}\``);
        });

        if (options.includeCodeSnippets) {
          sections.push("**Code Snippet:**");
          sections.push("```typescript");
          sections.push(duplicate.codeSnippet);
          sections.push("```");
        }

        sections.push("**Recommendations:**");
        duplicate.recommendations.forEach((rec) => {
          sections.push(`- ${rec}`);
        });
        sections.push("");
      });
    }

    // Unused Imports
    if (report.unusedImports.length > 0) {
      sections.push("## Unused Imports");
      sections.push(`Found ${report.unusedImports.length} unused imports:`);
      sections.push("");

      if (options.groupByType) {
        const groupedImports = this.groupUnusedImportsByFile(
          report.unusedImports
        );
        Object.entries(groupedImports).forEach(([file, imports]) => {
          sections.push(`### ${file}`);
          imports.forEach((imp) => {
            sections.push(
              `- Line ${imp.line}: \`${imp.importName}\` from \`${imp.importPath}\``
            );
          });
          sections.push("");
        });
      } else {
        sections.push("| File | Line | Import | From |");
        sections.push("|------|------|--------|------|");
        report.unusedImports.forEach((imp) => {
          sections.push(
            `| \`${imp.file}\` | ${imp.line} | \`${imp.importName}\` | \`${imp.importPath}\` |`
          );
        });
        sections.push("");
      }
    }

    // Overall Recommendations
    sections.push("## Overall Recommendations");
    report.recommendations.forEach((rec) => {
      sections.push(`- ${rec}`);
    });
    sections.push("");

    // Action Plan
    sections.push("## Suggested Action Plan");
    sections.push("1. **Immediate Actions (High Priority)**");
    sections.push("   - Remove unused imports to reduce bundle size");
    sections.push("   - Consolidate duplicate utility functions");
    sections.push("");
    sections.push("2. **Short-term Actions (Medium Priority)**");
    sections.push("   - Consolidate duplicate components");
    sections.push("   - Create shared component library structure");
    sections.push("");
    sections.push("3. **Long-term Actions (Low Priority)**");
    sections.push("   - Implement automated duplication detection in CI/CD");
    sections.push(
      "   - Create comprehensive documentation for shared components"
    );
    sections.push(
      "   - Set up code review guidelines to prevent future duplication"
    );

    return sections.join("\n");
  }

  /**
   * Generate JSON format report
   */
  private generateJsonReport(
    report: RedundancyReport,
    options: ReportOptions
  ): string {
    const jsonReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
        options: options,
      },
      ...report,
    };

    return JSON.stringify(jsonReport, null, 2);
  }

  /**
   * Generate HTML format report
   */
  private generateHtmlReport(
    report: RedundancyReport,
    options: ReportOptions
  ): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Redundancy Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .duplicate-item { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
        .code-snippet { background: #f8f8f8; padding: 10px; border-radius: 3px; font-family: monospace; overflow-x: auto; }
        .file-list { list-style-type: none; padding: 0; }
        .file-list li { background: #e9e9e9; margin: 5px 0; padding: 5px 10px; border-radius: 3px; }
        .recommendations { background: #fff3cd; padding: 10px; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metric { font-size: 1.2em; font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Code Redundancy Analysis Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p><span class="metric">Total Duplicates:</span> ${
          report.summary.totalDuplicates
        }</p>
        <p><span class="metric">Unused Imports:</span> ${
          report.summary.totalUnusedImports
        }</p>
        <p><span class="metric">Potential Savings:</span> ${
          report.summary.potentialSavings
        }</p>
    </div>

    ${this.generateHtmlDuplicateComponents(report.duplicateComponents, options)}
    ${this.generateHtmlDuplicateUtilities(report.duplicateUtilities, options)}
    ${this.generateHtmlUnusedImports(report.unusedImports, options)}
    ${this.generateHtmlRecommendations(report.recommendations)}

</body>
</html>`;

    return html;
  }

  /**
   * Generate HTML section for duplicate components
   */
  private generateHtmlDuplicateComponents(
    duplicates: ComponentDuplicate[],
    options: ReportOptions
  ): string {
    if (duplicates.length === 0) return "";

    let html = `
    <div class="section">
        <h2>Duplicate Components (${duplicates.length})</h2>`;

    duplicates.forEach((duplicate, index) => {
      html += `
        <div class="duplicate-item">
            <h3>${index + 1}. ${duplicate.name}</h3>
            <p><strong>Similarity:</strong> ${(
              duplicate.similarity * 100
            ).toFixed(1)}%</p>
            <p><strong>Files:</strong></p>
            <ul class="file-list">
                ${duplicate.files.map((file) => `<li>${file}</li>`).join("")}
            </ul>`;

      if (options.includeCodeSnippets) {
        html += `
            <p><strong>Code Snippet:</strong></p>
            <div class="code-snippet">${this.escapeHtml(
              duplicate.codeSnippet
            )}</div>`;
      }

      html += `
            <div class="recommendations">
                <strong>Recommendations:</strong>
                <ul>
                    ${duplicate.recommendations
                      .map((rec) => `<li>${rec}</li>`)
                      .join("")}
                </ul>
            </div>
        </div>`;
    });

    html += `</div>`;
    return html;
  }

  /**
   * Generate HTML section for duplicate utilities
   */
  private generateHtmlDuplicateUtilities(
    duplicates: UtilityDuplicate[],
    options: ReportOptions
  ): string {
    if (duplicates.length === 0) return "";

    let html = `
    <div class="section">
        <h2>Duplicate Utility Functions (${duplicates.length})</h2>`;

    duplicates.forEach((duplicate, index) => {
      html += `
        <div class="duplicate-item">
            <h3>${index + 1}. ${duplicate.functionName}</h3>
            <p><strong>Similarity:</strong> ${(
              duplicate.similarity * 100
            ).toFixed(1)}%</p>
            <p><strong>Files:</strong></p>
            <ul class="file-list">
                ${duplicate.files.map((file) => `<li>${file}</li>`).join("")}
            </ul>`;

      if (options.includeCodeSnippets) {
        html += `
            <p><strong>Code Snippet:</strong></p>
            <div class="code-snippet">${this.escapeHtml(
              duplicate.codeSnippet
            )}</div>`;
      }

      html += `
            <div class="recommendations">
                <strong>Recommendations:</strong>
                <ul>
                    ${duplicate.recommendations
                      .map((rec) => `<li>${rec}</li>`)
                      .join("")}
                </ul>
            </div>
        </div>`;
    });

    html += `</div>`;
    return html;
  }

  /**
   * Generate HTML section for unused imports
   */
  private generateHtmlUnusedImports(
    unusedImports: UnusedImport[],
    options: ReportOptions
  ): string {
    if (unusedImports.length === 0) return "";

    let html = `
    <div class="section">
        <h2>Unused Imports (${unusedImports.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Line</th>
                    <th>Import</th>
                    <th>From</th>
                </tr>
            </thead>
            <tbody>`;

    unusedImports.forEach((imp) => {
      html += `
                <tr>
                    <td>${imp.file}</td>
                    <td>${imp.line}</td>
                    <td><code>${imp.importName}</code></td>
                    <td><code>${imp.importPath}</code></td>
                </tr>`;
    });

    html += `
            </tbody>
        </table>
    </div>`;

    return html;
  }

  /**
   * Generate HTML section for recommendations
   */
  private generateHtmlRecommendations(recommendations: string[]): string {
    return `
    <div class="section">
        <h2>Overall Recommendations</h2>
        <ul>
            ${recommendations.map((rec) => `<li>${rec}</li>`).join("")}
        </ul>
    </div>`;
  }

  /**
   * Group unused imports by file
   */
  private groupUnusedImportsByFile(
    unusedImports: UnusedImport[]
  ): Record<string, UnusedImport[]> {
    return unusedImports.reduce((acc, imp) => {
      if (!acc[imp.file]) {
        acc[imp.file] = [];
      }
      acc[imp.file].push(imp);
      return acc;
    }, {} as Record<string, UnusedImport[]>);
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate a quick summary report for console output
   */
  generateConsoleSummary(report: RedundancyReport): string {
    const lines: string[] = [];

    lines.push("🔍 Code Redundancy Analysis Complete");
    lines.push("=====================================");
    lines.push(`📊 Total Duplicates: ${report.summary.totalDuplicates}`);
    lines.push(`🗑️  Unused Imports: ${report.summary.totalUnusedImports}`);
    lines.push(`💾 ${report.summary.potentialSavings}`);
    lines.push("");

    if (report.duplicateComponents.length > 0) {
      lines.push(
        `🔄 Duplicate Components: ${report.duplicateComponents.length}`
      );
      report.duplicateComponents.slice(0, 3).forEach((dup) => {
        lines.push(
          `   • ${dup.name} (${dup.files.length} files, ${(
            dup.similarity * 100
          ).toFixed(1)}% similar)`
        );
      });
      if (report.duplicateComponents.length > 3) {
        lines.push(
          `   • ... and ${report.duplicateComponents.length - 3} more`
        );
      }
      lines.push("");
    }

    if (report.duplicateUtilities.length > 0) {
      lines.push(
        `⚙️  Duplicate Utilities: ${report.duplicateUtilities.length}`
      );
      report.duplicateUtilities.slice(0, 3).forEach((dup) => {
        lines.push(
          `   • ${dup.functionName} (${dup.files.length} files, ${(
            dup.similarity * 100
          ).toFixed(1)}% similar)`
        );
      });
      if (report.duplicateUtilities.length > 3) {
        lines.push(`   • ... and ${report.duplicateUtilities.length - 3} more`);
      }
      lines.push("");
    }

    lines.push("🎯 Top Recommendations:");
    report.recommendations.slice(0, 3).forEach((rec) => {
      lines.push(`   • ${rec}`);
    });

    return lines.join("\n");
  }
}
