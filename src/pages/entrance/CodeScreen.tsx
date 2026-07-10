import { useState, type FormEvent } from 'react';
import { entranceApi } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import type { ApplicantView } from '@/lib/entranceTypes';

/** Section 4.1 — personal code entry. */
export function CodeScreen({ onVerified }: { onVerified: (applicant: ApplicantView) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await entranceApi.verifyCode(code.trim());
      onVerified(res.applicant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntranceShell>
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Вступительное тестирование Fiztex</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Введите персональный код, который выдала школа.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Персональный код" required error={error ?? undefined}>
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Например, DEMO2025"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              error={Boolean(error)}
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading} disabled={!code.trim()}>
            Продолжить
          </Button>
        </form>
      </div>
    </EntranceShell>
  );
}
