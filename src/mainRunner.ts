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

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d._-]+)\/(pull|issues)\/(\d+)(!!)?/gm

export type Dependencies = typeof helpers & {
  labels: Array<string>
  ignorePaths: Array<string>
  thisOwner: string
  thisRepo: string
  readFile: (path: string) => Promise<string | Buffer>
  directory: string
  issueLimit: number
}

export type Reference = {
  reference: string
  owner: string
  repo: string
  type: string
  issueNumber: string
  foundIn: [string, number][]
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
      Object.entries(files).reduce<Promise<Reference[]>[]>(
        (
          allIssues: Promise<Reference[]>[],
          [filePath, stats]: [string, fs.Stats]
        ) =>
          stats.isDirectory() ||
          shouldIgnore(ignorePaths, path.relative(directory, filePath))
            ? allIssues
            : [
                ...allIssues,
                readFile(filePath).then<Reference[]>((data): Reference[] =>
                  Array.from(data.toString().matchAll(referenceRegex)).reduce<
                    Reference[]
                  >(
                    (all, match) =>
                      match[5] != '!!'
                        ? [
                            ...all,
                            {
                              reference: match[0],
                              owner: match[1],
                              repo: match[2],
                              type: match[3],
                              issueNumber: match[4],
                              foundIn: [
                                [
                                  path.relative(directory, filePath),
                                  data
                                    .toString()
                                    .substr(0, match.index)
                                    .split('\n').length
                                ]
                              ]
                            }
                          ]
                        : all,
                    []
                  )
                )
              ],
        []
      )
    )
      .then((references) =>
        references
          .flat(1)
          // reduce filters all duplicates but adds their foundIn to the kept instance
          .reduce<Reference[]>(
            (all, ref) =>
              all
                .find((v) => v.reference === ref.reference)
                ?.foundIn.push(ref.foundIn[0]) === undefined
                ? [...all, ref]
                : all,
            []
          )
      )
      .then((references) =>
        Promise.all(
          references.map<Promise<Reference | undefined>>((ref) =>
            issueIsClosed(ref).then((closed) => (closed ? ref : undefined))
          )
        ).then((references) =>
          Promise.all(
            references.map<Promise<Reference | undefined>>(
              (ref): Promise<Reference | undefined> =>
                ref &&
                issueExists(ref.reference).then((exists) =>
                  !exists ? ref : undefined
                )
            )
          ).then((references) =>
            references.filter<Reference>(
              (ref: Reference | undefined): ref is Reference => !!ref
            )
          )
        )
      )
      .then((references) =>
        references.length > issueLimit
          ? exitWithReason(`Found too many closed references (${
              references.length
            }):

I would create too many issues, here they are:

${JSON.stringify(references, null, 2)}

To still create them, please raise the limit temporarily, e.g. by manually triggering the workflow (see https://github.com/ory/closed-reference-notifier#manual-workflow-trigger).
`)
          : references.forEach(({ foundIn, reference, type }) =>
              createIssue({
                owner: thisOwner,
                repo: thisRepo,
                labels,
                title: issueTitle(reference),
                body: issueBody(reference, type, thisOwner, thisRepo, foundIn)
              })
            )
      )
      .catch(exitWithReason)
  )

export default mainRunner
