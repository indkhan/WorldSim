import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/e2e",
  workers:process.env.CI?1:undefined,
  use:{baseURL:"http://127.0.0.1:3000"},
  webServer:{command:"npm run dev -- --hostname 127.0.0.1",url:"http://127.0.0.1:3000",reuseExistingServer:true},
});
