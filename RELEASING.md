# Releasing Sheriff

Run the [Release GitHub Action](.github/workflows/release.yml) to generate versions
and a changelog on a separate release branch and open a pull request.
After review, merging that pull request tags the release, stages both packages on npm,
and publishes a GitHub Release with the changelog.
Approve both packages under **Staged Packages** on npm with two-factor authentication to publish the npm packages.
The workflow requires npm trusted publishing configured for GitHub Actions.
See the workflow file for implementation details.
