const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');
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

const defaultResolveRequest = config.resolver.resolveRequest || resolve;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const normalizedName = moduleName.replace(/\.js$/, '');
  if (
    platform !== 'web' &&
    (normalizedName === 'expo-router/_ctx' ||
      normalizedName === 'expo-router/_ctx.android' ||
      normalizedName === 'expo-router/_ctx.ios' ||
      normalizedName === 'expo-router/_ctx.native')
  ) {
    const ctxFile =
      platform === 'ios' ? 'expo-router-ctx.ios.js' : 'expo-router-ctx.android.js';
    return {
      type: 'sourceFile',
      filePath: path.resolve(projectRoot, 'lib', ctxFile),
    };
  }
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(projectRoot, 'lib/mocks/react-native-maps.web.js'),
    };
  }
  return defaultResolveRequest(context, moduleName, platform);
};

module.exports = withExpoRouter ? withExpoRouter(config, { appDir: 'app' }) : config;
