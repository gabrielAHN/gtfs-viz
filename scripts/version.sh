#!/bin/bash

# Version management script for GTFS Viz
# Usage: ./scripts/version.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Determine version bump type
BUMP_TYPE=${1:-patch}

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Version bump type must be 'patch', 'minor', or 'major'${NC}"
  exit 1
fi

echo -e "${YELLOW}Bumping ${BUMP_TYPE} version...${NC}"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump version based on type
case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo -e "${GREEN}New version will be: ${NEW_VERSION}${NC}"

# Confirm with user
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Aborted.${NC}"
  exit 1
fi

# Update package.json
echo -e "${YELLOW}Updating package.json...${NC}"
npm version $NEW_VERSION --no-git-tag-version

# Update VERSION file
echo -e "${YELLOW}Updating VERSION file...${NC}"
echo $NEW_VERSION > VERSION

# Update README badge
echo -e "${YELLOW}Updating README.md version badge...${NC}"
sed -i.bak "s/version-[0-9]*\.[0-9]*\.[0-9]*-blue/version-${NEW_VERSION}-blue/" README.md
rm README.md.bak

# Git operations
echo -e "${YELLOW}Staging changes...${NC}"
git add package.json VERSION README.md

echo -e "${YELLOW}Creating commit...${NC}"
git commit -m "chore: release v${NEW_VERSION}"

echo -e "${YELLOW}Creating git tag...${NC}"
git tag -a "v${NEW_VERSION}" -m "Release version ${NEW_VERSION}"

echo -e "${GREEN}✓ Version bumped to ${NEW_VERSION}${NC}"
echo -e "${YELLOW}To push changes and tags, run:${NC}"
echo -e "  git push origin main"
echo -e "  git push origin v${NEW_VERSION}"
echo ""
echo -e "${YELLOW}Or push both at once:${NC}"
echo -e "  git push origin main --follow-tags"
