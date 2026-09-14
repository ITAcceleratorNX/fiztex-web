import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FileDropzone } from './FileDropzone';

function Harness() {
  const [file, setFile] = useState<File | null>(null);
  return <FileDropzone file={file} onChange={setFile} accept=".pdf,.docx" formatsLabel="PDF, DOCX" />;
}

describe('FileDropzone', () => {
  it('после выбора показывает файл с форматом и даёт его убрать', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(['%PDF-1.7'], 'spotlight6_sb.pdf', { type: 'application/pdf' }));

    expect(screen.getByText('spotlight6_sb.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Убрать файл' }));
    expect(screen.getByText('Перетащите файл или нажмите для загрузки')).toBeInTheDocument();
  });
});
