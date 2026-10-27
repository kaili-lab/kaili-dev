import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'

import {
  addAiModel,
  addAiModels,
  discoverAiModels,
  moveAiModel,
  removeAiConnection,
  removeAiModel,
  saveAiConnection,
  saveAiModel,
  testAiConnection,
  type AiConnectionValidationError,
  type AiConnectionView,
  type AiOverview,
} from '#/features/ai.functions'
import {
  FAILURE_TEXT,
  guessCapability,
  type Capability,
  type DataClass,
} from '#/features/ai-routing'
import { ConfirmDialog } from '#/components/admin/dialogs'
import { ListLayout } from '#/components/admin/list-page'

const DATA_CLASS_LABELS: Record<DataClass, string> = {
  public: '已发布内容',
  draft: '文章草稿',
  idea: 'Idea',
  resource: 'Resource',
  image: '私有图片',
}
const DATA_CLASSES = Object.keys(DATA_CLASS_LABELS) as DataClass[]
const CAPABILITIES: Capability[] = ['chat', 'image', 'embedding']
const CAPABILITY_LABELS: Record<Capability, string> = {
  chat: '对话',
  image: '画图',
  embedding: '向量',
}

const VALIDATION_LABELS: Record<AiConnectionValidationError, string> = {
  'name-required': '请填写名称',
  'base-url-invalid': '只允许 HTTPS 地址，且不能带用户名、密码、查询参数',
  'data-classes-invalid': '至少选择一类可发送的内容',
}

const genericFailure = '操作失败，请刷新重试'
const stamp = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—'

type Message = { ok: boolean; text: string } | null

function Feedback({ message }: { message: Message }) {
  return message ? (
    <p
      role={message.ok ? 'status' : 'alert'}
      className={message.ok ? 'ad-feedback ad-ok' : 'ad-feedback ad-error'}
    >
      {message.text}
    </p>
  ) : null
}

function connectionResult(connection: AiOverview['connections'][number]) {
  if (connection.lastOk === null) return '未测试'
  if (connection.lastOk) return '成功'
  return FAILURE_TEXT[connection.lastFailure ?? 'config']
}

export function AiOverviewPage({ overview }: { overview: AiOverview }) {
  const router = useRouter()
  const [message, setMessage] = useState<Message>(null)
  const [moving, setMoving] = useState(false)
  const connectionNames = new Map(
    overview.connections.map((connection) => [connection.id, connection.name]),
  )

  async function move(
    id: string,
    capability: Capability,
    direction: 'up' | 'down',
  ) {
    setMoving(true)
    setMessage(null)
    try {
      const result = await moveAiModel({ data: { id, capability, direction } })
      if (!result.ok) {
        setMessage({ ok: false, text: FAILURE_TEXT.config })
        return
      }
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setMoving(false)
    }
  }

  return (
    <ListLayout
      head={
        <div className="ad-page-head">
          <h1>AI 接入</h1>
          <span className="ad-count">{overview.connections.length} 个平台</span>
          <Link className="ui-button ad-primary" to="/admin/ai/new">
            新建平台
          </Link>
        </div>
      }
      footer={null}
    >
      <table className="ad-table">
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">baseURL</th>
            <th scope="col">API key</th>
            <th scope="col">启用</th>
            <th scope="col">允许的数据类别</th>
            <th scope="col">最近测试</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {overview.connections.length === 0 ? (
            <tr>
              <td colSpan={7} className="ad-table-empty">
                还没有 AI 平台。
              </td>
            </tr>
          ) : (
            overview.connections.map((connection) => (
              <tr key={connection.id}>
                <td data-label="名称" className="ad-cell-title">
                  <Link to="/admin/ai/$id" params={{ id: connection.id }}>
                    {connection.name}
                  </Link>
                </td>
                <td data-label="baseURL">{connection.baseURL}</td>
                <td data-label="API key">{connection.keyMask}</td>
                <td data-label="启用">{connection.enabled ? '是' : '否'}</td>
                <td data-label="允许的数据类别">
                  {connection.dataClasses
                    .map((item) => DATA_CLASS_LABELS[item])
                    .join('、')}
                </td>
                <td data-label="最近测试">
                  {connectionResult(connection)}
                  {connection.lastCheckedAt ? (
                    <span className="ad-time">
                      {' · '}
                      {stamp(connection.lastCheckedAt)}
                    </span>
                  ) : null}
                </td>
                <td data-label="操作">
                  <div className="ad-cell-actions">
                    <Link to="/admin/ai/$id" params={{ id: connection.id }}>
                      编辑
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className="ad-panel ad-after">
        <h2>调用顺序</h2>
        {CAPABILITIES.map((capability) => {
          const order = overview.models.filter(
            (model) => model.enabled && model.capabilities.includes(capability),
          )
          return (
            <div key={capability}>
              <h3>{CAPABILITY_LABELS[capability]}</h3>
              {order.length === 0 ? (
                <p>还没有可用的模型。</p>
              ) : (
                <ol>
                  {order.map((model, index) => {
                    const label = `${connectionNames.get(model.connectionId)} · ${model.providerModelId}`
                    return (
                      <li key={model.id} className="ad-inline">
                        <span>{label}</span>
                        <button
                          type="button"
                          className="ui-button"
                          aria-label={`上移 ${label}`}
                          disabled={moving || index === 0}
                          onClick={() => void move(model.id, capability, 'up')}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          className="ui-button"
                          aria-label={`下移 ${label}`}
                          disabled={moving || index === order.length - 1}
                          onClick={() =>
                            void move(model.id, capability, 'down')
                          }
                        >
                          下移
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )
        })}
        <Feedback message={message} />
      </section>

      <section className="ad-panel ad-after">
        <h2>最近调用</h2>
        <table className="ad-table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">用途</th>
              <th scope="col">平台</th>
              <th scope="col">模型</th>
              <th scope="col">结果</th>
              <th scope="col">耗时</th>
            </tr>
          </thead>
          <tbody>
            {overview.calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="ad-table-empty">
                  还没有调用记录。
                </td>
              </tr>
            ) : (
              overview.calls.map((call) => (
                <tr key={call.id}>
                  <td data-label="时间" className="ad-time">
                    {stamp(call.createdAt)}
                  </td>
                  <td data-label="用途">{call.purpose}</td>
                  <td data-label="平台">{call.connectionName ?? '—'}</td>
                  <td data-label="模型">{call.providerModelId ?? '—'}</td>
                  <td data-label="结果">
                    {call.outcome === 'ok'
                      ? '成功'
                      : FAILURE_TEXT[call.outcome]}
                    {call.fellBack ? ' · 已切换备用模型' : ''}
                  </td>
                  <td data-label="耗时">{call.latencyMs} ms</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </ListLayout>
  )
}

export function AiConnectionPage({
  initial,
}: {
  initial: AiConnectionView | null
}) {
  const connection = initial?.connection
  const router = useRouter()
  const navigate = useNavigate()
  const [name, setName] = useState(connection?.name ?? '')
  const [baseURL, setBaseURL] = useState(connection?.baseURL ?? '')
  const [key, setKey] = useState('')
  const [replaceKey, setReplaceKey] = useState(!connection)
  const [enabled, setEnabled] = useState(connection?.enabled ?? true)
  const [dataClasses, setDataClasses] = useState<DataClass[]>(
    connection?.dataClasses ?? ['public'],
  )
  const [errors, setErrors] = useState<AiConnectionValidationError[]>([])
  const [message, setMessage] = useState<Message>(null)
  const [busy, setBusy] = useState(false)
  const [manualModel, setManualModel] = useState('')
  const [manualCapability, setManualCapability] = useState<Capability>('chat')
  const [found, setFound] = useState<
    { id: string; capability: Capability; selected: boolean }[] | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  const hasError = (error: AiConnectionValidationError) =>
    errors.includes(error)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors([])
    setMessage(null)
    try {
      const result = await saveAiConnection({
        data: {
          id: connection?.id ?? null,
          name,
          baseURL,
          key: replaceKey ? key : '',
          enabled,
          dataClasses,
        },
      })
      if (!result.ok) {
        if (result.error === 'validation') {
          setErrors(result.errors)
        } else if (result.error === 'master-key') {
          setMessage({ ok: false, text: '未配置 AI_MASTER_KEY' })
        } else if (result.error === 'key-required') {
          setMessage({ ok: false, text: '请填写 API key' })
        } else {
          setMessage({ ok: false, text: FAILURE_TEXT.config })
        }
        return
      }
      if (!connection) {
        await navigate({
          to: '/admin/ai/$id',
          params: { id: result.id },
          replace: true,
        })
        return
      }
      setKey('')
      setReplaceKey(false)
      setMessage({ ok: true, text: '平台已保存' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function check(discover: boolean) {
    if (!connection) return
    setBusy(true)
    setMessage(null)
    try {
      const result = discover
        ? await discoverAiModels({ data: { id: connection.id } })
        : await testAiConnection({ data: { id: connection.id } })
      if (!result.ok) {
        setMessage({
          ok: false,
          text:
            result.error === 'master-key'
              ? '未配置 AI_MASTER_KEY'
              : FAILURE_TEXT[result.error],
        })
        await router.invalidate()
        return
      }
      if (discover && 'modelIds' in result) {
        const saved = new Set(
          initial?.models.map((model) => model.providerModelId),
        )
        setFound(
          result.modelIds
            .filter((id) => !saved.has(id))
            .map((id) => ({
              id,
              capability: guessCapability(id),
              selected: false,
            })),
        )
      }
      setMessage({
        ok: true,
        text: discover ? '模型查询完成' : '测试成功',
      })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function addModel(event: FormEvent) {
    event.preventDefault()
    if (!connection) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await addAiModel({
        data: {
          connectionId: connection.id,
          providerModelId: manualModel,
          capabilities: [manualCapability],
        },
      })
      if (!result.ok) {
        setMessage({
          ok: false,
          text:
            result.error === 'model-required'
              ? '请填写模型 ID'
              : result.error === 'duplicate'
                ? '模型已存在'
                : FAILURE_TEXT.config,
        })
        return
      }
      setManualModel('')
      setManualCapability('chat')
      setMessage({ ok: true, text: '模型已添加' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function addFound() {
    if (!connection || !found) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await addAiModels({
        data: {
          connectionId: connection.id,
          models: found
            .filter((item) => item.selected)
            .map((item) => ({
              providerModelId: item.id,
              capabilities: [item.capability],
            })),
        },
      })
      if (!result.ok) {
        setMessage({ ok: false, text: FAILURE_TEXT.config })
        return
      }
      setFound(null)
      setMessage({ ok: true, text: '模型已添加' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function updateOneModel(
    id: string,
    nextCapabilities: Capability[],
    nextEnabled: boolean,
  ) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await saveAiModel({
        data: {
          id,
          capabilities: nextCapabilities,
          enabled: nextEnabled,
        },
      })
      if (!result.ok) {
        setMessage({ ok: false, text: FAILURE_TEXT.config })
        return
      }
      setMessage({ ok: true, text: '模型已保存' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function removeOneModel(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      await removeAiModel({ data: { id } })
      setMessage({ ok: true, text: '模型已删除' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
    } finally {
      setBusy(false)
    }
  }

  async function removeConnection() {
    if (!connection) return
    setDeleting(false)
    setBusy(true)
    try {
      await removeAiConnection({ data: { id: connection.id } })
      await navigate({ to: '/admin/ai', replace: true })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: genericFailure })
      setBusy(false)
    }
  }

  return (
    <section className="ad-page">
      <div className="ad-page-head">
        <h1>{connection ? connection.name : '新建 AI 平台'}</h1>
        <Link to="/admin/ai">← AI 接入</Link>
      </div>

      <form className="ad-content" onSubmit={(event) => void save(event)}>
        <section className="ad-panel">
          <h2>平台</h2>
          <label className="ad-field">
            <span>名称</span>
            <input
              className="ui-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {hasError('name-required') ? (
              <span className="ad-field-error">
                {VALIDATION_LABELS['name-required']}
              </span>
            ) : null}
          </label>

          <label className="ad-field">
            <span>baseURL</span>
            <input
              className="ui-input"
              type="url"
              value={baseURL}
              onChange={(event) => setBaseURL(event.target.value)}
            />
            {hasError('base-url-invalid') ? (
              <span className="ad-field-error">
                {VALIDATION_LABELS['base-url-invalid']}
              </span>
            ) : null}
          </label>

          <div className="ad-field">
            <span>API key</span>
            {connection && !replaceKey ? (
              <div className="ad-inline">
                <span>{connection.keyMask}</span>
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => setReplaceKey(true)}
                >
                  替换
                </button>
              </div>
            ) : (
              <input
                className="ui-input"
                type="password"
                aria-label="API key"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            )}
          </div>

          <div className="ad-tags">
            <span>平台状态</span>
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              启用
            </label>
          </div>

          <div className="ad-tags">
            <span>允许的数据类别</span>
            {DATA_CLASSES.map((dataClass) => (
              <label key={dataClass}>
                <input
                  type="checkbox"
                  checked={dataClasses.includes(dataClass)}
                  onChange={(event) =>
                    setDataClasses((current) =>
                      event.target.checked
                        ? [...current, dataClass]
                        : current.filter((item) => item !== dataClass),
                    )
                  }
                />
                {DATA_CLASS_LABELS[dataClass]}
              </label>
            ))}
            {hasError('data-classes-invalid') ? (
              <span className="ad-field-error">
                {VALIDATION_LABELS['data-classes-invalid']}
              </span>
            ) : null}
          </div>

          <div className="ad-buttons">
            <button
              type="submit"
              className="ui-button ad-primary"
              disabled={busy}
            >
              保存平台
            </button>
            {connection ? (
              <>
                <button
                  type="button"
                  className="ui-button"
                  disabled={busy}
                  onClick={() => void check(false)}
                >
                  测试连接
                </button>
                <button
                  type="button"
                  className="ui-button"
                  disabled={busy}
                  onClick={() => void check(true)}
                >
                  查询模型
                </button>
              </>
            ) : null}
          </div>
          <Feedback message={message} />
        </section>
      </form>

      {connection && initial ? (
        <section className="ad-panel ad-after">
          <h2>模型</h2>
          {found ? (
            found.length === 0 ? (
              <p>没有新的模型</p>
            ) : (
              <div>
                {found.map((item) => (
                  <div key={item.id} className="ad-inline">
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`选择 ${item.id}`}
                        checked={item.selected}
                        onChange={(event) =>
                          setFound(
                            found.map((other) =>
                              other.id === item.id
                                ? { ...other, selected: event.target.checked }
                                : other,
                            ),
                          )
                        }
                      />
                      {item.id}
                    </label>
                    <select
                      className="ui-input"
                      aria-label={`${item.id} 类型`}
                      value={item.capability}
                      onChange={(event) =>
                        setFound(
                          found.map((other) =>
                            other.id === item.id
                              ? {
                                  ...other,
                                  capability: event.target.value as Capability,
                                }
                              : other,
                          ),
                        )
                      }
                    >
                      {CAPABILITIES.map((capability) => (
                        <option key={capability} value={capability}>
                          {CAPABILITY_LABELS[capability]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  className="ui-button"
                  disabled={busy || !found.some((item) => item.selected)}
                  onClick={() => void addFound()}
                >
                  添加所选模型
                </button>
              </div>
            )
          ) : null}
          <form
            className="ad-inline"
            onSubmit={(event) => void addModel(event)}
          >
            <label className="ad-field">
              <span>模型 ID</span>
              <input
                className="ui-input"
                value={manualModel}
                onChange={(event) => {
                  setManualModel(event.target.value)
                  setManualCapability(guessCapability(event.target.value))
                }}
              />
            </label>
            <label className="ad-field">
              <span>类型</span>
              <select
                className="ui-input"
                aria-label="模型类型"
                value={manualCapability}
                onChange={(event) =>
                  setManualCapability(event.target.value as Capability)
                }
              >
                {CAPABILITIES.map((capability) => (
                  <option key={capability} value={capability}>
                    {CAPABILITY_LABELS[capability]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="ui-button" disabled={busy}>
              添加模型
            </button>
          </form>
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">模型 ID</th>
                <th scope="col">能力</th>
                <th scope="col">启用</th>
                <th scope="col">来源</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {initial.models.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ad-table-empty">
                    还没有模型。
                  </td>
                </tr>
              ) : (
                initial.models.map((model) => (
                  <tr key={model.id}>
                    <td data-label="模型 ID">{model.providerModelId}</td>
                    <td data-label="能力">
                      <div className="ad-tags">
                        {CAPABILITIES.map((capability) => (
                          <label key={capability}>
                            <input
                              type="checkbox"
                              aria-label={`${model.providerModelId} ${CAPABILITY_LABELS[capability]}`}
                              checked={model.capabilities.includes(capability)}
                              disabled={busy}
                              onChange={(event) =>
                                void updateOneModel(
                                  model.id,
                                  event.target.checked
                                    ? [...model.capabilities, capability]
                                    : model.capabilities.filter(
                                        (item) => item !== capability,
                                      ),
                                  model.enabled,
                                )
                              }
                            />
                            {CAPABILITY_LABELS[capability]}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td data-label="启用">
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`${model.providerModelId} 启用`}
                          checked={model.enabled}
                          disabled={busy}
                          onChange={(event) =>
                            void updateOneModel(
                              model.id,
                              model.capabilities,
                              event.target.checked,
                            )
                          }
                        />
                        启用
                      </label>
                    </td>
                    <td data-label="来源">
                      {model.source === 'discovered' ? '查询' : '手动'}
                    </td>
                    <td data-label="操作">
                      <button
                        type="button"
                        className="ad-link-button ad-danger-text"
                        disabled={busy}
                        onClick={() => void removeOneModel(model.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {connection ? (
        <div className="ad-after">
          <button
            type="button"
            className="ui-button ad-danger"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            删除平台
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting}
        title="永久删除这个 AI 平台？"
        description="该平台下的模型也会删除。此操作不能撤销。"
        confirm="删除"
        onConfirm={() => void removeConnection()}
        onCancel={() => setDeleting(false)}
      />
    </section>
  )
}
