# Grayed Out Extension

This is a [Plasmo extension](https://docs.plasmo.com/) project bootstrapped with [`plasmo init`](https://www.npmjs.com/package/plasmo). It's a simple extension to remind you that you're getting distracted.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher (recommended: 20.x for compatibility with dependencies)
- **pnpm**: Version 8.0.0 or higher (preferred package manager)
- **Operating System**: macOS, Windows, or Linux
- **Build Environment**: Ensure you have a modern web browser (e.g., Chrome or Firefox) for testing the extension

Install Node.js from [nodejs.org](https://nodejs.org/) and pnpm via `npm install -g pnpm` or follow the [pnpm installation guide](https://pnpm.io/installation).

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/vybhavab/grayedout.git
   cd grayedout
   ```

2. **Install dependencies**:

   ```bash
   pnpm i
   ```

3. **Run the development server**:

   ```bash
   pnpm dev
   ```

   Alternatively, use `npm run dev` if not using pnpm.

4. **Load the extension in your browser**:

   - Open your browser and navigate to the extensions page (e.g., `chrome://extensions/` for Chrome).
   - Enable "Developer mode" and load the unpacked extension from the `build/chrome-mv3-dev` directory.
   - For Firefox, use `build/firefox-mv3-dev`.

5. **Start editing**:
   - Modify `popup.tsx` for the popup interface. Changes auto-update.
   - Add an options page by creating `options.tsx` with a default exported React component.
   - Add a content script by creating `content.ts` and reloading the extension.

For further guidance, [visit the Plasmo Documentation](https://docs.plasmo.com/).

## Building the Project

Follow these step-by-step instructions to build the extension for production:

**Ensure dependencies are installed**:

   ```bash
   pnpm install
   ```

**Build for all targers**:

   ```bash
   pnpm export
   ```

   This generates the builds in the `build` directory for chrome and firefox with manifest-v3 format.

**Build for Chrome**:

   ```bash
   pnpm build:chrome
   ```

   This generates the Chrome build in the `build/chrome-mv3` directory.

**Build for Firefox**:
   ```bash
      pnpm build:firefox
   ```

   This generates the Firefox build in the `build/firefox-mv3` directory.

**Build for both browsers**:

    ```bash
    pnpm build
    ```

**Package the extension** (optional, for distribution):
    ```bash
    pnpm package
    ```
   This creates packaged versions ready for upload.

The production bundles will be in the `build/` directory, ready to be zipped and published to browser extension stores.

## Submit to the Webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
