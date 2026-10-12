import { it, expect } from "vitest";
import {
  acceptanceProblems,
  requiredAcceptanceChecks,
} from "../scripts/acceptance-report.mjs";
const now = Date.parse("2026-10-12T00:00:00Z");
const tree = "a".repeat(64);
function fixture() {
  return {
    sourceTree: tree,
    reviewer: "TEST REVIEWER",
    checkedAt: new Date(now).toISOString(),
    checks: Object.fromEntries(requiredAcceptanceChecks.map((k) => [k, true])),
    evidence: Object.fromEntries(
      requiredAcceptanceChecks.map((k) => [
        k,
        {
          method: "manual",
          reference: "TEST FIXTURE",
          summary: "Synthetic test evidence, never a real acceptance record",
        },
      ]),
    ),
  };
}
it("rejects wrong builds, unrun checks and missing evidence", () => {
  const report = fixture();
  expect(acceptanceProblems(report, tree, now)).toEqual([]);
  report.sourceTree = "b".repeat(64);
  expect(acceptanceProblems(report, tree, now)).toContain(
    "Acceptance belongs to a different source tree",
  );
  report.sourceTree = tree;
  report.checks.windows11 = false;
  expect(acceptanceProblems(report, tree, now)).toContain(
    "windows11: not passed",
  );
  report.checks.windows11 = true;
  delete report.evidence.windows11;
  expect(acceptanceProblems(report, tree, now)).toContain(
    "windows11: observed evidence is missing",
  );
});
it("rejects missing reviewers, future dates and stale records", () => {
  const report = fixture();
  report.reviewer = { name: "TEST" };
  expect(acceptanceProblems(report, tree, now)).toContain(
    "Actual reviewer name is missing",
  );
  report.reviewer = "TEST";
  for (const checked of [now + 3600000, now - 8 * 86400000]) {
    report.checkedAt = new Date(checked).toISOString();
    expect(acceptanceProblems(report, tree, now)).toContain(
      "Acceptance date is missing, future-dated or older than seven days",
    );
  }
  expect(acceptanceProblems(null, tree, now)).toEqual([
    "Missing acceptance report",
  ]);
});
