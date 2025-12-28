import { promises as fsp } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const root = path.resolve(projectRoot, "public", "assets");
const outTs = path.resolve(projectRoot, "src", "assetsManifest.ts");

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full)));
    } else if (/\.(png|jpg|jpeg|gif)$/i.test(entry.name)) {
      const posixFull = full.replace(/\\/g, "/");
      const idx = posixFull.toLowerCase().lastIndexOf("/public/");
      const rel = idx >= 0 ? posixFull.substring(idx + "/public/".length) : path.relative(path.resolve(process.cwd(), "public"), full).replace(/\\/g, "/");
      results.push(`/${rel}`);
    }
  }
  return results;
}

async function main() {
  try {
    const urls = await walk(root);
    const ts = `// Auto-generated. Run npm run assets:gen to update.\nexport const ASSET_URLS = ${JSON.stringify(urls, null, 2)} as const;\n`;
    await fsp.writeFile(outTs, ts, "utf8");
    console.log(`Wrote manifest with ${urls.length} assets to`, outTs);
  } catch (err) {
    console.error("Failed to generate assets manifest:", err);
    process.exit(1);
  }
}

main();
