import { setFailed } from '@actions/core'
import { GitHub } from '@actions/github'
import { Octokit } from '@octokit/rest'

export const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

export const createIssue = (
  client: GitHub,
  params: Octokit.IssuesCreateParamsDeprecatedAssignee
) => {
  return client.issues.create(params)
}

export const shouldIgnore = (ignorePaths: Array<string>, absPath: string) =>
  ignorePaths.reduce(
    (ignore: boolean, ignorePath) => ignore || absPath.startsWith(ignorePath),
    false
  )

export const exitWithReason = (r: any) => {
  console.log(r)
  setFailed(JSON.stringify(r))
}

export const issueExists = (client: GitHub, reference: string) =>
  client
    .graphql(
      `
{
  search(query: "repo:${process.env.GITHUB_REPOSITORY} in:title ${reference}", type: ISSUE, first: 1) {
    nodes {
      ... on Issue {
        number
      }
    }
  }
}`
    )
    .then(
      ({
        search: { nodes }
      }: {
        search: { nodes: Array<{ number: number }> }
      }) => Promise.resolve(nodes.length !== 0)
    )

export default {
  issueExists,
  exitWithReason,
  shouldIgnore,
  createIssue,
  issueTitle
}
