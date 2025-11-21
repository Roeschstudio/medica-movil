import { ChatSecurityAuditor } from "./chat-validation";

export interface FileScanResult {
  isClean: boolean;
  threats: ThreatDetection[];
  warnings: string[];
  metadata: FileMetadata;
}

export interface ThreatDetection {
  type:
    | "virus"
    | "malware"
    | "suspicious_content"
    | "embedded_script"
    | "macro"
    | "phishing";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  location?: string;
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  scanVersion: string;
}

// Known malicious file signatures (simplified for demo)
const MALICIOUS_SIGNATURES = [
  // PE executable signatures
  "4D5A", // MZ header
  "5A4D", // ZM header (reverse)

  // Script signatures in files
  "3C73637269707420", // <script
  "6A617661736372697074", // javascript
  "76627363726970743A", // vbscript:

  // Macro signatures
  "D0CF11E0A1B11AE1", // OLE compound document
  "504B0304", // ZIP/Office document with potential macros
];

// Suspicious patterns in file content
const SUSPICIOUS_PATTERNS = [
  // Embedded JavaScript
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,

  // Embedded VBScript
  /<script[\s\S]*?language\s*=\s*["']?vbscript["']?[\s\S]*?>[\s\S]*?<\/script>/gi,

  // Suspicious URLs
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|short\.link)/gi,

  // Potential phishing indicators
  /(?:login|signin|account|verify|update|confirm|secure).*(?:immediately|urgent|expire|suspend)/gi,

  // Obfuscated content
  /eval\s*\(\s*(?:unescape|atob|String\.fromCharCode)/gi,

  // Suspicious file operations
  /(?:CreateObject|WScript\.Shell|Shell\.Application|ActiveXObject)/gi,

  // Cryptocurrency/wallet related
  /(?:bitcoin|ethereum|wallet|private.*key|seed.*phrase)/gi,
];

// File type specific scanners
class FileTypeScanner {
  static async scanPDF(buffer: Buffer): Promise<ThreatDetection[]> {
    const threats: ThreatDetection[] = [];
    const content = buffer.toString("binary");

    // Check for embedded JavaScript in PDF
    if (content.includes("/JS") || content.includes("/JavaScript")) {
      threats.push({
        type: "embedded_script",
        severity: "high",
        description: "PDF contains embedded JavaScript",
        location: "PDF structure",
      });
    }

    // Check for suspicious actions
    if (content.includes("/Launch") || content.includes("/SubmitForm")) {
      threats.push({
        type: "suspicious_content",
        severity: "medium",
        description: "PDF contains potentially dangerous actions",
        location: "PDF actions",
      });
    }

    return threats;
  }

  static async scanOfficeDocument(buffer: Buffer): Promise<ThreatDetection[]> {
    const threats: ThreatDetection[] = [];
    const content = buffer.toString("binary");

    // Check for macros (simplified detection)
    if (content.includes("vbaProject") || content.includes("macros")) {
      threats.push({
        type: "macro",
        severity: "high",
        description: "Office document contains macros",
        location: "Document structure",
      });
    }

    // Check for external links
    const externalLinkPattern = /https?:\/\/[^\s"'<>]+/g;
    const links = content.match(externalLinkPattern);
    if (links && links.length > 10) {
      threats.push({
        type: "suspicious_content",
        severity: "medium",
        description: "Document contains excessive external links",
        location: "Document content",
      });
    }

    return threats;
  }

  static async scanImage(buffer: Buffer): Promise<ThreatDetection[]> {
    const threats: ThreatDetection[] = [];
    const content = buffer.toString("binary");

    // Check for embedded scripts in image metadata
    if (content.includes("<script") || content.includes("javascript:")) {
      threats.push({
        type: "embedded_script",
        severity: "high",
        description: "Image contains embedded script content",
        location: "Image metadata",
      });
    }

    // Check for suspicious EXIF data
    if (content.includes("eval(") || content.includes("document.write")) {
      threats.push({
        type: "suspicious_content",
        severity: "medium",
        description: "Image contains suspicious metadata",
        location: "EXIF data",
      });
    }

    return threats;
  }

  static async scanText(buffer: Buffer): Promise<ThreatDetection[]> {
    const threats: ThreatDetection[] = [];
    const content = buffer.toString("utf8");

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          type: "suspicious_content",
          severity: "medium",
          description: `Suspicious pattern detected: ${pattern.source}`,
          location: `Line containing: ${matches[0].substring(0, 50)}...`,
        });
      }
    }

    return threats;
  }
}

export class FileSecurityScanner {
  private static scanVersion = "1.0.0";

  static async scanFile(
    file: {
      name: string;
      size: number;
      type: string;
      buffer: Buffer;
    },
    uploadedBy: string
  ): Promise<FileScanResult> {
    const startTime = Date.now();
    const threats: ThreatDetection[] = [];
    const warnings: string[] = [];

    try {
      // Generate file hash
      const crypto = await import("crypto");
      const hash = crypto
        .createHash("sha256")
        .update(file.buffer)
        .digest("hex");

      // Create metadata
      const metadata: FileMetadata = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        extension: file.name
          .toLowerCase()
          .substring(file.name.lastIndexOf(".")),
        hash,
        uploadedBy,
        uploadedAt: new Date(),
        scanVersion: this.scanVersion,
      };

      // Check file size limits
      if (file.size > 100 * 1024 * 1024) {
        // 100MB
        warnings.push("File size is very large and may impact performance");
      }

      // Check for known malicious signatures
      const fileHeader = file.buffer.toString("hex", 0, 16).toUpperCase();
      for (const signature of MALICIOUS_SIGNATURES) {
        if (fileHeader.includes(signature)) {
          threats.push({
            type: "malware",
            severity: "critical",
            description: `File contains known malicious signature: ${signature}`,
            location: "File header",
          });
        }
      }

      // Perform file type specific scanning
      const fileTypeThreats = await this.scanByFileType(file.buffer, file.type);
      threats.push(...fileTypeThreats);

      // Check for embedded executables
      if (this.containsExecutable(file.buffer)) {
        threats.push({
          type: "malware",
          severity: "high",
          description: "File contains embedded executable content",
          location: "File content",
        });
      }

      // Check for suspicious file names
      const suspiciousNameThreats = this.checkSuspiciousFileName(file.name);
      threats.push(...suspiciousNameThreats);

      // Check against known bad hashes (simplified - in production use threat intelligence)
      const hashThreats = await this.checkHashReputation(hash);
      threats.push(...hashThreats);

      const isClean =
        threats.filter(
          (t) => t.severity === "high" || t.severity === "critical"
        ).length === 0;

      // Log scan results
      ChatSecurityAuditor.logSecurityEvent({
        userId: uploadedBy,
        action: "file_security_scan",
        ipAddress: "scanner",
        userAgent: "file-scanner",
        details: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          hash,
          threatsFound: threats.length,
          isClean,
          scanDuration: Date.now() - startTime,
        },
        severity: isClean
          ? "low"
          : threats.some((t) => t.severity === "critical")
          ? "critical"
          : "medium",
      });

      return {
        isClean,
        threats,
        warnings,
        metadata,
      };
    } catch (error) {
      console.error("File scanning error:", error);

      // Log scan error
      ChatSecurityAuditor.logSecurityEvent({
        userId: uploadedBy,
        action: "file_scan_error",
        ipAddress: "scanner",
        userAgent: "file-scanner",
        details: {
          fileName: file.name,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        severity: "high",
      });

      // Return safe default (block file on scan error)
      return {
        isClean: false,
        threats: [
          {
            type: "suspicious_content",
            severity: "high",
            description: "File could not be scanned properly",
            location: "Scan process",
          },
        ],
        warnings: ["File scanning failed - file blocked for security"],
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          extension: file.name
            .toLowerCase()
            .substring(file.name.lastIndexOf(".")),
          hash: "unknown",
          uploadedBy,
          uploadedAt: new Date(),
          scanVersion: this.scanVersion,
        },
      };
    }
  }

  private static async scanByFileType(
    buffer: Buffer,
    mimeType: string
  ): Promise<ThreatDetection[]> {
    switch (true) {
      case mimeType === "application/pdf":
        return FileTypeScanner.scanPDF(buffer);

      case mimeType.includes("officedocument") ||
        mimeType.includes("msword") ||
        mimeType.includes("excel"):
        return FileTypeScanner.scanOfficeDocument(buffer);

      case mimeType.startsWith("image/"):
        return FileTypeScanner.scanImage(buffer);

      case mimeType.startsWith("text/"):
        return FileTypeScanner.scanText(buffer);

      default:
        return [];
    }
  }

  private static containsExecutable(buffer: Buffer): boolean {
    const content = buffer.toString("hex").toUpperCase();

    // Check for PE header (Windows executable)
    if (content.includes("4D5A") && content.includes("50450000")) {
      return true;
    }

    // Check for ELF header (Linux executable)
    if (content.startsWith("7F454C46")) {
      return true;
    }

    // Check for Mach-O header (macOS executable)
    if (content.startsWith("FEEDFACE") || content.startsWith("FEEDFACF")) {
      return true;
    }

    return false;
  }

  private static checkSuspiciousFileName(fileName: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    const lowerName = fileName.toLowerCase();

    // Check for double extensions
    const extensions = fileName.split(".").slice(1);
    if (extensions.length > 2) {
      threats.push({
        type: "suspicious_content",
        severity: "medium",
        description: "File has multiple extensions which may be suspicious",
        location: "File name",
      });
    }

    // Check for suspicious keywords
    const suspiciousKeywords = [
      "invoice",
      "receipt",
      "urgent",
      "confidential",
      "password",
      "login",
      "bank",
      "paypal",
      "amazon",
      "microsoft",
      "google",
      "apple",
      "virus",
      "trojan",
      "malware",
      "hack",
      "crack",
      "keygen",
    ];

    for (const keyword of suspiciousKeywords) {
      if (lowerName.includes(keyword)) {
        threats.push({
          type: "phishing",
          severity: "medium",
          description: `File name contains suspicious keyword: ${keyword}`,
          location: "File name",
        });
      }
    }

    // Check for homograph attacks (similar looking characters)
    if (/[а-я]/.test(fileName) || /[αβγδε]/.test(fileName)) {
      threats.push({
        type: "phishing",
        severity: "medium",
        description:
          "File name contains non-Latin characters that may be deceptive",
        location: "File name",
      });
    }

    return threats;
  }

  private static async checkHashReputation(
    hash: string
  ): Promise<ThreatDetection[]> {
    // In production, this would check against threat intelligence databases
    // For now, we'll simulate with a simple known bad hash list
    const knownBadHashes = [
      // Add known malicious file hashes here
      "d41d8cd98f00b204e9800998ecf8427e", // Empty file (example)
    ];

    if (knownBadHashes.includes(hash)) {
      return [
        {
          type: "malware",
          severity: "critical",
          description: "File hash matches known malicious file",
          location: "Hash database",
        },
      ];
    }

    return [];
  }

  // Quarantine management
  static async quarantineFile(
    filePath: string,
    scanResult: FileScanResult,
    reason: string
  ): Promise<void> {
    try {
      // In production, move file to quarantine storage
      console.warn(`File quarantined: ${filePath}`, {
        reason,
        threats: scanResult.threats,
        metadata: scanResult.metadata,
      });

      // Log quarantine action
      ChatSecurityAuditor.logSecurityEvent({
        userId: scanResult.metadata.uploadedBy,
        action: "file_quarantined",
        ipAddress: "scanner",
        userAgent: "file-scanner",
        details: {
          filePath,
          fileName: scanResult.metadata.fileName,
          hash: scanResult.metadata.hash,
          reason,
          threats: scanResult.threats.length,
        },
        severity: "high",
      });
    } catch (error) {
      console.error("Failed to quarantine file:", error);
    }
  }

  // Get scan statistics
  static getScanStatistics(since?: Date): {
    totalScans: number;
    cleanFiles: number;
    threatsDetected: number;
    quarantinedFiles: number;
    topThreatTypes: Array<{ type: string; count: number }>;
  } {
    const logs = ChatSecurityAuditor.getSecurityLogs({
      since: since || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });

    const scanLogs = logs.filter((log) => log.action === "file_security_scan");
    const quarantineLogs = logs.filter(
      (log) => log.action === "file_quarantined"
    );

    const totalScans = scanLogs.length;
    const cleanFiles = scanLogs.filter((log) => log.details.isClean).length;
    const threatsDetected = scanLogs.filter(
      (log) => !log.details.isClean
    ).length;
    const quarantinedFiles = quarantineLogs.length;

    // Count threat types (simplified)
    const threatTypes = new Map<string, number>();
    scanLogs.forEach((log) => {
      if (!log.details.isClean) {
        const type = log.severity === "critical" ? "critical" : "medium";
        threatTypes.set(type, (threatTypes.get(type) || 0) + 1);
      }
    });

    const topThreatTypes = Array.from(threatTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalScans,
      cleanFiles,
      threatsDetected,
      quarantinedFiles,
      topThreatTypes,
    };
  }
}

// Middleware for file upload security
export const withFileSecurityScan = (
  handler: (request: Request, scanResult: FileScanResult) => Promise<Response>
) => {
  return async (request: Request): Promise<Response> => {
    try {
      // Extract file from request (implementation depends on your upload handling)
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return new Response(
          JSON.stringify({
            error: "No file provided",
            code: "NO_FILE",
          }),
          { status: 400 }
        );
      }

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Get user ID from request context (implementation depends on your auth)
      const userId = "unknown"; // Extract from auth context

      // Scan file
      const scanResult = await FileSecurityScanner.scanFile(
        {
          name: file.name,
          size: file.size,
          type: file.type,
          buffer,
        },
        userId
      );

      // Block file if not clean
      if (!scanResult.isClean) {
        const criticalThreats = scanResult.threats.filter(
          (t) => t.severity === "critical" || t.severity === "high"
        );

        if (criticalThreats.length > 0) {
          return new Response(
            JSON.stringify({
              error: "File blocked due to security threats",
              code: "FILE_BLOCKED",
              threats: criticalThreats,
            }),
            { status: 400 }
          );
        }
      }

      return handler(request, scanResult);
    } catch (error) {
      console.error("File security scan error:", error);
      return new Response(
        JSON.stringify({
          error: "File security scan failed",
          code: "SCAN_ERROR",
        }),
        { status: 500 }
      );
    }
  };
};
