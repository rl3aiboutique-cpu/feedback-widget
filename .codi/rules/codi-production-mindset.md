---
name: codi-production-mindset
description: Production-grade standards — no shortcuts, observability, reliability, safe deployments
priority: high
alwaysApply: true
managed_by: codi
version: 1
---

# Production Mindset

## Core Principle
- Treat every project as production-grade — no workarounds, no temporary solutions
- Implement as if deploying to production TODAY
- All solutions must follow current industry standards

## Observability — The Three Pillars
- Instrument with structured logs, metrics, and distributed traces from the first commit — observability is a design-time concern, not a runtime patch
- Use OpenTelemetry as the instrumentation standard — vendor-neutral and widely supported
- Include correlation IDs (trace IDs) in every log entry and API response — enables end-to-end debugging across services
- Track error rates as SLIs and define error budgets — pause feature releases when the budget is depleted

## SLOs and Reliability Targets
- Define Service Level Objectives (SLOs) for every user-facing service: availability, latency, error rate
- Measure with Service Level Indicators (SLIs) derived from real telemetry, not synthetic checks
- Use error budgets to gate releases — if the budget is depleted, prioritize reliability over features

## Database & Migrations
- Never apply migrations that are not written to a migration file first — ad-hoc schema changes cause drift
- Only execute migrations with explicit user confirmation
- Use connection pooling appropriate to your database and expected load
- Test migrations against a copy of production schema before deploying

## UI Standards
- Ensure all UI is responsive across mobile, tablet, and desktop breakpoints
- Ensure accessibility compliance (WCAG 2.1 AA minimum) — not optional, it is a legal requirement in many jurisdictions
- Use semantic HTML elements for screen reader compatibility
- Test with keyboard navigation and screen readers

## Reliability
- Implement retries with exponential backoff for transient failures
- Set timeouts on all external calls — unbounded waits cascade into outages
- Use health checks and readiness probes in containerized deployments
- Design for graceful degradation — partial functionality is better than total failure

## Progressive Rollout
- Use feature flags to decouple deployment from release — deploy code to production without exposing it to users
- Roll out features progressively: internal > canary (1-5%) > beta (10-25%) > general availability
- Monitor error rates and latency at each stage — automated rollback if SLO thresholds are breached

## Deployment Strategies
- Use blue-green or canary deployments for zero-downtime releases — never deploy directly to all traffic
- Automate rollback based on health check and SLO signals — manual rollback is too slow for production incidents

## Infrastructure as Code
- Define all infrastructure in version-controlled code (Terraform, Pulumi, CDK) — manual provisioning drifts and is unreproducible
- Review infrastructure changes through the same PR process as application code

## Chaos Engineering
- Test failure scenarios proactively in staging and production — verify that retries, circuit breakers, and failovers actually work
- Start small: kill a single pod or inject latency on one route — expand scope as confidence grows

## Incident Response
- Define an incident response playbook before the first incident — roles, communication channels, escalation paths
- Conduct blameless postmortems for every significant incident — document what happened, why, and what changes prevent recurrence

## No Shortcuts
- Never suppress linter errors without a documented reason
- Never skip tests to meet a deadline — technical debt compounds faster than financial debt
- Never use \`// @ts-ignore\` or equivalent without a ticket reference explaining why
- If a proper solution takes longer, discuss scope with the team — do not hack around it
