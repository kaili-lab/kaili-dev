import { useRef, type ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { useBlocker } from '@tanstack/react-router'

// Admin dialogs (D-163 ④): Base UI handles focus trapping, Escape and focus
// return; nothing animates (D-129). Popups render in a portal outside
// `.ad-root`, so their classes carry the admin type and colours themselves.

/** Confirm / cancel. Focus starts on 取消; Escape cancels. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  /** Label of the destructive action, e.g. 删除 or 离开. */
  confirm: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="ad-backdrop" />
        <AlertDialog.Popup className="ad-dialog" initialFocus={cancel}>
          <AlertDialog.Title className="ad-dialog-title">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="ad-dialog-text">
            {description}
          </AlertDialog.Description>
          <div className="ad-dialog-actions">
            <AlertDialog.Close ref={cancel} className="ui-button">
              取消
            </AlertDialog.Close>
            <button
              type="button"
              className="ui-button ad-danger"
              onClick={onConfirm}
            >
              {confirm}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/**
 * A small form in a modal. Like the confirm dialog, focus starts on 取消
 * (design.md 管理端 · 弹窗); Escape and 取消 close it without saving.
 */
export function FormDialog({
  title,
  submit,
  onSubmit,
  onClose,
  children,
}: {
  title: string
  /** Label of the action button, e.g. 保存 or 创建并选中. */
  submit: string
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ad-backdrop" />
        <Dialog.Popup className="ad-dialog" initialFocus={cancel}>
          <Dialog.Title className="ad-dialog-title">{title}</Dialog.Title>
          {children}
          <div className="ad-dialog-actions">
            <Dialog.Close ref={cancel} className="ui-button">
              取消
            </Dialog.Close>
            <button
              type="button"
              className="ui-button ad-primary"
              onClick={onSubmit}
            >
              {submit}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * D-038 / D-072: leaving with unsaved work asks first. In-app navigation gets
 * the confirm dialog (render the returned element); closing or reloading the
 * tab can only use the browser's own prompt. A move within the same page
 * (language tab, page number, search) is not leaving.
 */
export function useLeaveGuard(
  dirty: boolean,
  options: { leaving?: { current: boolean } } = {},
) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !options.leaving?.current && dirty && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })
  return (
    <ConfirmDialog
      open={blocker.status === 'blocked'}
      title="离开这个页面？"
      description="有未保存的修改，离开后会丢失。"
      confirm="离开"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  )
}
