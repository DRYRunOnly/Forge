export * from './core/types';
export * from './core/plugin';
export * from './core/plugin-manager';
export * from './core/forge-core';
export * from './utils/config';
export * from './utils/logger';

// Re-export main classes for easy importing
export { ForgeCore } from './core/forge-core';
export { DefaultPluginManager } from './core/plugin-manager';
export { loadConfig, saveConfig } from './utils/config';
export { setupLogger, getLogger } from './utils/logger';