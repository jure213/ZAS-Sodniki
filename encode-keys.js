// Run this once to generate encoded keys: node encode-keys.js

function xorEncode(str, key) {
  let encoded = '';
  for (let i = 0; i < str.length; i++) {
    encoded += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(encoded).toString('base64');
}

const SECRET_KEY = 'ZAS_SODNIKI_2025'; // Change this to something unique

const url = 'https://orcpdhrgmhiuzlnrixsn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yY3BkaHJnbWhpdXpsbnJpeHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODM2MzMsImV4cCI6MjA3NzE1OTYzM30.ai4WMKOrSHUqbpOYvscNNDJ_f-R7zakdH4q1UbdOUW4';

console.log('Encoded URL:', xorEncode(url, SECRET_KEY));
console.log('Encoded KEY:', xorEncode(key, SECRET_KEY));
console.log('\nUse SECRET_KEY:', SECRET_KEY);
