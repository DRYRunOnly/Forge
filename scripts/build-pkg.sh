#!/bin/bash
set -e

: "${VERSION:?VERSION is required}"
IDENTIFIER="io.cloudsmith.forge"

build_pkg() {
    local ARCH=$1
    local BINARY=$2
    
    echo "Building .pkg for macOS $ARCH..."
    
    PKG_ROOT="dist/pkg-root-$ARCH"
    
    # Clean and create directory structure
    rm -rf "$PKG_ROOT"
    mkdir -p "$PKG_ROOT/usr/local/bin"
    
    # Copy binary
    cp "dist/$BINARY" "$PKG_ROOT/usr/local/bin/forge"
    chmod 755 "$PKG_ROOT/usr/local/bin/forge"
    
    # Build the package
    pkgbuild \
        --root "$PKG_ROOT" \
        --identifier "$IDENTIFIER" \
        --version "$VERSION" \
        --install-location "/" \
        "dist/forge-${VERSION}-macos-${ARCH}.pkg"
    
    # Clean up
    rm -rf "$PKG_ROOT"
    
    echo "Created: dist/forge-${VERSION}-macos-${ARCH}.pkg"
}

# Check if binaries exist
if [ ! -f "dist/forge-macos-x64" ] || [ ! -f "dist/forge-macos-arm64" ]; then
    echo "Error: macOS binaries not found. Run 'npm run build:bin' first."
    exit 1
fi

# Build packages
build_pkg "x64" "forge-macos-x64"
build_pkg "arm64" "forge-macos-arm64"

echo ""
echo "✅ macOS .pkg installers built successfully!"
echo "   - dist/forge-${VERSION}-macos-x64.pkg"
echo "   - dist/forge-${VERSION}-macos-arm64.pkg"
