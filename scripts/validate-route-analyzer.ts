#!/usr/bin/env tsx

import { RouteConflictAnalyzer } from "../lib/route-conflict-analyzer";

/**
 * Simple validation script to test the route analyzer functionality
 */
async function validateAnalyzer() {
  console.log("🧪 Testing Route Conflict Analyzer...\n");

  try {
    const analyzer = new RouteConflictAnalyzer("./app");

    // Test 1: Scan dynamic routes
    console.log("1️⃣ Testing route scanning...");
    const routes = await analyzer.scanDynamicRoutes();
    console.log(`   ✅ Found ${routes.length} dynamic routes`);

    // Test 2: Validate consistency
    console.log("2️⃣ Testing validation...");
    const validation = await analyzer.validateRouteConsistency();
    console.log(
      `   ✅ Validation completed: ${
        validation.isValid ? "Valid" : "Issues found"
      }`
    );
    console.log(
      `   📊 Summary: ${validation.summary.totalConflicts} conflicts found`
    );

    // Test 3: Generate report
    console.log("3️⃣ Testing report generation...");
    const report = await analyzer.generateDetailedReport();
    console.log(`   ✅ Report generated (${report.length} characters)`);

    // Test 4: Resolution plan
    if (validation.conflicts.length > 0) {
      console.log("4️⃣ Testing resolution plan...");
      const plan = analyzer.generateResolutionPlan(validation.conflicts);
      console.log(
        `   ✅ Resolution plan created with ${plan.recommendations.length} recommendations`
      );
    }

    console.log("\n🎉 All tests passed! Route analyzer is working correctly.");

    // Show some sample results
    console.log("\n📋 Sample Results:");
    console.log(
      `   Routes found: ${routes
        .slice(0, 3)
        .map((r) => r.path)
        .join(", ")}...`
    );
    if (validation.conflicts.length > 0) {
      console.log(
        `   First conflict: ${validation.conflicts[0].description.substring(
          0,
          80
        )}...`
      );
    }

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run validation
if (require.main === module) {
  validateAnalyzer()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("❌ Validation error:", error);
      process.exit(1);
    });
}

export { validateAnalyzer };
