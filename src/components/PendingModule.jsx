import { useState } from 'react'
import { Button } from 'primereact/button'

function PendingModule({
  pendingExpenses,
  periods,
  hasPeriods,
  getPendingTargetId,
  handlePendingTargetChange,
  handleAssignExpense,
  handleDeletePendingExpense,
  canEdit,
  formatDate,
  formatCurrency,
  expenseForm,
  onExpenseFormChange,
  expenseError,
  handleAddExpense,
  handleCsvUpload,
  importStatus,
  importError,
}) {
  const [formVisible, setFormVisible] = useState(false)

  return (
    <div className="card module-card pending-module">
      <div className="card-title pending-module-title">
        <div>
          <h3>Pendentes</h3>
          <span className="muted">{pendingExpenses.length} itens aguardando período</span>
        </div>
        <Button
          icon={`pi ${formVisible ? 'pi-times' : 'pi-plus'}`}
          label={formVisible ? 'Ocultar formulário' : 'Adicionar despesa'}
          onClick={() => setFormVisible((prev) => !prev)}
          disabled={!canEdit}
        />
      </div>

      {formVisible && (
        <form className="form pending-entry-form" onSubmit={handleAddExpense}>
          <div className="form-grid">
            <label>
              Data
              <input
                type="date"
                value={expenseForm.date}
                onChange={(event) => onExpenseFormChange('date', event.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label>
              Descrição
              <input
                value={expenseForm.description}
                onChange={(event) => onExpenseFormChange('description', event.target.value)}
                placeholder="Ex: Asun"
                disabled={!canEdit}
              />
            </label>
            <label>
              Observações
              <input
                value={expenseForm.notes}
                onChange={(event) => onExpenseFormChange('notes', event.target.value)}
                placeholder="Ex: feira da semana"
                disabled={!canEdit}
              />
            </label>
            <label>
              Período (opcional)
              <select
                value={expenseForm.periodId}
                onChange={(event) => onExpenseFormChange('periodId', event.target.value)}
                disabled={!canEdit}
              >
                <option value="">Sem período</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} · {formatDate(period.startDate)} a {formatDate(period.endDate)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor total
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => onExpenseFormChange('amount', event.target.value)}
                placeholder="0,00"
                disabled={!canEdit}
              />
            </label>
            <label>
              Tipo
              <select
                value={expenseForm.type}
                onChange={(event) => onExpenseFormChange('type', event.target.value)}
                disabled={!canEdit}
              >
                <option value="comida">Comida</option>
                <option value="bebida">Bebida</option>
                <option value="diversos">Diversos</option>
              </select>
            </label>
            <label>
              Pagante
              <input
                value={expenseForm.payer}
                onChange={(event) => onExpenseFormChange('payer', event.target.value)}
                placeholder="Ex: C6"
                disabled={!canEdit}
              />
            </label>
          </div>
          {expenseError ? <span className="error-text">{expenseError}</span> : null}
          <div className="dialog-actions pending-form-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => setFormVisible(false)}
              disabled={!canEdit}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={!canEdit}>
              Salvar gasto
            </button>
          </div>
          <div className="import-area">
            <h4>Importar lista em CSV</h4>
            <span className="muted import-note">
              Use o formato <code>Data,Categoria,Descricao,Obs,Pagante,Valor,Tipo</code> (linhas com dados
              extras são ignoradas).
            </span>
            <label className="file-label">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={!canEdit}
              />
              <span>Selecionar arquivo</span>
            </label>
            {importError ? <span className="error-text">{importError}</span> : null}
            {!importError && importStatus ? <span className="muted">{importStatus}</span> : null}
          </div>
        </form>
      )}

      <div className="pending-list">
        {pendingExpenses.length === 0 ? (
          <p className="muted">Nenhum gasto pendente.</p>
        ) : (
          pendingExpenses.map((expense) => {
            const targetPeriodId = getPendingTargetId(expense.id)
            return (
              <div key={expense.id} className="pending-item">
                <div>
                  <strong>{expense.description}</strong>
                  <span className="muted">
                    {formatDate(expense.date)} · {expense.category}
                  </span>
                </div>
                <div className="pending-meta">
                  <span>{formatCurrency(expense.amount)}</span>
                  <select
                    value={targetPeriodId ?? ''}
                    onChange={(event) => handlePendingTargetChange(expense.id, event.target.value)}
                    disabled={!canEdit || !hasPeriods}
                  >
                    {hasPeriods ? (
                      <>
                        <option value="">Selecionar período</option>
                        {periods.map((period) => (
                          <option key={period.id} value={period.id}>
                            {period.name} ({formatDate(period.startDate)} a {formatDate(period.endDate)})
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="">Sem períodos cadastrados</option>
                    )}
                  </select>
                  <div className="pending-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleAssignExpense(expense, targetPeriodId)}
                      disabled={!canEdit || !hasPeriods || !targetPeriodId}
                    >
                      Enviar para período
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      onClick={() => handleDeletePendingExpense(expense)}
                      disabled={!canEdit}
                    >
                      Excluir pendente
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default PendingModule
