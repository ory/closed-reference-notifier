import { getInput } from '@actions/core'
import fs from 'fs'
import nodePath from 'path'
import helpers from './helpers'
import mainRunner from './mainRunner'

const [thisOwner, thisRepo] = process.env.GITHUB_REPOSITORY.split('/', 2)

;(async () => {
  await mainRunner({
    ...helpers,
    readFile: fs.promises.readFile,
    thisOwner,
    thisRepo,
    labels: getInput('issueLabels').split(','),
    ignorePaths: getInput('ignore')
      .split(',')
      .map((path) => nodePath.resolve(nodePath.join('.', path))),
    directory: '.'
  })
})()
