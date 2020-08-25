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

import helpers from './helpers'
import fs from 'fs'
import walkdir from 'walkdir'
import path from 'path'

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm

export type Dependencies = typeof helpers & {
  labels: Array<string>
  ignorePaths: Array<string>
  thisOwner: string
  thisRepo: string
  readFile: (path: string) => Promise<string | Buffer>
  directory: string
  issueLimit: number
}

type IssuePayload = {
  relativePath: string
  reference: string
  type: string
}

const mainRunner = ({
  shouldIgnore,
  exitWithReason,
  issueTitle,
  createIssue,
  issueExists,
  labels,
  thisOwner,
  thisRepo,
  readFile,
  ignorePaths,
  issueIsClosed,
  directory,
  issueBody,
  issueLimit
}: Dependencies) =>
  walkdir.async(directory, { return_object: true }).then((files) =>
    Promise.all(
      Object.entries(files).reduce<Promise<IssuePayload[]>[]>(
        (
          allIssues: Promise<IssuePayload[]>[],
          [filePath, stats]: [string, fs.Stats]
        ) =>
          stats.isDirectory() ||
          shouldIgnore(ignorePaths, path.relative(directory, filePath))
            ? allIssues
            : [
                ...allIssues,
                readFile(filePath).then<IssuePayload[]>(
                  (data): Promise<IssuePayload[]> =>
                    Promise.all(
                      Array.from(data.toString().matchAll(referenceRegex)).map<
                        Promise<IssuePayload | undefined>
                      >(([reference, owner, repo, type, issueNumber]) =>
                        issueIsClosed({
                          owner,
                          repo,
                          issueNumber
                        }).then(
                          (isClosed): Promise<IssuePayload | undefined> =>
                            !isClosed
                              ? undefined
                              : issueExists(reference).then((exists: boolean) =>
                                  !exists
                                    ? {
                                        reference,
                                        type,
                                        relativePath: path.relative(
                                          directory,
                                          filePath
                                        )
                                      }
                                    : undefined
                                )
                        )
                      )
                    )
                )
              ],
        []
      )
    )
      .then((issues) => issues.flat(1).filter((i) => i))
      .then((issues) =>
        issues.length > issueLimit
          ? exitWithReason(`Found too many closed references (${issues.length}):

I would create too many issues, here they are:

${JSON.stringify(issues)}

To still create them, please raise the limit temporarily, e.g. by manually triggering the workflow (see https://github.com/ory/closed-reference-notifier#manual-workflow-trigger).
`)
          : issues.forEach(({ relativePath, reference, type }) =>
              createIssue({
                owner: thisOwner,
                repo: thisRepo,
                labels,
                title: issueTitle(reference),
                body: issueBody(
                  reference,
                  type,
                  thisOwner,
                  thisRepo,
                  relativePath
                )
              })
            )
      )
      .catch(exitWithReason)
  )

export default mainRunner
