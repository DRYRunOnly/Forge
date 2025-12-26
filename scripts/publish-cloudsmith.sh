#!/bin/bash
# Publish all Forge artifacts to Cloudsmith

set -e

: "${VERSION:?VERSION is required}"
: "${CLOUDSMITH_ORG:?CLOUDSMITH_ORG is required}"
: "${CLOUDSMITH_REPO:?CLOUDSMITH_REPO is required}"

ORG="$CLOUDSMITH_ORG"
REPO="$CLOUDSMITH_REPO"
DIST_DIR="dist"

echo "🚀 Publishing Forge v${VERSION} to Cloudsmith"
echo "   Organization: ${ORG}"
echo "   Repository: ${REPO}"
echo ""

# Check if cloudsmith CLI is installed
if ! command -v cloudsmith &> /dev/null; then
    echo "❌ Error: cloudsmith CLI not found."
    echo "   Install with: brew install cloudsmith-io/cloudsmith-cli/cloudsmith-cli"
    echo "   Or: pip install cloudsmith-cli"
    exit 1
fi

# Check if logged in
if ! cloudsmith whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudsmith."
    echo "   Run: cloudsmith login"
    exit 1
fi

# Track success/failure
FAILED=0

publish_deb() {
    local FILE=$1
    local DISTRO_RELEASE=$2
    
    if [ -f "$FILE" ]; then
        echo "📦 Publishing $(basename $FILE)..."
        if cloudsmith push deb $DISTRO_RELEASE $FILE; then
            echo "   ✅ Success"
        else
            echo "   ❌ Failed"
            FAILED=1
        fi
    else
        echo "⚠️  Skipping $(basename $FILE) - file not found"
    fi
}

publish_raw() {
    local FILE=$1
    local EXTRA_ARGS=$2
    
    if [ -f "$FILE" ]; then
        echo "📦 Publishing $(basename $FILE)..."
        if cloudsmith push raw $ORG/$REPO $FILE $EXTRA_ARGS; then
            echo "   ✅ Success"
        else
            echo "   ❌ Failed"
            FAILED=1
        fi
    else
        echo "⚠️  Skipping $(basename $FILE) - file not found"
    fi
}

publish_nuget() {
    local FILE=$1
    
    if [ -f "$FILE" ]; then
        echo "📦 Publishing $(basename $FILE)..."
        if cloudsmith push nuget $ORG/$REPO $FILE; then
            echo "   ✅ Success"
        else
            echo "   ❌ Failed"
            FAILED=1
        fi
    else
        echo "⚠️  Skipping $(basename $FILE) - file not found"
    fi
}

echo "═══════════════════════════════════════════════════════════"
echo "📦 Debian Packages"
echo "═══════════════════════════════════════════════════════════"
publish_deb "$DIST_DIR/forge_${VERSION}_amd64.deb" "$ORG/$REPO/any-distro/any-version"
publish_deb "$DIST_DIR/forge_${VERSION}_arm64.deb" "$ORG/$REPO/any-distro/any-version"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🍎 macOS Packages"
echo "═══════════════════════════════════════════════════════════"
publish_raw "$DIST_DIR/forge-${VERSION}-macos-x64.pkg" "--version $VERSION"
publish_raw "$DIST_DIR/forge-${VERSION}-macos-arm64.pkg" "--version $VERSION"
publish_raw "$DIST_DIR/forge-macos-x64" "--version $VERSION"
publish_raw "$DIST_DIR/forge-macos-arm64" "--version $VERSION"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🐧 Linux Raw Binaries"
echo "═══════════════════════════════════════════════════════════"
publish_raw "$DIST_DIR/forge-linux-x64" "--version $VERSION"
publish_raw "$DIST_DIR/forge-linux-arm64" "--version $VERSION"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🪟 Windows Packages"
echo "═══════════════════════════════════════════════════════════"
publish_raw "$DIST_DIR/forge-win-x64.exe" "--version $VERSION"
publish_nuget "$DIST_DIR/forge.${VERSION}.nupkg"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📦 npm Package"
echo "═══════════════════════════════════════════════════════════"
echo "Creating npm tarball..."
npm pack
NPM_TARBALL="forge-${VERSION}.tgz"
if [ -f "$NPM_TARBALL" ]; then
    echo "📦 Publishing $NPM_TARBALL..."
    if cloudsmith push npm $ORG/$REPO $NPM_TARBALL; then
        echo "   ✅ npm package published"
        rm -f "$NPM_TARBALL"
    else
        echo "   ❌ Failed to publish npm package"
        FAILED=1
    fi
else
    echo "   ❌ Failed to create npm tarball"
    FAILED=1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo "✅ All packages published successfully!"
else
    echo "⚠️  Some packages failed to publish. Check the output above."
    exit 1
fi
