#!/bin/bash
set -e

: "${VERSION:?VERSION is required}"
: "${CLOUDSMITH_ORG:?CLOUDSMITH_ORG is required}"
: "${CLOUDSMITH_REPO:?CLOUDSMITH_REPO is required}"

CHOCO_DIR="scripts/chocolatey"
BINARY_URL="https://dl.cloudsmith.io/public/${CLOUDSMITH_ORG}/${CLOUDSMITH_REPO}/raw/versions/${VERSION}/forge-win-x64.exe"

echo "🍫 Building Chocolatey package for Forge v${VERSION}"
echo ""

# Check if we have the Windows binary locally (for checksum)
if [ -f "dist/forge-win-x64.exe" ]; then
    echo "📦 Using local binary for checksum..."
    CHECKSUM=$(shasum -a 256 dist/forge-win-x64.exe | awk '{print $1}')
else
    echo "⬇️  Downloading binary from Cloudsmith to calculate checksum..."
    TEMP_FILE=$(mktemp)
    if curl -fsSL "$BINARY_URL" -o "$TEMP_FILE" 2>/dev/null; then
        CHECKSUM=$(shasum -a 256 "$TEMP_FILE" | awk '{print $1}')
        rm -f "$TEMP_FILE"
    else
        echo "❌ Error: Could not download binary from $BINARY_URL"
        echo "   Make sure the binary is uploaded to Cloudsmith first, or run 'npm run build:bin' to build locally."
        exit 1
    fi
fi

echo "✅ SHA256 Checksum: $CHECKSUM"
echo ""

# Generate the chocolateyInstall.ps1 with the correct URL and checksum
cat > "$CHOCO_DIR/tools/chocolateyInstall.ps1" << EOF
\$ErrorActionPreference = 'Stop'

\$toolsDir = "\$(Split-Path -Parent \$MyInvocation.MyCommand.Definition)"
\$exePath = Join-Path \$toolsDir 'forge.exe'

\$packageArgs = @{
  packageName   = \$env:ChocolateyPackageName
  fileFullPath  = \$exePath
  url           = '$BINARY_URL'
  checksum      = '$CHECKSUM'
  checksumType  = 'sha256'
}

Get-ChocolateyWebFile @packageArgs

# Create shim so 'forge' works from anywhere
Install-BinFile -Name 'forge' -Path \$exePath
EOF

echo "✅ Updated chocolateyInstall.ps1 with URL and checksum"

# Update version in nuspec
sed -i '' "s/<version>.*<\/version>/<version>${VERSION}<\/version>/" "$CHOCO_DIR/forge.nuspec"
echo "✅ Updated forge.nuspec version to ${VERSION}"
echo ""

# Check if nuget is available (works on macOS/Linux/Windows)
if command -v nuget &> /dev/null; then
    echo "📦 Running nuget pack..."
    cd "$CHOCO_DIR"
    nuget pack forge.nuspec -OutputDirectory ../../dist
    cd - > /dev/null
    echo ""
    echo "✅ Chocolatey package built successfully!"
    echo "   - dist/forge.${VERSION}.nupkg"
elif command -v choco &> /dev/null; then
    echo "📦 Running choco pack..."
    cd "$CHOCO_DIR"
    choco pack
    mv "forge.${VERSION}.nupkg" "../../dist/"
    cd - > /dev/null
    echo ""
    echo "✅ Chocolatey package built successfully!"
    echo "   - dist/forge.${VERSION}.nupkg"
else
    echo "⚠️  Neither nuget nor choco found on this system."
    echo "   Install nuget: brew install nuget (macOS) or apt install nuget (Linux)"
    echo "   Or use Windows with Chocolatey installed."
fi
