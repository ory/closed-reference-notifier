import { GitHub } from '@actions/github'
import { getInput, setFailed, debug } from '@actions/core'
import fs from 'fs'
import walkdir from 'walkdir'
import { promisify } from 'util'
import nodePath from 'path'

// constants
const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm

// computed constants
const gitHubClient = new GitHub(getInput('token'))
const [thisOwner, thisRepo] = process.env.GITHUB_REPOSITORY.split('/', 2)
const readFile = promisify(fs.readFile)
const ignorePaths = getInput('ignore')
  .split(',')
  .map((path) => nodePath.resolve(nodePath.join('.', path)))
const issueLabels = getInput('issueLabels').split(',')

// helper functions
const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

const createIssue = (upstreamReference: string) => {
  return gitHubClient.issues.create({
    owner: thisOwner,
    repo: thisRepo,
    title: issueTitle(upstreamReference),
    labels: issueLabels
  })
}

const shouldIgnore = (absPath: string) =>
  ignorePaths.reduce(
    (ignore: boolean, ignorePath) => ignore || absPath.startsWith(ignorePath),
    false
  )

const exitWithReason = (r: any) => {
  console.log(r)
  setFailed(JSON.stringify(r))
}

// main runner
;(async function () {
  await walkdir
    .async('.', { return_object: true })
    .then((files) => {
      return Promise.all(
        Object.entries(files).map<Promise<void>>(
          ([path, stats]: [string, fs.Stats]) => {
            if (stats.isDirectory()) {
              debug(`is directory ${path}`)
              return Promise.resolve()
            }
            if (shouldIgnore(path)) {
              debug(`ignoring ${path}`)
              return Promise.resolve()
            }
            debug(`analyzing ${path}`)

            return readFile(path)
              .then(
                (data): Promise<void> => {
                  debug(`read file: ${data}`)
                  return Promise.all(
                    Array.from(data.toString().matchAll(referenceRegex)).map<
                      Promise<void>
                    >((match) => {
                      const [reference, owner, repo, type, id] = match
                      debug(`found reference "${reference}"`)

                      return gitHubClient.issues
                        .get({
                          owner,
                          repo,
                          issue_number: parseInt(id)
                        })
                        .then((issue) => {
                          debug(
                            `got issue for reference "${reference}": ${JSON.stringify(
                              issue,
                              null,
                              2
                            )}`
                          )
                          if (issue.data.state == 'closed') {
                            gitHubClient
                              .graphql(
                                `{
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
                                  data: {
                                    search: { nodes }
                                  }
                                }: {
                                  data: {
                                    search: { nodes: Array<{ number: number }> }
                                  }
                                }) => {
                                  if (nodes.length === 0) {
                                    debug(
                                      `could not find issue "${issueTitle(
                                        reference
                                      )}", creating it`
                                    )
                                    return createIssue(reference)
                                      .then(() => Promise.resolve())
                                      .catch(exitWithReason)
                                  }
                                  return Promise.resolve()
                                }
                              )
                              .catch(exitWithReason)
                          }
                        })
                        .catch(exitWithReason)
                    })
                  ).then(() => Promise.resolve())
                }
              )
              .catch(exitWithReason)
          }
        )
      ).catch(exitWithReason)
    })
    .catch(exitWithReason)
})()
