import { GitHub } from '@actions/github'
import { getInput } from '@actions/core'
import fs from 'fs'
import walkdir from 'walkdir'
import { promisify } from 'util'
import nodePath from 'path'
import helpers from './helpers'

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm

type Dependencies = typeof helpers & {
  client: GitHub
  labels: Array<string>
  ignorePaths: Array<string>
  owner: string
  repo: string
  readFile: (path: string) => Promise<Buffer>
}

const mainRunner = ({
  shouldIgnore,
  exitWithReason,
  issueTitle,
  createIssue,
  issueExists,
  client,
  labels,
  owner: thisOwner,
  repo: thisRepo,
  readFile,
  ignorePaths
}: Dependencies) => {
  ;(async function () {
    await walkdir
      .async('.', { return_object: true })
      .then((files) => {
        return Promise.all(
          Object.entries(files).map<Promise<void>>(
            ([path, stats]: [string, fs.Stats]) => {
              if (stats.isDirectory()) {
                return Promise.resolve()
              }
              if (shouldIgnore(ignorePaths, path)) {
                return Promise.resolve()
              }

              return readFile(path)
                .then(
                  (data): Promise<void> => {
                    return Promise.all(
                      Array.from(data.toString().matchAll(referenceRegex)).map<
                        Promise<void>
                      >((match) => {
                        const [reference, owner, repo, type, id] = match

                        return client.issues
                          .get({
                            owner,
                            repo,
                            issue_number: parseInt(id)
                          })
                          .then((issue) => {
                            if (issue.data.state == 'closed') {
                              issueExists(client, reference)
                                .then((exists: boolean) =>
                                  exists
                                    ? createIssue(client, {
                                        owner: thisOwner,
                                        repo: thisRepo,
                                        labels,
                                        title: issueTitle(reference)
                                      })
                                        .then(() => Promise.resolve())
                                        .catch(exitWithReason)
                                    : Promise.resolve()
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
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/', 2)

mainRunner({
  ...helpers,
  client: new GitHub(getInput('token')),
  readFile: promisify(fs.readFile),
  owner,
  repo,
  labels: getInput('issueLabels').split(','),
  ignorePaths: getInput('ignore')
    .split(',')
    .map((path) => nodePath.resolve(nodePath.join('.', path)))
})

export default mainRunner
