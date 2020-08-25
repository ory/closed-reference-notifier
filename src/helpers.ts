// Copyright © 2020 Patrik Neu, Ory Corp patrik@ory.sh
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

export const createIssue = (params: Octokit.IssuesCreateParams) =>
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
}) => {
  console.log(`found reference to ${owner}/${repo}#${issueNumber}`)
  return getClient()
    .issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber)
    })
    .then((issue) => Promise.resolve(issue.data.state == 'closed'))
}

export default {
  issueExists,
  exitWithReason,
  shouldIgnore,
  createIssue,
  issueTitle,
  issueIsClosed,
  issueBody
}
