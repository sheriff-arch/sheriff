# About Sheriff
Sheriff consists of three processes:

1. File Graph: `traverseFilesystem` gets and entry file and returns a graph of all the files that are required to run
   the entry file. The final type of the graph is `UnassignedFileInfo`, meaning graph without modules.
2. Modules: Based on `FileInfo`, `createModules` detects the existing modules and their dependencies. The final type of
   the modules is `ModuleInfo`.
3. Merging FileGraph and Modules: `FileInfo` is the final type of the graph that contains all the information about the
   files and modules. It is done by

The entry point is always the `init` function.

# Development

## Setup
Use Node.js 24 and pnpm 12.4.2 (pinned in `package.json`). To install all dependencies, run the following command:

```shell
pnpm install
```

## Run local integration tests

We can use Sheriff locally against the projects in the `test-projects`-folder in order to verify that the tool works as
expected. The following steps are required to run the tests:

1. **Build Sheriff**: `pnpm build:all`
2. **Link Sheriff**: `pnpm link:sheriff`
3. **Run the integration tests**: Execute one of the `integration-test.sh`-scripts within the tests projects or run all by executing the `run-integration-tests.sh`.

## Release through a pull request

Open **Actions → Release → Run workflow** on `main` and choose patch, minor or
major. Nx updates both package versions, the plugin's exact core peer dependency,
the lockfile as needed, and `CHANGELOG.md` from conventional commits since the
previous tag. Nx's commit, tag and push settings are disabled, including for local
`nx release` commands.

GitHub Actions commits the generated files to `release/v{version}` and opens a PR.
Review the versions and changelog, approve any pending workflow runs, and merge
when its checks pass. **Merging that release PR authorizes publication.**

After merge, the workflow checks and builds that exact merged commit, verifies
the compiled package versions and npm dry runs, tags it, and publishes
`dist/packages/core` followed by `dist/packages/eslint-plugin` to npm (`latest`).
It pushes only the tag after merge; it never pushes a release commit to `main`.
It does not create a GitHub Release page. Release runs are serialized and queued;
only one release PR may be open at a time.

### One-time setup

1. Merge this workflow into the default branch so it appears in Actions.
2. In **Settings → Actions → General → Workflow permissions**, enable **Allow
   GitHub Actions to create and approve pull requests**. The workflow creates PRs
   but never approves or merges them; default token permissions can stay read-only.
3. For both npm packages, `@softarc/sheriff-core` and
   `@softarc/eslint-plugin-sheriff`, add a **GitHub Actions** trusted publisher:

| Setting | Value |
| --- | --- |
| Organization or user | `sheriff-arch` |
| Repository | `sheriff` |
| Workflow filename | `release.yml` |
| Environment | Leave empty |
| Allowed action | Allow direct publishing with `npm publish` |

No npm token secret is required. Configure npm shortly before the first release;
new connections currently expire without a successful publish within two days.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Keep `main` protected. Rules for `release/*` branches and `v*` tags must allow the
workflow to create them. Rejected branch/tag pushes stop the workflow; protection
is never bypassed. GitHub may require **Approve workflows** on bot-created PRs;
see [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).

### Retrying a release

If publication fails **before the tag is pushed**, fix the cause and rerun its
failed job. Existing remote tags block publication reruns. Once the tag has been
pushed, inspect both npm versions and publish only the missing package version
from that exact tag using an authenticated maintainer session or a separately
reviewed recovery workflow. The two npm publishes are not atomic; never bump again
just to finish a partial publication.

If preparation left a branch without a PR, inspect it and open the PR manually,
or remove the stale branch before preparing again.

To preview version/changelog generation locally without committing or tagging:

```shell
pnpm exec nx release patch --skip-publish --dry-run
```
