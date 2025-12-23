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
- Lock file generation (forge-lock.json)

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