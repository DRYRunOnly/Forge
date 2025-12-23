# Support

## Getting Help

We're here to help! Here are the best ways to get support for Forge:

## 📚 Documentation

First, check our documentation:

- **[README.md](README.md)** - Overview, installation, and basic usage
- **[docs/](docs/)** - Detailed documentation including:
  - [Project Structure](docs/project-structure.md) - Architecture and implementation details
  - [Configuration Guide](docs/configuration-guide.md) - Registry setup and authentication
  - [Research](docs/research.md) - Package manager research and insights

## 🐛 Issues and Bug Reports

- **[GitHub Issues](https://github.com/DRYRunOnly/Forge/issues)** - Report bugs and request features
- Search existing issues before creating a new one
- Use issue templates when available
- Provide detailed information for bug reports

## 💬 Community Discussion

- **[GitHub Discussions](https://github.com/DRYRunOnly/Forge/discussions)** - Ask questions, share ideas, and discuss the project
- Great for general questions and community interaction

## 🚨 Security Issues

- **DO NOT** report security vulnerabilities in public issues
- See our [Security Policy](SECURITY.md) for responsible disclosure
- Contact: security@forge-project.org

## 📧 Direct Contact

For other inquiries:
- **Maintainers**: forge-maintainers@example.com
- **General**: Listed in [MAINTAINERS.md](MAINTAINERS.md)

## 🤝 Contributing

Want to contribute? See our [Contributing Guide](CONTRIBUTING.md):

- Development setup
- Coding standards  
- Pull request process
- Community guidelines

## 📋 Issue Templates

When creating issues, please provide:

### Bug Reports
- Operating system and version
- Node.js version
- Forge version (`forge --version`)
- Command that caused the issue
- Expected vs actual behavior
- Steps to reproduce
- Error messages/logs

### Feature Requests
- Clear description of the feature
- Use case and motivation
- Proposed implementation (if any)
- Examples of similar features in other tools

## 🔄 Response Times

We aim for:
- **Security issues**: 24-48 hours
- **Bug reports**: 2-7 days
- **Feature requests**: 1-2 weeks
- **Pull requests**: 3-7 days

Response times may vary based on maintainer availability and issue complexity.

## ⚡ Quick Fixes

For common issues:

### Installation Problems
```bash
# Clear npm cache
npm cache clean --force

# Rebuild from source
npm run clean && npm run build
```

### Permission Issues
```bash
# Fix permissions (Unix/macOS)
sudo chown -R $(whoami) ~/.npm
```

### Registry Issues
```bash
# Reset registry settings
npm config delete registry
forge config list
```

---

Thank you for using Forge! 🔨