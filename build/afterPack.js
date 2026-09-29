const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, 'assets', 'icon.ico');

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) {
    console.warn('afterPack: skip icon embed', { exePath, iconPath });
    return;
  }

  const { rcedit } = require('rcedit');
  await rcedit(exePath, { icon: iconPath });
  console.log('afterPack: embedded icon into', exePath);
};
