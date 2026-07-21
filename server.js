import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve the static files from the React app (dist folder)
app.use(express.static(path.join(__dirname, 'dist')));

// Handles any requests that don't match static files (client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Catalyst AppSail provides the port dynamically in X_ZOHO_CATALYST_LISTEN_PORT
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend server is running on port ${port}`);
});
