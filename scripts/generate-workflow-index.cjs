const fs = require('fs');
const path = require('path');

const workflowsDir = path.join(__dirname, '..', 'workflows');
const files = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort();

fs.writeFileSync(path.join(workflowsDir, 'index.json'), JSON.stringify(files, null, 2) + '\n');
console.log(`Generated workflows/index.json with ${files.length} workflow(s):\n  ${files.join('\n  ')}`);
