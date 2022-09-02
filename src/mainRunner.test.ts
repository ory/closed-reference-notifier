import mainRunner, { Reference } from "./mainRunner"
import { issueBody, issueIsClosed, issueTitle, shouldIgnore } from "./helpers"
import fs from "fs"
import path from "path"

import { Octokit } from "@octokit/rest"

const mockDependencies = ({
  issueExists,
  referenceClosed,
  path,
  issueLimit = 10,
}: {
  issueExists: boolean
  referenceClosed: boolean
  path: string
  issueLimit?: number
}) => ({
  createIssue: jest.fn<Promise<void>, [Octokit.IssuesCreateParams]>(() =>
    Promise.resolve(),
  ),
  issueExists: jest.fn<Promise<boolean>, [string]>(() =>
    Promise.resolve(issueExists),
  ),
  issueTitle: jest.fn(issueTitle),
  issueBody: jest.fn(issueBody),
  shouldIgnore: jest.fn(shouldIgnore),
  exitWithReason: jest.fn<void, any>(),
  issueIsClosed: jest.fn<Promise<boolean>, [Reference]>(() =>
    Promise.resolve(referenceClosed),
  ),
  labels: [] as string[],
  ignorePaths: [] as string[],
  thisOwner: "thisOwner",
  thisRepo: "thisRepo",
  issueLimit,
  readFile: jest.fn(fs.promises.readFile),
  directory: path,
})

const createFiles = (dirPath: string, files: { [path: string]: string }) =>
  Object.entries(files).forEach(([name, data]) => {
    const filePath = path.join(dirPath, name)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, data)
  })

const expectCreated = (
  deps: ReturnType<typeof mockDependencies>,
  created: string[],
  notCreated: string[],
) => {
  if (deps.exitWithReason.mock.calls.length != 0) {
    console.log(deps.exitWithReason.mock.calls)
  }
  expect(deps.exitWithReason).toBeCalledTimes(0)
  expect(deps.createIssue).toBeCalledTimes(created.length)
  expect(deps.issueIsClosed).toBeCalledTimes(created.length + notCreated.length)

  const isClosedCalledWith = deps.issueIsClosed.mock.calls.map(
    ([{ owner, repo, issueNumber }]) =>
      RegExp(`${owner}/${repo}/.*/${issueNumber}`),
  )
  ;[...created, ...notCreated].forEach((ref) => {
    expect(isClosedCalledWith.find((pattern) => pattern.exec(ref))).toBeTruthy()
  })

  const createdIssuesWith = deps.createIssue.mock.calls.map(
    ([{ title, owner, repo, body }]) => {
      expect(owner).toBe(deps.thisOwner)
      expect(repo).toBe(deps.thisRepo)
      expect(body).toBeDefined()
      return title
    },
  )
  created.forEach((ref) => {
    expect(
      createdIssuesWith.find((title) => title.indexOf(ref) >= 0),
    ).toBeTruthy()
  })
}

const expectFail = (
  deps: ReturnType<typeof mockDependencies>,
  partialMessage: string,
) => {
  expect(deps.exitWithReason).toBeCalledTimes(1)
  expect(deps.exitWithReason.mock.calls[0][0]).toContain(partialMessage)
}

describe("mainRunner works", () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync("test")
    createFiles(dir, {
      "src/index.js": "github.com/testUser/testRepo/issues/1337",
      "foo.txt": "github.com/testUser/testRepo/pull/42",
    })
  })

  afterEach(() => {
    fs.rmdirSync(dir, { recursive: true })
  })

  it("should create issues for closed references", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir,
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
      [],
    )
  })

  it("should not create issues for open references", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: false,
      path: dir,
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
    )
  })

  it("should not create issues when they already exist", async () => {
    const deps = mockDependencies({
      issueExists: true,
      referenceClosed: true,
      path: dir,
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
    )
  })

  it("should not create issues when they already exist and references are open", async () => {
    const deps = mockDependencies({
      issueExists: true,
      referenceClosed: false,
      path: dir,
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
    )
  })

  it("should not create issues when there are more open references than the limit", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir,
      issueLimit: 1,
    })
    await mainRunner(deps)

    expectFail(deps, "too many closed references")
  })

  it("should not fail when there are more closed references than the limit", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: false,
      path: dir,
      issueLimit: 1,
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
    )
  })

  it("should accumulate multiple instances of the same reference", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir,
      issueLimit: 2,
    })
    createFiles(dir, {
      "bar.txt": "github.com/testUser/testRepo/pull/42",
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
      [],
    )

    expect(deps.issueBody.mock.calls[0][4]).toStrictEqual([
      ["bar.txt", 1],
      ["foo.txt", 1],
    ])
  })

  it("should find multiple references in one file", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir,
      issueLimit: 4,
    })
    createFiles(dir, {
      "bar.txt":
        "github.com/testUser/testRepo/pull/420\ngithub.com/ory/closed-reference-notifier/issues/13",
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
        "github.com/testUser/testRepo/pull/420",
        "github.com/ory/closed-reference-notifier/issues/13",
      ],
      [],
    )
  })

  it("should ignore references with double exclamation mark", async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir,
      issueLimit: 4,
    })
    createFiles(dir, {
      "bar.txt": "github.com/testUser/testRepo/pull/420!!",
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [
        "github.com/testUser/testRepo/pull/42",
        "github.com/testUser/testRepo/issues/1337",
      ],
      [],
    )
  })
})
