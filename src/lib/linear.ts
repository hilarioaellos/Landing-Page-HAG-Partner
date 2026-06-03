import { LinearClient } from "@linear/sdk";

export const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!,
});

export async function getMe() {
  return linear.viewer;
}

export async function getTeams() {
  const teams = await linear.teams();
  return teams.nodes;
}

export async function getIssues(teamId: string, options?: { limit?: number; status?: string }) {
  const team = await linear.team(teamId);
  const issues = await team.issues({
    first: options?.limit ?? 25,
    filter: options?.status ? { state: { name: { eq: options.status } } } : undefined,
    orderBy: "updatedAt" as any,
  });
  return issues.nodes;
}

export async function createIssue(teamId: string, data: {
  title: string;
  description?: string;
  priority?: number;
}) {
  return linear.createIssue({ teamId, ...data });
}

export async function updateIssueStatus(issueId: string, stateId: string) {
  return linear.updateIssue(issueId, { stateId });
}
