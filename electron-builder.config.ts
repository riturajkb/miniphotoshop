import type { Config } from "electron-builder";

export default {
  appId: "com.miniphotoshop.app",
  productName: "MiniPhotoshop",
  directories: {
    output: "release",
  },
  files: ["out/**/*"],
  mac: {
    target: ["dmg"],
    category: "public.app-category.graphics-design",
  },
  win: {
    target: ["nsis"],
    artifactName: "${productName}-${version}-Setup.${ext}",
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Graphics",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
} satisfies Config;
