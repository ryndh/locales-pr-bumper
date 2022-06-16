const path = require('path')
const fs = require('fs')
const core = require('@actions/core')
const exec = require('@actions/exec')

const supportedFiles = ['package.json', 'bower.json']

const run = async () => {
  try {
    const files = core.getInput('files').replace(' ', '').split(',')

    if (!files.every((fileName) => supportedFiles.includes(fileName))) {
      core.info('Only supports package.json and bower.json at this time')
    }
    const root = process.env.GITHUB_WORKSPACE

    const { stdout: filesChanged } = await exec.getExecOutput('git', [
      'diff',
      'origin/master...',
      '--name-only',
      '--line-prefix=`git rev-parse --show-toplevel`',
    ])

    const filesChangedToArray = filesChanged.split('\n').filter(Boolean)

    const justLocalesChanges = filesChangedToArray.every((filePath) => {
      console.log('path', filePath)
      return filePath.includes('locales')
    })

    if (justLocalesChanges) {
      const parser = {
        read: JSON.parse,
        write: (data) => JSON.stringify(data, null, 2),
      }

      core.info('Updating files version field')
      files.forEach((file) => {
        const dir = path.join(root, file)
        const buffer = fs.readFileSync(dir, 'utf-8')

        const content = parser.read(buffer)

        const newVersion = content.version
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
    } else {
      core.info('Version was bumped or more than locales files have changed')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
