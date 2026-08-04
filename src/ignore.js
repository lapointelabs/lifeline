import path from "node:path";

export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".open-next",
  ".nuxt",
  ".output",
  ".serverless",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".wrangler",
  ".cache",
  ".parcel-cache",
  ".venv",
  "venv",
  "__pycache__",
  "node_modules",
  "bower_components",
  "vendor",
  "coverage",
  "cdk.out",
  "dist",
  "build",
  "out",
  "target",
]);

const SOURCE_EXTENSIONS = new Set([
  ".bash",
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".cts",
  ".dart",
  ".env",
  ".ex",
  ".exs",
  ".fish",
  ".go",
  ".gradle",
  ".graphql",
  ".gql",
  ".groovy",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".ipynb",
  ".java",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".mjs",
  ".mts",
  ".php",
  ".properties",
  ".ps1",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".scala",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".tf",
  ".tfvars",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

const DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".txt", ".adoc"]);
const EXTENSIONLESS_SOURCE_FILES = new Set([
  "Dockerfile",
  "Gemfile",
  "Makefile",
  "Procfile",
  "Rakefile",
]);

function normalize(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function globBody(pattern) {
  let body = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          body += "(?:.*/)?";
          index += 2;
        } else {
          body += ".*";
          index += 1;
        }
      } else {
        body += "[^/]*";
      }
    } else if (character === "?") {
      body += "[^/]";
    } else {
      body += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return body;
}

export function compileIgnorePatterns(patterns = []) {
  return patterns
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("#"))
    .map((raw) => {
      const negated = raw.startsWith("!");
      const normalized = normalize(negated ? raw.slice(1) : raw);
      const pattern = normalized.replace(/^\//, "").replace(/\/$/, "");
      const body = globBody(pattern);
      const source = normalized.startsWith("/") || pattern.includes("/")
        ? `^${body}(?:$|/)`
        : `(?:^|/)${body}(?:$|/)`;
      return { raw, negated, regex: new RegExp(source) };
    });
}

export function isIgnored(relativePath, basename, patterns = []) {
  if (DEFAULT_IGNORED_DIRECTORIES.has(basename)) return true;
  const normalized = normalize(relativePath);
  let ignored = false;
  for (const { regex, negated } of patterns) {
    if (regex.test(normalized)) ignored = !negated;
  }
  return ignored;
}

export function isScannableFile(filename, includeDocs = false) {
  if (EXTENSIONLESS_SOURCE_FILES.has(filename)) return true;
  if (filename === ".env" || filename.startsWith(".env.")) return true;
  const extension = path.extname(filename).toLowerCase();
  if (SOURCE_EXTENSIONS.has(extension)) return true;
  return includeDocs && DOCUMENT_EXTENSIONS.has(extension);
}
