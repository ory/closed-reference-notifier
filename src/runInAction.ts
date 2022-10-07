// Copyright © 2022 Ory Corp

import { getInput } from "@actions/core"
import fs from "fs"
import helpers, { readIgnoreFiles } from "./helpers"
import mainRunner from "./mainRunner"

const [thisOwner, thisRepo] = process.env.GITHUB_REPOSITORY.split("/", 2)

;(async () => {
  await mainRunner({
    ...helpers,
    readFile: fs.promises.readFile,
    thisOwner,
    thisRepo,
    labels: getInput("issueLabels").split(","),
    ignorePaths: [
      ...getInput("ignore").split(","),
      ...(await readIgnoreFiles()),
    ],
    directory: ".",
    issueLimit: parseInt(getInput("issueLimit")) || 5,
  })
})()
