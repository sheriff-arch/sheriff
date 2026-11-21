# Releasing Sheriff

Run the [Release GitHub Action](.github/workflows/release.yml) to generate versions
and a changelog on a separate release branch and open a pull request.
After review, merging that pull request triggers tagging and npm publication,
provided publishing authentication and required permissions are configured.
See the workflow file for implementation details.
