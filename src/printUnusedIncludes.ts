import * as Path from "path";
import { find } from "find-in-files";
import util from "util";
import cbGlob from "glob";

const glob = util.promisify(cbGlob);

export async function printUnusedIncludes(path: string): Promise<void> {
  // Find all files in the includes directories
  const includesDirectory = Path.join(path, "includes");
  const globPattern = Path.join(includesDirectory, "**/*.@(rst|yaml|txt)");
  const entries = (await glob(globPattern)).map((path) => [
    path,
    new Set<string>(),
  ]);
  const includeFiles = Object.fromEntries(entries) as {
    [filePath: string]: Set<string>;
  };

  // Find instances of includes in files
  const fileMatches = await find(
    /\.\. include:: (.*)/,
    path,
    /\.(txt|rst|ya?ml)$/
  );

  // Update include file list to track actual inclusion on other files
  Object.entries(fileMatches)
    .map(([filePath, value]) => {
      return value.matches
        .map((match) => /\.\. include:: ([^\s]+)/.exec(match)?.[1] as string)
        .filter((match) => match != null)
        .map(devirtualizeFile)
        .flat(1)
        .map((filePath) => Path.join(path, filePath))
        .map((match) => ({ filePath: match, includedFrom: filePath }));
    })
    .flat(1)
    .forEach(({ filePath, includedFrom }) => {
      if (includeFiles[filePath] === undefined) {
        includeFiles[filePath] = new Set<string>();
      }
      includeFiles[filePath].add(includedFrom);
    });

  // Print unused includes
  Object.entries(includeFiles)
    .filter(([, value]) => value.size === 0)
    .map(([key]) => key)
    .flat(1)
    .forEach((unusedFilePath) => {
      console.log(unusedFilePath);
    });
}

// Some included paths are actually virtual files derived from yaml files. This
// function returns the probable original paths if given a probable virtual path.
const devirtualizeFile = (path: string): string[] => {
  if (/\/steps\//.test(path)) {
    const realPath = path.replace("/steps/", "/steps-");
    return [
      realPath.replace(".rst", ".yaml"),
      realPath.replace(".rst", ".yml"),
      realPath.replace(".txt", ".yaml"),
      realPath.replace(".txt", ".yml"),
    ];
  }
  if (/\/extracts\//.test(path)) {
    const possiblePath = path
      .replace("/extracts/", "/extracts-")
      .replace(".rst", "");
    const dirname = Path.dirname(possiblePath);
    const basename = Path.basename(possiblePath);
    const possibleNames = basename.split("-");
    // Generate a path for each possible name by building up the pieces of the
    // name. For example: "extracts-example-la-di-da" might come from
    // "extracts-example", "extracts-example-la", "extracts-example-la-di", etc.
    return possibleNames
      .map((_, i) => Path.join(dirname, possibleNames.slice(0, i).join("-")))
      .map((name) => [`${name}.yaml`, `${name}.yml`])
      .flat(1);
  }
  return [path, path.replace(".rst", ".txt")];
};
