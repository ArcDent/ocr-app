module.exports = {
  packagerConfig: {
    name: 'OCR-App',
    executableName: 'ocr-app',
    asar: true,
    icon: './resources/icon',
    ignore: [
      /^\/src/,
      /^\/docs/,
      /^\/\.git/,
      /^\/\.claude/,
      /^\/\.serena/,
      /^\/\.superpowers/,
      /^\/node_modules\/(?!.*\.node$)/
    ]
  },

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'OCR-App',
        authors: 'ArcDent',
        exe: 'ocr-app.exe',
        setupExe: 'OCR-App-Setup.exe',
        setupIcon: './resources/icon.ico',
        noMsi: true
      }
    }
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}
