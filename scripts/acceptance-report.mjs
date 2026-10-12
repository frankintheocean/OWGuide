// 🧾 Check review evidence without turning an unrun check into a pass.
export const requiredAcceptanceChecks = [
  "liveRosterAndPatch",
  "allHeroGuides",
  "allSupportedMaps",
  "windows10",
  "windows11",
  "webViewOffline",
  "mainAndQuickWindows",
  "multiMonitorAndDpi",
  "keyboardAndScreenReader",
  "installerGuiAndDeleteData",
  "portableReadonlyFailure",
  "securityReview",
];
export function acceptanceProblems(report, tree, now = Date.now()) {
  const problems = [];
  if (!report || typeof report !== "object" || Array.isArray(report))
    return ["Missing acceptance report"];
  if (
    report.sourceTree !== tree ||
    !/^[a-f0-9]{64}$/.test(report.sourceTree ?? "")
  )
    problems.push("Acceptance belongs to a different source tree");
  if (typeof report.reviewer !== "string" || !report.reviewer.trim())
    problems.push("Actual reviewer name is missing");
  const checked =
    typeof report.checkedAt === "string" ? Date.parse(report.checkedAt) : NaN;
  if (
    !Number.isFinite(checked) ||
    checked > now + 300000 ||
    now - checked > 7 * 86400000
  )
    problems.push(
      "Acceptance date is missing, future-dated or older than seven days",
    );
  for (const key of requiredAcceptanceChecks) {
    if (report.checks?.[key] !== true) {
      problems.push(`${key}: not passed`);
      continue;
    }
    const evidence = report.evidence?.[key];
    if (
      !evidence ||
      !["manual", "automated"].includes(evidence.method) ||
      typeof evidence.reference !== "string" ||
      !evidence.reference.trim() ||
      typeof evidence.summary !== "string" ||
      !evidence.summary.trim()
    )
      problems.push(`${key}: observed evidence is missing`);
  }
  return problems;
}
