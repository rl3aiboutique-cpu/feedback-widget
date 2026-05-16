/**
 * Pattern definitions for the security scanner.
 *
 * Extracted from security-scan.ts for modularity.
 * Each pattern list targets a specific threat category.
 */

import type { SecuritySeverity } from "./security-scan.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatternDef {
  pattern: RegExp;
  severity: SecuritySeverity;
  description: string;
}

// ---------------------------------------------------------------------------
// Prompt Injection Patterns
// ---------------------------------------------------------------------------

export const INJECTION_PATTERNS: PatternDef[] = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    severity: "critical",
    description: "Prompt injection: ignore previous instructions",
  },
  {
    pattern: /ignore\s+(all\s+)?prior\s+instructions/i,
    severity: "critical",
    description: "Prompt injection: ignore prior instructions",
  },
  {
    pattern: /disregard\s+(your\s+)?system\s+prompt/i,
    severity: "critical",
    description: "Prompt injection: disregard system prompt",
  },
  {
    pattern: /your\s+new\s+instructions\s+are/i,
    severity: "critical",
    description: "Prompt injection: overwrite instructions",
  },
  {
    pattern: /forget\s+everything\s+(above|before)/i,
    severity: "critical",
    description: "Prompt injection: forget prior context",
  },
  {
    pattern: /override\s+(your\s+)?instructions/i,
    severity: "critical",
    description: "Prompt injection: override instructions",
  },
  {
    pattern: /you\s+are\s+now\s+(?!going|able|ready)/i,
    severity: "high",
    description: "Potential role hijacking: 'you are now'",
  },
  {
    pattern: /^SYSTEM:\s/m,
    severity: "high",
    description: "System message impersonation: SYSTEM: prefix",
  },
  {
    pattern: /^ADMIN:\s/m,
    severity: "high",
    description: "Admin message impersonation: ADMIN: prefix",
  },
  {
    pattern: /\[SYSTEM\]\s*:/m,
    severity: "high",
    description: "System message impersonation: [SYSTEM]: prefix",
  },
  {
    pattern: /do\s+not\s+follow\s+(your|the)\s+(previous|original|safety)/i,
    severity: "critical",
    description: "Prompt injection: bypass safety instructions",
  },
  {
    pattern: /act\s+as\s+(if\s+)?you\s+(have\s+)?no\s+restrictions/i,
    severity: "critical",
    description: "Prompt injection: remove restrictions",
  },
];

// ---------------------------------------------------------------------------
// Malicious Script Patterns
// ---------------------------------------------------------------------------

export const SCRIPT_PATTERNS: PatternDef[] = [
  // Shell dangerous ops
  {
    pattern: /rm\s+-r[f ]?\s+[/~]/,
    severity: "critical",
    description: "Recursive delete of root or home directory",
  },
  {
    pattern: /rm\s+-fr?\s+[/~]/,
    severity: "critical",
    description: "Recursive delete of root or home directory",
  },
  {
    pattern: /curl\s+[^\n]*\|\s*(?:bash|sh|zsh)/,
    severity: "critical",
    description: "Pipe curl output to shell execution",
  },
  {
    pattern: /wget\s+[^\n]*\|\s*(?:bash|sh|zsh)/,
    severity: "critical",
    description: "Pipe wget output to shell execution",
  },
  {
    pattern: /\/dev\/tcp\//,
    severity: "critical",
    description: "Reverse shell via /dev/tcp",
  },
  {
    pattern: /nc\s+-[elp]/,
    severity: "high",
    description: "Netcat listener or connection",
  },
  {
    pattern: /bash\s+-i\s+>&?\s*\/dev/,
    severity: "critical",
    description: "Interactive reverse shell",
  },
  {
    pattern: /mkfifo\s+.*\/tmp/,
    severity: "high",
    description: "Named pipe creation (potential reverse shell)",
  },
  {
    pattern: /chmod\s+\+x\s+.*&&\s*\.\//,
    severity: "high",
    description: "Download-and-execute pattern",
  },
  {
    pattern: /curl\s+.*-o\s+.*&&\s*chmod/,
    severity: "high",
    description: "Download, chmod, execute chain",
  },
  // Python dangerous ops
  {
    pattern: /pickle\.loads?\s*\(/,
    severity: "high",
    description: "Deserializing untrusted data with pickle",
  },
  {
    pattern: /marshal\.loads?\s*\(/,
    severity: "high",
    description: "Deserializing untrusted data with marshal",
  },
  {
    pattern: /os\.system\s*\(/,
    severity: "medium",
    description: "Shell command via os.system()",
  },
  {
    pattern: /subprocess\..*shell\s*=\s*True/,
    severity: "high",
    description: "Subprocess with shell=True",
  },
  {
    pattern: /__import__\s*\(\s*['"]os['"]\)/,
    severity: "high",
    description: "Dynamic import of os module",
  },
  // Node.js dangerous ops
  {
    pattern: /child_process\.(exec|execSync)\s*\(/,
    severity: "medium",
    description: "Shell command via child_process.exec",
  },
  {
    pattern: /\beval\s*\([^)]*\+/,
    severity: "high",
    description: "eval() with string concatenation",
  },
  {
    pattern: /new\s+Function\s*\(/,
    severity: "high",
    description: "Dynamic code via Function constructor",
  },
  // General
  {
    pattern: /\beval\s*\(\s*['"`]/,
    severity: "medium",
    description: "eval() with string literal",
  },
];

// ---------------------------------------------------------------------------
// Data Exfiltration Patterns
// ---------------------------------------------------------------------------

export const EXFIL_PATTERNS: PatternDef[] = [
  {
    pattern: /~\/\.ssh/,
    severity: "critical",
    description: "Access to SSH keys directory",
  },
  {
    pattern: /~\/\.aws/,
    severity: "critical",
    description: "Access to AWS credentials directory",
  },
  {
    pattern: /~\/\.gnupg/,
    severity: "critical",
    description: "Access to GPG keys directory",
  },
  {
    pattern: /~\/\.kube\/config/,
    severity: "critical",
    description: "Access to Kubernetes config",
  },
  {
    pattern: /printenv\s*[|>]/,
    severity: "high",
    description: "Piping environment variables",
  },
  {
    pattern: /\$AWS_SECRET/,
    severity: "high",
    description: "Reference to AWS secret key",
  },
  {
    pattern: /\$AWS_ACCESS_KEY/,
    severity: "high",
    description: "Reference to AWS access key",
  },
  {
    pattern: /\$(API_KEY|PRIVATE_KEY|SECRET_KEY|AUTH_TOKEN)/,
    severity: "high",
    description: "Reference to sensitive environment variable",
  },
  {
    pattern: /\$PASSWORD\b/,
    severity: "high",
    description: "Reference to password environment variable",
  },
  {
    pattern: /cat\s+.*\.env\b/,
    severity: "high",
    description: "Reading .env file contents",
  },
  {
    pattern: /curl\s+.*-d\s+.*\$\(.*printenv/,
    severity: "critical",
    description: "Exfiltrating environment variables via HTTP",
  },
  {
    pattern: /base64\s+.*\.(pem|key|crt)/,
    severity: "high",
    description: "Base64 encoding of certificate/key files",
  },
];

// ---------------------------------------------------------------------------
// Dependency Patterns
// ---------------------------------------------------------------------------

export const DEPENDENCY_PATTERNS: PatternDef[] = [
  {
    pattern: /invoke-expression|iex\s*\(/,
    severity: "high",
    description: "PowerShell invoke-expression",
  },
  {
    pattern: /pip\s+install\s+--index-url\s+http:\/\//,
    severity: "high",
    description: "pip install from insecure HTTP source",
  },
  {
    pattern: /npm\s+install\s+--registry\s+http:\/\//,
    severity: "high",
    description: "npm install from insecure HTTP registry",
  },
];

// ---------------------------------------------------------------------------
// Magic Bytes
// ---------------------------------------------------------------------------

export const MAGIC_BYTES: Record<string, { bytes: number[]; name: string }> = {
  ".png": { bytes: [0x89, 0x50, 0x4e, 0x47], name: "PNG" },
  ".jpg": { bytes: [0xff, 0xd8, 0xff], name: "JPEG" },
  ".jpeg": { bytes: [0xff, 0xd8, 0xff], name: "JPEG" },
  ".gif": { bytes: [0x47, 0x49, 0x46], name: "GIF" },
  ".pdf": { bytes: [0x25, 0x50, 0x44, 0x46], name: "PDF" },
  ".zip": { bytes: [0x50, 0x4b, 0x03, 0x04], name: "ZIP" },
};

export const EXECUTABLE_SIGNATURES: Array<{ bytes: number[]; name: string }> = [
  { bytes: [0x7f, 0x45, 0x4c, 0x46], name: "ELF executable" },
  { bytes: [0x4d, 0x5a], name: "PE/Windows executable" },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], name: "Mach-O executable (32-bit)" },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], name: "Mach-O executable (64-bit)" },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], name: "Mach-O executable (reversed)" },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], name: "Mach-O universal binary" },
];
