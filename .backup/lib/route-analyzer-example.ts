/**
 * Example usage of the Route Conflict Analyzer
 * This file demonstrates how to use the analyzer programmatically
 */

import {
  generateRouteReport,
  RouteConflictAnalyzer,
  scanAllDynamicRoutes,
  validateRoutes,
} from "./route-conflict-analyzer";

// Example 1: Basic usage with the class
async function basicUsage() {
  const analyzer = new RouteConflictAnalyzer("./app");

  // Scan all dynamic routes
  const routes = await analyzer.scanDynamicRoutes();
  console.log(`Found ${routes.length} dynamic routes`);

  // Detect conflicts
  const conflicts = analyzer.detectConflicts();
  console.log(`Found ${conflicts.length} conflicts`);

  // Generate resolution plan
  const plan = analyzer.generateResolutionPlan(conflicts);
  console.log(`Generated ${plan.recommendations.length} recommendations`);
}

// Example 2: Using utility functions
async function utilityFunctions() {
  // Quick scan
  const routes = await scanAllDynamicRoutes("./app");

  // Quick validation
  const validation = await validateRoutes("./app");

  // Quick report generation
  const report = await generateRouteReport("./app");

  return { routes, validation, report };
}

// Example 3: Custom analysis
async function customAnalysis() {
  const analyzer = new RouteConflictAnalyzer("./app");

  // Get all routes
  const routes = await analyzer.scanDynamicRoutes();

  // Filter by route type
  const apiRoutes = routes.filter((r) => r.routeType === "api");
  const pageRoutes = routes.filter((r) => r.routeType === "page");

  console.log(`API Routes: ${apiRoutes.length}`);
  console.log(`Page Routes: ${pageRoutes.length}`);

  // Find routes with specific parameters
  const appointmentRoutes = routes.filter(
    (r) =>
      r.parameters.some((p) => p.includes("appointment") || p === "id") &&
      r.path.includes("appointment")
  );

  console.log(`Appointment-related routes: ${appointmentRoutes.length}`);

  return { apiRoutes, pageRoutes, appointmentRoutes };
}

// Example 4: Integration with CI/CD
async function cicdIntegration() {
  try {
    const validation = await validateRoutes("./app");

    if (!validation.isValid) {
      console.error("❌ Route validation failed!");
      console.error(`Found ${validation.summary.totalConflicts} conflicts`);

      // Exit with error code for CI/CD
      process.exit(1);
    }

    console.log("✅ All routes are valid");
    return true;
  } catch (error) {
    console.error("❌ Route analysis failed:", error);
    process.exit(1);
  }
}

export { basicUsage, cicdIntegration, customAnalysis, utilityFunctions };
