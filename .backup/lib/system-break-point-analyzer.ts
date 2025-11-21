import { promises as fs } from "fs";
import { glob } from "glob";
import path from "path";

// Interfaces for analysis results
export interface ErrorHandlingIssue {
  file: string;
  line: number;
  type:
    | "missing_try_catch"
    | "missing_error_boundary"
    | "unhandled_promise"
    | "missing_validation";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface DatabaseIssue {
  file: string;
  line: number;
  type:
    | "connection_leak"
    | "missing_timeout"
    | "transaction_issue"
    | "missing_cleanup";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface AuthSecurityIssue {
  file: string;
  line: number;
  type:
    | "missing_auth_check"
    | "weak_validation"
    | "session_vulnerability"
    | "role_bypass";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface RealtimeIssue {
  file: string;
  line: number;
  type:
    | "connection_failure"
    | "race_condition"
    | "memory_leak"
    | "missing_cleanup";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface SystemBreakPointReport {
  timestamp: Date;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  errorHandling: ErrorHandlingIssue[];
  database: DatabaseIssue[];
  authentication: AuthSecurityIssue[];
  realtime: RealtimeIssue[];
  recommendations: string[];
}

/**
 * System Break Point Analyzer
 * Scans the codebase for potential failure points and vulnerabilities
 */
export class SystemBreakPointAnalyzer {
  private workspaceRoot: string;
  private excludePatterns: string[] = [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/coverage/**",
  ];

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Run comprehensive system break point analysis
   */
  async analyze(): Promise<SystemBreakPointReport> {
    console.log("🔍 Starting system break point analysis...");

    const [errorHandling, database, authentication, realtime] =
      await Promise.all([
        this.analyzeErrorHandling(),
        this.analyzeDatabasePatterns(),
        this.analyzeAuthenticationFlows(),
        this.analyzeRealtimeFeatures(),
      ]);

    const allIssues = [
      ...errorHandling,
      ...database,
      ...authentication,
      ...realtime,
    ];

    const summary = {
      totalIssues: allIssues.length,
      criticalIssues: allIssues.filter((i) => i.severity === "critical").length,
      highIssues: allIssues.filter((i) => i.severity === "high").length,
      mediumIssues: allIssues.filter((i) => i.severity === "medium").length,
      lowIssues: allIssues.filter((i) => i.severity === "low").length,
    };

    const recommendations = this.generateRecommendations(
      errorHandling,
      database,
      authentication,
      realtime
    );

    return {
      timestamp: new Date(),
      summary,
      errorHandling,
      database,
      authentication,
      realtime,
      recommendations,
    };
  }

  /**
   * Analyze API routes for missing error handling and try-catch blocks
   */
  private async analyzeErrorHandling(): Promise<ErrorHandlingIssue[]> {
    console.log("📋 Analyzing error handling patterns...");
    const issues: ErrorHandlingIssue[] = [];

    // Get all API route files
    const apiFiles = await glob("app/api/**/route.ts", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    // Get all component files
    const componentFiles = await glob("components/**/*.{ts,tsx}", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    // Get all lib files
    const libFiles = await glob("lib/**/*.{ts,tsx}", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    const allFiles = [...apiFiles, ...componentFiles, ...libFiles];

    for (const file of allFiles) {
      const filePath = path.join(this.workspaceRoot, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");

        // Check for missing try-catch in API routes
        if (file.includes("app/api") && file.endsWith("route.ts")) {
          issues.push(...this.checkApiErrorHandling(file, content, lines));
        }

        // Check for missing error boundaries in components
        if (file.includes("components") && file.endsWith(".tsx")) {
          issues.push(
            ...this.checkComponentErrorHandling(file, content, lines)
          );
        }

        // Check for unhandled promises
        issues.push(...this.checkUnhandledPromises(file, content, lines));

        // Check for missing validation
        issues.push(...this.checkMissingValidation(file, content, lines));
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
      }
    }

    return issues;
  }

  /**
   * Check API routes for proper error handling
   */
  private checkApiErrorHandling(
    file: string,
    content: string,
    lines: string[]
  ): ErrorHandlingIssue[] {
    const issues: ErrorHandlingIssue[] = [];

    // Check if API route has try-catch blocks
    const hasTryCatch = /try\s*{[\s\S]*?}\s*catch/.test(content);
    const hasAsyncFunction =
      /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/.test(content);

    if (hasAsyncFunction && !hasTryCatch) {
      issues.push({
        file,
        line: 1,
        type: "missing_try_catch",
        severity: "high",
        description: "API route missing try-catch block for error handling",
        suggestion:
          "Wrap async operations in try-catch blocks to handle errors gracefully",
      });
    }

    // Check for database operations without error handling
    lines.forEach((line, index) => {
      if (line.includes("prisma.") && !this.isInTryCatch(lines, index)) {
        issues.push({
          file,
          line: index + 1,
          type: "missing_try_catch",
          severity: "high",
          description: "Database operation not wrapped in try-catch",
          suggestion:
            "Wrap database operations in try-catch to handle connection errors",
          codeSnippet: line.trim(),
        });
      }

      // Check for external API calls without error handling
      if (
        (line.includes("fetch(") || line.includes("axios.")) &&
        !this.isInTryCatch(lines, index)
      ) {
        issues.push({
          file,
          line: index + 1,
          type: "missing_try_catch",
          severity: "medium",
          description: "External API call not wrapped in try-catch",
          suggestion:
            "Wrap external API calls in try-catch to handle network errors",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Check components for error boundaries and error handling
   */
  private checkComponentErrorHandling(
    file: string,
    content: string,
    lines: string[]
  ): ErrorHandlingIssue[] {
    const issues: ErrorHandlingIssue[] = [];

    // Check if component has error boundary
    const hasErrorBoundary =
      content.includes("ErrorBoundary") ||
      content.includes("componentDidCatch");
    const isComplexComponent =
      content.includes("useEffect") || content.includes("useState");

    if (
      isComplexComponent &&
      !hasErrorBoundary &&
      !file.includes("error-boundary")
    ) {
      issues.push({
        file,
        line: 1,
        type: "missing_error_boundary",
        severity: "medium",
        description: "Complex component missing error boundary protection",
        suggestion:
          "Wrap complex components with ErrorBoundary to catch rendering errors",
      });
    }

    return issues;
  }

  /**
   * Check for unhandled promises
   */
  private checkUnhandledPromises(
    file: string,
    content: string,
    lines: string[]
  ): ErrorHandlingIssue[] {
    const issues: ErrorHandlingIssue[] = [];

    lines.forEach((line, index) => {
      // Check for promises without .catch()
      if (
        line.includes(".then(") &&
        !line.includes(".catch(") &&
        !this.isInTryCatch(lines, index)
      ) {
        issues.push({
          file,
          line: index + 1,
          type: "unhandled_promise",
          severity: "medium",
          description: "Promise without error handling",
          suggestion: "Add .catch() handler or wrap in try-catch block",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Check for missing input validation
   */
  private checkMissingValidation(
    file: string,
    content: string,
    lines: string[]
  ): ErrorHandlingIssue[] {
    const issues: ErrorHandlingIssue[] = [];

    if (file.includes("app/api")) {
      const hasZodValidation =
        content.includes("z.") || content.includes("zod");
      const hasRequestBody =
        content.includes("request.json()") ||
        content.includes("request.formData()");

      if (hasRequestBody && !hasZodValidation) {
        issues.push({
          file,
          line: 1,
          type: "missing_validation",
          severity: "high",
          description: "API route missing input validation",
          suggestion:
            "Add Zod schema validation for request body and parameters",
        });
      }
    }

    return issues;
  }

  /**
   * Analyze database connection patterns for potential leaks or timeout issues
   */
  private async analyzeDatabasePatterns(): Promise<DatabaseIssue[]> {
    console.log("🗄️ Analyzing database connection patterns...");
    const issues: DatabaseIssue[] = [];

    // Get all files that use database connections
    const dbFiles = await glob("**/*.{ts,tsx}", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    for (const file of dbFiles) {
      const filePath = path.join(this.workspaceRoot, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");

        // Check Prisma usage patterns
        issues.push(...this.checkPrismaPatterns(file, content, lines));

        // Check Supabase connection patterns
        issues.push(...this.checkSupabasePatterns(file, content, lines));

        // Check for transaction issues
        issues.push(...this.checkTransactionPatterns(file, content, lines));
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
      }
    }

    return issues;
  }

  /**
   * Check Prisma usage patterns
   */
  private checkPrismaPatterns(
    file: string,
    content: string,
    lines: string[]
  ): DatabaseIssue[] {
    const issues: DatabaseIssue[] = [];

    // Check for missing connection cleanup
    if (
      content.includes("new PrismaClient()") &&
      !content.includes("$disconnect")
    ) {
      issues.push({
        file,
        line: 1,
        type: "connection_leak",
        severity: "high",
        description: "PrismaClient instantiated without proper cleanup",
        suggestion: "Use singleton pattern or ensure $disconnect() is called",
      });
    }

    // Check for missing timeouts in queries
    lines.forEach((line, index) => {
      if (
        line.includes("prisma.") &&
        line.includes("findMany") &&
        !line.includes("timeout")
      ) {
        issues.push({
          file,
          line: index + 1,
          type: "missing_timeout",
          severity: "medium",
          description: "Database query without timeout configuration",
          suggestion: "Add timeout configuration to prevent hanging queries",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Check Supabase connection patterns
   */
  private checkSupabasePatterns(
    file: string,
    content: string,
    lines: string[]
  ): DatabaseIssue[] {
    const issues: DatabaseIssue[] = [];

    // Check for deprecated Supabase patterns
    if (
      content.includes("createServerClient") &&
      content.includes("CookieMethodsServerDeprecated")
    ) {
      issues.push({
        file,
        line: 1,
        type: "connection_leak",
        severity: "medium",
        description: "Using deprecated Supabase server client pattern",
        suggestion:
          "Update to latest Supabase SSR patterns to avoid connection issues",
      });
    }

    return issues;
  }

  /**
   * Check transaction patterns
   */
  private checkTransactionPatterns(
    file: string,
    content: string,
    lines: string[]
  ): DatabaseIssue[] {
    const issues: DatabaseIssue[] = [];

    lines.forEach((line, index) => {
      // Check for transactions without proper error handling
      if (line.includes("$transaction") && !this.isInTryCatch(lines, index)) {
        issues.push({
          file,
          line: index + 1,
          type: "transaction_issue",
          severity: "high",
          description: "Database transaction without proper error handling",
          suggestion:
            "Wrap transactions in try-catch to handle rollback scenarios",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Analyze authentication flows for security vulnerabilities and edge cases
   */
  private async analyzeAuthenticationFlows(): Promise<AuthSecurityIssue[]> {
    console.log("🔐 Analyzing authentication security patterns...");
    const issues: AuthSecurityIssue[] = [];

    // Get auth-related files
    const authFiles = await glob("**/*.{ts,tsx}", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    for (const file of authFiles) {
      if (
        file.includes("auth") ||
        file.includes("middleware") ||
        file.includes("app/api")
      ) {
        const filePath = path.join(this.workspaceRoot, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");

          // Check authentication patterns
          issues.push(...this.checkAuthPatterns(file, content, lines));

          // Check session handling
          issues.push(...this.checkSessionHandling(file, content, lines));

          // Check role-based access
          issues.push(...this.checkRoleBasedAccess(file, content, lines));
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }

    return issues;
  }

  /**
   * Check authentication patterns
   */
  private checkAuthPatterns(
    file: string,
    content: string,
    lines: string[]
  ): AuthSecurityIssue[] {
    const issues: AuthSecurityIssue[] = [];

    // Check for missing authentication in API routes
    if (
      file.includes("app/api") &&
      !file.includes("auth") &&
      !file.includes("health")
    ) {
      const hasAuthCheck =
        content.includes("getServerSession") ||
        content.includes("requireAuth") ||
        content.includes("auth.getUser");

      if (!hasAuthCheck) {
        issues.push({
          file,
          line: 1,
          type: "missing_auth_check",
          severity: "critical",
          description: "API route missing authentication check",
          suggestion: "Add authentication middleware or session validation",
        });
      }
    }

    // Check for weak password validation
    if (content.includes("password") && content.includes("bcrypt")) {
      const hasStrongValidation =
        content.includes("length") && content.includes("6");
      if (!hasStrongValidation) {
        issues.push({
          file,
          line: 1,
          type: "weak_validation",
          severity: "medium",
          description: "Weak password validation detected",
          suggestion:
            "Implement stronger password requirements (length, complexity)",
        });
      }
    }

    return issues;
  }

  /**
   * Check session handling
   */
  private checkSessionHandling(
    file: string,
    content: string,
    lines: string[]
  ): AuthSecurityIssue[] {
    const issues: AuthSecurityIssue[] = [];

    lines.forEach((line, index) => {
      // Check for session usage without null checks
      if (line.includes("session.user") && !line.includes("session?.user")) {
        issues.push({
          file,
          line: index + 1,
          type: "session_vulnerability",
          severity: "medium",
          description: "Session access without null check",
          suggestion:
            "Use optional chaining (session?.user) to prevent runtime errors",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Check role-based access control
   */
  private checkRoleBasedAccess(
    file: string,
    content: string,
    lines: string[]
  ): AuthSecurityIssue[] {
    const issues: AuthSecurityIssue[] = [];

    // Check for admin routes without proper role validation
    if (file.includes("admin") && file.includes("app/api")) {
      const hasRoleCheck =
        content.includes("role") &&
        (content.includes("ADMIN") || content.includes("admin"));

      if (!hasRoleCheck) {
        issues.push({
          file,
          line: 1,
          type: "role_bypass",
          severity: "critical",
          description: "Admin route missing role validation",
          suggestion:
            "Add role-based access control to prevent unauthorized access",
        });
      }
    }

    return issues;
  }

  /**
   * Analyze real-time features for potential connection failures and race conditions
   */
  private async analyzeRealtimeFeatures(): Promise<RealtimeIssue[]> {
    console.log("⚡ Analyzing real-time connection patterns...");
    const issues: RealtimeIssue[] = [];

    // Get real-time related files
    const realtimeFiles = await glob("**/*.{ts,tsx}", {
      cwd: this.workspaceRoot,
      ignore: this.excludePatterns,
    });

    for (const file of realtimeFiles) {
      if (
        file.includes("socket") ||
        file.includes("realtime") ||
        file.includes("chat")
      ) {
        const filePath = path.join(this.workspaceRoot, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");

          // Check WebSocket patterns
          issues.push(...this.checkWebSocketPatterns(file, content, lines));

          // Check Supabase Realtime patterns
          issues.push(
            ...this.checkSupabaseRealtimePatterns(file, content, lines)
          );

          // Check for memory leaks
          issues.push(...this.checkRealtimeMemoryLeaks(file, content, lines));
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }

    return issues;
  }

  /**
   * Check WebSocket patterns
   */
  private checkWebSocketPatterns(
    file: string,
    content: string,
    lines: string[]
  ): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];

    // Check for missing connection error handling
    if (content.includes("socket.io") || content.includes("WebSocket")) {
      const hasErrorHandling =
        content.includes("on('error'") || content.includes("onerror");
      const hasReconnection =
        content.includes("reconnect") || content.includes("retry");

      if (!hasErrorHandling) {
        issues.push({
          file,
          line: 1,
          type: "connection_failure",
          severity: "high",
          description: "WebSocket connection missing error handling",
          suggestion: "Add error event handlers and reconnection logic",
        });
      }

      if (!hasReconnection) {
        issues.push({
          file,
          line: 1,
          type: "connection_failure",
          severity: "medium",
          description: "WebSocket connection missing reconnection logic",
          suggestion:
            "Implement automatic reconnection with exponential backoff",
        });
      }
    }

    return issues;
  }

  /**
   * Check Supabase Realtime patterns
   */
  private checkSupabaseRealtimePatterns(
    file: string,
    content: string,
    lines: string[]
  ): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];

    // Check for missing cleanup in Supabase subscriptions
    if (content.includes("subscribe(") && !content.includes("unsubscribe")) {
      issues.push({
        file,
        line: 1,
        type: "memory_leak",
        severity: "high",
        description: "Supabase subscription without cleanup",
        suggestion:
          "Add unsubscribe logic in cleanup functions or useEffect return",
      });
    }

    return issues;
  }

  /**
   * Check for memory leaks in real-time features
   */
  private checkRealtimeMemoryLeaks(
    file: string,
    content: string,
    lines: string[]
  ): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];

    lines.forEach((line, index) => {
      // Check for event listeners without cleanup
      if (
        line.includes("addEventListener") &&
        !content.includes("removeEventListener")
      ) {
        issues.push({
          file,
          line: index + 1,
          type: "memory_leak",
          severity: "medium",
          description: "Event listener without cleanup",
          suggestion: "Add removeEventListener in cleanup function",
          codeSnippet: line.trim(),
        });
      }

      // Check for intervals without cleanup
      if (line.includes("setInterval") && !content.includes("clearInterval")) {
        issues.push({
          file,
          line: index + 1,
          type: "memory_leak",
          severity: "medium",
          description: "Interval without cleanup",
          suggestion: "Add clearInterval in cleanup function",
          codeSnippet: line.trim(),
        });
      }
    });

    return issues;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(
    errorHandling: ErrorHandlingIssue[],
    database: DatabaseIssue[],
    authentication: AuthSecurityIssue[],
    realtime: RealtimeIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // Error handling recommendations
    if (errorHandling.length > 0) {
      recommendations.push(
        "Implement comprehensive error handling with try-catch blocks in all API routes",
        "Add error boundaries to complex React components",
        "Use Zod for input validation in all API endpoints",
        "Implement proper error logging and monitoring"
      );
    }

    // Database recommendations
    if (database.length > 0) {
      recommendations.push(
        "Use singleton pattern for Prisma client to prevent connection leaks",
        "Add timeout configurations to all database queries",
        "Implement proper transaction error handling with rollback logic",
        "Update deprecated Supabase patterns to latest SSR methods"
      );
    }

    // Authentication recommendations
    if (authentication.length > 0) {
      recommendations.push(
        "Add authentication middleware to all protected API routes",
        "Implement role-based access control for admin functions",
        "Use optional chaining for session access to prevent runtime errors",
        "Strengthen password validation requirements"
      );
    }

    // Real-time recommendations
    if (realtime.length > 0) {
      recommendations.push(
        "Add error handling and reconnection logic to WebSocket connections",
        "Implement proper cleanup for Supabase subscriptions",
        "Add memory leak prevention for event listeners and intervals",
        "Implement connection health monitoring and automatic recovery"
      );
    }

    return recommendations;
  }

  /**
   * Helper method to check if a line is within a try-catch block
   */
  private isInTryCatch(lines: string[], lineIndex: number): boolean {
    let tryIndex = -1;
    let catchIndex = -1;

    // Look backwards for try block
    for (let i = lineIndex; i >= 0; i--) {
      if (lines[i].includes("try {") || lines[i].trim() === "try {") {
        tryIndex = i;
        break;
      }
    }

    // Look forwards for catch block
    for (let i = lineIndex; i < lines.length; i++) {
      if (lines[i].includes("} catch")) {
        catchIndex = i;
        break;
      }
    }

    return (
      tryIndex !== -1 &&
      catchIndex !== -1 &&
      tryIndex < lineIndex &&
      lineIndex < catchIndex
    );
  }

  /**
   * Generate detailed report
   */
  async generateReport(report: SystemBreakPointReport): Promise<string> {
    const reportLines: string[] = [];

    reportLines.push("# System Break Point Analysis Report");
    reportLines.push(`Generated: ${report.timestamp.toISOString()}`);
    reportLines.push("");

    // Summary
    reportLines.push("## Summary");
    reportLines.push(`- Total Issues: ${report.summary.totalIssues}`);
    reportLines.push(`- Critical: ${report.summary.criticalIssues}`);
    reportLines.push(`- High: ${report.summary.highIssues}`);
    reportLines.push(`- Medium: ${report.summary.mediumIssues}`);
    reportLines.push(`- Low: ${report.summary.lowIssues}`);
    reportLines.push("");

    // Error Handling Issues
    if (report.errorHandling.length > 0) {
      reportLines.push("## Error Handling Issues");
      report.errorHandling.forEach((issue, index) => {
        reportLines.push(`### ${index + 1}. ${issue.description}`);
        reportLines.push(`**File:** ${issue.file}:${issue.line}`);
        reportLines.push(`**Severity:** ${issue.severity.toUpperCase()}`);
        reportLines.push(`**Type:** ${issue.type}`);
        reportLines.push(`**Suggestion:** ${issue.suggestion}`);
        if (issue.codeSnippet) {
          reportLines.push(`**Code:** \`${issue.codeSnippet}\``);
        }
        reportLines.push("");
      });
    }

    // Database Issues
    if (report.database.length > 0) {
      reportLines.push("## Database Issues");
      report.database.forEach((issue, index) => {
        reportLines.push(`### ${index + 1}. ${issue.description}`);
        reportLines.push(`**File:** ${issue.file}:${issue.line}`);
        reportLines.push(`**Severity:** ${issue.severity.toUpperCase()}`);
        reportLines.push(`**Type:** ${issue.type}`);
        reportLines.push(`**Suggestion:** ${issue.suggestion}`);
        if (issue.codeSnippet) {
          reportLines.push(`**Code:** \`${issue.codeSnippet}\``);
        }
        reportLines.push("");
      });
    }

    // Authentication Issues
    if (report.authentication.length > 0) {
      reportLines.push("## Authentication & Security Issues");
      report.authentication.forEach((issue, index) => {
        reportLines.push(`### ${index + 1}. ${issue.description}`);
        reportLines.push(`**File:** ${issue.file}:${issue.line}`);
        reportLines.push(`**Severity:** ${issue.severity.toUpperCase()}`);
        reportLines.push(`**Type:** ${issue.type}`);
        reportLines.push(`**Suggestion:** ${issue.suggestion}`);
        if (issue.codeSnippet) {
          reportLines.push(`**Code:** \`${issue.codeSnippet}\``);
        }
        reportLines.push("");
      });
    }

    // Real-time Issues
    if (report.realtime.length > 0) {
      reportLines.push("## Real-time & Connection Issues");
      report.realtime.forEach((issue, index) => {
        reportLines.push(`### ${index + 1}. ${issue.description}`);
        reportLines.push(`**File:** ${issue.file}:${issue.line}`);
        reportLines.push(`**Severity:** ${issue.severity.toUpperCase()}`);
        reportLines.push(`**Type:** ${issue.type}`);
        reportLines.push(`**Suggestion:** ${issue.suggestion}`);
        if (issue.codeSnippet) {
          reportLines.push(`**Code:** \`${issue.codeSnippet}\``);
        }
        reportLines.push("");
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      reportLines.push("## Recommendations");
      report.recommendations.forEach((rec, index) => {
        reportLines.push(`${index + 1}. ${rec}`);
      });
      reportLines.push("");
    }

    return reportLines.join("\n");
  }
}

// Export singleton instance
export const systemBreakPointAnalyzer = new SystemBreakPointAnalyzer();
