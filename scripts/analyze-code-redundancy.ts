#!/usr/bin/env node

import { CodeRedundancyAnalyzer } from "../lib/code-redundancy-analyzer";
import {
  RedundancyReportGenerator,
  ReportOptions,
} from "../lib/redundancy-report-generator";

interface CliOptions {
  format: "markdown" | "json" | "html" | "console";
  output?: string;
  includeSnippets: boolean;
  groupByType: boolean;
  verbose: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    format: "markdown",
    includeSnippets: true,
    groupByType: true,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--format":
      case "-f":
        const format = args[++i] as CliOptions["format"];
        if (["markdown", "json", "html", "console"].includes(format)) {
          options.format = format;
        } else {
          console.error(
            `Invalid format: ${format}. Use: markdown, json, html, or console`
          );
          process.exit(1);
        }
        break;

      case "--output":
      case "-o":
        options.output = args[++i];
        break;

      case "--no-snippets":
        options.includeSnippets = false;
        break;

      case "--no-grouping":
        options.groupByType = false;
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;

      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Code Redundancy Analyzer

Usage: npm run analyze:redundancy [options]

Options:
  -f, --format <type>     Output format (markdown, json, html, console) [default: markdown]
  -o, --output <path>     Output file path (auto-generated if not specified)
  --no-snippets          Exclude code snippets from report
  --no-grouping          Don't group unused imports by file
  -v, --verbose          Enable verbose logging
  -h, --help             Show this help message

Examples:
  npm run analyze:redundancy
  npm run analyze:redundancy --format json --output redundancy.json
  npm run analyze:redundancy --format console --verbose
  npm run analyze:redundancy --format html --no-snippets
`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.verbose) {
    console.log("🚀 Starting code redundancy analysis...");
    console.log(`📋 Options:`, options);
  }

  try {
    // Initialize analyzer
    const analyzer = new CodeRedundancyAnalyzer();

    // Run analysis
    if (options.verbose) {
      console.log("🔍 Analyzing codebase for redundancy...");
    }

    const report = await analyzer.analyzeRedundancy();

    if (options.verbose) {
      console.log("✅ Analysis complete!");
      console.log(
        `📊 Found ${report.summary.totalDuplicates} duplicates and ${report.summary.totalUnusedImports} unused imports`
      );
    }

    // Generate report
    const reportGenerator = new RedundancyReportGenerator();

    if (options.format === "console") {
      // Console output
      const summary = reportGenerator.generateConsoleSummary(report);
      console.log(summary);
    } else {
      // File output
      const reportOptions: ReportOptions = {
        outputFormat: options.format,
        outputPath: options.output,
        includeCodeSnippets: options.includeSnippets,
        groupByType: options.groupByType,
      };

      if (options.verbose) {
        console.log(`📝 Generating ${options.format} report...`);
      }

      const reportContent = await reportGenerator.generateReport(
        report,
        reportOptions
      );
      const outputPath = await reportGenerator.saveReport(
        reportContent,
        reportOptions
      );

      console.log(`✅ Report generated successfully!`);
      console.log(`📄 Report saved to: ${outputPath}`);

      // Also show console summary
      const summary = reportGenerator.generateConsoleSummary(report);
      console.log("\n" + summary);
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);

    if (options.verbose && error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }

    process.exit(1);
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

export { main, parseArgs, printHelp };
