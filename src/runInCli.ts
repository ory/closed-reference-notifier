import mainRunner from './mainRunner'
import { shouldIgnore } from './helpers'
import * as fs from 'fs'

switch (process.argv[2]) {
  case '-help':
  case '-h':
  case '--help':
    console.log(`Usage:
npx closed-reference-notifier <dir> <ignore>

<dir>:    the directory to traverse
<ignore>: comma separated list of gitignore style entries to ignore
`)
    process.exit(0)
}

;(async () => {
  await mainRunner({
    thisRepo: '',
    thisOwner: '',
    issueExists: () => Promise.resolve(false),
    issueTitle: () => '',
    issueBody: (ref, type, thisOwner, thisRepo, file) =>
      `Found reference "${ref}" in file ${file}`,
    issueIsClosed: () => Promise.resolve(true),
    ignorePaths: process.argv[3] ? process.argv[3].split(',') : [],
    createIssue: (issue) => {
      console.log(issue.body)
      return Promise.resolve()
    },
    shouldIgnore,
    directory: process.argv[2],
    exitWithReason: (err: any) => {
      console.log('unexpected error:', err)
      process.exit(1)
    },
    labels: [],
    readFile: fs.promises.readFile
  })
})()
