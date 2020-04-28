import { GitHub } from '@actions/github'
import { getInput, setFailed, debug } from '@actions/core'
import fs from 'fs'
import walkdir from 'walkdir'
import { promisify } from 'util'

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm
const issueLabel = 'closed reference'

const gitHubClient = new GitHub(getInput('token'))
const [thisOwner, thisRepo] = process.env.GITHUB_REPOSITORY.split('/', 2)

const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

const createIssue = (upstreamReference: string) => {
  return gitHubClient.issues.create({
    owner: thisOwner,
    repo: thisRepo,
    title: issueTitle(upstreamReference),
    labels: [issueLabel]
  })
}

const readFile = promisify(fs.readFile)

const exitWithReason = (r: any) => {
  console.trace(r)
  setFailed(JSON.stringify(r))
}

;(async function () {
  await walkdir
    .async('.', { return_object: true })
    .then((files) => {
      debug('walking')
      return Promise.all(
        Object.entries(files).map<Promise<void>>(
          ([path, stats]: [string, fs.Stats]) => {
            debug(`found "${path}"`)
            if (stats.isDirectory()) {
              return Promise.resolve()
            }

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
                          if (issue.data.state == 'closed') {
                            return gitHubClient.issues
                              .list({
                                labels: issueLabel
                              })
                              .then((issues) => {
                                if (
                                  !issues.data.find(
                                    (issue) =>
                                      issue.title === issueTitle(reference)
                                  )
                                ) {
                                  debug(
                                    `could not find issue "${issueTitle(
                                      reference
                                    )}", creating it`
                                  )
                                  return createIssue(reference)
                                    .then(() => Promise.resolve())
                                    .catch(exitWithReason)
                                }
                              })
                              .catch(exitWithReason)
                          }
                        })
                        .catch(exitWithReason)
                    })
                  ).then(Promise.resolve)
                }
              )
              .catch(exitWithReason)
          }
        )
      ).catch(exitWithReason)
    })
    .catch(exitWithReason)
})()
