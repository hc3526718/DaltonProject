/**
 * Native platform module. Re-export shared symbols from the base `.ts` file
 * (explicit extension avoids Metro resolving `./daltonBootVideo` → this file again).
 */
export {
  DALTON_BOOT_VIDEO_BG,
  getDaltonBootVideoWebPath,
  warmDaltonBootVideoCache,
} from './daltonBootVideo';

/** Native-only: bundled asset (not used on web export). */
export const DALTON_BOOT_VIDEO_NATIVE = require('../../assets/VideoP.mp4');
