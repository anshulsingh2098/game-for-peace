/* chase-camera feel (in the tuner under "camera"). fovKick: extra field of view (degrees) while boosting; fovAccel: degrees per m/s2 of hard acceleration; fovSpeed: degrees per m/s of speed
   (capped at 14); shake: strength of the high-speed shake (0 = none); shakeFrom: speed (m/s) where it starts; driftLag: how much slower the camera turns after the car in a slide */
export const CAMFX = { fovKick: 7, fovAccel: 0.5, fovSpeed: 0.16, shake: 1, shakeFrom: 28, driftLag: 1.2 };
