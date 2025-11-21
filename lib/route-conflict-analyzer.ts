import { readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { ErrorLogger } from "./error-handling-utils";

export interface RouteConflict {
  path: string;
  conflictingParams: string[];
  affectedFiles: string[];
  severity: "critical" | "warning" | "info";
  description: string;
}

export interface DynamicRoute {
  path: string;
  parameters: string[];
  files: string[];
  routeType: "page" | "api" | "layout" | "loading" | "error";
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: RouteConflict[];
  routes: DynamicRoute[];
  summary: {
    totalRoutes: number;
    totalConflicts: number;
    criticalConflicts: number;
    warningConflicts: number;
  };
}

export interface ResolutionPlan {
  conflicts: RouteConflict[];
  recommendations: {
    conflictId: string;
    action: "rename" | "consolidate" | "restructure";
    description: string;
    steps: string[];
    estimatedEffort: "low" | "medium" | "high";
  }[];
}

/**
 * Route Conflict Analyzer Utility
 * Scans all dynamic routes in the app directory and identifies conflicts
 */
export class RouteConflictAnalyzer {
  private appDirectory: string;
  private routes: DynamicRoute[] = [];

  constructor(appDirectory: string = "./app") {
    this.appDirectory = appDirectory;
  }

  /**
   * Scan all dynamic routes in the app directory
   */
  async scanDynamicRoutes(): Promise<DynamicRoute[]> {
    this.routes = [];
    await this.scanDirectory(this.appDirectory);
    return this.routes;
  }

  /**
   * Recursively scan directory for dynamic routes
   */
  private async scanDirectory(
    dirPath: string,
    basePath: string = ""
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Check if this is a dynamic route directory
          if (this.isDynamicRoute(entry)) {
            const parameter = this.extractParameter(entry);
            const routePath = join(basePath, entry);

            // Find files in this dynamic route directory
            const files = await this.findRouteFiles(fullPath);

            if (files.length > 0) {
              const routeType = this.determineRouteType(files);

              this.routes.push({
                path: routePath.replace(/\\/g, "/"), // Normalize path separators
                parameters: [parameter],
                files: files.map((f) =>
                  relative(this.appDirectory, f).replace(/\\/g, "/")
                ),
                routeType,
              });
            }
          }

          // Continue scanning subdirectories
          await this.scanDirectory(fullPath, join(basePath, entry));
        }
      }
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "route_conflict_analyzer", action: "scan_directory", dirPath });
    }
  }

  /**
   * Check if directory name represents a dynamic route
   */
  private isDynamicRoute(dirName: string): boolean {
    return dirName.startsWith("[") && dirName.endsWith("]");
  }

  /**
   * Extract parameter name from dynamic route directory
   */
  private extractParameter(dirName: string): string {
    return dirName.slice(1, -1); // Remove [ and ]
  }

  /**
   * Find route files in a directory
   */
  private async findRouteFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const routeFileNames = [
      "page.tsx",
      "page.ts",
      "route.ts",
      "layout.tsx",
      "layout.ts",
      "loading.tsx",
      "loading.ts",
      "error.tsx",
      "error.ts",
    ];

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);

        if (stats.isFile() && routeFileNames.includes(entry)) {
          files.push(fullPath);
        } else if (stats.isDirectory()) {
          // Recursively check subdirectories for route files
          const subFiles = await this.findRouteFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "route_conflict_analyzer", action: "find_route_files", dirPath });
    }

    return files;
  }

  /**
   * Determine the type of route based on files present
   */
  private determineRouteType(files: string[]): DynamicRoute["routeType"] {
    const fileNames = files.map((f) => f.split(/[/\\]/).pop() || "");

    if (fileNames.includes("route.ts")) return "api";
    if (fileNames.includes("page.tsx") || fileNames.includes("page.ts"))
      return "page";
    if (fileNames.includes("layout.tsx") || fileNames.includes("layout.ts"))
      return "layout";
    if (fileNames.includes("loading.tsx") || fileNames.includes("loading.ts"))
      return "loading";
    if (fileNames.includes("error.tsx") || fileNames.includes("error.ts"))
      return "error";

    return "page"; // Default
  }

  /**
   * Detect conflicts in route parameters
   */
  detectConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const routeGroups = this.groupRoutesByPath();

    // Check for parameter naming conflicts within the same path
    for (const [pathPattern, routes] of routeGroups) {
      const parameterConflicts = this.findParameterConflicts(routes);
      conflicts.push(...parameterConflicts);
    }

    // Check for semantic conflicts (different parameters for similar functionality)
    const semanticConflicts = this.findSemanticConflicts();
    conflicts.push(...semanticConflicts);

    return conflicts;
  }

  /**
   * Group routes by their path pattern (ignoring parameter names)
   */
  private groupRoutesByPath(): Map<string, DynamicRoute[]> {
    const groups = new Map<string, DynamicRoute[]>();

    for (const route of this.routes) {
      // Create a normalized path pattern
      const pathPattern = route.path.replace(/\[.*?\]/g, "[param]");

      if (!groups.has(pathPattern)) {
        groups.set(pathPattern, []);
      }
      groups.get(pathPattern)!.push(route);
    }

    return groups;
  }

  /**
   * Find parameter naming conflicts within route groups
   */
  private findParameterConflicts(routes: DynamicRoute[]): RouteConflict[] {
    const conflicts: RouteConflict[] = [];

    if (routes.length <= 1) return conflicts;

    // Group by parameter names
    const parameterGroups = new Map<string, DynamicRoute[]>();

    for (const route of routes) {
      for (const param of route.parameters) {
        if (!parameterGroups.has(param)) {
          parameterGroups.set(param, []);
        }
        parameterGroups.get(param)!.push(route);
      }
    }

    // If we have multiple different parameter names for the same path pattern, it's a conflict
    const uniqueParams = Array.from(parameterGroups.keys());
    if (uniqueParams.length > 1) {
      const severity = this.determineSeverity(routes);

      conflicts.push({
        path: routes[0].path.replace(/\[.*?\]/g, "[CONFLICT]"),
        conflictingParams: uniqueParams,
        affectedFiles: routes.flatMap((r) => r.files),
        severity,
        description: `Multiple parameter names (${uniqueParams.join(
          ", "
        )}) used for the same route pattern. This can cause routing conflicts and inconsistent behavior.`,
      });
    }

    return conflicts;
  }

  /**
   * Find semantic conflicts (inconsistent naming across similar routes)
   */
  private findSemanticConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];

    // Define semantic groups - routes that should use consistent parameter naming
    const semanticGroups = [
      {
        name: "appointments",
        patterns: ["/chat/", "/api/appointments/", "/api/chat/"],
        expectedParam: "appointmentId",
        description:
          "Appointment-related routes should use consistent parameter naming",
      },
      {
        name: "doctors",
        patterns: ["/doctor/", "/api/doctors/"],
        expectedParam: "id",
        description:
          "Doctor-related routes should use consistent parameter naming",
      },
      {
        name: "video-sessions",
        patterns: ["/api/video/"],
        expectedParam: "sessionId",
        description:
          "Video session routes should use consistent parameter naming",
      },
      {
        name: "chat-rooms",
        patterns: ["/api/chat/"],
        expectedParam: "roomId",
        description: "Chat room routes should use consistent parameter naming",
      },
    ];

    for (const group of semanticGroups) {
      const groupRoutes = this.routes.filter((route) =>
        group.patterns.some((pattern) => route.path.includes(pattern))
      );

      if (groupRoutes.length > 1) {
        const inconsistentRoutes = groupRoutes.filter(
          (route) => !route.parameters.includes(group.expectedParam)
        );

        if (inconsistentRoutes.length > 0) {
          const allParams = [
            ...new Set(groupRoutes.flatMap((r) => r.parameters)),
          ];

          conflicts.push({
            path: `${group.name} routes`,
            conflictingParams: allParams,
            affectedFiles: inconsistentRoutes.flatMap((r) => r.files),
            severity: "warning",
            description: `${group.description}. Expected parameter: '${
              group.expectedParam
            }', but found: ${allParams.join(", ")}`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Determine conflict severity based on route types and usage
   */
  private determineSeverity(routes: DynamicRoute[]): RouteConflict["severity"] {
    // Critical if API routes are involved (can break functionality)
    if (routes.some((r) => r.routeType === "api")) {
      return "critical";
    }

    // Warning if multiple page routes
    if (routes.filter((r) => r.routeType === "page").length > 1) {
      return "warning";
    }

    return "info";
  }

  /**
   * Validate route consistency across the application
   */
  async validateRouteConsistency(): Promise<ValidationResult> {
    const routes = await this.scanDynamicRoutes();
    const conflicts = this.detectConflicts();

    const summary = {
      totalRoutes: routes.length,
      totalConflicts: conflicts.length,
      criticalConflicts: conflicts.filter((c) => c.severity === "critical")
        .length,
      warningConflicts: conflicts.filter((c) => c.severity === "warning")
        .length,
    };

    return {
      isValid: conflicts.length === 0,
      conflicts,
      routes,
      summary,
    };
  }

  /**
   * Generate resolution plan for identified conflicts
   */
  generateResolutionPlan(conflicts: RouteConflict[]): ResolutionPlan {
    const recommendations = conflicts.map((conflict, index) => {
      const conflictId = `conflict-${index}`;

      if (
        conflict.path.includes("appointments") ||
        conflict.conflictingParams.includes("appointmentId")
      ) {
        return {
          conflictId,
          action: "rename" as const,
          description: `Standardize appointment-related routes to use 'appointmentId' parameter`,
          steps: [
            `Rename parameter in ${conflict.affectedFiles.join(
              ", "
            )} to 'appointmentId'`,
            "Update all references to the parameter in the affected files",
            "Update any client-side code that calls these routes",
            "Test all affected functionality",
          ],
          estimatedEffort: "medium" as const,
        };
      }

      if (conflict.severity === "critical") {
        return {
          conflictId,
          action: "rename" as const,
          description: `Resolve critical parameter naming conflict: ${conflict.conflictingParams.join(
            " vs "
          )}`,
          steps: [
            "Choose the most descriptive parameter name",
            `Update all files: ${conflict.affectedFiles.join(", ")}`,
            "Update any imports or references",
            "Run tests to ensure no breaking changes",
          ],
          estimatedEffort: "high" as const,
        };
      }

      return {
        conflictId,
        action: "rename" as const,
        description: `Standardize parameter naming for consistency`,
        steps: [
          "Choose a consistent parameter name",
          `Update affected files: ${conflict.affectedFiles.join(", ")}`,
          "Update documentation if needed",
        ],
        estimatedEffort: "low" as const,
      };
    });

    return {
      conflicts,
      recommendations,
    };
  }

  /**
   * Generate detailed report of all dynamic routes and their parameters
   */
  async generateDetailedReport(): Promise<string> {
    const validationResult = await this.validateRouteConsistency();
    const resolutionPlan = this.generateResolutionPlan(
      validationResult.conflicts
    );

    let report = "# Route Conflict Analysis Report\n\n";

    // Summary
    report += "## Summary\n\n";
    report += `- **Total Dynamic Routes**: ${validationResult.summary.totalRoutes}\n`;
    report += `- **Total Conflicts**: ${validationResult.summary.totalConflicts}\n`;
    report += `- **Critical Conflicts**: ${validationResult.summary.criticalConflicts}\n`;
    report += `- **Warning Conflicts**: ${validationResult.summary.warningConflicts}\n`;
    report += `- **Overall Status**: ${
      validationResult.isValid ? "✅ Valid" : "❌ Issues Found"
    }\n\n`;

    // All Routes
    report += "## All Dynamic Routes\n\n";
    const routesByType = validationResult.routes.reduce((acc, route) => {
      if (!acc[route.routeType]) acc[route.routeType] = [];
      acc[route.routeType].push(route);
      return acc;
    }, {} as Record<string, DynamicRoute[]>);

    for (const [type, routes] of Object.entries(routesByType)) {
      report += `### ${type.toUpperCase()} Routes\n\n`;
      for (const route of routes) {
        report += `- **Path**: \`${route.path}\`\n`;
        report += `  - **Parameters**: ${route.parameters
          .map((p) => `\`[${p}]\``)
          .join(", ")}\n`;
        report += `  - **Files**: ${route.files.join(", ")}\n\n`;
      }
    }

    // Conflicts
    if (validationResult.conflicts.length > 0) {
      report += "## Identified Conflicts\n\n";
      for (const conflict of validationResult.conflicts) {
        const icon =
          conflict.severity === "critical"
            ? "🚨"
            : conflict.severity === "warning"
            ? "⚠️"
            : "ℹ️";
        report += `### ${icon} ${conflict.severity.toUpperCase()}: ${
          conflict.path
        }\n\n`;
        report += `**Description**: ${conflict.description}\n\n`;
        report += `**Conflicting Parameters**: ${conflict.conflictingParams
          .map((p) => `\`[${p}]\``)
          .join(", ")}\n\n`;
        report += `**Affected Files**:\n`;
        for (const file of conflict.affectedFiles) {
          report += `- \`${file}\`\n`;
        }
        report += "\n";
      }

      // Resolution Plan
      report += "## Resolution Plan\n\n";
      for (const recommendation of resolutionPlan.recommendations) {
        report += `### ${recommendation.action.toUpperCase()}: ${
          recommendation.description
        }\n\n`;
        report += `**Estimated Effort**: ${recommendation.estimatedEffort}\n\n`;
        report += `**Steps**:\n`;
        for (let i = 0; i < recommendation.steps.length; i++) {
          report += `${i + 1}. ${recommendation.steps[i]}\n`;
        }
        report += "\n";
      }
    } else {
      report +=
        "## ✅ No Conflicts Found\n\nAll dynamic routes are using consistent parameter naming.\n\n";
    }

    return report;
  }
}

// Utility functions for external use
export async function scanAllDynamicRoutes(
  appDirectory?: string
): Promise<DynamicRoute[]> {
  const analyzer = new RouteConflictAnalyzer(appDirectory);
  return analyzer.scanDynamicRoutes();
}

export async function validateRoutes(
  appDirectory?: string
): Promise<ValidationResult> {
  const analyzer = new RouteConflictAnalyzer(appDirectory);
  return analyzer.validateRouteConsistency();
}

export async function generateRouteReport(
  appDirectory?: string
): Promise<string> {
  const analyzer = new RouteConflictAnalyzer(appDirectory);
  return analyzer.generateDetailedReport();
}
