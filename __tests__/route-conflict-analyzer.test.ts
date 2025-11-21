import { readdir, stat } from "fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DynamicRoute,
  RouteConflict,
  RouteConflictAnalyzer,
} from "../lib/route-conflict-analyzer";

// Mock fs/promises
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readdir: vi.fn(),
    stat: vi.fn(),
  };
});

const mockReaddir = vi.mocked(readdir);
const mockStat = vi.mocked(stat);

describe("RouteConflictAnalyzer", () => {
  let analyzer: RouteConflictAnalyzer;

  beforeEach(() => {
    analyzer = new RouteConflictAnalyzer("./test-app");
    vi.clearAllMocks();
  });

  describe("scanDynamicRoutes", () => {
    it("should identify dynamic routes correctly", async () => {
      // Mock directory structure
      mockReaddir
        .mockResolvedValueOnce(["api", "chat", "doctor"] as any)
        .mockResolvedValueOnce(["appointments", "doctors"] as any) // api/
        .mockResolvedValueOnce(["[id]"] as any) // api/appointments/
        .mockResolvedValueOnce(["route.ts"] as any) // api/appointments/[id]/
        .mockResolvedValueOnce(["[id]"] as any) // api/doctors/
        .mockResolvedValueOnce(["route.ts"] as any) // api/doctors/[id]/
        .mockResolvedValueOnce(["[appointmentId]"] as any) // chat/
        .mockResolvedValueOnce(["page.tsx"] as any) // chat/[appointmentId]/
        .mockResolvedValueOnce(["[id]"] as any) // doctor/
        .mockResolvedValueOnce(["page.tsx"] as any); // doctor/[id]/

      // Mock stat calls
      mockStat.mockImplementation(
        async (path: any) =>
          ({
            isDirectory: () => !path.toString().includes("."),
            isFile: () => path.toString().includes("."),
          } as any)
      );

      const routes = await analyzer.scanDynamicRoutes();

      expect(routes).toHaveLength(4);
      expect(
        routes.find((r) => r.path === "api/appointments/[id]")
      ).toBeDefined();
      expect(routes.find((r) => r.path === "api/doctors/[id]")).toBeDefined();
      expect(
        routes.find((r) => r.path === "chat/[appointmentId]")
      ).toBeDefined();
      expect(routes.find((r) => r.path === "doctor/[id]")).toBeDefined();
    });

    it("should correctly identify route types", async () => {
      mockReaddir
        .mockResolvedValueOnce(["api"] as any)
        .mockResolvedValueOnce(["[id]"] as any)
        .mockResolvedValueOnce(["route.ts"] as any);

      mockStat.mockImplementation(
        async (path: any) =>
          ({
            isDirectory: () => !path.toString().includes("."),
            isFile: () => path.toString().includes("."),
          } as any)
      );

      const routes = await analyzer.scanDynamicRoutes();
      expect(routes[0].routeType).toBe("api");
    });
  });

  describe("detectConflicts", () => {
    it("should detect parameter naming conflicts", () => {
      // Set up test routes with conflicts
      const testRoutes: DynamicRoute[] = [
        {
          path: "api/appointments/[id]",
          parameters: ["id"],
          files: ["api/appointments/[id]/route.ts"],
          routeType: "api",
        },
        {
          path: "chat/[appointmentId]",
          parameters: ["appointmentId"],
          files: ["chat/[appointmentId]/page.tsx"],
          routeType: "page",
        },
      ];

      // Mock the routes
      (analyzer as any).routes = testRoutes;

      const conflicts = analyzer.detectConflicts();

      // Should detect semantic conflict for appointment-related routes
      expect(conflicts.length).toBeGreaterThan(0);
      const appointmentConflict = conflicts.find((c) =>
        c.description.includes("Appointment-related routes")
      );
      expect(appointmentConflict).toBeDefined();
    });

    it("should identify critical conflicts correctly", () => {
      const testRoutes: DynamicRoute[] = [
        {
          path: "api/test/[id]",
          parameters: ["id"],
          files: ["api/test/[id]/route.ts"],
          routeType: "api",
        },
        {
          path: "api/test/[testId]",
          parameters: ["testId"],
          files: ["api/test/[testId]/route.ts"],
          routeType: "api",
        },
      ];

      (analyzer as any).routes = testRoutes;
      const conflicts = analyzer.detectConflicts();

      // Should be critical since API routes are involved
      const criticalConflict = conflicts.find((c) => c.severity === "critical");
      expect(criticalConflict).toBeDefined();
    });
  });

  describe("validateRouteConsistency", () => {
    it("should return validation results with summary", async () => {
      mockReaddir.mockResolvedValueOnce([]);
      mockStat.mockImplementation(
        async () => ({ isDirectory: () => false, isFile: () => false } as any)
      );

      const result = await analyzer.validateRouteConsistency();

      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("conflicts");
      expect(result).toHaveProperty("routes");
      expect(result).toHaveProperty("summary");
      expect(result.summary).toHaveProperty("totalRoutes");
      expect(result.summary).toHaveProperty("totalConflicts");
    });
  });

  describe("generateResolutionPlan", () => {
    it("should generate appropriate recommendations for conflicts", () => {
      const testConflicts: RouteConflict[] = [
        {
          path: "api/appointments/[id]",
          conflictingParams: ["id", "appointmentId"],
          affectedFiles: ["api/appointments/[id]/route.ts"],
          severity: "critical",
          description: "Test conflict",
        },
      ];

      const plan = analyzer.generateResolutionPlan(testConflicts);

      expect(plan.recommendations).toHaveLength(1);
      expect(plan.recommendations[0]).toHaveProperty("action");
      expect(plan.recommendations[0]).toHaveProperty("description");
      expect(plan.recommendations[0]).toHaveProperty("steps");
      expect(plan.recommendations[0]).toHaveProperty("estimatedEffort");
    });

    it("should provide appointment-specific recommendations", () => {
      const appointmentConflict: RouteConflict[] = [
        {
          path: "chat/[appointmentId]",
          conflictingParams: ["appointmentId", "id"],
          affectedFiles: ["chat/[appointmentId]/page.tsx"],
          severity: "warning",
          description: "Appointment conflict",
        },
      ];

      const plan = analyzer.generateResolutionPlan(appointmentConflict);
      const recommendation = plan.recommendations[0];

      expect(recommendation.description).toContain("appointmentId");
      expect(recommendation.action).toBe("rename");
    });
  });

  describe("generateDetailedReport", () => {
    it("should generate a comprehensive markdown report", async () => {
      mockReaddir.mockResolvedValueOnce([]);
      mockStat.mockImplementation(
        async () => ({ isDirectory: () => false, isFile: () => false } as any)
      );

      const report = await analyzer.generateDetailedReport();

      expect(report).toContain("# Route Conflict Analysis Report");
      expect(report).toContain("## Summary");
      expect(report).toContain("## All Dynamic Routes");
      expect(report).toContain("Total Dynamic Routes");
    });
  });
});

describe("Utility Functions", () => {
  it("should export utility functions", () => {
    const {
      scanAllDynamicRoutes,
      validateRoutes,
      generateRouteReport,
    } = require("../lib/route-conflict-analyzer");

    expect(typeof scanAllDynamicRoutes).toBe("function");
    expect(typeof validateRoutes).toBe("function");
    expect(typeof generateRouteReport).toBe("function");
  });
});
