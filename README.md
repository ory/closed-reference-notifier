# Closed Reference Notifier Action

A GitHub action to open an issue when GitHub references in your code are closed.
These could be references to open pull requests or issues.

Quite often you will have references like this one in your code:

```js
// workaround for https://github.com/ory/kratos/issues/364
dsn = `${dsn}&multiStatements=true`
```

You will then either have to remind yourself to check back
or (more likely) you will stumble across the comment some time later to manually
check whether the issue got fixed.
This simple GitHub actions searches your whole repository for references to GitHub pulls and issues.
When it finds a closed reference it will open an issue in your repository.
That way you will automatically be reminded to check back on the reference.

## Configuration

We recommend having this action run regularly e.g. daily. To enable access to the GitHub API
you have to set the token input (see below).

All other inputs are optional.

Key | Description | Default value
--- | --- | ---
ignore | ignore paths, comma seperated list | .git
issueLabels | the labels to create issues with, comma seperated list | closed reference

Verbose example with all inputs:

```yaml
on:
  schedule:
  - cron: '0 7 * * *'

jobs:
  find_closed_references:
    runs-on: ubuntu-latest
    name: Find closed references
    steps:
      - uses: actions/checkout@v2
      - uses: ory/closed-reference-notifier@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ignore: .git
          issueLabels: closed reference
```
