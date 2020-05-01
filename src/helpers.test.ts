import { shouldIgnore } from './helpers'

describe('shouldIgnore', () => {
  const shouldIgnoreRunner = (expected: boolean) => (path: string) => {
    expect(shouldIgnore(['/foo', '/bar'], path)).toBe(expected)
  }

  test.each(['/foo', '/foo/index.txt', '/foo/subfolder/', '/bar/asdf'])(
    'should ignore "%s"',
    shouldIgnoreRunner(true)
  )

  test.each(['/notfoo', '/someFile.txt', '/foobar'])(
    'should not ignore "%s"',
    shouldIgnoreRunner(false)
  )

  it('should not ignore anything', () => {
    expect(shouldIgnore([], '/foo')).toBe(false)
  })
})
