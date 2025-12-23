import { PackagePlugin, PluginManager } from './plugin';
import { ForgeConfig } from './types';

/**
 * Default implementation of the plugin manager
 */
export class DefaultPluginManager implements PluginManager {
  private plugins: Map<string, PackagePlugin> = new Map();
  private formatPlugins: Map<string, PackagePlugin> = new Map();
  private config?: ForgeConfig;

  constructor(config?: ForgeConfig) {
    this.config = config;
  }

  setConfig(config: ForgeConfig): void {
    this.config = config;
  }

  register(plugin: PackagePlugin): void {
    this.plugins.set(plugin.name, plugin);
    
    // Register for each supported format
    for (const format of plugin.supportedFormats) {
      this.formatPlugins.set(format, plugin);
    }
  }

  async getPluginForDirectory(directory: string): Promise<PackagePlugin | null> {
    const pluginPriority = this.config?.pluginPriority || ['npm', 'pip', 'maven'];
    
    // First, try plugins in the configured priority order
    for (const formatName of pluginPriority) {
      const plugin = this.formatPlugins.get(formatName);
      if (plugin) {
        try {
          if (await plugin.canHandle(directory)) {
            return plugin;
          }
        } catch (error) {
          // Plugin check failed, continue to next plugin
          continue;
        }
      }
    }
    
    // If no priority plugin matches, try remaining plugins
    for (const plugin of this.plugins.values()) {
      // Skip if already checked in priority order
      const isInPriority = pluginPriority.some(formatName => 
        plugin.supportedFormats.includes(formatName)
      );
      if (isInPriority) continue;
      
      try {
        if (await plugin.canHandle(directory)) {
          return plugin;
        }
      } catch (error) {
        // Plugin check failed, continue to next plugin
        continue;
      }
    }
    
    return null;
  }

  getPluginByFormat(format: string): PackagePlugin | null {
    return this.formatPlugins.get(format) || null;
  }

  getPlugin(name: string): PackagePlugin | null {
    return this.plugins.get(name) || null;
  }

  listPlugins(): PackagePlugin[] {
    return Array.from(this.plugins.values());
  }
}