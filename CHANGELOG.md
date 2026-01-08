# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Maintainer documentation and contribution guidelines
- Security policy and vulnerability reporting process
- Code of conduct for community participation
- GitHub Actions workflow for automated publishing to Cloudsmith

### Changed
- Updated README with Cloudsmith hosting acknowledgment
- Enhanced package.json with repository metadata and publish scripts

### Security
- Established security reporting process
- Added security best practices documentation

## [0.2.2] - 2026-01-09

### Fixed
- Python virtual environments issue

### Changed
- Registry management UX improvements
  - `forge registry add` now prompts for a registry scope when `--scope` is not provided (with `node` as the default)
  - Default scopes and configuration keys now consistently use `node` instead of `npm` for the Node ecosystem
  - Node plugin now reads `defaultRegistry.node` and the corresponding `registries` entry instead of legacy `npm` keys

## [0.2.1] - 2026-01-08

### Fixed
- CLI now reads version dynamically from package.json instead of hardcoded value
- Python venv creation on Ubuntu containers (fixed "Invalid host defined options" error)
  - Changed stdio handling to use 'pipe' with 'utf-8' encoding for better compatibility
  - Added proper stderr capture for better error messages
- Node plugin now surfaces deprecation metadata from the registry
  - Logs clear warnings when installing deprecated versions (e.g. django@99.99.99)
  - Keeps version resolution aligned with npm (still respects semver and registry tags)

## [0.2.0] - 2026-01-08

### Added
- Python plugin now properly extracts wheels (.whl) and source distributions (.tar.gz) instead of creating marker files
- Python plugin reads actual package metadata from METADATA or PKG-INFO files
- Python plugin dynamically detects Python version in venv (e.g., python3.9, python3.11)
- Python plugin implements idempotent installs by checking for existing .dist-info directories
- Python plugin resolves transitive dependencies with cycle detection
- Smart dependency filtering for Python packages to skip dev/test/doc dependencies and optional extras
- CLI shows "Nothing to install, all packages already present" when no packages need installation
- Node plugin tracks installed packages in InstallResult for accurate reporting

### Fixed
- Python plugin now creates proper virtual environments using `python -m venv` instead of just directory structures
- Virtual environment detection checks for existing venv before creating a new one
- Proper error handling when Python 3 is not installed on the system

### Changed
- Renamed Python lockfile from `forge-lock.json` to `forge-python-lock.json` for consistency with Node's `forge-node-lock.json`

## [0.1.2] - 2026-01-08

### Fixed
- Make repeated `forge install` runs idempotent for Node packages by skipping re-installation when the same package name and version are already present in `node_modules`.

## [0.1.1] - 2026-01-08

### Fixed
- Allow `forge install <pkg>` to work in directories without an existing `package.json` by falling back to the Node plugin and using a synthetic manifest.
- Write Forge-managed Node lockfiles to `forge-node-lock.json` instead of `package-lock.json` to avoid conflicts with npm's own lockfile format.
- Confirmed that Node can require packages installed by Forge from the generated `node_modules` layout.

## [0.1.0] - 2025-12-23

### Added
- Initial release of Forge universal package manager
- Core architecture with plugin system
- Node.js package manager plugin with full npm registry integration
- Python package manager plugin with PyPI integration
- Universal CLI interface with command-line argument parsing
- Auto-detection of project types (Node.js, Python)
- Format override support (`--format` flag)
- Package search functionality across supported registries
- Package information retrieval
- Dependency resolution for Node.js packages (transitive dependencies)
- Basic dependency resolution for Python packages
- Caching system for downloaded packages
- Configuration management with multi-source support
- Plugin priority configuration
- Dry-run mode for safe operation testing
- Comprehensive error handling and logging
- Mixed project support (projects with multiple package formats)
- Lock file generation (forge-node-lock.json, forge-python-lock.json)

### Project Structure
- TypeScript-based architecture for type safety
- Jest testing framework with comprehensive test coverage
- ESLint code quality enforcement
- Modular plugin architecture for extensibility
- Comprehensive documentation in `docs/` directory
- Example projects for testing different scenarios

### CLI Commands
- `forge install` - Install packages with dependency resolution
- `forge search` - Search for packages across registries
- `forge info` - Get detailed package information
- `forge remove` - Remove installed packages
- `forge list` - List installed packages
- `forge config` - Configuration management
- `forge --help` - Comprehensive help system

### Supported Features
- Package.json dependency parsing and resolution
- requirements.txt parsing for Python packages
- npm registry integration with authentication support
- PyPI registry integration
- Parallel dependency resolution and downloading
- Cross-format project support with intelligent detection
- Configurable plugin priority for auto-detection
- Verbose logging for debugging and troubleshooting

### Technical Highlights
- Plugin architecture allowing easy extension for new package formats
- Unified configuration system supporting project and user-level configs
- Intelligent dependency resolution with conflict detection
- Efficient caching system reducing redundant downloads
- Robust error handling with user-friendly error messages
- Type-safe implementation using TypeScript throughout

---

## Version History Legend

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes