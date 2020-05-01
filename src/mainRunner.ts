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
  issueBody
}: Dependencies) =>
  walkdir
    .async(directory, { return_object: true })
    .then((files) =>
      Promise.all(
        Object.entries(files).map<Promise<void[] | void>>(
          ([filePath, stats]: [string, fs.Stats]) =>
            stats.isDirectory() || shouldIgnore(ignorePaths, filePath)
              ? Promise.resolve()
              : readFile(filePath).then(
                  (data): Promise<void[]> =>
                    Promise.all(
                      Array.from(data.toString().matchAll(referenceRegex)).map<
                        Promise<void>
                      >(
                        ([reference, owner, repo, type, issueNumber]): Promise<
                          void
                        > =>
                          issueIsClosed({
                            owner,
                            repo,
                            issueNumber
                          }).then((isClosed) =>
                            !isClosed
                              ? Promise.resolve()
                              : issueExists(reference).then((exists: boolean) =>
                                  !exists
                                    ? createIssue({
                                        owner: thisOwner,
                                        repo: thisRepo,
                                        labels,
                                        title: issueTitle(reference),
                                        body: issueBody(
                                          reference,
                                          type,
                                          thisOwner,
                                          thisRepo,
                                          path.relative(directory, filePath)
                                        )
                                      })
                                    : Promise.resolve()
                                )
                          )
                      )
                    )
                )
        )
      )
    )
    .catch(exitWithReason)

export default mainRunner
