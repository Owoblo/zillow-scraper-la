#!/usr/bin/env bash
# Render build script for Puppeteer Chrome dependencies

echo "📦 Installing system dependencies for Chrome..."

# Install Chrome dependencies
apt-get update
apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  libu2f-udev \
  libvulkan1

echo "✅ System dependencies installed"

# Install Node.js dependencies (including Puppeteer)
echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Build complete!"
