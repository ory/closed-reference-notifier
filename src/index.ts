import { GitHub } from '@actions/github'
import { getInput, setFailed, debug } from '@actions/core'
import fs from 'fs'
import walkdir from 'walkdir'

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

debug('will walk')
console.log('log will walk')
;(async function () {
  walkdir.async('.', { return_object: true }).then((files) => {
    debug('walking')
    Object.entries(files).forEach(
      ([path, stats]: [string, fs.Stats]) =>
        stats.isDirectory() ||
        fs.readFile(path, (err, data) => {
          if (err) {
            setFailed(JSON.stringify(err))
          }

          for (let match of data.toString().matchAll(referenceRegex)) {
            const [reference, owner, repo, type, id] = match
            debug(`found reference "${reference}"`)
            gitHubClient.issues
              .get({
                owner,
                repo,
                issue_number: parseInt(id)
              })
              .then((issue) => {
                if (issue.data.state == 'closed') {
                  gitHubClient.issues
                    .list({
                      labels: issueLabel
                    })
                    .then((issues) => {
                      if (
                        !issues.data.find(
                          (issue) => issue.title === issueTitle(reference)
                        )
                      ) {
                        debug(
                          `could not find issue "${issueTitle(
                            reference
                          )}", creating it`
                        )
                        createIssue(reference).catch((res) =>
                          setFailed(JSON.stringify(res))
                        )
                      }
                    })
                }
              })
              .catch((res) => setFailed(JSON.stringify(res)))
          }
        })
    )
  })
})()
