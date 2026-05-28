App Icon Generator - ConvertICO.com
=====================================

Generated icons for: iOS, Android, Web
Generated on: 18/04/2026

FOLDER STRUCTURE
================

iOS/
  - Contains all iOS app icon sizes
  - Add to your Xcode project's Assets.xcassets/AppIcon.appiconset/
  - Update Contents.json accordingly

Android/
  - mipmap-mdpi/ through mipmap-xxxhdpi/ folders
  - Copy folders directly to your app/src/main/res/ directory
  - playstore-icon.png (512x512) for Google Play Store
  - Adaptive icon assets (ic_launcher_foreground.png, ic_launcher_background.png)
  - values/colors.xml contains the background color


Web/
  - favicon.ico - Multi-size favicon for browsers
  - PNG icons in various sizes for different uses
  - apple-touch-icon.png - For iOS Safari bookmarks
  - manifest.json - PWA manifest file
  - html-snippet.txt - HTML code to add to your page


USAGE TIPS
==========

iOS:
- Drag icons into Xcode's asset catalog
- Xcode will automatically use correct sizes

Android:
- Copy mipmap folders to res/ directory
- For adaptive icons, add to AndroidManifest.xml:
  android:icon="@mipmap/ic_launcher"
  android:roundIcon="@mipmap/ic_launcher_round"

Web:
- Place files in your website's root directory
- Add HTML snippet to your <head> section

---
Generated with ConvertICO.com App Icon Generator
https://convertico.com/app-icon-generator/

---
Dalton Expo wiring (this repo)
===============================
- app.config.js / app.json use:
  - iOS/Icon-1024.png           -> expo root "icon" (store / Android base)
  - iOS/Icon-76@2x.png          -> expo "ios.icon" (152px home-screen source)
  - Android/mipmap-xxxhdpi/ic_launcher_foreground.png -> adaptiveIcon.foreground + monochrome
  - Web/favicon-48x48.png       -> web.favicon
- Splash stays: ../dalton_logo_final_img.png (not this folder).
- Android/ic_launcher_background.png + values/colors.xml use #0a0a0a (matches expo adaptiveIcon.backgroundColor).
- Raw iOS/Android mipmaps are for manual native projects; Expo regenerates sizes from Icon-1024 + foreground at EAS/prebuild.
