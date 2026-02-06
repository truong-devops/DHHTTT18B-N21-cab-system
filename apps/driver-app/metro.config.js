const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
let withExpoRouter = null;
try {
  ({ withExpoRouter } = require('expo-router/metro'));
} catch (err) {
  withExpoRouter = null;
}

// Ensure expo-router resolves the app root in a monorepo.
if (!process.env.EXPO_ROUTER_APP_ROOT) {
  process.env.EXPO_ROUTER_APP_ROOT = 'app';
}

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withExpoRouter ? withExpoRouter(config, { appDir: 'app' }) : config;
