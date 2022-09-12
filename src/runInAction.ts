// Copyright © 2020 Patrik Neu, Ory Corp patrik@ory.sh
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
