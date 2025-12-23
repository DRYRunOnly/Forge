# Forge - Configuration & Authentication Guide

## 🔧 Configuration Management

Forge provides multiple ways to configure registries and authentication, similar to npm's .npmrc system.

## 📁 Configuration Files

### **Project Level Configuration**
```bash
# In your project directory
.forgerc.json          # Simple JSON config
forge.config.json      # Detailed configuration
```

### **User Level Configuration**  
```bash
# User home directory
~/.forgerc.json                    # Simple user config
~/.config/forge/config.json        # XDG standard location
```

### **Example .forgerc.json**
```json
{
  "registries": [
    {
      "name": "npm-demo",
      "url": "https://npm.forge.io/ranjantestenv/npm/",
      "authToken": "${FORGE_NPM_TOKEN}",
      "scope": "npm"
    },
    {
      "name": "pypi-demo", 
      "url": "https://pypi.forge.io/ranjantestenv/simple/",
      "authToken": "${FORGE_PYPI_TOKEN}",
      "scope": "pip"
    }
  ],
  "cache": {
    "directory": "~/.forge/cache",
    "maxSize": "2GB"
  },
  "install": {
    "parallel": 4,
    "retries": 3
  }
}
```

## 🌍 Environment Variables

### **Registry URLs**
```bash
export FORGE_NPM_REGISTRY=https://npm.forge.io/ranjantestenv/npm/
export FORGE_PYPI_REGISTRY=https://pypi.forge.io/ranjantestenv/simple/
export FORGE_MAVEN_REGISTRY=https://maven.forge.io/ranjantestenv/maven/
```

### **Authentication Tokens**
```bash
export FORGE_NPM_TOKEN=your-npm-token
export FORGE_PYPI_TOKEN=your-pypi-token
export FORGE_MAVEN_TOKEN=your-maven-token
```

### **Cache Settings**
```bash
export FORGE_CACHE_DIR=/custom/cache/path
export FORGE_CACHE_MAX_SIZE=5GB
export FORGE_INSTALL_PARALLEL=8
```

## 🔐 Authentication Commands

### **Login to Registry**
```bash
# Interactive login
forge login --registry=https://npm.forge.io/ranjantestenv/npm/

# Direct token
forge login --registry=https://npm.forge.io/ranjantestenv/npm/ --token=TOKEN

# Set default registry for npm packages
forge registry set npm https://npm.forge.io/ranjantestenv/npm/
```

### **Logout**
```bash
forge logout --registry=https://npm.forge.io/ranjantestenv/npm/
forge logout --all
```

### **Check Authentication**
```bash
forge whoami
forge whoami --registry=https://npm.forge.io/ranjantestenv/npm/
```

## 📦 Per-Command Registry Override

### **Install from Specific Registry**
```bash
# Override default npm registry
forge install lodash --registry=https://npm.forge.io/ranjantestenv/npm/

# Install with authentication
forge install @mycompany/private-package --registry=https://npm.forge.io/ranjantestenv/npm/

# Multiple packages from different registries
forge install lodash express --npm-registry=https://npm.forge.io/ranjantestenv/npm/
```

### **Search Specific Registry**
```bash
forge search lodash --registry=https://npm.forge.io/ranjantestenv/npm/
forge search numpy --registry=https://pypi.forge.io/ranjantestenv/simple/
```

## 🎯 Advanced Configuration

### **Scoped Packages (like npm scopes)**
```json
{
  "scopes": {
    "@mycompany": {
      "registry": "https://npm.forge.io/ranjantestenv/npm/",
      "authToken": "${COMPANY_NPM_TOKEN}"
    },
    "@opensource": {
      "registry": "https://registry.npmjs.org/"
    }
  }
}
```

### **Multiple Environment Support**
```bash
# Development environment
forge config set env dev
forge config set registry.npm https://npm.forge.io/dev/npm/

# Production environment  
forge config set env prod
forge config set registry.npm https://npm.forge.io/prod/npm/

# Switch environments
forge use-env dev
forge use-env prod
```

## 📋 Configuration Commands

### **Get/Set Configuration**
```bash
# List all config
forge config list

# Get specific values
forge config get registry.npm
forge config get cache.directory
forge config get registries

# Set values
forge config set registry.npm https://npm.forge.io/ranjantestenv/npm/
forge config set cache.maxSize 5GB
forge config set install.parallel 8

# Delete values
forge config delete registry.npm
forge config delete authToken.npm
```

### **Registry Management**
```bash
# List registries
forge registry list

# Add registry
forge registry add demo-npm https://npm.forge.io/ranjantestenv/npm/ --token=TOKEN

# Remove registry
forge registry remove demo-npm

# Set default registry for format
forge registry set-default npm demo-npm
```

## 🔒 Security Best Practices

### **Token Storage**
```bash
# Tokens are stored securely in OS keychain
forge login --registry=https://npm.forge.io/ranjantestenv/npm/
# Token stored in macOS Keychain / Windows Credential Manager / Linux Secret Service

# Or use environment variables
export FORGE_NPM_TOKEN=your-token
```

### **Configuration Precedence** (highest to lowest)
1. Command line flags (`--registry=...`)
2. Environment variables (`FORGE_NPM_REGISTRY=...`)  
3. Project config files (`.forgerc.json`)
4. User config files (`~/.forgerc.json`)
5. Default values

## 💡 Migration from npm

### **Convert .npmrc to .forgerc.json**
```bash
# Auto-convert existing npm config
forge config import-npmrc
forge config import-npmrc ~/.npmrc

# Manual conversion
# .npmrc:
# registry=https://npm.forge.io/ranjantestenv/npm/
# //npm.forge.io/ranjantestenv/npm/:_authToken=TOKEN

# .forgerc.json:
{
  "registries": [
    {
      "name": "demo-npm",
      "url": "https://npm.forge.io/ranjantestenv/npm/",
      "authToken": "TOKEN",
      "scope": "npm"
    }
  ]
}
```

## 🎛️ Examples

### **Complete Private Registry Setup**
```bash
# Set up private registries
forge registry add demo-npm https://npm.forge.io/ranjantestenv/npm/ 
forge registry add demo-pypi https://pypi.forge.io/ranjantestenv/simple/

# Login to each
forge login --registry=https://npm.forge.io/ranjantestenv/npm/
forge login --registry=https://pypi.forge.io/ranjantestenv/simple/

# Install packages
forge install lodash  # Uses demo npm registry
forge install numpy   # Uses demo pypi registry

# Override for specific package
forge install express --registry=https://registry.npmjs.org/
```

### **Team/CI Configuration**
```bash
# Set up for CI/CD
export FORGE_NPM_REGISTRY=https://npm.forge.io/ranjantestenv/npm/
export FORGE_NPM_TOKEN=$CI_NPM_TOKEN
export FORGE_PYPI_REGISTRY=https://pypi.forge.io/ranjantestenv/simple/
export FORGE_PYPI_TOKEN=$CI_PYPI_TOKEN

forge install  # Uses environment config
```

---

This system provides the same flexibility as npm's .npmrc but in a more structured, cross-format way!