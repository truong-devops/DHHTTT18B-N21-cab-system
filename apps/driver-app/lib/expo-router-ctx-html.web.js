/** Optionally import `app/+html.js` file. */
export const ctx = require.context('../app', false, /\+html\.[tj]sx?$/, 'sync');
