const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** Block only this app's export output — not `node_modules/react-native-web/dist`. */
function blockAppOutputDir(dirName) {
  const abs = path.join(__dirname, dirName).replace(/\\/g, '/');
  const escaped = abs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(/|$)`);
}
const BLOCK_DIRS = [blockAppOutputDir('dist'), blockAppOutputDir('.expo-shared')];

function buildBaseConfig(projectRoot) {
  const base = getDefaultConfig(projectRoot);
  base.transformer = {
    ...base.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };
  const assetExts = base.resolver.assetExts.filter((ext) => ext !== 'svg');
  if (!assetExts.includes('riv')) {
    assetExts.push('riv');
  }
  base.resolver = {
    ...base.resolver,
    assetExts,
    sourceExts: [...base.resolver.sourceExts, 'svg'],
  };
  return base;
}

let config;
try {
  const { getSentryExpoConfig } = require('@sentry/react-native/metro');
  config = getSentryExpoConfig(__dirname, {
    getDefaultConfig: buildBaseConfig,
  });
} catch {
  console.warn(
    '[metro] @sentry/react-native not found — using default Expo config. Run: cd expo-app && npm install',
  );
  config = buildBaseConfig(__dirname);
}

config.resolver = {
  ...config.resolver,
  blockList: [...(config.resolver.blockList ?? []), ...BLOCK_DIRS],
};

/** CI (Vercel): lower parallelism to reduce peak memory during web export. */
const cpus = require('os').cpus()?.length ?? 2;
config.maxWorkers = process.env.CI
  ? 1
  : Math.min(4, Math.max(1, cpus));

module.exports = config;
