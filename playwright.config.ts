import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',workers:1,use:{baseURL:'http://127.0.0.1:3117'},webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3117',url:'http://127.0.0.1:3117',reuseExistingServer:false,env:{DATABASE_URL:'',OPENROUTER_API_KEY:'',WORLDSIM_PASSWORD:''},timeout:120000}});
