// Dev server: rebuilt models (npm run models) reload open pages, so lessons never keep a stale .glb in memory.
// /api goes to simulator/backend (YugMinds sign-in and assigned books).
const api = process.env.SIM_API || 'http://localhost:3100'; // SIM_API=http://localhost:3101 to test against another backend
export default {
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
  plugins: [{
    name: 'reload-on-model-change',
    handleHotUpdate({ file, server }) {
      if (/\/models\/[^/]+\.(glb|json)$/.test(file)) { server.ws.send({ type: 'full-reload' }); return []; }
    },
  }],
};
