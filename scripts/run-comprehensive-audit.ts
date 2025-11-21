#!/usr/bin/env tsx

/**
 * Comprehensive System Audit Runner
 *
 * This script runs the complete audit reporting system that compiles results
 * from all analysis tools and generates actionable reports with prioritized
 * recommendations and implementation plans.
 */

import {
  generateComprehensiveAudit,
  saveAuditReport,
} from "../lib/audit-reporting-system";

async function main() {
  console.log("🚀 Starting Comprehensive System Audit...");
  console.log("=".repeat(60));

  try {
    // Generate comprehensive audit report
    console.log("📊 Running all analysis tools and compiling results...");
    const auditReport = await generateComprehensiveAudit();

    // Display summary
    console.log("\n📋 AUDIT SUMMARY");
    console.log("=".repeat(40));
    console.log(
      `Overall Health Score: ${auditReport.summary.overallHealthScore}/100`
    );
    console.log(`Total Issues: ${auditReport.summary.totalIssues}`);
    console.log(
      `Critical Issues: ${auditReport.summary.issuesBySeverity.critical}`
    );
    console.log(
      `High Priority Issues: ${auditReport.summary.issuesBySeverity.high}`
    );
    console.log(
      `Medium Priority Issues: ${auditReport.summary.issuesBySeverity.medium}`
    );
    console.log(
      `Low Priority Issues: ${auditReport.summary.issuesBySeverity.low}`
    );
    console.log(
      `Refactoring Opportunities: ${auditReport.summary.refactoringOpportunities}`
    );

    // Display health status
    console.log("\n🏥 SYSTEM HEALTH STATUS");
    console.log("=".repeat(40));
    if (auditReport.summary.overallHealthScore >= 90) {
      console.log("🟢 EXCELLENT - System is in great condition");
    } else if (auditReport.summary.overallHealthScore >= 75) {
      console.log("🟡 GOOD - System is generally healthy");
    } else if (auditReport.summary.overallHealthScore >= 60) {
      console.log("🟠 FAIR - System needs attention");
    } else if (auditReport.summary.overallHealthScore >= 40) {
      console.log("🔴 POOR - System has significant issues");
    } else {
      console.log("🚨 CRITICAL - System has severe issues");
    }

    // Display critical issues if any
    const criticalIssues = auditReport.issues.filter(
      (i) => i.severity === "critical"
    );
    if (criticalIssues.length > 0) {
      console.log("\n🚨 CRITICAL ISSUES (Immediate Action Required)");
      console.log("=".repeat(50));
      criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.title}`);
        console.log(`   Category: ${issue.category}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Files: ${issue.affectedFiles.length} affected`);
        console.log("");
      });
    }

    // Display integration status
    console.log("🔗 INTEGRATION STATUS");
    console.log("=".repeat(30));
    const integrations = [
      {
        name: "Stripe Payments",
        status: auditReport.rawData.integrationValidation.stripe.success,
      },
      {
        name: "Supabase Database",
        status: auditReport.rawData.integrationValidation.supabase.success,
      },
      {
        name: "WebSocket Chat",
        status: auditReport.rawData.integrationValidation.websocket.success,
      },
      {
        name: "WebRTC Video Calls",
        status: auditReport.rawData.integrationValidation.webrtc.success,
      },
    ];

    integrations.forEach((integration) => {
      const status = integration.status ? "✅ Working" : "❌ Failed";
      console.log(`${integration.name}: ${status}`);
    });

    // Display top refactoring opportunities
    if (auditReport.refactoringOpportunities.length > 0) {
      console.log("\n🔧 TOP REFACTORING OPPORTUNITIES");
      console.log("=".repeat(40));
      auditReport.refactoringOpportunities
        .slice(0, 3)
        .forEach((opportunity, index) => {
          console.log(
            `${index + 1}. ${opportunity.title} (Priority: ${
              opportunity.priority
            }/10)`
          );
          console.log(`   Type: ${opportunity.type}`);
          console.log(
            `   Effort: ${opportunity.estimatedEffort} | Impact: ${opportunity.impactLevel}`
          );
          console.log(`   Files: ${opportunity.files.length} affected`);
          console.log("");
        });
    }

    // Save reports to files
    console.log("💾 Saving audit reports to files...");
    const savedFiles = await saveAuditReport(auditReport);

    console.log("\n📄 GENERATED REPORTS");
    console.log("=".repeat(30));
    savedFiles.forEach((file) => {
      console.log(`✅ ${file}`);
    });

    // Display action plan summary
    console.log("\n📋 ACTION PLAN SUMMARY");
    console.log("=".repeat(30));
    console.log(
      `Immediate Actions: ${auditReport.actionPlan.immediate.length} items`
    );
    console.log(
      `Short-term Actions: ${auditReport.actionPlan.shortTerm.length} items`
    );
    console.log(
      `Long-term Actions: ${auditReport.actionPlan.longTerm.length} items`
    );
    console.log(
      `Maintenance Tasks: ${auditReport.actionPlan.maintenance.length} items`
    );

    const totalHours = [
      ...auditReport.actionPlan.immediate,
      ...auditReport.actionPlan.shortTerm,
      ...auditReport.actionPlan.longTerm,
      ...auditReport.actionPlan.maintenance,
    ].reduce((sum, action) => sum + action.estimatedHours, 0);

    console.log(`Total Estimated Hours: ${totalHours} hours`);

    // Display next steps
    console.log("\n🚀 NEXT STEPS");
    console.log("=".repeat(20));
    console.log("1. Review the comprehensive audit report");
    console.log("2. Address critical issues immediately");
    console.log("3. Create tickets for high-priority items");
    console.log("4. Plan refactoring opportunities");
    console.log("5. Set up continuous monitoring");

    // Display recommendations based on health score
    console.log("\n💡 RECOMMENDATIONS");
    console.log("=".repeat(25));
    if (auditReport.summary.issuesBySeverity.critical > 0) {
      console.log(
        "🚨 URGENT: Address critical issues before proceeding with development"
      );
    }
    if (auditReport.summary.issuesByCategory.integration > 0) {
      console.log("🔗 Fix integration issues to ensure system functionality");
    }
    if (auditReport.summary.issuesByCategory.security > 0) {
      console.log("🔒 Resolve security vulnerabilities to protect user data");
    }
    if (auditReport.summary.refactoringOpportunities > 5) {
      console.log(
        "🔧 Consider dedicating time to refactoring for long-term maintainability"
      );
    }

    console.log("\n✅ Comprehensive audit completed successfully!");
    console.log(
      `📊 Health Score: ${auditReport.summary.overallHealthScore}/100`
    );
    console.log(`📄 Reports saved to: reports/ directory`);
  } catch (error) {
    console.error("❌ Error running comprehensive audit:", error);

    if (error instanceof Error) {
      console.error("Error details:", error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    }

    process.exit(1);
  }
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n🛑 Audit interrupted by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Audit terminated");
  process.exit(0);
});

// Run the audit
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export { main as runComprehensiveAudit };
