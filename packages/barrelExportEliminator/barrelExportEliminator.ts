import path from 'node:path';
import { glob } from 'glob';
import { readFile, writeFile } from 'node:fs/promises';
import { Dag } from 'dag';

interface Config {
  readonly ignoreModules: string[];
  readonly prefixes: Record<string, string>;
}

type BarrelFileMap = Map<
  string,
  Array<{ readonly identifier: string; readonly importPath: string }>
>;

const config: Config = JSON.parse(
  await readFile(path.resolve(__dirname, 'config.json'), 'utf8')
);

const allFiles = await glob(['src/js/**/*.tsx', 'src/js/**/*.ts']);

async function resolvePathFromImport(
  importPath: string,
  relativeFile: string
): Promise<string> {
  let resolvedPath = importPath;
  if (importPath.startsWith('.')) {
    resolvedPath = path.resolve(path.dirname(relativeFile), importPath);
  } else {
    for (const [prefix, replacement] of Object.entries(config.prefixes)) {
      if (importPath.startsWith(prefix)) {
        resolvedPath = path.resolve(path.join(replacement, importPath));
        break;
      }
    }
  }

  if (resolvedPath.startsWith('.') || resolvedPath.startsWith('/Users/')) {
    const globMatch = (
      await glob([
        resolvedPath + '.ts*',
        resolvedPath + '.d.ts*',
        resolvedPath + '/index.ts*',
      ])
    )[0];
    if (!globMatch) {
      throw new Error(
        `Could not find file for ${importPath}; checking ${resolvedPath}`
      );
    }
    resolvedPath = globMatch;
  }

  return resolvedPath;
}

const reservedWords = [
  'type',
  'class',
  'interface',
  'function',
  'const',
  'let',
  'var',
  'default',
  'declare',
  'abstract',
  'namespace',
  'module',
  'enum',
  '\\* as',
  'async',
];

/**
 * Intentionally ignores instances of `export * as <identifier> from ...`
 */
const barrelExportRegex = (identifier = '.*') =>
  new RegExp(
    `^export (type )?\\* from ('|")(?<importName>${identifier})(\\2)`,
    'gm'
  );
const singleLineExportRegex = new RegExp(
  `^export\\s+((${reservedWords.join('|')})\\s+)+(?<symbol>\\w+)\\W`,
  'gm'
);
const exportGroupRegex = /^export\s+\{(?<symbolList>[\s\w,]*)\}/gm;

const buildBarrelFileMap = async (): Promise<BarrelFileMap> => {
  const barrelFiles = new Map();

  await Promise.all(
    allFiles.map(async (file) => {
      try {
        const contents = await readFile(file, 'utf8');
        const barrelFileMatches = [
          ...contents.matchAll(barrelExportRegex()),
        ].filter(
          (match) =>
            match.groups?.['importName'] &&
            !config.ignoreModules.includes(match.groups?.['importName'])
        );
        if (barrelFileMatches.length) {
          const depsToCheck = await Promise.all(
            barrelFileMatches.map(async (match) => {
              const identifier = match.groups?.['importName'];
              if (!identifier) {
                throw new Error(
                  `Could not find identifier for ${JSON.stringify(match)}`
                );
              }
              const importPath = await resolvePathFromImport(identifier, file);
              return { importPath, identifier };
            })
          );

          barrelFiles.set(path.resolve(file), depsToCheck);
        }
      } catch (e) {
        throw new Error(`Error processing ${file}: ${e}\n`);
      }
    })
  );
  return barrelFiles;
};

const readExportsFromFile = async (file: string) => {
  const contents = await readFile(file, 'utf8');
  if (
    [...contents.matchAll(barrelExportRegex())].filter(
      (match) => !config.ignoreModules.includes(match[2])
    ).length
  ) {
    throw new Error(
      `${file} contains barrel exports. Please resolve before extracting symbols.`
    );
  }
  const exports = new Set<string>();
  for (const match of [...contents.matchAll(singleLineExportRegex)]) {
    if (match.groups?.['symbol']) {
      exports.add(match.groups?.['symbol']);
    }
  }
  for (const match of [...contents.matchAll(exportGroupRegex)]) {
    match.groups?.['symbolList']
      .split(',')
      .forEach((e) => exports.add(e.trim()));
  }
  if (!exports.size) {
    throw new Error(`found no exports in ${file}`);
  }
  return exports;
};

const updateBarrelImports =
  (barrelFileMap: BarrelFileMap) => (file: string) => async () => {
    let fileContents = await readFile(file, 'utf8');
    const deps = barrelFileMap.get(file);
    if (!deps) {
      return;
    }
    for (const dep of deps) {
      const symbols = await readExportsFromFile(dep.importPath);
      fileContents = fileContents.replace(
        barrelExportRegex(dep.identifier),
        `export { ${[...symbols].join(', ')} } from '${dep.identifier}'`
      );
    }
    await writeFile(file, fileContents);
  };

export const barrelExportEliminator = async () => {
  const barrelFileMap = await buildBarrelFileMap();
  const importUpdater = updateBarrelImports(barrelFileMap);
  const barrelDag = new Dag();
  for (const [file, deps] of barrelFileMap.entries()) {
    barrelDag.addNode(file, importUpdater(file));
    for (const dep of deps) {
      barrelDag.addNode(dep.importPath, importUpdater(dep.importPath));
      barrelDag.addEdge(dep.importPath, file);
    }
  }
  await barrelDag.runTasks();
};
