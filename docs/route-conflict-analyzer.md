# Route Conflict Analyzer

A comprehensive utility for analyzing Next.js dynamic routes and identifying parameter naming conflicts and inconsistencies.

## Overview

The Route Conflict Analyzer scans your Next.js application's `app` directory to:

- Identify all dynamic routes and their parameters
- Detect parameter naming conflicts and inconsistencies
- Generate detailed reports with actionable recommendations
- Provide resolution plans for identified issues

## Features

### 🔍 Route Discovery

- Automatically scans the entire `app` directory structure
- Identifies dynamic routes (`[param]`, `[...param]`)
- Categorizes routes by type (API, page, layout, etc.)
- Maps parameters to their corresponding files

### ⚠️ Conflict Detection

- **Parameter Naming Conflicts**: Different parameter names for the same route pattern
- **Semantic Conflicts**: Inconsistent naming across related functionality
- **Critical vs Warning Classification**: Prioritizes issues by severity

### 📊 Comprehensive Reporting

- Detailed markdown reports with all findings
- Summary statistics and conflict categorization
- Resolution plans with step-by-step instructions
- Effort estimation for each recommendation

## Installation & Usage

### CLI Usage

```bash
# Analyze all routes and generate report
npx tsx scripts/analyze-routes.ts

# Just scan and list routes
npx tsx scripts/analyze-routes.ts scan

# Validate consistency only
npx tsx scripts/analyze-routes.ts validate

# Custom app directory and output file
npx tsx scripts/analyze-routes.ts analyze ./src/app ./my-report.md
```

### Programmatic Usage

```typescript
import {
  RouteConflictAnalyzer,
  validateRoutes,
} from "./lib/route-conflict-analyzer";

// Quick validation
const result = await validateRoutes("./app");
console.log(`Found ${result.summary.totalConflicts} conflicts`);

// Detailed analysis
const analyzer = new RouteConflictAnalyzer("./app");
const routes = await analyzer.scanDynamicRoutes();
const conflicts = analyzer.detectConflicts();
const plan = analyzer.generateResolutionPlan(conflicts);
```

## API Reference

### RouteConflictAnalyzer Class

#### Constructor

```typescript
new RouteConflictAnalyzer(appDirectory?: string)
```

#### Methods

##### `scanDynamicRoutes(): Promise<DynamicRoute[]>`

Scans the app directory and returns all dynamic routes found.

##### `detectConflicts(): RouteConflict[]`

Analyzes scanned routes and identifies conflicts.

##### `validateRouteConsistency(): Promise<ValidationResult>`

Performs complete validation and returns comprehensive results.

##### `generateResolutionPlan(conflicts: RouteConflict[]): ResolutionPlan`

Creates actionable recommendations for resolving conflicts.

##### `generateDetailedReport(): Promise<string>`

Generates a comprehensive markdown report.

### Utility Functions

```typescript
// Quick functions for common operations
scanAllDynamicRoutes(appDirectory?: string): Promise<DynamicRoute[]>
validateRoutes(appDirectory?: string): Promise<ValidationResult>
generateRouteReport(appDirectory?: string): Promise<string>
```

## Data Types

### DynamicRoute

```typescript
interface DynamicRoute {
  path: string; // Route path (e.g., "api/users/[id]")
  parameters: string[]; // Parameter names (e.g., ["id"])
  files: string[]; // Associated files
  routeType: "page" | "api" | "layout" | "loading" | "error";
}
```

### RouteConflict

```typescript
interface RouteConflict {
  path: string; // Conflicting route path
  conflictingParams: string[]; // Conflicting parameter names
  affectedFiles: string[]; // Files that need updates
  severity: "critical" | "warning" | "info";
  description: string; // Human-readable description
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean; // Overall validation status
  conflicts: RouteConflict[]; // All identified conflicts
  routes: DynamicRoute[]; // All scanned routes
  summary: {
    totalRoutes: number;
    totalConflicts: number;
    criticalConflicts: number;
    warningConflicts: number;
  };
}
```

## Conflict Types

### 1. Parameter Naming Conflicts

When the same route pattern uses different parameter names:

```
❌ Conflict:
/api/appointments/[id]/route.ts
/api/appointments/[appointmentId]/route.ts

✅ Resolution:
Standardize to /api/appointments/[appointmentId]/route.ts
```

### 2. Semantic Conflicts

When related functionality uses inconsistent parameter naming:

```
❌ Inconsistent:
/chat/[appointmentId]/page.tsx
/api/appointments/[id]/route.ts

✅ Consistent:
/chat/[appointmentId]/page.tsx
/api/appointments/[appointmentId]/route.ts
```

## Severity Levels

- **Critical**: API route conflicts that can break functionality
- **Warning**: Page route conflicts or semantic inconsistencies
- **Info**: Minor inconsistencies with low impact

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/route-validation.yml
- name: Validate Routes
  run: |
    npx tsx scripts/analyze-routes.ts validate
    if [ $? -ne 0 ]; then
      echo "Route validation failed"
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx tsx scripts/analyze-routes.ts validate --quiet
```

### Development Workflow

```typescript
// In your development setup
import { validateRoutes } from "./lib/route-conflict-analyzer";

async function checkRoutes() {
  const result = await validateRoutes();
  if (!result.isValid) {
    console.warn(`⚠️ Found ${result.summary.totalConflicts} route conflicts`);
    // Show conflicts in development
  }
}
```

## Configuration

The analyzer can be configured by modifying the semantic groups in the source code:

```typescript
const semanticGroups = [
  {
    name: "appointments",
    patterns: ["/chat/", "/api/appointments/", "/api/chat/"],
    expectedParam: "appointmentId",
    description:
      "Appointment-related routes should use consistent parameter naming",
  },
  // Add your own semantic groups
];
```

## Best Practices

### 1. Consistent Parameter Naming

- Use descriptive parameter names (`appointmentId` vs `id`)
- Maintain consistency across related routes
- Follow domain-specific conventions

### 2. Route Organization

- Group related routes under common patterns
- Use semantic parameter names that reflect the domain
- Avoid generic names like `id` when more specific names are available

### 3. Regular Validation

- Run route validation in CI/CD pipelines
- Include route analysis in code reviews
- Monitor for new conflicts as the codebase grows

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure read access to the app directory
2. **Large Codebases**: The analyzer handles large projects but may take time
3. **Custom Route Patterns**: Extend the analyzer for custom routing patterns

### Performance Tips

- Run analysis on specific subdirectories for large projects
- Use the CLI for one-time analysis, programmatic API for integration
- Cache results when running multiple analyses

## Contributing

To extend the analyzer:

1. Add new conflict detection rules in `detectConflicts()`
2. Extend semantic groups for domain-specific patterns
3. Add new resolution strategies in `generateResolutionPlan()`

## Examples

See `lib/route-analyzer-example.ts` for comprehensive usage examples.

## Testing

Run the validation script to test the analyzer:

```bash
npx tsx scripts/validate-route-analyzer.ts
```

## Output Examples

### CLI Output

```
🔍 Route Conflict Analyzer
==========================

✅ Validating route consistency...

📊 Validation Results:
   Total Routes: 15
   Total Conflicts: 1
   Critical: 0
   Warnings: 1
   Status: ❌ Issues Found
```

### Generated Report

The analyzer generates detailed markdown reports with:

- Complete route inventory
- Conflict descriptions and affected files
- Step-by-step resolution instructions
- Effort estimates for each fix

See `reports/route-analysis-report.md` for a complete example.
