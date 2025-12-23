/**
 * Core types and interfaces for the CPM package manager
 */

/**
 * Represents a package dependency with version constraints
 */
export interface Dependency {
  name: string;
  versionRange: string;
  scope?: 'production' | 'development' | 'peer' | 'optional';
  registry?: string;
}

/**
 * Represents a resolved package version
 */
export interface ResolvedPackage {
  name: string;
  version: string;
  registry: string;
  downloadUrl: string;
  integrity?: string;
  dependencies: Dependency[];
}

/**
 * Represents a package manifest (package.json, pom.xml, etc.)
 */
export interface PackageManifest {
  name: string;
  version: string;
  description?: string;
  dependencies: Dependency[];
  devDependencies: Dependency[];
  peerDependencies: Dependency[];
  optionalDependencies: Dependency[];
  scripts?: Record<string, string>;
  metadata: Record<string, any>; // Format-specific metadata
}

/**
 * Represents a dependency graph
 */
export interface DependencyGraph {
  root: string;
  nodes: Map<string, GraphNode>;
}

export interface GraphNode {
  package: ResolvedPackage;
  dependencies: string[]; // Package names
  dependents: string[];   // Package names that depend on this
}

/**
 * Installation result
 */
export interface InstallResult {
  installed: ResolvedPackage[];
  updated: ResolvedPackage[];
  removed: string[];
  errors: InstallError[];
}

export interface InstallError {
  package: string;
  error: string;
  fatal: boolean;
}

/**
 * Lock file representation
 */
export interface LockFile {
  version: string;
  packages: Record<string, LockFileEntry>;
  metadata: Record<string, any>;
}

export interface LockFileEntry {
  version: string;
  resolved: string;
  integrity?: string;
  dependencies?: Record<string, string>;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  name: string;
  url: string;
  authToken?: string;
  scope?: string; // For scoped registries
}

/**
 * Forge configuration
 */
export interface ForgeConfig {
  registries: RegistryConfig[] | Record<string, any>;
  defaultRegistry: {
    node?: string; // Name of default node registry
    python?: string; // Name of default python registry
    maven?: string; // Name of default maven registry
  };
  cache: {
    directory: string;
    maxSize: string;
    ttl: number;
  };
  install: {
    parallel: number;
    retries: number;
    timeout: number;
  };
  formats: {
    [key: string]: boolean; // Enable/disable specific format plugins
  };
  pluginPriority: string[]; // Order of plugin detection priority
}

/**
 * Command context for CLI operations
 */
export interface CommandContext {
  cwd: string;
  config: ForgeConfig;
  verbose: boolean;
  dryRun: boolean;
  registryOverride?: string;
}