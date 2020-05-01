import helpers from './helpers'
import fs from 'fs'
import walkdir from 'walkdir'

const referenceRegex = /github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d.-_]+)\/(pull|issues)\/(\d+)/gm

export type Dependencies = typeof helpers & {
  labels: Array<string>
  ignorePaths: Array<string>
  thisOwner: string
  thisRepo: string
  readFile: (path: string) => Promise<string | Buffer>
  path: string
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
  path
}: Dependencies) =>
  walkdir
    .async(path, { return_object: true })
    .then((files) =>
      Promise.all(
        Object.entries(files).map<Promise<void[] | void>>(
          ([path, stats]: [string, fs.Stats]) =>
            stats.isDirectory() || shouldIgnore(ignorePaths, path)
              ? Promise.resolve()
              : readFile(path).then(
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
                                        title: issueTitle(reference)
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
