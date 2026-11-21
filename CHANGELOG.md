## 0.21.0 (2026-11-21)

### Package rename

- Publish `@sheriff-arch/sheriff-core` and `@sheriff-arch/eslint-plugin-sheriff`
  in place of the `@softarc` packages.
- Change `@softarc/` to `@sheriff-arch/` in imports, ESLint configuration and
  custom rule names. The CLI command and the rest of the API stay the same.

## 0.20.1 (2026-11-21)

### 🩹 Fixes

- **core:** exclude TypeScript 7 from peer dependencies ([#273](https://github.com/sheriff-arch/sheriff/pull/273))

### ❤️ Thank You

- Rainer Hahnekamp

## 0.20.0 (2026-09-29)

### 🚀 Features

- provide catch-all function to process dep rule ([#246](https://github.com/softarc-consulting/sheriff/pull/246))
- expose raw import specifiers in getProjectData ([#267](https://github.com/softarc-consulting/sheriff/pull/267), [#266](https://github.com/softarc-consulting/sheriff/issues/266))

### 🩹 Fixes

- restore RuleMatcherFn intersection type and remove redundant tos param ([#256](https://github.com/softarc-consulting/sheriff/pull/256))

### Maintenance

- upgrade dependencies to current stable versions ([#257](https://github.com/softarc-consulting/sheriff/pull/257), [#259](https://github.com/softarc-consulting/sheriff/pull/259))
- switch package manager from yarn to pnpm ([#260](https://github.com/softarc-consulting/sheriff/pull/260))
- upgrade ESLint and TypeScript tooling ([#252](https://github.com/softarc-consulting/sheriff/pull/252))
- configure local Nx release preparation ([9d911bf](https://github.com/softarc-consulting/sheriff/commit/9d911bf))

### ❤️ Thank You

- Auke
- Claude Sonnet 4.6
- Rainer Hahnekamp @rainerhahnekamp
- Sergey Durnov @sdurnov
- Дурнов Сергей Юрьевич
