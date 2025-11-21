import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodeRedundancyAnalyzer } from "../lib/code-redundancy-analyzer";
import { RedundancyReportGenerator } from "../lib/redundancy-report-generator";

describe("CodeRedundancyAnalyzer", () => {
  let analyzer: CodeRedundancyAnalyzer;
  let testDir: string;

  beforeEach(() => {
    analyzer = new CodeRedundancyAnalyzer();
    testDir = path.join(__dirname, "test-files");

    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Component Duplicate Detection", () => {
    it("should detect duplicate components", async () => {
      // Create test component files
      const component1 = `
import React from 'react';

export default function TestComponent() {
  return <div>Hello World</div>;
}`;

      const component2 = `
import React from 'react';

export default function TestComponent() {
  return <div>Hello World</div>;
}`;

      fs.writeFileSync(path.join(testDir, "Component1.tsx"), component1);
      fs.writeFileSync(path.join(testDir, "Component2.tsx"), component2);

      const report = await analyzer.analyzeRedundancy();

      // Should detect the duplicate components
      expect(report.duplicateComponents.length).toBeGreaterThan(0);
    });

    it("should not flag components with different functionality", async () => {
      const component1 = `
import React from 'react';

export default function Component1() {
  return <div>Component 1</div>;
}`;

      const component2 = `
import React from 'react';

export default function Component2() {
  return <button>Click me</button>;
}`;

      fs.writeFileSync(path.join(testDir, "Component1.tsx"), component1);
      fs.writeFileSync(path.join(testDir, "Component2.tsx"), component2);

      const report = await analyzer.analyzeRedundancy();

      // Should not detect duplicates for different components
      const duplicatesForThisTest = report.duplicateComponents.filter((dup) =>
        dup.files.some((file) => file.includes("test-files"))
      );
      expect(duplicatesForThisTest.length).toBe(0);
    });
  });

  describe("Utility Function Duplicate Detection", () => {
    it("should detect duplicate utility functions", async () => {
      const util1 = `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  return today.getFullYear() - birthDate.getFullYear();
}`;

      const util2 = `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getUserAge(birthDate: Date): number {
  const now = new Date();
  return now.getFullYear() - birthDate.getFullYear();
}`;

      fs.writeFileSync(path.join(testDir, "utils1.ts"), util1);
      fs.writeFileSync(path.join(testDir, "utils2.ts"), util2);

      const report = await analyzer.analyzeRedundancy();

      // Should detect duplicate formatDate function
      expect(report.duplicateUtilities.length).toBeGreaterThan(0);
      const formatDateDuplicate = report.duplicateUtilities.find(
        (dup) => dup.functionName === "formatDate"
      );
      expect(formatDateDuplicate).toBeDefined();
    });
  });

  describe("Unused Import Detection", () => {
    it("should detect unused imports", async () => {
      const fileWithUnusedImports = `
import React from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import lodash from 'lodash';

export default function TestComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}`;

      fs.writeFileSync(
        path.join(testDir, "ComponentWithUnusedImports.tsx"),
        fileWithUnusedImports
      );

      const report = await analyzer.analyzeRedundancy();

      // Should detect unused imports (useEffect, format, lodash)
      const unusedImportsForFile = report.unusedImports.filter((imp) =>
        imp.file.includes("ComponentWithUnusedImports.tsx")
      );
      expect(unusedImportsForFile.length).toBeGreaterThan(0);
    });

    it("should not flag used imports", async () => {
      const fileWithUsedImports = `
import React, { useState } from 'react';
import { format } from 'date-fns';

export default function TestComponent() {
  const [date] = useState(new Date());
  
  return (
    <div>
      {format(date, 'yyyy-MM-dd')}
    </div>
  );
}`;

      fs.writeFileSync(
        path.join(testDir, "ComponentWithUsedImports.tsx"),
        fileWithUsedImports
      );

      const report = await analyzer.analyzeRedundancy();

      // Should not detect any unused imports for this file
      const unusedImportsForFile = report.unusedImports.filter((imp) =>
        imp.file.includes("ComponentWithUsedImports.tsx")
      );
      expect(unusedImportsForFile.length).toBe(0);
    });
  });

  describe("Report Generation", () => {
    it("should generate a complete redundancy report", async () => {
      const report = await analyzer.analyzeRedundancy();

      expect(report).toHaveProperty("duplicateComponents");
      expect(report).toHaveProperty("duplicateUtilities");
      expect(report).toHaveProperty("unusedImports");
      expect(report).toHaveProperty("summary");
      expect(report).toHaveProperty("recommendations");

      expect(report.summary).toHaveProperty("totalDuplicates");
      expect(report.summary).toHaveProperty("totalUnusedImports");
      expect(report.summary).toHaveProperty("potentialSavings");

      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });
});

describe("RedundancyReportGenerator", () => {
  let generator: RedundancyReportGenerator;
  let mockReport: any;

  beforeEach(() => {
    generator = new RedundancyReportGenerator();
    mockReport = {
      duplicateComponents: [
        {
          name: "TestComponent",
          files: ["file1.tsx", "file2.tsx"],
          similarity: 0.95,
          codeSnippet: "export default function TestComponent() {...}",
          recommendations: ["Consolidate into single component"],
        },
      ],
      duplicateUtilities: [
        {
          functionName: "formatDate",
          files: ["utils1.ts", "utils2.ts"],
          similarity: 0.9,
          codeSnippet: "function formatDate(date) {...}",
          recommendations: ["Move to shared utils"],
        },
      ],
      unusedImports: [
        {
          file: "component.tsx",
          importName: "lodash",
          importPath: "lodash",
          line: 3,
        },
      ],
      summary: {
        totalDuplicates: 2,
        totalUnusedImports: 1,
        potentialSavings: "Approximately 2 duplicate files could be removed",
      },
      recommendations: [
        "Consolidate duplicate components",
        "Remove unused imports",
      ],
    };
  });

  describe("Markdown Report Generation", () => {
    it("should generate markdown report", async () => {
      const options = {
        outputFormat: "markdown" as const,
        includeCodeSnippets: true,
        groupByType: true,
      };

      const report = await generator.generateReport(mockReport, options);

      expect(report).toContain("# Code Redundancy Analysis Report");
      expect(report).toContain("## Executive Summary");
      expect(report).toContain("## Duplicate Components");
      expect(report).toContain("## Duplicate Utility Functions");
      expect(report).toContain("## Unused Imports");
      expect(report).toContain("TestComponent");
      expect(report).toContain("formatDate");
    });
  });

  describe("JSON Report Generation", () => {
    it("should generate JSON report", async () => {
      const options = {
        outputFormat: "json" as const,
        includeCodeSnippets: true,
        groupByType: true,
      };

      const report = await generator.generateReport(mockReport, options);
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty("metadata");
      expect(parsed).toHaveProperty("duplicateComponents");
      expect(parsed).toHaveProperty("duplicateUtilities");
      expect(parsed).toHaveProperty("unusedImports");
      expect(parsed.metadata).toHaveProperty("generatedAt");
    });
  });

  describe("Console Summary Generation", () => {
    it("should generate console summary", () => {
      const summary = generator.generateConsoleSummary(mockReport);

      expect(summary).toContain("Code Redundancy Analysis Complete");
      expect(summary).toContain("Total Duplicates: 2");
      expect(summary).toContain("Unused Imports: 1");
      expect(summary).toContain("Top Recommendations:");
    });
  });
});
