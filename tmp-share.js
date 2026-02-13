const period = {
  id: '5b65',
  name: 'Findi Fev',
  startDate: '2026-02-06',
  endDate: '2026-02-08',
  status: 'validado',
  people: ['Thiago','Gabi','Gabriel','Eduarda','Cristiano','Tati','Jacque'],
}
const expenses = [
  { amount: 232.56, participants: period.people, type: 'comida' },
  { amount: 96.05, participants: period.people, type: 'comida' },
  { amount: 316.78, participants: period.people, type: 'comida' },
]
const PERSON_GROUP_TYPES = [{ key: 'comida', label: 'Comida' }, { key: 'bebida', label: 'Bebida' }]
const createDefaultGroupCounts = () =>
  PERSON_GROUP_TYPES.reduce((acc, item) => ({ ...acc, [item.key]: 1 }), {})
const sanitizedPeople = period.people.map((name) => ({ name, counts: createDefaultGroupCounts() }))
const getExpenseWeight = (person, expenseType) => {
  if (!person) return 1
  const typeKey = (expenseType || '').toLowerCase()
  const counts = person.counts || {}
  const firstType = PERSON_GROUP_TYPES.find(({ key }) => key === typeKey)
  if (firstType && counts[firstType.key] > 0) {
    return counts[firstType.key]
  }
  const total = PERSON_GROUP_TYPES.reduce((sum, type) => sum + (counts[type.key] || 0), 0)
  return total > 0 ? total : 1
}
const summary = {}
const personMap = {}
sanitizedPeople.forEach((person) => {
  summary[person.name] = 0
  personMap[person.name] = person
})
expenses.forEach((expense) => {
  const participants = expense.participants || []
  if (!participants.length) return
  const weights = participants.map((name) => ({
    name,
    weight: getExpenseWeight(personMap[name], expense.type),
  }))
  const totalWeight = weights.reduce((sum, current) => sum + current.weight, 0)
  const unitShare = expense.amount / totalWeight
  weights.forEach(({ name, weight }) => {
    summary[name] = (summary[name] || 0) + unitShare * weight
  })
})
const totalSum = Object.values(summary).reduce((a, b) => a + b, 0)
console.log('sum', totalSum.toFixed(2))
console.log(summary)
