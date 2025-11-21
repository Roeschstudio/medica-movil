import { promises as fs } from "fs";
import path from "path";
import {
  CodeRedundancyAnalyzer,
  RedundancyReport,
} from "./code-redundancy-analyzer";
import {
  IntegrationValidationReport,
  IntegrationValidationSuite,
} from "./integration-validation-suite";
import {
  RouteConflictAnalyzer,
  ValidationResult as RouteValidationResult,
} from "./route-conflict-analyzer";
import {
  SystemBreakPointAnalyzer,
  SystemBreakPointReport,
} from "./system-break-point-analyzer";

// Core audit report interfaces
export interface AuditIssue {
  id: string;
  category:
    | "routing"
    | "code-quality"
    | "security"
    | "performance"
    | "integration"
    | "error-handling";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedFiles: string[];
  recommendedAction: string;
  estimatedEffort: "low" | "medium" | "high";
  impact: string;
  codeSnippet?: string;
  source: string; // Which analyzer found this issue
}

export interface RefactoringOpportunity {
  id: string;
  type:
    | "duplicate-code"
    | "component-consolidation"
    | "utility-extraction"
    | "api-optimization"
    | "performance";
  title: string;
  description: string;
  files: string[];
  potentialBenefits: string[];
  implementationSteps: string[];
  estimatedEffort: "low" | "medium" | "high";
  impactLevel: "low" | "medium" | "high";
  priority: number; // 1-10 scale
}

export interface AuditSummary {
  timestamp: Date;
  totalIssues: number;
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issuesByCategory: {
    routing: number;
    codeQuality: number;
    security: number;
    performance: number;
    integration: number;
    errorHandling: number;
  };
  refactoringOpportunities: number;
  overallHealthScore: number; // 0-100 scale
  recommendedActions: number;
}

export interface ComprehensiveAuditReport {
  summary: AuditSummary;
  issues: AuditIssue[];
  refactoringOpportunities: RefactoringOpportunity[];
  actionPlan: ActionPlan;
  rawData: {
    routeAnalysis: RouteValidationResult;
    redundancyAnalysis: RedundancyReport;
    integrationValidation: IntegrationValidationReport;
    breakPointAnalysis: SystemBreakPointReport;
  };
}

export interface ActionPlan {
  immediate: ActionItem[];
  shortTerm: ActionItem[];
  longTerm: ActionItem[];
  maintenance: ActionItem[];
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedHours: number;
  dependencies: string[];
  relatedIssues: string[];
  category: string;
  implementationGuide: string[];
}

/**
 * Comprehensive Audit Reporting System
 * Compiles results from all analysis tools and generates actionable reports
 */
export class AuditReportingSystem {
  private routeAnalyzer: RouteConflictAnalyzer;
  private redundancyAnalyzer: CodeRedundancyAnalyzer;
  private integrationValidator: IntegrationValidationSuite;
  private breakPointAnalyzer: SystemBreakPointAnalyzer;

  private workspaceRoot: string;
  private reportOutputDir: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.reportOutputDir = path.join(workspaceRoot, "reports");

    this.routeAnalyzer = new RouteConflictAnalyzer();
    this.redundancyAnalyzer = new CodeRedundancyAnalyzer();
    this.integrationValidator = new IntegrationValidationSuite();
    this.breakPointAnalyzer = new SystemBreakPointAnalyzer(workspaceRoot);
  }

  /**
   * Generate comprehensive audit report by running all analysis tools
   */
  async generateComprehensiveReport(): Promise<ComprehensiveAuditReport> {
    console.log("🔍 Starting comprehensive system audit...");

    // Run all analysis tools in parallel
    const [
      routeAnalysis,
      redundancyAnalysis,
      integrationValidation,
      breakPointAnalysis,
    ] = await Promise.all([
      this.routeAnalyzer.validateRouteConsistency(),
      this.redundancyAnalyzer.analyzeRedundancy(),
      this.integrationValidator.runFullValidation(),
      this.breakPointAnalyzer.analyze(),
    ]);

    console.log("📊 Compiling audit results...");

    // Convert analysis results to standardized issues
    const issues = this.compileIssues(
      routeAnalysis,
      redundancyAnalysis,
      integrationValidation,
      breakPointAnalysis
    );

    // Generate refactoring opportunities
    const refactoringOpportunities = this.generateRefactoringOpportunities(
      redundancyAnalysis,
      routeAnalysis
    );

    // Create summary
    const summary = this.createAuditSummary(issues, refactoringOpportunities);

    // Generate action plan
    const actionPlan = this.createActionPlan(issues, refactoringOpportunities);

    const report: ComprehensiveAuditReport = {
      summary,
      issues,
      refactoringOpportunities,
      actionPlan,
      rawData: {
        routeAnalysis,
        redundancyAnalysis,
        integrationValidation,
        breakPointAnalysis,
      },
    };

    console.log("✅ Audit report generation complete");
    return report;
  }

  /**
   * Compile issues from all analysis tools into standardized format
   */
  private compileIssues(
    routeAnalysis: RouteValidationResult,
    redundancyAnalysis: RedundancyReport,
    integrationValidation: IntegrationValidationReport,
    breakPointAnalysis: SystemBreakPointReport
  ): AuditIssue[] {
    const issues: AuditIssue[] = [];

    // Route conflicts
    routeAnalysis.conflicts.forEach((conflict, index) => {
      issues.push({
        id: `route-${index}`,
        category: "routing",
        severity: conflict.severity,
        title: `Route Parameter Conflict: ${conflict.path}`,
        description: conflict.description,
        affectedFiles: conflict.affectedFiles,
        recommendedAction: `Standardize parameter naming to use consistent conventions`,
        estimatedEffort: conflict.severity === "critical" ? "high" : "medium",
        impact:
          conflict.severity === "critical"
            ? "Application may fail to start or route incorrectly"
            : "Inconsistent developer experience",
        source: "Route Conflict Analyzer",
      });
    });

    // Code redundancy issues
    redundancyAnalysis.duplicateComponents.forEach((duplicate, index) => {
      issues.push({
        id: `component-duplicate-${index}`,
        category: "code-quality",
        severity: "medium",
        title: `Duplicate Component: ${duplicate.name}`,
        description: `Component ${duplicate.name} is duplicated across ${
          duplicate.files.length
        } files with ${Math.round(duplicate.similarity * 100)}% similarity`,
        affectedFiles: duplicate.files,
        recommendedAction:
          duplicate.recommendations[0] || "Consolidate duplicate components",
        estimatedEffort: "medium",
        impact: "Increased maintenance burden and potential inconsistencies",
        codeSnippet: duplicate.codeSnippet,
        source: "Code Redundancy Analyzer",
      });
    });

    redundancyAnalysis.duplicateUtilities.forEach((duplicate, index) => {
      issues.push({
        id: `utility-duplicate-${index}`,
        category: "code-quality",
        severity: "low",
        title: `Duplicate Utility: ${duplicate.functionName}`,
        description: `Utility function ${duplicate.functionName} is duplicated across ${duplicate.files.length} files`,
        affectedFiles: duplicate.files,
        recommendedAction:
          duplicate.recommendations[0] || "Consolidate duplicate utilities",
        estimatedEffort: "low",
        impact: "Code bloat and maintenance overhead",
        codeSnippet: duplicate.codeSnippet,
        source: "Code Redundancy Analyzer",
      });
    });

    redundancyAnalysis.unusedImports.forEach((unusedImport, index) => {
      issues.push({
        id: `unused-import-${index}`,
        category: "performance",
        severity: "low",
        title: `Unused Import: ${unusedImport.importName}`,
        description: `Import '${unusedImport.importName}' from '${unusedImport.importPath}' is not used`,
        affectedFiles: [unusedImport.file],
        recommendedAction: "Remove unused import to reduce bundle size",
        estimatedEffort: "low",
        impact: "Slightly increased bundle size",
        source: "Code Redundancy Analyzer",
      });
    });

    // Integration issues
    if (!integrationValidation.stripe.success) {
      issues.push({
        id: "stripe-integration",
        category: "integration",
        severity: "critical",
        title: "Stripe Payment Integration Failure",
        description: integrationValidation.stripe.message,
        affectedFiles: ["lib/stripe.ts", "app/api/payments/**"],
        recommendedAction: "Fix Stripe configuration and API key setup",
        estimatedEffort: "high",
        impact: "Payment functionality completely broken",
        source: "Integration Validation Suite",
      });
    }

    if (!integrationValidation.supabase.success) {
      issues.push({
        id: "supabase-integration",
        category: "integration",
        severity: "critical",
        title: "Supabase Database Integration Failure",
        description: integrationValidation.supabase.message,
        affectedFiles: ["lib/supabase.ts", "lib/db.ts"],
        recommendedAction: "Fix Supabase configuration and connection settings",
        estimatedEffort: "high",
        impact: "Database operations will fail",
        source: "Integration Validation Suite",
      });
    }

    if (!integrationValidation.websocket.success) {
      issues.push({
        id: "websocket-integration",
        category: "integration",
        severity: "high",
        title: "WebSocket Connection Failure",
        description: integrationValidation.websocket.message,
        affectedFiles: ["lib/socket.ts", "app/api/socketio/**"],
        recommendedAction:
          "Fix WebSocket server configuration and connection handling",
        estimatedEffort: "medium",
        impact: "Real-time chat features will not work",
        source: "Integration Validation Suite",
      });
    }

    if (!integrationValidation.webrtc.success) {
      issues.push({
        id: "webrtc-integration",
        category: "integration",
        severity: "high",
        title: "WebRTC Video Call Setup Failure",
        description: integrationValidation.webrtc.message,
        affectedFiles: [
          "lib/video-call-service.ts",
          "components/video-call/**",
        ],
        recommendedAction: "Fix WebRTC configuration and media device access",
        estimatedEffort: "medium",
        impact: "Video call functionality will not work",
        source: "Integration Validation Suite",
      });
    }

    // System break point issues
    breakPointAnalysis.errorHandling.forEach((issue, index) => {
      issues.push({
        id: `error-handling-${index}`,
        category: "error-handling",
        severity: issue.severity,
        title: issue.description,
        description: `${issue.type} detected in ${issue.file}`,
        affectedFiles: [issue.file],
        recommendedAction: issue.suggestion,
        estimatedEffort: issue.severity === "critical" ? "high" : "low",
        impact:
          issue.severity === "critical"
            ? "Application may crash or behave unpredictably"
            : "Potential runtime errors",
        codeSnippet: issue.codeSnippet,
        source: "System Break Point Analyzer",
      });
    });

    breakPointAnalysis.database.forEach((issue, index) => {
      issues.push({
        id: `database-${index}`,
        category: "performance",
        severity: issue.severity,
        title: issue.description,
        description: `${issue.type} detected in ${issue.file}`,
        affectedFiles: [issue.file],
        recommendedAction: issue.suggestion,
        estimatedEffort: "medium",
        impact: "Database performance issues or connection leaks",
        codeSnippet: issue.codeSnippet,
        source: "System Break Point Analyzer",
      });
    });

    breakPointAnalysis.authentication.forEach((issue, index) => {
      issues.push({
        id: `auth-${index}`,
        category: "security",
        severity: issue.severity,
        title: issue.description,
        description: `${issue.type} detected in ${issue.file}`,
        affectedFiles: [issue.file],
        recommendedAction: issue.suggestion,
        estimatedEffort: issue.severity === "critical" ? "high" : "medium",
        impact: "Security vulnerabilities and unauthorized access risks",
        codeSnippet: issue.codeSnippet,
        source: "System Break Point Analyzer",
      });
    });

    breakPointAnalysis.realtime.forEach((issue, index) => {
      issues.push({
        id: `realtime-${index}`,
        category: "performance",
        severity: issue.severity,
        title: issue.description,
        description: `${issue.type} detected in ${issue.file}`,
        affectedFiles: [issue.file],
        recommendedAction: issue.suggestion,
        estimatedEffort: "medium",
        impact: "Real-time features may fail or cause memory leaks",
        codeSnippet: issue.codeSnippet,
        source: "System Break Point Analyzer",
      });
    });

    return issues;
  }

  /**
   * Generate refactoring opportunities with impact and effort estimates
   */
  private generateRefactoringOpportunities(
    redundancyAnalysis: RedundancyReport,
    routeAnalysis: RouteValidationResult
  ): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];

    // Component consolidation opportunities
    redundancyAnalysis.duplicateComponents.forEach((duplicate, index) => {
      const priority =
        duplicate.files.length > 3 ? 8 : duplicate.files.length > 2 ? 6 : 4;

      opportunities.push({
        id: `consolidate-component-${index}`,
        type: "component-consolidation",
        title: `Consolidate ${duplicate.name} Component`,
        description: `Merge ${duplicate.files.length} duplicate instances of ${duplicate.name} into a single reusable component`,
        files: duplicate.files,
        potentialBenefits: [
          `Reduce codebase by ~${(duplicate.files.length - 1) * 50} lines`,
          "Improve maintainability and consistency",
          "Reduce bundle size",
          "Easier bug fixes and feature updates",
        ],
        implementationSteps: [
          "Analyze differences between duplicate components",
          "Create a unified component with configurable props",
          "Move consolidated component to shared location",
          "Update all imports and usage",
          "Remove duplicate files",
          "Test all affected functionality",
        ],
        estimatedEffort: duplicate.files.length > 3 ? "high" : "medium",
        impactLevel: duplicate.files.length > 3 ? "high" : "medium",
        priority,
      });
    });

    // Utility extraction opportunities
    redundancyAnalysis.duplicateUtilities.forEach((duplicate, index) => {
      opportunities.push({
        id: `extract-utility-${index}`,
        type: "utility-extraction",
        title: `Extract ${duplicate.functionName} Utility`,
        description: `Create shared utility for ${duplicate.functionName} used across ${duplicate.files.length} files`,
        files: duplicate.files,
        potentialBenefits: [
          "Eliminate code duplication",
          "Centralize business logic",
          "Easier testing and maintenance",
          "Consistent behavior across the app",
        ],
        implementationSteps: [
          "Create shared utility function in lib/utils.ts",
          "Add proper TypeScript types and JSDoc",
          "Update all imports to use shared utility",
          "Remove duplicate implementations",
          "Add unit tests for the utility",
        ],
        estimatedEffort: "low",
        impactLevel: "medium",
        priority: 5,
      });
    });

    // API optimization opportunities
    if (routeAnalysis.routes.length > 0) {
      const apiRoutes = routeAnalysis.routes.filter(
        (route) => route.routeType === "api"
      );
      if (apiRoutes.length > 10) {
        opportunities.push({
          id: "api-optimization",
          type: "api-optimization",
          title: "API Route Structure Optimization",
          description: `Optimize ${apiRoutes.length} API routes for better organization and performance`,
          files: apiRoutes.flatMap((route) => route.files),
          potentialBenefits: [
            "Improved API discoverability",
            "Better error handling consistency",
            "Reduced response times",
            "Enhanced security through middleware",
          ],
          implementationSteps: [
            "Group related API routes",
            "Implement consistent error handling middleware",
            "Add input validation middleware",
            "Optimize database queries",
            "Add response caching where appropriate",
            "Document API endpoints",
          ],
          estimatedEffort: "high",
          impactLevel: "high",
          priority: 7,
        });
      }
    }

    // Performance optimization opportunities
    if (redundancyAnalysis.unusedImports.length > 20) {
      opportunities.push({
        id: "bundle-optimization",
        type: "performance",
        title: "Bundle Size Optimization",
        description: `Remove ${redundancyAnalysis.unusedImports.length} unused imports and optimize bundle size`,
        files: [
          ...new Set(redundancyAnalysis.unusedImports.map((imp) => imp.file)),
        ],
        potentialBenefits: [
          "Reduced bundle size",
          "Faster page load times",
          "Improved Core Web Vitals",
          "Better user experience",
        ],
        implementationSteps: [
          "Configure ESLint to detect unused imports",
          "Remove all unused imports",
          "Analyze bundle with webpack-bundle-analyzer",
          "Implement code splitting for large components",
          "Add dynamic imports for non-critical features",
          "Set up automated bundle size monitoring",
        ],
        estimatedEffort: "medium",
        impactLevel: "medium",
        priority: 6,
      });
    }

    return opportunities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Create audit summary with health score calculation
   */
  private createAuditSummary(
    issues: AuditIssue[],
    refactoringOpportunities: RefactoringOpportunity[]
  ): AuditSummary {
    const issuesBySeverity = {
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    };

    const issuesByCategory = {
      routing: issues.filter((i) => i.category === "routing").length,
      codeQuality: issues.filter((i) => i.category === "code-quality").length,
      security: issues.filter((i) => i.category === "security").length,
      performance: issues.filter((i) => i.category === "performance").length,
      integration: issues.filter((i) => i.category === "integration").length,
      errorHandling: issues.filter((i) => i.category === "error-handling")
        .length,
    };

    // Calculate health score (0-100)
    const healthScore = this.calculateHealthScore(issuesBySeverity);

    return {
      timestamp: new Date(),
      totalIssues: issues.length,
      issuesBySeverity,
      issuesByCategory,
      refactoringOpportunities: refactoringOpportunities.length,
      overallHealthScore: healthScore,
      recommendedActions: issues.filter(
        (i) => i.severity === "critical" || i.severity === "high"
      ).length,
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateHealthScore(issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  }): number {
    const baseScore = 100;
    const criticalPenalty = issuesBySeverity.critical * 20;
    const highPenalty = issuesBySeverity.high * 10;
    const mediumPenalty = issuesBySeverity.medium * 5;
    const lowPenalty = issuesBySeverity.low * 1;

    const totalPenalty =
      criticalPenalty + highPenalty + mediumPenalty + lowPenalty;
    const score = Math.max(0, baseScore - totalPenalty);

    return Math.round(score);
  }

  /**
   * Create prioritized action plan
   */
  private createActionPlan(
    issues: AuditIssue[],
    refactoringOpportunities: RefactoringOpportunity[]
  ): ActionPlan {
    const immediate: ActionItem[] = [];
    const shortTerm: ActionItem[] = [];
    const longTerm: ActionItem[] = [];
    const maintenance: ActionItem[] = [];

    // Immediate actions (critical issues)
    issues
      .filter((i) => i.severity === "critical")
      .forEach((issue, index) => {
        immediate.push({
          id: `immediate-${index}`,
          title: `Fix Critical Issue: ${issue.title}`,
          description: issue.description,
          priority: "critical",
          estimatedHours:
            issue.estimatedEffort === "high"
              ? 8
              : issue.estimatedEffort === "medium"
              ? 4
              : 2,
          dependencies: [],
          relatedIssues: [issue.id],
          category: issue.category,
          implementationGuide: [
            issue.recommendedAction,
            "Test the fix thoroughly",
            "Update documentation if needed",
            "Deploy to staging for validation",
          ],
        });
      });

    // Short-term actions (high priority issues and high-impact refactoring)
    issues
      .filter((i) => i.severity === "high")
      .forEach((issue, index) => {
        shortTerm.push({
          id: `short-term-${index}`,
          title: `Resolve: ${issue.title}`,
          description: issue.description,
          priority: "high",
          estimatedHours:
            issue.estimatedEffort === "high"
              ? 6
              : issue.estimatedEffort === "medium"
              ? 3
              : 1,
          dependencies: [],
          relatedIssues: [issue.id],
          category: issue.category,
          implementationGuide: [
            issue.recommendedAction,
            "Create unit tests if applicable",
            "Review with team",
            "Document changes",
          ],
        });
      });

    refactoringOpportunities
      .filter((o) => o.priority >= 7)
      .forEach((opportunity, index) => {
        shortTerm.push({
          id: `refactor-${index}`,
          title: opportunity.title,
          description: opportunity.description,
          priority: "high",
          estimatedHours:
            opportunity.estimatedEffort === "high"
              ? 12
              : opportunity.estimatedEffort === "medium"
              ? 6
              : 3,
          dependencies: [],
          relatedIssues: [],
          category: "refactoring",
          implementationGuide: opportunity.implementationSteps,
        });
      });

    // Long-term actions (medium priority and remaining refactoring)
    issues
      .filter((i) => i.severity === "medium")
      .forEach((issue, index) => {
        longTerm.push({
          id: `long-term-${index}`,
          title: `Improve: ${issue.title}`,
          description: issue.description,
          priority: "medium",
          estimatedHours:
            issue.estimatedEffort === "high"
              ? 4
              : issue.estimatedEffort === "medium"
              ? 2
              : 1,
          dependencies: [],
          relatedIssues: [issue.id],
          category: issue.category,
          implementationGuide: [
            issue.recommendedAction,
            "Consider impact on existing functionality",
            "Plan implementation in phases if needed",
          ],
        });
      });

    refactoringOpportunities
      .filter((o) => o.priority < 7)
      .forEach((opportunity, index) => {
        longTerm.push({
          id: `refactor-long-${index}`,
          title: opportunity.title,
          description: opportunity.description,
          priority: "medium",
          estimatedHours:
            opportunity.estimatedEffort === "high"
              ? 8
              : opportunity.estimatedEffort === "medium"
              ? 4
              : 2,
          dependencies: [],
          relatedIssues: [],
          category: "refactoring",
          implementationGuide: opportunity.implementationSteps,
        });
      });

    // Maintenance actions (low priority issues and ongoing tasks)
    issues
      .filter((i) => i.severity === "low")
      .forEach((issue, index) => {
        maintenance.push({
          id: `maintenance-${index}`,
          title: `Clean up: ${issue.title}`,
          description: issue.description,
          priority: "low",
          estimatedHours: 0.5,
          dependencies: [],
          relatedIssues: [issue.id],
          category: issue.category,
          implementationGuide: [
            issue.recommendedAction,
            "Can be done during regular maintenance windows",
          ],
        });
      });

    // Add ongoing maintenance tasks
    maintenance.push({
      id: "maintenance-monitoring",
      title: "Set up Continuous Code Quality Monitoring",
      description: "Implement automated tools to prevent future issues",
      priority: "low",
      estimatedHours: 4,
      dependencies: [],
      relatedIssues: [],
      category: "maintenance",
      implementationGuide: [
        "Configure ESLint with stricter rules",
        "Set up automated dependency updates",
        "Implement code quality gates in CI/CD",
        "Schedule regular audit reviews",
      ],
    });

    return { immediate, shortTerm, longTerm, maintenance };
  }
  /**
   * Save comprehensive audit report to files
   */
  async saveReportToFiles(report: ComprehensiveAuditReport): Promise<string[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const savedFiles: string[] = [];

    // Ensure reports directory exists
    await this.ensureReportsDirectory();

    // Save main audit report
    const mainReportPath = path.join(
      this.reportOutputDir,
      `comprehensive-audit-${timestamp}.md`
    );
    const mainReportContent = await this.generateMarkdownReport(report);
    await fs.writeFile(mainReportPath, mainReportContent, "utf-8");
    savedFiles.push(mainReportPath);

    // Save JSON report for programmatic access
    const jsonReportPath = path.join(
      this.reportOutputDir,
      `audit-data-${timestamp}.json`
    );
    await fs.writeFile(
      jsonReportPath,
      JSON.stringify(report, null, 2),
      "utf-8"
    );
    savedFiles.push(jsonReportPath);

    // Save action plan as separate file
    const actionPlanPath = path.join(
      this.reportOutputDir,
      `action-plan-${timestamp}.md`
    );
    const actionPlanContent = this.generateActionPlanMarkdown(
      report.actionPlan
    );
    await fs.writeFile(actionPlanPath, actionPlanContent, "utf-8");
    savedFiles.push(actionPlanPath);

    // Save executive summary
    const summaryPath = path.join(
      this.reportOutputDir,
      `audit-summary-${timestamp}.md`
    );
    const summaryContent = this.generateExecutiveSummary(report);
    await fs.writeFile(summaryPath, summaryContent, "utf-8");
    savedFiles.push(summaryPath);

    console.log(`📄 Audit reports saved to: ${savedFiles.join(", ")}`);
    return savedFiles;
  }

  /**
   * Generate comprehensive markdown report
   */
  private async generateMarkdownReport(
    report: ComprehensiveAuditReport
  ): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push("# Comprehensive System Audit Report");
    lines.push(`Generated: ${report.summary.timestamp.toISOString()}`);
    lines.push(
      `Overall Health Score: ${report.summary.overallHealthScore}/100`
    );
    lines.push("");

    // Executive Summary
    lines.push("## Executive Summary");
    lines.push("");
    lines.push(
      this.getHealthScoreDescription(report.summary.overallHealthScore)
    );
    lines.push("");
    lines.push(`- **Total Issues Found**: ${report.summary.totalIssues}`);
    lines.push(
      `- **Critical Issues**: ${report.summary.issuesBySeverity.critical} (require immediate attention)`
    );
    lines.push(
      `- **High Priority Issues**: ${report.summary.issuesBySeverity.high}`
    );
    lines.push(
      `- **Refactoring Opportunities**: ${report.summary.refactoringOpportunities}`
    );
    lines.push(
      `- **Recommended Immediate Actions**: ${report.summary.recommendedActions}`
    );
    lines.push("");

    // Issues by Category
    lines.push("## Issues by Category");
    lines.push("");
    lines.push("| Category | Count | Description |");
    lines.push("|----------|-------|-------------|");
    lines.push(
      `| Routing | ${report.summary.issuesByCategory.routing} | Route conflicts and parameter inconsistencies |`
    );
    lines.push(
      `| Code Quality | ${report.summary.issuesByCategory.codeQuality} | Duplicate code and maintainability issues |`
    );
    lines.push(
      `| Security | ${report.summary.issuesByCategory.security} | Authentication and authorization vulnerabilities |`
    );
    lines.push(
      `| Performance | ${report.summary.issuesByCategory.performance} | Performance bottlenecks and optimization opportunities |`
    );
    lines.push(
      `| Integration | ${report.summary.issuesByCategory.integration} | External service integration failures |`
    );
    lines.push(
      `| Error Handling | ${report.summary.issuesByCategory.errorHandling} | Missing error handling and exception management |`
    );
    lines.push("");

    // Critical Issues
    const criticalIssues = report.issues.filter(
      (i) => i.severity === "critical"
    );
    if (criticalIssues.length > 0) {
      lines.push("## 🚨 Critical Issues (Immediate Action Required)");
      lines.push("");
      criticalIssues.forEach((issue, index) => {
        lines.push(`### ${index + 1}. ${issue.title}`);
        lines.push(
          `**Category**: ${issue.category} | **Source**: ${issue.source}`
        );
        lines.push(`**Description**: ${issue.description}`);
        lines.push(`**Impact**: ${issue.impact}`);
        lines.push(`**Recommended Action**: ${issue.recommendedAction}`);
        lines.push(`**Estimated Effort**: ${issue.estimatedEffort}`);
        lines.push(`**Affected Files**:`);
        issue.affectedFiles.forEach((file) => {
          lines.push(`- \`${file}\``);
        });
        if (issue.codeSnippet) {
          lines.push(`**Code Snippet**:`);
          lines.push("```");
          lines.push(issue.codeSnippet);
          lines.push("```");
        }
        lines.push("");
      });
    }

    // High Priority Issues
    const highIssues = report.issues.filter((i) => i.severity === "high");
    if (highIssues.length > 0) {
      lines.push("## ⚠️ High Priority Issues");
      lines.push("");
      highIssues.forEach((issue, index) => {
        lines.push(`### ${index + 1}. ${issue.title}`);
        lines.push(
          `**Category**: ${issue.category} | **Source**: ${issue.source}`
        );
        lines.push(`**Description**: ${issue.description}`);
        lines.push(`**Recommended Action**: ${issue.recommendedAction}`);
        lines.push(`**Affected Files**: ${issue.affectedFiles.join(", ")}`);
        lines.push("");
      });
    }

    // Refactoring Opportunities
    if (report.refactoringOpportunities.length > 0) {
      lines.push("## 🔧 Refactoring Opportunities");
      lines.push("");
      report.refactoringOpportunities.forEach((opportunity, index) => {
        lines.push(
          `### ${index + 1}. ${opportunity.title} (Priority: ${
            opportunity.priority
          }/10)`
        );
        lines.push(
          `**Type**: ${opportunity.type} | **Effort**: ${opportunity.estimatedEffort} | **Impact**: ${opportunity.impactLevel}`
        );
        lines.push(`**Description**: ${opportunity.description}`);
        lines.push("");
        lines.push("**Potential Benefits**:");
        opportunity.potentialBenefits.forEach((benefit) => {
          lines.push(`- ${benefit}`);
        });
        lines.push("");
        lines.push("**Implementation Steps**:");
        opportunity.implementationSteps.forEach((step, stepIndex) => {
          lines.push(`${stepIndex + 1}. ${step}`);
        });
        lines.push("");
        lines.push(`**Affected Files**: ${opportunity.files.length} files`);
        lines.push("");
      });
    }

    // Medium and Low Priority Issues Summary
    const mediumIssues = report.issues.filter((i) => i.severity === "medium");
    const lowIssues = report.issues.filter((i) => i.severity === "low");

    if (mediumIssues.length > 0 || lowIssues.length > 0) {
      lines.push("## 📋 Additional Issues");
      lines.push("");
      lines.push(`**Medium Priority Issues**: ${mediumIssues.length}`);
      lines.push(`**Low Priority Issues**: ${lowIssues.length}`);
      lines.push("");
      lines.push(
        "*See the detailed action plan for complete list and implementation guidance.*"
      );
      lines.push("");
    }

    // Integration Status
    lines.push("## 🔗 Integration Status");
    lines.push("");
    lines.push("| Integration | Status | Details |");
    lines.push("|-------------|--------|---------|");
    lines.push(
      `| Stripe Payments | ${
        report.rawData.integrationValidation.stripe.success
          ? "✅ Working"
          : "❌ Failed"
      } | ${report.rawData.integrationValidation.stripe.message} |`
    );
    lines.push(
      `| Supabase Database | ${
        report.rawData.integrationValidation.supabase.success
          ? "✅ Working"
          : "❌ Failed"
      } | ${report.rawData.integrationValidation.supabase.message} |`
    );
    lines.push(
      `| WebSocket Chat | ${
        report.rawData.integrationValidation.websocket.success
          ? "✅ Working"
          : "❌ Failed"
      } | ${report.rawData.integrationValidation.websocket.message} |`
    );
    lines.push(
      `| WebRTC Video Calls | ${
        report.rawData.integrationValidation.webrtc.success
          ? "✅ Working"
          : "❌ Failed"
      } | ${report.rawData.integrationValidation.webrtc.message} |`
    );
    lines.push("");

    // Recommendations
    lines.push("## 💡 Key Recommendations");
    lines.push("");
    lines.push(
      "1. **Address Critical Issues First**: Focus on resolving all critical issues before proceeding with other improvements"
    );
    lines.push(
      "2. **Implement Error Handling**: Add comprehensive error handling to prevent application crashes"
    );
    lines.push(
      "3. **Fix Integration Issues**: Ensure all external service integrations are working properly"
    );
    lines.push(
      "4. **Code Quality Improvements**: Consolidate duplicate code and remove unused imports"
    );
    lines.push(
      "5. **Security Enhancements**: Implement proper authentication and authorization checks"
    );
    lines.push(
      "6. **Performance Optimization**: Address database connection issues and bundle size optimization"
    );
    lines.push(
      "7. **Monitoring Setup**: Implement continuous monitoring to prevent future issues"
    );
    lines.push("");

    // Next Steps
    lines.push("## 🚀 Next Steps");
    lines.push("");
    lines.push("1. Review this audit report with the development team");
    lines.push(
      "2. Prioritize critical and high-priority issues for immediate resolution"
    );
    lines.push(
      "3. Create tickets/tasks for each action item in the action plan"
    );
    lines.push("4. Assign team members to specific issues based on expertise");
    lines.push(
      "5. Set up regular code quality monitoring to prevent regression"
    );
    lines.push("6. Schedule follow-up audit in 30 days to measure progress");
    lines.push("");

    lines.push("---");
    lines.push(
      `*Report generated by Comprehensive Audit System on ${new Date().toISOString()}*`
    );

    return lines.join("\n");
  }

  /**
   * Generate action plan markdown
   */
  private generateActionPlanMarkdown(actionPlan: ActionPlan): string {
    const lines: string[] = [];

    lines.push("# System Audit Action Plan");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    // Immediate Actions
    if (actionPlan.immediate.length > 0) {
      lines.push("## 🚨 Immediate Actions (Critical - Do First)");
      lines.push("");
      actionPlan.immediate.forEach((action, index) => {
        lines.push(`### ${index + 1}. ${action.title}`);
        lines.push(
          `**Priority**: ${action.priority.toUpperCase()} | **Estimated Hours**: ${
            action.estimatedHours
          }`
        );
        lines.push(`**Category**: ${action.category}`);
        lines.push(`**Description**: ${action.description}`);
        lines.push("");
        lines.push("**Implementation Guide**:");
        action.implementationGuide.forEach((step, stepIndex) => {
          lines.push(`${stepIndex + 1}. ${step}`);
        });
        lines.push("");
        if (action.relatedIssues.length > 0) {
          lines.push(`**Related Issues**: ${action.relatedIssues.join(", ")}`);
          lines.push("");
        }
      });
    }

    // Short-term Actions
    if (actionPlan.shortTerm.length > 0) {
      lines.push("## ⚡ Short-term Actions (1-2 weeks)");
      lines.push("");
      actionPlan.shortTerm.forEach((action, index) => {
        lines.push(`### ${index + 1}. ${action.title}`);
        lines.push(
          `**Priority**: ${action.priority.toUpperCase()} | **Estimated Hours**: ${
            action.estimatedHours
          }`
        );
        lines.push(`**Category**: ${action.category}`);
        lines.push(`**Description**: ${action.description}`);
        lines.push("");
        lines.push("**Implementation Guide**:");
        action.implementationGuide.forEach((step, stepIndex) => {
          lines.push(`${stepIndex + 1}. ${step}`);
        });
        lines.push("");
      });
    }

    // Long-term Actions
    if (actionPlan.longTerm.length > 0) {
      lines.push("## 📅 Long-term Actions (1-3 months)");
      lines.push("");
      actionPlan.longTerm.forEach((action, index) => {
        lines.push(`### ${index + 1}. ${action.title}`);
        lines.push(
          `**Priority**: ${action.priority.toUpperCase()} | **Estimated Hours**: ${
            action.estimatedHours
          }`
        );
        lines.push(`**Category**: ${action.category}`);
        lines.push(`**Description**: ${action.description}`);
        lines.push("");
      });
    }

    // Maintenance Actions
    if (actionPlan.maintenance.length > 0) {
      lines.push("## 🔧 Ongoing Maintenance");
      lines.push("");
      actionPlan.maintenance.forEach((action, index) => {
        lines.push(
          `- **${action.title}** (${action.estimatedHours}h): ${action.description}`
        );
      });
      lines.push("");
    }

    // Summary
    const totalHours = [
      ...actionPlan.immediate,
      ...actionPlan.shortTerm,
      ...actionPlan.longTerm,
      ...actionPlan.maintenance,
    ].reduce((sum, action) => sum + action.estimatedHours, 0);

    lines.push("## 📊 Summary");
    lines.push("");
    lines.push(`- **Immediate Actions**: ${actionPlan.immediate.length} items`);
    lines.push(
      `- **Short-term Actions**: ${actionPlan.shortTerm.length} items`
    );
    lines.push(`- **Long-term Actions**: ${actionPlan.longTerm.length} items`);
    lines.push(
      `- **Maintenance Tasks**: ${actionPlan.maintenance.length} items`
    );
    lines.push(`- **Total Estimated Hours**: ${totalHours} hours`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(report: ComprehensiveAuditReport): string {
    const lines: string[] = [];

    lines.push("# Executive Summary - System Audit");
    lines.push(`Date: ${report.summary.timestamp.toLocaleDateString()}`);
    lines.push("");

    // Health Score
    lines.push("## Overall System Health");
    lines.push(`**Health Score: ${report.summary.overallHealthScore}/100**`);
    lines.push("");
    lines.push(
      this.getHealthScoreDescription(report.summary.overallHealthScore)
    );
    lines.push("");

    // Key Metrics
    lines.push("## Key Metrics");
    lines.push("");
    lines.push(`- Total Issues Identified: **${report.summary.totalIssues}**`);
    lines.push(
      `- Critical Issues: **${report.summary.issuesBySeverity.critical}**`
    );
    lines.push(
      `- High Priority Issues: **${report.summary.issuesBySeverity.high}**`
    );
    lines.push(
      `- Refactoring Opportunities: **${report.summary.refactoringOpportunities}**`
    );
    lines.push("");

    // Critical Findings
    const criticalIssues = report.issues.filter(
      (i) => i.severity === "critical"
    );
    if (criticalIssues.length > 0) {
      lines.push("## Critical Findings");
      lines.push("");
      criticalIssues.forEach((issue, index) => {
        lines.push(`${index + 1}. **${issue.title}**: ${issue.description}`);
      });
      lines.push("");
    }

    // Integration Status
    lines.push("## System Integration Status");
    lines.push("");
    const integrations = [
      {
        name: "Stripe Payments",
        status: report.rawData.integrationValidation.stripe.success,
      },
      {
        name: "Supabase Database",
        status: report.rawData.integrationValidation.supabase.success,
      },
      {
        name: "WebSocket Chat",
        status: report.rawData.integrationValidation.websocket.success,
      },
      {
        name: "WebRTC Video Calls",
        status: report.rawData.integrationValidation.webrtc.success,
      },
    ];

    integrations.forEach((integration) => {
      lines.push(
        `- ${integration.name}: ${
          integration.status ? "✅ Operational" : "❌ Issues Detected"
        }`
      );
    });
    lines.push("");

    // Recommendations
    lines.push("## Immediate Recommendations");
    lines.push("");
    if (report.summary.issuesBySeverity.critical > 0) {
      lines.push(
        "1. **Address Critical Issues Immediately** - These issues may prevent the application from functioning properly"
      );
    }
    if (report.summary.issuesByCategory.integration > 0) {
      lines.push(
        "2. **Fix Integration Issues** - External service integrations are not working correctly"
      );
    }
    if (report.summary.issuesByCategory.security > 0) {
      lines.push(
        "3. **Resolve Security Vulnerabilities** - Authentication and authorization issues detected"
      );
    }
    lines.push(
      "4. **Implement Code Quality Improvements** - Reduce technical debt through refactoring"
    );
    lines.push(
      "5. **Set Up Monitoring** - Implement continuous monitoring to prevent future issues"
    );
    lines.push("");

    // Timeline
    lines.push("## Recommended Timeline");
    lines.push("");
    lines.push("- **Week 1**: Address all critical issues");
    lines.push(
      "- **Week 2-3**: Resolve high priority issues and integration problems"
    );
    lines.push(
      "- **Month 2**: Implement refactoring opportunities and code quality improvements"
    );
    lines.push(
      "- **Ongoing**: Maintain code quality through automated monitoring"
    );
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Get health score description
   */
  private getHealthScoreDescription(score: number): string {
    if (score >= 90) {
      return "🟢 **Excellent** - System is in great condition with minimal issues.";
    } else if (score >= 75) {
      return "🟡 **Good** - System is generally healthy with some areas for improvement.";
    } else if (score >= 60) {
      return "🟠 **Fair** - System has several issues that should be addressed soon.";
    } else if (score >= 40) {
      return "🔴 **Poor** - System has significant issues that require immediate attention.";
    } else {
      return "🚨 **Critical** - System has severe issues that may prevent proper operation.";
    }
  }

  /**
   * Ensure reports directory exists
   */
  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.access(this.reportOutputDir);
    } catch {
      await fs.mkdir(this.reportOutputDir, { recursive: true });
    }
  }

  /**
   * Generate issue categorization by severity
   */
  categorizeIssuesBySeverity(issues: AuditIssue[]): {
    [key: string]: AuditIssue[];
  } {
    return {
      critical: issues.filter((i) => i.severity === "critical"),
      high: issues.filter((i) => i.severity === "high"),
      medium: issues.filter((i) => i.severity === "medium"),
      low: issues.filter((i) => i.severity === "low"),
    };
  }

  /**
   * Generate actionable recommendation generator with implementation steps
   */
  generateActionableRecommendations(issues: AuditIssue[]): ActionItem[] {
    const recommendations: ActionItem[] = [];

    // Group issues by category for better recommendations
    const issuesByCategory = issues.reduce((acc, issue) => {
      if (!acc[issue.category]) acc[issue.category] = [];
      acc[issue.category].push(issue);
      return acc;
    }, {} as { [key: string]: AuditIssue[] });

    Object.entries(issuesByCategory).forEach(([category, categoryIssues]) => {
      const criticalCount = categoryIssues.filter(
        (i) => i.severity === "critical"
      ).length;
      const highCount = categoryIssues.filter(
        (i) => i.severity === "high"
      ).length;

      if (criticalCount > 0 || highCount > 0) {
        recommendations.push({
          id: `category-${category}`,
          title: `Address ${category} Issues`,
          description: `Resolve ${criticalCount} critical and ${highCount} high priority ${category} issues`,
          priority: criticalCount > 0 ? "critical" : "high",
          estimatedHours: criticalCount * 4 + highCount * 2,
          dependencies: [],
          relatedIssues: categoryIssues.map((i) => i.id),
          category,
          implementationGuide: [
            `Review all ${category} issues in detail`,
            "Prioritize by severity and impact",
            "Implement fixes systematically",
            "Test each fix thoroughly",
            "Document changes and lessons learned",
          ],
        });
      }
    });

    return recommendations;
  }

  /**
   * Build refactoring opportunity identifier with impact and effort estimates
   */
  identifyRefactoringOpportunities(
    redundancyReport: RedundancyReport,
    routeAnalysis: RouteValidationResult
  ): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];

    // Analyze duplicate components for consolidation opportunities
    redundancyReport.duplicateComponents.forEach((duplicate, index) => {
      const impactLevel =
        duplicate.files.length > 5
          ? "high"
          : duplicate.files.length > 2
          ? "medium"
          : "low";
      const estimatedEffort =
        duplicate.similarity > 0.9
          ? "low"
          : duplicate.similarity > 0.8
          ? "medium"
          : "high";

      opportunities.push({
        id: `component-consolidation-${index}`,
        type: "component-consolidation",
        title: `Consolidate ${duplicate.name} Components`,
        description: `${
          duplicate.files.length
        } similar components with ${Math.round(
          duplicate.similarity * 100
        )}% similarity`,
        files: duplicate.files,
        potentialBenefits: [
          `Reduce maintenance overhead`,
          `Improve consistency across the application`,
          `Reduce bundle size by ~${(duplicate.files.length - 1) * 2}KB`,
          `Easier bug fixes and feature updates`,
        ],
        implementationSteps: [
          "Analyze component differences and create unified interface",
          "Create consolidated component with configurable props",
          "Update all usage locations",
          "Remove duplicate files",
          "Add comprehensive tests",
        ],
        estimatedEffort,
        impactLevel,
        priority: duplicate.files.length > 3 ? 8 : 5,
      });
    });

    // Analyze API structure for optimization opportunities
    const apiRoutes = routeAnalysis.routes.filter((r) => r.routeType === "api");
    if (apiRoutes.length > 15) {
      opportunities.push({
        id: "api-structure-optimization",
        type: "api-optimization",
        title: "Optimize API Route Structure",
        description: `Restructure ${apiRoutes.length} API routes for better organization and performance`,
        files: apiRoutes.flatMap((r) => r.files),
        potentialBenefits: [
          "Improved API discoverability and documentation",
          "Better error handling consistency",
          "Enhanced security through middleware",
          "Reduced response times through optimization",
        ],
        implementationSteps: [
          "Group related API endpoints",
          "Implement consistent middleware pattern",
          "Add comprehensive input validation",
          "Optimize database queries",
          "Add response caching strategies",
        ],
        estimatedEffort: "high",
        impactLevel: "high",
        priority: 7,
      });
    }

    return opportunities.sort((a, b) => b.priority - a.priority);
  }
}

// Export singleton instance for easy use
export const auditReportingSystem = new AuditReportingSystem();

// Export utility functions
export async function generateComprehensiveAudit(): Promise<ComprehensiveAuditReport> {
  return auditReportingSystem.generateComprehensiveReport();
}

export async function saveAuditReport(
  report: ComprehensiveAuditReport
): Promise<string[]> {
  return auditReportingSystem.saveReportToFiles(report);
}
