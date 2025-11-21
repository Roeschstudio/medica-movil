#!/usr/bin/env tsx

/**
 * Integration Validation Test Script
 *
 * This script runs the comprehensive integration validation suite
 * to test all critical system integrations including:
 * - Stripe payment processing
 * - Supabase database and RLS policies
 * - WebSocket real-time chat features
 * - WebRTC video call functionality
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { integrationValidator } from "../lib/integration-validation-suite";

async function main() {
  console.log("🚀 Starting Integration Validation Suite...\n");

  try {
    // Run the full validation suite
    const report = await integrationValidator.runFullValidation();

    // Generate detailed report
    const detailedReport = integrationValidator.generateDetailedReport(report);

    // Display results in console
    console.log(detailedReport);

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = join(
      process.cwd(),
      "reports",
      `integration-validation-${timestamp}.md`
    );

    const markdownReport = `# Integration Validation Report

${detailedReport}

## Detailed Results

### Stripe Payment Integration
- **Status**: ${report.stripe.success ? "✅ PASS" : "❌ FAIL"}
- **Message**: ${report.stripe.message}
${report.stripe.error ? `- **Error**: ${report.stripe.error}` : ""}
${
  report.stripe.details
    ? `- **Details**: \`\`\`json\n${JSON.stringify(
        report.stripe.details,
        null,
        2
      )}\n\`\`\``
    : ""
}

### Supabase Database Integration
- **Status**: ${report.supabase.success ? "✅ PASS" : "❌ FAIL"}
- **Message**: ${report.supabase.message}
${report.supabase.error ? `- **Error**: ${report.supabase.error}` : ""}
${
  report.supabase.details
    ? `- **Details**: \`\`\`json\n${JSON.stringify(
        report.supabase.details,
        null,
        2
      )}\n\`\`\``
    : ""
}

### WebSocket Real-time Features
- **Status**: ${report.websocket.success ? "✅ PASS" : "❌ FAIL"}
- **Message**: ${report.websocket.message}
${report.websocket.error ? `- **Error**: ${report.websocket.error}` : ""}
${
  report.websocket.details
    ? `- **Details**: \`\`\`json\n${JSON.stringify(
        report.websocket.details,
        null,
        2
      )}\n\`\`\``
    : ""
}

### WebRTC Video Call Functionality
- **Status**: ${report.webrtc.success ? "✅ PASS" : "❌ FAIL"}
- **Message**: ${report.webrtc.message}
${report.webrtc.error ? `- **Error**: ${report.webrtc.error}` : ""}
${
  report.webrtc.details
    ? `- **Details**: \`\`\`json\n${JSON.stringify(
        report.webrtc.details,
        null,
        2
      )}\n\`\`\``
    : ""
}

## Summary

- **Overall Status**: ${
      report.overall.success ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
    }
- **Tests Passed**: ${report.overall.passedTests}/${report.overall.totalTests}
- **Critical Failures**: ${
      report.overall.criticalFailures.length > 0
        ? report.overall.criticalFailures.join(", ")
        : "None"
    }

## Recommendations

${
  report.overall.success
    ? "🎉 All integrations are working correctly! The system is ready for production use."
    : `⚠️ The following integrations need attention:
${report.overall.criticalFailures.map((failure) => `- ${failure}`).join("\n")}

Please review the detailed error messages above and fix the failing integrations before deploying to production.`
}

---
*Report generated on ${new Date().toISOString()}*
`;

    writeFileSync(reportPath, markdownReport);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (report.overall.success) {
      console.log("\n✅ All integration tests passed!");
      process.exit(0);
    } else {
      console.log(
        "\n❌ Some integration tests failed. Please review the report above."
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Integration validation failed with error:", error);

    // Save error report
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const errorReportPath = join(
      process.cwd(),
      "reports",
      `integration-validation-error-${timestamp}.md`
    );

    const errorReport = `# Integration Validation Error Report

**Error occurred**: ${new Date().toISOString()}

## Error Details

\`\`\`
${error instanceof Error ? error.stack : String(error)}
\`\`\`

## Troubleshooting

1. Ensure all environment variables are properly configured
2. Check that the database is accessible
3. Verify that Stripe API keys are valid
4. Ensure the development server is running for WebSocket tests
5. Check browser permissions for WebRTC media access

---
*Error report generated on ${new Date().toISOString()}*
`;

    writeFileSync(errorReportPath, errorReport);
    console.log(`\n📄 Error report saved to: ${errorReportPath}`);

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error("Script execution failed:", error);
  process.exit(1);
});
