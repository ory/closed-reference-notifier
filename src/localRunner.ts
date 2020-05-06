import mainRunner from './mainRunner'
import { shouldIgnore } from './helpers'
import * as fs from 'fs'

switch (process.argv[1]) {
  case '-help':
  case '-h':
  case '--help':
    console.log(`help message`)
    process.exit(0)
}

;(async () => {
  await mainRunner({
    thisRepo: '',
    thisOwner: '',
    issueExists: () => Promise.resolve(false),
    issueTitle: (ref) => ref,
    issueBody: (ref) => ref,
    issueIsClosed: () => Promise.resolve(true),
    ignorePaths: process.argv[2].split(','),
    createIssue: (issue) => {
      console.log(issue)
      return Promise.resolve()
    },
    shouldIgnore,
    directory: process.argv[1],
    exitWithReason: console.log,
    labels: [],
    readFile: fs.promises.readFile
  })
})()
