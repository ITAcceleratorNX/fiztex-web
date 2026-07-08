import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <div className="card mt-6 flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Construction className="h-8 w-8" />
        </div>
        <p className="text-lg font-semibold text-slate-700">Раздел в разработке</p>
        <p className="max-w-md text-sm text-slate-500">
          Этот модуль появится на следующих этапах. В Scope 1 реализован раздел «Вступительные тесты».
        </p>
      </div>
    </div>
  );
}
