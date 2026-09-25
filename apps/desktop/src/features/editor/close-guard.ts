// 外层工作区关闭标签前，由编辑器确认是否有未保存的文件。
let editorCloseGuard: (() => Promise<boolean>) | undefined;

export function registerEditorCloseGuard(guard: (() => Promise<boolean>) | undefined) {
  editorCloseGuard = guard;
}

export async function canCloseTextEditor(): Promise<boolean> {
  return (await editorCloseGuard?.()) ?? true;
}
