const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

const config = getDefaultConfig(projectRoot)

// Limit watch scope to this app to avoid EMFILE in monorepos
config.watchFolders = [projectRoot]

// Resolve deps from app + workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
]

// Reduce filesystem traversal
config.resolver.disableHierarchicalLookup = true

module.exports = config
