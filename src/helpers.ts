import { getInput, setFailed } from '@actions/core'
import { GitHub } from '@actions/github'
import { Octokit } from '@octokit/rest'
import ignore, { Ignore } from 'ignore'

let client: GitHub
const getClient = () => client || (client = new GitHub(getInput('token')))

export const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

export const issueBody = (
  upstreamReference: string,
  type: string,
  thisOwner: string,
  thisRepo: string,
  file: string
) =>
  `The upstream [${type}](https://${upstreamReference}) got closed. I found the reference in [this file](https://github.com/${thisOwner}/${thisRepo}/blob/master/${file}).`

export const createIssue = (
  params: Octokit.IssuesCreateParamsDeprecatedAssignee
) =>
  getClient()
    .issues.create(params)
    .then(() => Promise.resolve())

let ignoreCached: Ignore
export const shouldIgnore = (ignorePaths: Array<string>, relPath: string) =>
  (ignoreCached || (ignoreCached = ignore().add(ignorePaths))).ignores(relPath)

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
  issueIsClosed,
  issueBody
}
