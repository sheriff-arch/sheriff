import { UnassignedFileInfo } from './unassigned-file-info';
import getFs from '../fs/getFs';
import * as ts from 'typescript';
import { TsData } from './ts-data';
import { FsPath } from './fs-path';
import { resolvePotentialTsPath } from './resolve-potential-ts-path';
import { fixPathSeparators } from './fix-path-separators';

export type ResolveFn = (
  moduleName: string,
) => ReturnType<typeof ts.resolveModuleName>;

// https://stackoverflow.com/questions/71815527/typescript-compiler-apihow-to-get-absolute-path-to-source-file-of-import-module
/**
 * This function generates the FileInfo tree.
 * It starts with the entry TypeScript file and traverse all its imports.
 *
 * It does not follow an import when it is an external library, i.e. comes from
 * node_modules. The same is true, if a file is already traversed.
 *
 * To improve the testability, we use abstraction whenever access to the
 * filesystem happens. In case the abstraction does not emulate the original's
 * behaviour, "strange bugs" might occur. Look out for them.
 *
 * fixPathSeparators is necessary to replace the static '/' path separator
 * with the one from the OS.
 *
 * @param fsPath Filename to traverse from
 * @param fileInfoDict Dictionary of traversed files to catch circularity
 * @param tsData
 * @param ignoreFileExtensions Array of file extensions to ignore
 * @param runOnce traverse only once. needed for ESLint mode
 * @param fileContent if passed, is used instead the content of @fsPath.
 * necessary for unsaved files inESLint
 */
export function traverseFilesystem(
  fsPath: FsPath,
  fileInfoDict: Map<FsPath, UnassignedFileInfo>,
  tsData: TsData,
  ignoreFileExtensions: string[],
  runOnce = false,
  fileContent?: string,
): UnassignedFileInfo {
  const { paths, sys, rootDir, baseUrl, configObject } = tsData;
  const fileInfo: UnassignedFileInfo = new UnassignedFileInfo(fsPath, []);
  fileInfoDict.set(fsPath, fileInfo);
  const fs = getFs();
  fileContent = fileContent ?? fs.readFile(fsPath);
  const preProcessedFile = ts.preProcessFile(fileContent);

  const config = { ...configObject.options, baseUrl };

  const resolveFn: ResolveFn = (moduleName: string) =>
    ts.resolveModuleName(moduleName, fsPath, config, sys);

  for (const importedFile of preProcessedFile.importedFiles) {
    const { fileName } = importedFile;
    // skip configured ignored extensions early
    const extensionPath = fileName.includes('?')
      ? (resolveImportFile(fileName, fsPath, tsData) ??
        resolveImportFile(fileName.split('?')[0], fsPath, tsData))
      : fileName;
    const fileExtension = extensionPath?.split('.').pop()?.toLowerCase();
    if (fileExtension && ignoreFileExtensions.includes(fileExtension)) {
      continue;
    }
    const resolvedImport = resolveFn(fileName);
    let importPath: FsPath | undefined;

    // alias/path resolving has priority
    const resolvedTsPath = resolvePotentialTsPath(fileName, paths, resolveFn);

    if (resolvedTsPath) {
      importPath = resolvedTsPath;
    }

    // check if external library or normal file
    else if (resolvedImport.resolvedModule) {
      const { resolvedFileName } = resolvedImport.resolvedModule;
      if (!resolvedImport.resolvedModule.isExternalLibraryImport) {
        importPath = fixPathSeparators(resolvedFileName);
        if (!importPath.startsWith(rootDir)) {
          throw new Error(`${importPath} is outside of root ${rootDir}`);
        }
      } else {
        fileInfo.addExternalLibrary(fileName);
      }
    }

    // might be an undetected dependency in node_modules
    // or an incomplete import (= developer is still typing),
    // if we read from an unsaved file via ESLint.
    else {
      fileInfo.addUnresolvableImport(fileName);
    }

    if (importPath) {
      const existing = fileInfoDict.get(importPath);
      if (existing) {
        fileInfo.addImport(existing, fileName);
      } else if (runOnce) {
        fileInfo.addImport(new UnassignedFileInfo(importPath), fileName);
      } else {
        fileInfo.addImport(
          traverseFilesystem(
            importPath,
            fileInfoDict,
            tsData,
            ignoreFileExtensions,
          ),
          fileName,
        );
      }
    }
  }

  return fileInfo;
}

// Asset files need not resolve as TypeScript modules. Check literal files before
// interpreting a question mark as a loader query, without changing resolution.
function resolveImportFile(
  fileName: string,
  importer: FsPath,
  { paths, baseUrl }: TsData,
): FsPath | undefined {
  const fs = getFs();
  const existingFile = (path: string): FsPath | undefined =>
    fs.exists(path) && fs.isFile(path) ? path : undefined;

  if (fs.isAbsolute(fileName)) {
    return existingFile(fileName);
  }
  if (fileName.startsWith('./') || fileName.startsWith('../')) {
    return existingFile(fs.join(fs.getParent(importer), fileName));
  }

  const exactAlias = paths[fileName];
  if (exactAlias) {
    const file = existingFile(exactAlias);
    if (file) return file;
  }
  const wildcardAliases = Object.entries(paths)
    .filter(([alias]) => alias.endsWith('/*'))
    .sort(([left], [right]) => right.length - left.length);
  for (const [alias, target] of wildcardAliases) {
    const prefix = alias.slice(0, -1);
    if (fileName.startsWith(prefix)) {
      const file = existingFile(fs.join(target, fileName.slice(prefix.length)));
      if (file) return file;
    }
  }

  if (baseUrl) {
    const file = existingFile(fs.join(baseUrl, fileName));
    if (file) return file;
  }
  let directory = fs.getParent(importer);
  while (true) {
    const file = existingFile(fs.join(directory, 'node_modules', fileName));
    if (file) return file;
    const parent = fs.getParent(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}
