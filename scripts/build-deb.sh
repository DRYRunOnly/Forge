#!/bin/bash
set -e

: "${VERSION:?VERSION is required}"
MAINTAINER="Ranjan Singh <forge-maintainers@example.com>"
DESCRIPTION="Forge - A universal package manager that forges packages across ecosystems"
HOMEPAGE="https://github.com/DRYRunOnly/Forge"

# Create package for each architecture
build_deb() {
    local ARCH=$1
    local BINARY=$2
    local DEB_ARCH=$3
    
    echo "Building .deb for $ARCH..."
    
    PACKAGE_DIR="dist/forge_${VERSION}_${DEB_ARCH}"
    
    # Clean and create directory structure
    rm -rf "$PACKAGE_DIR"
    mkdir -p "$PACKAGE_DIR/DEBIAN"
    mkdir -p "$PACKAGE_DIR/usr/local/bin"
    
    # Copy binary
    cp "dist/$BINARY" "$PACKAGE_DIR/usr/local/bin/forge"
    chmod 755 "$PACKAGE_DIR/usr/local/bin/forge"
    
    # Create control file
    cat > "$PACKAGE_DIR/DEBIAN/control" << EOF
Package: forge
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: ${DEB_ARCH}
Maintainer: ${MAINTAINER}
Homepage: ${HOMEPAGE}
Description: ${DESCRIPTION}
 Forge is a universal package manager that provides a single, unified
 interface for managing packages across multiple ecosystems including
 Node.js (npm), Python (pip), and more.
EOF

    # Build the package
    dpkg-deb --root-owner-group --build "$PACKAGE_DIR"
    
    # Move to cleaner name
    mv "${PACKAGE_DIR}.deb" "dist/forge_${VERSION}_${DEB_ARCH}.deb"
    
    # Clean up
    rm -rf "$PACKAGE_DIR"
    
    echo "Created: dist/forge_${VERSION}_${DEB_ARCH}.deb"
}

# Check if binaries exist
if [ ! -f "dist/forge-linux-x64" ] || [ ! -f "dist/forge-linux-arm64" ]; then
    echo "Error: Linux binaries not found. Run 'npm run build:bin' first."
    exit 1
fi

# Check if dpkg-deb is available
if ! command -v dpkg-deb &> /dev/null; then
    echo "Error: dpkg-deb not found. Install dpkg or run this on a Debian-based system."
    echo "On macOS: brew install dpkg"
    exit 1
fi

# Build packages
build_deb "linux-x64" "forge-linux-x64" "amd64"
build_deb "linux-arm64" "forge-linux-arm64" "arm64"

echo ""
echo "✅ Debian packages built successfully!"
echo "   - dist/forge_${VERSION}_amd64.deb"
echo "   - dist/forge_${VERSION}_arm64.deb"
