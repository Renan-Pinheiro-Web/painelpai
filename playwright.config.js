const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:5500',
        screenshot: 'on',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'mobile',
            use: { viewport: { width: 375, height: 812 } },
        },
        {
            name: 'tablet',
            use: { viewport: { width: 768, height: 1024 } },
        },
        {
            name: 'desktop',
            use: { viewport: { width: 1440, height: 900 } },
        },
    ],
    webServer: {
        command: 'npx serve . -l 5500 --no-clipboard',
        port: 5500,
        reuseExistingServer: true,
    },
});
