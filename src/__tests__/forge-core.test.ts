import { ForgeCore } from '../core/forge-core';
import { loadConfig } from '../utils/config';

describe('ForgeCore', () => {
  let forgeCore: ForgeCore;

  beforeEach(async () => {
    const config = await loadConfig();
    forgeCore = new ForgeCore(config);
  });

  it('should initialize correctly', () => {
    expect(forgeCore).toBeInstanceOf(ForgeCore);
  });

  it('should handle missing plugins gracefully', async () => {
    // Since ForgeCore auto-registers built-in plugins, test with a non-existent directory
    // where no plugins can handle the project type
    const emptyConfig = {
      registries: {},
      defaultRegistry: {},
      cache: { directory: '~/.forge/cache', maxSize: '1GB', ttl: 3600 },
      install: { parallel: 4, retries: 3, timeout: 30000 },
      formats: {},
      pluginPriority: []
    };
    const emptyForgeCore = new ForgeCore(emptyConfig);
    
    // Test by changing to a directory that doesn't exist and has no supported files
    const originalCwd = process.cwd();
    try {
      // Mock process.cwd to return a path that no plugin can handle
      const originalProcessCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/nonexistent/empty/directory');
      
      await expect(emptyForgeCore.getPackageInfo('test-package')).rejects.toThrow(
        'No plugin found for current directory'
      );
      
      process.cwd = originalProcessCwd;
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  });

  it('should return search results when plugins are available', async () => {
    const results = await forgeCore.search('lodash');
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // Should find some lodash packages
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('version');
  });

  it('should load configuration', async () => {
    const config = await forgeCore.listConfig();
    expect(config).toBeDefined();
    expect(config.registries).toBeDefined();
    expect(typeof config.registries).toBe('object');
    expect(Object.keys(config.registries).length).toBeGreaterThan(0);
  });
});