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
  InstallResult,
  InstallError,
  LockFile,
  LockFileEntry,
  CommandContext
} from '../core/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import * as tar from 'tar';
import extractZip from 'extract-zip';
import { getLogger } from '../utils/logger';

interface PyPiPackageInfo {
  info: {
    name: string;
    version: string;
    summary?: string;
    description?: string;
    author?: string;
    requires_dist?: string[];
    requires_python?: string;
  };
  releases: {
    [version: string]: Array<{
      filename: string;
      url: string;
      size: number;
      md5_digest?: string;
      sha256_digest?: string;
      packagetype: 'sdist' | 'bdist_wheel' | string;
    }>;
  };
}

export class PythonPlugin implements PackagePlugin {
  readonly name = 'Python plugin';
  readonly version = '1.0.0';
  readonly supportedFormats = ['python', 'pip'];
  
  private logger = getLogger();

  async canHandle(directory: string): Promise<boolean> {
    // Check for requirements.txt, pyproject.toml, or setup.py
    const requirementsTxt = path.join(directory, 'requirements.txt');
    const pyprojectToml = path.join(directory, 'pyproject.toml');
    const setupPy = path.join(directory, 'setup.py');
    
    const hasRequirements = await fs.pathExists(requirementsTxt);
    const hasPyproject = await fs.pathExists(pyprojectToml);
    const hasSetup = await fs.pathExists(setupPy);
    
    return hasRequirements || hasPyproject || hasSetup;
  }

  async parseManifest(directory: string): Promise<PackageManifest> {
    const requirementsTxt = path.join(directory, 'requirements.txt');
    
    const manifest: PackageManifest = {
      name: path.basename(directory),
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: [],
      metadata: {}
    };

    // Parse requirements.txt
    if (await fs.pathExists(requirementsTxt)) {
      const requirementsDeps = await this.parseRequirementsTxt(requirementsTxt);
      manifest.dependencies = requirementsDeps;
    }
    
    return manifest;
  }

  private async parseRequirementsTxt(filePath: string): Promise<Dependency[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').map(line => line.trim()).filter(line => 
        line && !line.startsWith('#') && !line.startsWith('-')
      );
      
      const dependencies: Dependency[] = [];
      for (const line of lines) {
        const parsed = this.parseRequirementSpec(line);
        if (parsed) {
          dependencies.push(parsed);
        }
      }
      
      return dependencies;
    } catch (error) {
      this.logger.warn(`Failed to parse requirements.txt: ${error}`);
      return [];
    }
  }

  private parseRequirementSpec(spec: string): Dependency | null {
    // Parse requirement specifications like "django>=4.0,<5.0" or "requests==2.28.1"
    const match = spec.match(/^([a-zA-Z0-9_-]+(?:\[.*\])?)\s*([><=!]+.*)?$/);
    if (!match) return null;
    
    const [, name, versionSpec] = match;
    const versionRange = versionSpec ? versionSpec.trim() : '*';
    
    return {
      name: name.toLowerCase(),
      versionRange,
      scope: 'production'
    };
  }

  async resolveDependencies(manifest: PackageManifest, context: CommandContext): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      root: manifest.name,
      nodes: new Map()
    };
    
    // Get default PyPI registry or use override
    const registry = context.registryOverride || this.getDefaultRegistry(context);
    
    this.logger.verbose(`Resolving dependencies...`);
    this.logger.verbose(`Resolving ${manifest.dependencies.length} dependencies for ${manifest.name}`);
    
    // Simplified approach: Only resolve direct dependencies, no deep recursion
    for (const dep of manifest.dependencies) {
      await this.resolveDirectDependency(dep, graph, registry, context);
    }
    
    this.logger.verbose(`Resolved ${graph.nodes.size} packages total`);
    return graph;
  }

  private async resolveDirectDependency(
    dep: Dependency,
    graph: DependencyGraph,
    registry: string,
    context?: CommandContext
  ): Promise<void> {
    const fullKey = `${dep.name}@${dep.versionRange}`;
    
    // Check if already processed
    if (graph.nodes.has(fullKey)) {
      this.logger.verbose(`Already resolved: ${fullKey}`);
      return;
    }
    
    this.logger.verbose(`Resolving direct dependency: ${fullKey}`);
    
    try {
      // Get package info from PyPI
      const packageInfo = await this.fetchPackageInfo(dep.name, dep.versionRange, registry, context);
      
      if (!packageInfo) {
        this.logger.verbose(`Package not found: ${fullKey}`);
        return;
      }
      
      // Find best download URL (prefer wheel over source)
      const downloadUrl = this.getBestDownloadUrl(packageInfo, registry);
      
      // Parse dependencies from requires_dist - only runtime dependencies
      const dependencies: Dependency[] = [];
      if (packageInfo.info.requires_dist) {
        for (const reqDist of packageInfo.info.requires_dist) {
          const parsed = this.parseRequiresDist(reqDist);
          if (parsed) {
            dependencies.push(parsed);
          }
        }
      }
      
      const resolvedPackage: ResolvedPackage = {
        name: packageInfo.info.name,
        version: packageInfo.info.version,
        registry,
        downloadUrl,
        dependencies
      };
      
      graph.nodes.set(fullKey, {
        package: resolvedPackage,
        dependencies: dependencies.map(d => `${d.name}@${d.versionRange}`),
        dependents: []
      });
      
      this.logger.verbose(`Resolved: ${resolvedPackage.name}@${resolvedPackage.version} with ${dependencies.length} dependencies`);
      
      // Recursively resolve dependencies
      for (const childDep of dependencies) {
        await this.resolveDirectDependency(childDep, graph, registry, context);
      }
      
    } catch (error) {
      this.logger.verbose(`Error resolving ${dep.name}: ${error}`);
    }
  }

  private parseRequiresDist(reqDist: string): Dependency | null {
    // Parse requirement strings like:
    // "requests (>=2.20.0)"
    // "certifi>=2017.4.17"
    // "urllib3<3,>=1.21.1"
    // "charset-normalizer~=2.0.0; python_version >= \"3\""
    // "pytest>=7.0.0; extra == \"testing\"" - SKIP these (optional extras)
    
    // Check for environment markers
    const parts = reqDist.split(';');
    const packageSpec = parts[0].trim();
    const markers = parts.slice(1).join(';').trim().toLowerCase();
    
    // Skip optional extras (dev, test, docs dependencies)
    if (markers.includes('extra ==') || markers.includes('extra==')) {
      return null;
    }
    
    // Skip platform-specific dependencies we can't evaluate properly
    // (In a real implementation, you'd evaluate these markers properly)
    if (markers.includes('platform_') || markers.includes('sys_platform')) {
      // For now, we'll skip platform-specific deps to avoid unnecessary packages
      return null;
    }
    
    // Extract package name and version spec
    const match = packageSpec.match(/^([a-zA-Z0-9_-]+)\s*(.*)$/);
    if (!match) {
      return null;
    }
    
    const name = match[1];
    let versionSpec = match[2].trim();
    
    // Skip packages with dots that aren't real packages (like jaraco.test, flufl.flake8)
    // These are namespace packages that should be installed differently
    if (name.includes('.')) {
      this.logger.verbose(`Skipping namespace/special package: ${name}`);
      return null;
    }
    
    // Remove parentheses if present
    versionSpec = versionSpec.replace(/[()]/g, '').trim();
    
    // Remove brackets for extras (e.g., "coverage[toml]" -> "coverage")
    if (packageSpec.includes('[')) {
      // Skip packages with extras for now to avoid dev/test dependencies
      this.logger.verbose(`Skipping package with extras: ${packageSpec}`);
      return null;
    }
    
    // Convert to a simpler format (just take the first constraint for now)
    if (!versionSpec) {
      versionSpec = '*';
    }
    
    return {
      name,
      versionRange: versionSpec,
      scope: 'production'
    };
  }

  private async fetchPackageInfo(
    name: string,
    versionRange: string,
    registry: string,
    context?: CommandContext
  ): Promise<PyPiPackageInfo | null> {
    try {
      const cleanRegistry = registry.replace(/\/+$/, '');
      
      // Use correct PyPI JSON API format
      const url = cleanRegistry === 'https://pypi.org' 
        ? `https://pypi.org/pypi/${name}/json`
        : `${cleanRegistry}/pypi/${name}/json`;
      
      // Get authentication token if available
      const token = context ? this.getToken(context, registry) : undefined;
      
      this.logger.verbose(`Fetching package info: ${url}`);
      
      const response = await axios.get<PyPiPackageInfo>(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'forge/1.0.0',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: context?.config?.install?.timeout || 30000
      });
      
      // Find the best matching version
      const availableVersions = Object.keys(response.data.releases);
      const bestVersion = this.findBestVersion(availableVersions, versionRange);
      
      if (!bestVersion) {
        this.logger.error(`No matching version found for ${name}@${versionRange}`);
        return null;
      }
      
      // Return package info with the selected version
      const packageInfo = response.data;
      packageInfo.info.version = bestVersion;
      
      return packageInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch package info for ${name}: ${error}`);
      return null;
    }
  }

  private findBestVersion(availableVersions: string[], versionRange: string): string | null {
    if (versionRange === '*' || !versionRange) {
      // Return the latest version
      const sorted = availableVersions.sort((a, b) => this.compareVersions(b, a));
      return sorted[0] || null;
    }
    
    if (versionRange.startsWith('==')) {
      const exactVersion = versionRange.substring(2).trim();
      return availableVersions.includes(exactVersion) ? exactVersion : null;
    }
    
    if (versionRange.startsWith('>=')) {
      const minVersion = versionRange.substring(2).trim();
      const candidates = availableVersions.filter(v => this.compareVersions(v, minVersion) >= 0);
      return candidates.sort((a, b) => this.compareVersions(b, a))[0] || null;
    }
    
    // Default to latest for complex version specs
    const sorted = availableVersions.sort((a, b) => this.compareVersions(b, a));
    return sorted[0] || null;
  }

  private compareVersions(a: string, b: string): number {
    // Simple version comparison
    const aParts = a.split('.').map(n => parseInt(n) || 0);
    const bParts = b.split('.').map(n => parseInt(n) || 0);
    
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  private extractDependencies(requiresDist: string[]): Dependency[] {
    const dependencies: Dependency[] = [];
    
    for (const req of requiresDist) {
      try {
        // Skip empty or invalid requirements
        if (!req || req.trim() === '') continue;
        
        // Parse requirement strings like "django>=4.0" or "requests" or "jaraco.classes"
        // Handle extras like "requests[security]>=2.0"
        const cleanReq = req.split(';')[0].trim(); // Remove environment markers
        const match = cleanReq.match(/^([a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9])(?:\[[^\]]*\])?\s*([><=!~]+.*)?$/);
        
        if (match) {
          const [, name, versionSpec] = match;
          
          // Skip if package name is too short or invalid
          if (name.length < 2) continue;
          
          // Normalize package name (PyPI is case-insensitive, use hyphens)
          const normalizedName = name.toLowerCase().replace(/[_.]+/g, '-');
          
          dependencies.push({
            name: normalizedName,
            versionRange: versionSpec?.trim() || '*',
            scope: 'production'
          });
        } else {
          this.logger.verbose(`Skipping invalid requirement: ${req}`);
        }
      } catch (error) {
        this.logger.verbose(`Error parsing requirement '${req}': ${error}`);
      }
    }
    
    return dependencies;
  }

  private getBestDownloadUrl(packageInfo: PyPiPackageInfo, registry: string): string {
    const version = packageInfo.info.version;
    const releases = packageInfo.releases[version] || [];
    
    // Prefer wheel files over source distributions
    const wheel = releases.find(r => r.packagetype === 'bdist_wheel');
    if (wheel) return wheel.url;
    
    // Fall back to source distribution
    const sdist = releases.find(r => r.packagetype === 'sdist');
    if (sdist) return sdist.url;
    
    // If no releases found, construct URL (for custom registries)
    return `${registry}/packages/${packageInfo.info.name}/${version}/${packageInfo.info.name}-${version}.tar.gz`;
  }

  async downloadPackages(packages: ResolvedPackage[], context: CommandContext): Promise<string[]> {
    const cacheDir = path.join(context.config.cache.directory, 'python');
    await fs.ensureDir(cacheDir);
    
    this.logger.verbose(`Downloading ${packages.length} packages...`);
    
    const downloadPromises = packages.map(async (pkg) => {
      // Create cache filename
      const safeName = pkg.name.replace(/[^a-zA-Z0-9_-]/g, '-');
      const extension = pkg.downloadUrl.endsWith('.whl') ? '.whl' : '.tar.gz';
      const cacheKey = `${safeName}-${pkg.version}${extension}`;
      const cachePath = path.join(cacheDir, cacheKey);
      
      // Check cache first
      if (await fs.pathExists(cachePath)) {
        this.logger.verbose(`Using cached package: ${pkg.name}@${pkg.version}`);
        return cachePath;
      }
      
      // Download fresh
      this.logger.verbose(`Downloading: ${pkg.name}@${pkg.version} from ${pkg.downloadUrl}`);
      const token = this.getToken(context, pkg.registry);
      
      const response = await axios({
        method: 'get',
        url: pkg.downloadUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'forge/1.0.0',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: context.config.install?.timeout || 30000
      });
      
      // Stream to cache file
      const writer = fs.createWriteStream(cachePath);
      (response.data as NodeJS.ReadableStream).pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      this.logger.verbose(`Download completed: ${pkg.name}@${pkg.version}`);
      return cachePath;
    });
    
    return await Promise.all(downloadPromises);
  }

  async installPackages(
    packagePaths: string[],
    manifest: PackageManifest,
    context: CommandContext
  ): Promise<InstallResult> {
    const sitePackagesDir = await this.getSitePackagesDir(context);
    
    const installed: ResolvedPackage[] = [];
    const errors: InstallError[] = [];
    
    for (const packagePath of packagePaths) {
      try {
        const fileName = path.basename(packagePath);
        const isWheel = fileName.endsWith('.whl');
        const isTarGz = fileName.endsWith('.tar.gz');
        
        if (!isWheel && !isTarGz) {
          throw new Error(`Unsupported package format: ${fileName}`);
        }
        
        // Extract to temp directory first
        const tempDir = path.join(context.config.cache.directory, 'temp', `python-${Date.now()}`);
        await fs.ensureDir(tempDir);
        
        this.logger.verbose(`Extracting package: ${packagePath}`);
        
        try {
          if (isWheel) {
            // Wheels are zip files
            await extractZip(packagePath, { dir: tempDir });
          } else {
            // Source distributions are tar.gz
            await tar.extract({
              file: packagePath,
              cwd: tempDir,
              strip: 1
            });
          }
          
          // Read metadata to get actual package name and version
          const metadata = await this.readPackageMetadata(tempDir);
          const packageName = metadata.name;
          const version = metadata.version;
          
          this.logger.verbose(`Installing ${packageName}@${version}`);
          
          // Check if the same version is already installed by looking for .dist-info directory
          const distInfoPattern = `${packageName.replace(/-/g, '_')}-${version}.dist-info`;
          const existingDistInfo = path.join(sitePackagesDir, distInfoPattern);
          
          if (await fs.pathExists(existingDistInfo)) {
            this.logger.verbose(`Skipping ${packageName}@${version} - already installed`);
            await fs.remove(tempDir);
            continue;
          }
          
          // Install package files to site-packages
          if (isWheel) {
            // Copy all .dist-info and package directories from wheel
            const items = await fs.readdir(tempDir);
            for (const item of items) {
              const itemPath = path.join(tempDir, item);
              const stat = await fs.stat(itemPath);
              
              if (stat.isDirectory()) {
                const targetPath = path.join(sitePackagesDir, item);
                await fs.copy(itemPath, targetPath, { overwrite: true });
                this.logger.verbose(`Copied ${item} to site-packages`);
              } else if (stat.isFile() && !item.endsWith('.pyc')) {
                // Copy top-level .py files
                const targetPath = path.join(sitePackagesDir, item);
                await fs.copy(itemPath, targetPath, { overwrite: true });
              }
            }
          } else {
            // For source distributions, look for the package directory
            const packageDir = path.join(tempDir, packageName);
            if (await fs.pathExists(packageDir)) {
              const targetPath = path.join(sitePackagesDir, packageName);
              await fs.copy(packageDir, targetPath, { overwrite: true });
              this.logger.verbose(`Copied ${packageName} to site-packages`);
            }
          }
          
          // Clean up temp directory
          await fs.remove(tempDir);
          
          // Create a basic ResolvedPackage for the installed package
          const resolvedPkg: ResolvedPackage = {
            name: packageName,
            version,
            registry: 'pypi',
            downloadUrl: '',
            dependencies: []
          };
          installed.push(resolvedPkg);
          this.logger.verbose(`Installed: ${packageName}@${version}`);
        } catch (extractError) {
          await fs.remove(tempDir).catch(() => {});
          throw extractError;
        }
      } catch (error) {
        const installError: InstallError = {
          package: this.extractPackageNameFromFile(path.basename(packagePath)),
          error: String(error),
          fatal: false
        };
        errors.push(installError);
        this.logger.error(installError.error);
      }
    }
    
    return { 
      installed, 
      updated: [], 
      removed: [], 
      errors 
    };
  }

  private async readPackageMetadata(extractedDir: string): Promise<{ name: string; version: string }> {
    // Look for .dist-info directory (wheels) or PKG-INFO (source dists)
    const items = await fs.readdir(extractedDir);
    
    // Try .dist-info first (wheel format)
    const distInfoDir = items.find(item => item.endsWith('.dist-info'));
    if (distInfoDir) {
      const metadataPath = path.join(extractedDir, distInfoDir, 'METADATA');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readFile(metadataPath, 'utf-8');
        return this.parseMetadataFile(metadata);
      }
    }
    
    // Try PKG-INFO (source distribution format)
    const pkgInfoPath = path.join(extractedDir, 'PKG-INFO');
    if (await fs.pathExists(pkgInfoPath)) {
      const metadata = await fs.readFile(pkgInfoPath, 'utf-8');
      return this.parseMetadataFile(metadata);
    }
    
    // Fallback: extract from directory name or first .dist-info found
    if (distInfoDir) {
      const match = distInfoDir.match(/^(.+)-([0-9.]+)\.dist-info$/);
      if (match) {
        return { name: match[1].replace(/_/g, '-'), version: match[2] };
      }
    }
    
    throw new Error('Could not find package metadata (METADATA or PKG-INFO)');
  }

  private parseMetadataFile(content: string): { name: string; version: string } {
    const lines = content.split('\n');
    let name = '';
    let version = '';
    
    for (const line of lines) {
      if (line.startsWith('Name: ')) {
        name = line.substring(6).trim();
      } else if (line.startsWith('Version: ')) {
        version = line.substring(9).trim();
      }
      
      if (name && version) {
        break;
      }
    }
    
    if (!name || !version) {
      throw new Error('Could not parse package name and version from metadata');
    }
    
    return { name, version };
  }

  private async detectPythonVersion(venvPath: string): Promise<string> {
    // Try to detect Python version from venv/lib directory structure
    const libDir = path.join(venvPath, 'lib');
    
    if (await fs.pathExists(libDir)) {
      const items = await fs.readdir(libDir);
      const pythonDir = items.find(item => item.startsWith('python'));
      
      if (pythonDir) {
        this.logger.verbose(`Detected Python version directory: ${pythonDir}`);
        return pythonDir;
      }
    }
    
    // Fallback to python3 if we can't detect
    this.logger.warn('Could not detect Python version, using python3 as fallback');
    return 'python3';
  }

  private async ensureVirtualEnvironment(context: CommandContext): Promise<void> {
    const venvPath = path.join(context.cwd, 'venv');
    
    // Check if venv already exists (look for pyvenv.cfg or bin/python)
    const pyvenvCfg = path.join(venvPath, 'pyvenv.cfg');
    const binPython = path.join(venvPath, 'bin', 'python');
    const binPython3 = path.join(venvPath, 'bin', 'python3');
    
    if (await fs.pathExists(pyvenvCfg) || await fs.pathExists(binPython) || await fs.pathExists(binPython3)) {
      this.logger.verbose('Virtual environment already exists, using existing venv');
      return;
    }
    
    this.logger.info('Creating Python virtual environment...');
    
    // Create venv using Python's venv module
    const { spawnSync } = await import('child_process');
    
    // Try python3 first, then python
    // Note: Do not use 'inherit' for stdio as it causes issues in containers
    let result = spawnSync('python3', ['-m', 'venv', venvPath], {
      cwd: context.cwd
    });
    
    if (result.error || result.status !== 0) {
      // Try 'python' if python3 fails
      result = spawnSync('python', ['-m', 'venv', venvPath], {
        cwd: context.cwd
      });
      
      if (result.error || result.status !== 0) {
        const errorMsg = result.stderr?.toString() || result.error?.message || 'Unknown error';
        throw new Error(`Failed to create virtual environment: ${errorMsg}. Make sure Python 3 is installed.`);
      }
    }
    
    if (context.verbose && result.stdout) {
      this.logger.verbose(result.stdout.toString());
    }
    
    this.logger.info('Virtual environment created successfully');
  }

  private async getSitePackagesDir(context: CommandContext): Promise<string> {
    const venvPath = path.join(context.cwd, 'venv');
    
    // Ensure venv exists before trying to use it
    await this.ensureVirtualEnvironment(context);
    
    const pythonVersion = await this.detectPythonVersion(venvPath);
    const sitePackagesDir = path.join(venvPath, 'lib', pythonVersion, 'site-packages');
    await fs.ensureDir(sitePackagesDir);
    return sitePackagesDir;
  }

  async removePackages(packageNames: string[], context: CommandContext): Promise<InstallResult> {
    const removed: string[] = [];
    const errors: InstallError[] = [];
    const sitePackagesDir = await this.getSitePackagesDir(context);
    
    for (const name of packageNames) {
      try {
        const packageDir = path.join(sitePackagesDir, name);
        
        if (await fs.pathExists(packageDir)) {
          await fs.remove(packageDir);
          removed.push(name);
          this.logger.verbose(`Removed package: ${name}`);
        } else {
          errors.push({
            package: name,
            error: `Package ${name} not found`,
            fatal: false
          });
        }
      } catch (error) {
        errors.push({
          package: name,
          error: String(error),
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

  async createLockFile(graph: DependencyGraph, directory: string): Promise<LockFile> {
    const lockFile: LockFile = {
      version: '1.0.0',
      packages: {},
      metadata: {}
    };
    
    // Convert dependency graph to lock file format
    for (const [, node] of graph.nodes) {
      const pkg = node.package;
      const entry: LockFileEntry = {
        version: pkg.version,
        resolved: pkg.downloadUrl,
        integrity: pkg.integrity,
        dependencies: {}
      };
      
      // Add dependencies
      for (const dep of pkg.dependencies) {
        entry.dependencies![dep.name] = dep.versionRange;
      }
      
      lockFile.packages![pkg.name] = entry;
    }
    
    const lockFilePath = path.join(directory, 'forge-python-lock.json');
    await fs.writeJson(lockFilePath, lockFile, { spaces: 2 });
    this.logger.verbose(`Created lock file: ${lockFilePath}`);
    
    return lockFile;
  }

  async parseLockFile(directory: string): Promise<LockFile | null> {
    try {
      const lockFilePath = path.join(directory, 'forge-python-lock.json');
      
      if (!(await fs.pathExists(lockFilePath))) {
        return null;
      }
      
      const lockFile = await fs.readJson(lockFilePath);
      return lockFile as LockFile;
    } catch (error) {
      this.logger.error(`Failed to parse lock file: ${error}`);
      return null;
    }
  }

  async getPackageInfo(name: string, context: CommandContext): Promise<PackageRegistryInfo> {
    try {
      const registry = context.registryOverride || this.getDefaultRegistry(context);
      const packageInfo = await this.fetchPackageInfo(name, '*', registry, context);
      
      if (!packageInfo) {
        throw new Error(`Package ${name} not found`);
      }
      
      return {
        name: packageInfo.info.name,
        description: packageInfo.info.summary,
        versions: Object.keys(packageInfo.releases),
        latest: packageInfo.info.version,
        homepage: packageInfo.info.description,
        license: 'Unknown',
        keywords: []
      };
    } catch (error) {
      this.logger.error(`Failed to get package info: ${error}`);
      throw error;
    }
  }

  async searchPackages(query: string, context: CommandContext): Promise<PackageSearchResult[]> {
    try {
      const registry = context.registryOverride || this.getDefaultRegistry(context);
      const cleanRegistry = registry.replace(/\/+$/, '');
      const searchUrl = `${cleanRegistry}/search?q=${encodeURIComponent(query)}`;
      
      const token = this.getToken(context, registry);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'forge/1.0.0',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: context.config?.install?.timeout || 30000
      });
      
      // Parse search results
      const results = ((response.data as Record<string, unknown>).results as unknown[]) || [];
      return results.map((result: unknown) => {
        const r = result as Record<string, unknown>;
        return {
          name: (r.name as string) || '',
          version: (r.version as string) || 'latest',
          description: (r.summary as string) || (r.description as string) || '',
          keywords: (r.keywords as string[]) || [],
          score: (r.score as number) || 1.0
        };
      });
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      return [];
    }
  }

  private extractPackageNameFromFile(fileName: string): string {
    // Extract package name from filename like "django-4.0.0-py3-none-any.whl" or "requests-2.28.1.tar.gz"
    const match = fileName.match(/^([a-zA-Z0-9_-]+)-/);
    return match ? match[1] : fileName;
  }

  private getDefaultRegistry(context: CommandContext): string {
    // Check for pip-specific registry config
    const config = context.config;
    if (config.registries) {
      const pipRegistries = Object.values(config.registries).filter((reg: any) => 
        reg && typeof reg === 'object' && reg.scope === 'python'
      );
      
      if (pipRegistries.length > 0) {
        const defaultReg = pipRegistries.find((reg: any) => reg.default);
        const registryUrl = (defaultReg as any)?.url || (pipRegistries[0] as any)?.url;
        return (registryUrl as string) || 'https://pypi.org';
      }
    }
    
    // Default to PyPI
    return 'https://pypi.org';
  }

  private getToken(context: CommandContext, registryUrl?: string): string | undefined {
    const config = context.config;
    
    if (config.registries && registryUrl) {
      // Normalize URLs by removing trailing slashes
      const normalizedTargetUrl = registryUrl.replace(/\/+$/, '');
      
      // Find registry entry that matches the URL
      const registryEntry = Object.values(config.registries).find((reg: any) => {
        if (reg && typeof reg === 'object' && reg.url) {
          const normalizedConfigUrl = (reg.url as string).replace(/\/+$/, '');
          return normalizedConfigUrl === normalizedTargetUrl;
        }
        return false;
      }) as any;
      
      return registryEntry?.token as string | undefined;
    }
  }
}