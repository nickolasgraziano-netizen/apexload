import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.apexload.app",
  appName: "ApexLoad",
  webDir: "www",
  server: {
    url: "https://apexload-azure.vercel.app",
    cleartext: false,
  },
};

export default config;
