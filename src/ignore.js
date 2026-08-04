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
  ".env",
  ".fish",
  ".go",
  ".graphql",
  ".gql",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".kt",
  ".kts",
  ".mjs",
  ".mts",
  ".php",
  ".properties",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svelte",
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
        body += ".*";
        index += 1;
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
      const pattern = normalize(raw).replace(/\/$/, "");
      const body = globBody(pattern);
      const source = pattern.includes("/")
        ? `^${body}(?:$|/)`
        : `(?:^|/)${body}(?:$|/)`;
      return { raw, regex: new RegExp(source) };
    });
}

export function isIgnored(relativePath, basename, patterns = []) {
  if (DEFAULT_IGNORED_DIRECTORIES.has(basename)) return true;
  const normalized = normalize(relativePath);
  return patterns.some(({ regex }) => regex.test(normalized));
}

export function isScannableFile(filename, includeDocs = false) {
  if (EXTENSIONLESS_SOURCE_FILES.has(filename)) return true;
  if (filename === ".env" || filename.startsWith(".env.")) return true;
  const extension = path.extname(filename).toLowerCase();
  if (SOURCE_EXTENSIONS.has(extension)) return true;
  return includeDocs && DOCUMENT_EXTENSIONS.has(extension);
}
