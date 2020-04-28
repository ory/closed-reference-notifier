import { GitHub } from '@actions/github'
import core from '@actions/core'
import fs from 'fs'
import walkdir from 'walkdir'

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm
const issueLabel = 'closed reference'

const gitHubClient = new GitHub(core.getInput('token'))
const [thisOwner, thisRepo] = process.env.GITHUB_REPOSITORY.split('/', 2)

const issueTitle = (upstreamReference: string) =>
  `upstream reference closed: ${upstreamReference}`

// const createIssue = (upstreamReference: string) => {
//
//
//   return gitHubClient.issues.create({
//     owner,
//     repo,
//     title: issueTitle(upstreamReference),
//     labels: [issueLabel]
//   })
// }

walkdir.async('.', { return_object: true }).then((files) =>
  Object.entries(files).forEach(
    ([path, stats]: [string, fs.Stats]) =>
      stats.isDirectory() ||
      fs.readFile(path, (err, data) => {
        if (err) {
          console.log(err)
          process.exit(1)
          return
        }

        for (let match of data.toString().matchAll(referenceRegex)) {
          const [reference, owner, repo, type, id] = match
          gitHubClient.issues
            .get({
              owner,
              repo,
              issue_number: parseInt(id)
            })
            .then((issue) => {
              if (issue.data.state == 'closed') {
                console.log('found closed reference:', reference)
                gitHubClient.issues
                  .list({
                    labels: issueLabel
                  })
                  .then((issues) => {
                    issues.data.find(
                      (issue) => issue.title === issueTitle(reference)
                    ) ||
                      console.log('closed reference without issue:', reference)
                  })
              }
            })
            .catch((err) => {
              console.log(err)
              process.exit(1)
            })
        }
      })
  )
)
