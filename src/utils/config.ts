import { ForgeConfig, RegistryConfig } from '../core/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_CONFIG: ForgeConfig = {
  registries: {
    node: {
      url: 'https://registry.npmjs.org',
      scope: 'node',
      default: true
    },
    demo: {
      url: 'https://npm.forge.io/demo-org/demo-repo',
      scope: 'node'
    },
    pypi: {
      url: 'https://pypi.org',
      scope: 'python',
      default: true
    },
    maven_central: {
      url: 'https://repo1.maven.org/maven2',
      scope: 'maven',
      default: true
    }
  },
  defaultRegistry: {
    node: 'node',
    python: 'pypi',
    maven: 'maven_central'
  },
  cache: {
    directory: path.join(os.homedir(), '.forge', 'cache'),
    maxSize: '1GB',
    ttl: 3600000 // 1 hour
  },
  install: {
    parallel: 4,
    retries: 3,
    timeout: 30000
  },
  formats: {
    node: true,
    python: true,
    maven: true,
    cargo: false,
    composer: false,
    gem: false
  },
  pluginPriority: ['node', 'python', 'maven'] // Order of plugin detection priority
};

/**
 * Load Forge configuration from various sources
 */
export async function loadConfig(): Promise<ForgeConfig> {
  const configPaths = [
    path.join(process.cwd(), '.forgerc.json'),
    path.join(process.cwd(), 'forge.config.json'),
    path.join(os.homedir(), '.forgerc.json'),
    path.join(os.homedir(), '.config', 'forge', 'config.json')
  ];

  let config = { ...DEFAULT_CONFIG };

  // Load configuration from files
  for (const configPath of configPaths) {
    try {
      if (await fs.pathExists(configPath)) {
        const fileConfig = await fs.readJson(configPath);
        config = mergeConfig(config, fileConfig);
        break;
      }
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
    }
  }

  // Load configuration from environment variables
  config = mergeEnvironmentConfig(config);

  // Ensure cache directory exists
  await fs.ensureDir(config.cache.directory);

  return config;
}

/**
 * Save configuration to user's config file
 */
export async function saveConfig(config: ForgeConfig): Promise<void> {
  // Try to save to project-level config first (if it exists)
  const projectConfigPath = path.join(process.cwd(), '.forgerc.json');
  const userConfigDir = path.join(os.homedir(), '.config', 'forge');
  const userConfigPath = path.join(userConfigDir, 'config.json');

  try {
    // Check if project config exists, if so, update it
    if (await fs.pathExists(projectConfigPath)) {
      await fs.writeJson(projectConfigPath, config, { spaces: 2 });
      return;
    }
  } catch (error) {
    // If project config fails, fall back to user config
  }

  // Save to user config directory
  await fs.ensureDir(userConfigDir);
  await fs.writeJson(userConfigPath, config, { spaces: 2 });
}

/**
 * Merge two configuration objects
 */
function mergeConfig(base: ForgeConfig, override: Partial<ForgeConfig>): ForgeConfig {
  return {
    registries: override.registries || base.registries,
    defaultRegistry: { ...base.defaultRegistry, ...override.defaultRegistry },
    cache: { ...base.cache, ...override.cache },
    install: { ...base.install, ...override.install },
    formats: { ...base.formats, ...override.formats },
    pluginPriority: override.pluginPriority || base.pluginPriority
  };
}

/**
 * Merge environment variables into configuration
 */
function mergeEnvironmentConfig(config: ForgeConfig): ForgeConfig {
  const result = { ...config };

  // Cache directory
  if (process.env.FORGE_CACHE_DIR) {
    result.cache.directory = process.env.FORGE_CACHE_DIR;
  }

  // Cache max size
  if (process.env.FORGE_CACHE_MAX_SIZE) {
    result.cache.maxSize = process.env.FORGE_CACHE_MAX_SIZE;
  }

  // Install parallelism
  if (process.env.FORGE_INSTALL_PARALLEL) {
    const parallel = parseInt(process.env.FORGE_INSTALL_PARALLEL, 10);
    if (!isNaN(parallel)) {
      result.install.parallel = parallel;
    }
  }

  // Node Registry and token
  if (process.env.FORGE_NODE_REGISTRY) {
    if (typeof result.registries === 'object' && !Array.isArray(result.registries)) {
      const nodeRegistryName = result.defaultRegistry.node || 'node';
      if (result.registries[nodeRegistryName]) {
        result.registries[nodeRegistryName].url = process.env.FORGE_NODE_REGISTRY;
      }
    }
  }

  if (process.env.FORGE_NODE_TOKEN) {
    if (typeof result.registries === 'object' && !Array.isArray(result.registries)) {
      const nodeRegistryName = result.defaultRegistry.node || 'node';
      if (result.registries[nodeRegistryName]) {
        result.registries[nodeRegistryName].token = process.env.FORGE_NODE_TOKEN;
      }
    }
  }

  return result;
}