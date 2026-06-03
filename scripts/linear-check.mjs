import { LinearClient } from "@linear/sdk";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const client = new LinearClient({ apiKey: env.LINEAR_API_KEY });

const me = await client.viewer;
console.log(`\n✓ Connected as: ${me.name} (${me.email})`);

const teams = await client.teams();
console.log(`\n Teams:`);
for (const team of teams.nodes) {
  const issues = await team.issues({ first: 5 });
  console.log(`  · ${team.name} [${team.key}] — ${issues.nodes.length} recent issues`);
  for (const issue of issues.nodes) {
    const state = await issue.state;
    console.log(`      ${issue.identifier}  ${state?.name.padEnd(12)}  ${issue.title}`);
  }
}
