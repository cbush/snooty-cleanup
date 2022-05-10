import { printUnusedIncludes } from "./printUnusedIncludes";
import * as yargs from "yargs";

async function main() {
  const args = yargs
    .help()
    .usage("Usage: $0 [options] <paths..>")
    .demandCommand().argv;
  const paths = args._;
  const promises = paths.map(async (path) => {
    await printUnusedIncludes(path as string);
  });
  await Promise.allSettled(promises);
}

main().catch(console.error);
