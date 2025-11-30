const fs = require('fs');
const path = require('path');

// Read the JSON file
const jsonPath = path.join(__dirname, 'hubi-photos-firebase-adminsdk-fbsvc-17b48d7b3a.json');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');

// Parse the JSON
const jsonObject = JSON.parse(jsonContent);

// Convert to string with proper escaping
// JSON.stringify automatically escapes all special characters including \n
const escapedJsonString = JSON.stringify(jsonObject);

console.log('\n=== ESCAPED JSON STRING (for Railway FIREBASE_SERVICE_ACCOUNT) ===\n');
console.log(escapedJsonString);
console.log('\n=== END ===\n');

// Also save to a file for easy copy-paste
const outputPath = path.join(__dirname, 'firebase-service-account-escaped.txt');
fs.writeFileSync(outputPath, escapedJsonString, 'utf8');
console.log(`✅ Escaped JSON saved to: ${outputPath}\n`);
console.log('📋 Copy the string above and paste it as FIREBASE_SERVICE_ACCOUNT in Railway\n');

