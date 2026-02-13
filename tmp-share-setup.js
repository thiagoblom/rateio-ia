const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json','utf-8'));
const persons = db.periods.find((p)=>p.id==='98ad').people;
const expenses = db.expenses.filter((e)=>e.periodId==='98ad');
const PERSON_GROUP_TYPES = [
  { key: 'comida', label: 'Comida' },
  { key: 'bebida', label: 'Bebida' },
];
const toSafeInteger = (value)=>{
  const numeric = Number(value);
  if(Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};
const getGroupPersonCount = (counts = {}) => {
  const values = PERSON_GROUP_TYPES.map((type) => toSafeInteger(counts[type.key]));
  if (!values.length) return 1;
  return Math.max(1, ...values);
};
const normalizeName = (value) => (value || '').toString().trim();
const normalizePersonKey = (value) => normalizeName(value).toLowerCase();
const normalizeParticipantName = (participant) => {
  if (!participant) return '';
  if (typeof participant === 'string') return normalizeName(participant);
  if (typeof participant === 'object') return normalizeName(participant.name || '');
  return '';
};
const normalizeParticipantKey = (participant) => normalizePersonKey(normalizeParticipantName(participant));
const personMap = {};
persons.forEach(person=>{
  personMap[normalizePersonKey(person.name)] = person;
});
const summary = {};
for(const expense of expenses){
  const participants = expense.participants||[];
  const selected = new Set();
  participants.forEach((participant)=>{
    const key = normalizeParticipantKey(participant);
    if(key && personMap[key]) selected.add(key);
  });
  if(!selected.size) continue;
  const units = Array.from(selected).map((key)=>({ key, units:getGroupPersonCount(personMap[key].counts)}));
  const totalUnits = units.reduce((sum,item)=>sum+item.units,0);
  if(!totalUnits) continue;
  units.forEach(({key, units})=>{
    const contribution = expense.amount * units / totalUnits;
    summary[key] = (summary[key]||0) + contribution;
  });
}
const getExpenseWeight = (person, expenseType) => {
  if (!person) return 1;
  const typeKey = (expenseType || '').toLowerCase();
  const counts = person.counts || {};
  const firstType = PERSON_GROUP_TYPES.find(({ key }) => key === typeKey);
  if (firstType && counts[firstType.key] > 0) {
    return counts[firstType.key];
  }
  const total = PERSON_GROUP_TYPES.reduce((sum, type) => sum + (counts[type.key] || 0), 0);
  return total > 0 ? total : 1;
};
const summaryWeighted = {};
for(const expense of expenses){
  const participants = expense.participants || [];
  const selected = new Set();
  participants.forEach((participant)=>{
    const key = normalizeParticipantKey(participant);
    if(key && personMap[key]) selected.add(key);
  });
  if(!selected.size) continue;
  const units = Array.from(selected).map((key)=>({ key, units:getExpenseWeight(personMap[key], expense.type)}));
  const totalUnits = units.reduce((sum,item)=>sum+item.units,0);
  if(!totalUnits) continue;
  units.forEach(({key, units})=>{
    const contribution = expense.amount * units / totalUnits;
    summaryWeighted[key] = (summaryWeighted[key]||0) + contribution;
  });
}
console.log({ summary, summaryWeighted });
