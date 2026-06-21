// Parses grype JSON → GitHub job summary + step outputs + a severity gate.
const fs = require("fs");

const jsonPath = process.argv[2];
const failOn = (process.env.IV_FAIL_ON || "high").toLowerCase();
const order = ["negligible", "low", "medium", "high", "critical"];

let data = { matches: [] };
try {
  data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} catch {
  console.log("No grype results to parse.");
}

const matches = data.matches || [];
const counts = { critical: 0, high: 0, medium: 0, low: 0, negligible: 0, unknown: 0 };
const rows = [];
for (const m of matches) {
  const sev = (m.vulnerability && m.vulnerability.severity || "unknown").toLowerCase();
  counts[sev] = (counts[sev] || 0) + 1;
  rows.push([
    sev,
    m.vulnerability && m.vulnerability.id || "",
    m.artifact && m.artifact.name || "",
    m.artifact && m.artifact.version || "",
    (m.vulnerability && m.vulnerability.fix && m.vulnerability.fix.versions || [])[0] || "",
  ]);
}

const total = matches.length;
let md = `## 🛡️ Iron Vigil Security Scan\n\n**${total} findings** — `;
md += order.slice().reverse().map((s) => `${counts[s] || 0} ${s}`).join(" · ") + "\n\n";
if (total) {
  rows.sort((a, b) => order.indexOf(b[0]) - order.indexOf(a[0]));
  md += "| Severity | CVE | Package | Installed | Fixed |\n|---|---|---|---|---|\n";
  for (const r of rows.slice(0, 50)) md += `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4] || "—"} |\n`;
  if (rows.length > 50) md += `\n_…and ${rows.length - 50} more._\n`;
}

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `critical=${counts.critical}\nhigh=${counts.high}\n`);
console.log(`Iron Vigil: ${total} findings (${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low).`);

if (failOn !== "none") {
  const threshold = order.indexOf(failOn);
  if (threshold >= 0 && order.slice(threshold).some((s) => (counts[s] || 0) > 0)) {
    console.log(`::error::Findings at or above '${failOn}' severity — failing the build.`);
    process.exit(1);
  }
}
