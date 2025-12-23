import {
  PackageManifest,
  Dependency,
  ResolvedPackage,
  DependencyGraph,
  InstallResult,
  LockFile,
  CommandContext
} from './types';

/**
 * Interface that all package format plugins must implement
 */
export interface PackagePlugin {
  /**
   * Plugin metadata
   */
  readonly name: string;
  readonly version: string;
  readonly supportedFormats: string[];

  /**
   * Detect if this plugin can handle the given directory
   */
  canHandle(directory: string): Promise<boolean>;

  /**
   * Parse manifest file(s) in the given directory
   */
  parseManifest(directory: string): Promise<PackageManifest>;

  /**
   * Resolve dependencies into a dependency graph
   */
  resolveDependencies(
    manifest: PackageManifest,
    context: CommandContext
  ): Promise<DependencyGraph>;

  /**
   * Download packages from registry
   */
  downloadPackages(
    packages: ResolvedPackage[],
    context: CommandContext
  ): Promise<string[]>; // Returns local file paths

  /**
   * Install downloaded packages to the target location
   */
  installPackages(
    packagePaths: string[],
    manifest: PackageManifest,
    context: CommandContext
  ): Promise<InstallResult>;

  /**
   * Remove packages from installation
   */
  removePackages(
    packageNames: string[],
    context: CommandContext
  ): Promise<InstallResult>;

  /**
   * Create/update lock file
   */
  createLockFile(
    graph: DependencyGraph,
    directory: string
  ): Promise<LockFile>;

  /**
   * Parse existing lock file
   */
  parseLockFile(directory: string): Promise<LockFile | null>;

  /**
   * Get package information from registry
   */
  getPackageInfo(
    name: string,
    context: CommandContext
  ): Promise<PackageRegistryInfo>;

  /**
   * Search packages in registry
   */
  searchPackages(
    query: string,
    context: CommandContext
  ): Promise<PackageSearchResult[]>;
}

/**
 * Package information from registry
 */
export interface PackageRegistryInfo {
  name: string;
  description?: string;
  versions: string[];
  latest: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}

/**
 * Search result from registry
 */
export interface PackageSearchResult {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  score: number;
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  /**
   * Register a plugin
   */
  register(plugin: PackagePlugin): void;

  /**
   * Get plugin for directory
   */
  getPluginForDirectory(directory: string): Promise<PackagePlugin | null>;

  /**
   * Get plugin by format name
   */
  getPluginByFormat(format: string): PackagePlugin | null;

  /**
   * Get plugin by name
   */
  getPlugin(name: string): PackagePlugin | null;

  /**
   * List all registered plugins
   */
  listPlugins(): PackagePlugin[];
}