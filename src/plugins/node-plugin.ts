import {
  PackagePlugin,
  PackageRegistryInfo,
  PackageSearchResult
} from '../core/plugin';
import {
  PackageManifest,
  Dependency,
  ResolvedPackage,
  DependencyGraph,
  GraphNode,
  InstallResult,
  LockFile,
  LockFileEntry,
  CommandContext
} from '../core/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import * as semver from 'semver';
import * as tar from 'tar';
import { getLogger } from '../utils/logger';

interface NpmPackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: any;
}

interface NpmRegistryPackage {
  name: string;
  description?: string;
  'dist-tags': {
    latest: string;
    [tag: string]: string;
  };
  versions: {
    [version: string]: {
      name: string;
      version: string;
      description?: string;
      main?: string;
      deprecated?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      dist: {
        tarball: string;
        shasum: string;
        integrity?: string;
      };
    };
  };
  time: {
    [version: string]: string;
  };
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  license?: string;
  keywords?: string[];
}

/**
 * npm package manager plugin
 */
export class NodePlugin implements PackagePlugin {
  readonly name = 'Node plugin';
  readonly version = '1.0.0';
  readonly supportedFormats = ['node', 'nodejs', 'javascript'];

  private logger = getLogger();

  async canHandle(directory: string): Promise<boolean> {
    const packageJsonPath = path.join(directory, 'package.json');
    return await fs.pathExists(packageJsonPath);
  }

  async parseManifest(directory: string): Promise<PackageManifest> {
    const packageJsonPath = path.join(directory, 'package.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      // Allow usage in directories without an existing package.json,
      // for scenarios like `forge install lodash` in a fresh folder.
      // We create a minimal in-memory manifest; Forge does not
      // modify or create package.json itself.
      this.logger.verbose('package.json not found, using synthetic manifest');

      return {
        name: path.basename(directory) || 'forge-project',
        version: '1.0.0',
        description: undefined,
        dependencies: [],
        devDependencies: [],
        peerDependencies: [],
        optionalDependencies: [],
        scripts: {},
        metadata: {
          generatedBy: 'forge',
          synthetic: true
        }
      };
    }

    const packageJson: NpmPackageJson = await fs.readJson(packageJsonPath);

    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      dependencies: this.convertDependencies(packageJson.dependencies || {}),
      devDependencies: this.convertDependencies(packageJson.devDependencies || {}),
      peerDependencies: this.convertDependencies(packageJson.peerDependencies || {}),
      optionalDependencies: this.convertDependencies(packageJson.optionalDependencies || {}),
      scripts: packageJson.scripts,
      metadata: packageJson
    };
  }

  async resolveDependencies(
    manifest: PackageManifest,
    context: CommandContext
  ): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      root: manifest.name,
      nodes: new Map()
    };

    const registry = this.getRegistry(context);
    const visited = new Set<string>();
    const resolving = new Set<string>();

    // Combine all dependencies for resolution
    const allDependencies = [
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies
    ];

    this.logger.verbose(`Resolving ${allDependencies.length} dependencies for ${manifest.name}`);

    // Resolve each dependency
    for (const dep of allDependencies) {
      this.logger.verbose(`Resolving dependency: ${dep.name}@${dep.versionRange}`);
      await this.resolveDependency(
        dep,
        graph,
        registry,
        visited,
        resolving,
        context
      );
    }

    return graph;
  }

  async downloadPackages(
    packages: ResolvedPackage[],
    context: CommandContext
  ): Promise<string[]> {
    const cacheDir = path.join(context.config.cache.directory, 'node');
    await fs.ensureDir(cacheDir);

    const downloadPromises = packages.map(async (pkg) => {
      // Create safe cache key by replacing problematic characters
      const safeName = pkg.name.replace(/[@\/]/g, '-');
      const cacheKey = `${safeName}-${pkg.version}.tgz`;
      const cachePath = path.join(cacheDir, cacheKey);

      if (await fs.pathExists(cachePath)) {
        this.logger.verbose(`Using cached package: ${pkg.name}@${pkg.version}`);
        return cachePath;
      }

      this.logger.verbose(`Downloading: ${pkg.name}@${pkg.version} from ${pkg.downloadUrl}`);
      
      // Get authentication token for the registry that hosts this package
      const token = this.getToken(context, pkg.registry);
      this.logger.verbose(`Using authentication: ${token ? 'YES' : 'NO'}`);
      
      try {
        const response = await axios({
          method: 'get',
          url: pkg.downloadUrl,
          responseType: 'stream',
          timeout: context.config.install.timeout,
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });

        const writer = fs.createWriteStream(cachePath);
        (response.data as any).pipe(writer);
        
        this.logger.verbose(`Streaming package data to cache: ${cachePath}`);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => {
            this.logger.verbose(`Download completed: ${pkg.name}@${pkg.version}`);
            resolve(void 0);
          });
          writer.on('error', reject);
        });

        return cachePath;
      } catch (error) {
        this.logger.error(`Failed to download ${pkg.name}@${pkg.version}:`, error);
        throw error;
      }
    });

    return await Promise.all(downloadPromises);
  }

  async installPackages(
    packagePaths: string[],
    manifest: PackageManifest,
    context: CommandContext
  ): Promise<InstallResult> {
    const nodeModulesDir = path.join(context.cwd, 'node_modules');
    await fs.ensureDir(nodeModulesDir);

    const installed: ResolvedPackage[] = [];
    const errors: any[] = [];

    for (const packagePath of packagePaths) {
      try {
        // Extract package info from the tarball first to get correct name
        const tempDir = path.join(context.config.cache.directory, 'temp', Date.now().toString());
        await fs.ensureDir(tempDir);

        // Extract to temp directory first to read package.json
        this.logger.verbose(`Extracting package: ${packagePath}`);
        await tar.extract({
          file: packagePath,
          cwd: tempDir,
          strip: 1
        });

        const tempPackageJson = path.join(tempDir, 'package.json');
        if (await fs.pathExists(tempPackageJson)) {
          const pkgInfo = await fs.readJson(tempPackageJson);
          this.logger.verbose(`Installing ${pkgInfo.name}@${pkgInfo.version}`);
          
          // Create proper directory structure for scoped packages
          let packageDir;
          if (pkgInfo.name.startsWith('@')) {
            const [scope, name] = pkgInfo.name.split('/');
            const scopeDir = path.join(nodeModulesDir, scope);
            await fs.ensureDir(scopeDir);
            packageDir = path.join(scopeDir, name);
            this.logger.verbose(`Creating scoped package directory: ${packageDir}`);
          } else {
            packageDir = path.join(nodeModulesDir, pkgInfo.name);
            this.logger.verbose(`Creating package directory: ${packageDir}`);
          }

          // If the same version is already installed, skip re-installing
          const existingPackageJson = path.join(packageDir, 'package.json');
          if (await fs.pathExists(existingPackageJson)) {
            try {
              const existingInfo = await fs.readJson(existingPackageJson);
              if (existingInfo.name === pkgInfo.name && existingInfo.version === pkgInfo.version) {
                this.logger.verbose(`Skipping ${pkgInfo.name}@${pkgInfo.version} - already installed`);
                await fs.remove(tempDir);
                continue;
              }
            } catch {
              // If we can't read/parse the existing package.json, fall through and overwrite.
            }
          }

          // Copy from temp to final location
          await fs.ensureDir(packageDir);
          await fs.copy(tempDir, packageDir);
          
          // Clean up temp directory
          await fs.remove(tempDir);
          
          this.logger.verbose(`Installed: ${pkgInfo.name}@${pkgInfo.version}`);

          // Record installed package for reporting
          const registry = this.getRegistry(context);
          installed.push({
            name: pkgInfo.name,
            version: pkgInfo.version,
            registry,
            downloadUrl: '',
            dependencies: []
          });
        }
      } catch (error) {
        errors.push({
          package: path.basename(packagePath),
          error: error instanceof Error ? error.message : String(error),
          fatal: true
        });
      }
    }

    return {
      installed,
      updated: [],
      removed: [],
      errors
    };
  }

  async removePackages(
    packageNames: string[],
    context: CommandContext
  ): Promise<InstallResult> {
    const nodeModulesDir = path.join(context.cwd, 'node_modules');
    const removed: string[] = [];
    const errors: any[] = [];

    for (const packageName of packageNames) {
      try {
        const packageDir = path.join(nodeModulesDir, packageName);
        if (await fs.pathExists(packageDir)) {
          await fs.remove(packageDir);
          removed.push(packageName);
        }
      } catch (error) {
        errors.push({
          package: packageName,
          error: error instanceof Error ? error.message : String(error),
          fatal: false
        });
      }
    }

    return {
      installed: [],
      updated: [],
      removed,
      errors
    };
  }

  async createLockFile(
    graph: DependencyGraph,
    directory: string
  ): Promise<LockFile> {
    const lockFilePath = path.join(directory, 'forge-node-lock.json');
    
    const packages: Record<string, LockFileEntry> = {};
    
    for (const [name, node] of graph.nodes) {
      packages[name] = {
        version: node.package.version,
        resolved: node.package.downloadUrl,
        integrity: node.package.integrity,
        dependencies: node.dependencies.length > 0 
          ? Object.fromEntries(
              node.dependencies.map(dep => {
                const depNode = graph.nodes.get(dep);
                return [dep, depNode?.package.version || '*'];
              })
            )
          : undefined
      };
    }

    const lockFile: LockFile = {
      version: '3.0.0',
      packages,
      metadata: {
        lockfileVersion: 3,
        requires: true
      }
    };

    await fs.writeJson(lockFilePath, lockFile, { spaces: 2 });
    return lockFile;
  }

  async parseLockFile(directory: string): Promise<LockFile | null> {
    const lockFilePath = path.join(directory, 'forge-node-lock.json');
    
    if (!(await fs.pathExists(lockFilePath))) {
      return null;
    }

    return await fs.readJson(lockFilePath);
  }

  async getPackageInfo(
    name: string,
    context: CommandContext
  ): Promise<PackageRegistryInfo> {
    const registry = this.getRegistry(context);
    // Fix URL construction - remove trailing slash from registry, ensure single slash
    const cleanRegistry = registry.replace(/\/+$/, '');
    const url = `${cleanRegistry}/${encodeURIComponent(name)}`;
    
    // Get authentication token for this registry
    const token = this.getToken(context, registry);

    try {
      const response = await axios.get<NpmRegistryPackage>(url, {
        headers: {
          'Accept': 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      const pkg = response.data;

      return {
        name: pkg.name,
        description: pkg.description,
        versions: Object.keys(pkg.versions),
        latest: pkg['dist-tags'].latest,
        homepage: pkg.homepage,
        repository: pkg.repository?.url,
        license: pkg.license,
        keywords: pkg.keywords
      };
    } catch (error) {
      throw new Error(`Failed to get package info for ${name}: ${error}`);
    }
  }

  async searchPackages(
    query: string,
    context: CommandContext
  ): Promise<PackageSearchResult[]> {
    // Use npm search API with correct parameter name
    const searchUrl = `https://api.npmjs.org/v2/search?text=${encodeURIComponent(query)}&size=20`;

    try {
      const response = await axios.get(searchUrl);
      const results = (response.data as any).objects || [];

      return results.map((result: any) => ({
        name: result.package.name,
        version: result.package.version,
        description: result.package.description,
        keywords: result.package.keywords,
        score: result.score.final
      }));
    } catch (error) {
      this.logger.error('npm search failed:', error);
      return [];
    }
  }

  private convertDependencies(deps: Record<string, string>): Dependency[] {
    return Object.entries(deps).map(([name, version]) => ({
      name,
      versionRange: version,
      scope: 'production' as const
    }));
  }

  private async resolveDependency(
    dependency: Dependency,
    graph: DependencyGraph,
    registry: string,
    visited: Set<string>,
    resolving: Set<string>,
    context: CommandContext,
    depth = 0
  ): Promise<void> {
    const depKey = `${dependency.name}@${dependency.versionRange}`;
    
    if (visited.has(depKey) || depth > 100) { // Prevent infinite loops
      return;
    }

    if (resolving.has(depKey)) {
      throw new Error(`Circular dependency detected: ${depKey}`);
    }

    resolving.add(depKey);

    try {
      // Get package info from registry
      const packageInfo = await this.getPackageVersionInfo(
        dependency.name,
        dependency.versionRange,
        registry,
        context
      );

      if (!packageInfo) {
        throw new Error(`Package ${dependency.name}@${dependency.versionRange} not found`);
      }

      const resolvedPackage: ResolvedPackage = {
        name: packageInfo.name,
        version: packageInfo.version,
        registry,
        downloadUrl: packageInfo.dist.tarball,
        integrity: packageInfo.dist.integrity,
        dependencies: this.convertDependencies(packageInfo.dependencies || {})
      };

      const node: GraphNode = {
        package: resolvedPackage,
        dependencies: Object.keys(packageInfo.dependencies || {}),
        dependents: []
      };

      graph.nodes.set(resolvedPackage.name, node);
      visited.add(depKey);

      // Recursively resolve dependencies
      for (const subDep of resolvedPackage.dependencies) {
        await this.resolveDependency(
          subDep,
          graph,
          registry,
          visited,
          resolving,
          context,
          depth + 1
        );
      }
    } finally {
      resolving.delete(depKey);
    }
  }

  private async getPackageVersionInfo(
    name: string,
    versionRange: string,
    registry: string,
    context?: CommandContext
  ): Promise<any> {
    // Fix URL construction - remove trailing slash from registry, ensure single slash
    const cleanRegistry = registry.replace(/\/+$/, '');
    const url = `${cleanRegistry}/${encodeURIComponent(name)}`;
    
    // Get authentication token for this registry
    const token = context ? this.getToken(context, registry) : undefined;
    
    try {
      const response = await axios.get<NpmRegistryPackage>(url, {
        headers: {
          'Accept': 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      const pkg = response.data;

      // always use semver to pick the best version
      const availableVersions = Object.keys(pkg.versions);
      const matchingVersion = semver.maxSatisfying(availableVersions, versionRange);

      if (!matchingVersion) {
        throw new Error(`No version of ${name} satisfies ${versionRange}`);
      }

      const versionInfo = pkg.versions[matchingVersion];
      
      // Check for deprecation warning
      if (versionInfo.deprecated) {
        this.logger.warn(`Package ${name}@${matchingVersion} is deprecated: ${versionInfo.deprecated}`);
      }

      return versionInfo;
    } catch (error) {
      this.logger.error(`Failed to get version info for ${name}@${versionRange}:`, error);
      return null;
    }
  }

  private getToken(context: CommandContext, registryUrl?: string): string | undefined {
    const config = context.config as any;
    
    if (typeof config.registries === 'object' && !Array.isArray(config.registries) && registryUrl) {
      // Normalize URLs by removing trailing slashes for comparison
      const normalizedTargetUrl = registryUrl.replace(/\/+$/, '');
      
      // Find registry entry that matches the URL (after normalizing both URLs)
      const registryEntry = Object.values(config.registries).find((reg: any) => {
        if (reg && typeof reg === 'object' && reg.url) {
          const normalizedConfigUrl = reg.url.replace(/\/+$/, '');
          return normalizedConfigUrl === normalizedTargetUrl;
        }
        return false;
      }) as any;
      
      if (registryEntry && registryEntry.token) {
        return registryEntry.token;
      }
    }
    
    return undefined;
  }

  private getRegistry(context: CommandContext): string {
    // Use registry override if provided (from --registry flag)
    if (context.registryOverride) {
      return context.registryOverride;
    }
    
    const config = context.config as any;

    // Get the default node registry name
    const defaultNodeName = config.defaultRegistry?.node || 'node';

    // Look up the registry configuration
    if (typeof config.registries === 'object' && !Array.isArray(config.registries)) {
      const nodeRegistry = config.registries[defaultNodeName];
      if (nodeRegistry && typeof nodeRegistry === 'object' && nodeRegistry.url) {
        return nodeRegistry.url;
      }
    }
    
    // Fallback to npm default
    return 'https://registry.npmjs.org';
  }
}