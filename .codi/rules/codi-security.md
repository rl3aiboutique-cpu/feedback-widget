---
name: codi-security
description: Security best practices and vulnerability prevention
priority: high
alwaysApply: true
managed_by: codi
version: 1
---

# Security Rules

## OWASP Alignment
- Follow the OWASP Top 10:2025 — the 2021 version is superseded
- Pay special attention to A02 (Security Misconfiguration) and A03 (Software Supply Chain Failures) — both were elevated in 2025
- Follow the OWASP API Security Top 10 for all API endpoints — API-specific vulnerabilities (BOLA, mass assignment) are distinct from web vulnerabilities

## Secret Management
- Never hardcode secrets, API keys, tokens, or credentials in source code — a single leaked key can compromise entire systems

BAD: `const API_KEY = "sk-abc123..."` in source code
GOOD: `const API_KEY = process.env.API_KEY` loaded at runtime

- Use environment variables or secret managers for all sensitive configuration
- Add .env files to .gitignore — never commit them
- Rotate secrets immediately if exposed in version control — automated scanners find leaked keys within minutes

## Secrets Scanning
- Run a secrets scanner (Gitleaks or TruffleHog) as a pre-commit hook — catching secrets before push is the cheapest mitigation
- Run the same scanner in CI as a required check on pull requests — pre-commit hooks can be bypassed
- Scan the full git history periodically, not just the latest diff — secrets deleted from HEAD remain in git history indefinitely

## Input Validation
- Validate and sanitize ALL user input at system boundaries — prevents injection attacks and data corruption

BAD: `db.query("SELECT * FROM users WHERE id = " + userId)`
GOOD: `db.query("SELECT * FROM users WHERE id = $1", [userId])`

- Use parameterized queries to prevent SQL injection
- Escape output to prevent XSS (cross-site scripting)
- Validate file uploads: check type, size, and content — malicious uploads can execute server-side code
- Validate and allowlist all URLs that the server fetches on behalf of users — SSRF lets attackers reach internal services and cloud metadata endpoints
- Block requests to internal IP ranges (169.254.x, 10.x, 172.16-31.x, 192.168.x) from server-side URL fetching
- Never deserialize untrusted data with general-purpose deserializers — use schema-validated formats (JSON with Zod/Joi, not pickle/yaml.load)

## Authentication & Authorization
- Offer passkeys (WebAuthn/FIDO2) as the primary authentication method — they are phishing-resistant by design and eliminate credential stuffing
- Use phishing-resistant MFA for privileged accounts — NIST SP 800-63-4 (2025) requires it for AAL2
- When passwords are used: bcrypt or Argon2id, minimum 12 characters, check against breach databases (HaveIBeenPwned API)
- Store session tokens in HttpOnly, Secure, SameSite=Lax cookies — never in localStorage
- Protect authentication endpoints with rate limiting and CAPTCHAs — prevents brute-force and credential-stuffing attacks
- Enforce RLS (Row Level Security) and RBAC from day one on all sensitive data — retrofitting access control is error-prone
- Apply principle of least privilege for all access control — users and services should only access what they need
- Enforce object-level authorization on every API endpoint that accesses a resource by ID — BOLA is the #1 API vulnerability

## API Security
- Never return more fields than the client needs — excessive data exposure leaks sensitive information even through authorized endpoints
- Use allowlists for mass assignment — explicitly define which fields are writable; never bind request bodies directly to models

BAD: `Object.assign(user, req.body)` — allows overwriting role, isAdmin, or any field
GOOD: `const { name, email } = req.body; user.update({ name, email })` — explicit allowlist

- Validate and sanitize data from third-party APIs with the same rigor as user input
- Implement rate limiting on all public endpoints — return X-RateLimit-Limit and X-RateLimit-Remaining headers

## Security Headers
- Set Content-Security-Policy to restrict script sources — CSP is the primary defense against XSS after output encoding
- Set Strict-Transport-Security with max-age=31536000 and includeSubDomains — prevents protocol downgrade attacks
- Always send X-Content-Type-Options: nosniff — prevents MIME-sniffing attacks
- Set Referrer-Policy: strict-origin-when-cross-origin — limits information leakage
- Use Permissions-Policy to disable unused browser features (camera, microphone, geolocation)
- Never set Access-Control-Allow-Origin to * with credentials — this disables CORS protections entirely

## Security Misconfiguration
- Disable debug mode, verbose error pages, and stack traces in production — they reveal internal architecture to attackers
- Remove or disable all default accounts and credentials before deployment
- Review framework and library default configurations — secure defaults are not universal; verify each one
- Automate configuration auditing in CI — drift from secure baselines should block deployment

## AI-Generated Code Security
- Review ALL AI-generated code with the same rigor as third-party code — AI models reproduce insecure patterns from training data
- Never embed user-controlled input directly into LLM prompts — prompt injection is the #1 LLM vulnerability (OWASP LLM01:2025)
- Validate and sanitize ALL LLM outputs before using them in downstream systems (SQL, shell, HTML)
- Do not grant LLM agents access to credentials, databases, or admin APIs without strict sandboxing and least-privilege scoping

BAD: `exec(llm_response)` or `db.query(llm_generated_sql)`
GOOD: Parse LLM output into a typed schema, validate against allowlist, then execute through parameterized interfaces

## Supply Chain Security
- Generate SBOMs (Software Bill of Materials) for all releases — required by EU CRA and US federal contracts
- Sign artifacts using Sigstore/Cosign or equivalent — unsigned artifacts cannot be verified as authentic
- Target SLSA Level 2 minimum: cryptographically signed provenance generated by the build system
- Use lockfiles AND verify integrity hashes — lockfiles without hash verification still allow tampering
- Audit dependencies regularly for known vulnerabilities — each dependency is an attack surface
- Pin dependency versions and remove unused dependencies promptly

## Container & Cloud Security
- Use minimal base images (distroless or Alpine) — smaller images have fewer vulnerabilities
- Run containers as non-root — a compromised process with root can escape the container
- Scan container images in CI before deployment — block images with critical or high CVEs
- Follow least-privilege for cloud IAM — no wildcard permissions, scope to specific resources and actions
- Never use default credentials or leave management ports publicly accessible
- Enable cloud provider audit logging from day one — you cannot investigate what you did not log

## Code Trust
- Treat all generated or external code as untrusted — perform strict validation before using
- Never trust client-side validation alone — always validate server-side

## General
- Log security events without exposing sensitive data — logs themselves can become a leak vector
- Use HTTPS for all external communications
- Implement proper error handling that does not leak internal details
