# Contributing to Forge

Thank you for your interest in contributing to Forge! We welcome contributions from everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Process](#contribution-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Community Guidelines

We want everyone to feel welcome contributing to Forge! Here are our simple guidelines:

- **Be respectful**: Treat everyone with courtesy and respect
- **Be helpful**: Support other contributors and users
- **Be constructive**: Focus on solutions and positive feedback
- **Be patient**: Remember we're all learning and volunteering our time

If you encounter any issues with community interactions, please contact the maintainers.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Git

### Setup Instructions

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Forge.git
cd forge

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

### Project Structure

```
src/
├── core/           # Core framework components
├── plugins/        # Package format plugins
├── utils/          # Utility functions
├── cli.ts          # Command-line interface
└── index.ts        # Main entry point
```

## Contribution Process

### Reporting Issues

- Use GitHub Issues to report bugs or request features
- Search existing issues before creating a new one
- Provide detailed information including:
  - Operating system and version
  - Node.js version
  - Forge version
  - Steps to reproduce
  - Expected vs actual behavior

### Submitting Pull Requests

1. **Create an Issue**: For significant changes, create an issue first to discuss the approach
2. **Create a Branch**: Create a feature branch from `main`
3. **Make Changes**: Implement your changes following our coding standards
4. **Add Tests**: Include tests for new functionality
5. **Update Documentation**: Update relevant documentation
6. **Commit Messages**: Use clear, descriptive commit messages
7. **Push and PR**: Push to your fork and create a pull request

### Pull Request Guidelines

- PRs should be focused and solve a single problem
- Include a clear description of changes
- Reference related issues
- Ensure all tests pass
- Maintain or improve code coverage
- Follow existing code style

## Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Provide explicit type annotations for public APIs
- Use meaningful variable and function names
- Follow existing naming conventions

### Code Style

- Use Prettier for code formatting
- Follow ESLint rules
- Use consistent indentation (2 spaces)
- Add JSDoc comments for public APIs

### Example Code Style

```typescript
/**
 * Resolves dependencies for a given package manifest
 * @param manifest - The package manifest to resolve
 * @param options - Resolution options
 * @returns Promise resolving to dependency graph
 */
export async function resolveDependencies(
  manifest: PackageManifest,
  options: ResolveOptions = {}
): Promise<DependencyGraph> {
  // Implementation here
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Use Jest for testing
- Write unit tests for new functionality
- Include integration tests for complex features
- Aim for high code coverage
- Mock external dependencies

### Test Structure

```typescript
describe('PackageResolver', () => {
  describe('resolveDependencies', () => {
    it('should resolve simple dependencies', async () => {
      // Test implementation
    });

    it('should handle circular dependencies', async () => {
      // Test implementation
    });
  });
});
```

## Documentation

### Types of Documentation

- **API Documentation**: JSDoc comments in code
- **User Guide**: README.md and docs/ folder
- **Developer Guide**: This file and project-structure.md
- **Examples**: examples/ directory

### Documentation Standards

- Keep documentation up to date with code changes
- Use clear, concise language
- Include code examples
- Document breaking changes in CHANGELOG.md

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

### Getting Help

- Check existing documentation first
- Search GitHub issues for similar problems
- Create a new issue with detailed information
- Be patient and respectful in all interactions

## Plugin Development

Forge uses a plugin architecture. To create a new plugin:

1. Implement the `PackagePlugin` interface
2. Add plugin registration
3. Include tests and documentation
4. Follow existing plugin patterns

See existing plugins in `src/plugins/` for examples.

## Release Process

Releases are handled by maintainers:

1. Version bump using semantic versioning
2. Update CHANGELOG.md
3. Create GitHub release
4. Automatic publishing to Cloudsmith via GitHub Actions

## Recognition

Contributors are recognized in:

- GitHub contributor graphs
- CHANGELOG.md for significant contributions
- README.md for major contributors

---

Thank you for contributing to Forge! 🔨✨