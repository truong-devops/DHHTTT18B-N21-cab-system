#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const servicesDir = path.join(repoRoot, 'services');
const openapiDir = path.join(repoRoot, 'docs', 'openapi');
const reportPath = path.join(openapiDir, 'openapi-sync-report.md');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function listDirs(dir) {
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name));
}

function walkFiles(dir, matcher) {
  const out = [];
  if (!exists(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, matcher));
    } else if (matcher(full)) {
      out.push(full);
    }
  }
  return out;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function resolveModule(baseDir, spec) {
  if (!spec.startsWith('.')) return null;
  let full = path.resolve(baseDir, spec);
  if (!path.extname(full)) {
    if (exists(full + '.js')) {
      full = full + '.js';
    } else if (exists(path.join(full, 'index.js'))) {
      full = path.join(full, 'index.js');
    }
  }
  if (exists(full) && fs.statSync(full).isDirectory()) {
    const idx = path.join(full, 'index.js');
    if (exists(idx)) full = idx;
  }
  return exists(full) ? full : null;
}

function collectMountPrefixes(serviceDir) {
  const candidates = [
    path.join(serviceDir, 'src', 'server.js'),
    path.join(serviceDir, 'src', 'app.js'),
    path.join(serviceDir, 'src', 'index.js'),
  ];
  const entry = candidates.find((p) => exists(p));
  if (!entry) return new Map();

  const baseDir = path.dirname(entry);
  const text = readText(entry);
  const varToModule = new Map();
  const moduleToPrefix = new Map();

  const requireRe = /\b(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"](.+?)['"]\s*\)/g;
  let match;
  while ((match = requireRe.exec(text))) {
    const varName = match[1];
    const modulePath = resolveModule(baseDir, match[2]);
    if (modulePath) varToModule.set(varName, modulePath);
  }

  const importRe = /\bimport\s+(\w+)\s+from\s+['"](.+?)['"]/g;
  while ((match = importRe.exec(text))) {
    const varName = match[1];
    const modulePath = resolveModule(baseDir, match[2]);
    if (modulePath) varToModule.set(varName, modulePath);
  }

  const useRe = /\bapp\s*\.\s*use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
  while ((match = useRe.exec(text))) {
    const prefix = match[1];
    const varName = match[2];
    const modulePath = varToModule.get(varName);
    if (modulePath) moduleToPrefix.set(modulePath, prefix);
  }

  return moduleToPrefix;
}

function joinPath(prefix, routePath) {
  if (!prefix) return routePath;
  if (prefix.endsWith('/') && routePath.startsWith('/')) {
    return prefix.slice(0, -1) + routePath;
  }
  if (!prefix.endsWith('/') && !routePath.startsWith('/')) {
    return prefix + '/' + routePath;
  }
  return prefix + routePath;
}

function parseRouterEndpoints(filePath) {
  const text = readText(filePath);
  const endpoints = [];

  const simpleRe = /\b(?:router|app)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = simpleRe.exec(text))) {
    endpoints.push({ method: match[1].toUpperCase(), path: match[2], source: filePath });
  }

  const routeRe = /\brouter\s*\.\s*route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*([\s\S]*?);/g;
  while ((match = routeRe.exec(text))) {
    const routePath = match[1];
    const chain = match[2];
    const methodRe = /\.(get|post|put|patch|delete|options|head)\s*\(/g;
    let m2;
    while ((m2 = methodRe.exec(chain))) {
      endpoints.push({ method: m2[1].toUpperCase(), path: routePath, source: filePath });
    }
  }

  const allRe = /\b(?:router|app)\s*\.\s*all\s*\(\s*([^)]*)\)/g;
  while ((match = allRe.exec(text))) {
    const args = match[1];
    const strRe = /['"`]([^'"`]+)['"`]/g;
    let m3;
    while ((m3 = strRe.exec(args))) {
      endpoints.push({ method: 'ALL', path: m3[1], source: filePath });
    }
  }

  return endpoints;
}

function parseOpenapiEndpoints(filePath) {
  const lines = readText(filePath).split(/\r?\n/);
  const endpoints = [];
  let inPaths = false;
  let currentPath = null;
  for (const line of lines) {
    if (!inPaths) {
      if (/^paths:\s*$/.test(line)) {
        inPaths = true;
      }
      continue;
    }
    if (/^\S/.test(line)) {
      if (!/^paths:/.test(line)) {
        break;
      }
    }
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    ([a-z]+):\s*$/);
    if (currentPath && methodMatch) {
      endpoints.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }
  return endpoints;
}

function uniqueKey(method, p) {
  return `${method.toUpperCase()} ${p}`;
}

function formatList(items) {
  if (!items.length) return '- (none)\n';
  return items.map((item) => `- \`${item}\`\n`).join('');
}

function main() {
  if (!exists(servicesDir)) {
    console.error('services/ not found. Run from repo root.');
    process.exit(1);
  }
  if (!exists(openapiDir)) {
    console.error('docs/openapi/ not found.');
    process.exit(1);
  }

  const serviceDirs = listDirs(servicesDir);
  const codeEndpointsByService = new Map();

  for (const serviceDir of serviceDirs) {
    const serviceName = path.basename(serviceDir);
    const routesDir = path.join(serviceDir, 'src', 'routes');
    const routeFiles = walkFiles(routesDir, (p) => p.endsWith('.js'));
    const mounts = collectMountPrefixes(serviceDir);
    const endpoints = [];
    for (const filePath of routeFiles) {
      const routeEndpoints = parseRouterEndpoints(filePath);
      const prefix = mounts.get(filePath) || '';
      for (const ep of routeEndpoints) {
        const fullPath = prefix ? joinPath(prefix, ep.path) : ep.path;
        if (!fullPath.startsWith('/')) continue;
        endpoints.push({ method: ep.method, path: fullPath, source: ep.source });
      }
    }
    if (endpoints.length) {
      codeEndpointsByService.set(serviceName, endpoints);
    }
  }

  const specFiles = walkFiles(openapiDir, (p) => p.endsWith('.openapi.yaml'));
  const specEndpointsByService = new Map();
  for (const filePath of specFiles) {
    const serviceName = path.basename(filePath).replace('.openapi.yaml', '');
    const endpoints = parseOpenapiEndpoints(filePath);
    specEndpointsByService.set(serviceName, endpoints);
  }

  const serviceNames = new Set([
    ...Array.from(codeEndpointsByService.keys()),
    ...Array.from(specEndpointsByService.keys()),
  ]);

  let report = '# OpenAPI Sync Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report +=
    'This report compares endpoints discovered from route files under `services/*/src/routes/` with OpenAPI files in `docs/openapi/`.\n\n';
  report +=
    '**Note:** mount prefixes are best-effort (parsed from `app.use(...)` in `src/server.js` / `src/app.js`). If a service mounts routes dynamically, expect false positives.\n\n';

  for (const serviceName of Array.from(serviceNames).sort()) {
    const codeEndpoints = codeEndpointsByService.get(serviceName) || [];
    const specEndpoints = specEndpointsByService.get(serviceName) || [];

    const codeSet = new Set(codeEndpoints.map((e) => uniqueKey(e.method, e.path)));
    const specSet = new Set(specEndpoints.map((e) => uniqueKey(e.method, e.path)));

    const missingInSpec = Array.from(codeSet).filter((k) => !specSet.has(k)).sort();
    const extraInSpec = Array.from(specSet).filter((k) => !codeSet.has(k)).sort();

    report += `## ${serviceName}\n\n`;
    report += `- Code endpoints: ${codeSet.size}\n`;
    report += `- Spec endpoints: ${specSet.size}\n\n`;
    report += '### Missing in spec\n';
    report += formatList(missingInSpec);
    report += '\n### Extra in spec\n';
    report += formatList(extraInSpec);
    report += '\n';
  }

  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`Report written: ${path.relative(repoRoot, reportPath)}`);
}

main();
