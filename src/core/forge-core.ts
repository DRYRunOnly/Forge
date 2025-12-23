import {
  ForgeConfig,
  CommandContext,
  InstallResult,
  PackageManifest,
  ResolvedPackage
} from './types';
import { PackagePlugin, PackageRegistryInfo, PackageSearchResult } from './plugin';
import { DefaultPluginManager } from './plugin-manager';
import { getLogger } from '../utils/logger';
import { saveConfig } from '../utils/config';
import { NodePlugin } from '../plugins/node-plugin';
import { PythonPlugin } from '../plugins/python-plugin';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface InstallOptions {
  packages?: string[];
  saveDev?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  registry?: string;
  format?: string;
}

export interface RemoveOptions {
  packages: string[];
  dryRun?: boolean;
  verbose?: boolean;
  format?: string;
}

export interface UpdateOptions {
  packages?: string[];
  dryRun?: boolean;
  verbose?: boolean;
  format?: string;
}

/**
 * Main Forge core class that orchestrates package management operations
 */
export class ForgeCore {
  private pluginManager = new DefaultPluginManager(this.config);
  private logger = getLogger();

  constructor(private config: ForgeConfig) {
    // Register built-in plugins
    this.pluginManager.register(new NodePlugin());
    this.pluginManager.register(new PythonPlugin());
    
    // Update plugin manager config if it changes
    this.pluginManager.setConfig(this.config);
  }

  /**
   * Install packages
   */
  async install(options: InstallOptions = {}): Promise<InstallResult> {
    const context = this.createContext(options);
    
    try {
      // Get plugin - either by format override or directory detection
      let plugin: PackagePlugin | null = null;
      
      if (options.format) {
        // User specified a format explicitly
        plugin = this.pluginManager.getPluginByFormat(options.format);
        if (!plugin) {
          throw new Error(`Unsupported format: ${options.format}. Supported formats: node, python`);
        }
        this.logger.info(`Using ${plugin.name} (format: ${options.format})`);
      } else {
        // Auto-detect project type
        plugin = await this.pluginManager.getPluginForDirectory(context.cwd);
        if (!plugin) {
          throw new Error('No plugin found for this directory. Supported formats: node, python, maven. Use --format to specify explicitly.');
        }
        this.logger.info(`Using ${plugin.name}`);
      }

      // Parse existing manifest
      const manifest = await plugin.parseManifest(context.cwd);
      
      // If specific packages are requested, create a new manifest with only those packages
      let targetManifest = manifest;
      if (options.packages && options.packages.length > 0) {
        this.logger.info(`Adding packages: ${options.packages.join(', ')}`);
        
        // Create a minimal manifest with only the requested packages
        targetManifest = {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          dependencies: [], // Start with empty dependencies
          devDependencies: [],
          peerDependencies: [],
          optionalDependencies: [],
          scripts: manifest.scripts,
          metadata: manifest.metadata
        };

        // Add the requested packages as dependencies (with latest version for now)
        for (const packageName of options.packages) {
          targetManifest.dependencies.push({
            name: packageName,
            versionRange: '*', // Use * to match any version
            scope: options.saveDev ? 'development' : 'production'
          });
        }
      }

      // Resolve dependencies
      this.logger.verbose('Resolving dependencies...');
      const dependencyGraph = await plugin.resolveDependencies(targetManifest, context);
      
      // Download packages
      const packages = Array.from(dependencyGraph.nodes.values()).map(node => node.package);
      this.logger.verbose(`Downloading ${packages.length} packages...`);
      const packagePaths = await plugin.downloadPackages(packages, context);

      // Install packages (if not dry run)
      if (context.dryRun) {
        this.logger.info('Dry run - would install:');
        packages.forEach(pkg => {
          this.logger.info(`  ${pkg.name}@${pkg.version}`);
        });
        
        return {
          installed: packages,
          updated: [],
          removed: [],
          errors: []
        };
      }

      const result = await plugin.installPackages(packagePaths, targetManifest, context);
      
      // Create/update lock file
      await plugin.createLockFile(dependencyGraph, context.cwd);

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove packages
   */
  async remove(options: RemoveOptions): Promise<InstallResult> {
    const context = this.createContext(options);

    try {
      // Get plugin - either by format override or directory detection
      let plugin: PackagePlugin | null = null;
      
      if (options.format) {
        // User specified a format explicitly
        plugin = this.pluginManager.getPluginByFormat(options.format);
        if (!plugin) {
          throw new Error(`Unsupported format: ${options.format}. Supported formats: npm, pip`);
        }
        this.logger.info(`Using ${plugin.name} (format: ${options.format})`);
      } else {
        // Auto-detect project type
        plugin = await this.pluginManager.getPluginForDirectory(context.cwd);
        if (!plugin) {
          throw new Error('No plugin found for this directory. Supported formats: node, python. Use --format to specify explicitly.');
        }
        this.logger.info(`Using ${plugin.name}`);
      }

      this.logger.info(`Removing packages: ${options.packages.join(', ')}`);

      if (context.dryRun) {
        this.logger.info('Dry run - would remove:');
        options.packages.forEach(pkg => {
          this.logger.info(`  ${pkg}`);
        });
        
        return {
          installed: [],
          updated: [],
          removed: options.packages,
          errors: []
        };
      }

      return await plugin.removePackages(options.packages, context);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update packages
   */
  async update(options: UpdateOptions): Promise<InstallResult> {
    // For now, redirect to install with existing packages but pass format
    return this.install({
      packages: options.packages,
      dryRun: options.dryRun,
      verbose: options.verbose,
      format: options.format
    });
  }

  /**
   * Search packages
   */
  async search(query: string, format?: string): Promise<PackageSearchResult[]> {
    const results: PackageSearchResult[] = [];

    if (format) {
      const plugin = this.pluginManager.getPluginByFormat(format);
      if (!plugin) {
        throw new Error(`No plugin found for format: ${format}`);
      }

      const context = this.createContext({});
      const pluginResults = await plugin.searchPackages(query, context);
      results.push(...pluginResults);
    } else {
      // Search across all plugins
      const plugins = this.pluginManager.listPlugins();
      const context = this.createContext({});

      for (const plugin of plugins) {
        try {
          const pluginResults = await plugin.searchPackages(query, context);
          results.push(...pluginResults);
        } catch (error) {
          this.logger.warn(`Search failed for ${plugin.name}:`, error);
        }
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get package information
   */
  async getPackageInfo(packageName: string): Promise<PackageRegistryInfo> {
    // Try to determine format from package name or current directory
    const plugin = await this.pluginManager.getPluginForDirectory(process.cwd());
    if (!plugin) {
      throw new Error('No plugin found for current directory');
    }

    const context = this.createContext({});
    return await plugin.getPackageInfo(packageName, context);
  }

  /**
   * List installed packages
   */
  async listInstalled(depth: number = 0): Promise<ResolvedPackage[]> {
    const plugin = await this.pluginManager.getPluginForDirectory(process.cwd());
    if (!plugin) {
      throw new Error('No plugin found for current directory');
    }

    // This would need to be implemented in the plugin interface
    // For now, return empty array
    return [];
  }

  /**
   * Get configuration value
   */
  async getConfig(key: string): Promise<any> {
    const keys = key.split('.');
    let current: any = this.config;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        throw new Error(`Configuration key not found: ${key}`);
      }
    }

    return current;
  }

  /**
   * Set configuration value
   */
  async setConfig(key: string, value: any): Promise<void> {
    const keys = key.split('.');
    let current = this.config as any;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    // Set the final value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    // Update plugin manager config if it changes
    this.pluginManager.setConfig(this.config);
    
    // Save the updated configuration to disk
    try {
      await saveConfig(this.config);
      this.logger.info(`Configuration updated and saved: ${key} = ${value}`);
    } catch (error) {
      this.logger.error(`Failed to save configuration: ${error}`);
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Set plugin detection priority order
   */
  async setPluginPriority(priority: string[]): Promise<void> {
    await this.setConfig('pluginPriority', priority);
  }

  /**
   * Get current plugin detection priority order
   */
  async getPluginPriority(): Promise<string[]> {
    return await this.getConfig('pluginPriority');
  }

  /**
   * List all configuration
   */
  async listConfig(): Promise<ForgeConfig> {
    return this.config;
  }

  /**
   * Login to a registry
   */
  async login(options: { registry?: string; token?: string }): Promise<void> {
    const defaultNpmRegistry = this.getDefaultNpmRegistry();
    const registry = options.registry || defaultNpmRegistry.url;
    
    if (!options.token) {
      throw new Error('Token is required for login. Use --token <your-token> or set FORGE_NPM_TOKEN environment variable');
    }

    // For now, we'll trust the user's token and save it
    // In a real implementation, you might want to validate against a specific auth endpoint
    try {
      // Find or create registry entry and save token
      const registries = (this.config as any).registries || {};
      let registryName = Object.keys(registries).find(name => 
        registries[name].url === registry
      );
      
      if (!registryName) {
        // Create new registry entry with a clean name
        registryName = registry
          .replace(/https?:\/\//, '')
          .replace(/\//g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
        
        registries[registryName] = {
          url: registry,
          scope: 'npm'
        };
      }
      
      registries[registryName].token = options.token;
      await this.setConfig('registries', registries);
      
      this.logger.info(`Successfully saved authentication token for ${registry}`);
      this.logger.info(`Registry saved as '${registryName}' - you can now use: forge registry set-default ${registryName}`);
    } catch (error) {
      throw new Error(`Failed to save authentication: ${error}`);
    }
  }

  /**
   * Logout from registry
   */
  async logout(options: { registry?: string; all?: boolean }): Promise<void> {
    if (options.all) {
      // Remove all tokens from all registries
      const registries = (this.config as any).registries || {};
      Object.keys(registries).forEach(name => {
        if (registries[name] && typeof registries[name] === 'object') {
          delete registries[name].token;
        }
      });
      await this.setConfig('registries', registries);
      this.logger.info('Logged out from all registries');
    } else {
      const defaultNpmRegistry = this.getDefaultNpmRegistry();
      const registry = options.registry || defaultNpmRegistry.url;
      
      // Find registry by URL and remove token
      const registries = (this.config as any).registries || {};
      const registryName = Object.keys(registries).find(name => 
        registries[name].url === registry
      );
      
      if (registryName && registries[registryName]) {
        delete registries[registryName].token;
        await this.setConfig('registries', registries);
      }
      
      this.logger.info(`Logged out from ${registry}`);
    }
  }

  /**
   * Manage registries
   */
  async manageRegistry(action: string, options: any): Promise<any> {
    const registries = (this.config as any).registries || {};
    
    switch (action) {
      case 'list':
        return Object.entries(registries).map(([key, config]: [string, any]) => ({
          name: key,
          url: typeof config === 'string' ? config : config.url,
          scope: typeof config === 'object' ? config.scope || 'npm' : 'npm',
          authenticated: typeof config === 'object' && config.token ? '✓' : '✗'
        }));
        
      case 'add':
        if (!options.name || !options.url) {
          throw new Error('Registry name and URL are required');
        }
        
        registries[options.name] = {
          url: options.url,
          scope: options.scope || 'npm',
          ...(options.token && { token: options.token })
        };
        
        await this.setConfig('registries', registries);
        this.logger.info(`Registry '${options.name}' added successfully`);
        break;
        
      case 'remove':
        if (!options.name) {
          throw new Error('Registry name is required');
        }
        
        if (!registries[options.name]) {
          throw new Error(`Registry '${options.name}' not found`);
        }
        
        delete registries[options.name];
        await this.setConfig('registries', registries);
        this.logger.info(`Registry '${options.name}' removed successfully`);
        break;
        
      case 'set-default':
        if (!options.name) {
          throw new Error('Registry name is required');
        }
        
        if (!registries[options.name]) {
          throw new Error(`Registry '${options.name}' not found`);
        }
        
        const registryConfig = registries[options.name];
        const scope = registryConfig.scope || 'npm';
        
        // Update the default registry for this scope
        await this.setConfig(`defaultRegistry.${scope}`, options.name);
        
        this.logger.info(`Default ${scope} registry set to '${options.name}' (${registryConfig.url})`);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}. Available actions: list, add, remove, set-default`);
    }
  }

  /**
   * Clear package cache
   */
  async clearCache(format?: string): Promise<{ cleared: boolean; message: string }> {
    try {
      const cacheDir = (this.config as any).cache?.directory || path.join(process.env.HOME || '/tmp', '.forge', 'cache');
      
      if (!(await fs.pathExists(cacheDir))) {
        return {
          cleared: false,
          message: 'Cache directory does not exist'
        };
      }
      
      if (format) {
        // Clear specific format cache
        const formatCacheDir = path.join(cacheDir, format);
        if (await fs.pathExists(formatCacheDir)) {
          this.logger.info(`Clearing ${format} cache directory: ${formatCacheDir}`);
          await fs.remove(formatCacheDir);
          // Recreate the format directory
          await fs.ensureDir(formatCacheDir);
          return {
            cleared: true,
            message: `${format} cache cleared successfully from ${formatCacheDir}`
          };
        } else {
          return {
            cleared: false,
            message: `No ${format} cache found`
          };
        }
      } else {
        // Clear all cache
        this.logger.info(`Clearing all cache directories: ${cacheDir}`);
        await fs.remove(cacheDir);
        // Recreate the directory
        await fs.ensureDir(cacheDir);
        return {
          cleared: true,
          message: `All caches cleared successfully from ${cacheDir}`
        };
      }
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw new Error(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * Get cache information
   */
  async getCacheInfo(format?: string): Promise<any> {
    try {
      const cacheDir = (this.config as any).cache?.directory || path.join(process.env.HOME || '/tmp', '.forge', 'cache');
      const cacheConfig = (this.config as any).cache;
      
      if (format) {
        // Get specific format cache info
        const formatCacheDir = path.join(cacheDir, format);
        let size = 0;
        let fileCount = 0;
        
        if (await fs.pathExists(formatCacheDir)) {
          const files = await this.getAllFiles(formatCacheDir);
          fileCount = files.length;
          for (const file of files) {
            const stats = await fs.stat(file);
            size += stats.size;
          }
        }
        
        return {
          format,
          directory: formatCacheDir,
          size: this.formatBytes(size),
          fileCount,
          config: cacheConfig
        };
      } else {
        // Get all cache info
        const formats = ['node', 'python', 'maven']; // Add more as needed
        const formatInfo = [];
        
        for (const fmt of formats) {
          const formatCacheDir = path.join(cacheDir, fmt);
          let size = 0;
          let fileCount = 0;
          
          if (await fs.pathExists(formatCacheDir)) {
            const files = await this.getAllFiles(formatCacheDir);
            fileCount = files.length;
            for (const file of files) {
              const stats = await fs.stat(file);
              size += stats.size;
            }
          }
          
          if (fileCount > 0) {
            formatInfo.push({
              format: fmt,
              directory: formatCacheDir,
              size: this.formatBytes(size),
              fileCount
            });
          }
        }
        
        return {
          totalDirectory: cacheDir,
          formats: formatInfo,
          config: cacheConfig
        };
      }
    } catch (error) {
      this.logger.error('Failed to get cache info:', error);
      throw new Error(`Failed to get cache info: ${error}`);
    }
  }
  
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!(await fs.pathExists(dir))) {
      return files;
    }
    
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: PackagePlugin): void {
    this.pluginManager.register(plugin);
  }

  /**
   * Create command context
   */
  private createContext(options: any): CommandContext {
    return {
      cwd: process.cwd(),
      config: this.config,
      verbose: options.verbose || false,
      dryRun: options.dryRun || false,
      registryOverride: options.registry
    };
  }

  /**
   * Get the default npm registry configuration
   */
  private getDefaultNpmRegistry(): { url: string; token?: string } {
    const registries = (this.config as any).registries || {};
    const defaultNpmName = (this.config as any).defaultRegistry?.npm || 'npm';
    const npmRegistry = registries[defaultNpmName];
    
    if (npmRegistry && typeof npmRegistry === 'object') {
      return {
        url: npmRegistry.url,
        token: npmRegistry.token
      };
    }
    
    // Fallback to npm default
    return { url: 'https://registry.npmjs.org' };
  }
}