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

Open **GitHub → Actions → Release → Run workflow**, select **main**, choose
**patch**, **minor**, or **major**, and run the workflow. The workflow must first
be merged into the default branch to appear in Actions.

The preparation job uses the existing Nx Release configuration to update both
package versions, the plugin's exact core peer dependency, `pnpm-lock.yaml`, and
`CHANGELOG.md`. Nx derives changelog entries from conventional commits since the
previous release tag; maintenance commits are included. Nx does not commit, tag,
push, or publish. The plugin's local core development dependency uses `workspace:*`,
so preparation does not require the new core version to exist on npm yet.

GitHub Actions commits only those four files to `release/v{version}` and opens a
PR against `main`. On the PR, click **Approve workflows** to start its **Test**
checks. Review the versions and changelog, edit the changelog on the branch if
needed, and wait for the checks before merging. **Merging the PR authorizes
publication.** Closing it without merging publishes nothing.

After a release PR is merged, the publication job checks out that exact merged
commit, runs lint, unit tests, the CI suite, a full build and all integration
tests, and verifies the compiled package metadata and npm dry runs. The build
runs after versioning, so the artifacts contain the reviewed versions and exact
peer dependency. GitHub Actions then tags the merged commit as `v{version}` and
pushes only that tag. Once the tag push succeeds, npm publishes
`dist/packages/core`, then `dist/packages/eslint-plugin`, with the `latest` tag.
It never pushes a release commit directly to `main`, regenerates the approved
changelog after merge, or creates a GitHub Release page.

Only `sheriff-arch/sheriff` can prepare or publish. Preparation runs only on
`main`; publication requires a merged PR from the same repository whose head
branch exactly matches `release/v{version}`. Both package versions and the core
peer dependency must agree, and the version must not already be tagged.

Preparation and publication share a concurrency group that never cancels an
active run. `queue: max` keeps pending runs queued (up to GitHub's limit of 100),
so a new manual request cannot replace a waiting publication. Only one release
PR may be open at a time. Finish the current publication before starting another
release. Preparation refuses to proceed when the version on `main` has not been
tagged yet. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

### One-time GitHub setup

Under **Settings → Actions → General → Workflow permissions**, enable **Allow
GitHub Actions to create and approve pull requests**. The workflow only creates
PRs; it never approves or merges them. This setting is currently disabled in this
repository (verified 2026-11-18). Organization policy may require an owner to
enable it. The default workflow permission can remain read-only: each job asks
for the permissions it needs.

The preparation job requests `contents: write` for the release branch and
`pull-requests: write` to open the PR. GitHub currently creates approval-required
check runs for PRs created or updated with its built-in token. A maintainer with
write access must click **Approve workflows** in the PR's merge box. If the
release branch changes, wait for checks on its latest commit and approve any
new pending runs. No extra workflow-dispatch permission or token is needed.
See [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).

Keep the normal protection on `main`, including required reviews/checks. For an
enforced test gate, require the **build** check from the **Test** workflow. The
publication job requests only `contents: write` to push the version tag and
`id-token: write` for npm. Rules protecting `release/*` branches or `v*` tags must
permit those operations by the workflow identity; otherwise it fails without
bypassing the rules. A rejected tag push stops npm publication. No personal access
token, force-push, automatic approval, or protection changes are used.

### One-time npm package-owner setup

For **each** of `@softarc/sheriff-core` and `@softarc/eslint-plugin-sheriff`, open
the package's npm **Settings → Trusted Publisher**, choose **GitHub Actions**,
and enter:

| Setting | Value |
| --- | --- |
| Organization or user | `sheriff-arch` |
| Repository | `sheriff` |
| Workflow filename | `release.yml` (filename only) |
| Environment name | Leave empty; the workflow does not use an environment |
| Allowed actions | Allow direct publishing with `npm publish` |

Set this up shortly before the first release: npm currently expires a new trusted
publisher configuration if it has no successful publish within two days.
No `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret is needed. Publication uses a
GitHub-hosted runner, Node 24, npm 11 (at least 11.5.1), and OIDC. npm generates
provenance automatically. Both package manifests must keep their repository URL
pointing to `https://github.com/sheriff-arch/sheriff`.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the
current settings and requirements.

### Failed releases

If preparation fails after pushing the release branch, inspect the branch and
any existing PR before retrying. If the branch is correct, open the PR manually
and wait for its **Test** checks; otherwise close an obsolete PR and remove only
the stale release branch before starting a fresh preparation. Nothing has been
tagged or published during preparation.

Publication reruns are deliberately rejected. Inspect the failed step, remote
tag, and both npm versions first. If the tag was not pushed and nothing was
published, check out the approved merge, rerun all checks, and complete tagging
and publication using an authenticated maintainer session or a separately
reviewed recovery workflow. If the tag exists, rebuild that exact tag and publish
only the missing package version. Never bump again just to finish a release.
npm publishes are not atomic: core can succeed while the plugin fails, and
published versions cannot be overwritten. Keep the tag and finish the missing
publication.

The old release-please workflow, legacy Nx publish targets, and manual version
bump/publish scripts have been removed. Nx Release is the versioning authority;
GitHub Actions owns the release branch, PR and post-merge tag/publication.

## Preview release preparation locally

Start from a clean, up-to-date checkout with `origin` pointing to
`sheriff-arch/sheriff`, then install with `pnpm install --frozen-lockfile`.
Preview the same preparation used by the workflow:

```shell
pnpm exec nx release patch --skip-publish --dry-run
```

To generate the changes locally, omit `--dry-run`. With the repository's Nx
configuration, this updates the versions, peer dependency, lockfile and changelog
without creating a commit or tag, pushing, or publishing. Review `git diff` and
keep any release changes on a release branch for review.

See the [Nx release guide](https://nx.dev/docs/guides/nx-release/publish-in-ci-cd).
