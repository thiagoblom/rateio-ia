import { useMemo, useState, useEffect, useCallback } from 'react'
import './App.css'
import AuthModule from './components/AuthModule'
import PeriodModule from './components/PeriodModule'
import PendingModule from './components/PendingModule'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const ROLE_LABELS = {
  admin: 'Admin',
  gestor: 'Gestor',
  consultar: 'Consultar',
}

const MODULES = [
  { id: 'period', label: 'Periodos e rateio' },
  { id: 'pending', label: 'Pendentes e lancamentos' },
]

const PERIOD_STATUS_FILTERS = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Novo', value: 'novo' },
  { label: 'Validado', value: 'validado' },
  { label: 'Pago', value: 'pago' },
]

const PERIOD_STATUS_OPTIONS = [
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Novo', value: 'novo' },
  { label: 'Validado', value: 'validado' },
  { label: 'Pago', value: 'pago' },
]

const PERIOD_STATUS_LABELS = {
  pendente: 'Pendentes',
  novo: 'Novo',
  validado: 'Validado',
  pago: 'Pago',
}

const PERIOD_STATUS_SEVERITY = {
  pendente: 'warning',
  novo: 'info',
  validado: 'success',
  pago: 'success',
}

const EMPTY_EXPENSE = {
  date: '',
  category: 'Diversos',
  description: '',
  notes: '',
  amount: '',
  type: 'comida',
  payer: 'C6',
  periodId: '',
}

const EMPTY_PERIOD = {
  name: '',
  startDate: '',
  endDate: '',
}

const PERSON_GROUP_TYPES = [
  { key: 'comida', label: 'Comida' },
  { key: 'bebida', label: 'Bebida' },
]

const createDefaultGroupCounts = () =>
  PERSON_GROUP_TYPES.reduce((acc, item) => ({ ...acc, [item.key]: 1 }), {})

const getGroupPersonCount = (counts = {}, expenseType) => {
  const typeKey = (expenseType || '').toLowerCase()
  const matchingType = PERSON_GROUP_TYPES.find((type) => type.key === typeKey)
  if (matchingType) {
    const specific = toSafeInteger(counts[matchingType.key])
    if (specific > 0) {
      return specific
    }
  }
  const values = PERSON_GROUP_TYPES.map((type) => toSafeInteger(counts[type.key]))
  if (!values.length) return 1
  return Math.max(1, ...values)
}

const toSafeInteger = (value) => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.floor(numeric))
}

const sanitizeCounts = (counts) => {
  const next = {}
  let sum = 0
  PERSON_GROUP_TYPES.forEach(({ key }) => {
    const value = toSafeInteger(counts?.[key])
    next[key] = value
    sum += value
  })
  if (!sum) {
    next[PERSON_GROUP_TYPES[0].key] = 1
  }
  return next
}

const normalizePersonEntry = (entry) => {
  if (!entry) return null
  if (typeof entry === 'string') {
    return { name: entry, counts: createDefaultGroupCounts() }
  }
  const cleanedName = (entry.name || entry)?.toString().trim()
  if (!cleanedName) return null
  return {
    name: cleanedName,
    counts: sanitizeCounts(entry.counts),
  }
}

const normalizePeriod = (period) => ({
  ...period,
  people: (period.people || []).map((person) => normalizePersonEntry(person)).filter(Boolean),
})

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

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

const normalizeName = (value) => (value || '').toString().trim()
const normalizePersonKey = (value) => normalizeName(value).toLowerCase()

const normalizeParticipantName = (participant) => {
  if (!participant) return ''
  if (typeof participant === 'string') return normalizeName(participant)
  if (typeof participant === 'object') return normalizeName(participant.name || '')
  return ''
}

const normalizeParticipantKey = (participant) =>
  normalizePersonKey(normalizeParticipantName(participant))

const normalizeExpenseParticipants = (participants) =>
  (participants || [])
    .map((participant) => normalizeParticipantName(participant))
    .filter(Boolean)

const normalizeExpensePayload = (expense) => ({
  ...expense,
  participants: normalizeExpenseParticipants(expense.participants),
})

const getParticipantNamesFromPeriod = (period) =>
  (period?.people || [])
    .map((person) => normalizeParticipantName(person))
    .filter(Boolean)

const parseCsvNumber = (value) => {
  const cleaned = (value || '')
    .toString()
    .trim()
    .replace(/[^\d,.-]/g, '')
  if (!cleaned) return 0
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number.parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (cleaned.includes(',')) {
    return Number.parseFloat(cleaned.replace(',', '.')) || 0
  }
  return Number.parseFloat(cleaned) || 0
}

const detectDelimiter = (header) => {
  if (!header) return ','
  const delimiters = [',', ';', '\t']
  let chosen = ','
  let maxCount = -1
  delimiters.forEach((delimiter) => {
    const count = (header.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    if (count > maxCount) {
      maxCount = count
      chosen = delimiter
    }
  })
  return chosen
}

const parseCsvExpenses = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length)
  if (lines.length <= 1) return []
  const delimiter = detectDelimiter(lines[0])
  const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase())
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })
  const getValue = (row, aliases) => {
    for (const alias of aliases) {
      const key = alias.toLowerCase()
      if (row[key]) return row[key]
    }
    return ''
  }
  return rows
    .map((row) => {
      const expense = {
        date: getValue(row, ['data', 'date']),
        category: getValue(row, ['categoria', 'category']),
        description: getValue(row, ['descricao', 'description']),
        notes: getValue(row, ['obs', 'observacoes', 'notes']),
        payer: getValue(row, ['pagante', 'payer']),
        amount: parseCsvNumber(getValue(row, ['valor', 'amount'])),
        type: getValue(row, ['tipo', 'type']) || 'diversos',
      }
      if (
        !expense.date ||
        !expense.category ||
        !expense.description ||
        !expense.payer ||
        expense.amount <= 0
      ) {
        return null
      }
      return expense
    })
    .filter(Boolean)
}

const getUserInitials = (user) => {
  const text = (user?.name || user?.username || '').trim()
  if (!text) return ''
  const parts = text.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return `${first}${last}`.toUpperCase()
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'gestor',
  })
  const [authError, setAuthError] = useState('')

  const [periods, setPeriods] = useState([])
  const [expenses, setExpenses] = useState([])
  const [pendingTargets, setPendingTargets] = useState({})
  const [selectedPeriodId, setSelectedPeriodId] = useState(null)
  const [periodForm, setPeriodForm] = useState(EMPTY_PERIOD)
  const [periodPeople, setPeriodPeople] = useState([])
  const [newPeriodPersonInput, setNewPeriodPersonInput] = useState('')
  const [newPeriodPersonCounts, setNewPeriodPersonCounts] = useState(() => createDefaultGroupCounts())
  const [existingPersonInput, setExistingPersonInput] = useState('')
  const [existingPersonCounts, setExistingPersonCounts] = useState(() => createDefaultGroupCounts())
  const [editingPersonName, setEditingPersonName] = useState(null)
  const [importStatus, setImportStatus] = useState('')
  const [importError, setImportError] = useState('')

  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE)
  const [expenseError, setExpenseError] = useState('')
  const [appError, setAppError] = useState('')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rateio-theme') || 'dark'
  })
  const [editingExpense, setEditingExpense] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeModule, setActiveModule] = useState('period')
  const [periodStatusFilter, setPeriodStatusFilter] = useState('all')
  const [newPeriodDialogVisible, setNewPeriodDialogVisible] = useState(false)
  const [periodEditDialogVisible, setPeriodEditDialogVisible] = useState(false)
  const [periodEditForm, setPeriodEditForm] = useState(EMPTY_PERIOD)
  const [periodEditError, setPeriodEditError] = useState('')

  const canEdit = currentUser?.role !== 'consultar'
  const userInitials = useMemo(() => getUserInitials(currentUser), [currentUser])

  const handleOpenNewPeriodDialog = () => {
    setNewPeriodDialogVisible(true)
  }

  const handleCloseNewPeriodDialog = () => {
    setNewPeriodDialogVisible(false)
    setPeriodForm(EMPTY_PERIOD)
    setPeriodPeople([])
    setNewPeriodPersonInput('')
    setNewPeriodPersonCounts(createDefaultGroupCounts())
  }

  const handleOpenPeriodEditDialog = () => {
    if (!selectedPeriod) return
    setPeriodEditError('')
    setPeriodEditForm({
      name: selectedPeriod.name || '',
      startDate: selectedPeriod.startDate || '',
      endDate: selectedPeriod.endDate || '',
    })
    setPeriodEditDialogVisible(true)
  }

  const handleClosePeriodEditDialog = () => {
    setPeriodEditDialogVisible(false)
    setPeriodEditForm(EMPTY_PERIOD)
    setPeriodEditError('')
  }

  const handlePeriodEditFormChange = (field, value) => {
    setPeriodEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveEditedPeriod = async (event) => {
    event.preventDefault()
    if (!selectedPeriod) return
    if (!periodEditForm.name || !periodEditForm.startDate || !periodEditForm.endDate) {
      setPeriodEditError('Preencha nome, inicio e fim do periodo.')
      return
    }
    try {
      const response = await fetch(`${API_URL}/periods/${selectedPeriod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: periodEditForm.name,
          startDate: periodEditForm.startDate,
          endDate: periodEditForm.endDate,
        }),
      })
      const updated = await response.json()
      const normalized = normalizePeriod(updated)
      setPeriods((prev) => prev.map((period) => (period.id === normalized.id ? normalized : period)))
      setPeriodEditDialogVisible(false)
      setPeriodEditForm(EMPTY_PERIOD)
      setPeriodEditError('')
    } catch (error) {
      setPeriodEditError('Erro ao atualizar o periodo.')
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('rateio-user')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      setCurrentUser(parsed)
    } catch {
      localStorage.removeItem('rateio-user')
    }
  }, [])

  const persistUser = (user) => {
    setCurrentUser(user)
    localStorage.setItem('rateio-user', JSON.stringify(user))
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rateio-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const fetchData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setAppError('')
    try {
      const [periodData, expenseData] = await Promise.all([
        fetch(`${API_URL}/periods`).then((res) => res.json()),
        fetch(`${API_URL}/expenses`).then((res) => res.json()),
      ])
      const normalized = periodData.map(normalizePeriod)
      setPeriods(normalized)
      setExpenses(expenseData.map((expense) => normalizeExpensePayload(expense)))
    } catch (error) {
      setAppError('Nao foi possivel carregar os dados. Verifique o json-server.')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || activeModule !== 'period') return
    fetchData()
  }, [currentUser, activeModule, fetchData])

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId),
    [periods, selectedPeriodId],
  )

  const pendingExpenses = useMemo(
    () => expenses.filter((expense) => !expense.periodId),
    [expenses],
  )

  const periodExpenses = useMemo(() => {
    if (!selectedPeriod) return []
    return expenses.filter((expense) => expense.periodId === selectedPeriod.id)
  }, [expenses, selectedPeriod])

  const selectedPeriodPeople = useMemo(() => selectedPeriod?.people || [], [selectedPeriod])
  const periodPeopleList = useMemo(
    () => selectedPeriodPeople.map((person) => person.name),
    [selectedPeriodPeople],
  )

  const periodSummaries = useMemo(() => {
    return periods.map((period) => {
      const periodExpenses = expenses.filter((expense) => expense.periodId === period.id)
      const total = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      return {
        ...period,
        peopleCount: period.people?.length || 0,
        expenseCount: periodExpenses.length,
        total,
        status: period.status || 'pendente',
      }
    })
  }, [periods, expenses])

  const filteredPeriodSummaries = useMemo(() => {
    if (periodStatusFilter === 'all') return periodSummaries
    return periodSummaries.filter((period) => period.status === periodStatusFilter)
  }, [periodSummaries, periodStatusFilter])

  const shareSummary = useMemo(() => {
    if (!selectedPeriod) return []
    const summary = {}
    const personMap = {}
    selectedPeriodPeople.forEach((person) => {
      const key = normalizePersonKey(person.name)
      if (!key) return
      summary[key] = 0
      personMap[key] = person
    })
    periodExpenses.forEach((expense) => {
      const participants = expense.participants || []
      const selectedKeys = new Set()
      participants.forEach((participant) => {
        const key = normalizeParticipantKey(participant)
        if (!key || !(key in personMap)) return
        selectedKeys.add(key)
      })
      if (!selectedKeys.size) return
      const expenseUnits = Array.from(selectedKeys).map((key) => ({
        key,
        units: getGroupPersonCount(personMap[key]?.counts, expense.type),
      }))
      const totalUnits = expenseUnits.reduce((sum, item) => sum + item.units, 0)
      if (!totalUnits) return
      expenseUnits.forEach(({ key, units }) => {
        const contribution = (Number(expense.amount || 0) * units) / totalUnits
        summary[key] = (summary[key] || 0) + contribution
      })
    })
    return Object.entries(summary).map(([key, total]) => ({
      person: personMap[key]?.name || key,
      key,
      total,
    }))
  }, [periodExpenses, selectedPeriodPeople, selectedPeriod])

  const personPayments = useMemo(() => {
    if (!selectedPeriod) return {}
    const payments = {}
    selectedPeriodPeople.forEach((person) => {
      const key = normalizePersonKey(person.name)
      if (key) {
        payments[key] = 0
      }
    })
    periodExpenses.forEach((expense) => {
      const payerKey = normalizePersonKey(expense.payer || '')
      if (!payerKey) return
      payments[payerKey] = (payments[payerKey] || 0) + Number(expense.amount || 0)
    })
    return payments
  }, [periodExpenses, selectedPeriodPeople, selectedPeriod])

  const personExpenseCounts = useMemo(() => {
    if (!selectedPeriod) return {}
    const counts = {}
    selectedPeriodPeople.forEach((person) => {
      const key = normalizePersonKey(person.name)
      if (key) {
        counts[key] = 0
      }
    })
    periodExpenses.forEach((expense) => {
      const participants = expense.participants || []
      const seen = new Set()
      participants.forEach((participant) => {
        const key = normalizeParticipantKey(participant)
        if (!key || seen.has(key)) return
        seen.add(key)
      })
      seen.forEach((key) => {
        if (counts[key] !== undefined) {
          counts[key] += 1
        }
      })
    })
    return counts
  }, [periodExpenses, selectedPeriodPeople, selectedPeriod])

  const totalMemberPayments = useMemo(() => {
    if (!selectedPeriod) return 0
    return selectedPeriodPeople.reduce((sum, person) => {
      const key = normalizePersonKey(person.name)
      return sum + (personPayments[key] || 0)
    }, 0)
  }, [personPayments, selectedPeriodPeople, selectedPeriod])

  const totalPeriodExpenses = useMemo(() => {
    return periodExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  }, [periodExpenses])

  const totalPersonUnits = useMemo(() => {
    return selectedPeriodPeople.reduce((sum, person) => {
      const counts = person.counts || {}
      const countValues = PERSON_GROUP_TYPES.map((type) => toSafeInteger(counts[type.key]))
      const personCount = countValues.length ? Math.max(1, ...countValues) : 1
      return sum + personCount
    }, 0)
  }, [selectedPeriodPeople])

  const perPersonShare = useMemo(() => {
    if (!totalPersonUnits) return 0
    return totalPeriodExpenses / totalPersonUnits
  }, [totalPeriodExpenses, totalPersonUnits])

  const remainingCardBalance = useMemo(() => {
    if (!selectedPeriod) return 0
    return totalPeriodExpenses - totalMemberPayments
  }, [totalPeriodExpenses, totalMemberPayments, selectedPeriod])
  const getPendingTargetId = (expenseId) => {
    const explicit = pendingTargets[expenseId]
    if (explicit !== undefined && explicit !== null) {
      return explicit
    }
    if (selectedPeriodId) {
      return selectedPeriodId
    }
    if (periods.length) {
      return periods[0].id
    }
    return null
  }

  const handlePendingTargetChange = (expenseId, value) => {
    const nextPeriodId = value || null
    setPendingTargets((prev) => ({ ...prev, [expenseId]: nextPeriodId }))
  }

  const clearPendingTarget = (expenseId) => {
    setPendingTargets((prev) => {
      const next = { ...prev }
      delete next[expenseId]
      return next
    })
  }

  const hasPeriods = periods.length > 0

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode)
    setAuthError('')
  }

  const handlePeriodFormChange = (field, value) => {
    setPeriodForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleNewPeriodPersonInputChange = (value) => {
    setNewPeriodPersonInput(value)
  }

  const handleNewPeriodPersonCountsChange = (type, value) => {
    setNewPeriodPersonCounts((prev) => ({ ...prev, [type]: toSafeInteger(value) }))
  }

  const handleExistingPersonInputChange = (value) => {
    setExistingPersonInput(value)
  }

  const handleExistingPersonCountsChange = (type, value) => {
    setExistingPersonCounts((prev) => ({ ...prev, [type]: toSafeInteger(value) }))
  }

  const handleStartEditPerson = (person) => {
    setExistingPersonInput(person.name)
    setExistingPersonCounts(person.counts)
    setEditingPersonName(person.name)
  }

  const handleCancelEditPerson = () => {
    setExistingPersonInput('')
    setExistingPersonCounts(createDefaultGroupCounts())
    setEditingPersonName(null)
  }

  const handleExpenseFormChange = (field, value) => {
    setExpenseForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAuthChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetAuth = () => {
    setAuthForm({ username: '', password: '', name: '', role: 'gestor' })
    setAuthError('')
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const response = await fetch(
        `${API_URL}/users?username=${encodeURIComponent(authForm.username)}`,
      )
      const data = await response.json()
      const user = data.find((item) => item.password === authForm.password)
      if (!user) {
        setAuthError('Usuario ou senha invalido.')
        return
      }
      persistUser(user)
      resetAuth()
    } catch (error) {
      setAuthError('Erro ao conectar com o servidor.')
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setAuthError('')
    if (!authForm.username || !authForm.password || !authForm.name) {
      setAuthError('Preencha todos os campos.')
      return
    }
    try {
      const existingResponse = await fetch(
        `${API_URL}/users?username=${encodeURIComponent(authForm.username)}`,
      )
      const existing = await existingResponse.json()
      if (existing.length) {
        setAuthError('Este usuario ja existe.')
        return
      }
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          password: authForm.password,
          name: authForm.name,
          role: authForm.role,
        }),
      })
      const newUser = await response.json()
      persistUser(newUser)
      resetAuth()
    } catch (error) {
      setAuthError('Erro ao cadastrar usuario.')
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('rateio-user')
    setSelectedPeriodId(null)
    setActiveModule('period')
  }

  const handleCreatePeriod = async (event) => {
    event.preventDefault()
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate) {
      setAppError('Informe nome, inicio e fim do periodo.')
      return
    }
    try {
      const response = await fetch(`${API_URL}/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...periodForm, people: periodPeople, status: 'pendente' }),
      })
      const newPeriod = await response.json()
      setPeriods((prev) => [...prev, normalizePeriod(newPeriod)])
      setSelectedPeriodId(newPeriod.id)
      setPeriodForm(EMPTY_PERIOD)
      setPeriodPeople([])
      setNewPeriodPersonInput('')
      handleCloseNewPeriodDialog()
    } catch (error) {
      setAppError('Erro ao criar periodo.')
    }
  }

  const handleUpdatePeriodStatus = async (periodId, status) => {
    try {
      const response = await fetch(`${API_URL}/periods/${periodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const updated = await response.json()
      const normalized = normalizePeriod(updated)
      setPeriods((prev) => prev.map((period) => (period.id === normalized.id ? normalized : period)))
      handleCancelEditPerson()
    } catch (error) {
      setAppError('Erro ao atualizar o status do periodo.')
    }
  }

  const handleAddPersonToNewPeriod = () => {
    const nextName = normalizeName(newPeriodPersonInput)
    if (!nextName) return
    if (
      periodPeople.some(
        (person) => person.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      setNewPeriodPersonInput('')
      return
    }
    setPeriodPeople((prev) => [...prev, { name: nextName, counts: sanitizeCounts(newPeriodPersonCounts) }])
    setNewPeriodPersonInput('')
    setNewPeriodPersonCounts(createDefaultGroupCounts())
  }

  const handleRemovePersonFromNewPeriod = (personName) => {
    setPeriodPeople((prev) => prev.filter((item) => item.name !== personName))
  }

  const handleAddPersonToPeriod = async () => {
    if (!selectedPeriod) return
    const nextName = normalizeName(existingPersonInput)
    if (!nextName) return
    const conflict = selectedPeriodPeople.some(
      (person) =>
        person.name.toLowerCase() === nextName.toLowerCase() &&
        person.name !== editingPersonName,
    )
    if (conflict) {
      setExistingPersonInput('')
      return
    }
    const nextCounts = sanitizeCounts(existingPersonCounts)
    const updatedPeople = editingPersonName
      ? selectedPeriodPeople.map((person) =>
          person.name === editingPersonName ? { name: nextName, counts: nextCounts } : person,
        )
      : [...selectedPeriodPeople, { name: nextName, counts: nextCounts }]
    try {
      const response = await fetch(`${API_URL}/periods/${selectedPeriod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people: updatedPeople }),
      })
      const updated = await response.json()
      const normalized = normalizePeriod(updated)
      setPeriods((prev) => prev.map((period) => (period.id === normalized.id ? normalized : period)))
      setExistingPersonInput('')
      setExistingPersonCounts(createDefaultGroupCounts())
      setEditingPersonName(null)
    } catch (error) {
      setAppError('Erro ao atualizar participantes.')
    }
  }

  const handleRemovePersonFromPeriod = async (personName) => {
    if (!selectedPeriod) return
    const updatedPeople = selectedPeriodPeople.filter((person) => person.name !== personName)
    try {
      const response = await fetch(`${API_URL}/periods/${selectedPeriod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people: updatedPeople }),
      })
      const updated = await response.json()
      const normalized = normalizePeriod(updated)
      setPeriods((prev) => prev.map((period) => (period.id === normalized.id ? normalized : period)))
    } catch (error) {
      setAppError('Erro ao remover participante.')
    }
  }

  const handleAddExpense = async (event) => {
    event.preventDefault()
    setExpenseError('')
    const amountValue = Number.parseFloat(expenseForm.amount)
    const categoryValue = expenseForm.category || 'Diversos'
    if (!expenseForm.date || !expenseForm.description || !expenseForm.payer) {
      setExpenseError('Preencha os campos obrigatorios.')
      return
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setExpenseError('Informe um valor valido.')
      return
    }
    try {
      const response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          category: categoryValue,
          amount: amountValue,
          periodId: expenseForm.periodId || null,
          participants: [],
        }),
      })
      const newExpense = await response.json()
      setExpenses((prev) => [...prev, normalizeExpensePayload(newExpense)])
      setExpenseForm(EMPTY_EXPENSE)
    } catch (error) {
      setExpenseError('Erro ao salvar gasto.')
    }
  }

  const handleRequestEditExpense = (expense) => {
    if (!expense) return
    setEditingExpense(expense)
  }

  const handleCancelEditExpense = () => {
    setEditingExpense(null)
  }

  const handleSaveEditedExpense = async (expenseId, updates) => {
    if (!expenseId) return
    try {
      const response = await fetch(`${API_URL}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const updated = await response.json()
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? normalizeExpensePayload(updated) : item)),
      )
      setEditingExpense(null)
      return updated
    } catch (error) {
      throw new Error('Erro ao atualizar o gasto.')
    }
  }

  const handleAssignExpense = async (expense, targetPeriodId) => {
    const periodId = targetPeriodId ?? getPendingTargetId(expense.id)
    if (!periodId) {
      setAppError('Selecione um periodo para enviar o gasto.')
      return
    }
    const targetPeriod = periods.find((period) => period.id === periodId)
    if (!targetPeriod) {
      setAppError('Periodo selecionado nao foi encontrado.')
      return
    }
    const participants = getParticipantNamesFromPeriod(targetPeriod)
    try {
      const response = await fetch(`${API_URL}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          participants,
        }),
      })
      const updated = await response.json()
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? normalizeExpensePayload(updated) : item)),
      )
      clearPendingTarget(expense.id)
    } catch (error) {
      setAppError('Erro ao adicionar gasto ao periodo.')
    }
  }

  const handleDeletePendingExpense = async (expense) => {
    try {
      await fetch(`${API_URL}/expenses/${expense.id}`, {
        method: 'DELETE',
      })
      clearPendingTarget(expense.id)
      setExpenses((prev) => prev.filter((item) => item.id !== expense.id))
    } catch (error) {
      setAppError('Erro ao excluir gasto pendente.')
    }
  }

  const handleRemoveExpenseFromPeriod = async (expense) => {
    try {
      const response = await fetch(`${API_URL}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: null, participants: [] }),
      })
      const updated = await response.json()
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? normalizeExpensePayload(updated) : item)),
      )
    } catch (error) {
      setAppError('Erro ao remover gasto do periodo.')
    }
  }

  const handleCsvUpload = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setImportError('')
    setImportStatus('Processando CSV...')
    try {
      const content = await file.text()
      const rows = parseCsvExpenses(content)
      if (!rows.length) {
        setImportStatus('')
        setImportError('Nenhum registro valido encontrado no CSV.')
        return
      }
      const imported = await Promise.all(
        rows.map((row) =>
          fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...row, periodId: null, participants: [] }),
          }).then((res) => res.json()),
        ),
      )
      setExpenses((prev) => [
        ...prev,
        ...imported.map((expense) => normalizeExpensePayload(expense)),
      ])
      setImportStatus(`Importados ${imported.length} gasto(s).`)
    } catch (error) {
      setImportStatus('')
      setImportError(error instanceof Error ? error.message : 'Falha ao importar o CSV.')
    } finally {
      input.value = ''
    }
  }

  const handleToggleParticipant = async (expense, person) => {
    const current = expense.participants || []
    const exists = current.includes(person)
    const updatedParticipants = exists
      ? current.filter((item) => item !== person)
      : [...current, person]
    try {
      const response = await fetch(`${API_URL}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: updatedParticipants }),
      })
      const updated = await response.json()
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? normalizeExpensePayload(updated) : item)),
      )
    } catch (error) {
      setAppError('Erro ao atualizar participantes.')
    }
  }

  
  if (!currentUser) {
    return (
      <AuthModule
        authMode={authMode}
        authForm={authForm}
        authError={authError}
        onAuthModeChange={handleAuthModeChange}
        onAuthChange={handleAuthChange}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    )
  }

  return (
    <div className="page">
      <header className="topbar compact">
        <div className="topbar-brand">
          <span className="pill">Rateio IA</span>
        </div>
          <div className="topbar-actions compact">
            <div
              className="user-avatar"
              title={currentUser.name || currentUser.username}
              aria-label="Perfil do usuário"
            >
              {userInitials || '??'}
            </div>
            <span className="user-role">{ROLE_LABELS[currentUser.role] || currentUser.role}</span>
            <button
              className="ghost icon-button"
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema"
            >
              <span className={`pi ${theme === 'dark' ? 'pi-sun' : 'pi-moon'}`} aria-hidden="true" />
            </button>
            <button
              className="ghost icon-button"
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
            >
            <span className="pi pi-power-off" aria-hidden="true" />
          </button>
        </div>
      </header>

      {loading ? <div className="loading">Carregando dados...</div> : null}
      {appError ? <div className="error-banner">{appError}</div> : null}

      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h4>Modulos</h4>
            <nav className="sidebar-menu">
              {MODULES.map((module) => (
                <button
                  type="button"
                  key={module.id}
                  className={`menu-button ${activeModule === module.id ? 'active' : ''}`}
                  onClick={() => setActiveModule(module.id)}
                >
                  {module.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="module-panel">
          {activeModule === 'period' && (
            <PeriodModule
              selectedPeriod={selectedPeriod}
              selectedPeriodId={selectedPeriodId}
              onSelectPeriod={setSelectedPeriodId}
              periodPeopleList={periodPeopleList}
              selectedPeriodPeople={selectedPeriodPeople}
              totalPeriodExpenses={totalPeriodExpenses}
              perPersonShare={perPersonShare}
              periodForm={periodForm}
              onPeriodFormChange={handlePeriodFormChange}
              handleCreatePeriod={handleCreatePeriod}
              periodPeople={periodPeople}
              personGroupTypes={PERSON_GROUP_TYPES}
              newPeriodPersonCounts={newPeriodPersonCounts}
              onNewPeriodPersonCountsChange={handleNewPeriodPersonCountsChange}
              newPeriodPersonInput={newPeriodPersonInput}
              onNewPeriodPersonInputChange={handleNewPeriodPersonInputChange}
              handleAddPersonToNewPeriod={handleAddPersonToNewPeriod}
              handleRemovePersonFromNewPeriod={handleRemovePersonFromNewPeriod}
              existingPersonInput={existingPersonInput}
              existingPersonCounts={existingPersonCounts}
              onExistingPersonInputChange={handleExistingPersonInputChange}
              onExistingPersonCountsChange={handleExistingPersonCountsChange}
              handleAddPersonToPeriod={handleAddPersonToPeriod}
              handleRemovePersonFromPeriod={handleRemovePersonFromPeriod}
              editingPersonName={editingPersonName}
              onStartEditPerson={handleStartEditPerson}
              onCancelEditPerson={handleCancelEditPerson}
              periodExpenses={periodExpenses}
              shareSummary={shareSummary}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              canEdit={canEdit}
              handleToggleParticipant={handleToggleParticipant}
              handleRemoveExpenseFromPeriod={handleRemoveExpenseFromPeriod}
              editingExpense={editingExpense}
              onRequestEditExpense={handleRequestEditExpense}
              onCancelEditExpense={handleCancelEditExpense}
              onSaveEditedExpense={handleSaveEditedExpense}
              personPayments={personPayments}
            remainingCardBalance={remainingCardBalance}
            personExpenseCounts={personExpenseCounts}
            displayedPeriods={filteredPeriodSummaries}
              periodStatusFilter={periodStatusFilter}
              onPeriodStatusFilterChange={setPeriodStatusFilter}
              statusFilterOptions={PERIOD_STATUS_FILTERS}
              statusOptions={PERIOD_STATUS_OPTIONS}
              statusLabels={PERIOD_STATUS_LABELS}
              statusSeverity={PERIOD_STATUS_SEVERITY}
              onUpdatePeriodStatus={handleUpdatePeriodStatus}
              newPeriodDialogVisible={newPeriodDialogVisible}
              onOpenNewPeriodDialog={handleOpenNewPeriodDialog}
              onCloseNewPeriodDialog={handleCloseNewPeriodDialog}
              periodEditDialogVisible={periodEditDialogVisible}
              periodEditForm={periodEditForm}
              periodEditError={periodEditError}
              onPeriodEditFormChange={handlePeriodEditFormChange}
              onOpenPeriodEditDialog={handleOpenPeriodEditDialog}
              onClosePeriodEditDialog={handleClosePeriodEditDialog}
              onSaveEditedPeriod={handleSaveEditedPeriod}
            />
          )}

          {activeModule === 'pending' && (
            <PendingModule
              pendingExpenses={pendingExpenses}
              periods={periods}
              hasPeriods={hasPeriods}
              getPendingTargetId={getPendingTargetId}
              handlePendingTargetChange={handlePendingTargetChange}
              handleAssignExpense={handleAssignExpense}
              handleDeletePendingExpense={handleDeletePendingExpense}
              canEdit={canEdit}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              expenseForm={expenseForm}
              onExpenseFormChange={handleExpenseFormChange}
              expenseError={expenseError}
              handleAddExpense={handleAddExpense}
              handleCsvUpload={handleCsvUpload}
              importStatus={importStatus}
              importError={importError}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
