import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { useAuth } from '@/context/AuthContext';
import { useKtpCommand } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { ktpApi } from '@/lib/ktpApi';
import { ROUTES } from '@/lib/routes';

export const ktpError = (error: unknown) => error instanceof ApiError ? error.message : 'Не удалось загрузить данные';
export function KtpAccess({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  if (admin?.role !== 'TEACHER') return <ErrorBlock message="У вас нет доступа к этому действию." />;
  return <>{children}</>;
}
export function WorkspaceBack() {
  return <Link to={ROUTES.workspace} className="text-xs font-medium text-muted hover:text-navy-700">Рабочее пространство</Link>;
}
export function SourceButton({ source, name = 'КТП', appearance = 'button' }: { source: Parameters<typeof ktpApi.source>[0]; name?: string; appearance?: 'button' | 'filename' }) {
  const download = useKtpCommand(ktpApi.source, false);
  async function save() {
    try {
      const blob = await download.mutateAsync(source);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = /\.(docx|xlsx)$/i.test(name) ? name : `${name}.${blob.type.includes('spreadsheet') ? 'xlsx' : 'docx'}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* The error stays next to the action. */ }
  }
  return <div className={appearance === 'filename' ? 'min-w-0 max-w-xs' : undefined}><Button className={appearance === 'filename' ? 'max-w-full [&>span]:min-w-0' : undefined} variant={appearance === 'filename' ? 'ghost' : 'secondary'} size={appearance === 'filename' ? 'text' : 'sm'} icon={appearance === 'filename' ? undefined : <Download className="size-4" />} aria-label={appearance === 'filename' ? `Скачать исходный файл ${name}` : undefined} loading={download.isPending} onClick={() => void save()}>{appearance === 'filename' ? <span className="truncate" title={name}>{name}</span> : 'Исходный файл'}</Button>
    {download.isError && <p role="alert" className="mt-1 text-xs text-red-600">{ktpError(download.error)}</p>}</div>;
}
