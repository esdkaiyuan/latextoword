import { useState } from 'react';
import { Button } from '@fluentui/react-components';
import { KeyRound, Trash2, X } from 'lucide-react';

type Props = {
  configured: boolean;
  busy: boolean;
  onSave: (appId: string, appKey: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

export default function ImportSettings({ configured, busy, onSave, onRemove, onClose }: Props) {
  const [appId, setAppId] = useState('');
  const [appKey, setAppKey] = useState('');

  return (
    <div className="import-settings-backdrop" role="dialog" aria-modal="true" aria-label="文件识别设置">
      <section className="import-settings">
        <header><span><KeyRound size={16} /> 文件识别设置</span><Button appearance="subtle" icon={<X size={16} />} onClick={onClose} aria-label="关闭" /></header>
        <div className="import-settings-body">
          <label>Mathpix app_id<input autoComplete="off" value={appId} onChange={(event) => setAppId(event.target.value)} placeholder={configured ? '已保存，重新填写可更新' : '输入 app_id'} /></label>
          <label>Mathpix app_key<input type="password" autoComplete="new-password" value={appKey} onChange={(event) => setAppKey(event.target.value)} placeholder={configured ? '已保存，重新填写可更新' : '输入 app_key'} /></label>
          <p>凭据由桌面主进程使用系统加密后保存在本机，不写入公式项目。联网识别会将选中的整份文件上传至 Mathpix；每次上传前都会再次询问。</p>
          <p>本地 OCR 首次使用时会自动准备隔离的 Python 环境并下载 Pix2Text 模型；以后可断网识别，不修改系统 Python。</p>
          <div className="import-settings-status"><span className={configured ? 'is-configured' : ''} />{configured ? '联网识别已配置' : '尚未配置联网识别'}</div>
        </div>
        <footer>{configured && <Button appearance="subtle" icon={<Trash2 size={14} />} disabled={busy} onClick={onRemove}>删除凭据</Button>}<span /><Button appearance="secondary" onClick={onClose}>取消</Button><Button appearance="primary" disabled={busy || !appId.trim() || !appKey.trim()} onClick={() => onSave(appId.trim(), appKey.trim())}>{busy ? '保存中…' : '保存凭据'}</Button></footer>
      </section>
    </div>
  );
}
