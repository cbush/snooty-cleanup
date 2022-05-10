import * as Path from "path";
import { find } from "find-in-files";
import util from "util";
import cbGlob from "glob";

const glob = util.promisify(cbGlob);

export async function cleanUp(path: string): Promise<void> {
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
  const fileMatches = await find(/\.\. include:: (.*)/, path, /\.(txt|rst)$/);

  // Update include file list to track actual inclusion on other files
  Object.entries(fileMatches)
    .map(([filePath, value]) => {
      return value.matches
        .map((match) => /\.\. include:: ([^\s]+)/.exec(match)?.[1] as string)
        .filter((match) => match != null)
        .map(devirtualizeFile)
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
    .forEach((x) => {
      console.log(x);
    });
}

// Some included paths are actually virtual files derived from yaml files. This
// function returns the probable original path if given a probable virtual path.
const devirtualizeFile = (path: string): string => {
  if (/\/steps\//.test(path)) {
    return path.replace("/steps/", "/steps-").replace(".rst", ".yaml");
  }
  if (/\/extracts\//.test(path)) {
    return path.replace("/extracts/", "/extracts-").replace(".rst", ".yaml");
  }
  return path;
};
