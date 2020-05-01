import mainRunner from './mainRunner'
import { issueTitle, shouldIgnore } from './helpers'
import fs from 'fs'
import path from 'path'

import { Octokit } from '@octokit/rest'

const mockDependencies = ({
  issueExists,
  referenceClosed,
  path
}: {
  issueExists: boolean
  referenceClosed: boolean
  path: string
}) => ({
  createIssue: jest.fn<
    Promise<void>,
    [Octokit.IssuesCreateParamsDeprecatedAssignee]
  >(() => Promise.resolve()),
  issueExists: jest.fn<Promise<boolean>, [string]>(() =>
    Promise.resolve(issueExists)
  ),
  issueTitle: jest.fn(issueTitle),
  shouldIgnore: jest.fn(shouldIgnore),
  exitWithReason: jest.fn<void, any>(),
  issueIsClosed: jest.fn<
    Promise<boolean>,
    [
      {
        owner: string
        repo: string
        issueNumber: string
      }
    ]
  >(() => Promise.resolve(referenceClosed)),
  labels: [] as string[],
  ignorePaths: [] as string[],
  thisOwner: 'thisOwner',
  thisRepo: 'thisRepo',
  readFile: jest.fn(fs.promises.readFile),
  path
})

const createFiles = (dirPath: string, files: { [path: string]: string }) =>
  Promise.all(
    Object.entries(files).map(([name, data]) =>
      fs.promises
        .mkdir(path.dirname(path.join(dirPath, name)), { recursive: true })
        .then(() => fs.promises.writeFile(path.join(dirPath, name), data))
    )
  )

const expectCreated = (
  deps: ReturnType<typeof mockDependencies>,
  created: string[],
  notCreated: string[]
) => {
  expect(deps.exitWithReason).toBeCalledTimes(0)
  expect(deps.createIssue).toBeCalledTimes(created.length)
  expect(deps.issueIsClosed).toBeCalledTimes(created.length + notCreated.length)

  const isClosedCalledWith = deps.issueIsClosed.mock.calls.map(
    ([{ owner, repo, issueNumber }]) =>
      RegExp(`${owner}/${repo}/.*/${issueNumber}`)
  )
  ;[...created, ...notCreated].forEach((ref) => {
    expect(isClosedCalledWith.find((pattern) => pattern.exec(ref))).toBeTruthy()
  })

  const createdIssuesWith = deps.createIssue.mock.calls.map(
    ([{ title, owner, repo }]) => {
      expect(owner).toBe(deps.thisOwner)
      expect(repo).toBe(deps.thisRepo)
      return title
    }
  )
  created.forEach((ref) => {
    expect(
      createdIssuesWith.find((title) => title.indexOf(ref) >= 0)
    ).toBeTruthy()
  })
}

describe('mainRunner works', () => {
  let dir: string

  beforeEach(async () => {
    await fs.promises.mkdtemp('test').then((path) => (dir = path))
    await createFiles(dir, {
      'src/index.js': 'github.com/testUser/testRepo/issues/1337',
      'foo.txt': 'github.com/testUser/testRepo/pull/42'
    })
  })

  afterEach(async () => {
    await fs.promises.rmdir(dir, { recursive: true })
  })

  it('should create issues for closed references', async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: true,
      path: dir
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [
        'github.com/testUser/testRepo/pull/42',
        'github.com/testUser/testRepo/issues/1337'
      ],
      []
    )
  })

  it('should not create issues for open references', async () => {
    const deps = mockDependencies({
      issueExists: false,
      referenceClosed: false,
      path: dir
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        'github.com/testUser/testRepo/pull/42',
        'github.com/testUser/testRepo/issues/1337'
      ]
    )
  })

  it('should not create issues when they already exist', async () => {
    const deps = mockDependencies({
      issueExists: true,
      referenceClosed: true,
      path: dir
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        'github.com/testUser/testRepo/pull/42',
        'github.com/testUser/testRepo/issues/1337'
      ]
    )
  })

  it('should not create issues when they already exist and references are open', async () => {
    const deps = mockDependencies({
      issueExists: true,
      referenceClosed: false,
      path: dir
    })
    await mainRunner(deps)

    expectCreated(
      deps,
      [],
      [
        'github.com/testUser/testRepo/pull/42',
        'github.com/testUser/testRepo/issues/1337'
      ]
    )
  })
})
