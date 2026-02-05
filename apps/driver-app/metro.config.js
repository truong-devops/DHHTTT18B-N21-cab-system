const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [projectRoot, path.resolve(workspaceRoot, 'node_modules')]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
]
config.resolver.disableHierarchicalLookup = true
config.resolver.extraNodeModules = {
  'hoist-non-react-statics': path.resolve(workspaceRoot, 'node_modules/hoist-non-react-statics')
}
if (config.resolver && Array.isArray(config.resolver.sourceExts)) {
  const extSet = new Set(config.resolver.sourceExts)
  extSet.add('ts')
  extSet.add('tsx')
  config.resolver.sourceExts = Array.from(extSet)
}

module.exports = config
