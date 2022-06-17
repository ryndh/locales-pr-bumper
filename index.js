// Borrowed a bit of logic from here which was quite helpful: https://github.com/pocket-apps/action-update-version/blob/master/src/main.ts
const path = require('path')
const fs = require('fs')
const core = require('@actions/core')
const exec = require('@actions/exec')
const github = require('@actions/github')

const supportedFiles = ['package.json', 'bower.json']

/* TODOS:
   - Make compatible with monorepos
*/

const run = async () => {
  try {
    const files = core.getInput('files').replace(' ', '').split(',')

    if (!files.every((fileName) => supportedFiles.includes(fileName))) {
      core.info('Only supports package.json and bower.json at this time')
      return
    }
    const root = process.env.GITHUB_WORKSPACE

    const { stdout: filesChanged } = await exec.getExecOutput('git', [
      'diff',
      'origin/master...',
      '--name-only',
      '--line-prefix=`git rev-parse --show-toplevel`',
    ])

    const filesChangedToArray = filesChanged.split('\n').filter(Boolean)

    const languagesChanged = filesChangedToArray.reduce((langs, nextFile) => {
      const lang = nextFile.match(/(?<=\/)\w{2}(?=\/translation\.json)|(?<=_)\w{2}(?=\.json)/)?.[0]
      if (lang) {
        langs.add(lang)
      }
      return langs
    }, new Set())

    const justLocalesChanges = filesChangedToArray.every((filePath) => {
      const cleanedUpPath = filePath?.split('toplevel`')?.[1] || ''
      core.info(`file: ${cleanedUpPath}`)
      return filePath.includes('locales')
    })

    if (justLocalesChanges) {
      const parser = {
        read: JSON.parse,
        write: (data) => `${JSON.stringify(data, null, 2)}\n`,
      }

      core.info('Updating files version field')
      let newVersion
      files.forEach((file) => {
        const dir = path.join(root, file)
        const buffer = fs.readFileSync(dir, 'utf-8')

        const content = parser.read(buffer)

        // Might be a better way to do this.
        // Will need to be more robust if we ever want it to work with alpha, beta, etc.
        newVersion = content.version
          .split('.')
          .map((num, i) => {
            if (i !== 2) {
              return num
            }
            return parseInt(num, 10) + 1
          })
          .join('.')

        core.info(`  - ${file}: Update version from "${content.version}" to "${newVersion}"`)
        content.version = newVersion
        fs.writeFileSync(dir, parser.write(content))
      })

      core.info('Committing file changes')
      await exec.exec('git', ['config', '--global', 'user.name', 'github-actions[bot]'])
      await exec.exec('git', [
        'config',
        '--global',
        'user.email',
        '41898282+github-actions[bot]@users.noreply.github.com',
      ])
      await exec.exec('git', ['commit', '-am', `bump version`])
      await exec.exec('git', ['push'])
      updatePrTitle(newVersion, languagesChanged)
    } else {
      core.info('Version was bumped or more than locales files have changed')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function updatePrTitle(version, langs) {
  const token = core.getInput('token', { required: true })
  const pr = github.context.payload.pull_request.number
  const owner = github.context.repo.owner
  const repo = github.context.repo.repo
  const octokit = github.getOctokit(token)

  const langsString = ` (${[...langs]?.join(', ')}),`

  const req = {
    owner,
    repo,
    pull_number: pr,
    title: `[Translations] Update translations${langs ? langsString : ','} bump to version ${version}`,
    body: '',
  }

  await octokit.rest.pulls.update(req)
}

run()
