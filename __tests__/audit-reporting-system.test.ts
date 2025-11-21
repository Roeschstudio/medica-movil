import { beforeEach, describe, expect, it } from "vitest";
import {
  AuditIssue,
  AuditReportingSystem,
  RefactoringOpportunity,
} from "../lib/audit-reporting-system";
import { RedundancyReport } from "../lib/code-redundancy-analyzer";
import { IntegrationValidationReport } from "../lib/integration-validation-suite";
import { ValidationResult as RouteValidationResult } from "../lib/route-conflict-analyzer";
import { SystemBreakPointReport } from "../lib/system-break-point-analyzer";

// Mock the analyzer classes
vi.mock("../lib/route-conflict-analyzer");
vi.mock("../lib/code-redundancy-analyzer");
vi.mock("../lib/integration-validation-suite");
vi.mock("../lib/system-break-point-analyzer");

describe("AuditReportingSystem", () => {
  let auditSystem: AuditReportingSystem;
  let mockRouteAnalysis: RouteValidationResult;
  let mockRedundancyAnalysis: RedundancyReport;
  let mockIntegrationValidation: IntegrationValidationReport;
  let mockBreakPointAnalysis: SystemBreakPointReport;

  beforeEach(() => {
    auditSystem = new AuditReportingSystem();

    // Mock route analysis data
    mockRouteAnalysis = {
      isValid: false,
      conflicts: [
        {
          path: "/api/appointments/[id]",
          conflictingParams: ["id", "appointmentId"],
          affectedFiles: ["app/api/appointments/[id]/route.ts"],
          severity: "critical",
          description: "Parameter naming conflict in appointment routes",
        },
      ],
      routes: [
        {
          path: "/api/appointments/[id]",
          parameters: ["id"],
          files: ["app/api/appointments/[id]/route.ts"],
          routeType: "api",
        },
      ],
      summary: {
        totalRoutes: 1,
        totalConflicts: 1,
        criticalConflicts: 1,
        warningConflicts: 0,
      },
    };

    // Mock redundancy analysis data
    mockRedundancyAnalysis = {
      duplicateComponents: [
        {
          name: "Button",
          files: ["components/ui/button.tsx", "components/shared/button.tsx"],
          similarity: 0.95,
          codeSnippet: "export function Button({ children, ...props }) {",
          recommendations: ["Consolidate duplicate Button components"],
        },
      ],
      duplicateUtilities: [
        {
          functionName: "formatDate",
          files: ["lib/utils.ts", "lib/helpers.ts"],
          similarity: 0.9,
          codeSnippet: "function formatDate(date: Date) {",
          recommendations: ["Move formatDate to shared utility"],
        },
      ],
      unusedImports: [
        {
          file: "components/test.tsx",
          importName: "unused",
          importPath: "./unused-module",
          line: 1,
        },
      ],
      summary: {
        totalDuplicates: 2,
        totalUnusedImports: 1,
        potentialSavings: "Approximately 2 duplicate files could be removed",
      },
      recommendations: ["Consolidate duplicate code", "Remove unused imports"],
    };

    // Mock integration validation data
    mockIntegrationValidation = {
      stripe: {
        success: false,
        message: "Stripe connection failed",
        error: "Invalid API key",
        timestamp: new Date(),
      },
      supabase: {
        success: true,
        message: "Supabase connection successful",
        timestamp: new Date(),
      },
      websocket: {
        success: true,
        message: "WebSocket connection working",
        timestamp: new Date(),
      },
      webrtc: {
        success: false,
        message: "WebRTC setup failed",
        error: "Media devices not accessible",
        timestamp: new Date(),
      },
      overall: {
        success: false,
        passedTests: 2,
        totalTests: 4,
        criticalFailures: [
          "Stripe payment integration",
          "WebRTC video call functionality",
        ],
      },
    };

    // Mock break point analysis data
    mockBreakPointAnalysis = {
      timestamp: new Date(),
      summary: {
        totalIssues: 3,
        criticalIssues: 1,
        highIssues: 1,
        mediumIssues: 1,
        lowIssues: 0,
      },
      errorHandling: [
        {
          file: "app/api/test/route.ts",
          line: 10,
          type: "missing_try_catch",
          severity: "high",
          description: "API route missing try-catch block",
          suggestion: "Add try-catch for error handling",
        },
      ],
      database: [
        {
          file: "lib/db.ts",
          line: 5,
          type: "connection_leak",
          severity: "medium",
          description: "Potential database connection leak",
          suggestion: "Use connection pooling",
        },
      ],
      authentication: [
        {
          file: "app/api/admin/route.ts",
          line: 1,
          type: "missing_auth_check",
          severity: "critical",
          description: "Admin route missing authentication",
          suggestion: "Add authentication middleware",
        },
      ],
      realtime: [],
      recommendations: ["Add error handling", "Fix authentication issues"],
    };
  });

  describe("Issue Compilation", () => {
    it("should compile issues from all analysis tools", () => {
      const issues = (auditSystem as any).compileIssues(
        mockRouteAnalysis,
        mockRedundancyAnalysis,
        mockIntegrationValidation,
        mockBreakPointAnalysis
      );

      expect(issues).toHaveLength(8); // 1 route + 3 redundancy + 2 integration + 2 break point

      // Check route issue
      const routeIssue = issues.find((i) => i.category === "routing");
      expect(routeIssue).toBeDefined();
      expect(routeIssue?.severity).toBe("critical");
      expect(routeIssue?.title).toContain("Route Parameter Conflict");

      // Check integration issues
      const integrationIssues = issues.filter(
        (i) => i.category === "integration"
      );
      expect(integrationIssues).toHaveLength(2); // Stripe and WebRTC failures

      // Check error handling issues
      const errorHandlingIssues = issues.filter(
        (i) => i.category === "error-handling"
      );
      expect(errorHandlingIssues).toHaveLength(1);
    });

    it("should categorize issues by severity correctly", () => {
      const issues = (auditSystem as any).compileIssues(
        mockRouteAnalysis,
        mockRedundancyAnalysis,
        mockIntegrationValidation,
        mockBreakPointAnalysis
      );

      const categorized = auditSystem.categorizeIssuesBySeverity(issues);

      expect(categorized.critical.length).toBeGreaterThan(0);
      expect(categorized.high.length).toBeGreaterThan(0);
      expect(categorized.medium.length).toBeGreaterThan(0);
    });
  });

  describe("Refactoring Opportunities", () => {
    it("should generate refactoring opportunities with correct priorities", () => {
      const opportunities = (
        auditSystem as any
      ).generateRefactoringOpportunities(
        mockRedundancyAnalysis,
        mockRouteAnalysis
      );

      expect(opportunities).toHaveLength(2); // Component consolidation + utility extraction

      const componentOpportunity = opportunities.find(
        (o) => o.type === "component-consolidation"
      );
      expect(componentOpportunity).toBeDefined();
      expect(componentOpportunity?.title).toContain("Button");
      expect(componentOpportunity?.potentialBenefits).toContain(
        "Reduce codebase by ~50 lines"
      );

      const utilityOpportunity = opportunities.find(
        (o) => o.type === "utility-extraction"
      );
      expect(utilityOpportunity).toBeDefined();
      expect(utilityOpportunity?.title).toContain("formatDate");
    });

    it("should prioritize opportunities correctly", () => {
      const opportunities = (
        auditSystem as any
      ).generateRefactoringOpportunities(
        mockRedundancyAnalysis,
        mockRouteAnalysis
      );

      // Should be sorted by priority (highest first)
      for (let i = 0; i < opportunities.length - 1; i++) {
        expect(opportunities[i].priority).toBeGreaterThanOrEqual(
          opportunities[i + 1].priority
        );
      }
    });
  });

  describe("Health Score Calculation", () => {
    it("should calculate health score correctly", () => {
      const issuesBySeverity = {
        critical: 2,
        high: 3,
        medium: 5,
        low: 10,
      };

      const healthScore = (auditSystem as any).calculateHealthScore(
        issuesBySeverity
      );

      // Base score 100 - (2*20 + 3*10 + 5*5 + 10*1) = 100 - (40 + 30 + 25 + 10) = -5 -> 0
      expect(healthScore).toBe(0);
    });

    it("should not go below 0 for health score", () => {
      const issuesBySeverity = {
        critical: 10,
        high: 10,
        medium: 10,
        low: 10,
      };

      const healthScore = (auditSystem as any).calculateHealthScore(
        issuesBySeverity
      );
      expect(healthScore).toBe(0);
    });

    it("should return 100 for no issues", () => {
      const issuesBySeverity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      const healthScore = (auditSystem as any).calculateHealthScore(
        issuesBySeverity
      );
      expect(healthScore).toBe(100);
    });
  });

  describe("Action Plan Creation", () => {
    it("should create action plan with correct prioritization", () => {
      const mockIssues: AuditIssue[] = [
        {
          id: "critical-1",
          category: "security",
          severity: "critical",
          title: "Critical Security Issue",
          description: "Test critical issue",
          affectedFiles: ["test.ts"],
          recommendedAction: "Fix immediately",
          estimatedEffort: "high",
          impact: "High impact",
          source: "Test",
        },
        {
          id: "high-1",
          category: "performance",
          severity: "high",
          title: "High Priority Issue",
          description: "Test high issue",
          affectedFiles: ["test.ts"],
          recommendedAction: "Fix soon",
          estimatedEffort: "medium",
          impact: "Medium impact",
          source: "Test",
        },
      ];

      const mockOpportunities: RefactoringOpportunity[] = [
        {
          id: "refactor-1",
          type: "component-consolidation",
          title: "Test Refactoring",
          description: "Test opportunity",
          files: ["test.tsx"],
          potentialBenefits: ["Test benefit"],
          implementationSteps: ["Step 1", "Step 2"],
          estimatedEffort: "medium",
          impactLevel: "high",
          priority: 8,
        },
      ];

      const actionPlan = (auditSystem as any).createActionPlan(
        mockIssues,
        mockOpportunities
      );

      expect(actionPlan.immediate).toHaveLength(1);
      expect(actionPlan.shortTerm).toHaveLength(2); // 1 high issue + 1 high priority refactoring
      expect(actionPlan.longTerm).toHaveLength(0);
      expect(actionPlan.maintenance).toHaveLength(1); // Monitoring task

      // Check that critical issues are in immediate actions
      expect(actionPlan.immediate[0].priority).toBe("critical");
    });
  });

  describe("Report Generation", () => {
    it("should generate actionable recommendations", () => {
      const mockIssues: AuditIssue[] = [
        {
          id: "security-1",
          category: "security",
          severity: "critical",
          title: "Security Issue",
          description: "Test security issue",
          affectedFiles: ["test.ts"],
          recommendedAction: "Fix security",
          estimatedEffort: "high",
          impact: "High impact",
          source: "Test",
        },
        {
          id: "security-2",
          category: "security",
          severity: "high",
          title: "Another Security Issue",
          description: "Test security issue 2",
          affectedFiles: ["test2.ts"],
          recommendedAction: "Fix security 2",
          estimatedEffort: "medium",
          impact: "Medium impact",
          source: "Test",
        },
      ];

      const recommendations =
        auditSystem.generateActionableRecommendations(mockIssues);

      expect(recommendations).toHaveLength(1); // One recommendation for security category
      expect(recommendations[0].category).toBe("security");
      expect(recommendations[0].priority).toBe("critical");
      expect(recommendations[0].relatedIssues).toHaveLength(2);
    });

    it("should identify refactoring opportunities with correct impact estimates", () => {
      const opportunities = auditSystem.identifyRefactoringOpportunities(
        mockRedundancyAnalysis,
        mockRouteAnalysis
      );

      expect(opportunities.length).toBeGreaterThan(0);

      const componentOpportunity = opportunities.find(
        (o) => o.type === "component-consolidation"
      );
      expect(componentOpportunity).toBeDefined();
      expect(componentOpportunity?.impactLevel).toBeDefined();
      expect(componentOpportunity?.estimatedEffort).toBeDefined();
      expect(componentOpportunity?.priority).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing data gracefully", () => {
      const emptyRouteAnalysis: RouteValidationResult = {
        isValid: true,
        conflicts: [],
        routes: [],
        summary: {
          totalRoutes: 0,
          totalConflicts: 0,
          criticalConflicts: 0,
          warningConflicts: 0,
        },
      };

      const emptyRedundancyAnalysis: RedundancyReport = {
        duplicateComponents: [],
        duplicateUtilities: [],
        unusedImports: [],
        summary: {
          totalDuplicates: 0,
          totalUnusedImports: 0,
          potentialSavings: "No savings",
        },
        recommendations: [],
      };

      expect(() => {
        (auditSystem as any).compileIssues(
          emptyRouteAnalysis,
          emptyRedundancyAnalysis,
          mockIntegrationValidation,
          mockBreakPointAnalysis
        );
      }).not.toThrow();
    });
  });
});
