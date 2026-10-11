import { openModal } from './modal';
import { platform } from '../platform';
import type { DocumentManager } from '../core/documents';

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/** Lists the automatic backups of the current file; restoring loads one into the editor (undoable, not saved yet). */
export async function openRestore(doc: DocumentManager) {
  if (!doc.file) {
    await platform().showInfo('백업에서 복원', '먼저 파일을 열거나 저장해야 백업을 볼 수 있습니다.');
    return;
  }
  const backups = await platform().listBackups(doc.file);

  const body = document.createElement('div');
  body.className = 'restore';

  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = backups.length
    ? `"${doc.fileName}"의 이전 저장본입니다. 복원하면 에디터에 불러오며, 저장하기 전에는 파일이 바뀌지 않습니다. (Ctrl+Z로 되돌릴 수 있습니다)`
    : `"${doc.fileName}"의 백업이 아직 없습니다. 파일을 저장하면 이전 내용이 자동으로 보관됩니다.`;
  body.append(intro);

  const close = openModal('백업에서 복원', body);

  const list = document.createElement('ul');
  list.className = 'backup-list';
  for (const b of backups) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.textContent = `${new Date(b.timestamp).toLocaleString('ko-KR')}  ·  ${fmtSize(b.size)}`;
    const btn = document.createElement('button');
    btn.textContent = '복원';
    btn.addEventListener('click', async () => {
      try {
        await doc.restoreText(await platform().readBackup(b));
        close();
      } catch (e) {
        await platform().showError('복원하지 못했습니다', String(e));
      }
    });
    li.append(info, btn);
    list.append(li);
  }
  body.append(list);
}
