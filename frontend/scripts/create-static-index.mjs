import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), ".output", "public");
const assetsDir = join(publicDir, "assets");
const assets = await readdir(assetsDir);
const entry = assets.find((file) => /^index-[^/]+\.js$/.test(file));
const stylesheet = assets.find((file) => /^styles-[^/]+\.css$/.test(file));

if (!entry) throw new Error("Could not find the frontend browser entrypoint.");

const stylesheetTag = stylesheet
  ? `    <link rel="stylesheet" href="/assets/${stylesheet}" />\n`
  : "";
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Split Table</title>
${stylesheetTag}  </head>
  <body>
    <script type="module" src="/assets/${entry}"></script>
  </body>
</html>
`;

await writeFile(join(publicDir, "index.html"), html);
