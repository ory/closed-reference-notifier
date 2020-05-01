import { getInput, setFailed } from '@actions/core'
import { GitHub } from '@actions/github'
import { Octokit } from '@octokit/rest'
import path from 'path'

let client: GitHub
const getClient = () => client || (client = new GitHub(getInput('token')))

export const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

export const createIssue = (
  params: Octokit.IssuesCreateParamsDeprecatedAssignee
) =>
  getClient()
    .issues.create(params)
    .then(() => Promise.resolve())

export const shouldIgnore = (ignorePaths: Array<string>, absPath: string) =>
  ignorePaths.reduce(
    (ignore: boolean, ignorePath) =>
      ignore ||
      absPath === ignorePath ||
      !path.relative(ignorePath, absPath).startsWith('..'),
    false
  )

export const exitWithReason = (r: any) => {
  console.log(r)
  setFailed(JSON.stringify(r))
}

export const issueExists = (reference: string) =>
  getClient()
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

export const issueIsClosed = ({
  owner,
  repo,
  issueNumber
}: {
  owner: string
  repo: string
  issueNumber: string
}) =>
  getClient()
    .issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber)
    })
    .then((issue) => Promise.resolve(issue.data.state == 'closed'))

export default {
  issueExists,
  exitWithReason,
  shouldIgnore,
  createIssue,
  issueTitle,
  issueIsClosed
}
