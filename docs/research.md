# Package Manager Research

This document contains detailed research on how different package managers work, their formats, and protocols.

## Table of Contents

1. [npm (Node.js)](#npm-nodejs)
2. [pip (Python)](#pip-python)  
3. [Maven (Java)](#maven-java)
4. [Common Patterns](#common-patterns)
5. [Key Insights for forge](#key-insights-for-forge)

---

## npm (Node.js)

### Package Format
- **Manifest File**: `package.json`
- **Lock File**: `package-lock.json` (npm), `yarn.lock` (Yarn)
- **Install Directory**: `node_modules/`

### Key Components in package.json
```json
{
  "name": "my-package",
  "version": "1.0.0",
  "description": "Package description",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "~4.17.21"
  },
  "devDependencies": {
    "jest": "^28.0.0"
  },
  "peerDependencies": {
    "react": ">=16.0.0"
  },
  "scripts": {
    "test": "jest",
    "start": "node index.js"
  }
}
```

### Version Resolution
- **Semantic Versioning**: `MAJOR.MINOR.PATCH`
- **Range Operators**:
  - `^1.2.3`: Compatible with version, allows MINOR and PATCH updates
  - `~1.2.3`: Reasonably close to version, allows PATCH updates only
  - `>=1.2.3`: Greater than or equal
  - `1.2.3 - 2.3.4`: Range between versions

### Registry Protocol
- **Registry URL**: https://registry.npmjs.org/
- **Package Info**: `GET /{package-name}`
- **Tarball Download**: From URLs in registry response
- **Authentication**: Bearer tokens, .npmrc files

### Installation Process
1. Parse `package.json` and existing `package-lock.json`
2. Resolve dependency tree (avoiding conflicts)
3. Download tarballs for missing packages
4. Extract to `node_modules/` with flattened structure
5. Update/create `package-lock.json`
6. Run install scripts (preinstall, install, postinstall)

### Dependency Resolution Algorithm
- **Hoisting**: Attempts to place dependencies at the top level
- **Deduplication**: Same version used by multiple packages installed once
- **Conflict Resolution**: Different major versions can coexist in separate folders

---

## pip (Python)

### Package Format
- **Manifest Files**: 
  - `requirements.txt` (simple)
  - `setup.py` (traditional)
  - `pyproject.toml` (modern)
  - `Pipfile` (pipenv)
- **Lock File**: `Pipfile.lock`, `poetry.lock`
- **Install Directory**: site-packages in Python environment

### Requirements.txt Format
```txt
requests==2.28.0
django>=4.0,<5.0
numpy~=1.21.0
pytest>=6.0  # Comment
git+https://github.com/user/repo.git@v1.0#egg=package
-e git+https://github.com/user/repo.git#egg=package  # Editable install
```

### pyproject.toml Format (PEP 518)
```toml
[build-system]
requires = ["setuptools", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "my-package"
version = "1.0.0"
dependencies = [
    "requests>=2.20.0",
    "click>=7.0"
]

[project.optional-dependencies]
dev = ["pytest>=6.0", "black"]
docs = ["sphinx"]
```

### Registry Protocol
- **Registry URL**: https://pypi.org/
- **Simple API**: https://pypi.org/simple/ (PEP 503)
- **JSON API**: https://pypi.org/pypi/{package}/json
- **Package Downloads**: Direct from PyPI CDN

### Installation Process
1. Parse requirements/manifest files
2. Resolve dependencies using pip's resolver
3. Download wheels or source distributions
4. Build packages if needed (setup.py, PEP 517)
5. Install to site-packages
6. Update package metadata

### Version Resolution
- **PEP 440 Versioning**: More flexible than semver
- **Specifiers**: `==`, `>=`, `~=`, `!=`, etc.
- **Resolver**: Backtracking resolver (pip 20.3+)

---

## Maven (Java)

### Package Format
- **Manifest File**: `pom.xml`
- **Repository Structure**: `.m2/repository/` (local), hierarchical by group/artifact
- **Packaging**: JAR, WAR, EAR, POM

### pom.xml Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>my-app</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-core</artifactId>
            <version>5.3.21</version>
        </dependency>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <repositories>
        <repository>
            <id>central</id>
            <url>https://repo1.maven.org/maven2</url>
        </repository>
    </repositories>
</project>
```

### Coordinate System
- **Group ID**: `com.example` (reverse domain)
- **Artifact ID**: `my-app` (project name)
- **Version**: `1.0.0` 
- **Full Coordinate**: `com.example:my-app:1.0.0`

### Repository Structure
```
repository/
├── com/
│   └── example/
│       └── my-app/
│           └── 1.0.0/
│               ├── my-app-1.0.0.jar
│               ├── my-app-1.0.0.pom
│               └── my-app-1.0.0.jar.sha1
```

### Dependency Resolution
- **Transitive Dependencies**: Automatic resolution
- **Version Conflicts**: "Nearest wins" strategy
- **Scopes**: compile, test, runtime, provided, system
- **Exclusions**: Can exclude transitive dependencies

### Installation Process
1. Parse `pom.xml`
2. Build dependency graph with transitives
3. Resolve version conflicts
4. Download missing artifacts
5. Store in local repository cache
6. Build classpath for execution

---

## Common Patterns

### Universal Concepts
1. **Manifest Files**: All package managers use some form of manifest
2. **Version Resolution**: Most use semantic versioning or similar
3. **Dependency Graphs**: All handle transitive dependencies
4. **Caching**: Local caches for downloaded packages
5. **Lock Files**: Most modern managers have lock files for reproducible builds

### Registry Patterns
1. **HTTP APIs**: RESTful APIs for package metadata
2. **Authentication**: Token-based auth systems
3. **CDN Distribution**: Separate download URLs for artifacts
4. **Metadata + Artifacts**: Separation of package info and files

### Installation Patterns
1. **Dependency Resolution**: Graph-based algorithms
2. **Download + Extract**: Parallel downloads where possible
3. **Local Storage**: Cached packages for reuse
4. **Lifecycle Scripts**: Pre/post install hooks

---

## Key Insights for forge

### Architecture Decisions
1. **Plugin System**: Each package format needs its own plugin
2. **Common Interfaces**: Standardize operations across plugins
3. **Unified Cache**: Single cache system for all package types
4. **Registry Abstraction**: Generic registry client with format-specific adapters

### Core Abstractions
```
PackageManager Interface:
├── parseManifest(file) -> Manifest
├── resolveDependendencies(manifest) -> DependencyGraph  
├── downloadPackages(dependencies) -> PackageSet
├── installPackages(packages, location) -> InstallResult
└── createLockFile(dependencies) -> LockFile
```

### Implementation Strategy
1. Start with npm (most complex dependency resolution)
2. Build core abstractions based on npm requirements
3. Extend abstractions as needed for other formats
4. Focus on correctness before performance
5. Maintain compatibility with existing toolchains

### Technical Challenges
1. **Version Resolution**: Different algorithms across formats
2. **Dependency Conflicts**: Cross-format dependency management
3. **Build Systems**: Integration with language-specific build tools
4. **Performance**: Parallel downloads and efficient caching
5. **Security**: Package verification and vulnerability scanning