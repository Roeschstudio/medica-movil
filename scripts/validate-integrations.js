#!/usr/bin/env node

/**
 * CLI script to run integration validation
 * Usage: npm run validate:integrations [options]
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes("--verbose") || args.includes("-v"),
  output: args.includes("--output") || args.includes("-o"),
  help: args.includes("--help") || args.includes("-h"),
};

if (options.help) {
  console.log(`
Integration Validation CLI

Usage: npm run validate:integrations [options]

Options:
  -v, --verbose    Show detailed output during validation
  -o, --output     Save detailed report to file
  -h, --help       Show this help message

Examples:
  npm run validate:integrations
  npm run validate:integrations --verbose
  npm run validate:integrations --output
  npm run validate:integrations -v -o

This command will test all critical system integrations:
- Stripe payment processing
- Supabase database and RLS policies  
- WebSocket real-time chat features
- WebRTC video call functionality
`);
  process.exit(0);
}

console.log("🔍 Starting Integration Validation...\n");

if (options.verbose) {
  console.log("Options:", options);
  console.log("Running in verbose mode\n");
}

// Ensure reports directory exists
const reportsDir = path.join(process.cwd(), "reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Run the TypeScript validation script
const scriptPath = path.join(__dirname, "test-integration-validation.ts");
const tsxPath = path.join(process.cwd(), "node_modules", ".bin", "tsx");

// Check if tsx is available
if (!fs.existsSync(tsxPath)) {
  console.error("❌ tsx not found. Please install it with: npm install -D tsx");
  process.exit(1);
}

const child = spawn("node", [tsxPath, scriptPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    INTEGRATION_VALIDATION_VERBOSE: options.verbose ? "true" : "false",
    INTEGRATION_VALIDATION_OUTPUT: options.output ? "true" : "false",
  },
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Integration validation completed successfully!");

    if (options.output) {
      console.log("📄 Detailed report has been saved to the reports directory");
    }
  } else {
    console.log("\n❌ Integration validation failed");
    console.log("Please check the error messages above and fix any issues");

    if (options.output) {
      console.log("📄 Error report has been saved to the reports directory");
    }
  }

  process.exit(code);
});

child.on("error", (error) => {
  console.error("❌ Failed to start integration validation:", error.message);
  process.exit(1);
});
