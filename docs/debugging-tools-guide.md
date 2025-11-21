# Debugging Tools Guide

This guide explains how to use the debugging and analysis tools configured for the medical platform.

## Overview

The debugging tools suite includes:

1. **Bundle Analyzer** - Analyze bundle size and performance
2. **Dependency Cruiser** - Detect circular dependencies and orphaned modules
3. **Duplicate Code Detection** - Find code duplication across the codebase
4. **Performance Monitoring** - Track build performance and metrics

## Installation

All debugging tools are installed as development dependencies. To install them:

```bash
npm install
```

## Available Scripts

### Bundle Analysis

```bash
# Analyze bundle with Next.js Bundle Analyzer
npm run analyze

# Analyze specific chunks with webpack-bundle-analyzer
npm run analyze:bundle
```

### Dependency Analysis

```bash
# Check for circular dependencies and validation issues
npm run deps:check

# Generate dependency graph (requires Graphviz)
npm run deps:graph
```

### Duplicate Code Detection

```bash
# Quick duplicate code check
npm run duplicate:check

# Generate detailed HTML report
npm run duplicate:report
```

### Comprehensive Debugging

```bash
# Run all debugging tools
npm run debug:all

# Run specific tool categories
npm run debug:bundle
npm run debug:deps
npm run debug:duplicates
npm run debug:performance
```

## Tool Configurations

### Bundle Analyzer Configuration

Located in `next.config.js`:

- Enabled when `ANALYZE=true` environment variable is set
- Opens browser automatically with analysis results
- Analyzes both client and server bundles

### Dependency Cruiser Configuration

Located in `.dependency-cruiser.js`:

- Detects circular dependencies
- Identifies orphaned modules
- Validates npm package usage
- Excludes `node_modules` and build directories

### Duplicate Code Detection Configuration

Located in `.jscpd.json`:

- Minimum 5 lines for duplicate detection
- Analyzes TypeScript, JavaScript, JSX, and TSX files
- Generates HTML, console, and badge reports
- Excludes build directories and node_modules

## Reports and Output

### Report Locations

All reports are saved to the `reports/` directory:

```
reports/
├── jscpd/                    # Duplicate code reports
│   └── html/                 # HTML report files
├── dependency-report.json    # Dependency analysis JSON
├── dependency-graph.dot      # Dependency graph (DOT format)
├── bundle-analysis.json      # Bundle size analysis
└── debug-summary.json        # Comprehensive summary
```

### Reading Reports

#### Bundle Analysis

- Opens automatically in browser when running `npm run analyze`
- Shows chunk sizes, module dependencies, and optimization opportunities

#### Dependency Analysis

- Console output shows circular dependencies and warnings
- JSON report contains detailed dependency information
- DOT file can be converted to SVG for visual dependency graph

#### Duplicate Code Report

- HTML report provides interactive view of duplicated code
- Console output shows summary statistics
- Badge report generates coverage-style badges

## Interpreting Results

### Bundle Analysis Results

Look for:

- Large chunks that could be split
- Unused dependencies increasing bundle size
- Opportunities for code splitting

### Dependency Analysis Results

Watch for:

- **Circular dependencies** (errors) - Need immediate attention
- **Orphaned modules** (warnings) - Consider removing unused code
- **Deprecated dependencies** - Update to newer versions

### Duplicate Code Results

Focus on:

- High-impact duplicates (large line counts)
- Duplicates in critical paths
- Opportunities for utility function extraction

## Best Practices

### Regular Analysis

Run debugging tools regularly:

- Before major releases
- After adding new dependencies
- When performance issues are suspected

### Automated Checks

Consider adding to CI/CD pipeline:

```bash
# Add to package.json scripts for CI
"ci:analyze": "npm run deps:check && npm run duplicate:check"
```

### Performance Monitoring

Set up thresholds:

- Bundle size limits
- Dependency count limits
- Duplicate code percentage limits

## Troubleshooting

### Common Issues

1. **Dependency Cruiser Fails**

   - Ensure TypeScript is properly configured
   - Check that all paths in configuration exist

2. **Bundle Analyzer Won't Open**

   - Check if port 8888 is available
   - Ensure browser allows localhost connections

3. **Duplicate Detection Misses Files**
   - Verify file extensions in configuration
   - Check include/exclude patterns

### Performance Tips

- Run analysis on smaller subsets for faster results
- Use `--max-old-space-size` for large codebases
- Exclude test files for production analysis

## Integration with Development Workflow

### Pre-commit Hooks

Add to `.husky/pre-commit`:

```bash
npm run deps:check
```

### IDE Integration

Most tools support IDE plugins:

- ESLint integration for dependency warnings
- Bundle analyzer results in VS Code
- Duplicate code highlighting

## Advanced Usage

### Custom Analysis Scripts

The `scripts/debug-tools.js` provides a programmatic interface:

```javascript
const { DebugToolsRunner } = require("./scripts/debug-tools.js");
const runner = new DebugToolsRunner();

// Run specific analysis
await runner.runDependencyAnalysis();
```

### Configuration Customization

Modify configurations for specific needs:

- Adjust duplicate detection thresholds
- Add custom dependency rules
- Configure bundle analysis options

## Support and Resources

- [Next.js Bundle Analyzer Documentation](https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer)
- [Dependency Cruiser Documentation](https://github.com/sverweij/dependency-cruiser)
- [JSCPD Documentation](https://github.com/kucherenko/jscpd)
