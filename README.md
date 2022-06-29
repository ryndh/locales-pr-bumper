# Auto-Bumper

<details open>
<summary></summary>
<img style='width: 400px' src="bumper.gif" alt="Movie quote from GoldenEye: Use the bumper! That's what it's for"></img>
</details>

### Purpose:

If all changes for a pull request are contained within a specified directory match, automatically increment the associated versions and immediately push the change to the pull request.

### Our Usage Scenario:

Translators outside of our teams will regularly make sweeping changes that either touch many components or many repositories. They only change the translation files, which leaves developers to manually add a package.json and/or bower.json and push the changes to the pull request, repeated, depending on how sweeping a change is being made. This triggers yet another CI build, which requires waiting until the build completes.

However, running this check as a GitHub Action triggers fast enough that the initial CI build can be automatically cancelled (provided you have configured ), allowing the change including the version bump to run, instead. GitHub --> Slack notifications also appear to receive the updated pull request title in time to display as expected, as well.

## Integration:

1. If necessary, create a `.github/workflows/` directory in your repository.
2. Add a `.yml` file with the following contents as a base (we prefer to call it `auto-bumper.yml`):

```
name: Locales-Only PR Auto-Bumper

on:
  pull_request:
    types: ['opened', 'reopened', 'ready_for_review', 'review_requested']
    paths:
      - '**/locales/**'
    branches:
      - main
      - master
jobs:
  auto-bump-locales:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0
      - uses: ryndh/locales-pr-bumper@v1.0
        with:
          files: 'package.json, bower.json'

```

The above simple configuration tries to be intelligent:

- Only runs if files matching the specified path were modified
- Only runs on pull requests against main/master (and not draft pull requests)
- Will run if a pull request is subsequently marked ready for review or a review is re-requested

> The Auto-Bumper will check the list of files changes against the directory (currently hard-coded to /locales), and if no other files have been modified, will immediately push version bumps and rename the pull request title and description to be descriptive and standardized, following a format of: `[Translation] Release 1.2.3 for: ko, ja, zh`, to allow for easy squashing of the final commit.

## Questions:

- Should we have the path to check against be a global option that is passed into the `on` as well as `job` sections?
- What if a pull request is not based off of latest master?
- How do we feel about auto-merge, if CI passes?
- Should we allow developers to choose their own tag to put in the prefix brackets?
- Should we intelligently detect monorepos or pass in a flag?

## TODO:

- Add monorepo support to only modify each _closest_ package file to a change, update the pull request title to not include a specific release version, and to append the package name and version to the pull request description. Ex:

```
- conclusion: 1.2.3
- form: 2.2.2
- person: 4.5.9
```
