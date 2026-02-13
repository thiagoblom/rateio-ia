import { useState, useEffect } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Dialog } from 'primereact/dialog'
import { SelectButton } from 'primereact/selectbutton'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'

const toSafeInteger = (value) => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}
function PeriodModule({
  selectedPeriod,
  selectedPeriodId,
  onSelectPeriod,
  periodPeopleList,
  selectedPeriodPeople = [],
  periodForm,
  onPeriodFormChange,
  handleCreatePeriod,
  periodPeople,
  personGroupTypes,
  totalPeriodExpenses,
  perPersonShare,
  newPeriodPersonInput,
  newPeriodPersonCounts,
  onNewPeriodPersonInputChange,
  onNewPeriodPersonCountsChange,
  handleAddPersonToNewPeriod,
  handleRemovePersonFromNewPeriod,
  existingPersonInput,
  existingPersonCounts,
  onExistingPersonInputChange,
  onExistingPersonCountsChange,
  handleAddPersonToPeriod,
  handleRemovePersonFromPeriod,
  editingPersonName,
  onStartEditPerson,
  onCancelEditPerson,
  periodExpenses,
  shareSummary,
  personPayments = {},
  personExpenseCounts = {},
  formatDate,
  formatCurrency,
  canEdit,
  handleToggleParticipant,
  handleRemoveExpenseFromPeriod,
  editingExpense,
  onRequestEditExpense,
  onCancelEditExpense,
  onSaveEditedExpense,
  remainingCardBalance = 0,
  displayedPeriods,
  periodStatusFilter,
  onPeriodStatusFilterChange,
  statusFilterOptions,
  statusOptions,
  statusLabels,
  statusSeverity,
  onUpdatePeriodStatus,
  newPeriodDialogVisible,
  onOpenNewPeriodDialog,
  onCloseNewPeriodDialog,
  periodEditDialogVisible,
  periodEditForm,
  periodEditError,
  onPeriodEditFormChange,
  onOpenPeriodEditDialog,
  onClosePeriodEditDialog,
  onSaveEditedPeriod,
}) {
  const [participantDialogVisible, setParticipantDialogVisible] = useState(false)

  const groupTypes = personGroupTypes || []
  const getGroupPersonCount = (counts = {}) => {
    const values = groupTypes.map((type) => toSafeInteger(counts[type.key]))
    if (!values.length) return 1
    return Math.max(1, ...values)
  }
  const normalizePersonKey = (value) => (value || '').toString().trim().toLowerCase()
  const normalizeParticipantName = (participant) => {
    if (!participant) return ''
    if (typeof participant === 'string') return participant
    return participant?.name ?? ''
  }
  const normalizeParticipantKey = (participant) =>
    normalizePersonKey(normalizeParticipantName(participant))
  const personKeyFor = (person) => normalizePersonKey(person?.name)
  const personMap = selectedPeriodPeople.reduce((acc, person) => {
    const key = personKeyFor(person)
    if (key) {
      acc[key] = person
    }
    return acc
  }, {})
  const getPersonUnitCount = (person, expenseType) => {
    if (!person) return 1
    const typeKey = (expenseType || '').toLowerCase()
    const counts = person.counts || {}
    const matchingType = groupTypes.find((type) => type.key === typeKey)
    if (matchingType) {
      return Math.max(0, counts[matchingType.key] || 0)
    }
    const total = groupTypes.reduce((sum, type) => sum + (counts[type.key] || 0), 0)
    return total > 0 ? total : 1
  }
  const calculateExpensePerUnitValue = (expense) => {
    const participants = expense.participants || []
    const normalizedKeys = Array.from(
      new Set(participants.map((participant) => normalizeParticipantKey(participant)).filter(Boolean)),
    )
    if (!normalizedKeys.length) return 0
    const totalUnits = normalizedKeys.reduce((sum, key) => {
      const person = personMap[key]
      if (!person) return sum
      return sum + getPersonUnitCount(person, expense.type)
    }, 0)
    if (!totalUnits) return 0
    return Number(expense.amount || 0) / totalUnits
  }
  const normalizedShareMap = shareSummary.reduce((acc, item) => {
    const key = item.key ?? normalizePersonKey(item.person)
    if (!key) return acc
    acc[key] = item.total
    return acc
  }, {})
  const shareSummaryTotal = Object.values(normalizedShareMap).reduce((sum, value) => sum + value, 0)
  const shareScale =
    shareSummaryTotal > 0 && totalPeriodExpenses
      ? totalPeriodExpenses / shareSummaryTotal
      : 1
  const shareTotals = selectedPeriodPeople.reduce((acc, person) => {
    const key = personKeyFor(person)
    const groupShare = perPersonShare * getGroupPersonCount(person.counts)
    const rawShare = normalizedShareMap[key]
    acc[key] = rawShare !== undefined ? rawShare * shareScale : groupShare
    return acc
  }, {})
  const isEditing = Boolean(editingPersonName)

  const formatGroupCounts = (counts = {}) =>
    groupTypes
      .map((type) => `${counts[type.key] ?? 0}${(type.label?.[0] ?? '').toUpperCase()}`)
      .join(' · ')
  const defaultEditForm = () => ({
    date: '',
    category: '',
    description: '',
    notes: '',
    amount: '',
    type: 'comida',
    payer: '',
  })
  const [editForm, setEditForm] = useState(defaultEditForm())
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (editingExpense) {
      setEditForm({
        date: editingExpense.date || '',
        category: editingExpense.category || '',
        description: editingExpense.description || '',
        notes: editingExpense.notes || '',
        amount: editingExpense.amount ?? '',
        type: editingExpense.type || 'comida',
        payer: editingExpense.payer || '',
      })
      setEditError('')
      return
    }
    setEditForm(defaultEditForm())
    setEditError('')
  }, [editingExpense])

  const handleEditFieldChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveEditExpense = async (event) => {
    event.preventDefault()
    if (!editingExpense) return
    setEditError('')
    const amountValue = Number.parseFloat(editForm.amount)
    if (!editForm.date || !editForm.category || !editForm.description || !editForm.payer) {
      setEditError('Preencha os campos obrigatorios.')
      return
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setEditError('Informe um valor valido.')
      return
    }
    try {
      await onSaveEditedExpense(editingExpense.id, {
        ...editForm,
        amount: amountValue,
      })
    } catch (error) {
      setEditError(error?.message || 'Erro ao atualizar o gasto.')
    }
  }
  const isPersonSelectedForAllExpenses = (personName) => {
    if (!personName || !periodExpenses.length) return false
    return periodExpenses.every((expense) => (expense.participants || []).includes(personName))
  }

  const toggleSelectionForPersonAcrossExpenses = (personName) => {
    if (!personName || !handleToggleParticipant) return
    const selectAll = !isPersonSelectedForAllExpenses(personName)
    periodExpenses.forEach((expense) => {
      const participants = expense.participants || []
      const includes = participants.includes(personName)
      if (selectAll && !includes) {
        handleToggleParticipant(expense, personName)
      } else if (!selectAll && includes) {
        handleToggleParticipant(expense, personName)
      }
    })
  }

  const renderParticipantCell = (personName) => (expense) => {
    const participants = expense.participants || []
    const isSelected = participants.includes(personName)
    return (
      <label className="toggle">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleToggleParticipant(expense, personName)}
          disabled={!canEdit}
        />
        <span>{isSelected ? 'Sim' : 'Nao'}</span>
      </label>
    )
  }

  const renderParticipantColumnHeader = (personName) => {
    const allSelected = isPersonSelectedForAllExpenses(personName)
    return (
      <div className="participant-column-header">
        <span>{personName}</span>
        <button
          type="button"
          className="ghost small"
          onClick={() => toggleSelectionForPersonAcrossExpenses(personName)}
          disabled={!canEdit || !periodExpenses.length}
          aria-label={`${allSelected ? 'Desmarcar' : 'Marcar'} todas as compras para ${personName}`}
        >
          {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>
    )
  }

  const sortedPeriodExpenses = (periodExpenses || []).slice().sort((a, b) => {
    if (!a?.date || !b?.date) return 0
    const first = new Date(`${a.date}T00:00:00`).getTime()
    const second = new Date(`${b.date}T00:00:00`).getTime()
    return first - second
  })

  const renderPerPersonValue = (expense) => {
    const perUnitValue = calculateExpensePerUnitValue(expense)
    return perUnitValue > 0 ? formatCurrency(perUnitValue) : '-'
  }
  return (
    <>
      <div className="period-module">
        <div className="period-toolbar p-d-flex p-ai-center p-jc-between p-flex-wrap">
          <div className="period-filter p-d-flex p-ai-center p-flex-wrap gap-3">
            <span className="period-filter-label">Filtrar status:</span>
            <SelectButton
              value={periodStatusFilter}
              options={statusFilterOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(event) => onPeriodStatusFilterChange(event.value)}
              className="period-status-select"
            />
          </div>
          <Button
            icon="pi pi-plus"
            label="Novo periodo"
            onClick={onOpenNewPeriodDialog}
            disabled={!canEdit}
          />
        </div>
        {!selectedPeriod ? (
          <div className="period-card-strip">
            {displayedPeriods.length ? (
            displayedPeriods.map((period) => (
              <div key={period.id} className="period-card-wrapper">
                <Card className={`period-card ${selectedPeriodId === period.id ? 'active' : ''}`}>
                  <div className="period-card-header">
                    <div>
                      <p className="period-card-name">{period.name}</p>
                      <p className="period-card-range">
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </p>
                    </div>
                    <Tag
                      value={statusLabels[period.status] || 'Pendentes'}
                      severity={statusSeverity[period.status]}
                      rounded
                    />
                  </div>
                  <div className="period-card-summary" onClick={() => onSelectPeriod(period.id)}>
                    <div className="period-card-stat">
                      <span>Participantes</span>
                      <strong>{period.peopleCount}</strong>
                    </div>
                    <div className="period-card-stat">
                      <span>Despesas</span>
                      <strong>{period.expenseCount}</strong>
                    </div>
                    <div className="period-card-stat">
                      <span>Total</span>
                      <strong>{formatCurrency(period.total)}</strong>
                    </div>
                  </div>
                  <div className="period-card-actions">
                    <Dropdown
                      value={period.status}
                      options={statusOptions}
                      optionLabel="label"
                      optionValue="value"
                      onChange={(event) => onUpdatePeriodStatus(period.id, event.value)}
                      disabled={!canEdit}
                      className="period-card-status-dropdown"
                    />
                    <Button
                      type="button"
                      icon="pi pi-arrow-right"
                      className="p-button-text"
                      onClick={() => onSelectPeriod(period.id)}
                      label="Ver detalhes"
                    />
                  </div>
                </Card>
              </div>
            ))
          ) : (
            <div className="period-card-empty">
              <p className="muted">Nenhum periodo encontrado para o filtro selecionado.</p>
            </div>
          )}
          </div>
        ) : null}
        {selectedPeriod ? (
          <div className="card selected-period-card">
            <div className="selected-period-card-header">
              <div className="selected-period-card-meta">
                <p className="muted">Período selecionado</p>
                <div className="selected-period-card-title-row">
                  <h3>{selectedPeriod.name}</h3>
                  <strong className="selected-period-total">
                    {formatCurrency(totalPeriodExpenses)}
                  </strong>
                </div>
                <span className="muted">
                  {formatDate(selectedPeriod.startDate)} - {formatDate(selectedPeriod.endDate)}
                </span>
              </div>
              <div className="selected-period-card-header-actions">
                <Button
                  label="Editar período"
                  icon="pi pi-pencil"
                  className="ghost edit-period-button"
                  disabled={!canEdit}
                  onClick={onOpenPeriodEditDialog}
                />
                <Button
                  icon="pi pi-arrow-left"
                  className="back-button p-button-text"
                  label="Voltar"
                  onClick={() => onSelectPeriod(null)}
                />
              </div>
            </div>
            <div className="selected-period-details">
              <div className="selected-period-people">
                <Button
                  label="Adicionar pessoa ao período"
                  icon="pi pi-user-plus"
                  onClick={() => {
                    onCancelEditPerson()
                    setParticipantDialogVisible(true)
                  }}
                  disabled={!canEdit}
                  className="add-person-button"
                />
              </div>
              <div className="person-summary">
                <div className="person-summary-header">
                  <h4>Valor final por grupo</h4>
                  <span className="muted">Cada grupo representa a soma das pessoas indicadas por tipo.</span>
                </div>
                {!selectedPeriodPeople?.length ? (
                  <p className="muted">Adicione grupos para calcular o rateio.</p>
                ) : (
                  <>
                    <div className="person-summary-table">
                      <div className="person-summary-table-row header">
                        <span>Grupo</span>
                        <span>Comida</span>
                        <span>Bebida</span>
                        <span>Qtde despesas</span>
                        <span>Valor pago</span>
                        <span>Valor total</span>
                        <span>Saldo</span>
                        <span>Ações</span>
                      </div>
                      {selectedPeriodPeople.map((person) => {
                        const personKey = personKeyFor(person)
                        const expenseCount = personExpenseCounts[personKey] ?? 0
                        const paidAmount = personPayments[personKey] ?? 0
                        const actualShare = shareTotals[personKey] ?? 0
                        const balance = paidAmount - actualShare
                        return (
                          <div className="person-summary-table-row" key={person.name}>
                            <div className="person-summary-person">
                              <strong>{person.name}</strong>
                              {/* <small className="muted">{formatGroupCounts(person.counts)}</small> */}
                            </div>
                            <span>{person.counts?.comida ?? 0}</span>
                            <span>{person.counts?.bebida ?? 0}</span>
                            <span>{expenseCount}</span>
                            <span>{formatCurrency(paidAmount)}</span>
                            <span>{formatCurrency(actualShare)}</span>
                            <span className={balance >= 0 ? 'positive' : 'negative'}>
                              {formatCurrency(balance)}
                            </span>
                            <div className="person-summary-card-actions">
                              <button
                                type="button"
                                className="ghost icon-only"
                                onClick={() => {
                                  onStartEditPerson(person)
                                  setParticipantDialogVisible(true)
                                }}
                                disabled={!canEdit}
                                aria-label={`Editar ${person.name}`}
                                title="Editar"
                              >
                                <span className="pi pi-pencil" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="ghost icon-only"
                                onClick={() => handleRemovePersonFromPeriod(person.name)}
                                disabled={!canEdit}
                                aria-label={`Remover ${person.name}`}
                                title="Remover"
                              >
                                <span className="pi pi-trash" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {Math.abs(remainingCardBalance) > 0 ? (
                      <div className="person-summary-card-external">
                        <div>
                          <span>
                            {remainingCardBalance >= 0
                              ? 'Cartão C6 restante para pagamento'
                              : 'Cartão C6 com crédito'}
                          </span>
                          <small className="muted">
                            Valor que será compensado fora dos grupos do período.
                          </small>
                        </div>
                        <strong className={remainingCardBalance >= 0 ? 'negative' : 'positive'}>
                          {formatCurrency(Math.abs(remainingCardBalance))}
                        </strong>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="selected-period-placeholder">
            <p className="muted">Selecione um periodo para revisar os grupos e despesas.</p>
          </div>
        )}
      </div>

      {selectedPeriod ? (
        <section className="table-card">
          <div className="card-title">
            <h3>Rateio por compra</h3>
            <span className="muted">Periodo {selectedPeriod.name}</span>
          </div>
          {periodPeopleList.length === 0 ? (
            <p className="muted">Inclua participantes no periodo para dividir os gastos.</p>
          ) : (
            <div className="table-scroll">
              <DataTable
                value={sortedPeriodExpenses}
                dataKey="id"
                responsiveLayout="scroll"
                className="rateio-table"
                emptyMessage="Nenhum gasto encontrado"
                scrollable
                scrollHeight="420px"
              >
                <Column
                  field="date"
                  header="Data"
                  body={(expense) => formatDate(expense.date)}
                />
                <Column field="category" header="Categoria" hidden />
                <Column field="description" header="Descricao" />
                <Column field="payer" header="Pagante" />
                <Column
                  field="amount"
                  header="Valor"
                  body={(expense) => formatCurrency(expense.amount)}
                />
                <Column header="Valor/pessoa" body={renderPerPersonValue} />
                <Column field="type" header="Tipo" />
                {periodPeopleList.map((person) => (
                  <Column
                    key={`participant-${person}`}
                    header={renderParticipantColumnHeader(person)}
                    body={renderParticipantCell(person)}
                    className="participant-column"
                  />
                ))}
                <Column
                  header="Acoes"
                  body={(expense) => (
                    <div className="rateio-actions">
                      <button
                        type="button"
                        className="ghost icon-only action-btn"
                        onClick={() => handleRemoveExpenseFromPeriod(expense)}
                        disabled={!canEdit}
                        aria-label="Voltar para pendente"
                      >
                        <span className="pi pi-undo" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="ghost icon-only action-btn"
                        onClick={() => onRequestEditExpense(expense)}
                        disabled={!canEdit}
                        aria-label="Editar gasto"
                      >
                        <span className="pi pi-pencil" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                />
              </DataTable>
            </div>
          )}
        </section>
      ) : null}

      <Dialog
        header="Editar gasto"
        visible={Boolean(editingExpense)}
        onHide={onCancelEditExpense}
        modal
        className="edit-expense-dialog"
      >
        <form className="form" onSubmit={handleSaveEditExpense}>
          <label>
            Data
            <input
              type="date"
              value={editForm.date}
              onChange={(event) => handleEditFieldChange('date', event.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label>
            Categoria
            <input
              value={editForm.category}
              onChange={(event) => handleEditFieldChange('category', event.target.value)}
              placeholder="Ex: Mercado"
              disabled={!canEdit}
            />
          </label>
          <label>
            Descricao
            <input
              value={editForm.description}
              onChange={(event) => handleEditFieldChange('description', event.target.value)}
              placeholder="Ex: Asun"
              disabled={!canEdit}
            />
          </label>
          <label>
            Observacoes
            <input
              value={editForm.notes}
              onChange={(event) => handleEditFieldChange('notes', event.target.value)}
              placeholder="Ex: feira da semana"
              disabled={!canEdit}
            />
          </label>
          <div className="field-row">
            <label>
              Valor total
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => handleEditFieldChange('amount', event.target.value)}
                placeholder="0,00"
                disabled={!canEdit}
              />
            </label>
            <label>
              Tipo
              <select
                value={editForm.type}
                onChange={(event) => handleEditFieldChange('type', event.target.value)}
                disabled={!canEdit}
              >
                <option value="comida">Comida</option>
                <option value="bebida">Bebida</option>
                <option value="diversos">Diversos</option>
              </select>
            </label>
          </div>
          <label>
            Pagante
            <input
              value={editForm.payer}
              onChange={(event) => handleEditFieldChange('payer', event.target.value)}
              placeholder="Ex: Thiago"
              disabled={!canEdit}
            />
          </label>
          {editError ? <span className="error-text">{editError}</span> : null}
          <div className="dialog-actions">
            <button
              className="ghost"
              type="button"
              onClick={onCancelEditExpense}
              disabled={!canEdit}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={!canEdit}>
              Salvar
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        header="Editar período"
        visible={periodEditDialogVisible}
        onHide={onClosePeriodEditDialog}
        modal
        className="new-period-dialog"
      >
        <form className="form" onSubmit={onSaveEditedPeriod}>
          <label>
            Nome do periodo
            <input
              value={periodEditForm.name}
              onChange={(event) => onPeriodEditFormChange('name', event.target.value)}
              placeholder="Ex: 01 a 03 de janeiro"
              disabled={!canEdit}
            />
          </label>
          <div className="field-row">
            <label>
              Inicio
              <input
                type="date"
                value={periodEditForm.startDate}
                onChange={(event) => onPeriodEditFormChange('startDate', event.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label>
              Fim
              <input
                type="date"
                value={periodEditForm.endDate}
                onChange={(event) => onPeriodEditFormChange('endDate', event.target.value)}
                disabled={!canEdit}
              />
            </label>
          </div>
          {periodEditError ? <span className="error-text">{periodEditError}</span> : null}
          <div className="dialog-actions">
            <button
              className="ghost"
              type="button"
              onClick={onClosePeriodEditDialog}
              disabled={!canEdit}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={!canEdit}>
              Salvar
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        header="Adicionar participante"
        visible={participantDialogVisible}
        onHide={() => setParticipantDialogVisible(false)}
        modal
        className="new-period-dialog"
      >
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            handleAddPersonToPeriod()
            setParticipantDialogVisible(false)
          }}
        >
          <label>
            Nome
            <input
              value={existingPersonInput}
              onChange={(event) => onExistingPersonInputChange(event.target.value)}
              placeholder="Nome do participante"
            />
          </label>
          <div className="group-count-inputs">
            {groupTypes.map((type) => (
              <label key={type.key}>
                {type.label}
                <input
                  type="number"
                  min="0"
                  value={existingPersonCounts?.[type.key] ?? ''}
                  onChange={(event) => onExistingPersonCountsChange(type.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => {
                onCancelEditPerson()
                setParticipantDialogVisible(false)
              }}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={!canEdit}>
              {isEditing ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        header="Novo periodo"
        visible={newPeriodDialogVisible}
        onHide={onCloseNewPeriodDialog}
        modal
        className="new-period-dialog"
      >
        <form className="form" onSubmit={handleCreatePeriod}>
          <label>
            Nome do periodo
            <input
              value={periodForm.name}
              onChange={(event) => onPeriodFormChange('name', event.target.value)}
              placeholder="Ex: 01 a 03 de janeiro"
            />
          </label>
          <div className="field-row">
            <label>
              Inicio
              <input
                type="date"
                value={periodForm.startDate}
                onChange={(event) => onPeriodFormChange('startDate', event.target.value)}
              />
            </label>
            <label>
              Fim
              <input
                type="date"
                value={periodForm.endDate}
                onChange={(event) => onPeriodFormChange('endDate', event.target.value)}
              />
            </label>
          </div>
          <label>
            Participantes
            <div className="inline-form">
              <input
                value={newPeriodPersonInput}
                onChange={(event) => onNewPeriodPersonInputChange(event.target.value)}
                placeholder="Digite e pressione Enter"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddPersonToNewPeriod()
                  }
                }}
              />
              <button type="button" className="ghost" onClick={handleAddPersonToNewPeriod}>
                Incluir
              </button>
            </div>
            <div className="group-count-inputs">
              {groupTypes.map((type) => (
                <label key={type.key}>
                  {type.label}
                  <input
                    type="number"
                    min="0"
                    value={newPeriodPersonCounts?.[type.key] ?? ''}
                    onChange={(event) =>
                      onNewPeriodPersonCountsChange(type.key, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </label>
          <div className="chip-list">
            {periodPeople.map((person) => (
              <button
                key={person.name}
                type="button"
                className="chip removable"
                onClick={() => handleRemovePersonFromNewPeriod(person.name)}
              >
                <span>{person.name}</span>
                <small>{formatGroupCounts(person.counts)}</small>
              </button>
            ))}
          </div>
          <button className="primary" type="submit">
            Criar periodo
          </button>
        </form>
      </Dialog>
    </>
  )
}

export default PeriodModule
