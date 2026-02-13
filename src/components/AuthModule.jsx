function AuthModule({
  authMode,
  authForm,
  authError,
  onAuthModeChange,
  onAuthChange,
  onLogin,
  onRegister,
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="pill">Rateio IA</span>
          <h1>Organize periodos e rateios em segundos.</h1>
          <p>
            Controle gastos, crie periodos e distribua participacoes com um fluxo simples e visual.
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => onAuthModeChange('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => onAuthModeChange('register')}
            >
              Cadastrar
            </button>
          </div>
          {authMode === 'login' ? (
            <form className="form" onSubmit={onLogin}>
              <label>
                Usuario
                <input
                  value={authForm.username}
                  onChange={(event) => onAuthChange('username', event.target.value)}
                  placeholder="Ex: thiago"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => onAuthChange('password', event.target.value)}
                />
              </label>
              {authError ? <span className="error-text">{authError}</span> : null}
              <button className="primary" type="submit">
                Entrar
              </button>
            </form>
          ) : (
            <form className="form" onSubmit={onRegister}>
              <label>
                Nome completo
                <input
                  value={authForm.name}
                  onChange={(event) => onAuthChange('name', event.target.value)}
                  placeholder="Ex: Gabriella Silva"
                />
              </label>
              <label>
                Usuario
                <input
                  value={authForm.username}
                  onChange={(event) => onAuthChange('username', event.target.value)}
                  placeholder="Ex: gabri"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => onAuthChange('password', event.target.value)}
                />
              </label>
              <label>
                Nivel de perfil
                <select
                  value={authForm.role}
                  onChange={(event) => onAuthChange('role', event.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="gestor">Gestor</option>
                  <option value="consultar">Consultar</option>
                </select>
              </label>
              {authError ? <span className="error-text">{authError}</span> : null}
              <button className="primary" type="submit">
                Criar conta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthModule
