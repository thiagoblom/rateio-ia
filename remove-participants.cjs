const fs = require('fs');
const path = 'db.json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
data.expenses = data.expenses.map((expense) => ({ ...expense, participants: [] }));
fs.writeFileSync(path, JSON.stringify(data, null, 2));
