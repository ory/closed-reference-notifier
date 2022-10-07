// Copyright © 2022 Ory Corp

import mainRunner from "./mainRunner"
import { readIgnoreFiles, shouldIgnore } from "./helpers"
import fs from "fs"

const [dir = "-h", ignore = ".git"] = process.argv.slice(2)

switch (dir) {
  case "-help":
  case "-h":
  case "--help":
    console.log(`Usage:
npx closed-reference-notifier <dir> <ignore>

<dir>:    the directory to traverse
<ignore>: comma separated list of gitignore style entries to ignore, defaults to '.git'
`)
    process.exit(0)
}

;(async () => {
  await mainRunner({
    thisRepo: "",
    thisOwner: "",
    issueExists: () => Promise.resolve(false),
    issueTitle: () => "",
    issueBody: (ref, type, thisOwner, thisRepo, files) =>
      `Found reference "${ref}" in files
  ${files.map((file) => file.join("#")).join("\n  ")}`,
    issueIsClosed: () => Promise.resolve(true),
    ignorePaths: [...ignore.split(","), ...(await readIgnoreFiles(dir))],
    createIssue: (issue) => {
      console.log(issue.body)
      return Promise.resolve()
    },
    shouldIgnore,
    directory: dir,
    exitWithReason: (err: any) => {
      console.log("unexpected error:", err)
      process.exit(1)
    },
    labels: [],
    readFile: fs.promises.readFile,
    issueLimit: Number.POSITIVE_INFINITY,
  })
})()
