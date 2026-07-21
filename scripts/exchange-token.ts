/**
 * Automated Zoho OAuth Grant-Code-to-Access-Token Exchange Utility
 * Run with: npx tsx scripts/exchange-token.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const envPath = path.resolve('.env');
let envProjectId = '';
let envClientId = '';
let envClientSecret = '';
let envGrantCode = '';
let envToken = '';

// Parse existing .env file
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const matchPid = line.match(/^\s*VITE_CATALYST_PROJECT_ID\s*=\s*(.+)$/);
    const matchCid = line.match(/^\s*VITE_CATALYST_CLIENT_ID\s*=\s*(.+)$/);
    const matchSec = line.match(/^\s*VITE_CATALYST_CLIENT_SECRET\s*=\s*(.+)$/);
    const matchGrc = line.match(/^\s*VITE_CATALYST_GRANT_CODE\s*=\s*(.+)$/);
    const matchTok = line.match(/^\s*VITE_CATALYST_TOKEN\s*=\s*(.+)$/);
    
    if (matchPid) envProjectId = matchPid[1].trim();
    if (matchCid) envClientId = matchCid[1].trim();
    if (matchSec) envClientSecret = matchSec[1].trim();
    if (matchGrc) envGrantCode = matchGrc[1].trim();
    if (matchTok) envToken = matchTok[1].trim();
  }
}

const projectId = process.env.VITE_CATALYST_PROJECT_ID || envProjectId;
const clientId = process.env.VITE_CATALYST_CLIENT_ID || envClientId;
const clientSecret = process.env.VITE_CATALYST_CLIENT_SECRET || envClientSecret;
const grantCode = process.env.VITE_CATALYST_GRANT_CODE || envGrantCode || envToken; // Fallback if token was pasted into VITE_CATALYST_TOKEN

if (!clientId || !clientSecret || !grantCode) {
  console.error('\x1b[31mError: Missing OAuth credentials in .env file.\x1b[0m');
  console.error('Please ensure the following variables are set in your .env file:');
  console.error('  VITE_CATALYST_CLIENT_ID       - Client ID from Zoho API Console');
  console.error('  VITE_CATALYST_CLIENT_SECRET   - Client Secret from Zoho API Console');
  console.error('  VITE_CATALYST_GRANT_CODE      - Grant Code (Self Client generated token)');
  process.exit(1);
}

console.log(`\n\x1b[36m=== Zoho OAuth Token Exchange ===\x1b[0m`);
console.log(`Client ID: ${clientId}`);
console.log(`Code     : ${grantCode.substring(0, 12)}...`);

// Zoho supports different data centers (domains). We will try India (.in) and US/Global (.com) domains.
const accountsUrls = [
  'https://accounts.zoho.in/oauth/v2/token',
  'https://accounts.zoho.com/oauth/v2/token'
];

async function exchange() {
  let accessToken = '';
  let successfulUrl = '';
  
  for (const url of accountsUrls) {
    try {
      const params = new URLSearchParams({
        code: grantCode,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code'
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (response.ok) {
        const json: any = await response.json();
        if (json.access_token) {
          accessToken = json.access_token;
          successfulUrl = url;
          break;
        } else if (json.error) {
          console.warn(`[${url}] returned OAuth error: ${json.error}`);
        }
      } else {
        const errText = await response.text();
        console.warn(`[${url}] failed: ${response.status} - ${errText}`);
      }
    } catch (e: any) {
      console.warn(`[${url}] request error: ${e.message}`);
    }
  }
  
  if (!accessToken) {
    console.error('\n\x1b[31mError: OAuth exchange failed.\x1b[0m');
    console.error('Verify that:');
    console.error('  1. Client ID and Client Secret are correct.');
    console.error('  2. The Grant Code has not expired (must be used within 10 minutes of generation).');
    console.error('  3. The Grant Code has not already been used (it is single-use only).');
    process.exit(1);
  }
  
  console.log(`\x1b[32m✓ Token exchanged successfully via ${successfulUrl}!\x1b[0m`);
  console.log(`Access Token: ${accessToken.substring(0, 12)}...`);
  
  // Read current .env content
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Replace VITE_CATALYST_TOKEN line
  let updatedContent = '';
  let tokenLineUpdated = false;
  
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.match(/^\s*VITE_CATALYST_TOKEN\s*=/)) {
      updatedContent += `VITE_CATALYST_TOKEN=${accessToken}\n`;
      tokenLineUpdated = true;
    } else {
      // Keep other lines
      updatedContent += line + (line.endsWith('\n') ? '' : '\n');
    }
  }
  
  if (!tokenLineUpdated) {
    updatedContent += `\nVITE_CATALYST_TOKEN=${accessToken}\n`;
  }
  
  fs.writeFileSync(envPath, updatedContent.trim() + '\n', 'utf8');
  console.log(`\x1b[32m✓ Updated VITE_CATALYST_TOKEN in .env file.\x1b[0m`);
  
  // Run seeder automatically
  console.log(`\n\x1b[35m=== Starting Database Seeding ===\x1b[0m`);
  try {
    execSync('npm run db:seed', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to run db:seed command');
  }
}

exchange();
