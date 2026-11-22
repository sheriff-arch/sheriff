import { FileTree } from '../../test/project-configurator';
import { createProject } from '../../test/project-creator';
import { generateTsData } from '../generate-ts-data';
import { FsPath, toFsPath } from '../fs-path';
import { UnassignedFileInfo } from '../unassigned-file-info';
import { tsConfig } from '../../test/fixtures/ts-config';
import { traverseFilesystem } from '../traverse-filesystem';
import { describe, it, expect } from 'vitest';
import { buildFileInfo } from '../../test/build-file-info';
import getFs from '../../fs/getFs';
import { defaultIgnoreFileExtensions } from '../../config/default-file-extensions';

function setup(fileTree: FileTree): UnassignedFileInfo {
  createProject(fileTree);

  const tsData = generateTsData(toFsPath('/project/tsconfig.json'));
  const mainPath = toFsPath('/project/src/main.ts');

  return traverseFilesystem(
    mainPath,
    new Map<FsPath, UnassignedFileInfo>(),
    tsData,
    defaultIgnoreFileExtensions,
  );
}

describe('traverse filesystem', () => {
  it('should find a single import', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': ['./app/app.component'],
        app: {
          'app.component.ts': ['./customers/customer.component'],
          customers: {
            'customer.component.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [
        ['./app/app.component.ts', ['./customers/customer.component.ts']],
      ]),
    );
  });

  it('should work with paths', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({
        paths: {
          '@customers': ['/src/app/customers/index.ts'],
        },
      }),
      src: {
        'main.ts': ['./app/app.component'],
        app: {
          'app.component.ts': ['@customers'],
          customers: {
            'index.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [
        ['./app/app.component.ts', ['./customers/index.ts']],
      ]),
    );
  });

  it('should pick up dynamic imports', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': `const routes = {[path: 'customers', loadChildren: () => import('./customers/index.ts')]};`,
        customers: {
          'index.ts': [],
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [['./customers/index.ts', []]]),
    );
  });

  it('should pick index.ts automatically if path is a directory', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({
        paths: { '@customers': ['/src/app/customers'] },
      }),
      src: {
        'main.ts': ['./app/app.component'],
        app: {
          'app.component.ts': ['@customers'],
          customers: {
            'index.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [
        ['./app/app.component.ts', ['./customers/index.ts']],
      ]),
    );
  });

  it('should automatically pick the file extension if missing in path', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({
        paths: { '@customers': ['/src/app/customers/index'] },
      }),
      src: {
        'main.ts': ['./app/app.component'],
        app: {
          'app.component.ts': ['@customers'],
          customers: {
            'index.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [
        ['./app/app.component.ts', ['./customers/index.ts']],
      ]),
    );
  });

  it('should ignore an import if a non-wildcard path is used like a wildcard', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({
        paths: { '@customers': ['/src/app/customers'] },
      }),
      src: {
        'main.ts': ['./app/app.component'],
        app: {
          'app.component.ts': ['@customers/customers.component'],
          customers: {
            'customers.component.ts': [],
            'customers.service.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [['./app/app.component.ts', []]]),
    );
  });

  it('should find a path with wildcards', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({ paths: { '@app/*': ['/src/app/*'] } }),
      src: {
        'main.ts': ['@app/app.component'],
        app: {
          'app.component.ts': ['@app/customers/customers.component'],
          customers: {
            'customers.component.ts': [],
          },
        },
      },
    });

    expect(fileInfo).toEqual(
      buildFileInfo('/project/src/main.ts', [
        ['./app/app.component.ts', ['./customers/customers.component.ts']],
      ]),
    );
  });

  describe('base url', () => {
    it('should resolve static imports', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({ baseUrl: 'src' }),
        src: {
          'main.ts': ['app/app.component.ts'],
          app: {
            'app.component.ts': [],
          },
        },
      });

      expect(fileInfo).toEqual(
        buildFileInfo('/project/src/main.ts', [['./app/app.component.ts', []]]),
      );
    });

    it('cannot resolve static imports if baseUrl is not set', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({ baseUrl: undefined }),
        src: {
          'main.ts': ['src/app/app.component.ts'],
          app: {
            'app.component.ts': [],
          },
        },
      });

      expect(fileInfo).toEqual(buildFileInfo('/project/src/main.ts', []));
    });
  });

  describe('external libraries', () => {
    it('should add external libraries', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig(),
        node_modules: {
          superlib: {
            'index.ts': [],
          },
        },
        src: {
          'main.ts': ['superlib', './util.ts'],
          'util.ts': [],
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual(['superlib']);
    });

    it('should import secondary entrypoints', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig(),
        node_modules: {
          superlib: {
            better: {
              'index.ts': [],
            },
          },
        },
        src: {
          'main.ts': ['superlib/better'],
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual(['superlib/better']);
    });

    it('should import an external library only once', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig(),
        node_modules: {
          superlib: {
            'index.ts': [],
          },
        },
        src: {
          'main.ts': ['superlib', 'superlib'],
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual(['superlib']);
    });
  });

  describe('prioritize alias over normal resolution', () => {
    it('should have an external library and and path with the same name', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({
          paths: { superlib: ['lib/index.ts'] },
        }),
        node_modules: {
          superlib: {
            'index.ts': [],
          },
        },
        src: {
          'main.ts': ['superlib'],
        },
        lib: {
          'index.ts': [],
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual([]);
      expect(fileInfo).toEqual(
        buildFileInfo('/project/src/main.ts', [['/project/lib/index.ts', []]]),
      );
    });

    it('should prioritize a path with a wildcard over an external library', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({
          paths: { 'superlib/*': ['lib/*'] },
        }),
        node_modules: {
          superlib: {
            data: {
              'calc.js': [],
            },
          },
        },
        src: {
          'main.ts': ['superlib/data/calc'],
        },
        lib: {
          data: {
            'calc.ts': [],
          },
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual([]);
      expect(fileInfo).toEqual(
        buildFileInfo('/project/src/main.ts', [
          ['/project/lib/data/calc.ts', []],
        ]),
      );
    });

    it('should fallback to default resolution if alias applies but does not match', () => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({
          paths: { 'superlib/*': ['lib/*'] },
        }),
        node_modules: {
          superlib: {
            data: {
              'index.js': [],
            },
          },
        },
        src: {
          'main.ts': ['superlib/data'],
        },
        lib: {
          calc: {
            'index.ts': [],
          },
        },
      });

      expect(fileInfo.getExternalLibraries()).toEqual(['superlib/data']);
      expect(fileInfo).toEqual(buildFileInfo('/project/src/main.ts', []));
    });
  });

  it('should recognize exports as imports', () => {
    createProject({
      'tsconfig.json': tsConfig(),
      src: {
        app: {
          'app.component.ts': [],
          customers: {
            'customer.component.ts': [],
          },
        },
      },
    });

    getFs().writeFile(
      '/project/src/app/app.component.ts',
      `export * from './customers/customer.component'`,
    );

    const tsData = generateTsData(toFsPath('/project/tsconfig.json'));
    const mainPath = toFsPath('/project/src/app/app.component.ts');

    const unassignedFileInfo = traverseFilesystem(
      mainPath,
      new Map<FsPath, UnassignedFileInfo>(),
      tsData,
      defaultIgnoreFileExtensions,
    );

    expect(unassignedFileInfo.imports).toHaveLength(1);
  });

  it.each(['', '?raw'])(
    'should respect custom ignored extensions: %s',
    (query) => {
      createProject({
        'tsconfig.json': tsConfig(),
        src: {
          'main.ts': [`./style.scss${query}`, `./info.md${query}`],
          'style.scss': [],
          'info.md': [],
        },
      });

      const tsData = generateTsData(toFsPath('/project/tsconfig.json'));
      const mainPath = toFsPath('/project/src/main.ts');

      const unassignedFileInfo = traverseFilesystem(
        mainPath,
        new Map<FsPath, UnassignedFileInfo>(),
        tsData,
        ['md'],
      );

      expect(unassignedFileInfo.imports).toEqual([]);
      expect(unassignedFileInfo.unresolvableImports).toEqual([
        `./style.scss${query}`,
      ]);
    },
  );

  it.each([
    './icon.svg?react',
    './icon.SVG?react',
    './icon.svg?url&version=1.0',
    './style.scss?inline',
  ])('should ignore asset imports with loader queries: %s', (assetImport) => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': [assetImport],
        [assetImport.split('?')[0].slice(2)]: [],
      },
    });

    expect(fileInfo.imports).toEqual([]);
    expect(fileInfo.unresolvableImports).toEqual([]);
  });

  it('should apply loader query handling only when checking ignored extensions', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': ['./module.ts?asset=.svg'],
        'module.ts': [],
      },
    });

    expect(fileInfo.imports).toEqual([]);
    expect(fileInfo.unresolvableImports).toEqual(['./module.ts?asset=.svg']);
  });
  it.each(['./icon?dark.svg', './module.ts?asset=.svg'])(
    'should use the extension of an existing literal filename: %s',
    (assetImport) => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig(),
        src: {
          'main.ts': [assetImport],
          [assetImport.slice(2)]: [],
        },
      });

      expect(fileInfo.imports).toEqual([]);
      expect(fileInfo.unresolvableImports).toEqual([]);
    },
  );

  it('should prefer an existing literal TypeScript file over a query-free asset', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': ['./module.svg?component.ts'],
        'module.svg?component.ts': [],
        'module.svg': [],
      },
    });

    expect(fileInfo.imports.map((item) => item.path)).toEqual([
      '/project/src/module.svg?component.ts',
    ]);
    expect(fileInfo.unresolvableImports).toEqual([]);
  });

  it.each(['./missing.svg?react', './missing.svg?asset=.svg'])(
    'should report a missing asset with a loader query: %s',
    (assetImport) => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig(),
        src: { 'main.ts': [assetImport] },
      });

      expect(fileInfo.imports).toEqual([]);
      expect(fileInfo.unresolvableImports).toEqual([assetImport]);
    },
  );

  it('should not treat a directory as an existing asset file', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: { 'main.ts': ['./icon.svg?react'], 'icon.svg': {} },
    });

    expect(fileInfo.unresolvableImports).toEqual(['./icon.svg?react']);
  });

  it.each(['@assets/icon?dark.svg', '@assets/icon.svg?react'])(
    'should check literal and query-free files through a wildcard alias: %s',
    (assetImport) => {
      const fileInfo = setup({
        'tsconfig.json': tsConfig({ paths: { '@assets/*': ['assets/*'] } }),
        assets: { 'icon?dark.svg': [], 'icon.svg': [] },
        src: { 'main.ts': [assetImport] },
      });

      expect(fileInfo.imports).toEqual([]);
      expect(fileInfo.unresolvableImports).toEqual([]);
    },
  );

  it('should check a query-free file through an exact alias', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({ paths: { '@logo': ['assets/icon.svg'] } }),
      assets: { 'icon.svg': [] },
      src: { 'main.ts': ['@logo?react'] },
    });

    expect(fileInfo.unresolvableImports).toEqual([]);
  });

  it('should check a query-free file relative to the importing file', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: {
        'main.ts': ['./feature/component.ts'],
        'icon.svg': [],
        feature: { 'component.ts': ['../icon.svg?react'] },
      },
    });

    expect(fileInfo.imports).toHaveLength(1);
    expect(fileInfo.imports[0].unresolvableImports).toEqual([]);
  });

  it('should check a query-free file relative to baseUrl', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig({ baseUrl: 'src' }),
      src: { 'main.ts': ['assets/icon.svg?react'], assets: { 'icon.svg': [] } },
    });

    expect(fileInfo.unresolvableImports).toEqual([]);
  });

  it('should check a query-free package asset in an ancestor node_modules', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      node_modules: { icons: { 'logo.svg': [] } },
      src: { 'main.ts': ['icons/logo.svg?react'] },
    });

    expect(fileInfo.unresolvableImports).toEqual([]);
  });

  it('should keep ignoring missing assets without a question mark', () => {
    const fileInfo = setup({
      'tsconfig.json': tsConfig(),
      src: { 'main.ts': ['./missing.svg'] },
    });

    expect(fileInfo.unresolvableImports).toEqual([]);
  });
});
